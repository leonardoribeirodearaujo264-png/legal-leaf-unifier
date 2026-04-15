import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Clock, CheckCircle2, AlertCircle, User, Calendar, Filter, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { useUserRole } from '@/hooks/useUserRole';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TaskCreationForm } from '@/components/TaskCreationForm';

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  assigned_to?: string;
  priority?: 'alta' | 'media' | 'baixa';
  created_at?: string;
  completed_at?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

export default function RelatoriosProdutividadeTarefas({ embedded = false }: { embedded?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [compareStartDate, setCompareStartDate] = useState('');
  const [compareEndDate, setCompareEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showComparison, setShowComparison] = useState(false);
  const { toast } = useToast();
  const { isAdmin, profile } = useUserRole();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async (forceRefresh = false) => {
    setLoading(true);
    try {
      if (forceRefresh) {
        // Trigger sync first
        await supabase.functions.invoke('sync-advbox-tasks', {
          body: { sync_type: 'full' },
        });
      }

      // Fetch ALL tasks from database using pagination to bypass 1000 row limit
      const allDbTasks: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: batchError } = await supabase
          .from('advbox_tasks')
          .select('advbox_id, title, description, due_date, completed_at, status, assigned_users, process_number, points, synced_at')
          .order('due_date', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (batchError) throw batchError;

        if (batch && batch.length > 0) {
          allDbTasks.push(...batch);
          offset += batchSize;
          hasMore = batch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      const dbTasks = allDbTasks;

      // Fetch priorities
      const { data: priorities } = await supabase
        .from('task_priorities')
        .select('task_id, priority');

      const tasksData: Task[] = (dbTasks || []).map((t: any) => {
        const priorityData = priorities?.find((p) => p.task_id === String(t.advbox_id));
        return {
          id: String(t.advbox_id),
          title: t.title || 'Sem título',
          description: t.description || '',
          due_date: t.due_date,
          status: t.status || 'pending',
          assigned_to: t.assigned_users || '',
          completed_at: t.completed_at,
          priority: priorityData?.priority as 'alta' | 'media' | 'baixa' | undefined,
        };
      });
      
      setTasks(tasksData);
      setMetadata({ fromCache: false });

      if (dbTasks && dbTasks.length > 0) {
        const mostRecent = dbTasks.reduce((max: any, t: any) => 
          !max || (t.synced_at && t.synced_at > max) ? t.synced_at : max, null);
        if (mostRecent) setLastUpdate(new Date(mostRecent));
      }

      if (forceRefresh) {
        toast({
          title: 'Dados atualizados',
          description: 'As tarefas foram recarregadas.',
        });
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
      toast({
        title: 'Erro ao carregar tarefas',
        description: 'Não foi possível carregar as tarefas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Tarefas visíveis de acordo com o papel do usuário
  const visibleTasks = useMemo(() => {
    if (isAdmin) return tasks;

    // Usuários comuns só veem tarefas atribuídas a eles
    if (!profile?.full_name) return [];

    const currentName = profile.full_name.toLowerCase();

    return tasks.filter((task) =>
      task.assigned_to && task.assigned_to.toLowerCase().includes(currentName)
    );
  }, [tasks, isAdmin, profile?.full_name]);

  // Extrair lista de responsáveis individuais (só para admin)
  const assignedUsers = useMemo(() => {
    const users = new Set<string>();
    visibleTasks.forEach((task) => {
      if (task.assigned_to) {
        // Split comma-separated names into individual users
        const names = task.assigned_to.includes(',')
          ? task.assigned_to.split(',').map((n: string) => n.trim()).filter(Boolean)
          : [task.assigned_to.trim()];
        names.forEach((name: string) => users.add(name));
      }
    });
    return Array.from(users).sort();
  }, [visibleTasks]);

  // Filtrar tarefas por período, responsável, prioridade e status
  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((task) => {
      // Filtro por responsável (só para admin)
      if (isAdmin && selectedUser !== 'all') {
        const names = task.assigned_to ? task.assigned_to.split(',').map((n: string) => n.trim()) : [];
        if (!names.includes(selectedUser)) return false;
      }

      // Filtro por prioridade
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) {
        return false;
      }

      // Filtro por status
      if (selectedStatus !== 'all') {
        const taskStatus = task.status?.toLowerCase();
        if (selectedStatus === 'completed' && taskStatus !== 'completed' && taskStatus !== 'concluída') {
          return false;
        }
        if (selectedStatus === 'pending' && taskStatus !== 'pending' && taskStatus !== 'pendente') {
          return false;
        }
        if (selectedStatus === 'in_progress' && taskStatus !== 'in_progress' && taskStatus !== 'em andamento') {
          return false;
        }
      }

      // Filtro por período (usando due_date como referência)
      if (task.due_date) {
        try {
          const taskDate = parseISO(task.due_date);
          const start = parseISO(startDate);
          const end = parseISO(endDate);
          
          if (!isWithinInterval(taskDate, { start, end })) {
            return false;
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
      }

      return true;
    });
  }, [visibleTasks, startDate, endDate, selectedUser, selectedPriority, selectedStatus, isAdmin]);

  // Tarefas do período de comparação
  const comparisonTasks = useMemo(() => {
    if (!showComparison || !compareStartDate || !compareEndDate) return [];

    return visibleTasks.filter((task) => {
      // Filtro por responsável (só para admin)
      if (isAdmin && selectedUser !== 'all') {
        const names = task.assigned_to ? task.assigned_to.split(',').map((n: string) => n.trim()) : [];
        if (!names.includes(selectedUser)) return false;
      }

      // Filtro por prioridade
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) {
        return false;
      }

      // Filtro por status
      if (selectedStatus !== 'all') {
        const taskStatus = task.status?.toLowerCase();
        if (selectedStatus === 'completed' && taskStatus !== 'completed' && taskStatus !== 'concluída') {
          return false;
        }
        if (selectedStatus === 'pending' && taskStatus !== 'pending' && taskStatus !== 'pendente') {
          return false;
        }
        if (selectedStatus === 'in_progress' && taskStatus !== 'in_progress' && taskStatus !== 'em andamento') {
          return false;
        }
      }

      // Filtro por período de comparação
      if (task.due_date) {
        try {
          const taskDate = parseISO(task.due_date);
          const start = parseISO(compareStartDate);
          const end = parseISO(compareEndDate);
          
          if (!isWithinInterval(taskDate, { start, end })) {
            return false;
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
      }

      return true;
    });
  }, [visibleTasks, compareStartDate, compareEndDate, selectedUser, selectedPriority, selectedStatus, isAdmin, showComparison]);

  // Calcular KPIs do período principal
  const kpis = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(
      (t) => t.status?.toLowerCase() === 'completed' || t.status?.toLowerCase() === 'concluída'
    ).length;
    const pending = filteredTasks.filter(
      (t) => t.status?.toLowerCase() === 'pending' || t.status?.toLowerCase() === 'pendente'
    ).length;
    const inProgress = filteredTasks.filter(
      (t) => t.status?.toLowerCase() === 'in_progress' || t.status?.toLowerCase() === 'em andamento'
    ).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

    return { total, completed, pending, inProgress, completionRate };
  }, [filteredTasks]);

  // Calcular KPIs do período de comparação
  const comparisonKpis = useMemo(() => {
    if (!showComparison || comparisonTasks.length === 0) return null;

    const total = comparisonTasks.length;
    const completed = comparisonTasks.filter(
      (t) => t.status?.toLowerCase() === 'completed' || t.status?.toLowerCase() === 'concluída'
    ).length;
    const pending = comparisonTasks.filter(
      (t) => t.status?.toLowerCase() === 'pending' || t.status?.toLowerCase() === 'pendente'
    ).length;
    const inProgress = comparisonTasks.filter(
      (t) => t.status?.toLowerCase() === 'in_progress' || t.status?.toLowerCase() === 'em andamento'
    ).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

    return { total, completed, pending, inProgress, completionRate };
  }, [comparisonTasks, showComparison]);

  // Dados para gráfico de barras - Tarefas por responsável (split comma-separated)
  const tasksByUser = useMemo(() => {
    const userMap = new Map<string, { name: string; total: number; concluídas: number; pendentes: number }>();

    filteredTasks.forEach((task) => {
      const rawUser = task.assigned_to || 'Não atribuído';
      const users = rawUser.includes(',')
        ? rawUser.split(',').map((n: string) => n.trim()).filter(Boolean)
        : [rawUser.trim()];

      const status = task.status?.toLowerCase();
      const isCompleted = status === 'completed' || status === 'concluída';
      const isPending = status === 'pending' || status === 'pendente';

      users.forEach((user: string) => {
        if (!userMap.has(user)) {
          userMap.set(user, { name: user, total: 0, concluídas: 0, pendentes: 0 });
        }

        const userData = userMap.get(user)!;
        userData.total++;

        if (isCompleted) {
          userData.concluídas++;
        } else if (isPending) {
          userData.pendentes++;
        }
      });
    });

    return Array.from(userMap.values()).sort((a, b) => b.total - a.total);
  }, [filteredTasks]);

  // Dados para gráfico de pizza - Status
  const statusData = useMemo(() => {
    const statusMap = new Map<string, number>();

    filteredTasks.forEach((task) => {
      const status = task.status || 'Indefinido';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    return Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredTasks]);

  // Dados para gráfico de pizza - Prioridades
  const priorityData = useMemo(() => {
    const priorityMap = new Map<string, number>();

    filteredTasks.forEach((task) => {
      const priority = task.priority || 'Sem prioridade';
      priorityMap.set(priority, (priorityMap.get(priority) || 0) + 1);
    });

    return Array.from(priorityMap.entries()).map(([name, value]) => ({ 
      name: name === 'alta' ? 'Alta' : name === 'media' ? 'Média' : name === 'baixa' ? 'Baixa' : name,
      value 
    }));
  }, [filteredTasks]);

  // Tarefas mais antigas pendentes
  const oldestPendingTasks = useMemo(() => {
    return filteredTasks
      .filter((t) => t.status?.toLowerCase() === 'pending' || t.status?.toLowerCase() === 'pendente')
      .filter((t) => t.due_date)
      .sort((a, b) => {
        const dateA = parseISO(a.due_date);
        const dateB = parseISO(b.due_date);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 10)
      .map((task) => ({
        ...task,
        daysOverdue: differenceInDays(new Date(), parseISO(task.due_date)),
      }));
  }, [filteredTasks]);

  if (loading) {
    const loadingContent = (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Carregando relatório...</div>
      </div>
    );
    if (embedded) return loadingContent;
    return <Layout>{loadingContent}</Layout>;
  }

  const content = (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              Relatório de Produtividade
            </h1>
            <p className="text-muted-foreground mt-2">
              Análise de tarefas por período e responsável
            </p>
            <div className="mt-2">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
            </div>
          </div>
          
          <Button onClick={() => fetchTasks(true)} variant="outline">
            Atualizar Dados
          </Button>
        </div>

        {metadata && <AdvboxCacheAlert metadata={metadata} />}

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="start-date">Data Início</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">Data Fim</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="priority-filter">Prioridade</Label>
                  <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                    <SelectTrigger id="priority-filter">
                      <SelectValue placeholder="Todas as prioridades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as prioridades</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="completed">Concluídas</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isAdmin && assignedUsers.length > 0 && (
                  <div>
                    <Label htmlFor="user-filter">Responsável</Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger id="user-filter">
                        <SelectValue placeholder="Filtrar por responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os responsáveis</SelectItem>
                        {assignedUsers.map((user) => (
                          <SelectItem key={user} value={user}>
                            {user}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Comparação de Períodos */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="show-comparison"
                    checked={showComparison}
                    onChange={(e) => setShowComparison(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="show-comparison" className="cursor-pointer">
                    Comparar com outro período
                  </Label>
                </div>

                {showComparison && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                    <div>
                      <Label htmlFor="compare-start-date">Data Início (Comparação)</Label>
                      <Input
                        id="compare-start-date"
                        type="date"
                        value={compareStartDate}
                        onChange={(e) => setCompareStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="compare-end-date">Data Fim (Comparação)</Label>
                      <Input
                        id="compare-end-date"
                        type="date"
                        value={compareEndDate}
                        onChange={(e) => setCompareEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Tarefas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.total}</div>
                {comparisonKpis && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {comparisonKpis.total > kpis.total ? '↓' : '↑'} {Math.abs(kpis.total - comparisonKpis.total)} vs período anterior
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Concluídas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{kpis.completed}</div>
                {comparisonKpis && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {kpis.completed >= comparisonKpis.completed ? '↑' : '↓'} {Math.abs(kpis.completed - comparisonKpis.completed)} vs período anterior
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">{kpis.pending}</div>
                {comparisonKpis && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {kpis.pending <= comparisonKpis.pending ? '↓' : '↑'} {Math.abs(kpis.pending - comparisonKpis.pending)} vs período anterior
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  Em Andamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{kpis.inProgress}</div>
                {comparisonKpis && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {Math.abs(kpis.inProgress - comparisonKpis.inProgress)} vs período anterior
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Conclusão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.completionRate}%</div>
                {comparisonKpis && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {parseFloat(kpis.completionRate) >= parseFloat(comparisonKpis.completionRate) ? '↑' : '↓'}{' '}
                    {Math.abs(parseFloat(kpis.completionRate) - parseFloat(comparisonKpis.completionRate)).toFixed(1)}% vs período anterior
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Barras - Tarefas por Responsável */}
          <Card>
            <CardHeader>
              <CardTitle>Tarefas por Responsável</CardTitle>
              <CardDescription>Distribuição de tarefas concluídas e pendentes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={tasksByUser} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={140} 
                    interval={0}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="concluídas" fill="#10b981" />
                  <Bar dataKey="pendentes" fill="#eab308" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza - Status */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
              <CardDescription>Status das tarefas no período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza - Prioridades */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Prioridade</CardTitle>
              <CardDescription>Prioridades das tarefas no período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Resumo por Responsável */}
          <Card>
            <CardHeader>
              <CardTitle>Ranking de Produtividade</CardTitle>
              <CardDescription>Top responsáveis por conclusão</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...tasksByUser].sort((a, b) => {
                  const rateA = a.total > 0 ? a.concluídas / a.total : 0;
                  const rateB = b.total > 0 ? b.concluídas / b.total : 0;
                  return rateB - rateA || b.concluídas - a.concluídas;
                }).slice(0, 10).map((user, index) => (
                  <div key={user.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.concluídas} de {user.total} concluídas
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {user.total > 0 ? ((user.concluídas / user.total) * 100).toFixed(0) : 0}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tarefas Pendentes Mais Antigas */}
        <Card>
          <CardHeader>
            <CardTitle>Tarefas Pendentes Mais Antigas</CardTitle>
            <CardDescription>Top 10 tarefas pendentes com vencimento mais antigo</CardDescription>
          </CardHeader>
          <CardContent>
            {oldestPendingTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma tarefa pendente no período selecionado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Dias em Atraso</TableHead>
                    <TableHead>Prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {oldestPendingTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {task.assigned_to || 'Não atribuído'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(parseISO(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={task.daysOverdue > 7 ? 'destructive' : 'secondary'}>
                          {task.daysOverdue} {task.daysOverdue === 1 ? 'dia' : 'dias'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.priority ? (
                          <Badge
                            variant="outline"
                            className={
                              task.priority === 'alta'
                                ? 'border-red-500 text-red-500'
                                : task.priority === 'media'
                                ? 'border-yellow-500 text-yellow-500'
                                : 'border-green-500 text-green-500'
                            }
                          >
                            {task.priority.toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
  );

  if (embedded) return content;
  return <Layout>{content}</Layout>;
}
