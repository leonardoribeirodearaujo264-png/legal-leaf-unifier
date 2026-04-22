import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const REGISTRO_INTERNO_PATTERNS = [
  'REPASSE',
  'DISTRIBUIÇÃO DE LUCRO',
  'DISTRIBUICAO DE LUCRO',
  'DISTRIBUIÇÃO DE LUCROS',
  'DISTRIBUICAO DE LUCROS',
];

const HONORARIOS_SOCIO_PATTERN = /HONOR[AÁ]RIOS?\s+(S[OÓ]CIO|S[OÓ]CIA|S[OÓ]CIOS)/i;

function isRegistroInterno(descricao: string | null): boolean {
  if (!descricao) return false;
  const upper = descricao.toUpperCase().trim();
  if (REGISTRO_INTERNO_PATTERNS.some(p => upper.includes(p))) return true;
  if (HONORARIOS_SOCIO_PATTERN.test(descricao)) return true;
  return false;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function subMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatMonthLabel(date: Date): string {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const year = String(date.getFullYear()).slice(2);
  return `${months[date.getMonth()]}/${year}`;
}

async function calculateDashboardData(supabase: any, periodo: string) {
  const hoje = new Date();
  const mesAtualInicio = startOfMonth(hoje);
  const mesAtualFim = endOfMonth(hoje);
  const mesAnteriorInicio = startOfMonth(subMonths(hoje, 1));
  const mesAnteriorFim = endOfMonth(subMonths(hoje, 1));

  let dataInicio: Date;
  let dataFim: Date;

  switch (periodo) {
    case 'mes_atual':
      dataInicio = mesAtualInicio;
      dataFim = mesAtualFim;
      break;
    case 'mes_anterior':
      dataInicio = mesAnteriorInicio;
      dataFim = mesAnteriorFim;
      break;
    case 'trimestre':
      dataInicio = startOfMonth(subMonths(hoje, 2));
      dataFim = mesAtualFim;
      break;
    case 'ano':
      dataInicio = startOfYear(hoje);
      dataFim = endOfYear(hoje);
      break;
    default:
      dataInicio = mesAtualInicio;
      dataFim = mesAtualFim;
  }

  // Fetch contas
  const { data: contas } = await supabase
    .from('fin_contas')
    .select('*')
    .eq('ativa', true);

  // Fetch lançamentos do período
  const { data: lancamentos } = await supabase
    .from('fin_lancamentos')
    .select('*, categoria:fin_categorias(nome, cor)')
    .gte('data_vencimento', formatDate(dataInicio))
    .lte('data_vencimento', formatDate(dataFim))
    .eq('status', 'pago')
    .is('deleted_at', null);

  // Lançamentos mês atual
  const { data: lancMesAtual } = await supabase
    .from('fin_lancamentos')
    .select('tipo, valor, descricao')
    .gte('data_vencimento', formatDate(mesAtualInicio))
    .lte('data_vencimento', formatDate(mesAtualFim))
    .eq('status', 'pago')
    .is('deleted_at', null);

  // Lançamentos mês anterior
  const { data: lancMesAnterior } = await supabase
    .from('fin_lancamentos')
    .select('tipo, valor, descricao')
    .gte('data_vencimento', formatDate(mesAnteriorInicio))
    .lte('data_vencimento', formatDate(mesAnteriorFim))
    .eq('status', 'pago')
    .is('deleted_at', null);

  // Despesas a reembolsar
  const { data: reembolsos } = await supabase
    .from('fin_lancamentos')
    .select('valor')
    .eq('a_reembolsar', true)
    .eq('reembolsada', false)
    .is('deleted_at', null);

  const filterOperacional = (items: any[] | null) => {
    if (!items) return [];
    return items.filter((l: any) => !isRegistroInterno(l.descricao));
  };

  const lancamentosFiltered = filterOperacional(lancamentos);
  const lancMesAtualFiltered = filterOperacional(lancMesAtual);
  const lancMesAnteriorFiltered = filterOperacional(lancMesAnterior);

  const totalReceitas = lancamentosFiltered.filter((l: any) => l.tipo === 'receita')
    .reduce((acc: number, l: any) => acc + Number(l.valor), 0);
  const totalDespesas = lancamentosFiltered.filter((l: any) => l.tipo === 'despesa')
    .reduce((acc: number, l: any) => acc + Number(l.valor), 0);
  const lucro = totalReceitas - totalDespesas;
  const margemLucro = totalReceitas > 0 ? (lucro / totalReceitas) * 100 : 0;

  const receitasMesAtual = lancMesAtualFiltered.filter((l: any) => l.tipo === 'receita')
    .reduce((acc: number, l: any) => acc + Number(l.valor), 0);
  const despesasMesAtual = lancMesAtualFiltered.filter((l: any) => l.tipo === 'despesa')
    .reduce((acc: number, l: any) => acc + Number(l.valor), 0);
  const receitasMesAnterior = lancMesAnteriorFiltered.filter((l: any) => l.tipo === 'receita')
    .reduce((acc: number, l: any) => acc + Number(l.valor), 0);
  const despesasMesAnterior = lancMesAnteriorFiltered.filter((l: any) => l.tipo === 'despesa')
    .reduce((acc: number, l: any) => acc + Number(l.valor), 0);

  const variacaoReceitas = receitasMesAnterior > 0
    ? ((receitasMesAtual - receitasMesAnterior) / receitasMesAnterior) * 100 : 0;
  const variacaoDespesas = despesasMesAnterior > 0
    ? ((despesasMesAtual - despesasMesAnterior) / despesasMesAnterior) * 100 : 0;
  const lucroMesAtual = receitasMesAtual - despesasMesAtual;
  const lucroMesAnterior = receitasMesAnterior - despesasMesAnterior;
  const variacaoLucro = lucroMesAnterior !== 0
    ? ((lucroMesAtual - lucroMesAnterior) / Math.abs(lucroMesAnterior)) * 100 : 0;

  // Saldo por conta
  let contasSaldo = (contas || []).map((c: any) => {
    const isAsaas = c.nome?.toLowerCase().includes('asaas') || c.tipo === 'pagamentos';
    const saldoInicial = Number(c.saldo_inicial) || 0;
    const saldoConfigurado = isAsaas || saldoInicial !== 0;
    return {
      nome: c.nome,
      saldo: Number(c.saldo_atual) || 0,
      cor: c.cor || '#3B82F6',
      isAsaas,
      saldoConfigurado
    };
  });

  const despesasReembolsar = (reembolsos || []).reduce((acc: number, r: any) => acc + Number(r.valor), 0);

  // Receitas por categoria
  const receitasMap = new Map<string, { valor: number; cor: string }>();
  lancamentosFiltered.filter((l: any) => l.tipo === 'receita').forEach((l: any) => {
    const nome = l.categoria?.nome || 'Sem categoria';
    const cor = l.categoria?.cor || '#10B981';
    const atual = receitasMap.get(nome) || { valor: 0, cor };
    receitasMap.set(nome, { valor: atual.valor + Number(l.valor), cor });
  });
  const receitasPorCategoria = Array.from(receitasMap.entries())
    .map(([nome, { valor, cor }]) => ({ nome, valor, cor }))
    .sort((a, b) => b.valor - a.valor);

  // Despesas por categoria
  const despesasMap = new Map<string, { valor: number; cor: string }>();
  lancamentosFiltered.filter((l: any) => l.tipo === 'despesa').forEach((l: any) => {
    const nome = l.categoria?.nome || 'Sem categoria';
    const cor = l.categoria?.cor || '#EF4444';
    const atual = despesasMap.get(nome) || { valor: 0, cor };
    despesasMap.set(nome, { valor: atual.valor + Number(l.valor), cor });
  });
  const despesasPorCategoria = Array.from(despesasMap.entries())
    .map(([nome, { valor, cor }]) => ({ nome, valor, cor }))
    .sort((a, b) => b.valor - a.valor);

  // Evolução mensal (últimos 6 meses)
  const evolucaoMensal: { mes: string; receitas: number; despesas: number; lucro: number }[] = [];
  let somaReceitas3m = 0;
  let somaDespesas3m = 0;

  for (let i = 5; i >= 0; i--) {
    const mesData = subMonths(hoje, i);
    const mesInicio = startOfMonth(mesData);
    const mesFim = endOfMonth(mesData);

    const { data: mesLancamentos } = await supabase
      .from('fin_lancamentos')
      .select('tipo, valor, descricao')
      .gte('data_vencimento', formatDate(mesInicio))
      .lte('data_vencimento', formatDate(mesFim))
      .eq('status', 'pago')
      .is('deleted_at', null);

    const mesLancFiltered = filterOperacional(mesLancamentos);
    const mesReceitas = mesLancFiltered.filter((l: any) => l.tipo === 'receita')
      .reduce((acc: number, l: any) => acc + Number(l.valor), 0);
    const mesDespesas = mesLancFiltered.filter((l: any) => l.tipo === 'despesa')
      .reduce((acc: number, l: any) => acc + Number(l.valor), 0);

    evolucaoMensal.push({
      mes: formatMonthLabel(mesData),
      receitas: mesReceitas,
      despesas: mesDespesas,
      lucro: mesReceitas - mesDespesas
    });

    if (i <= 2) {
      somaReceitas3m += mesReceitas;
      somaDespesas3m += mesDespesas;
    }
  }

  const mediaReceitas3m = somaReceitas3m / 3;
  const mediaDespesas3m = somaDespesas3m / 3;
  const ultimoMes = evolucaoMensal[evolucaoMensal.length - 1];
  const tendenciaReceitas = ultimoMes.receitas > mediaReceitas3m * 1.05 ? 'up' :
    ultimoMes.receitas < mediaReceitas3m * 0.95 ? 'down' : 'stable';
  const tendenciaDespesas = ultimoMes.despesas > mediaDespesas3m * 1.05 ? 'up' :
    ultimoMes.despesas < mediaDespesas3m * 0.95 ? 'down' : 'stable';

  // Asaas balance
  let asaasBalance: number | null = null;
  try {
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
    if (asaasApiKey) {
      const resp = await fetch('https://api.asaas.com/v3/finance/balance', {
        headers: { 'access_token': asaasApiKey }
      });
      if (resp.ok) {
        const balanceData = await resp.json();
        asaasBalance = Number(balanceData.balance) || 0;
      }
    }
  } catch (e) {
    console.error('Erro ao buscar saldo Asaas:', e);
  }

  if (asaasBalance !== null) {
    let asaasAtualizado = false;
    contasSaldo = contasSaldo.map((conta: any) => {
      if (conta.isAsaas || conta.nome.toLowerCase().includes('asaas')) {
        asaasAtualizado = true;
        return { ...conta, saldo: asaasBalance, saldoConfigurado: true };
      }
      return conta;
    });
    if (!asaasAtualizado && asaasBalance > 0) {
      contasSaldo.push({
        nome: 'Asaas',
        saldo: asaasBalance,
        cor: '#9D5CFF',
        isAsaas: true,
        saldoConfigurado: true
      });
    }
  }

  return {
    totalReceitas,
    totalDespesas,
    lucro,
    margemLucro,
    contasSaldo,
    despesasReembolsar,
    receitasPorCategoria,
    despesasPorCategoria,
    evolucaoMensal,
    comparativo: {
      receitasMesAtual,
      receitasMesAnterior,
      despesasMesAtual,
      despesasMesAnterior,
      variacaoReceitas,
      variacaoDespesas,
      variacaoLucro
    },
    tendencias: {
      mediaReceitas3m,
      mediaDespesas3m,
      tendenciaReceitas,
      tendenciaDespesas
    },
    asaasBalance
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Guarda service-role: só pg_cron pode disparar o refresh do cache.
  const authHeader = req.headers.get('Authorization');
  const expectedToken = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  if (authHeader !== expectedToken) {
    console.error('Tentativa não autorizada em fin-dashboard-cache-refresh');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: any = {};
    try { body = await req.json(); } catch {}
    const periodo = body.periodo || 'mes_atual';

    console.log(`Calculando dashboard financeiro para período: ${periodo}`);

    // Calculate for all periods
    const periods = ['mes_atual', 'mes_anterior', 'trimestre', 'ano'];
    const allData: Record<string, any> = {};

    for (const p of periods) {
      console.log(`Calculando período: ${p}`);
      allData[p] = await calculateDashboardData(supabase, p);
    }

    // Save to cache
    const { error: upsertError } = await supabase
      .from('fin_dashboard_cache')
      .upsert({
        id: 'singleton',
        dashboard_data: allData,
        periodo,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error('Erro ao salvar cache:', upsertError);
      throw upsertError;
    }

    console.log('Cache do dashboard financeiro atualizado com sucesso');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Cache atualizado',
      updated_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erro no fin-dashboard-cache-refresh:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
