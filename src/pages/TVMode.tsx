import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, LabelList } from 'recharts';
import { UserCheck, UserMinus, UserX, Trophy, DollarSign, TrendingUp, RefreshCw, ArrowLeft } from 'lucide-react';

const FUNNEL_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

const VENDEDOR_COLORS: Record<string, string> = {
  'Daniel Martins Silva': '#3b82f6',
  'Lucas Mendes de Paula': '#8b5cf6',
  'Jhonny Silva Souza': '#f59e0b',
  'Marcos Luiz Egg Nunes': '#22c55e',
};

function getCommercialPeriod(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  let startDate: Date;
  let endDate: Date;

  if (day >= 25) {
    startDate = new Date(year, month, 25);
    endDate = new Date(year, month + 1, 24, 23, 59, 59);
  } else {
    startDate = new Date(year, month - 1, 25);
    endDate = new Date(year, month, 24, 23, 59, 59);
  }

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    label: `${format(startDate, 'dd/MM', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`,
  };
}

const TVMode = () => {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const period = useMemo(() => getCommercialPeriod(now), [now.getDate(), now.getMonth(), now.getFullYear()]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(t);
  }, []);

  // Stages para classificação
  const { data: stages = [], refetch: r1 } = useQuery({
    queryKey: ['tv-stages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_deal_stages')
        .select('id, name, order_index');
      return data ?? [];
    },
  });

  // Deals no período para classificação por qualificação
  const { data: periodDeals = [], refetch: r1b } = useQuery({
    queryKey: ['tv-period-deals', period.start],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_deals')
        .select('id, stage_id')
        .gte('created_at', period.start)
        .lte('created_at', period.end);
      return data ?? [];
    },
  });

  // Classificação por qualificação
  const qualification = useMemo(() => {
    const stageMap = new Map(stages.map(s => [s.id, s.order_index]));
    let qualificados = 0, indefinidos = 0, desqualificados = 0;
    periodDeals.forEach(d => {
      const idx = stageMap.get(d.stage_id);
      if (idx === undefined) { indefinidos++; return; }
      if (idx >= 3 && idx <= 8) qualificados++;
      else if (idx <= 2) indefinidos++;
      else desqualificados++;
    });
    return { qualificados, indefinidos, desqualificados };
  }, [periodDeals, stages]);

  // Deals won no período
  const { data: wonDeals = [], refetch: r2 } = useQuery({
    queryKey: ['tv-won-deals', period.start],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_deals')
        .select('id, value, owner_id')
        .eq('won', true)
        .gte('closed_at', period.start)
        .lte('closed_at', period.end);
      return data ?? [];
    },
  });

  // Total deals criados no período (para taxa de conversão)
  const { data: totalDeals = 0, refetch: r3 } = useQuery({
    queryKey: ['tv-total-deals', period.start],
    queryFn: async () => {
      const { count } = await supabase
        .from('crm_deals')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', period.start)
        .lte('created_at', period.end);
      return count ?? 0;
    },
  });

  // Funil — apenas estágios ativos (order_index 1–7)
  const { data: funnelData = [], refetch: r4 } = useQuery({
    queryKey: ['tv-funnel'],
    queryFn: async () => {
      const { data: stages } = await supabase
        .from('crm_deal_stages')
        .select('id, name, order_index')
        .lte('order_index', 7)
        .order('order_index');
      if (!stages?.length) return [];
      const { data: deals } = await supabase.from('crm_deals').select('stage_id');
      const countMap: Record<string, number> = {};
      deals?.forEach(d => { countMap[d.stage_id] = (countMap[d.stage_id] || 0) + 1; });
      return stages.map(s => ({ name: s.name, count: countMap[s.id] || 0 }));
    },
  });

  // Profiles dos vendedores
  const { data: vendedorProfiles = [], refetch: r5 } = useQuery({
    queryKey: ['tv-vendedor-profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', [
          '1eebbf27-a9f8-4877-a10d-aec9279e1fea', // Daniel
          'f83cbef4-8ff7-4168-8e28-6a15f0d2c1f9', // Lucas
          '1703d91d-4781-4285-ad5c-ad71b108f1d0', // Jhonny
          'a1412f06-36db-45a6-81d5-d8f292860bfe', // Marcos
        ]);
      return data ?? [];
    },
  });

  // KPIs derivados
  const wonCount = wonDeals.length;
  const totalValue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const conversionRate = totalDeals > 0 ? ((wonCount / totalDeals) * 100) : 0;

  // Fechamentos por vendedor
  const salesByRep = useMemo(() => {
    const countMap: Record<string, number> = {};
    wonDeals.forEach(d => {
      if (d.owner_id) countMap[d.owner_id] = (countMap[d.owner_id] || 0) + 1;
    });
    return vendedorProfiles
      .map(p => ({
        name: p.full_name?.split(' ').slice(0, 1).join(' ') || '?',
        fullName: p.full_name || '?',
        count: countMap[p.id] || 0,
        color: VENDEDOR_COLORS[p.full_name || ''] || '#94a3b8',
      }))
      .sort((a, b) => b.count - a.count);
  }, [wonDeals, vendedorProfiles]);

  // Auto-refresh
  useEffect(() => {
    const t = setInterval(async () => {
      setRefreshing(true);
    await Promise.all([r1(), r1b(), r2(), r3(), r4(), r5()]);
      setTimeout(() => setRefreshing(false), 800);
    }, 30000);
    return () => clearInterval(t);
  }, [r1, r1b, r2, r3, r4, r5]);

  const kpis = [
    {
      label: 'Qualificados',
      value: qualification.qualificados.toLocaleString('pt-BR'),
      icon: UserCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Indefinidos',
      value: qualification.indefinidos.toLocaleString('pt-BR'),
      icon: UserMinus,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Desqualificados',
      value: qualification.desqualificados.toLocaleString('pt-BR'),
      icon: UserX,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Contratos Fechados',
      value: wonCount.toLocaleString('pt-BR'),
      icon: Trophy,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Valor Fechado',
      value: `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Taxa de Conversão',
      value: `${conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
  ];

  return (
    <div className="fixed inset-0 bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-100 hover:bg-gray-800 opacity-30 hover:opacity-100 transition-all duration-300"
            title="Voltar para a Intranet"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <img src="/logo-eggnunes.png" alt="Logo" className="h-10 object-contain" />
        </div>
        <div className="text-center">
          <div className="text-5xl font-mono font-bold tracking-widest tabular-nums">
            {format(now, 'HH:mm:ss')}
          </div>
          <div className="text-sm text-gray-400 capitalize mt-0.5">
            {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Auto-refresh 30s'}
          </div>
          <div className="text-xs text-gray-500">
            Período: {period.label}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-5 p-6 overflow-hidden">
        {/* KPI Cards */}
        <div className="grid grid-cols-6 gap-4">
          {kpis.map(kpi => (
            <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
              <div className={`p-3.5 rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`w-7 h-7 ${kpi.color}`} />
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums">{kpi.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts side by side */}
        <div className="flex-1 grid grid-cols-2 gap-5 min-h-0">
          {/* Funil de Vendas */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col min-h-0">
            <h2 className="text-base font-semibold text-gray-300 mb-3">Funil de Vendas</h2>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                  <XAxis type="number" stroke="#6b7280" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={180}
                    stroke="#9ca3af"
                    fontSize={12}
                    tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + '…' : v}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }}
                    formatter={(v: number) => [`${v} negócios`, 'Quantidade']}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={32}>
                    {funnelData.map((_, i) => (
                      <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                    ))}
                    <LabelList dataKey="count" position="right" fill="#d1d5db" fontSize={13} fontWeight={600} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fechamentos por Vendedor */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col min-h-0">
            <h2 className="text-base font-semibold text-gray-300 mb-3">Fechamentos por Vendedor</h2>
            <div className="flex-1 min-h-0">
              {salesByRep.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByRep} margin={{ left: 10, right: 10, top: 20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={13} />
                    <YAxis stroke="#6b7280" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }}
                      formatter={(v: number) => [`${v} contratos`, 'Fechamentos']}
                      labelFormatter={(label: string) => {
                        const rep = salesByRep.find(r => r.name === label);
                        return rep?.fullName || label;
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={60}>
                      {salesByRep.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                      <LabelList dataKey="count" position="top" fill="#d1d5db" fontSize={16} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  Nenhum fechamento no período
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVMode;
