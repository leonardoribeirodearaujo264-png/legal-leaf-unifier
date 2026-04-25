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
import {
  isCompletedTask,
  isPendingTask,
  isInProgressTask,
  isStaleTask,
  isOverdueTask,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/lib/taskStatus';

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
  const [activeNames, setActiveNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  // Erro de carregamento (timeout, falha de rede, etc.) — exibido em UI dedicada com botão "Tentar novamente".
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // Task creation dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTaskProcessNumber, setNewTaskProcessNumber] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [advboxTaskTypes, setAdvboxTaskTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [advboxUsers, setAdvboxUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingTaskTypes, setLoadingTaskTypes] = useState(false);
  const [loadingAdvboxUsers, setLoadingAdvboxUsers] = useState(false);

  useEffect(() => {
    fetchTasks();
    // Carregar colaboradores ativos
    supabase
      .from('profiles')
      .select('full_name')
      .eq('is_active', true)
      .eq('is_suspended', false)
      .eq('approval_status', 'approved')
      .then(({ data }) => {
        setActiveNames(
          new Set((data || []).map((p: any) => (p.full_name || '').toUpperCase().trim()).filter(Boolean))
        );
      });
  }, []);

  const fetchAdvboxTaskTypes = async () => {
    setLoadingTaskTypes(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/task-types');
      if (error) throw error;
      const rawData = data?.data || [];
      const types = Array.isArray(rawData) ? rawData.map((t: any) => ({
        id: t.id || t.tasks_id,
        name: t.task || t.name || t.title || `Tipo ${t.id || t.tasks_id}`,
      })).filter((t: any) => t.id && t.name) : [];
      setAdvboxTaskTypes(types);
    } catch (err) {
      console.error('Erro ao buscar tipos de tarefa:', err);
    } finally {
      setLoadingTaskTypes(false);
    }
  };

  const fetchAdvboxUsers = async () => {
    setLoadingAdvboxUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/users');
      if (error) throw error;
      const rawData = data?.data || data?.users || [];
      const users = Array.isArray(rawData) ? rawData.map((u: any) => ({
        id: u.id || u.user_id,
        name: u.name || u.full_name || u.email || `Usuário ${u.id}`,
      })).filter((u: any) => u.id) : [];
      setAdvboxUsers(users);
    } catch (err) {
      console.error('Erro ao buscar usuários Advbox:', err);
    } finally {
      setLoadingAdvboxUsers(false);
    }
  };

  const fetchTasks = async (forceRefresh = false) => {
    setLoading(true);
    setLoadError(null);

    // Timeout defensivo de 30s. Se a query exceder, abortamos e mostramos UI de erro
    // em vez de deixar o "Carregando relatório..." girando indefinidamente.
    const TIMEOUT_MS = 30_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      if (forceRefresh) {
        // Dispara sync incremental antes da leitura local
        await supabase.functions.invoke('sync-advbox-tasks', {
          body: { sync_type: 'full' },
        });
      }

      // OTIMIZAÇÃO: filtra por período no servidor (range startDate→endDate em due_date OR completed_at)
      // em vez de baixar TODAS as ~13k tasks. Reduz payload e usa o índice idx_advbox_tasks_status_due_date.
      // Também remove o campo `description` do SELECT (campo grande, não é usado nos cálculos do relatório).
      const allDbTasks: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      // Margem de segurança: incluímos um buffer de 365 dias para trás para capturar
      // tarefas em atraso ainda relevantes que tenham due_date antes do startDate selecionado.
      const periodStart = new Date(startDate);
      periodStart.setDate(periodStart.getDate() - 365);
      const periodStartIso = periodStart.toISOString().slice(0, 10);
      const periodEndIso = endDate;

      while (hasMore) {
        if (controller.signal.aborted) throw new Error('TIMEOUT');
        const { data: batch, error: batchError } = await supabase
          .from('advbox_tasks')
          .select('advbox_id, title, due_date, completed_at, status, assigned_users, process_number, points, synced_at')
          .or(`due_date.gte.${periodStartIso},completed_at.gte.${periodStartIso}`)
          .lte('due_date', periodEndIso)
          .order('due_date', { ascending: false })
          .range(offset, offset + batchSize - 1)
          .abortSignal(controller.signal);

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

      // Busca prioridades e indexa em Map (O(1) lookup) em vez de Array.find() (O(N) por task).
      // Antes: 13k tasks × 13k priorities = ~170M comparações no JS (segundos travando a UI).
      const { data: priorities } = await supabase
        .from('task_priorities')
        .select('task_id, priority');
      const priorityMap = new Map<string, string>();
      (priorities || []).forEach((p: any) => priorityMap.set(String(p.task_id), p.priority));

      const tasksData: Task[] = dbTasks.map((t: any) => ({
        id: String(t.advbox_id),
        title: t.title || 'Sem título',
        description: '', // não usado no relatório; mantemos campo para compatibilidade do tipo
        due_date: t.due_date,
        status: t.status || 'pending',
        assigned_to: t.assigned_users || '',
        completed_at: t.completed_at,
        priority: priorityMap.get(String(t.advbox_id)) as 'alta' | 'media' | 'baixa' | undefined,
      }));

      setTasks(tasksData);
      setMetadata({ fromCache: false });

      if (dbTasks.length > 0) {
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
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      const isTimeout = error?.message === 'TIMEOUT' || error?.name === 'AbortError';
      const msg = isTimeout
        ? 'A consulta demorou mais de 30 segundos. Tente novamente ou ajuste o período de análise.'
        : 'Não foi possível carregar as tarefas. Verifique sua conexão e tente novamente.';
      setLoadError(msg);
      setTasks([]);
      toast({
        title: isTimeout ? 'Tempo esgotado' : 'Erro ao carregar tarefas',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      clearTimeout(timeoutId);
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
  // BUG #7 FIX: usa helpers canônicos do taskStatus.ts em vez de comparar
  // strings cruas em cada lugar. Isso garante que a base de cálculo da lista
  // bata com a base dos gráficos.
  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((task) => {
      // Ignorar tarefas descontinuadas/excluídas
      if (isStaleTask(task)) return false;

      // Ignorar tarefas cujos responsáveis são todos inativos
      if (activeNames.size > 0 && task.assigned_to) {
        const names = task.assigned_to.split(',').map((n: string) => n.trim()).filter(Boolean);
        const hasActive = names.some((n: string) => activeNames.has(n.toUpperCase()));
        if (!hasActive) return false;
      }

      // Filtro por responsável (só para admin)
      if (isAdmin && selectedUser !== 'all') {
        const names = task.assigned_to ? task.assigned_to.split(',').map((n: string) => n.trim()) : [];
        if (!names.includes(selectedUser)) return false;
      }

      // Filtro por prioridade
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) {
        return false;
      }

      // Filtro por status — comparação canônica
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'completed' && !isCompletedTask(task)) return false;
        if (selectedStatus === 'pending' && !isPendingTask(task)) return false;
        if (selectedStatus === 'in_progress' && !isInProgressTask(task)) return false;
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
  }, [visibleTasks, startDate, endDate, selectedUser, selectedPriority, selectedStatus, isAdmin, activeNames]);

  // Tarefas do período de comparação
  // BUG #7 FIX: usa helpers canônicos de taskStatus.ts para casar a base de
  // cálculo da comparação com a base do período principal.
  const comparisonTasks = useMemo(() => {
    if (!showComparison || !compareStartDate || !compareEndDate) return [];

    return visibleTasks.filter((task) => {
      // Ignorar tarefas descontinuadas/excluídas
      if (isStaleTask(task)) return false;

      // Ignorar tarefas cujos responsáveis são todos inativos
      if (activeNames.size > 0 && task.assigned_to) {
        const names = task.assigned_to.split(',').map((n: string) => n.trim()).filter(Boolean);
        const hasActive = names.some((n: string) => activeNames.has(n.toUpperCase()));
        if (!hasActive) return false;
      }

      // Filtro por responsável (só para admin)
      if (isAdmin && selectedUser !== 'all') {
        const names = task.assigned_to ? task.assigned_to.split(',').map((n: string) => n.trim()) : [];
        if (!names.includes(selectedUser)) return false;
      }

      // Filtro por prioridade
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) {
        return false;
      }

      // Filtro por status — comparação canônica
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'completed' && !isCompletedTask(task)) return false;
        if (selectedStatus === 'pending' && !isPendingTask(task)) return false;
        if (selectedStatus === 'in_progress' && !isInProgressTask(task)) return false;
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
  }, [visibleTasks, compareStartDate, compareEndDate, selectedUser, selectedPriority, selectedStatus, isAdmin, showComparison, activeNames]);

  // Calcular KPIs do período principal
  // BUG #7 FIX: KPIs e gráficos compartilham a mesma definição de status via
  // helpers, evitando que "Mariana 9/93/97" no card divirja do gráfico.
  const kpis = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t) => isCompletedTask(t)).length;
    const pending = filteredTasks.filter((t) => isPendingTask(t)).length;
    const inProgress = filteredTasks.filter((t) => isInProgressTask(t)).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

    return { total, completed, pending, inProgress, completionRate };
  }, [filteredTasks]);

  // Calcular KPIs do período de comparação
  const comparisonKpis = useMemo(() => {
    if (!showComparison || comparisonTasks.length === 0) return null;

    const total = comparisonTasks.length;
    const completed = comparisonTasks.filter((t) => isCompletedTask(t)).length;
    const pending = comparisonTasks.filter((t) => isPendingTask(t)).length;
    const inProgress = comparisonTasks.filter((t) => isInProgressTask(t)).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

    return { total, completed, pending, inProgress, completionRate };
  }, [comparisonTasks, showComparison]);

  // Dados para gráfico de barras - Tarefas por responsável (split comma-separated)
  // BUG #6 FIX: agora rastreia 3 categorias (concluídas, em andamento, pendentes)
  // pra casar com os KPIs. Antes só tinha 2, gerando "categoria fantasma" no
  // gráfico que não fechava com o card.
  // BUG #7 FIX: usa isCompletedTask/isInProgressTask/isPendingTask em vez de
  // comparar string de status, garantindo que a soma das categorias seja o total.
  const tasksByUser = useMemo(() => {
    const userMap = new Map<
      string,
      { name: string; total: number; concluídas: number; emAndamento: number; pendentes: number }
    >();

    filteredTasks.forEach((task) => {
      const rawUser = task.assigned_to || 'Não atribuído';
      const allUsers = rawUser.includes(',')
        ? rawUser.split(',').map((n: string) => n.trim()).filter(Boolean)
        : [rawUser.trim()];
      // Filtrar apenas usuários ativos (se já carregou)
      const users = activeNames.size > 0
        ? allUsers.filter((u: string) => activeNames.has(u.toUpperCase()))
        : allUsers;

      users.forEach((user: string) => {
        if (!userMap.has(user)) {
          userMap.set(user, {
            name: user,
            total: 0,
            concluídas: 0,
            emAndamento: 0,
            pendentes: 0,
          });
        }

        const userData = userMap.get(user)!;
        userData.total++;

        if (isCompletedTask(task)) {
          userData.concluídas++;
        } else if (isInProgressTask(task)) {
          userData.emAndamento++;
        } else if (isPendingTask(task)) {
          userData.pendentes++;
        }
      });
    });

    return Array.from(userMap.values()).sort((a, b) => b.total - a.total);
  }, [filteredTasks, activeNames]);

  // Dados para gráfico de pizza - Status
  // BUG #6/#7 FIX: usa as mesmas 3 categorias canônicas (Concluída / Em
  // Andamento / Pendente) que o BarChart e os KPIs. Antes podia mostrar
  // "completed" e "concluída" como fatias separadas só por causa de string
  // vinda do ADVBOX em PT/EN.
  const statusData = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let pending = 0;

    filteredTasks.forEach((task) => {
      if (isCompletedTask(task)) completed++;
      else if (isInProgressTask(task)) inProgress++;
      else if (isPendingTask(task)) pending++;
    });

    return [
      { name: STATUS_LABELS.completed, value: completed, fill: STATUS_COLORS.completed },
      { name: STATUS_LABELS.in_progress, value: inProgress, fill: STATUS_COLORS.in_progress },
      { name: STATUS_LABELS.pending, value: pending, fill: STATUS_COLORS.pending },
    ].filter((slice) => slice.value > 0);
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
  // BUG #7 FIX: usa isPendingTask para casar exatamente com a categoria
  // "Pendente" do gráfico/KPI; evita pegar "em andamento" ou tarefas com
  // completed_at preenchido que ainda não atualizou o status.
  const oldestPendingTasks = useMemo(() => {
    return filteredTasks
      .filter((t) => isPendingTask(t))
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
          
          <div className="flex gap-2">
            <Button onClick={() => fetchTasks(true)} variant="outline">
              Atualizar Dados
            </Button>

            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setNewTaskProcessNumber('');
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Tarefa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Criar Nova Tarefa</DialogTitle>
                  <DialogDescription>
                    Preencha os campos abaixo para criar uma nova tarefa no Advbox
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-2 flex-shrink-0 border-b pb-4 mb-4">
                  <Label htmlFor="process_number_prod" className="text-sm font-medium">Número do Processo *</Label>
                  <Input
                    id="process_number_prod"
                    value={newTaskProcessNumber}
                    onChange={(e) => setNewTaskProcessNumber(e.target.value)}
                    placeholder="Ex: 1234567-89.2023.8.26.0100"
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o número do processo para vincular a tarefa no Advbox
                  </p>
                </div>

                <ScrollArea className="flex-1 overflow-y-auto pr-4">
                  <TaskCreationForm
                    initialData={{
                      lawsuitId: 0,
                      processNumber: newTaskProcessNumber,
                      title: '',
                      description: '',
                    }}
                    taskTypes={advboxTaskTypes}
                    advboxUsers={advboxUsers}
                    loadingTaskTypes={loadingTaskTypes}
                    loadingUsers={loadingAdvboxUsers}
                    onFetchTaskTypes={fetchAdvboxTaskTypes}
                    onFetchUsers={fetchAdvboxUsers}
                    onSubmit={async (taskData) => {
                      if (!newTaskProcessNumber.trim()) {
                        toast({
                          title: 'Número do processo obrigatório',
                          description: 'Informe o número do processo para criar a tarefa no Advbox.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      
                      setIsCreatingTask(true);
                      try {
                        const { data: lawsuitsData, error: lawsuitsError } = await supabase.functions.invoke(
                          'advbox-integration/lawsuits'
                        );
                        if (lawsuitsError) throw lawsuitsError;

                        const lawsuits = (lawsuitsData as any)?.data || lawsuitsData || [];
                        const processNumber = newTaskProcessNumber.trim();
                        const lawsuit = (lawsuits as any[]).find(
                          (l: any) => l.process_number === processNumber
                        );

                        if (!lawsuit) {
                          throw new Error('Processo não encontrado no Advbox');
                        }

                        taskData.lawsuits_id = parseInt(String(lawsuit.id), 10);

                        const { error } = await supabase.functions.invoke('advbox-integration/create-task', {
                          body: taskData,
                        });
                        if (error) throw error;

                        toast({
                          title: 'Tarefa criada',
                          description: 'A tarefa foi criada com sucesso no Advbox.',
                        });

                        setDialogOpen(false);
                        setNewTaskProcessNumber('');
                        fetchTasks();
                      } catch (error) {
                        console.error('Error creating task:', error);
                        toast({
                          title: 'Erro ao criar tarefa',
                          description: error instanceof Error ? error.message : 'Não foi possível criar a tarefa.',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsCreatingTask(false);
                      }
                    }}
                    onCancel={() => {
                      setDialogOpen(false);
                      setNewTaskProcessNumber('');
                    }}
                    isSubmitting={isCreatingTask}
                  />
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
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
          {/*
            BUG #5 FIX: layout horizontal (vertical no Recharts) — todos os
            nomes ficam visíveis sem corte. Antes os rótulos -45° cortavam
            Mariana, Carolina, Nagila, Cariston, Gabriel, Guilherme, Lucas.
            BUG #6 FIX: três barras (Concluída / Em Andamento / Pendente),
            mesmas categorias e cores dos KPIs (STATUS_COLORS).
          */}
          <Card>
            <CardHeader>
              <CardTitle>Tarefas por Responsável</CardTitle>
              <CardDescription>
                Distribuição de tarefas {STATUS_LABELS.completed.toLowerCase()},
                {' '}{STATUS_LABELS.in_progress.toLowerCase()} e
                {' '}{STATUS_LABELS.pending.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer
                width="100%"
                height={Math.max(400, tasksByUser.length * 36 + 80)}
              >
                <BarChart
                  data={tasksByUser}
                  layout="vertical"
                  margin={{ top: 10, right: 24, left: 24, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="concluídas"
                    name={STATUS_LABELS.completed}
                    fill={STATUS_COLORS.completed}
                  />
                  <Bar
                    dataKey="emAndamento"
                    name={STATUS_LABELS.in_progress}
                    fill={STATUS_COLORS.in_progress}
                  />
                  <Bar
                    dataKey="pendentes"
                    name={STATUS_LABELS.pending}
                    fill={STATUS_COLORS.pending}
                  />
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
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill || COLORS[index % COLORS.length]}
                      />
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
