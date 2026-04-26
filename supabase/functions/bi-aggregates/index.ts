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
}

// ---------- helpers ----------

// Stage atual do processo conforme regra ADVBox
function getStage(l: Lawsuit): "prospeccao" | "producao" | "execucao" | "rotacao" | "concluido" {
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
    // CORREÇÃO P1.6:
    //  - "Em atendimento" = ativos SEM process_date (prospecção pura)
    //  - "Em produção"    = ativos COM process_date e SEM exit_production
    //  - "Em execução"    = ativos COM exit_production e SEM exit_execution
    //  - "Arquivado"      = status_closure preenchido (fechado/concluído)
    //  - %carteira tem como denominador SOMA das 3 fases ativas (= 100%)
    //  - +120d = ativos cujo último marco temporal é > 120 dias atrás

    const mesAntInicio = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() - 1, 1));
    const mesAntFim = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 0, 23, 59, 59));

    let oportunidadesMes = 0;
    let oportunidadesMesAnt = 0;
    let fechamentosMes = 0;
    let fechamentosMesAnt = 0;

    // Contagens de carteira (espelham ADVBox /managementV2)
    let qtdAtendimento = 0; // prospecção pura
    let qtdProducao = 0;
    let qtdExecucao = 0;
    let qtdArquivados = 0;
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
        qtdArquivados++;
        continue; // arquivado não entra em ativos
      }

      // ATIVO — classifica em uma das 3 fases (sem sobreposição)
      if (l.exit_production && !l.exit_execution) {
        qtdExecucao++;
      } else if (l.process_date) {
        qtdProducao++;
      } else {
        qtdAtendimento++;
      }

      // +120 dias parados (último marco temporal)
      const ultimaMov = l.exit_execution || l.exit_production || l.process_date || l.created_at;
      if (ultimaMov && new Date(ultimaMov) < limite120) {
        qtdParados120++;
      }
    }

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
    // CRÍTICO: usar AVG (não SUM) e meses (não dias)
    // =================================================================
    let tProsp = 0, tProd = 0, tExec = 0, tRot = 0;
    let cProsp = 0, cProd = 0, cExec = 0, cRot = 0;
    let totalFees = 0, countFees = 0;
    let somaTempoTotal = 0, countTempoTotal = 0;
    const honorariosPorGrupo = new Map<string, { total: number; count: number; tempoTotal: number; tempoCount: number }>();

    // Anti-outliers: descartar gaps absurdos (>120 meses = 10 anos) que distorcem médias.
    // Lawsuits com process_date legado/zerado geram valores absurdos (ex: 81 meses em produção).
    const MAX_M = 120;
    const safeMonths = (a: string | null, b: string | null): number | null => {
      const v = monthsBetween(a, b);
      if (v <= 0 || v > MAX_M) return null;
      return v;
    };

    // CORREÇÃO P1.6: usar AVG e arredondar para meses inteiros (ADVBox).
    // Considerar apenas lawsuits CONCLUÍDOS (status_closure preenchido) para ter coortes comparáveis.
    // "Tempo perdido" = soma das esperas mortas entre fases (gaps).
    let tempoPerdido = 0;
    for (const l of lawsuitsFiltradas) {
      const fee = Number(l.fees_money || 0);
      if (fee > 0) {
        totalFees += fee;
        countFees++;
      }

      const v1 = safeMonths(l.created_at, l.process_date);
      if (v1 !== null) { tProsp += v1; cProsp++; }
      const v2 = safeMonths(l.process_date, l.exit_production);
      if (v2 !== null) { tProd += v2; cProd++; }
      const v3 = safeMonths(l.exit_production, l.exit_execution);
      if (v3 !== null) { tExec += v3; cExec++; }
      const v4 = safeMonths(l.exit_execution, l.status_closure);
      if (v4 !== null) { tRot += v4; cRot++; }

      const vTot = safeMonths(l.created_at, l.status_closure);
      if (vTot !== null) {
        somaTempoTotal += vTot;
        countTempoTotal++;
        // Tempo perdido = total - soma das fases efetivas
        const efetivo = (v1 || 0) + (v2 || 0) + (v3 || 0) + (v4 || 0);
        if (vTot > efetivo) tempoPerdido += (vTot - efetivo);
      }

      const grp = l.group || "Outros";
      const cur = honorariosPorGrupo.get(grp) || { total: 0, count: 0, tempoTotal: 0, tempoCount: 0 };
      if (fee > 0) { cur.total += fee; cur.count++; }
      if (vTot !== null) { cur.tempoTotal += vTot; cur.tempoCount++; }
      honorariosPorGrupo.set(grp, cur);
    }

    const honorarioMedio = countFees > 0 ? totalFees / countFees : 0;
    const tempoMedio = countTempoTotal > 0 ? somaTempoTotal / countTempoTotal : 0;
    // Honorário mensal = honorário médio / tempo médio (em meses)
    const honorarioMes = tempoMedio > 0 ? honorarioMedio / tempoMedio : 0;

    // Médias REAIS por estágio — em meses inteiros (espelha ADVBox)
    const stages = {
      prospeccao: cProsp > 0 ? Math.round(tProsp / cProsp) : 0,
      producao: cProd > 0 ? Math.round(tProd / cProd) : 0,
      execucao: cExec > 0 ? Math.round(tExec / cExec) : 0,
      rotacao: cRot > 0 ? Math.round(tRot / cRot) : 0,
    };
    // Rotação completa = soma das fases (espelha ADVBox)
    const rotacaoCompleta = stages.prospeccao + stages.producao + stages.execucao;

    const tempo = {
      stages,
      kpis: {
        honorario_medio: honorarioMedio,
        honorario_mes: honorarioMes,
        tempo_medio_meses: tempoMedio,
        tempo_perdido_meses: Math.round(tempoPerdido),
        rotacao_completa: rotacaoCompleta,
      },
      por_grupo: Array.from(honorariosPorGrupo.entries())
        .map(([grupo, v]) => ({
          grupo,
          media_meses: v.tempoCount > 0 ? v.tempoTotal / v.tempoCount : 0,
          media_honorario: v.count > 0 ? v.total / v.count : 0,
          mensal: v.tempoCount > 0 && v.count > 0 ? (v.total / v.count) / (v.tempoTotal / v.tempoCount) : 0,
          count: v.count,
        }))
        .filter((g) => g.count >= 5)
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    };

    // =================================================================
    // ABA 4 — CUSTOS (custo total do mês × proporção tempo médio × volume)
    // =================================================================
    const { data: despesas } = await supabase
      .from("fin_lancamentos")
      .select("valor, categoria_id, fin_categorias!fin_lancamentos_categoria_id_fkey(nome, grupo)")
      .eq("tipo", "despesa")
      .eq("status", "pago")
      .gte("data_pagamento", inicio.toISOString().slice(0, 10))
      .lte("data_pagamento", fim.toISOString().slice(0, 10))
      .is("deleted_at", null);

    const grupoCustos = new Map<string, number>();
    let totalCustos = 0;
    for (const d of despesas || []) {
      const valor = Number(d.valor || 0);
      // @ts-ignore
      const grupo = d.fin_categorias?.grupo || "Outros";
      grupoCustos.set(grupo, (grupoCustos.get(grupo) || 0) + valor);
      totalCustos += valor;
    }

    // Distribuição: custo por estágio = total × peso(estágio)
    // Peso = (tempo_medio_estágio × volume_estágio) / Σ pesos
    const pesos = {
      prospeccao: stages.prospeccao * fasesCount.prospeccao,
      producao: stages.producao * fasesCount.producao,
      execucao: stages.execucao * fasesCount.execucao,
      rotacao: stages.rotacao * fasesCount.rotacao,
    };
    const somaPesos = pesos.prospeccao + pesos.producao + pesos.execucao + pesos.rotacao;

    // Custo total por estágio / volume = custo médio por processo no estágio
    function custoEstagio(peso: number, volume: number): number {
      if (somaPesos === 0 || volume === 0) return 0;
      const totalEstagio = totalCustos * (peso / somaPesos);
      return totalEstagio / volume;
    }

    // Total de pontos do mês para custo/ponto
    let pontosMes = 0;
    for (const t of tasksMes || []) {
      if (t.status === "completed" || t.completed_at) pontosMes += t.points || 0;
    }
    const custoPorPonto = pontosMes > 0 ? totalCustos / pontosMes : 0;

    const custos = {
      kpis: {
        prospeccao: custoEstagio(pesos.prospeccao, fasesCount.prospeccao),
        producao: custoEstagio(pesos.producao, fasesCount.producao),
        execucao: custoEstagio(pesos.execucao, fasesCount.execucao),
        rotacao: custoEstagio(pesos.rotacao, fasesCount.rotacao),
        custo_por_ponto: custoPorPonto,
      },
      grupos: Array.from(grupoCustos.entries())
        .map(([grupo, valor]) => ({
          grupo,
          valor,
          percentual: totalCustos > 0 ? (valor / totalCustos) * 100 : 0,
        }))
        .sort((a, b) => b.valor - a.valor),
      total: totalCustos,
    };

    // =================================================================
    // ABA 5 — SAFRA & QUALIDADE
    // CRÍTICO: top 4 áreas por % de GANHO (não volume absoluto)
    // =================================================================
    const safraPorArea = new Map<string, { ganhos: number; perdas: number; total: number }>();
    for (const l of lawsuitsFiltradas) {
      const grp = l.group || "Outros";
      const cur = safraPorArea.get(grp) || { ganhos: 0, perdas: 0, total: 0 };
      cur.total++;
      if (l.status_closure) {
        if (Number(l.fees_money || 0) > 0) cur.ganhos++;
        else cur.perdas++;
      }
      safraPorArea.set(grp, cur);
    }

    // Top 4 ordenado por % de ganho (= ganhos / (ganhos+perdas)), exigindo no mínimo 5 fechamentos
    const areasQualidade = Array.from(safraPorArea.entries())
      .map(([area, v]) => {
        const fechados = v.ganhos + v.perdas;
        const pctGanho = fechados > 0 ? (v.ganhos / fechados) * 100 : 0;
        return { area, ganhos: v.ganhos, perdas: v.perdas, total: v.total, fechados, percentual_ganho: pctGanho };
      })
      .filter((g) => g.fechados >= 5) // só áreas com volume mínimo
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
            if (Number(l.fees_money || 0) > 0) gan++;
            else per++;
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
