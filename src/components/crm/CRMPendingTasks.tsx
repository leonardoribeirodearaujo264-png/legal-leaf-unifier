import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, Clock, CheckCircle2, CalendarX, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PendingTask {
  id: string;
  title: string;
  type: string;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  owner_id: string | null;
  deal_id: string | null;
  contact_id: string | null;
  created_at: string;
  owner_name?: string;
  contact_name?: string;
}

const RESPONSAVEIS: { id: string; name: string }[] = [
  { id: '1eebbf27-a9f8-4877-a10d-aec9279e1fea', name: 'Daniel' },
  { id: 'f83cbef4-8ff7-4168-8e28-6a15f0d2c1f9', name: 'Lucas' },
];

export const CRMPendingTasks = () => {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  useEffect(() => {
    fetchPendingTasks();
  }, []);

  const fetchPendingTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('crm_activities')
        .select('*')
        .eq('completed', false)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Fetch owner names
      const ownerIds = [...new Set((data || []).map(t => t.owner_id).filter(Boolean))];
      let ownerMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ownerIds);
        if (profiles) {
          profiles.forEach(p => { ownerMap[p.id] = p.full_name || 'Sem nome'; });
        }
      }

      // Fetch contact names
      const contactIds = [...new Set((data || []).map(t => t.contact_id).filter(Boolean))];
      let contactMap: Record<string, string> = {};
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, name')
          .in('id', contactIds);
        if (contacts) {
          contacts.forEach(c => { contactMap[c.id] = c.name; });
        }
      }

      const enriched = (data || []).map(t => ({
        ...t,
        owner_name: t.owner_id ? ownerMap[t.owner_id] : undefined,
        contact_name: t.contact_id ? contactMap[t.contact_id] : undefined,
      }));

      setTasks(enriched);
    } catch (error: any) {
      console.error('Error fetching pending tasks:', error);
      toast.error('Erro ao carregar pendências');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('crm_activities')
        .update({ completed: true, completed_at: new Date().toISOString(), status: 'completed' })
        .eq('id', taskId);
      if (error) throw error;
      toast.success('Tarefa concluída!');
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (error: any) {
      toast.error('Erro ao concluir tarefa');
    }
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);

  const isOverdue = (t: PendingTask) => t.due_date && new Date(t.due_date) < startOfToday;
  const isDueToday = (t: PendingTask) => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d >= startOfToday && d < endOfToday;
  };

  const filtered = tasks.filter(t => {
    if (filterOwner !== 'all' && t.owner_id !== filterOwner) return false;
    if (filterPriority !== 'all' && (t.priority || 'medium') !== filterPriority) return false;
    return true;
  });

  // Sort: overdue first, then today, then by due_date
  const sorted = [...filtered].sort((a, b) => {
    const aOver = isOverdue(a) ? 0 : isDueToday(a) ? 1 : 2;
    const bOver = isOverdue(b) ? 0 : isDueToday(b) ? 1 : 2;
    if (aOver !== bOver) return aOver - bOver;
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const totalPending = filtered.length;
  const totalOverdue = filtered.filter(isOverdue).length;
  const totalToday = filtered.filter(isDueToday).length;
  const totalNoDate = filtered.filter(t => !t.due_date).length;

  // Unique owners for filter
  const uniqueOwners = [...new Set(tasks.map(t => t.owner_id).filter(Boolean))] as string[];
  const ownerOptions = uniqueOwners.map(id => {
    const known = RESPONSAVEIS.find(r => r.id === id);
    const task = tasks.find(t => t.owner_id === id);
    return { id, name: known?.name || task?.owner_name || 'Desconhecido' };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
              <span className="text-sm font-medium text-destructive">Atrasadas</span>
            </div>
            <p className="text-3xl font-bold text-destructive mt-1">{totalOverdue}</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-700">Vencem Hoje</span>
            </div>
            <p className="text-3xl font-bold text-yellow-700 mt-1">{totalToday}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CalendarX className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Sem Data</span>
            </div>
            <p className="text-3xl font-bold mt-1">{totalNoDate}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Total Pendentes</span>
            </div>
            <p className="text-3xl font-bold mt-1">{totalPending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Responsável:</span>
          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ownerOptions.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Prioridade:</span>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPendingTasks}>
          Atualizar
        </Button>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium text-green-700">Nenhuma pendência!</p>
            <p className="text-sm text-muted-foreground">Todas as tarefas estão em dia.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Data Limite</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(task => {
                const overdue = isOverdue(task);
                const today = isDueToday(task);
                return (
                  <TableRow
                    key={task.id}
                    className={
                      overdue
                        ? 'bg-destructive/10 hover:bg-destructive/15'
                        : today
                        ? 'bg-yellow-500/10 hover:bg-yellow-500/15'
                        : ''
                    }
                  >
                    <TableCell className="font-medium max-w-[250px] truncate">{task.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{task.type || 'tarefa'}</Badge>
                    </TableCell>
                    <TableCell>{task.owner_name || '—'}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{task.contact_name || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                          : '—'}
                        {overdue && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 animate-pulse">
                            ATRASADA
                          </Badge>
                        )}
                        {today && (
                          <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0">
                            HOJE
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          (task.priority || 'medium') === 'high'
                            ? 'border-destructive text-destructive'
                            : (task.priority || 'medium') === 'low'
                            ? 'border-muted-foreground text-muted-foreground'
                            : ''
                        }
                      >
                        {(task.priority || 'medium') === 'high' ? 'Alta' : (task.priority || 'medium') === 'low' ? 'Baixa' : 'Média'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground capitalize">{task.status || 'pendente'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => handleComplete(task.id)} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Concluir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
