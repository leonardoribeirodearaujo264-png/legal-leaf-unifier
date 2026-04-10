import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, Target, Activity, TrendingUp, Calendar, Settings, LayoutDashboard, BarChart3, Bell, Star, Clock, CheckCircle2, Zap, ClipboardList, Trophy, FileSignature, Wallet, AlertTriangle, Megaphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CRMContactsList } from './CRMContactsList';
import { CRMDealsKanban } from './CRMDealsKanban';
import { CRMActivities } from './CRMActivities';
import { CRMSettings } from './CRMSettings';
import { CRMAnalytics } from './CRMAnalytics';
import { CRMNotifications } from './CRMNotifications';
import { CRMLeadScoring } from './CRMLeadScoring';
import { CRMFollowUp } from './CRMFollowUp';

import { CRMTasks } from './CRMTasks';
import { MarketingAutomation } from './MarketingAutomation';
import { CRMDailyLog } from './CRMDailyLog';
import { CRMPendingTasks } from './CRMPendingTasks';
import { CRMDemandasLog } from './CRMDemandasLog';

import { CRMRanking } from './CRMRanking';
import { CRMZapSignContracts } from './CRMZapSignContracts';
import { CRMCommissions } from './CRMCommissions';
import { useUserRole } from '@/hooks/useUserRole';

interface CRMStats {
  totalContacts: number;
  totalDeals: number;
  totalValue: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  monthlyWonDeals: number;
  dealsByOwner: { name: string; count: number }[];
  periodLabel: string;
}

type PeriodFilter = 'all' | '7d' | '30d' | '90d' | '365d';

// IDs fixos dos responsáveis comerciais
const RESPONSAVEIS_IDS: { id: string; name: string }[] = [
  { id: '1eebbf27-a9f8-4877-a10d-aec9279e1fea', name: 'Daniel' },
  { id: 'f83cbef4-8ff7-4168-8e28-6a15f0d2c1f9', name: 'Lucas' },
];

export const CRMDashboard = () => {
  const { isAdmin } = useUserRole();
  const [stats, setStats] = useState<CRMStats>({
    totalContacts: 0,
    totalDeals: 0,
    totalValue: 0,
    openDeals: 0,
    wonDeals: 0,
    lostDeals: 0,
    monthlyWonDeals: 0,
    dealsByOwner: [],
    periodLabel: ''
  });
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  useEffect(() => {
    fetchStats();
  }, [periodFilter]);




  const getDateFilter = () => {
    if (periodFilter === 'all') return null;
    
    const days = parseInt(periodFilter.replace('d', ''));
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const fetchStats = async () => {
    try {
      const dateFilter = getDateFilter();
      
      // Fetch ALL contacts with pagination
      let totalContacts = 0;
      if (dateFilter) {
        const { count } = await supabase
          .from('crm_contacts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateFilter);
        totalContacts = count || 0;
      } else {
        const { count } = await supabase
          .from('crm_contacts')
          .select('*', { count: 'exact', head: true });
        totalContacts = count || 0;
      }

      // Fetch ALL deals with pagination to avoid 1000 limit
      let allDeals: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        let query = supabase
          .from('crm_deals')
          .select('value, won, closed_at, created_at, owner_id')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter);
        }
        
        const { data: dealsBatch, error } = await query;
        
        if (error) {
          console.error('Error fetching deals:', error);
          break;
        }
        
        if (!dealsBatch || dealsBatch.length === 0) break;
        
        allDeals = [...allDeals, ...dealsBatch];
        
        if (dealsBatch.length < pageSize) break;
        page++;
        
        // Safety limit
        if (page > 50) break;
      }

      const totalDeals = allDeals.length;
      const totalValue = allDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
      const openDeals = allDeals.filter(d => d.closed_at === null).length;
      const wonDeals = allDeals.filter(d => d.won === true).length;
      const lostDeals = allDeals.filter(d => d.won === false && d.closed_at !== null).length;

      // Calcular período personalizado: dia 25 de um mês até dia 24 do mês seguinte
      const now = new Date();
      const currentDay = now.getDate();
      
      let periodStart: Date;
      let periodEnd: Date;
      
      if (currentDay >= 25) {
        // Se estamos no dia 25 ou depois, o período é do dia 25 deste mês até 24 do próximo
        periodStart = new Date(now.getFullYear(), now.getMonth(), 25);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 24, 23, 59, 59);
      } else {
        // Se estamos antes do dia 25, o período é do dia 25 do mês anterior até 24 deste mês
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 25);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), 24, 23, 59, 59);
      }

      const monthlyWonByOwner = allDeals.filter(d => {
        if (d.won !== true || !d.closed_at) return false;
        const closedDate = new Date(d.closed_at);
        return closedDate >= periodStart && closedDate <= periodEnd;
      });

      const monthlyWonDeals = monthlyWonByOwner.length;
      
      // Guardar período para exibição
      const periodLabel = `${periodStart.getDate()}/${String(periodStart.getMonth() + 1).padStart(2, '0')} a ${periodEnd.getDate()}/${String(periodEnd.getMonth() + 1).padStart(2, '0')}/${periodEnd.getFullYear()}`;

      // Calcular contratos fechados por responsável no mês usando owner_id direto
      const dealsByOwner = RESPONSAVEIS_IDS.map(({ id, name }) => {
        const count = monthlyWonByOwner.filter(d => d.owner_id === id).length;
        return { name, count };
      });

      setStats({
        totalContacts,
        totalDeals,
        totalValue,
        openDeals,
        wonDeals,
        lostDeals,
        monthlyWonDeals,
        dealsByOwner,
        periodLabel
      });
    } catch (error) {
      console.error('Error fetching CRM stats:', error);
    } finally {
      setLoading(false);
    }
  };




  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com status de sincronização */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">CRM</h2>
          <p className="text-muted-foreground">
            Gestão de leads e oportunidades
          </p>
        </div>
      </div>

      {/* Tabs - Dashboard separado do Pipeline */}
      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 lg:inline-flex">
          <TabsTrigger value="dashboard" className="flex items-center gap-1">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="kanban">Pipeline</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="activities">Atividades</TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Tarefas
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Pendências
          </TabsTrigger>
          <TabsTrigger value="demandas" className="flex items-center gap-1">
            <Megaphone className="h-3.5 w-3.5" />
            Demandas
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            Análises
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1">
            <Bell className="h-3.5 w-3.5" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="followup" className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Follow-up
          </TabsTrigger>
          <TabsTrigger value="scoring" className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5" />
            Scoring
          </TabsTrigger>
          <TabsTrigger value="dailylog" className="flex items-center gap-1">
            <ClipboardList className="h-3.5 w-3.5" />
            Diário
          </TabsTrigger>
          <TabsTrigger value="ranking" className="flex items-center gap-1">
            <Trophy className="h-3.5 w-3.5" />
            Ranking
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5" />
            Automação
          </TabsTrigger>
          <TabsTrigger value="zapsign" className="flex items-center gap-1">
            <FileSignature className="h-3.5 w-3.5" />
            ZapSign
          </TabsTrigger>
          <TabsTrigger value="commissions" className="flex items-center gap-1">
            <Wallet className="h-3.5 w-3.5" />
            Comissões
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings className="h-3.5 w-3.5" />
              Config
            </TabsTrigger>
          )}
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-6 space-y-6">
          {/* Filtro de Período */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os períodos</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="365d">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Contatos</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.totalContacts.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Oportunidades</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.totalDeals.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Valor Total</span>
                </div>
                <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalValue)}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Em Aberto</span>
                </div>
                <p className="text-2xl font-bold mt-1 text-blue-600">{stats.openDeals.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Ganhas</span>
                </div>
                <p className="text-2xl font-bold mt-1 text-green-600">{stats.wonDeals.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Perdidas</span>
                </div>
                <p className="text-2xl font-bold mt-1 text-red-600">{stats.lostDeals.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Contratos Fechados no Mês */}
          <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Contratos Fechados no Mês
              </CardTitle>
              <CardDescription>
                Período: {stats.periodLabel}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
                <div>
                  <p className="text-4xl font-bold text-green-600">{stats.monthlyWonDeals}</p>
                  <p className="text-sm text-muted-foreground">Total no mês</p>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4">
                  {(stats.dealsByOwner || []).map((owner) => (
                    <div key={owner.name} className="text-center p-3 rounded-lg bg-background/50">
                      <p className="text-2xl font-bold">{owner.count}</p>
                      <p className="text-sm text-muted-foreground">{owner.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="kanban" className="mt-6">
          <CRMDealsKanban />
        </TabsContent>
        
        <TabsContent value="contacts" className="mt-6">
          <CRMContactsList />
        </TabsContent>
        
        <TabsContent value="activities" className="mt-6">
          <CRMActivities />
        </TabsContent>
        
        <TabsContent value="tasks" className="mt-6">
          <CRMTasks />
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <CRMPendingTasks />
        </TabsContent>

        <TabsContent value="demandas" className="mt-6">
          <CRMDemandasLog />
        </TabsContent>
        
        <TabsContent value="analytics" className="mt-6">
          <CRMAnalytics />
        </TabsContent>
        
        <TabsContent value="notifications" className="mt-6">
          <CRMNotifications />
        </TabsContent>
        
        <TabsContent value="followup" className="mt-6">
          <CRMFollowUp />
        </TabsContent>
        
        <TabsContent value="scoring" className="mt-6">
          <CRMLeadScoring />
        </TabsContent>
        
        <TabsContent value="dailylog" className="mt-6">
          <CRMDailyLog />
        </TabsContent>

        <TabsContent value="ranking" className="mt-6">
          <CRMRanking />
        </TabsContent>

        <TabsContent value="automation" className="mt-6">
          <MarketingAutomation />
        </TabsContent>

        <TabsContent value="zapsign" className="mt-6">
          <CRMZapSignContracts />
        </TabsContent>

        <TabsContent value="commissions" className="mt-6">
          <CRMCommissions />
        </TabsContent>
        
        {isAdmin && (
          <TabsContent value="settings" className="mt-6">
            <CRMSettings onSettingsChange={() => {}} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
