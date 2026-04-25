// Edge function read-only que consolida agregados do ADVBox para a página /business-intelligence.
// Lê advbox_dashboard_cache (JSONB) + advbox_tasks (table) e devolve KPIs + séries
// já calculados no servidor para evitar baixar 12k+ registros no cliente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Paleta de cores oficial das fases do ADVBox (espelhada na intranet)
const STAGE_COLORS = {
  prospeccao: "#8B5CF6", // roxo
  producao: "#3B82F6",   // azul
  execucao: "#10B981",   // verde
  rotacao: "#F59E0B",    // âmbar
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
}

interface Movement {
  date: string | null;
  title: string | null;
  lawsuit_id: number | null;
  customers: string | null;
}

// Determina a fase atual de um processo conforme regra ADVBox
function getStage(l: Lawsuit): "prospeccao" | "producao" | "execucao" | "rotacao" | "concluido" {
  if (l.status_closure) return "concluido";
  if (l.exit_execution) return "rotacao";
  if (l.exit_production) return "execucao";
  if (l.process_date) return "producao";
  return "prospeccao";
}

// Calcula meses entre duas datas (positivo)
function monthsBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.max(0, (db - da) / (1000 * 60 * 60 * 24 * 30.44));
}

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
    const periodo = url.searchParams.get("periodo") || "mes"; // mes | trimestre | ano | custom
    const advogado = url.searchParams.get("advogado") || "todos";
    const dataInicio = url.searchParams.get("data_inicio");
    const dataFim = url.searchParams.get("data_fim");

    // Período de filtro padrão: mês atual
    const now = new Date();
    let inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    let fim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    if (periodo === "trimestre") {
      inicio = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else if (periodo === "ano") {
      inicio = new Date(now.getFullYear(), 0, 1);
    } else if (periodo === "custom" && dataInicio && dataFim) {
      inicio = new Date(dataInicio);
      fim = new Date(dataFim);
    }

    // 1) Carrega cache do dashboard (JSONB com lawsuits e movements)
    const { data: cache, error: cacheErr } = await supabase
      .from("advbox_dashboard_cache")
      .select("lawsuits_data, movements_data, total_lawsuits, total_movements, updated_at")
      .eq("id", "singleton")
      .maybeSingle();

    if (cacheErr) throw cacheErr;

    const lawsuits: Lawsuit[] = (cache?.lawsuits_data as Lawsuit[]) || [];
    const movements: Movement[] = (cache?.movements_data as Movement[]) || [];

    // Filtro por advogado (se aplicável)
    const lawsuitsFiltradas = advogado === "todos"
      ? lawsuits
      : lawsuits.filter((l) => (l.responsible || "").trim() === advogado);

    // ============= ABA 1: PRODUTIVIDADE =============
    // Busca tarefas no período
    const { data: tasksMes } = await supabase
      .from("advbox_tasks")
      .select("id, status, points, completed_at, due_date, assigned_users")
      .gte("due_date", inicio.toISOString())
      .lte("due_date", fim.toISOString());

    const tasksConcluidas = (tasksMes || []).filter(
      (t) => t.status === "completed" || t.completed_at
    );
    const totalPontos = tasksConcluidas.reduce(
      (s, t) => s + (t.points || 0),
      0
    );
    // Ganhos/perdas: usar status_closure no período + indicador positivo (fees_money > 0 = ganho)
    const ganhos = lawsuitsFiltradas.filter((l) => {
      if (!l.status_closure) return false;
      const d = new Date(l.status_closure);
      return d >= inicio && d <= fim && Number(l.fees_money || 0) > 0;
    }).length;
    const perdas = lawsuitsFiltradas.filter((l) => {
      if (!l.status_closure) return false;
      const d = new Date(l.status_closure);
      return d >= inicio && d <= fim && Number(l.fees_money || 0) === 0;
    }).length;

    // Série semanal (últimas 7 semanas)
    const serieSemanal: Array<{ semana: string; concluidas: number; pontos: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const semFim = new Date(now);
      semFim.setDate(semFim.getDate() - i * 7);
      const semIni = new Date(semFim);
      semIni.setDate(semIni.getDate() - 6);
      const { data: weekTasks } = await supabase
        .from("advbox_tasks")
        .select("id, points")
        .gte("completed_at", semIni.toISOString())
        .lte("completed_at", semFim.toISOString());
      const concluidas = (weekTasks || []).length;
      const pontos = (weekTasks || []).reduce((s, t) => s + (t.points || 0), 0);
      serieSemanal.push({
        semana: `${semIni.getDate()}/${semIni.getMonth() + 1}`,
        concluidas,
        pontos,
      });
    }

    // Top advogados (agregados por nome)
    const advogadoMap = new Map<string, { tarefas: number; pontos: number; concluidas: number }>();
    for (const t of tasksMes || []) {
      const nome = (t.assigned_users || "").split(",")[0]?.trim();
      if (!nome) continue;
      const cur = advogadoMap.get(nome) || { tarefas: 0, pontos: 0, concluidas: 0 };
      cur.tarefas += 1;
      cur.pontos += t.points || 0;
      if (t.status === "completed" || t.completed_at) cur.concluidas += 1;
      advogadoMap.set(nome, cur);
    }
    const advogadosRanking = Array.from(advogadoMap.entries())
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, 12);

    // Tarefas mais atrasadas (top 5)
    const { data: atrasadas } = await supabase
      .from("advbox_tasks")
      .select("title, due_date, assigned_users, client_name")
      .eq("status", "pending")
      .lt("due_date", now.toISOString())
      .order("due_date", { ascending: true })
      .limit(5);

    const produtividade = {
      kpis: {
        atividades_concluidas: tasksConcluidas.length,
        pontos: totalPontos,
        ganhos,
        perdas,
      },
      serie_semanal: serieSemanal,
      advogados: advogadosRanking,
      atrasadas: (atrasadas || []).map((t) => ({
        titulo: t.title,
        cliente: t.client_name,
        responsavel: t.assigned_users,
        dias_atraso: Math.floor(
          (now.getTime() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
    };

    // ============= ABA 2: ESTOQUE E PROSPECÇÃO =============
    const fasesCount = { prospeccao: 0, producao: 0, execucao: 0, rotacao: 0, concluido: 0 };
    const areaCount = new Map<string, number>();
    for (const l of lawsuitsFiltradas) {
      const stage = getStage(l);
      fasesCount[stage]++;
      const area = l.group || "Outros";
      areaCount.set(area, (areaCount.get(area) || 0) + 1);
    }
    const areas = Array.from(areaCount.entries())
      .map(([area, qtd]) => ({ area, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 12);

    // Fechamentos do mês = lawsuits com status_closure no período
    const fechamentos = lawsuitsFiltradas.filter((l) => {
      if (!l.status_closure) return false;
      const d = new Date(l.status_closure);
      return d >= inicio && d <= fim;
    }).length;

    // Evolução mensal (últimos 12 meses) - novos cadastros
    const evolucao: Array<{ mes: string; novos: number; concluidos: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const mIni = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mFim = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      let novos = 0, concluidos = 0;
      for (const l of lawsuitsFiltradas) {
        if (l.created_at) {
          const d = new Date(l.created_at);
          if (d >= mIni && d <= mFim) novos++;
        }
        if (l.status_closure) {
          const d = new Date(l.status_closure);
          if (d >= mIni && d <= mFim) concluidos++;
        }
      }
      evolucao.push({
        mes: `${mIni.getMonth() + 1}/${String(mIni.getFullYear()).slice(2)}`,
        novos,
        concluidos,
      });
    }

    const estoque = {
      kpis: {
        em_prospeccao: fasesCount.prospeccao,
        em_producao: fasesCount.producao,
        em_execucao: fasesCount.execucao,
        em_rotacao: fasesCount.rotacao,
      },
      fechamentos,
      areas,
      evolucao,
      composicao: [
        { fase: "Prospecção", qtd: fasesCount.prospeccao, cor: STAGE_COLORS.prospeccao },
        { fase: "Produção", qtd: fasesCount.producao, cor: STAGE_COLORS.producao },
        { fase: "Execução", qtd: fasesCount.execucao, cor: STAGE_COLORS.execucao },
        { fase: "Rotação", qtd: fasesCount.rotacao, cor: STAGE_COLORS.rotacao },
      ],
    };

    // ============= ABA 3: TEMPO E HONORÁRIOS =============
    // Tempo médio em cada fase (em meses)
    let tProsp = 0, tProd = 0, tExec = 0, tRot = 0;
    let cProsp = 0, cProd = 0, cExec = 0, cRot = 0;
    let totalFees = 0, countFees = 0;
    const honorariosPorGrupo = new Map<string, { total: number; count: number; tempoTotal: number }>();

    for (const l of lawsuitsFiltradas) {
      const fee = Number(l.fees_money || 0);
      if (fee > 0) {
        totalFees += fee;
        countFees++;
      }
      // Prospecção -> Produção
      if (l.created_at && l.process_date) {
        tProsp += monthsBetween(l.created_at, l.process_date);
        cProsp++;
      }
      // Produção -> Execução
      if (l.process_date && l.exit_production) {
        tProd += monthsBetween(l.process_date, l.exit_production);
        cProd++;
      }
      // Execução -> Rotação
      if (l.exit_production && l.exit_execution) {
        tExec += monthsBetween(l.exit_production, l.exit_execution);
        cExec++;
      }
      // Rotação -> Encerramento
      if (l.exit_execution && l.status_closure) {
        tRot += monthsBetween(l.exit_execution, l.status_closure);
        cRot++;
      }
      // Tempo total p/ grupo de ação
      const grp = l.group || "Outros";
      const cur = honorariosPorGrupo.get(grp) || { total: 0, count: 0, tempoTotal: 0 };
      if (fee > 0) {
        cur.total += fee;
        cur.count++;
      }
      if (l.created_at && l.status_closure) {
        cur.tempoTotal += monthsBetween(l.created_at, l.status_closure);
      }
      honorariosPorGrupo.set(grp, cur);
    }

    const honorarioMedio = countFees > 0 ? totalFees / countFees : 0;
    const tempoMedio = (
      (cProsp ? tProsp / cProsp : 0) +
      (cProd ? tProd / cProd : 0) +
      (cExec ? tExec / cExec : 0) +
      (cRot ? tRot / cRot : 0)
    );

    const tempo = {
      stages: {
        prospeccao: cProsp ? tProsp / cProsp : 0,
        producao: cProd ? tProd / cProd : 0,
        execucao: cExec ? tExec / cExec : 0,
        rotacao: cRot ? tRot / cRot : 0,
      },
      kpis: {
        honorario_medio: honorarioMedio,
        honorario_mes: tempoMedio > 0 ? honorarioMedio / tempoMedio : 0,
        tempo_medio_meses: tempoMedio,
      },
      por_grupo: Array.from(honorariosPorGrupo.entries())
        .map(([grupo, v]) => ({
          grupo,
          media_meses: v.count > 0 ? v.tempoTotal / v.count : 0,
          media_honorario: v.count > 0 ? v.total / v.count : 0,
          mensal: v.tempoTotal > 0 ? v.total / v.tempoTotal : 0,
          count: v.count,
        }))
        .filter((g) => g.count >= 5)
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    };

    // ============= ABA 4: CUSTOS =============
    // Custos: lê fin_lancamentos do período (despesas) + categoriza
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
    // Distribui custo entre fases proporcionalmente ao volume de lawsuits
    const totalProcessos = fasesCount.prospeccao + fasesCount.producao + fasesCount.execucao + fasesCount.rotacao;
    const custoPorPonto = totalPontos > 0 ? totalCustos / totalPontos : 0;
    const custos = {
      kpis: {
        prospeccao: totalProcessos ? (totalCustos * fasesCount.prospeccao / totalProcessos) / Math.max(fasesCount.prospeccao, 1) : 0,
        producao: totalProcessos ? (totalCustos * fasesCount.producao / totalProcessos) / Math.max(fasesCount.producao, 1) : 0,
        execucao: totalProcessos ? (totalCustos * fasesCount.execucao / totalProcessos) / Math.max(fasesCount.execucao, 1) : 0,
        rotacao: totalProcessos ? (totalCustos * fasesCount.rotacao / totalProcessos) / Math.max(fasesCount.rotacao, 1) : 0,
        custo_por_ponto: custoPorPonto,
      },
      grupos: Array.from(grupoCustos.entries())
        .map(([grupo, valor]) => ({ grupo, valor }))
        .sort((a, b) => b.valor - a.valor),
      total: totalCustos,
    };

    // ============= ABA 5: SAFRA E QUALIDADE =============
    // Por área: ganho% e perdido%
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
    const areasQualidade = Array.from(safraPorArea.entries())
      .map(([area, v]) => ({
        area,
        ganhos: v.ganhos,
        perdas: v.perdas,
        total: v.total,
        percentual_ganho: v.total > 0 ? (v.ganhos / v.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Safras anuais (últimos 10 anos)
    const safrasAnuais: Array<{
      ano: number;
      fechamentos: number;
      em_producao: number;
      em_execucao: number;
      concluidos: number;
      ganhos: number;
      perdas: number;
    }> = [];
    const anoAtual = now.getFullYear();
    for (let ano = anoAtual; ano > anoAtual - 10; ano--) {
      const ini = new Date(ano, 0, 1);
      const f = new Date(ano, 11, 31, 23, 59, 59);
      let fech = 0, prod = 0, exec = 0, conc = 0, gan = 0, per = 0;
      for (const l of lawsuitsFiltradas) {
        if (l.created_at) {
          const d = new Date(l.created_at);
          if (d >= ini && d <= f) fech++;
        }
        const stage = getStage(l);
        if (l.created_at && new Date(l.created_at).getFullYear() === ano) {
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
      });
    }

    const safra = {
      areas: areasQualidade,
      anuais: safrasAnuais,
    };

    // Lista de advogados disponíveis para filtro
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
        meta: {
          total_lawsuits: cache?.total_lawsuits || 0,
          total_movements: cache?.total_movements || 0,
          updated_at: cache?.updated_at,
          periodo_inicio: inicio.toISOString(),
          periodo_fim: fim.toISOString(),
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
