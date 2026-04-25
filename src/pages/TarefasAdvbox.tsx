import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, Plus, Filter, CheckCircle2, Clock, AlertCircle, User, Flag, X, Edit, History, Calendar, List, Settings, BarChart3, Lightbulb, Lock, TrendingUp, FileText, Tag, UserCircle, CalendarCheck } from 'lucide-react';
import { TutorialOverlay } from '@/components/TutorialOverlay';
import { tutorialsByPage } from '@/components/tutorialData';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { TaskCalendarView } from '@/components/TaskCalendarView';
import { TaskNotificationSettings } from '@/components/TaskNotificationSettings';
import { WeeklyTaskReport } from '@/components/WeeklyTaskReport';
import { TaskAutoRulesManager } from '@/components/TaskAutoRulesManager';
import { TaskCreationForm } from '@/components/TaskCreationForm';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isThisWeek, isThisMonth, isBefore, isAfter, isEqual, startOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { useUserRole } from '@/hooks/useUserRole';
import { TaskComments } from '@/components/TaskComments';
import { TaskAttachments } from '@/components/TaskAttachments';
import { useIsMobile } from '@/hooks/use-mobile';
import { TaskStatusHistory } from '@/components/TaskStatusHistory';
import RelatoriosProdutividadeTarefas from './RelatoriosProdutividadeTarefas';
import { isOverdueTask, normalizeStatus, STATUS_DESCRIPTIONS, STATUS_LABELS } from '@/lib/taskStatus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  assigned_to?: string;
  priority?: 'alta' | 'media' | 'baixa';
  process_number?: string;
  category?: string;
  notes?: string;
  task_type?: string;
  lawsuit_id?: number;
  completed_at?: string;
  created_at?: string;
  client_name?: string;
}

// Removed localStorage cache - data now comes from database

export default function TarefasAdvbox() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'produtividade' ? 'produtividade' : 'list';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeletionAlerts, setShowDeletionAlerts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskProcessNumber, setNewTaskProcessNumber] = useState('');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [advboxTaskTypes, setAdvboxTaskTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [advboxUsers, setAdvboxUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingTaskTypes, setLoadingTaskTypes] = useState(false);
  const [loadingAdvboxUsers, setLoadingAdvboxUsers] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<string>('all');
  // Filtros de data extras (bug #3) — 'specific' usa specificDate; 'range' usa rangeStartDate + rangeEndDate
  const [specificDate, setSpecificDate] = useState<string>('');
  const [rangeStartDate, setRangeStartDate] = useState<string>('');
  const [rangeEndDate, setRangeEndDate] = useState<string>('');
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<'alta' | 'media' | 'baixa'>('media');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewTab, setViewTab] = useState<string>(initialTab);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { toast } = useToast();
  const { isAdmin, profile, loading: roleLoading } = useUserRole();
  const { canView, canEdit, loading: permLoading } = useAdminPermissions();
  const isMobile = useIsMobile();
  
  // Verificar acesso com fallback seguro
  const hasAdvboxAccess = !permLoading && canView('advbox');
  const isLoading = roleLoading || permLoading;
  
  // Hook para notificações push - DEVE ser chamado antes de qualquer return condicional
  useTaskNotifications(tasks);

  // TODOS OS useMemo DEVEM VIR ANTES DOS RETURNS CONDICIONAIS
  // Tarefas visíveis de acordo com o papel do usuário
  const visibleTasks = useMemo(() => {
    if (isAdmin) return tasks;
    if (!profile?.full_name) return [];
    const currentName = profile.full_name.toLowerCase();
    return tasks.filter((task) =>
      task.assigned_to && task.assigned_to.toLowerCase().includes(currentName)
    );
  }, [tasks, isAdmin, profile?.full_name]);

  // Extrair lista única de responsáveis (usado apenas por admins)
  const assignedUsers = useMemo(() => {
    const users = new Set<string>();
    visibleTasks.forEach((task) => {
      if (task.assigned_to) {
        task.assigned_to
          .split(',')
          .map((n: string) => n.trim())
          .filter(Boolean)
          .forEach((name: string) => users.add(name));
      }
    });
    return Array.from(users).sort();
  }, [visibleTasks]);

  // Filtrar e ordenar tarefas
  const filteredTasks = useMemo(() => {
    let filtered = visibleTasks.filter((task) => {
      // Hide deletion alerts by default
      if (!showDeletionAlerts) {
        const titleLower = (task.title || '').toLowerCase();
        if (titleLower.includes('alerta') && (titleLower.includes('exclu') || titleLower.includes('delet'))) return false;
        if (titleLower.includes('tarefa excluída') || titleLower.includes('tarefa excluida')) return false;
        if (titleLower.includes('deleted') || titleLower.includes('exclusão') || titleLower.includes('exclusao')) return false;
      }

      // Hide stale tasks by default unless explicitly filtered
      // Usa normalizeStatus pra capturar variações ("stale" / "obsoleta" / "deleted").
      const normalized = normalizeStatus(task.status);
      if (statusFilter !== 'stale' && normalized === 'stale') return false;

      if (statusFilter !== 'all') {
        // Comparação canônica — não compara strings cruas
        if (normalized !== statusFilter) return false;
      }
      if (assignedFilter !== 'all') {
        const names = (task.assigned_to || '').split(',').map((n: string) => n.trim());
        if (!names.includes(assignedFilter)) return false;
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

      // BUG #4 FIX: filtro 'overdue' agora usa isOverdueTask, que checa
      // status (não pega concluída/obsoleta) ALÉM da data.
      // BUG #3: novos filtros 'specific' (dia exato) e 'range' (período).
      if (dueDateFilter !== 'all') {
        if (dueDateFilter === 'overdue') {
          if (!isOverdueTask(task)) return false;
        } else {
          // Demais filtros precisam de due_date
          if (!task.due_date) return false;
          const dueDate = new Date(task.due_date);

          switch (dueDateFilter) {
            case 'today':
              if (!isToday(dueDate)) return false;
              break;
            case 'week':
              if (!isThisWeek(dueDate, { weekStartsOn: 0 })) return false;
              break;
            case 'month':
              if (!isThisMonth(dueDate)) return false;
              break;
            case 'specific': {
              if (!specificDate) return false;
              const target = parseISO(specificDate);
              const dueDay = startOfDay(dueDate);
              if (!isEqual(dueDay, startOfDay(target))) return false;
              break;
            }
            case 'range': {
              if (!rangeStartDate && !rangeEndDate) return false;
              const dueDay = startOfDay(dueDate);
              if (rangeStartDate) {
                const start = startOfDay(parseISO(rangeStartDate));
                if (isBefore(dueDay, start)) return false;
              }
              if (rangeEndDate) {
                const end = startOfDay(parseISO(rangeEndDate));
                if (isAfter(dueDay, end)) return false;
              }
              break;
            }
          }
        }
      }

      return true;
    });

    const priorityOrder = { alta: 0, media: 1, baixa: 2 };
    filtered.sort((a, b) => {
      const aPriority = a.priority ? priorityOrder[a.priority] : 999;
      const bPriority = b.priority ? priorityOrder[b.priority] : 999;
      return aPriority - bPriority;
    });

    return filtered;
  }, [visibleTasks, statusFilter, assignedFilter, priorityFilter, dueDateFilter, specificDate, rangeStartDate, rangeEndDate, showDeletionAlerts]);

  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE);
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTasks.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTasks, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, assignedFilter, priorityFilter, dueDateFilter, specificDate, rangeStartDate, rangeEndDate, showDeletionAlerts]);

  // TODAS AS FUNÇÕES DEVEM SER DEFINIDAS ANTES DOS RETURNS CONDICIONAIS
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .eq('is_suspended', false)
        .order('full_name');

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

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

  const fetchTasks = async () => {
    if (tasks.length === 0) {
      setLoading(true);
    }

    try {
      // Buscar todas as tarefas em batches, SEM raw_data (campo pesado, ~70% do payload)
      // raw_data é carregado sob demanda apenas no detalhe da tarefa.
      const allDbTasks: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: batchError } = await supabase
          .from('advbox_tasks')
          .select('advbox_id, title, description, due_date, completed_at, status, assigned_users, process_number, task_type, task_type_id, lawsuit_id, points, synced_at, created_at, client_name')
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

      // Fetch priorities (poucos registros — Map para lookup O(1) em vez de find O(n))
      const { data: priorities } = await supabase
        .from('task_priorities')
        .select('task_id, priority');

      const priorityMap = new Map<string, 'alta' | 'media' | 'baixa'>();
      if (priorities) {
        for (const p of priorities) {
          priorityMap.set(String(p.task_id), p.priority as 'alta' | 'media' | 'baixa');
        }
      }

      const tasksData: Task[] = (dbTasks || []).map((t: any) => ({
        id: String(t.advbox_id),
        title: t.title || 'Sem título',
        description: t.description || '',
        due_date: t.due_date,
        status: t.status || 'pending',
        assigned_to: t.assigned_users || '',
        process_number: t.process_number || '',
        category: '',
        priority: priorityMap.get(String(t.advbox_id)),
        task_type: t.task_type || '',
        lawsuit_id: t.lawsuit_id,
        completed_at: t.completed_at,
        created_at: t.created_at,
        client_name: t.client_name || '',
      }));

      setTasks(tasksData);

      // Se DB vazio, dispara sync inicial
      if (tasksData.length === 0) {
        console.log('No tasks in DB, triggering initial sync...');
        handleSyncTasks();
        return;
      }

      // Last update do synced_at mais recente
      if (dbTasks && dbTasks.length > 0) {
        const mostRecent = dbTasks.reduce((max: any, t: any) =>
          !max || (t.synced_at && t.synced_at > max) ? t.synced_at : max, null);
        if (mostRecent) setLastUpdate(new Date(mostRecent));
      }

      setMetadata({ fromCache: false });
    } catch (error) {
      console.error('Error fetching tasks from DB:', error);
      if (tasks.length === 0) {
        toast({
          title: 'Erro ao carregar tarefas',
          description: 'Não foi possível carregar as tarefas.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTasks = async () => {
    setSyncing(true);
    toast({
      title: 'Sincronizando tarefas',
      description: 'Buscando atualizações do ADVBox...',
    });
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-advbox-tasks', {
        body: { sync_type: 'full' },
      });

      if (error) throw error;
      
      if (data?.error) {
        toast({
          title: 'Sincronização parcial',
          description: `${data.partial_count || 0} tarefas processadas. Erro: ${data.error}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sincronização concluída',
          description: `${data?.total_upserted || 0} tarefas atualizadas.`,
        });
      }

      // Refetch from DB
      await fetchTasks();
    } catch (error) {
      console.error('Error syncing tasks:', error);
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar com o ADVBox.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  // useEffect DEVE vir DEPOIS das definições de funções
  useEffect(() => {
    // Só carregar dados quando permissões estiverem prontas E usuário tiver acesso.
    // fetchAdvboxTaskTypes e fetchAdvboxUsers são chamados sob demanda quando o dialog "Nova Tarefa" abre.
    if (!isLoading && hasAdvboxAccess && !dataLoaded) {
      console.log('TarefasAdvbox: Carregando dados...');
      setDataLoaded(true);
      fetchTasks();
      fetchUsers();
    }
  }, [isLoading, hasAdvboxAccess, dataLoaded]);

  // CONDITIONAL RETURNS - apenas APÓS todas as funções e hooks
  // Mostrar loading enquanto verifica permissões
  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Verificando permissões...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Verificar acesso após loading completar
  if (!hasAdvboxAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Lock className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Você não tem permissão para acessar as tarefas do Advbox.
          </p>
        </div>
      </Layout>
    );
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      const previousStatus = task?.status || 'unknown';

      // Atualizar localmente na tabela advbox_tasks (API do ADVBox não possui endpoint para concluir tarefas)
      const { error } = await supabase
        .from('advbox_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) throw error;

      // Registrar no histórico
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('task_status_history').insert({
          task_id: taskId,
          previous_status: previousStatus,
          new_status: 'completed',
          changed_by: user.id,
          notes: 'Tarefa concluída na intranet (limitação da API do ADVBox)'
        });
      }

      toast({
        title: 'Tarefa concluída na intranet',
        description: 'A conclusão no ADVBox deve ser feita manualmente (limitação da API).',
      });

      fetchTasks();
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: 'Erro ao concluir tarefa',
        description: 'Não foi possível marcar a tarefa como concluída.',
        variant: 'destructive',
      });
    }
  };

  const handleEditTask = async () => {
    if (!editTask || !editTask.title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Por favor, informe o título da tarefa.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const task = tasks.find(t => t.id === editTask.id);
      const previousStatus = task?.status;

      const { data, error } = await supabase.functions.invoke('advbox-integration/update-task', {
        body: {
          task_id: editTask.id,
          title: editTask.title,
          description: editTask.description,
          due_date: editTask.due_date,
          assigned_to: editTask.assigned_to,
          status: editTask.status,
        },
      });

      if (error) throw error;

      // Se o status mudou, registrar no histórico
      if (previousStatus && previousStatus !== editTask.status) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('task_status_history').insert({
            task_id: editTask.id,
            previous_status: previousStatus,
            new_status: editTask.status,
            changed_by: user.id,
            notes: 'Status alterado via edição'
          });
        }
      }

      toast({
        title: 'Tarefa atualizada',
        description: 'A tarefa foi atualizada com sucesso.',
      });

      setEditDialogOpen(false);
      setEditTask(null);
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Erro ao atualizar tarefa',
        description: 'Não foi possível atualizar a tarefa.',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (task: Task) => {
    setEditTask({ ...task });
    setEditDialogOpen(true);
  };

  const handleSetPriority = async () => {
    if (!selectedTaskId) return;

    try {
      const { error } = await supabase
        .from('task_priorities')
        .upsert({
          task_id: selectedTaskId,
          priority: selectedPriority,
          set_by: (await supabase.auth.getUser()).data.user?.id,
        }, {
          onConflict: 'task_id'
        });

      if (error) throw error;

      toast({
        title: 'Prioridade definida',
        description: `Tarefa marcada como prioridade ${selectedPriority}.`,
      });

      setPriorityDialogOpen(false);
      fetchTasks();
    } catch (error) {
      console.error('Error setting priority:', error);
      toast({
        title: 'Erro ao definir prioridade',
        description: 'Não foi possível definir a prioridade da tarefa.',
        variant: 'destructive',
      });
    }
  };

  const openPriorityDialog = (taskId: string, currentPriority?: 'alta' | 'media' | 'baixa') => {
    setSelectedTaskId(taskId);
    setSelectedPriority(currentPriority || 'media');
    setPriorityDialogOpen(true);
  };

  const openTaskDetails = (task: Task) => {
    setSelectedTask(task);
    setDetailsOpen(true);
  };

  // BUG #2/#7 FIX: ícone e variante derivam da chave canônica via
  // normalizeStatus, então não importa se o ADVBOX devolve "completed",
  // "concluída" ou "Concluído" — todos viram a mesma chave.
  const getStatusIcon = (status?: string) => {
    switch (normalizeStatus(status)) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
      case 'stale':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" => {
    switch (normalizeStatus(status)) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta':
        return 'bg-red-500 hover:bg-red-600';
      case 'media':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'baixa':
        return 'bg-green-500 hover:bg-green-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  if (loading && tasks.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando tarefas...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <CheckSquare className="h-8 w-8 text-primary" />
              Gestão de Tarefas
              <TutorialOverlay pageKey="tarefas" pageName={tutorialsByPage.tarefas.pageName} steps={tutorialsByPage.tarefas.steps} />
            </h1>
            <p className="text-muted-foreground mt-2">
              Gerencie suas tarefas do Advbox
            </p>
            <div className="mt-2">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSyncTasks}
              disabled={syncing}
            >
              <Flag className="h-4 w-4 mr-2" />
              {syncing ? 'Sincronizando...' : 'Atualizar dados'}
            </Button>

            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setNewTaskProcessNumber('');
              // Lazy load dos tipos de tarefa e usuários ADVBox apenas quando o dialog abre
              if (open) {
                if (advboxTaskTypes.length === 0 && !loadingTaskTypes) fetchAdvboxTaskTypes();
                if (advboxUsers.length === 0 && !loadingAdvboxUsers) fetchAdvboxUsers();
              }
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
                
                {/* Campo de número do processo (necessário para criar tarefa) */}
                <div className="space-y-2 flex-shrink-0 border-b pb-4 mb-4">
                  <Label htmlFor="process_number" className="text-sm font-medium">Número do Processo *</Label>
                  <Input
                    id="process_number"
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
                        // Buscar o processo correspondente no Advbox
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

                        // Atualizar lawsuits_id com o ID encontrado
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

        {/* Tabs de Visualização */}
        <Tabs value={viewTab} onValueChange={setViewTab} className="space-y-4">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-6' : 'grid-cols-4'} lg:w-auto`}>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendário</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="report" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Relatório</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="rules" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                <span className="hidden sm:inline">Sugestões</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="produtividade" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Produtividade</span>
            </TabsTrigger>
          </TabsList>

          {/* Aba Lista */}
          <TabsContent value="list" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    {/* BUG #2 FIX: tooltip explica o que é cada status */}
                    <div className="flex items-center gap-1">
                      <Label htmlFor="status-filter">Status</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <ul className="text-xs space-y-1">
                              <li><strong>Pendente:</strong> {STATUS_DESCRIPTIONS.pending}</li>
                              <li><strong>Em Andamento:</strong> {STATUS_DESCRIPTIONS.in_progress}</li>
                              <li><strong>Concluída:</strong> {STATUS_DESCRIPTIONS.completed}</li>
                              <li><strong>Obsoleta:</strong> {STATUS_DESCRIPTIONS.stale}</li>
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="status-filter">
                        <SelectValue placeholder="Filtrar por status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="in_progress">Em Andamento</SelectItem>
                        <SelectItem value="completed">Concluída</SelectItem>
                        <SelectItem value="stale">Obsoleta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority-filter">Prioridade</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger id="priority-filter">
                        <SelectValue placeholder="Filtrar por prioridade" />
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
                    <div className="flex items-center gap-1">
                      <Label htmlFor="due-date-filter">Vencimento</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">
                              <strong>Atrasadas</strong> mostra apenas tarefas pendentes ou em andamento com vencimento anterior a hoje. Tarefas concluídas ou obsoletas nunca aparecem aqui, mesmo se a data estiver no passado.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                      <SelectTrigger id="due-date-filter">
                        <SelectValue placeholder="Filtrar por vencimento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as datas</SelectItem>
                        <SelectItem value="overdue">Atrasadas</SelectItem>
                        <SelectItem value="today">Vence Hoje</SelectItem>
                        <SelectItem value="week">Esta Semana</SelectItem>
                        <SelectItem value="month">Este Mês</SelectItem>
                        <SelectItem value="specific">Dia específico…</SelectItem>
                        <SelectItem value="range">Intervalo personalizado…</SelectItem>
                      </SelectContent>
                    </Select>
                    {/* BUG #3 FIX: pickers extras quando o usuário escolhe 'specific' ou 'range' */}
                    {dueDateFilter === 'specific' && (
                      <Input
                        type="date"
                        className="mt-2"
                        value={specificDate}
                        onChange={(e) => setSpecificDate(e.target.value)}
                        aria-label="Data específica"
                      />
                    )}
                    {dueDateFilter === 'range' && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Input
                          type="date"
                          value={rangeStartDate}
                          onChange={(e) => setRangeStartDate(e.target.value)}
                          aria-label="Data inicial do intervalo"
                          placeholder="De"
                        />
                        <Input
                          type="date"
                          value={rangeEndDate}
                          onChange={(e) => setRangeEndDate(e.target.value)}
                          aria-label="Data final do intervalo"
                          placeholder="Até"
                        />
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div>
                      <Label htmlFor="assigned-filter">Responsável</Label>
                      <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                        <SelectTrigger id="assigned-filter">
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

                <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="show-deletion-alerts"
                      checked={showDeletionAlerts}
                      onChange={(e) => setShowDeletionAlerts(e.target.checked)}
                      className="rounded border-input h-4 w-4"
                    />
                    <label htmlFor="show-deletion-alerts" className="text-sm text-muted-foreground cursor-pointer">
                      Mostrar alertas de exclusão
                    </label>
                  </div>
                </div>
            </CardContent>
            </Card>

            {/* Lista de Tarefas */}
            <Card>
          <CardHeader>
            <CardTitle>{isAdmin ? 'Todas as Tarefas' : 'Suas Tarefas'}</CardTitle>
            <CardDescription>
              Mostrando {paginatedTasks.length} de {filteredTasks.length} tarefas
              {filteredTasks.length !== visibleTasks.length && ` (${visibleTasks.length} total)`}
              {totalPages > 1 && ` — Página ${currentPage} de ${totalPages}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma tarefa encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedTasks.map((task) => (
                    <Card key={task.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => openTaskDetails(task)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{task.title}</h3>
                              {task.priority && (
                                <Badge className={`${getPriorityColor(task.priority)} text-white border-0`}>
                                  {task.priority.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={getStatusVariant(task.status)}
                              className="flex items-center gap-1"
                            >
                              {getStatusIcon(task.status)}
                              {STATUS_LABELS[normalizeStatus(task.status)]}
                            </Badge>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(task);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {task.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Venc: {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          )}
                          {task.assigned_to && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {task.assigned_to}
                            </span>
                          )}
                          {task.process_number && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {task.process_number}
                            </span>
                          )}
                          {task.task_type && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {task.task_type}
                            </Badge>
                          )}
                          {task.client_name && (
                            <span className="flex items-center gap-1">
                              <UserCircle className="h-3 w-3" />
                              {task.client_name}
                            </span>
                          )}
                          {task.created_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Criada: {format(new Date(task.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          )}
                          {task.completed_at && (
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CalendarCheck className="h-3 w-3" />
                              Concluída: {format(new Date(task.completed_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="min-w-[36px]"
                      >
                        {page}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Aba Calendário */}
          <TabsContent value="calendar">
            <TaskCalendarView 
              tasks={filteredTasks} 
              onTaskClick={openTaskDetails}
            />
          </TabsContent>

          {/* Aba Relatório Semanal (apenas admins) */}
          {isAdmin && (
            <TabsContent value="report">
              <WeeklyTaskReport tasks={tasks} />
            </TabsContent>
          )}

          {/* Aba Regras de Sugestão (apenas admins) */}
          {isAdmin && (
            <TabsContent value="rules">
              <TaskAutoRulesManager 
                taskTypes={[
                  { id: 1, title: 'Tarefa Geral' },
                  { id: 2, title: 'Audiência' },
                  { id: 3, title: 'Prazo' },
                  { id: 4, title: 'Intimação' },
                  { id: 5, title: 'Sentença' },
                  { id: 6, title: 'Recurso' },
                  { id: 7, title: 'Despacho' },
                  { id: 8, title: 'Petição' },
                ]}
                advboxUsers={allUsers.map(u => ({ id: u.id, name: u.full_name }))}
              />
            </TabsContent>
          )}

          {/* Aba Configurações de Notificação */}
          <TabsContent value="settings">
            <TaskNotificationSettings />
          </TabsContent>

          {/* Aba Produtividade */}
          <TabsContent value="produtividade">
            <RelatoriosProdutividadeTarefas embedded />
          </TabsContent>
        </Tabs>

        {/* Dialog de Edição de Tarefa (Admin) */}
        {isAdmin && editTask && (
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Editar Tarefa</DialogTitle>
                <DialogDescription>Atualize os campos da tarefa</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 overflow-y-auto pr-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-title">Título *</Label>
                  <Input
                    id="edit-title"
                    value={editTask.title}
                    onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                    placeholder="Título da tarefa"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Descrição</Label>
                  <Textarea
                    id="edit-description"
                    value={editTask.description || ''}
                    onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
                    placeholder="Descrição da tarefa"
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-process_number">Número do Processo</Label>
                  <Input
                    id="edit-process_number"
                    value={editTask.process_number || ''}
                    onChange={(e) => setEditTask({ ...editTask, process_number: e.target.value })}
                    placeholder="Ex: 1234567-89.2023.8.26.0100"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">Categoria</Label>
                  <Select
                    value={editTask.category || 'none'}
                    onValueChange={(value) =>
                      setEditTask({ ...editTask, category: value === 'none' ? '' : value })
                    }
                  >
                    <SelectTrigger id="edit-category">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="intimacao">Intimação</SelectItem>
                      <SelectItem value="audiencia">Audiência</SelectItem>
                      <SelectItem value="prazo">Prazo</SelectItem>
                      <SelectItem value="recurso">Recurso</SelectItem>
                      <SelectItem value="sentenca">Sentença</SelectItem>
                      <SelectItem value="despacho">Despacho</SelectItem>
                      <SelectItem value="peticao">Petição</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-assigned_to">Responsável</Label>
                  <Select
                    value={editTask.assigned_to || 'none'}
                    onValueChange={(value) =>
                      setEditTask({
                        ...editTask,
                        assigned_to: value === 'none' ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger id="edit-assigned_to">
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {allUsers.map((user) => (
                        <SelectItem key={user.id} value={user.full_name}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-due_date">Data de Vencimento</Label>
                  <Input
                    id="edit-due_date"
                    type="date"
                    value={editTask.due_date || ''}
                    onChange={(e) => setEditTask({ ...editTask, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editTask.status}
                    onValueChange={(value) => setEditTask({ ...editTask, status: value })}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-notes">Observações</Label>
                  <Textarea
                    id="edit-notes"
                    value={editTask.notes || ''}
                    onChange={(e) => setEditTask({ ...editTask, notes: e.target.value })}
                    placeholder="Observações adicionais"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleEditTask} className="flex-1">
                    Salvar Alterações
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}

        {/* Dialog de Prioridade */}
        <Dialog open={priorityDialogOpen} onOpenChange={setPriorityDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Definir Prioridade</DialogTitle>
              <DialogDescription>Escolha a prioridade para esta tarefa</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="priority">Prioridade</Label>
                <Select
                  value={selectedPriority}
                  onValueChange={(value: 'alta' | 'media' | 'baixa') => setSelectedPriority(value)}
                >
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        Alta
                      </div>
                    </SelectItem>
                    <SelectItem value="media">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        Média
                      </div>
                    </SelectItem>
                    <SelectItem value="baixa">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        Baixa
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSetPriority} className="w-full">
                Salvar Prioridade
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Detalhes da Tarefa com Comentários, Anexos e Histórico */}
        {isMobile ? (
          <Drawer open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  {selectedTask?.title}
                  {selectedTask?.priority && (
                    <Badge className={`${getPriorityColor(selectedTask.priority)} text-white border-0`}>
                      {selectedTask.priority.toUpperCase()}
                    </Badge>
                  )}
                </DrawerTitle>
                <DrawerDescription>{selectedTask?.description}</DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <Tabs defaultValue="comments" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="comments">Comentários</TabsTrigger>
                    <TabsTrigger value="attachments">Anexos</TabsTrigger>
                    <TabsTrigger value="history">Histórico</TabsTrigger>
                  </TabsList>
                  <TabsContent value="comments" className="mt-4">
                    {selectedTask && <TaskComments taskId={selectedTask.id} />}
                  </TabsContent>
                  <TabsContent value="attachments" className="mt-4">
                    {selectedTask && <TaskAttachments taskId={selectedTask.id} />}
                  </TabsContent>
                  <TabsContent value="history" className="mt-4">
                    {selectedTask && <TaskStatusHistory taskId={selectedTask.id} />}
                  </TabsContent>
                </Tabs>
              </div>
              <DrawerFooter>
                <div className="flex gap-2">
                  {selectedTask &&
                    selectedTask.status !== 'completed' &&
                    selectedTask.status !== 'concluída' && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setDetailsOpen(false);
                            openPriorityDialog(selectedTask.id, selectedTask.priority);
                          }}
                          className="flex-1"
                        >
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Prioridade
                        </Button>
                        <Button
                          onClick={() => {
                            handleCompleteTask(selectedTask.id);
                            setDetailsOpen(false);
                          }}
                          className="flex-1"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Concluir
                        </Button>
                      </>
                    )}
                </div>
                <DrawerClose asChild>
                  <Button variant="outline">Fechar</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedTask?.title}
                  {selectedTask?.priority && (
                    <Badge className={`${getPriorityColor(selectedTask.priority)} text-white border-0`}>
                      {selectedTask.priority.toUpperCase()}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>{selectedTask?.description}</DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 overflow-y-auto pr-4">
              <div className="space-y-4">
                {selectedTask && (
                  <div className="space-y-3 pb-4 border-b">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <Badge
                        variant={getStatusVariant(selectedTask.status)}
                        className="flex items-center gap-1"
                      >
                        {getStatusIcon(selectedTask.status)}
                        {selectedTask.status}
                      </Badge>
                      {selectedTask.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Venc: {format(new Date(selectedTask.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      )}
                      {selectedTask.assigned_to && (
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {selectedTask.assigned_to}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedTask.process_number && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="font-medium">Processo:</span> {selectedTask.process_number}
                        </div>
                      )}
                      {selectedTask.task_type && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Tag className="h-3.5 w-3.5" />
                          <span className="font-medium">Tipo:</span> {selectedTask.task_type}
                        </div>
                      )}
                      {selectedTask.client_name && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <UserCircle className="h-3.5 w-3.5" />
                          <span className="font-medium">Cliente:</span> {selectedTask.client_name}
                        </div>
                      )}
                      {selectedTask.lawsuit_id && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="font-medium">Lawsuit ID:</span> {selectedTask.lawsuit_id}
                        </div>
                      )}
                      {selectedTask.created_at && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="font-medium">Criada em:</span> {format(new Date(selectedTask.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      )}
                      {selectedTask.completed_at && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarCheck className="h-3.5 w-3.5" />
                          <span className="font-medium">Concluída em:</span> {format(new Date(selectedTask.completed_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Tabs defaultValue="comments" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="comments">Comentários</TabsTrigger>
                    <TabsTrigger value="attachments">Anexos</TabsTrigger>
                    <TabsTrigger value="history">Histórico</TabsTrigger>
                  </TabsList>
                  <TabsContent value="comments" className="mt-4">
                    {selectedTask && <TaskComments taskId={selectedTask.id} />}
                  </TabsContent>
                  <TabsContent value="attachments" className="mt-4">
                    {selectedTask && <TaskAttachments taskId={selectedTask.id} />}
                  </TabsContent>
                  <TabsContent value="history" className="mt-4">
                    {selectedTask && <TaskStatusHistory taskId={selectedTask.id} />}
                  </TabsContent>
                </Tabs>

                {selectedTask &&
                  selectedTask.status !== 'completed' &&
                  selectedTask.status !== 'concluída' && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDetailsOpen(false);
                          openPriorityDialog(selectedTask.id, selectedTask.priority);
                        }}
                        className="flex-1"
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {selectedTask.priority
                          ? 'Alterar Prioridade'
                          : 'Definir Prioridade'}
                      </Button>
                      <Button
                        onClick={() => {
                          handleCompleteTask(selectedTask.id);
                          setDetailsOpen(false);
                        }}
                        className="flex-1"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Marcar como Concluída
                      </Button>
                    </div>
                  )}
              </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}

