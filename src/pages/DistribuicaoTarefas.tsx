import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Trophy, TrendingDown, TrendingUp, BarChart3, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { TaskCreationForm, TaskFormData } from '@/components/TaskCreationForm';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

type TimeFilter = 'dia' | 'semana' | 'mes' | 'todos';

interface CollaboratorStats {
  name: string;
  pending: number;
  inProgress: number;
  total: number;
}

export default function DistribuicaoTarefas() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('');
  const [processNumber, setProcessNumber] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [advboxTaskTypes, setAdvboxTaskTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [advboxUsers, setAdvboxUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingTaskTypes, setLoadingTaskTypes] = useState(false);
  const [loadingAdvboxUsers, setLoadingAdvboxUsers] = useState(false);
  const [activeProfileNames, setActiveProfileNames] = useState<string[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    fetchTasks();
    fetchActiveProfiles();
    fetchLastSync();
  }, []);

  const fetchLastSync = async () => {
    try {
      const { data } = await supabase
        .from('advbox_tasks_sync_status')
        .select('completed_at')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.completed_at) setLastSyncAt(data.completed_at);
    } catch (e) {
      console.error('Error fetching last sync:', e);
    }
  };

  const formatLastSync = (iso: string | null): string => {
    if (!iso) return 'nunca';
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'agora há pouco';
    if (mins < 60) return `há ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `há ${hours}h`;
    return `há ${Math.floor(hours / 24)}d`;
  };

  const fetchActiveProfiles = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('is_active', true)
        .eq('is_suspended', false)
        .eq('approval_status', 'approved');
      
      setActiveProfileNames((data || []).map(p => p.full_name?.toLowerCase()).filter(Boolean) as string[]);
    } catch (error) {
      console.error('Error fetching active profiles:', error);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const allTasks: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('advbox_tasks')
          .select('advbox_id, title, due_date, status, assigned_users')
          .not('status', 'in', '("completed","stale")')
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (batch && batch.length > 0) {
          allTasks.push(...batch);
          offset += batchSize;
          hasMore = batch.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      setTasks(allTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({ title: 'Erro ao carregar tarefas', variant: 'destructive' });
    } finally {
      setLoading(false);
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

  // Filter tasks by time period
  const filteredTasks = useMemo(() => {
    if (timeFilter === 'todos') return tasks;
    const now = new Date();
    let start: Date, end: Date;

    switch (timeFilter) {
      case 'dia':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'semana':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'mes':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      default:
        return tasks;
    }

    return tasks.filter(t => {
      if (!t.due_date) return false;
      try {
        const d = new Date(t.due_date);
        return isWithinInterval(d, { start, end });
      } catch {
        return false;
      }
    });
  }, [tasks, timeFilter]);

  // Colaboradores que não fazem parte do operacional e devem ser excluídos do ranking
  const excludedCollaborators = useMemo(() => [
    'RAFAEL EGG NUNES',
    'JHONNY SILVA SOUZA',
    'MARCOS LUIZ EGG NUNES',
    'LUCAS MENDES DE PAULA',
    'DANIEL MARTINS SILVA',
    'LETÍCIA CAROLINA PESSOA',
    'TATIANE',
  ].map(n => n.toLowerCase()), []);

  // Group by collaborator
  const collaboratorStats = useMemo((): CollaboratorStats[] => {
    const map = new Map<string, { pending: number; inProgress: number }>();

    filteredTasks.forEach(task => {
      if (!task.assigned_users) return;
      // Split by comma since assigned_users can be "João Silva, Maria Santos"
      const names = task.assigned_users.split(',').map((n: string) => n.trim()).filter(Boolean);
      const isPending = ['pending', 'pendente'].includes(task.status?.toLowerCase());
      const isInProgress = ['in_progress', 'em andamento'].includes(task.status?.toLowerCase());

      names.forEach((name: string) => {
        const nameLower = name.toLowerCase();
        // Excluir colaboradores não-operacionais (hardcoded)
        if (excludedCollaborators.includes(nameLower)) return;
        // Excluir colaboradores inativos/desligados (dinâmico)
        if (activeProfileNames.length > 0 && !activeProfileNames.some(ap => ap.includes(nameLower) || nameLower.includes(ap))) return;

        const current = map.get(name) || { pending: 0, inProgress: 0 };
        if (isPending) current.pending++;
        if (isInProgress) current.inProgress++;
        map.set(name, current);
      });
    });

    return Array.from(map.entries())
      .map(([name, stats]) => ({
        name,
        pending: stats.pending,
        inProgress: stats.inProgress,
        total: stats.pending + stats.inProgress,
      }))
      .sort((a, b) => a.total - b.total);
  }, [filteredTasks, excludedCollaborators, activeProfileNames]);

  const totalTasks = collaboratorStats.reduce((sum, c) => sum + c.total, 0);
  const avgTasks = collaboratorStats.length > 0 ? Math.round(totalTasks / collaboratorStats.length) : 0;
  const leastBusy = collaboratorStats[0];
  const mostBusy = collaboratorStats[collaboratorStats.length - 1];

  const getVolumeBadge = (total: number) => {
    if (total <= avgTasks * 0.6) return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300 dark:text-emerald-400">Leve</Badge>;
    if (total <= avgTasks * 1.3) return <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 dark:text-amber-400">Moderado</Badge>;
    return <Badge className="bg-red-500/20 text-red-700 border-red-300 dark:text-red-400">Alto</Badge>;
  };

  const handleOpenCreateTask = (collaboratorName: string) => {
    setSelectedCollaborator(collaboratorName);
    setProcessNumber('');
    setDialogOpen(true);
    // Pre-fetch task types and users if not already loaded
    if (advboxTaskTypes.length === 0) fetchAdvboxTaskTypes();
    if (advboxUsers.length === 0) fetchAdvboxUsers();
  };

  // Find advbox user id by name for pre-fill
  const prefillUserId = useMemo(() => {
    if (!selectedCollaborator || advboxUsers.length === 0) return null;
    const found = advboxUsers.find(u =>
      u.name.toLowerCase().includes(selectedCollaborator.toLowerCase()) ||
      selectedCollaborator.toLowerCase().includes(u.name.toLowerCase())
    );
    return found ? String(found.id) : null;
  }, [selectedCollaborator, advboxUsers]);

  const handleCreateTask = async (taskData: any) => {
    if (!processNumber.trim()) {
      toast({
        title: 'Número do processo obrigatório',
        description: 'Informe o número do processo para criar a tarefa no Advbox.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingTask(true);
    try {
      const { data: lawsuitsData, error: lawsuitsError } = await supabase.functions.invoke('advbox-integration/lawsuits');
      if (lawsuitsError) throw lawsuitsError;

      const lawsuits = (lawsuitsData as any)?.data || lawsuitsData || [];
      const lawsuit = (lawsuits as any[]).find((l: any) => l.process_number === processNumber.trim());

      if (!lawsuit) throw new Error('Processo não encontrado no Advbox');

      taskData.lawsuits_id = parseInt(String(lawsuit.id), 10);

      const { error } = await supabase.functions.invoke('advbox-integration/create-task', {
        body: taskData,
      });
      if (error) throw error;

      toast({ title: 'Tarefa criada', description: `Tarefa criada com sucesso para ${selectedCollaborator}.` });
      setDialogOpen(false);
      setProcessNumber('');
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
  };

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <ShieldAlert className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground">Esta página é visível apenas para administradores.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Distribuição de Tarefas
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Ranking de carga de trabalho por colaborador
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Última sincronização ADVBox: {formatLastSync(lastSyncAt)}
            </p>
          </div>

          <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
            <TabsList>
              <TabsTrigger value="dia">Dia</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
              <TabsTrigger value="todos">Todos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Tarefas Ativas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalTasks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Média por Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {avgTasks}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mais Livre</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                {leastBusy ? `${leastBusy.name} (${leastBusy.total})` : '—'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mais Carregado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {mostBusy ? `${mostBusy.name} (${mostBusy.total})` : '—'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ranking Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Ranking de Colaboradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : collaboratorStats.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma tarefa encontrada para o período selecionado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="text-center">Pendentes</TableHead>
                    <TableHead className="text-center">Em Andamento</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Volume</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collaboratorStats.map((collab, index) => (
                    <TableRow key={collab.name} className="hover:bg-muted/50">
                      <TableCell className="font-bold text-muted-foreground">
                        {index === 0 && collaboratorStats.length > 1 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{collab.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">{collab.pending}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono">{collab.inProgress}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-foreground">{collab.total}</span>
                      </TableCell>
                      <TableCell className="text-center">{getVolumeBadge(collab.total)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenCreateTask(collab.name)}
                          className="gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Criar Tarefa
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Task Creation Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Tarefa para {selectedCollaborator}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="processNumber">Número do Processo *</Label>
                <Input
                  id="processNumber"
                  value={processNumber}
                  onChange={(e) => setProcessNumber(e.target.value)}
                  placeholder="0000000-00.0000.0.00.0000"
                />
              </div>
              <TaskCreationForm
                initialData={{
                  lawsuitId: 0,
                  processNumber: processNumber,
                  title: '',
                  description: '',
                  prefillResponsibleId: prefillUserId,
                }}
                taskTypes={advboxTaskTypes}
                advboxUsers={advboxUsers}
                loadingTaskTypes={loadingTaskTypes}
                loadingUsers={loadingAdvboxUsers}
                onFetchTaskTypes={fetchAdvboxTaskTypes}
                onFetchUsers={fetchAdvboxUsers}
                onSubmit={handleCreateTask}
                onCancel={() => {
                  setDialogOpen(false);
                  setProcessNumber('');
                }}
                isSubmitting={isCreatingTask}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
