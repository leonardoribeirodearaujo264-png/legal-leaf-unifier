// =====================================================================
// BI AGGREGATES — espelha /managementV2 do ADVBox.
// Edge function read-only que entrega KPIs e séries para a página
// /business-intelligence da intranet.
//
// Fontes:
//   - advbox_dashboard_cache  (lawsuits + movements em JSONB)
//   - advbox_tasks            (tabela com 13k+ registros)
//   - fin_lancamentos         (custos do escritório, despesas pagas)
//
// Filtros aceitos via query string:
//   - mes (YYYY-MM)            -> default = mês corrente
//   - advogado (nome | "todos") -> default = todos
//   - sort_by (pontos|atividades|tempo|honorarios|custos)
//
// IMPORTANTE: nada de LIMIT artificial. Sem cap em 1000.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Paleta oficial das fases ADVBox (espelhada na intranet)
const STAGE_COLORS = {
  prospeccao: "#8B5CF6",
  producao: "#3B82F6",
  execucao: "#10B981",
  rotacao: "#F59E0B",
};

interface Lawsuit {
  id: number;
  group: string | null;
  type: string | null;
  responsible: string | null;
  responsible_id: number | null;
  fees_money: string | number | null;
  fees_expec: string | number | null;
  created_at: string | null;
  process_date: string | null;
  exit_production: string | null;
  exit_execution: string | null;
  status_closure: string | null;
  customers: Array<{ name: string }> | null;
  archived?: boolean | number | null;
  state?: string | null;
  // P1.6 — campos crus do ADVBox (raw step/stage)
  step?: string | null;
  stage?: string | null;
  steps_id?: number | null;
  stages_id?: number | null;
  notes?: string | null;
  contingency?: string | null;
}

// ---------- helpers ----------

// P1.6 — Classificação por STEP cru do ADVBox (campo "step" do JSONB de cache).
// Mapeia o step cru (ex.: "NEGOCIAÇÃO") para a fase visível na UI ADVBox.
// Esta é a fonte de verdade canonica — sem heurísticas baseadas em datas.
type FaseUI = "atendimento" | "producao" | "execucao" | "arquivado" | "outro";
function classifyByStep(step: string | null | undefined): FaseUI {
  if (!step) return "outro";
  const s = step.trim().toUpperCase();
  // Arquivado: ADVBox UI conta tudo que está em ARQUIVAMENTO.
  if (s === "ARQUIVAMENTO") return "arquivado";
  // Em atendimento / Negociação (carteira pré-judicial)
  if (s === "NEGOCIAÇÃO" || s === "NEGOCIACAO") return "atendimento";
  // Em produção (fase judicial / recursal)
  if (s === "JUDICIAL" || s === "RECURSAL") return "producao";
  // Em execução / cobrança
  if (s === "EXECUÇÃO/COBRANÇA" || s === "EXECUCAO/COBRANCA" || s.startsWith("EXECU")) return "execucao";
  // Steps satélites (ADMINISTRATIVO, CONSULTORIA, RH/FINANCEIRO, MARKETING)
  // — não entram em ATIVOS nem em ARQUIVADOS por padrão (filtro defensivo).
  return "outro";
}

// Stage atual do processo (mantido para Safra & Tempo) — agora prioriza step cru,
// caindo em heurística por datas só quando step não estiver presente.
function getStage(l: Lawsuit): "prospeccao" | "producao" | "execucao" | "rotacao" | "concluido" {
  const fase = classifyByStep(l.step);
  if (fase === "arquivado") return "concluido";
  if (fase === "atendimento") return "prospeccao";
  if (fase === "producao") return "producao";
  if (fase === "execucao") return "execucao";
  // Fallback para lawsuits sem step (cache antigo) — usa heurística clássica.
  if (l.status_closure) return "concluido";
  if (l.exit_execution) return "rotacao";
  if (l.exit_production) return "execucao";
  if (l.process_date) return "producao";
  return "prospeccao";
}

// Diferença em meses (sempre positivo). Usa 30.44 dias por mês.
function monthsBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.max(0, (db - da) / (1000 * 60 * 60 * 24 * 30.44));
}

// Parse "YYYY-MM" -> { inicio, fim } no fuso local UTC
function parseMonth(mes: string | null): { inicio: Date; fim: Date; label: string } {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth(); // 0-11
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [yy, mm] = mes.split("-").map(Number);
    y = yy;
    m = mm - 1;
  }
  const inicio = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const fim = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));
  const label = `${String(m + 1).padStart(2, "0")}/${y}`;
  return { inicio, fim, label };
}

// Comparador de datas seguro
function dentroDoMes(d: string | null, ini: Date, fim: Date): boolean {
  if (!d) return false;
  const dt = new Date(d).getTime();
  return !isNaN(dt) && dt >= ini.getTime() && dt <= fim.getTime();
}

// =====================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const mesParam = url.searchParams.get("mes"); // YYYY-MM
    const advogado = url.searchParams.get("advogado") || "todos";
    const sortBy = url.searchParams.get("sort_by") || "pontos";
    const { inicio, fim, label } = parseMonth(mesParam);

    // -----------------------------------------------------------------
    // 1) Carrega cache (lawsuits + movements em JSONB)
    // -----------------------------------------------------------------
    const { data: cache, error: cacheErr } = await supabase
      .from("advbox_dashboard_cache")
      .select("lawsuits_data, movements_data, total_lawsuits, total_movements, updated_at")
      .eq("id", "singleton")
      .maybeSingle();

    if (cacheErr) throw cacheErr;

    const lawsuits: Lawsuit[] = (cache?.lawsuits_data as Lawsuit[]) || [];

    // Filtro por advogado responsável
    const lawsuitsFiltradas = advogado === "todos"
      ? lawsuits
      : lawsuits.filter((l) => (l.responsible || "").trim() === advogado);

    // -----------------------------------------------------------------
    // Lista de meses disponíveis (dropdown frontend)
    // baseado em created_at das lawsuits
    // -----------------------------------------------------------------
    const mesesSet = new Set<string>();
    for (const l of lawsuits) {
      if (l.created_at) {
        const d = new Date(l.created_at);
        if (!isNaN(d.getTime())) {
          mesesSet.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
        }
      }
    }
    const mesesDisponiveis = Array.from(mesesSet).sort().reverse(); // mais recente primeiro

    // =================================================================
    // ABA 1 — PRODUTIVIDADE (KPIs ADVBox: atribuídas, concluídas, atrasadas, prazo fatal 5d)
    // =================================================================

    // 1.1) Tarefas com due_date no mês selecionado
    // CRÍTICO: PostgREST tem cap default 1000. Usamos .range() em loop para buscar TUDO.
    async function fetchAllTasks(filter: (q: any) => any): Promise<any[]> {
      const all: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase
          .from("advbox_tasks")
          .select("id, status, points, completed_at, due_date, assigned_users, task_type, lawsuit_id, raw_data")
          .range(offset, offset + pageSize - 1);
        q = filter(q);
        const { data, error } = await q;
        if (error) { console.error("[BI] fetchAllTasks erro:", error); break; }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
        if (offset > 50000) break; // failsafe
      }
      return all;
    }
    const tasksMes = await fetchAllTasks((q) => {
      let qq = q.gte("due_date", inicio.toISOString()).lte("due_date", fim.toISOString());
      if (advogado !== "todos") qq = qq.ilike("assigned_users", `%${advogado}%`);
      return qq;
    });

    const tasksAtribuidas = tasksMes.length;
    const tasksConcluidas = tasksMes.filter(
      (t) => t.status === "completed" || t.completed_at
    ).length;

    // 1.2) Atrasadas — pendentes com due_date < hoje (count + amostra para tipos)
    const now = new Date();
    // Count exato
    let atrasadasCountQ = supabase
      .from("advbox_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("due_date", now.toISOString());
    if (advogado !== "todos") atrasadasCountQ = atrasadasCountQ.ilike("assigned_users", `%${advogado}%`);
    const { count: atrasadasCount } = await atrasadasCountQ;

    // Amostra para tipos (até 5000 — suficiente para top 10)
    let atrasadasSampleQ = supabase
      .from("advbox_tasks")
      .select("id, title, due_date, assigned_users, client_name, task_type")
      .eq("status", "pending")
      .lt("due_date", now.toISOString())
      .range(0, 4999);
    if (advogado !== "todos") atrasadasSampleQ = atrasadasSampleQ.ilike("assigned_users", `%${advogado}%`);
    const { data: atrasadasData } = await atrasadasSampleQ;

    // 1.3) Prazo fatal próximos 5 dias
    const cincoDias = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    let prazoFatalQuery = supabase
      .from("advbox_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("due_date", now.toISOString())
      .lte("due_date", cincoDias.toISOString());
    if (advogado !== "todos") {
      prazoFatalQuery = prazoFatalQuery.ilike("assigned_users", `%${advogado}%`);
    }
    const { count: prazoFatalCount } = await prazoFatalQuery;

    // 1.4) Agregação por TIPO de tarefa atrasada (tabela ADVBox)
    const tipoMap = new Map<string, number>();
    for (const a of atrasadasData || []) {
      const tipo = (a.task_type || "Sem tipo").trim();
      tipoMap.set(tipo, (tipoMap.get(tipo) || 0) + 1);
    }
    const atrasadasPorTipo = Array.from(tipoMap.entries())
      .map(([tipo, qtd]) => ({ tipo, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);

    // 1.5) Série semanal: tarefas atribuídas vs concluídas (S T Q Q S do mês selecionado)
    // Pegamos a SEMANA atual dentro do mês (segunda a sexta).
    const hojeUTC = new Date();
    const dow = hojeUTC.getUTCDay() || 7; // 1..7
    const seg = new Date(hojeUTC);
    seg.setUTCDate(hojeUTC.getUTCDate() - (dow - 1));
    seg.setUTCHours(0, 0, 0, 0);
    const semanaSerie: Array<{ dia: string; atribuidas: number; concluidas: number }> = [];
    const diasLabel = ["S", "T", "Q", "Q", "S"];
    for (let i = 0; i < 5; i++) {
      const dia = new Date(seg);
      dia.setUTCDate(seg.getUTCDate() + i);
      const diaFim = new Date(dia);
      diaFim.setUTCHours(23, 59, 59);
      let atribuidasQ = supabase
        .from("advbox_tasks")
        .select("id", { count: "exact", head: true })
        .gte("due_date", dia.toISOString())
        .lte("due_date", diaFim.toISOString());
      let concluidasQ = supabase
        .from("advbox_tasks")
        .select("id", { count: "exact", head: true })
        .gte("completed_at", dia.toISOString())
        .lte("completed_at", diaFim.toISOString());
      if (advogado !== "todos") {
        atribuidasQ = atribuidasQ.ilike("assigned_users", `%${advogado}%`);
        concluidasQ = concluidasQ.ilike("assigned_users", `%${advogado}%`);
      }
      const [{ count: atrCount }, { count: concCount }] = await Promise.all([
        atribuidasQ, concluidasQ,
      ]);
      semanaSerie.push({
        dia: diasLabel[i],
        atribuidas: atrCount || 0,
        concluidas: concCount || 0,
      });
    }

    // 1.6) Ranking por advogado (cards individuais)
    // Agrupa todas as tarefas do mês por usuário (assigned_users.split(",")[0])
    const advogadoMap = new Map<string, { tarefas: number; pontos: number; concluidas: number; atrasadas: number; primeira: string | null }>();
    for (const t of tasksMes || []) {
      // ADVBox manda múltiplos responsáveis em raw_data.users
      const users = (t.raw_data as any)?.users || [];
      const nomes: string[] = users.length > 0
        ? users.map((u: any) => u.name).filter(Boolean)
        : (t.assigned_users || "").split(",").map((s: string) => s.trim()).filter(Boolean);

      for (const nome of nomes) {
        const cur = advogadoMap.get(nome) || { tarefas: 0, pontos: 0, concluidas: 0, atrasadas: 0, primeira: null };
        cur.tarefas += 1;
        cur.pontos += t.points || 0;
        const userObj = users.find((u: any) => u.name === nome);
        if ((t.status === "completed" && t.completed_at) || userObj?.completed) {
          cur.concluidas += 1;
        }
        if (t.status === "pending" && t.due_date && new Date(t.due_date) < now) {
          cur.atrasadas += 1;
        }
        if (!cur.primeira || (t.due_date && t.due_date < cur.primeira)) {
          cur.primeira = t.due_date;
        }
        advogadoMap.set(nome, cur);
      }
    }
    let advogadosRanking = Array.from(advogadoMap.entries()).map(([nome, v]) => {
      const taxa = v.tarefas > 0 ? (v.concluidas / v.tarefas) * 100 : 0;
      const media = v.tarefas > 0 ? v.pontos / v.tarefas : 0;
      return { nome, ...v, taxa_conclusao: taxa, media_pontos: media };
    });

    // Ordenação dinâmica conforme filtro Classificar por
    advogadosRanking.sort((a, b) => {
      switch (sortBy) {
        case "atividades": return b.tarefas - a.tarefas;
        case "tempo": return b.atrasadas - a.atrasadas;
        case "honorarios": return b.media_pontos - a.media_pontos;
        case "custos": return a.tarefas - b.tarefas; // inverso
        case "pontos":
        default: return b.pontos - a.pontos;
      }
    });
    advogadosRanking = advogadosRanking.slice(0, 18);

    // 1.7) Atividades recentes (últimas 8 tarefas concluídas no mês)
    let recentesQ = supabase
      .from("advbox_tasks")
      .select("title, completed_at, assigned_users, task_type, client_name")
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", inicio.toISOString())
      .lte("completed_at", fim.toISOString())
      .order("completed_at", { ascending: false })
      .limit(8);
    if (advogado !== "todos") {
      recentesQ = recentesQ.ilike("assigned_users", `%${advogado}%`);
    }
    const { data: recentes } = await recentesQ;

    const produtividade = {
      kpis: {
        atribuidas: tasksAtribuidas,
        concluidas: tasksConcluidas,
        atrasadas: atrasadasCount || 0,
        prazo_fatal_5d: prazoFatalCount || 0,
      },
      progresso_mes: {
        concluidas: tasksConcluidas,
        atribuidas: tasksAtribuidas,
        percentual: tasksAtribuidas > 0 ? (tasksConcluidas / tasksAtribuidas) * 100 : 0,
      },
      semana_serie: semanaSerie,
      atrasadas_por_tipo: atrasadasPorTipo,
      advogados: advogadosRanking,
      recentes: (recentes || []).map((r) => ({
        titulo: r.title,
        responsavel: (r.assigned_users || "").split(",")[0]?.trim(),
        tipo: r.task_type,
        cliente: r.client_name,
        completado_em: r.completed_at,
      })),
    };

    // =================================================================
    // ABA 2 — ESTOQUE & PROSPECÇÃO
    // KPIs ADVBox: oportunidades do mês, processos ativos, arquivados, +120d parados
    // =================================================================
    // CORREÇÃO P1.6 — classificação por STEP cru do ADVBox.
    // O ADVBox /managementV2 usa o campo `step` para classificar a carteira:
    //   - "ARQUIVAMENTO"     -> Arquivados        (alvo: 9.514)
    //   - "NEGOCIAÇÃO"       -> Em atendimento    (alvo: 630)
    //   - "JUDICIAL" + "RECURSAL" -> Em produção  (alvo: 1.184; UI ADVBox: 1.257)
    //   - "EXECUÇÃO/COBRANÇA" -> Em execução      (alvo: 588)
    //   - Steps administrativos (CONSULTORIA, ADMINISTRATIVO, RH/FINANCEIRO, MARKETING)
    //     são EXCLUÍDOS de ATIVOS por padrão (filtro defensivo). Lo­gados separadamente.
    // %carteira tem como denominador SOMA das 3 fases ativas (= 100%)
    // +120d = ativos cujo último marco temporal é > 120 dias atrás

    const mesAntInicio = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() - 1, 1));
    const mesAntFim = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 0, 23, 59, 59));

    let oportunidadesMes = 0;
    let oportunidadesMesAnt = 0;
    let fechamentosMes = 0;
    let fechamentosMesAnt = 0;

    // Contagens de carteira (espelham ADVBox /managementV2)
    let qtdAtendimento = 0;
    let qtdProducao = 0;
    let qtdExecucao = 0;
    let qtdArquivados = 0;
    let qtdOutros = 0; // steps satélites — registrados mas fora dos ATIVOS
    let qtdSemStep = 0; // sem step (cache antigo / inconsistência)
    let qtdParados120 = 0;

    const areaCount = new Map<string, number>();
    const grupoMap = new Map<string, { oportunidades: number; fechamentos: number }>();
    const limite120 = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

    for (const l of lawsuitsFiltradas) {
      const area = l.group || "Outros";
      areaCount.set(area, (areaCount.get(area) || 0) + 1);

      // Oportunidades do mês (created_at)
      if (dentroDoMes(l.created_at, inicio, fim)) {
        oportunidadesMes++;
        const cur = grupoMap.get(area) || { oportunidades: 0, fechamentos: 0 };
        cur.oportunidades++;
        grupoMap.set(area, cur);
      }
      if (dentroDoMes(l.created_at, mesAntInicio, mesAntFim)) {
        oportunidadesMesAnt++;
      }

      // Fechamentos = lawsuits encerradas no mês (status_closure)
      if (l.status_closure) {
        if (dentroDoMes(l.status_closure, inicio, fim)) {
          fechamentosMes++;
          const cur = grupoMap.get(area) || { oportunidades: 0, fechamentos: 0 };
          cur.fechamentos++;
          grupoMap.set(area, cur);
        }
        if (dentroDoMes(l.status_closure, mesAntInicio, mesAntFim)) {
          fechamentosMesAnt++;
        }
      }

      // Classificação canônica por STEP cru
      const fase = classifyByStep(l.step);

      if (fase === "arquivado") {
        qtdArquivados++;
        continue; // arquivado não entra em ativos nem em +120d
      }

      if (fase === "atendimento") qtdAtendimento++;
      else if (fase === "producao") qtdProducao++;
      else if (fase === "execucao") qtdExecucao++;
      else {
        // outro: ADMINISTRATIVO/CONSULTORIA/RH/MARKETING ou step nulo
        if (!l.step) qtdSemStep++;
        else qtdOutros++;
        continue; // não conta como ativo
      }

      // +120 dias parados (último marco temporal) — apenas para ATIVOS reais
      const ultimaMov = l.exit_execution || l.exit_production || l.process_date || l.created_at;
      if (ultimaMov && new Date(ultimaMov) < limite120) {
        qtdParados120++;
      }
    }

    // Log de calibração — útil para conferir com a UI ADVBox
    console.log(
      `[BI Estoque] atendimento=${qtdAtendimento} producao=${qtdProducao} execucao=${qtdExecucao} ` +
      `arquivados=${qtdArquivados} outros=${qtdOutros} sem_step=${qtdSemStep} ` +
      `total_classificado=${qtdAtendimento + qtdProducao + qtdExecucao + qtdArquivados + qtdOutros + qtdSemStep}`
    );

    const processosAtivos = qtdAtendimento + qtdProducao + qtdExecucao;
    const processosArquivados = qtdArquivados;
    const processos120Parados = qtdParados120;

    // Percentuais de carteira (somam 100% sobre processos ATIVOS)
    const pctCarteira = (n: number) => processosAtivos > 0 ? (n / processosAtivos) * 100 : 0;

    // Manter fasesCount para reuso em custos/safra (incluindo concluídos)
    const fasesCount = {
      prospeccao: qtdAtendimento,
      producao: qtdProducao,
      execucao: qtdExecucao,
      rotacao: 0, // ADVBox não usa fase "rotação" separada — agregado em arquivados
      concluido: qtdArquivados,
    };

    const areas = Array.from(areaCount.entries())
      .map(([area, qtd]) => ({ area, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 12);

    // Evolução mensal (últimos 12 meses)
    const evolucao: Array<{ mes: string; novos: number; concluidos: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const mIni = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mFim = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0, 23, 59, 59));
      let novos = 0, concluidos = 0;
      for (const l of lawsuitsFiltradas) {
        if (dentroDoMes(l.created_at, mIni, mFim)) novos++;
        if (dentroDoMes(l.status_closure, mIni, mFim)) concluidos++;
      }
      evolucao.push({
        mes: `${String(mIni.getUTCMonth() + 1).padStart(2, "0")}/${String(mIni.getUTCFullYear()).slice(2)}`,
        novos,
        concluidos,
      });
    }

    // Resumo da carteira (mini cards com sparkline básico)
    // Variação % vs mês anterior
    const deltaPercent = (atual: number, ant: number) =>
      ant > 0 ? ((atual - ant) / ant) * 100 : 0;

    const estoque = {
      kpis: {
        oportunidades_mes: oportunidadesMes,
        oportunidades_delta: deltaPercent(oportunidadesMes, oportunidadesMesAnt),
        processos_ativos: processosAtivos,
        processos_arquivados: processosArquivados,
        processos_120_parados: processos120Parados,
      },
      resumo_carteira: {
        fechamentos: { valor: fechamentosMes, delta: deltaPercent(fechamentosMes, fechamentosMesAnt) },
        em_atendimento: {
          valor: qtdAtendimento,
          percentual: pctCarteira(qtdAtendimento),
          delta: 0,
        },
        em_producao: {
          valor: qtdProducao,
          percentual: pctCarteira(qtdProducao),
          delta: 0,
        },
        em_execucao: {
          valor: qtdExecucao,
          percentual: pctCarteira(qtdExecucao),
          delta: 0,
        },
      },
      por_grupo_acao: Array.from(grupoMap.entries())
        .map(([grupo, v]) => ({ grupo, ...v }))
        .sort((a, b) => b.oportunidades + b.fechamentos - (a.oportunidades + a.fechamentos))
        .slice(0, 10),
      por_periodo: evolucao,
      taxa_conversao: oportunidadesMes > 0 ? (fechamentosMes / oportunidadesMes) * 100 : 0,
      areas,
      composicao: [
        { fase: "Em atendimento", qtd: qtdAtendimento, cor: STAGE_COLORS.prospeccao },
        { fase: "Em produção", qtd: qtdProducao, cor: STAGE_COLORS.producao },
        { fase: "Em execução", qtd: qtdExecucao, cor: STAGE_COLORS.execucao },
      ],
    };

    // =================================================================
    // ABA 3 — TEMPO & HONORÁRIOS
    // P1.8 (correção 26/04 — alinhar com ADVBox /managementV2):
    //   - COORTE 24m: SOMENTE processos com last_movement >= now() - 730d
    //     (mediana sem coorte ficou enviesada por arquivados de décadas
    //     atrás, ex.: Produção 54m vs alvo ADVBox 8m).
    //   - MEDIANA da DURAÇÃO DENTRO de cada fase, calculada via
    //     timestamps de transição cru do ADVBox:
    //       Prospecção = created_at -> process_date
    //       Produção   = process_date -> exit_production
    //       Execução   = exit_production -> exit_execution
    //       Rotação    = exit_execution -> status_closure  (proxy)
    //   - Para processos ATIVOS sem timestamp de saída ainda,
    //     usamos (now() - timestamp_entrada_da_fase) como proxy.
    //   - "Rotação" no ADVBox = ciclo completo (turns/ano).
    //     Se mediana = 1 mês -> ~12 turns/ano. Frontend exibe alinhado.
    // =================================================================
    const COORTE_TEMPO_DIAS = 730; // 24 meses
    const limiteTempo = new Date(now.getTime() - COORTE_TEMPO_DIAS * 24 * 60 * 60 * 1000);

    // último marco temporal do processo (proxy de last_movement)
    const lastMov = (l: Lawsuit): Date | null => {
      const candidatos = [l.status_closure, l.exit_execution, l.exit_production, l.process_date, l.created_at]
        .filter(Boolean) as string[];
      for (const c of candidatos) {
        const d = new Date(c);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };

    // Sem cap de outliers (mediana cuida) — só descarta valores negativos / inválidos.
    const safeMonths = (a: string | null, b: string | null): number | null => {
      const v = monthsBetween(a, b);
      if (v <= 0) return null;
      return v;
    };

    // Mediana auxiliar
    const median = (arr: number[]): number => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    };

    // Buckets para mediana por fase + total + honorários
    const bucketProsp: number[] = [];
    const bucketProd: number[] = [];
    const bucketExec: number[] = [];
    const bucketRot: number[] = [];
    const bucketTotal: number[] = [];
    const bucketFees: number[] = [];
    let tempoPerdido = 0;
    let countTempoPerdido = 0;
    const honorariosPorGrupo = new Map<string, { fees: number[]; tempo: number[] }>();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();

    let descartadosCoorteTempo = 0;
    for (const l of lawsuitsFiltradas) {
      // P1.8 — filtro de coorte 24m. Exclui processos cujo último marco
      // temporal é mais antigo que 730 dias atrás. Sem isso, mediana fica
      // enviesada por arquivados antigos que ficaram décadas em cada fase.
      const lm = lastMov(l);
      if (!lm || lm < limiteTempo) {
        descartadosCoorteTempo++;
        continue;
      }

      const fee = Number(l.fees_money || 0);
      if (fee > 0) bucketFees.push(fee);

      // Duração DENTRO de cada fase (não idade do processo).
      // Para fases já encerradas usamos os timestamps de saída.
      // Para a fase atual de processos ATIVOS, usamos (now() - entrada).
      const fase = classifyByStep(l.step);

      // Prospecção: created_at -> process_date (ou now() se ainda em atendimento)
      const v1 = l.process_date
        ? safeMonths(l.created_at, l.process_date)
        : (fase === "atendimento" ? safeMonths(l.created_at, nowIso) : null);
      if (v1 !== null) bucketProsp.push(v1);

      // Produção: process_date -> exit_production (ou now() se ainda em produção)
      const v2 = l.exit_production
        ? safeMonths(l.process_date, l.exit_production)
        : (fase === "producao" ? safeMonths(l.process_date, nowIso) : null);
      if (v2 !== null) bucketProd.push(v2);

      // Execução: exit_production -> exit_execution (ou now() se ainda em execução)
      const v3 = l.exit_execution
        ? safeMonths(l.exit_production, l.exit_execution)
        : (fase === "execucao" ? safeMonths(l.exit_production, nowIso) : null);
      if (v3 !== null) bucketExec.push(v3);

      // Rotação (pós-execução até arquivamento) — apenas para arquivados
      const v4 = safeMonths(l.exit_execution, l.status_closure);
      if (v4 !== null) bucketRot.push(v4);

      const vTot = safeMonths(l.created_at, l.status_closure);
      if (vTot !== null) {
        bucketTotal.push(vTot);
        const efetivo = (v1 || 0) + (v2 || 0) + (v3 || 0) + (v4 || 0);
        if (vTot > efetivo) {
          tempoPerdido += (vTot - efetivo);
          countTempoPerdido++;
        }
      }

      const grp = l.group || "Outros";
      const cur = honorariosPorGrupo.get(grp) || { fees: [], tempo: [] };
      if (fee > 0) cur.fees.push(fee);
      if (vTot !== null) cur.tempo.push(vTot);
      honorariosPorGrupo.set(grp, cur);
    }

    // Honorário e tempo via MEDIANA da coorte recente
    const honorarioMedio = median(bucketFees);
    const tempoMedio = median(bucketTotal);
    const honorarioMes = tempoMedio > 0 ? honorarioMedio / tempoMedio : 0;

    // Medianas por estágio — meses inteiros (espelha ADVBox)
    const stages = {
      prospeccao: Math.round(median(bucketProsp)),
      producao: Math.round(median(bucketProd)),
      execucao: Math.round(median(bucketExec)),
      rotacao: Math.round(median(bucketRot)),
    };
    // P1.8 — "Rotação" no ADVBox = ciclo completo em MESES (alvo ~12m).
    // Calculamos como soma das fases ativas (prosp + prod + exec) que representa
    // o ciclo de vida típico de um processo até o arquivamento.
    const rotacaoCompleta = stages.prospeccao + stages.producao + stages.execucao;
    // Display alternativo: turns/ano (12 / mediana_rot). Útil quando ADVBox usa essa unidade.
    const rotacaoTurnsAno = stages.rotacao > 0 ? 12 / stages.rotacao : 0;

    console.log(
      `[BI Tempo] coorte=${COORTE_TEMPO_DIAS}d total=${bucketTotal.length} descartados_coorte=${descartadosCoorteTempo} ` +
      `mediana_total=${tempoMedio.toFixed(1)}m honorario_mediano=${honorarioMedio.toFixed(2)} ` +
      `stages=${JSON.stringify(stages)} rotacao_completa=${rotacaoCompleta}m turns_ano=${rotacaoTurnsAno.toFixed(1)} ` +
      `buckets=prosp:${bucketProsp.length} prod:${bucketProd.length} exec:${bucketExec.length} rot:${bucketRot.length}`
    );

    const tempo = {
      stages,
      kpis: {
        honorario_medio: honorarioMedio,
        honorario_mes: honorarioMes,
        tempo_medio_meses: tempoMedio,
        tempo_perdido_meses: Math.round(tempoPerdido),
        rotacao_completa: rotacaoCompleta,
        rotacao_turns_ano: rotacaoTurnsAno, // P1.8 — para frontend exibir alinhado ADVBox
      },
      por_grupo: Array.from(honorariosPorGrupo.entries())
        .map(([grupo, v]) => {
          // Mediana por grupo (mantém consistência com KPIs principais)
          const medTempo = median(v.tempo);
          const medFee = median(v.fees);
          return {
            grupo,
            media_meses: medTempo,
            media_honorario: medFee,
            mensal: medTempo > 0 ? medFee / medTempo : 0,
            count: v.fees.length,
          };
        })
        .filter((g) => g.count >= 5)
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    };

    // =================================================================
    // ABA 4 — CUSTOS
    // P1.7 (correção solicitada pelo cliente):
    //   custo_medio_por_fase = SUM(despesas com lawsuit em fase X)
    //                          / COUNT(DISTINCT lawsuits em fase X)
    //   Aritmética pura: pega despesas pagas no MÊS, faz JOIN com
    //   advbox_financial_sync (que tem lawsuit_id no JSONB advbox_data)
    //   e classifica via classifyByStep(lawsuit.step).
    //
    // Antes da agregação loga o COUNT por fase para auditoria — se
    // execucao/rotacao vierem zeradas, o problema é o classificador
    // ou o JOIN (transactions sem lawsuit_id).
    // =================================================================

    // 4.1) Mapa rápido lawsuit_id -> fase (a partir do cache JSONB)
    const lawsuitFase = new Map<number, FaseUI>();
    const lawsuitGrupo = new Map<number, string>();
    for (const l of lawsuits) {
      lawsuitFase.set(l.id, classifyByStep(l.step));
      lawsuitGrupo.set(l.id, l.group || "Outros");
    }

    // 4.2) Despesas pagas no MÊS — busca todas paginadas
    async function fetchAllDespesas(): Promise<any[]> {
      const all: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("fin_lancamentos")
          .select("id, valor, categoria_id, fin_categorias!fin_lancamentos_categoria_id_fkey(nome, grupo)")
          .eq("tipo", "despesa")
          .eq("status", "pago")
          .gte("data_pagamento", inicio.toISOString().slice(0, 10))
          .lte("data_pagamento", fim.toISOString().slice(0, 10))
          .is("deleted_at", null)
          .range(offset, offset + pageSize - 1);
        if (error) { console.error("[BI Custos] fetchAllDespesas erro:", error); break; }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
        if (offset > 50000) break;
      }
      return all;
    }
    const despesas = await fetchAllDespesas();

    // 4.3) Total geral de custos no mês
    let totalCustos = 0;
    for (const d of despesas || []) {
      totalCustos += Number(d.valor || 0);
    }

    // 4.4) JOIN despesas <-> lawsuits via advbox_financial_sync
    // Mapeamento lawsuit_id -> { area, fase } via cache
    const lawsuitArea = new Map<number, string>();
    for (const l of lawsuits) {
      lawsuitArea.set(l.id, (l.group || "GERAL").toUpperCase());
    }

    // 4.4.1) Buscar TODOS os syncs do mês. Acumulamos custos por fase
    // e identificamos os "órfãos" (despesas sem lawsuit_id no JSONB),
    // que serão rateados proporcionalmente entre as fases ativas.
    const despesasIds = (despesas || []).map((d: any) => d.id);
    const despesaValor = new Map<string, number>();
    for (const d of despesas || []) {
      despesaValor.set(d.id, Number(d.valor || 0));
    }
    let custoPorFase = { atendimento: 0, producao: 0, execucao: 0, arquivado: 0, outro: 0 };
    let lawsuitsComCustoPorFase = {
      atendimento: new Set<number>(),
      producao: new Set<number>(),
      execucao: new Set<number>(),
      arquivado: new Set<number>(),
      outro: new Set<number>(),
    };
    // Custos rateados por ÁREA do processo (denominador real para Aba 4)
    const custoPorArea = new Map<string, number>();
    const lawsuitsComCustoPorArea = new Map<string, Set<number>>();
    // P1.8 — controle de órfãos (despesas sem lawsuit_id no sync)
    const despesasComLawsuit = new Set<string>();
    let totalCustosComLawsuit = 0;

    if (despesasIds.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < despesasIds.length; i += CHUNK) {
        const slice = despesasIds.slice(i, i + CHUNK);
        const { data: syncs, error: syncErr } = await supabase
          .from("advbox_financial_sync")
          .select("lancamento_id, advbox_data")
          .in("lancamento_id", slice);
        if (syncErr) { console.error("[BI Custos] sync chunk erro:", syncErr); continue; }
        for (const s of syncs || []) {
          const lawsuitId = Number((s.advbox_data as any)?.lawsuit_id || 0);
          if (!lawsuitId) continue;
          // Usa o valor REAL do lançamento (campo amount do JSONB às vezes vem nulo).
          // Preferimos despesaValor[lancamento_id] como fonte de verdade.
          const amount = despesaValor.get(s.lancamento_id) ?? Number((s.advbox_data as any)?.amount || 0);
          const fase = lawsuitFase.get(lawsuitId) || "outro";
          custoPorFase[fase] += amount;
          lawsuitsComCustoPorFase[fase].add(lawsuitId);
          // Agrega por ÁREA também
          const area = lawsuitArea.get(lawsuitId) || "GERAL";
          custoPorArea.set(area, (custoPorArea.get(area) || 0) + amount);
          if (!lawsuitsComCustoPorArea.has(area)) lawsuitsComCustoPorArea.set(area, new Set());
          lawsuitsComCustoPorArea.get(area)!.add(lawsuitId);
          despesasComLawsuit.add(s.lancamento_id);
          totalCustosComLawsuit += amount;
        }
      }
    }
    // Custos órfãos = despesas pagas no mês que não têm lawsuit_id no sync.
    // Representam custo "geral" do escritório (folha, aluguel, marketing).
    const totalCustosSemLawsuit = totalCustos - totalCustosComLawsuit;

    // P1.8 — Rateio dos órfãos proporcionalmente ao volume de processos
    // de cada fase. Sem isso, Prospecção (que raramente tem custo direto
    // amarrado) ficaria sempre R$0 e Execução/Rotação inflados.
    const totalAtivos = qtdAtendimento + qtdProducao + qtdExecucao + qtdArquivados;
    if (totalAtivos > 0 && totalCustosSemLawsuit > 0) {
      custoPorFase.atendimento += totalCustosSemLawsuit * (qtdAtendimento / totalAtivos);
      custoPorFase.producao    += totalCustosSemLawsuit * (qtdProducao    / totalAtivos);
      custoPorFase.execucao    += totalCustosSemLawsuit * (qtdExecucao    / totalAtivos);
      custoPorFase.arquivado   += totalCustosSemLawsuit * (qtdArquivados  / totalAtivos);
    }

    console.log(
      `[BI Custos JOIN] despesas_mes=${despesasIds.length} ` +
      `com_lawsuit=${despesasComLawsuit.size} sem_lawsuit=${despesasIds.length - despesasComLawsuit.size} ` +
      `total_custos=${totalCustos.toFixed(2)} ` +
      `total_custos_com_lawsuit_id=${totalCustosComLawsuit.toFixed(2)} ` +
      `total_custos_sem_lawsuit_id=${totalCustosSemLawsuit.toFixed(2)} ` +
      `areas_com_custo=${custoPorArea.size}`
    );

    // 4.5) Custo médio por processo POR FASE = soma_total_da_fase / total_de_processos_da_fase
    // P1.8 — denominador trocado: usa qtd TOTAL de processos da fase
    // (do ADVBox /managementV2), não só os com custo direto. Isso espelha
    // a fórmula que o ADVBox usa em Custos > Por Fase.
    const custoMedioFase = {
      prospeccao: qtdAtendimento > 0 ? custoPorFase.atendimento / qtdAtendimento : 0,
      producao:   qtdProducao    > 0 ? custoPorFase.producao    / qtdProducao    : 0,
      execucao:   qtdExecucao    > 0 ? custoPorFase.execucao    / qtdExecucao    : 0,
      // Rotação = arquivados (proxy: o ADVBox conta custo do ciclo inteiro até arquivar)
      rotacao:    qtdArquivados  > 0 ? custoPorFase.arquivado   / qtdArquivados  : 0,
    };

    console.log(
      `[BI Custos] qtd_processos_por_fase atendimento=${qtdAtendimento} producao=${qtdProducao} ` +
      `execucao=${qtdExecucao} arquivados=${qtdArquivados} | ` +
      `lawsuits_com_custo atendimento=${lawsuitsComCustoPorFase.atendimento.size} ` +
      `producao=${lawsuitsComCustoPorFase.producao.size} ` +
      `execucao=${lawsuitsComCustoPorFase.execucao.size} ` +
      `arquivado=${lawsuitsComCustoPorFase.arquivado.size} | ` +
      `SUM_custos_por_fase atendimento=${custoPorFase.atendimento.toFixed(2)} ` +
      `producao=${custoPorFase.producao.toFixed(2)} ` +
      `execucao=${custoPorFase.execucao.toFixed(2)} ` +
      `arquivado=${custoPorFase.arquivado.toFixed(2)} | ` +
      `custo_medio_fase prosp=${custoMedioFase.prospeccao.toFixed(2)} ` +
      `prod=${custoMedioFase.producao.toFixed(2)} ` +
      `exec=${custoMedioFase.execucao.toFixed(2)} ` +
      `rot=${custoMedioFase.rotacao.toFixed(2)}`
    );

    // Total de pontos do mês para custo/ponto
    let pontosMes = 0;
    for (const t of tasksMes || []) {
      if (t.status === "completed" || t.completed_at) pontosMes += t.points || 0;
    }
    const custoPorPonto = pontosMes > 0 ? totalCustos / pontosMes : 0;

    const custos = {
      kpis: {
        prospeccao: custoMedioFase.prospeccao,
        producao: custoMedioFase.producao,
        execucao: custoMedioFase.execucao,
        rotacao: custoMedioFase.rotacao,
        custo_por_ponto: custoPorPonto,
      },
      // Grupos = ÁREAS do processo com custo rateado real (via JOIN advbox_financial_sync)
      // Antes usava grupo financeiro (Clientes/Pessoal/etc) — errado pois não bate com áreas
      grupos: Array.from(custoPorArea.entries())
        .map(([grupo, valor]) => {
          const procsArea = lawsuitsComCustoPorArea.get(grupo)?.size || 0;
          return {
            grupo,
            valor,
            percentual: totalCustos > 0 ? (valor / totalCustos) * 100 : 0,
            custo_por_processo: procsArea > 0 ? valor / procsArea : 0,
            qtd_processos: procsArea,
          };
        })
        .sort((a, b) => b.valor - a.valor),
      total: totalCustos,
    };

    // =================================================================
    // ABA 5 — SAFRA & QUALIDADE
    // P1.6 — heurística inferida (independe de stage textual cobrir tudo):
    //   GANHO  = arquivado COM fees_money > 0
    //   PERDA  = arquivado SEM fees_money (0 ou null)
    //   COORTE = últimos 24 meses (last_movement >= now() - 730d)
    // Top 4 áreas por % de ganho com mínimo 5 fechamentos para entrar.
    // Mantemos fallback por stage textual quando o campo estiver presente.
    // =================================================================
    const COORTE_SAFRA_DIAS = 730; // 24 meses
    const limiteSafra = new Date(now.getTime() - COORTE_SAFRA_DIAS * 24 * 60 * 60 * 1000);

    // Stages textuais (override quando presente — evita falso positivo)
    const STAGE_GANHO = new Set([
      "TRÂNSITO EM JULGADO", "TRANSITADO EM JULGADO", "RECURSO JULGADO",
      "DECISÃO PROFERIDA", "AGUARDANDO PAGAMENTO DO PRECATÓRIO",
      "AGUARDANDO PAGAMENTO DE CONDENAÇÃO", "PROCESSO SENTENCIADO",
      "FORMAÇÃO DO PRECATÓRIO/RPV", "LIQUIDAÇÃO DE SENTENÇA",
    ]);
    const STAGE_PERDA = new Set([
      "PERDA DO CONTRATO", "ARQUIVADO / LEAD NÃO FECHOU",
      "ANALISADO E NÃO DISTRIBUÍDO - INVIÁVEL OU DESINTERESSE DO CLIENTE",
    ]);

    // Classificador heurístico: ganho/perda só fazem sentido se o processo
    // estiver arquivado. Para arquivados, fees_money>0 = ganho (advogado
    // recebeu honorário) e fees_money==0/null = perda (não houve recebimento).
    function classifyOutcome(l: Lawsuit): "ganho" | "perda" | "neutro" {
      const stg = (l.stage || "").trim().toUpperCase();
      if (STAGE_GANHO.has(stg)) return "ganho";
      if (STAGE_PERDA.has(stg)) return "perda";
      // Heurística: arquivado COM fee = ganho; SEM fee = perda
      const fee = Number(l.fees_money || 0);
      return fee > 0 ? "ganho" : "perda";
    }

    const safraPorArea = new Map<string, { ganhos: number; perdas: number; total: number }>();
    let descartadosForaCoorte = 0;
    // Shape do ADVBox confirmado: NÃO há campo nativo de outcome (win/loss).
    // Campos disponíveis no JSONB: id, step, stage, group, type, customers,
    // created_at, process_date, exit_production, exit_execution, status_closure,
    // fees_money (preenchido em ~0,6% dos arquivados), fees_expec, contingency,
    // responsible, notes (sempre null nas amostras), folder.
    // Heurística atual fees_money>0=ganho é o melhor proxy possível sem
    // mudar a coleta no ADVBox para incluir archive_reason ou outcome custom.

    for (const l of lawsuitsFiltradas) {
      const grp = l.group || "Outros";
      const cur = safraPorArea.get(grp) || { ganhos: 0, perdas: 0, total: 0 };
      cur.total++;

      const isArquivado = classifyByStep(l.step) === "arquivado" || !!l.status_closure;
      if (isArquivado) {
        // Filtro de coorte recente — só conta arquivamentos dos últimos 24m
        const lm = lastMov(l);
        if (!lm || lm < limiteSafra) {
          descartadosForaCoorte++;
        } else {
          const o = classifyOutcome(l);
          if (o === "ganho") cur.ganhos++;
          else if (o === "perda") cur.perdas++;
        }
      }
      safraPorArea.set(grp, cur);
    }

    console.log(
      `[BI Safra] coorte=${COORTE_SAFRA_DIAS}d areas=${safraPorArea.size} ` +
      `descartados_fora_coorte=${descartadosForaCoorte}`
    );

    // Top 4 ordenado por % de ganho (= ganhos / (ganhos+perdas)), mínimo 5 fechamentos
    const areasQualidade = Array.from(safraPorArea.entries())
      .map(([area, v]) => {
        const fechados = v.ganhos + v.perdas;
        const pctGanho = fechados > 0 ? (v.ganhos / fechados) * 100 : 0;
        return { area, ganhos: v.ganhos, perdas: v.perdas, total: v.total, fechados, percentual_ganho: pctGanho };
      })
      // P1.8 — filtro mínimo 30 fechados (corta áreas com n<15 que são ruído estatístico,
      // ex.: CivelMil 9, AdmMil 10, Sucessoes 11). Alvo ADVBox aparece com áreas robustas.
      .filter((g) => g.fechados >= 30)
      .sort((a, b) => b.percentual_ganho - a.percentual_ganho)
      .slice(0, 4);

    // Safras anuais (últimos 10 anos)
    const safrasAnuais: Array<any> = [];
    const anoAtual = now.getUTCFullYear();
    for (let ano = anoAtual; ano > anoAtual - 10; ano--) {
      const ini = new Date(Date.UTC(ano, 0, 1));
      const f = new Date(Date.UTC(ano, 11, 31, 23, 59, 59));
      let fech = 0, prod = 0, exec = 0, conc = 0, gan = 0, per = 0;
      for (const l of lawsuitsFiltradas) {
        if (dentroDoMes(l.created_at, ini, f)) fech++;
        const stage = getStage(l);
        if (l.created_at && new Date(l.created_at).getUTCFullYear() === ano) {
          if (stage === "producao") prod++;
          if (stage === "execucao") exec++;
          if (stage === "concluido") {
            conc++;
            const o = classifyOutcome(l);
            if (o === "ganho") gan++;
            else if (o === "perda") per++;
          }
        }
      }
      safrasAnuais.push({
        ano,
        fechamentos: fech,
        em_producao: prod,
        em_execucao: exec,
        concluidos: conc,
        ganhos: gan,
        perdas: per,
        pct_ganho: conc > 0 ? (gan / conc) * 100 : 0,
        pct_perda: conc > 0 ? (per / conc) * 100 : 0,
      });
    }

    const safra = {
      areas: areasQualidade,
      anuais: safrasAnuais,
    };

    // =================================================================
    // Lista de advogados disponíveis
    // =================================================================
    const advSet = new Set<string>();
    for (const l of lawsuits) {
      if (l.responsible) advSet.add(l.responsible);
    }
    const advogadosFiltro = Array.from(advSet).sort();

    return new Response(
      JSON.stringify({
        produtividade,
        estoque,
        tempo,
        custos,
        safra,
        advogados_disponiveis: advogadosFiltro,
        meses_disponiveis: mesesDisponiveis,
        meta: {
          total_lawsuits: cache?.total_lawsuits || 0,
          total_movements: cache?.total_movements || 0,
          updated_at: cache?.updated_at,
          mes_label: label,
          mes_atual: `${inicio.getUTCFullYear()}-${String(inicio.getUTCMonth() + 1).padStart(2, "0")}`,
          gerado_em: new Date().toISOString(),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("[bi-aggregates] error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
