import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Users, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, formatMesReferencia } from '@/lib/dateUtils';

interface DashboardData {
  totalPago: number;
  totalVantagens: number;
  totalDescontos: number;
  colaboradoresPagos: number;
  mediaPorColaborador: number;
}

interface PagamentoPorMes {
  mes: string;
  total: number;
  vantagens: number;
  descontos: number;
}

interface PagamentoPorRubrica {
  nome: string;
  valor: number;
  tipo: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c43', '#a4de6c', '#d0ed57', '#8dd1e1', '#83a6ed'];

export function RHDashboard() {
  const [loading, setLoading] = useState(true);
  const [periodoInicio, setPeriodoInicio] = useState(format(subMonths(new Date(), 6), 'yyyy-MM'));
  const [periodoFim, setPeriodoFim] = useState(format(new Date(), 'yyyy-MM'));
  const [colaboradorFiltro, setColaboradorFiltro] = useState('all');
  const [colaboradores, setColaboradores] = useState<{ id: string; full_name: string; is_active: boolean; is_suspended: boolean }[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalPago: 0,
    totalVantagens: 0,
    totalDescontos: 0,
    colaboradoresPagos: 0,
    mediaPorColaborador: 0
  });
  const [pagamentosPorMes, setPagamentosPorMes] = useState<PagamentoPorMes[]>([]);
  const [pagamentosPorRubrica, setPagamentosPorRubrica] = useState<PagamentoPorRubrica[]>([]);

  useEffect(() => {
    fetchColaboradores();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [periodoInicio, periodoFim, colaboradorFiltro]);

  const fetchColaboradores = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .eq('is_suspended', false)
        .order('full_name');

      if (error) throw error;
      setColaboradores(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar colaboradores');
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(parseLocalDate(periodoInicio + '-01'));
      const endDate = endOfMonth(parseLocalDate(periodoFim + '-01'));

      let query = supabase
        .from('rh_pagamentos')
        .select('*')
        .gte('mes_referencia', format(startDate, 'yyyy-MM-dd'))
        .lte('mes_referencia', format(endDate, 'yyyy-MM-dd'));

      if (colaboradorFiltro !== 'all') {
        query = query.eq('colaborador_id', colaboradorFiltro);
      }

      const { data: pagamentos, error } = await query;

      if (error) throw error;

      // Calcular totais
      const totalPago = pagamentos?.reduce((acc, p) => acc + p.total_liquido, 0) || 0;
      const totalVantagens = pagamentos?.reduce((acc, p) => acc + p.total_vantagens, 0) || 0;
      const totalDescontos = pagamentos?.reduce((acc, p) => acc + p.total_descontos, 0) || 0;
      const colaboradoresUnicos = new Set(pagamentos?.map(p => p.colaborador_id));
      const colaboradoresPagos = colaboradoresUnicos.size;
      const mediaPorColaborador = colaboradoresPagos > 0 ? totalPago / colaboradoresPagos : 0;

      setDashboardData({
        totalPago,
        totalVantagens,
        totalDescontos,
        colaboradoresPagos,
        mediaPorColaborador
      });

      // Agrupar por mês
      const porMes: Record<string, PagamentoPorMes> = {};
      pagamentos?.forEach(p => {
        const mes = formatMesReferencia(p.mes_referencia, 'MMM/yy');
        if (!porMes[mes]) {
          porMes[mes] = { mes, total: 0, vantagens: 0, descontos: 0 };
        }
        porMes[mes].total += p.total_liquido;
        porMes[mes].vantagens += p.total_vantagens;
        porMes[mes].descontos += p.total_descontos;
      });
      setPagamentosPorMes(Object.values(porMes));

      // Buscar rubricas para o gráfico de pizza
      const { data: itens, error: itensError } = await supabase
        .from('rh_pagamento_itens')
        .select('valor, rh_rubricas(nome, tipo)')
        .in('pagamento_id', pagamentos?.map(p => p.id) || []);

      if (!itensError && itens) {
        const porRubrica: Record<string, PagamentoPorRubrica> = {};
        itens.forEach((item: any) => {
          const nome = item.rh_rubricas?.nome || 'Outros';
          const tipo = item.rh_rubricas?.tipo || 'vantagem';
          if (!porRubrica[nome]) {
            porRubrica[nome] = { nome, valor: 0, tipo };
          }
          porRubrica[nome].valor += item.valor;
        });
        setPagamentosPorRubrica(Object.values(porRubrica).filter(r => r.valor > 0));
      }

    } catch (error: any) {
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Período Início</Label>
              <Input
                type="month"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Período Fim</Label>
              <Input
                type="month"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={colaboradorFiltro} onValueChange={setColaboradorFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os colaboradores</SelectItem>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.totalPago)}</div>
            <p className="text-xs text-muted-foreground">No período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vantagens</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(dashboardData.totalVantagens)}</div>
            <p className="text-xs text-muted-foreground">Bruto antes descontos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Descontos</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(dashboardData.totalDescontos)}</div>
            <p className="text-xs text-muted-foreground">Impostos e deduções</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores Pagos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.colaboradoresPagos}</div>
            <p className="text-xs text-muted-foreground">Média: {formatCurrency(dashboardData.mediaPorColaborador)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Evolução Mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pagamentosPorMes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total Líquido" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" dataKey="vantagens" name="Vantagens" stroke="#82ca9d" strokeWidth={2} />
                <Line type="monotone" dataKey="descontos" name="Descontos" stroke="#ff7c43" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Rubrica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Distribuição por Rubrica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pagamentosPorRubrica.filter(r => r.tipo === 'vantagem')}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ nome, percent }) => `${nome}: ${(percent * 100).toFixed(0)}%`}
                >
                  {pagamentosPorRubrica.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Barras Comparativo */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo Mensal: Vantagens vs Descontos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pagamentosPorMes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="vantagens" name="Vantagens" fill="#82ca9d" />
              <Bar dataKey="descontos" name="Descontos" fill="#ff7c43" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
