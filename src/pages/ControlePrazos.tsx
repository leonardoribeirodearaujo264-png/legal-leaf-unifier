import { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, CheckCircle2, AlertTriangle, Clock, CalendarIcon, Filter, FileSpreadsheet, FileText, Plus, Search, Loader2, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { parseLocalDate, formatLocalDate } from '@/lib/dateUtils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Keywords that identify procedural deadlines (inclusion logic)
const INCLUDED_TASK_KEYWORDS = [
  'PETIÇÃO', 'PROTOCOLO', 'EMBARGOS', 'IMPUGNAÇÃO', 'CONTRARRAZÕES',
  'RECURSO', 'APELAÇÃO', 'AGRAVO', 'CUMPRIMENTO DE SENTENÇA',
  'MANIFESTAÇÃO', 'ALEGAÇÕES FINAIS', 'CONTRAMINUTA', 'AUDIÊNCIA',
  'DISTRIBUIÇÃO', 'EMENDA À INICIAL', 'COMPLEMENTAÇÃO', 'ANÁLISE DE DECISÃO',
  'ELABORAÇÃO DE CÁLCULO', 'AVALIAR DOCUMENTAÇÃO', 'REQUERIMENTO',
  'SUSTENTAÇÃO ORAL', 'PREPARAR SUSTENTAÇÃO', 'INSTRUIR DOCUMENTOS',
  'PRECATÓRIO', 'CORREÇÃO PEQUENA', 'REVISÃO DE PETIÇÃO',
  'PESQUISA DE JURISPRUDÊNCIA', 'ANÁLISE DE CASO', 'GUIA DE CUSTAS',
  'DEPÓSITO JUDICIAL', 'PREPARAR TESTEMUNHA', 'CARTA DE INTIMAÇÃO',
  'INTIMAÇÃO DE TESTEMUNHA',
];

interface AdvboxTask {
  id: string;
  advbox_id: number;
  title: string;
  task_type: string | null;
  due_date: string | null;
  status: string;
  assigned_users: string | null;
  process_number: string | null;
  raw_data: any;
  completed_at: string | null;
}

interface PrazoVerificacao {
  id: string;
  advbox_task_id: string;
  verificado_por: string | null;
  verificado_em: string;
  observacoes: string | null;
  status: string;
}

interface ProcessedTask extends AdvboxTask {
  data_publicacao: string | null;
  prazo_interno: string | null;
  prazo_fatal: string | null;
  verificacao: PrazoVerificacao | null;
  cliente_nome: string | null;
  is_manual?: boolean;
}

interface AdvboxClient {
  id: number;
  name: string;
}

const PAGE_SIZE = 50;

const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const isPrazoVencido = (task: ProcessedTask): boolean => {
  if (!task.prazo_fatal) return false;
  if (task.status === 'completed') return false;
  if (task.verificacao?.status === 'verificado') return false;
  const todayStr = getTodayStr();
  const prazoStr = task.prazo_fatal.substring(0, 10);
  return prazoStr < todayStr;
};

export default function ControlePrazos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<AdvboxTask[]>([]);
  const [manualTasks, setManualTasks] = useState<any[]>([]);
  const [verificacoes, setVerificacoes] = useState<PrazoVerificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProcessedTask | null>(null);
  const [verifyObservacoes, setVerifyObservacoes] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'verificado' | 'com_pendencia'>('verificado');
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkVerifyOpen, setBulkVerifyOpen] = useState(false);
  const [bulkVerifyStatus, setBulkVerifyStatus] = useState<'verificado' | 'com_pendencia'>('verificado');
  const [bulkVerifyObs, setBulkVerifyObs] = useState('');
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  // New Prazo Dialog
  const [newPrazoOpen, setNewPrazoOpen] = useState(false);
  const [savingPrazo, setSavingPrazo] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<AdvboxClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [syncingClients, setSyncingClients] = useState(false);
  const [newPrazo, setNewPrazo] = useState({
    cliente_nome: '',
    cliente_advbox_id: null as number | null,
    process_number: '',
    task_type: '',
    titulo: '',
    prazo_interno: undefined as Date | undefined,
    prazo_fatal: undefined as Date | undefined,
    advogado_responsavel: '',
    observacoes: '',
  });

  // Filters
  const [filterAdvogado, setFilterAdvogado] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTipoTarefa, setFilterTipoTarefa] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterPrazoFatalFrom, setFilterPrazoFatalFrom] = useState<Date | undefined>(undefined);
  const [filterPrazoFatalTo, setFilterPrazoFatalTo] = useState<Date | undefined>(undefined);
  const [filterEventoFrom, setFilterEventoFrom] = useState<Date | undefined>(undefined);
  const [filterEventoTo, setFilterEventoTo] = useState<Date | undefined>(undefined);
  const [filterCliente, setFilterCliente] = useState('');
  const [filterProcesso, setFilterProcesso] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  // Client search effect
  useEffect(() => {
    if (clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingClients(true);
      try {
        const normalizedSearch = clientSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const { data, error } = await supabase
          .from('advbox_customers')
          .select('advbox_id, name')
          .or(`name.ilike.%${clientSearch}%,name.ilike.%${normalizedSearch}%`)
          .order('name')
          .limit(50);
        if (error) throw error;
        setClientResults((data || []).map(c => ({ id: c.advbox_id, name: c.name })).filter(c => c.id && c.name));
      } catch (error) {
        console.error('Error searching clients:', error);
      } finally {
        setLoadingClients(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const fetchAllTasks = async (): Promise<AdvboxTask[]> => {
    const batchSize = 1000;
    let allTasks: AdvboxTask[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('advbox_tasks')
        .select('id, advbox_id, title, task_type, due_date, status, assigned_users, process_number, raw_data, completed_at')
        .order('due_date', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      allTasks = allTasks.concat((data as AdvboxTask[]) || []);
      hasMore = (data?.length || 0) === batchSize;
      offset += batchSize;
    }
    return allTasks;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allTasks, verificacoesRes, manuaisRes] = await Promise.all([
        fetchAllTasks(),
        supabase.from('prazo_verificacoes').select('*'),
        supabase.from('prazos_manuais').select('*').order('created_at', { ascending: false }),
      ]);

      if (verificacoesRes.error) throw verificacoesRes.error;
      if (manuaisRes.error) throw manuaisRes.error;

      setTasks(allTasks);
      setVerificacoes((verificacoesRes.data as PrazoVerificacao[]) || []);
      setManualTasks(manuaisRes.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-advbox-tasks', {
        body: { sync_type: 'full' },
      });
      if (error) throw error;
      toast({
        title: 'Sincronização concluída',
        description: `${data?.total_upserted || 0} tarefas sincronizadas do ADVBox.`,
      });
      await fetchData();
    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      toast({ title: 'Erro na sincronização', description: error.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncClients = async () => {
    setSyncingClients(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Não autenticado');
      const response = await supabase.functions.invoke('sync-advbox-customers', {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });
      const result = response.data;
      if (result?.status === 'partial') {
        toast({ title: `${result.total_upserted} clientes sincronizados. Clique novamente para continuar.` });
      } else {
        toast({ title: 'Clientes sincronizados do ADVBox' });
      }
      // Re-trigger search
      if (clientSearch.length >= 2) {
        setClientSearch(prev => prev + ' ');
        setTimeout(() => setClientSearch(prev => prev.trim()), 50);
      }
    } catch (error: any) {
      toast({ title: 'Erro ao sincronizar clientes', description: error.message, variant: 'destructive' });
    } finally {
      setSyncingClients(false);
    }
  };

  const handleDirectVerify = async (task: ProcessedTask) => {
    if (!user) return;
    setVerifyingId(task.advbox_id);
    try {
      const { data, error } = await supabase.from('prazo_verificacoes').insert({
        advbox_task_id: String(task.advbox_id),
        verificado_por: user.id,
        status: 'verificado',
        observacoes: null,
      }).select();
      if (error) throw error;
      if (data && data[0]) {
        setVerificacoes(prev => [...prev, data[0] as PrazoVerificacao]);
      }
      toast({ title: 'Prazo verificado ✅' });
    } catch (error: any) {
      toast({ title: 'Erro ao verificar', description: error.message, variant: 'destructive' });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleVerify = async () => {
    if (!selectedTask || !user) return;
    try {
      const { data, error } = await supabase.from('prazo_verificacoes').insert({
        advbox_task_id: String(selectedTask.advbox_id),
        verificado_por: user.id,
        status: verifyStatus,
        observacoes: verifyObservacoes || null,
      }).select();
      if (error) throw error;
      if (data && data[0]) {
        setVerificacoes(prev => [...prev, data[0] as PrazoVerificacao]);
      }
      toast({ title: verifyStatus === 'verificado' ? 'Prazo verificado' : 'Pendência registrada' });
      setVerifyDialogOpen(false);
      setVerifyObservacoes('');
      setVerifyStatus('verificado');
      setSelectedTask(null);
    } catch (error: any) {
      toast({ title: 'Erro ao registrar verificação', description: error.message, variant: 'destructive' });
    }
  };
  const handleUndoVerify = async (task: ProcessedTask) => {
    if (!task.verificacao || !user) return;
    setVerifyingId(task.advbox_id);
    try {
      const { error } = await supabase.from('prazo_verificacoes').delete().eq('id', task.verificacao.id);
      if (error) throw error;
      setVerificacoes(prev => prev.filter(v => v.id !== task.verificacao!.id));
      toast({ title: 'Verificação desfeita' });
    } catch (error: any) {
      toast({ title: 'Erro ao desfazer', description: error.message, variant: 'destructive' });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSaveNewPrazo = async () => {
    if (!newPrazo.cliente_nome || !newPrazo.task_type || !newPrazo.titulo) {
      toast({ title: 'Preencha os campos obrigatórios: Cliente, Tipo de Tarefa e Título', variant: 'destructive' });
      return;
    }
    setSavingPrazo(true);
    try {
      const { error } = await supabase.from('prazos_manuais').insert({
        cliente_nome: newPrazo.cliente_nome,
        cliente_advbox_id: newPrazo.cliente_advbox_id,
        process_number: newPrazo.process_number || null,
        task_type: newPrazo.task_type,
        titulo: newPrazo.titulo,
        prazo_interno: newPrazo.prazo_interno ? format(newPrazo.prazo_interno, 'yyyy-MM-dd') : null,
        prazo_fatal: newPrazo.prazo_fatal ? format(newPrazo.prazo_fatal, 'yyyy-MM-dd') : null,
        advogado_responsavel: newPrazo.advogado_responsavel || null,
        observacoes: newPrazo.observacoes || null,
        created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: 'Prazo cadastrado com sucesso!' });
      setNewPrazoOpen(false);
      resetNewPrazoForm();
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Erro ao cadastrar prazo', description: error.message, variant: 'destructive' });
    } finally {
      setSavingPrazo(false);
    }
  };

  const resetNewPrazoForm = () => {
    setNewPrazo({
      cliente_nome: '',
      cliente_advbox_id: null,
      process_number: '',
      task_type: '',
      titulo: '',
      prazo_interno: undefined,
      prazo_fatal: undefined,
      advogado_responsavel: '',
      observacoes: '',
    });
    setClientSearch('');
    setClientResults([]);
  };

  const selectClient = (client: AdvboxClient) => {
    setNewPrazo(prev => ({ ...prev, cliente_nome: client.name, cliente_advbox_id: client.id }));
    setClientSearch(client.name);
    setClientResults([]);
  };

  const openVerifyDialog = (task: ProcessedTask) => {
    setSelectedTask(task);
    setVerifyObservacoes('');
    setVerifyStatus('verificado');
    setVerifyDialogOpen(true);
  };


  // Process tasks: filter excluded types, extract dates from raw_data, match verificacoes
  const processedTasks: ProcessedTask[] = useMemo(() => {
    const verificacaoMap = new Map<string, PrazoVerificacao>();
    verificacoes.forEach(v => {
      const existing = verificacaoMap.get(v.advbox_task_id);
      if (!existing || new Date(v.verificado_em) > new Date(existing.verificado_em)) {
        verificacaoMap.set(v.advbox_task_id, v);
      }
    });

    const advboxProcessed = tasks
      .filter(task => {
        const taskType = (task.task_type || task.title || '').toUpperCase();
        if (!INCLUDED_TASK_KEYWORDS.some(keyword => taskType.includes(keyword))) return false;
        const assignedUsers = task.assigned_users || '';
        const users = assignedUsers.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
        if (users.length > 0 && users.every(u => u.includes('mariana'))) return false;
        return true;
      })
      .map(task => {
        const rawData = task.raw_data || {};
        const customers = rawData.lawsuit?.customers || [];
        const clienteName = customers.length > 0 ? customers[0].name : null;
        return {
          ...task,
          data_publicacao: rawData.created_at || null,
          prazo_interno: rawData.date || null,
          prazo_fatal: rawData.date_deadline || task.due_date || null,
          verificacao: verificacaoMap.get(String(task.advbox_id)) || null,
          cliente_nome: clienteName,
          is_manual: false,
        };
      });

    // Convert manual tasks to ProcessedTask format
    const manualProcessed: ProcessedTask[] = manualTasks.map(mt => ({
      id: mt.id,
      advbox_id: 0,
      title: mt.titulo,
      task_type: mt.task_type,
      due_date: mt.prazo_fatal,
      status: mt.status === 'concluido' ? 'completed' : 'pending',
      assigned_users: mt.advogado_responsavel,
      process_number: mt.process_number,
      raw_data: null,
      completed_at: null,
      data_publicacao: mt.created_at,
      prazo_interno: mt.prazo_interno,
      prazo_fatal: mt.prazo_fatal,
      verificacao: verificacaoMap.get(mt.id) || null,
      cliente_nome: mt.cliente_nome,
      is_manual: true,
    }));

    return [...advboxProcessed, ...manualProcessed];
  }, [tasks, verificacoes, manualTasks]);

  // Get unique lawyers for filter dropdown
  const advogados = useMemo(() => {
    const set = new Set<string>();
    processedTasks.forEach(t => {
      if (t.assigned_users) {
        t.assigned_users.split(',').map(u => u.trim()).filter(Boolean).forEach(u => set.add(u));
      }
    });
    return Array.from(set).sort();
  }, [processedTasks]);

  // Get unique task types for filter dropdown
  const tiposTarefa = useMemo(() => {
    const set = new Set<string>();
    processedTasks.forEach(t => {
      if (t.task_type) set.add(t.task_type);
    });
    return Array.from(set).sort();
  }, [processedTasks]);

  // Apply filters
  const filteredTasks = useMemo(() => {
    return processedTasks.filter(task => {
      if (filterAdvogado !== 'all') {
        const users = (task.assigned_users || '').split(',').map(u => u.trim());
        if (!users.includes(filterAdvogado)) return false;
      }
      if (filterTipoTarefa !== 'all') {
        if ((task.task_type || '') !== filterTipoTarefa) return false;
      }
      if (filterStatus !== 'all') {
        if (filterStatus === 'pendente' && task.verificacao) return false;
        if (filterStatus === 'verificado' && task.verificacao?.status !== 'verificado') return false;
        if (filterStatus === 'com_pendencia' && task.verificacao?.status !== 'com_pendencia') return false;
        if (filterStatus === 'vencido' && !isPrazoVencido(task)) return false;
      }
      if (filterDateFrom && task.data_publicacao) {
        const pubDate = new Date(task.data_publicacao);
        if (pubDate < filterDateFrom) return false;
      }
      if (filterDateTo && task.data_publicacao) {
        const pubDate = new Date(task.data_publicacao);
        const endOfDay = new Date(filterDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (pubDate > endOfDay) return false;
      }
      if (filterPrazoFatalFrom && task.prazo_fatal) {
        const fatalDate = new Date(task.prazo_fatal);
        if (fatalDate < filterPrazoFatalFrom) return false;
      }
      if (filterPrazoFatalTo && task.prazo_fatal) {
        const fatalDate = new Date(task.prazo_fatal);
        const endOfDay = new Date(filterPrazoFatalTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (fatalDate > endOfDay) return false;
      }
      if (filterEventoFrom && task.prazo_interno) {
        const eventoDate = new Date(task.prazo_interno);
        if (eventoDate < filterEventoFrom) return false;
      }
      if (filterEventoTo && task.prazo_interno) {
        const eventoDate = new Date(task.prazo_interno);
        const endOfDay = new Date(filterEventoTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (eventoDate > endOfDay) return false;
      }
      if (filterCliente.trim()) {
        const q = filterCliente.toLowerCase().trim();
        if (!(task.cliente_nome || '').toLowerCase().includes(q)) return false;
      }
      if (filterProcesso.trim()) {
        const q = filterProcesso.replace(/\D/g, '');
        const proc = (task.process_number || '').replace(/\D/g, '');
        if (q && !proc.includes(q)) return false;
      }
      return true;
    });
  }, [processedTasks, filterAdvogado, filterTipoTarefa, filterStatus, filterDateFrom, filterDateTo, filterPrazoFatalFrom, filterPrazoFatalTo, filterEventoFrom, filterEventoTo, filterCliente, filterProcesso]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [filterAdvogado, filterTipoTarefa, filterStatus, filterDateFrom, filterDateTo, filterPrazoFatalFrom, filterPrazoFatalTo, filterEventoFrom, filterEventoTo, filterCliente, filterProcesso]);

  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE);
  const paginatedTasks = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredTasks.slice(start, start + PAGE_SIZE);
  }, [filteredTasks, currentPage]);

  // Bulk selection helpers
  const verifiableTasks = useMemo(() => {
    return paginatedTasks.filter(t => t.status !== 'completed' && !t.is_manual);
  }, [paginatedTasks]);

  const allPageSelected = verifiableTasks.length > 0 && verifiableTasks.every(t => selectedIds.has(String(t.advbox_id)));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        verifiableTasks.forEach(t => next.delete(String(t.advbox_id)));
      } else {
        verifiableTasks.forEach(t => next.add(String(t.advbox_id)));
      }
      return next;
    });
  };

  const toggleSelect = (advboxId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(advboxId)) next.delete(advboxId);
      else next.add(advboxId);
      return next;
    });
  };

  const handleBulkVerify = async () => {
    if (!user || selectedIds.size === 0) return;
    setBulkVerifying(true);
    try {
      const records = Array.from(selectedIds).map(id => ({
        advbox_task_id: id,
        verificado_por: user.id,
        status: bulkVerifyStatus,
        observacoes: bulkVerifyObs || null,
      }));
      const { data, error } = await supabase.from('prazo_verificacoes').insert(records).select();
      if (error) throw error;
      if (data) {
        setVerificacoes(prev => [...prev, ...(data as PrazoVerificacao[])]);
      }
      toast({ title: `${records.length} prazos verificados em bloco` });
      setBulkVerifyOpen(false);
      setBulkVerifyObs('');
      setBulkVerifyStatus('verificado');
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({ title: 'Erro na verificação em bloco', description: error.message, variant: 'destructive' });
    } finally {
      setBulkVerifying(false);
    }
  };

  const getVerificacaoBadge = (task: ProcessedTask) => {
    if (task.is_manual) {
      return (
        <div className="flex items-center gap-1">
          <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300">Manual</Badge>
        </div>
      );
    }
    if (task.status === 'completed') {
      return <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300">Concluída no ADVBox</Badge>;
    }
    if (!task.verificacao && isPrazoVencido(task)) {
      return <Badge className="bg-red-600 text-white border-red-600">⚠ VENCIDO</Badge>;
    }
    if (!task.verificacao) {
      return <Badge variant="outline" className="border-yellow-400 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20">Pendente</Badge>;
    }
    if (task.verificacao.status === 'verificado') {
      return <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-300">Verificado</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-300">Com Pendência</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      if (dateStr.includes('T') || dateStr.length > 10) {
        return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
      }
      return formatLocalDate(dateStr);
    } catch {
      return dateStr;
    }
  };

  const getTaskStatusLabel = (task: ProcessedTask): string => {
    if (task.is_manual) return 'Manual';
    if (task.status === 'completed') return 'Concluída no ADVBox';
    if (!task.verificacao && isPrazoVencido(task)) return 'VENCIDO';
    if (!task.verificacao) return 'Pendente';
    if (task.verificacao.status === 'verificado') return 'Verificado';
    return 'Com Pendência';
  };

  // Export helpers
  const getExportData = useCallback(() => {
    return filteredTasks.map(task => ({
      'Cliente': task.cliente_nome || '-',
      'Nº Processo': task.process_number || 'Sem número',
      'Tarefa': task.title,
      'Tipo': task.task_type || '-',
      'Advogado': task.assigned_users || 'Sem responsável',
      'Data Publicação': formatDate(task.data_publicacao),
      'Prazo Interno': formatDate(task.prazo_interno),
      'Prazo Fatal': formatDate(task.prazo_fatal),
      'Status': getTaskStatusLabel(task),
    }));
  }, [filteredTasks]);

  const handleExportExcel = useCallback(() => {
    const data = getExportData();
    if (data.length === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Controle de Prazos');
    const colWidths = Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String((row as any)[key]).length)) + 2
    }));
    ws['!cols'] = colWidths;
    XLSX.writeFile(wb, `controle-prazos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Excel exportado com sucesso' });
  }, [getExportData, toast]);

  const handleExportPDF = useCallback(() => {
    const data = getExportData();
    if (data.length === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text('Controle de Prazos — Coordenação', 14, 15);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })} | Total: ${data.length} tarefas`, 14, 22);

    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => (row as any)[h]));

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 27,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [41, 65, 122], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === headers.indexOf('Status')) {
          const val = String(data.cell.raw);
          if (val === 'VENCIDO') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    doc.save(`controle-prazos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF exportado com sucesso' });
  }, [getExportData, toast]);

  // Stats
  const totalPendentes = processedTasks.filter(t => !t.verificacao && t.status !== 'completed' && !t.is_manual).length;
  const totalVerificados = processedTasks.filter(t => t.verificacao?.status === 'verificado').length;
  const totalComPendencia = processedTasks.filter(t => t.verificacao?.status === 'com_pendencia').length;
  const totalConcluidas = processedTasks.filter(t => t.status === 'completed').length;
  const totalVencidos = processedTasks.filter(t => isPrazoVencido(t)).length;

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Controle de Prazos — Coordenação</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Acompanhamento de prazos processuais das tarefas do ADVBox
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => { resetNewPrazoForm(); setNewPrazoOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Prazo
            </Button>
            <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? 'Sincronizando...' : 'Sincronizar ADVBox'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{totalPendentes}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(totalVencidos > 0 && "border-red-400 dark:border-red-600")}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{totalVencidos}</p>
                  <p className="text-xs text-muted-foreground">Prazos Vencidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{totalVerificados}</p>
                  <p className="text-xs text-muted-foreground">Verificados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{totalComPendencia}</p>
                  <p className="text-xs text-muted-foreground">Com Pendência</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{totalConcluidas}</p>
                  <p className="text-xs text-muted-foreground">Concluídas ADVBox</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros</span>
            </div>
             <div className="space-y-3">
              {/* Linha 1: Selects + textos */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <Select value={filterAdvogado} onValueChange={setFilterAdvogado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Advogado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os advogados</SelectItem>
                    {advogados.map(adv => (
                      <SelectItem key={adv} value={adv}>{adv}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterTipoTarefa} onValueChange={setFilterTipoTarefa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de Tarefa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {tiposTarefa.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="vencido">⚠ Vencido</SelectItem>
                    <SelectItem value="verificado">Verificado</SelectItem>
                    <SelectItem value="com_pendencia">Com Pendência</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Cliente"
                  value={filterCliente}
                  onChange={(e) => setFilterCliente(e.target.value)}
                />

                <Input
                  placeholder="Nº Processo"
                  value={filterProcesso}
                  onChange={(e) => setFilterProcesso(e.target.value)}
                />
              </div>

              {/* Linha 2: Publicação + Prazo Interno */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal", !filterDateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterDateFrom ? format(filterDateFrom, 'dd/MM/yyyy') : 'Publicação — de'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterDateFrom} onSelect={setFilterDateFrom} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal", !filterDateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterDateTo ? format(filterDateTo, 'dd/MM/yyyy') : 'Publicação — até'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterDateTo} onSelect={setFilterDateTo} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal", !filterEventoFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterEventoFrom ? format(filterEventoFrom, 'dd/MM/yyyy') : 'Prazo Interno — de'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterEventoFrom} onSelect={setFilterEventoFrom} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal", !filterEventoTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterEventoTo ? format(filterEventoTo, 'dd/MM/yyyy') : 'Prazo Interno — até'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterEventoTo} onSelect={setFilterEventoTo} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Linha 3: Prazo Fatal */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal", !filterPrazoFatalFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterPrazoFatalFrom ? format(filterPrazoFatalFrom, 'dd/MM/yyyy') : 'Prazo Fatal — de'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterPrazoFatalFrom} onSelect={setFilterPrazoFatalFrom} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal", !filterPrazoFatalTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterPrazoFatalTo ? format(filterPrazoFatalTo, 'dd/MM/yyyy') : 'Prazo Fatal — até'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterPrazoFatalTo} onSelect={setFilterPrazoFatalTo} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {(filterAdvogado !== 'all' || filterStatus !== 'all' || filterTipoTarefa !== 'all' || filterDateFrom || filterDateTo || filterPrazoFatalFrom || filterPrazoFatalTo || filterEventoFrom || filterEventoTo || filterCliente || filterProcesso) && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setFilterAdvogado('all');
                  setFilterStatus('all');
                  setFilterTipoTarefa('all');
                  setFilterDateFrom(undefined);
                  setFilterDateTo(undefined);
                  setFilterPrazoFatalFrom(undefined);
                  setFilterPrazoFatalTo(undefined);
                  setFilterEventoFrom(undefined);
                  setFilterEventoTo(undefined);
                  setFilterCliente('');
                  setFilterProcesso('');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {/* Bulk verify bar */}
            {selectedIds.size > 0 && (
              <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                <span className="text-sm font-medium">{selectedIds.size} tarefa(s) selecionada(s)</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Limpar seleção</Button>
                  <Button size="sm" onClick={() => { setBulkVerifyObs(''); setBulkVerifyStatus('verificado'); setBulkVerifyOpen(true); }}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Verificar Selecionados
                  </Button>
                </div>
              </div>
            )}
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma tarefa encontrada com os filtros aplicados.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} />
                      </TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Nº Processo</TableHead>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Advogado</TableHead>
                      <TableHead>Data Publicação</TableHead>
                      <TableHead>Prazo Interno</TableHead>
                      <TableHead>Prazo Fatal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTasks.map(task => {
                      const vencido = isPrazoVencido(task);
                      const isVerifiable = task.status !== 'completed' && !task.is_manual;
                      const taskKey = String(task.advbox_id);
                      return (
                        <TableRow
                          key={task.id}
                          className={cn(
                            task.status === 'completed' && 'opacity-60',
                            vencido && 'bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500',
                            task.is_manual && 'bg-purple-50/50 dark:bg-purple-950/10',
                            selectedIds.has(taskKey) && 'bg-primary/5'
                          )}
                        >
                          <TableCell>
                            {isVerifiable ? (
                              <Checkbox
                                checked={selectedIds.has(taskKey)}
                                onCheckedChange={() => toggleSelect(taskKey)}
                              />
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate" title={task.cliente_nome || ''}>
                            {task.cliente_nome || <span className="text-muted-foreground italic">-</span>}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {task.process_number || <span className="text-muted-foreground italic">Sem número</span>}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm" title={task.title}>
                            {task.title}
                          </TableCell>
                          <TableCell className="text-sm">
                            {task.assigned_users || <span className="text-muted-foreground italic">Sem responsável</span>}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(task.data_publicacao)}</TableCell>
                          <TableCell className="text-sm">{formatDate(task.prazo_interno)}</TableCell>
                          <TableCell className={cn("text-sm font-medium", vencido && "text-red-600 dark:text-red-400 font-bold")}>
                            {formatDate(task.prazo_fatal)}
                          </TableCell>
                          <TableCell>{getVerificacaoBadge(task)}</TableCell>
                          <TableCell className="text-right">
                            {isVerifiable && (
                              task.verificacao ? (
                                <div className="flex items-center gap-1 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openVerifyDialog(task)}
                                  >
                                    Rever
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={verifyingId === task.advbox_id}
                                    onClick={() => handleUndoVerify(task)}
                                    title="Desfazer verificação"
                                  >
                                    {verifyingId === task.advbox_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={verifyingId === task.advbox_id}
                                  onClick={() => handleDirectVerify(task)}
                                >
                                  {verifyingId === task.advbox_id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                  Verificar
                                </Button>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="p-3 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Exibindo {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredTasks.length)} de {filteredTasks.length} tarefas (total no banco: {tasks.length})
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {currentPage + 1} de {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>
                    Próxima
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Verify Dialog */}
        <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verificar Prazo</DialogTitle>
              <DialogDescription>
                {selectedTask?.title} — {selectedTask?.process_number || 'Sem nº processo'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Status da verificação</label>
                <Select value={verifyStatus} onValueChange={(v) => setVerifyStatus(v as 'verificado' | 'com_pendencia')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verificado">✅ Verificado — prazo cumprido</SelectItem>
                    <SelectItem value="com_pendencia">⚠️ Com pendência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Observações (opcional)</label>
                <Textarea
                  className="mt-1"
                  placeholder="Anotações sobre a verificação..."
                  value={verifyObservacoes}
                  onChange={(e) => setVerifyObservacoes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleVerify}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Prazo Dialog */}
        <Dialog open={newPrazoOpen} onOpenChange={setNewPrazoOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Prazo</DialogTitle>
              <DialogDescription>
                Cadastre um prazo manualmente. O número do processo é opcional.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Client search */}
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente do ADVBox (mín. 2 caracteres)..."
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setNewPrazo(prev => ({ ...prev, cliente_nome: e.target.value, cliente_advbox_id: null }));
                        }}
                        className="pl-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSyncClients}
                      disabled={syncingClients}
                      className="shrink-0"
                    >
                      {syncingClients ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                  {loadingClients && (
                    <div className="absolute z-10 w-full mt-1 p-2 bg-popover border rounded-md shadow-md text-sm text-muted-foreground">
                      Buscando...
                    </div>
                  )}
                  {clientResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                      {clientResults.map(client => (
                        <button
                          key={client.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onClick={() => selectClient(client)}
                        >
                          {client.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {newPrazo.cliente_advbox_id && (
                  <p className="text-xs text-muted-foreground">✓ Cliente selecionado do ADVBox (ID: {newPrazo.cliente_advbox_id})</p>
                )}
              </div>

              {/* Process number */}
              <div className="space-y-2">
                <Label>Nº Processo (opcional)</Label>
                <Input
                  placeholder="Ex: 0000000-00.0000.0.00.0000"
                  value={newPrazo.process_number}
                  onChange={(e) => setNewPrazo(prev => ({ ...prev, process_number: e.target.value }))}
                />
              </div>

              {/* Task type */}
              <div className="space-y-2">
                <Label>Tipo de Tarefa *</Label>
                <Select value={newPrazo.task_type} onValueChange={(v) => setNewPrazo(prev => ({ ...prev, task_type: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {INCLUDED_TASK_KEYWORDS.map(kw => (
                      <SelectItem key={kw} value={kw}>{kw}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  placeholder="Descrição do prazo..."
                  value={newPrazo.titulo}
                  onChange={(e) => setNewPrazo(prev => ({ ...prev, titulo: e.target.value }))}
                />
              </div>

              {/* Advogado */}
              <div className="space-y-2">
                <Label>Advogado Responsável</Label>
                <Select value={newPrazo.advogado_responsavel} onValueChange={(v) => setNewPrazo(prev => ({ ...prev, advogado_responsavel: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o advogado" />
                  </SelectTrigger>
                  <SelectContent>
                    {advogados.map(adv => (
                      <SelectItem key={adv} value={adv}>{adv}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Prazo Interno */}
              <div className="space-y-2">
                <Label>Prazo Interno</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newPrazo.prazo_interno && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newPrazo.prazo_interno ? format(newPrazo.prazo_interno, 'dd/MM/yyyy') : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newPrazo.prazo_interno} onSelect={(d) => setNewPrazo(prev => ({ ...prev, prazo_interno: d }))} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Prazo Fatal */}
              <div className="space-y-2">
                <Label>Prazo Fatal</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newPrazo.prazo_fatal && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newPrazo.prazo_fatal ? format(newPrazo.prazo_fatal, 'dd/MM/yyyy') : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newPrazo.prazo_fatal} onSelect={(d) => setNewPrazo(prev => ({ ...prev, prazo_fatal: d }))} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Anotações adicionais..."
                  value={newPrazo.observacoes}
                  onChange={(e) => setNewPrazo(prev => ({ ...prev, observacoes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewPrazoOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveNewPrazo} disabled={savingPrazo}>
                {savingPrazo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Cadastrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Verify Dialog */}
        <Dialog open={bulkVerifyOpen} onOpenChange={setBulkVerifyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verificar em Bloco</DialogTitle>
              <DialogDescription>
                Aplicar verificação para {selectedIds.size} tarefa(s) selecionada(s)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Status da verificação</label>
                <Select value={bulkVerifyStatus} onValueChange={(v) => setBulkVerifyStatus(v as 'verificado' | 'com_pendencia')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verificado">✅ Verificado — prazo cumprido</SelectItem>
                    <SelectItem value="com_pendencia">⚠️ Com pendência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Observações (opcional)</label>
                <Textarea
                  className="mt-1"
                  placeholder="Anotações para todos os selecionados..."
                  value={bulkVerifyObs}
                  onChange={(e) => setBulkVerifyObs(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkVerifyOpen(false)}>Cancelar</Button>
              <Button onClick={handleBulkVerify} disabled={bulkVerifying}>
                {bulkVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verificar {selectedIds.size} tarefa(s)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
