import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { ConfigurarSaldoInicialDialog } from './ConfigurarSaldoInicialDialog';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle,
  RefreshCw,
  AlertCircle,
  Calendar,
  Target,
  DollarSign,
  Percent,
  ArrowUp,
  ArrowDown,
  Minus,
  CreditCard,
  Info,
  Settings
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Legend, ComposedChart, Line 
} from 'recharts';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ContaSaldo {
  id?: string;
  nome: string;
  saldo: number;
  cor: string;
  isAsaas?: boolean;
  saldoConfigurado: boolean;
}

interface DashboardData {
  totalReceitas: number;
  totalDespesas: number;
  receitaPrevista: number;
  despesaPrevista: number;
  lucro: number;
  margemLucro: number;
  contasSaldo: ContaSaldo[];
  contasSemSaldo: ContaSaldo[];
  lancamentosExcluidos: number;
  despesasReembolsar: number;
  receitasPorCategoria: { nome: string; valor: number; cor: string }[];
  despesasPorCategoria: { nome: string; valor: number; cor: string }[];
  evolucaoMensal: { mes: string; receitas: number; despesas: number; lucro: number }[];
  comparativo: {
    receitasMesAtual: number;
    receitasMesAnterior: number;
    despesasMesAtual: number;
    despesasMesAnterior: number;
    variacaoReceitas: number;
    variacaoDespesas: number;
    variacaoLucro: number;
  };
  tendencias: {
    mediaReceitas3m: number;
    mediaDespesas3m: number;
    tendenciaReceitas: 'up' | 'down' | 'stable';
    tendenciaDespesas: 'up' | 'down' | 'stable';
  };
  asaasBalance: number | null;
}

// Patterns for internal records (not real income or expense)
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

export function FinanceiroExecutivoDashboard() {
  const [periodo, setPeriodo] = useState('mes_atual');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [showConfigSaldo, setShowConfigSaldo] = useState(false);

  const [data, setData] = useState<DashboardData>({
    totalReceitas: 0,
    totalDespesas: 0,
    receitaPrevista: 0,
    despesaPrevista: 0,
    lucro: 0,
    margemLucro: 0,
    contasSaldo: [],
    contasSemSaldo: [],
    lancamentosExcluidos: 0,
    despesasReembolsar: 0,
    receitasPorCategoria: [],
    despesasPorCategoria: [],
    evolucaoMensal: [],
    comparativo: {
      receitasMesAtual: 0,
      receitasMesAnterior: 0,
      despesasMesAtual: 0,
      despesasMesAnterior: 0,
      variacaoReceitas: 0,
      variacaoDespesas: 0,
      variacaoLucro: 0
    },
    tendencias: {
      mediaReceitas3m: 0,
      mediaDespesas3m: 0,
      tendenciaReceitas: 'stable',
      tendenciaDespesas: 'stable'
    },
    asaasBalance: null
  });

  // Force fresh recalculation: rebuild fin_contas.saldo_atual via RPC, then refetch.
  // Bypasses fin_dashboard_cache entirely (cache stale = -R$35M bug).
  const triggerRefresh = async () => {
    setRefreshing(true);
    try {
      const { error: rpcErr } = await supabase.rpc('fin_force_refresh_dashboard');
      if (rpcErr) console.warn('fin_force_refresh_dashboard:', rpcErr.message);
      await fetchDataDirectly();
    } catch (err) {
      console.error('Erro ao atualizar dados:', err);
      await fetchDataDirectly();
    } finally {
      setRefreshing(false);
    }
  };

  const fetchDataDirectly = async () => {
    setLoading(true);
    try {
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

      const { data: contas } = await supabase
        .from('fin_contas')
        .select('*')
        .eq('ativa', true);

      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select(`*, categoria:fin_categorias(nome, cor)`)
        .gte('data_vencimento', format(dataInicio, 'yyyy-MM-dd'))
        .lte('data_vencimento', format(dataFim, 'yyyy-MM-dd'))
        .in('status', ['pago', 'pendente', 'atrasado'])
        .is('deleted_at', null);

      const { data: lancMesAtual } = await supabase
        .from('fin_lancamentos')
        .select('tipo, valor, descricao, status')
        .gte('data_vencimento', format(mesAtualInicio, 'yyyy-MM-dd'))
        .lte('data_vencimento', format(mesAtualFim, 'yyyy-MM-dd'))
        .in('status', ['pago', 'pendente', 'atrasado'])
        .is('deleted_at', null);

      const { data: lancMesAnterior } = await supabase
        .from('fin_lancamentos')
        .select('tipo, valor, descricao, status')
        .gte('data_vencimento', format(mesAnteriorInicio, 'yyyy-MM-dd'))
        .lte('data_vencimento', format(mesAnteriorFim, 'yyyy-MM-dd'))
        .in('status', ['pago', 'pendente', 'atrasado'])
        .is('deleted_at', null);

      const { data: reembolsos } = await supabase
        .from('fin_lancamentos')
        .select('valor')
        .eq('a_reembolsar', true)
        .eq('reembolsada', false)
        .is('deleted_at', null);

      const filterOperacional = (items: any[] | null) => {
        if (!items) return [];
        return items.filter(l => !isRegistroInterno(l.descricao));
      };

      const lancamentosFiltered = filterOperacional(lancamentos);
      const lancMesAtualFiltered = filterOperacional(lancMesAtual);
      const lancMesAnteriorFiltered = filterOperacional(lancMesAnterior);
      const lancamentosExcluidos = (lancamentos?.length || 0) - lancamentosFiltered.length;

      const isPago = (l: any) => l.status === 'pago';
      const isPrevisto = (l: any) => l.status === 'pendente' || l.status === 'atrasado';

      const totalReceitas = lancamentosFiltered.filter(l => l.tipo === 'receita' && isPago(l))
        .reduce((acc, l) => acc + Number(l.valor), 0);
      const totalDespesas = lancamentosFiltered.filter(l => l.tipo === 'despesa' && isPago(l))
        .reduce((acc, l) => acc + Number(l.valor), 0);
      const receitaPrevista = lancamentosFiltered.filter(l => l.tipo === 'receita' && isPrevisto(l))
        .reduce((acc, l) => acc + Number(l.valor), 0);
      const despesaPrevista = lancamentosFiltered.filter(l => l.tipo === 'despesa' && isPrevisto(l))
        .reduce((acc, l) => acc + Number(l.valor), 0);
      const lucro = totalReceitas - totalDespesas;
      const margemLucro = totalReceitas > 0 ? (lucro / totalReceitas) * 100 : 0;

      const receitasMesAtual = lancMesAtualFiltered.filter(l => l.tipo === 'receita' && isPago(l))
        .reduce((acc, l) => acc + Number(l.valor), 0);
      const despesasMesAtual = lancMesAtualFiltered.filter(l => l.tipo === 'despesa' && isPago(l))
        .reduce((acc, l) => acc + Number(l.valor), 0);
      const receitasMesAnterior = lancMesAnteriorFiltered.filter(l => l.tipo === 'receita' && isPago(l))
        .reduce((acc, l) => acc + Number(l.valor), 0);
      const despesasMesAnterior = lancMesAnteriorFiltered.filter(l => l.tipo === 'despesa' && isPago(l))
        .reduce((acc, l) => acc + Number(l.valor), 0);

      const variacaoReceitas = receitasMesAnterior > 0
        ? ((receitasMesAtual - receitasMesAnterior) / receitasMesAnterior) * 100 : 0;
      const variacaoDespesas = despesasMesAnterior > 0
        ? ((despesasMesAtual - despesasMesAnterior) / despesasMesAnterior) * 100 : 0;
      const lucroMesAtual = receitasMesAtual - despesasMesAtual;
      const lucroMesAnterior = receitasMesAnterior - despesasMesAnterior;
      const variacaoLucro = lucroMesAnterior !== 0
        ? ((lucroMesAtual - lucroMesAnterior) / Math.abs(lucroMesAnterior)) * 100 : 0;

      let contasSaldo: ContaSaldo[] = contas?.map(c => {
        const isAsaas = c.nome?.toLowerCase().includes('asaas') || c.tipo === 'pagamentos';
        const saldoInicial = Number(c.saldo_inicial) || 0;
        const saldoConfigurado = isAsaas || saldoInicial !== 0;
        return {
          id: c.id,
          nome: c.nome,
          saldo: Number(c.saldo_atual) || 0,
          cor: c.cor || '#3B82F6',
          isAsaas,
          saldoConfigurado
        };
      }) || [];

      const despesasReembolsar = reembolsos?.reduce((acc, r) => acc + Number(r.valor), 0) || 0;

      const receitasMap = new Map<string, { valor: number; cor: string }>();
      lancamentosFiltered.filter(l => l.tipo === 'receita').forEach(l => {
        const nome = l.categoria?.nome || 'Sem categoria';
        const cor = l.categoria?.cor || '#10B981';
        const atual = receitasMap.get(nome) || { valor: 0, cor };
        receitasMap.set(nome, { valor: atual.valor + Number(l.valor), cor });
      });
      const receitasPorCategoria = Array.from(receitasMap.entries())
        .map(([nome, { valor, cor }]) => ({ nome, valor, cor }))
        .sort((a, b) => b.valor - a.valor);

      const despesasMap = new Map<string, { valor: number; cor: string }>();
      lancamentosFiltered.filter(l => l.tipo === 'despesa').forEach(l => {
        const nome = l.categoria?.nome || 'Sem categoria';
        const cor = l.categoria?.cor || '#EF4444';
        const atual = despesasMap.get(nome) || { valor: 0, cor };
        despesasMap.set(nome, { valor: atual.valor + Number(l.valor), cor });
      });
      const despesasPorCategoria = Array.from(despesasMap.entries())
        .map(([nome, { valor, cor }]) => ({ nome, valor, cor }))
        .sort((a, b) => b.valor - a.valor);

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
          .gte('data_vencimento', format(mesInicio, 'yyyy-MM-dd'))
          .lte('data_vencimento', format(mesFim, 'yyyy-MM-dd'))
          .eq('status', 'pago')
          .is('deleted_at', null);

        const mesLancFiltered = filterOperacional(mesLancamentos);
        const mesReceitas = mesLancFiltered.filter(l => l.tipo === 'receita')
          .reduce((acc, l) => acc + Number(l.valor), 0);
        const mesDespesas = mesLancFiltered.filter(l => l.tipo === 'despesa')
          .reduce((acc, l) => acc + Number(l.valor), 0);

        evolucaoMensal.push({
          mes: format(mesData, 'MMM/yy', { locale: ptBR }),
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
      const tendenciaReceitas: 'up' | 'down' | 'stable' =
        ultimoMes.receitas > mediaReceitas3m * 1.05 ? 'up' :
        ultimoMes.receitas < mediaReceitas3m * 0.95 ? 'down' : 'stable';
      const tendenciaDespesas: 'up' | 'down' | 'stable' =
        ultimoMes.despesas > mediaDespesas3m * 1.05 ? 'up' :
        ultimoMes.despesas < mediaDespesas3m * 0.95 ? 'down' : 'stable';

      let asaasBalance: number | null = null;
      try {
        const { data: asaasData, error: asaasError } = await supabase.functions.invoke('asaas-integration', {
          body: { action: 'get_balance' }
        });
        if (!asaasError && asaasData?.balance !== undefined) {
          asaasBalance = Number(asaasData.balance) || 0;
        }
      } catch (asaasErr) {
        console.error('Erro ao obter saldo do Asaas:', asaasErr);
      }

      if (asaasBalance !== null) {
        let asaasAtualizado = false;
        contasSaldo = contasSaldo.map(conta => {
          if (conta.isAsaas || conta.nome.toLowerCase().includes('asaas')) {
            asaasAtualizado = true;
            return { ...conta, saldo: asaasBalance!, saldoConfigurado: true };
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

      const contasSemSaldo = contasSaldo.filter(c => !c.saldoConfigurado);

      setData({
        totalReceitas,
        totalDespesas,
        receitaPrevista,
        despesaPrevista,
        lucro,
        margemLucro,
        contasSaldo,
        contasSemSaldo,
        lancamentosExcluidos,
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
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load directly from fin_lancamentos + fin_contas. Cache fin_dashboard_cache
  // is bypassed (fonte stale = -R$35M bug).
  useEffect(() => {
    fetchDataDirectly();
    setLastUpdated(new Date().toISOString());
  }, [periodo]);

  // Realtime: refetch when fin_contas changes (saldo recalc)
  useEffect(() => {
    const channel = supabase
      .channel('fin-contas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fin_contas' },
        () => {
          fetchDataDirectly();
          setLastUpdated(new Date().toISOString());
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [periodo]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  const getVariacaoIcon = (value: number, invertido = false) => {
    if (Math.abs(value) < 1) return <Minus className="h-4 w-4 text-gray-500" />;
    if (invertido) {
      return value > 0 
        ? <ArrowUp className="h-4 w-4 text-red-500" />
        : <ArrowDown className="h-4 w-4 text-green-500" />;
    }
    return value > 0 
      ? <ArrowUp className="h-4 w-4 text-green-500" />
      : <ArrowDown className="h-4 w-4 text-red-500" />;
  };

  const getTendenciaIcon = (tendencia: 'up' | 'down' | 'stable', invertido = false) => {
    if (tendencia === 'stable') return <Minus className="h-5 w-5 text-gray-500" />;
    if (invertido) {
      return tendencia === 'up' 
        ? <TrendingUp className="h-5 w-5 text-red-500" />
        : <TrendingDown className="h-5 w-5 text-green-500" />;
    }
    return tendencia === 'up' 
      ? <TrendingUp className="h-5 w-5 text-green-500" />
      : <TrendingDown className="h-5 w-5 text-red-500" />;
  };

  // BUG #1: Saldo total soma TODAS as contas ativas (não filtra por saldoConfigurado)
  const saldoTotalConfigurado = data.contasSaldo
    .reduce((acc, c) => acc + c.saldo, 0);
  const contasConfiguradas = data.contasSaldo.filter(c => c.saldoConfigurado).length;
  const totalContas = data.contasSaldo.length;
  const contasSemSaldoCount = (data.contasSemSaldo?.length) ?? data.contasSaldo.filter(c => !c.saldoConfigurado).length;

  return (
    <div className="space-y-6">
      <ConfigurarSaldoInicialDialog
        open={showConfigSaldo}
        onOpenChange={setShowConfigSaldo}
        onSaved={() => triggerRefresh()}
      />

      {/* BUG #1: Alerta de contas sem saldo inicial */}
      {contasSemSaldoCount > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Saldo total pode estar incompleto</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
            <span>
              {contasSemSaldoCount} conta(s) sem saldo inicial configurado. O Saldo Total em Caixa não inclui essas contas corretamente.
            </span>
            <Button size="sm" variant="outline" onClick={() => setShowConfigSaldo(true)}>
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Configurar agora
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[200px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes_atual">Mês Atual</SelectItem>
              <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
              <SelectItem value="trimestre">Último Trimestre</SelectItem>
              <SelectItem value="ano">Ano Atual</SelectItem>
            </SelectContent>
          </Select>

        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Atualizado: {format(new Date(lastUpdated), 'dd/MM HH:mm')}
            </span>
          )}
          <Button variant="outline" onClick={triggerRefresh} disabled={loading || refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Cards principais com variação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              Receitas
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Receita líquida realizada (status pago). Exclui repasses internos
                      (REPASSE, DISTRIBUIÇÃO DE LUCRO) e honorários sócio.
                      {data.lancamentosExcluidos > 0 && (
                        <> {data.lancamentosExcluidos} lançamento(s) excluído(s) do cálculo neste período.</>
                      )}
                    </p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data.totalReceitas)}
            </div>
            {data.receitaPrevista > 0 && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Previsto: <span className="font-medium">{formatCurrency(data.receitaPrevista)}</span>
              </div>
            )}
            <div className="flex items-center gap-1 mt-1">
              {getVariacaoIcon(data.comparativo.variacaoReceitas)}
              <span className={`text-sm ${data.comparativo.variacaoReceitas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(data.comparativo.variacaoReceitas)}
              </span>
              <span className="text-xs text-muted-foreground">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              Despesas
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Despesa realizada (status pago). Exclui repasses internos
                      (REPASSE, DISTRIBUIÇÃO DE LUCRO) e honorários sócio.
                    </p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(data.totalDespesas)}
            </div>
            {data.despesaPrevista > 0 && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Previsto: <span className="font-medium">{formatCurrency(data.despesaPrevista)}</span>
              </div>
            )}
            <div className="flex items-center gap-1 mt-1">
              {getVariacaoIcon(data.comparativo.variacaoDespesas, true)}
              <span className={`text-sm ${data.comparativo.variacaoDespesas <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(data.comparativo.variacaoDespesas)}
              </span>
              <span className="text-xs text-muted-foreground">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lucro</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.lucro)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {getVariacaoIcon(data.comparativo.variacaoLucro)}
              <span className={`text-sm ${data.comparativo.variacaoLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(data.comparativo.variacaoLucro)}
              </span>
              <span className="text-xs text-muted-foreground">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Margem de Lucro</CardTitle>
            <Percent className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.margemLucro >= 20 ? 'text-green-600' : data.margemLucro >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              {data.margemLucro.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.margemLucro >= 20 ? 'Excelente' : data.margemLucro >= 10 ? 'Bom' : 'Atenção necessária'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tendências e Saldo Total */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tendência de Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {getTendenciaIcon(data.tendencias.tendenciaReceitas)}
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.tendencias.mediaReceitas3m)}</p>
                <p className="text-xs text-muted-foreground">Média últimos 3 meses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tendência de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {getTendenciaIcon(data.tendencias.tendenciaDespesas, true)}
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.tendencias.mediaDespesas3m)}</p>
                <p className="text-xs text-muted-foreground">Média últimos 3 meses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total em Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">
                  {contasConfiguradas > 0 ? formatCurrency(saldoTotalConfigurado) : 'Não configurado'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {contasConfiguradas > 0 
                    ? `${contasConfiguradas} conta(s) configurada(s)` 
                    : 'Configure o saldo inicial das contas'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              Saldo Asaas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-lg font-bold text-blue-600">
                  {data.asaasBalance !== null ? formatCurrency(data.asaasBalance) : 'Indisponível'}
                </p>
                <p className="text-xs text-muted-foreground">Conta Asaas integrada</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* A Reembolsar */}
      {data.despesasReembolsar > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Despesas a Reembolsar</p>
                  <p className="text-sm text-muted-foreground">Gastos com clientes ainda não reembolsados</p>
                </div>
              </div>
              <Badge className="bg-orange-500 text-lg px-4 py-2">
                {formatCurrency(data.despesasReembolsar)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evolução Mensal com Lucro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evolução Financeira</CardTitle>
          <CardDescription>
            Receitas, Despesas e Lucro nos últimos 6 meses (registros internos como repasses e distribuições são excluídos automaticamente)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis yAxisId="left" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'lucro' ? 'Lucro' : name === 'receitas' ? 'Receitas' : 'Despesas']}
                  labelFormatter={(label) => `Período: ${label}`}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="receitas" fill="#10B981" name="Receitas" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="despesas" fill="#EF4444" name="Despesas" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="lucro" stroke="#3B82F6" strokeWidth={3} name="Lucro" dot={{ fill: '#3B82F6' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Saldo por Conta e Top Categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saldo por Conta</CardTitle>
            <CardDescription>
              Contas sem saldo inicial configurado exibem "Não configurado"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.contasSaldo.map((conta) => (
                <div 
                  key={conta.nome}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderLeftColor: conta.cor, borderLeftWidth: '4px' }}
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" style={{ color: conta.cor }} />
                    <span className="font-medium">{conta.nome}</span>
                  </div>
                  {conta.saldoConfigurado ? (
                    <span className="text-lg font-bold">
                      {formatCurrency(conta.saldo)}
                    </span>
                  ) : (
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                            <Info className="h-3.5 w-3.5" />
                            Não configurado
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Configure o saldo inicial desta conta ou faça a conciliação bancária para exibir o saldo real.</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.despesasPorCategoria.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="nome" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {data.despesasPorCategoria.slice(0, 5).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Receitas e Despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.receitasPorCategoria.slice(0, 5).map((cat, index) => (
                <div key={cat.nome} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" style={{ backgroundColor: cat.cor + '20', borderColor: cat.cor }}>
                      {index + 1}
                    </Badge>
                    <span className="text-sm">{cat.nome}</span>
                  </div>
                  <span className="font-medium text-green-600">{formatCurrency(cat.valor)}</span>
                </div>
              ))}
              {data.receitasPorCategoria.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma receita no período</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.despesasPorCategoria.slice(0, 5).map((cat, index) => (
                <div key={cat.nome} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" style={{ backgroundColor: cat.cor + '20', borderColor: cat.cor }}>
                      {index + 1}
                    </Badge>
                    <span className="text-sm">{cat.nome}</span>
                  </div>
                  <span className="font-medium text-red-600">{formatCurrency(cat.valor)}</span>
                </div>
              ))}
              {data.despesasPorCategoria.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma despesa no período</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
