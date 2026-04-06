import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, Search, Filter, RefreshCw, ListTodo, MessageSquare, Send, X, Sparkles, Download, CheckCircle, XCircle, FileSignature, Scale, FileCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TaskCreationDialog } from '@/components/TaskCreationDialog';
import { PetitionSuggestionDialog } from '@/components/PetitionSuggestionDialog';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { ContractGenerator } from '@/components/ContractGenerator';
import { ProcuracaoGenerator } from '@/components/ProcuracaoGenerator';
import { DeclaracaoGenerator } from '@/components/DeclaracaoGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, subDays, subMonths, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface Lawsuit {
  id: number;
  process_number: string;
  protocol_number: string | null;
  folder: string | null;
  process_date: string | null;
  fees_expec: number | null;
  fees_money: number | null;
  contingency: number | null;
  type_lawsuit_id: number;
  type: string;
  group_id: number;
  group: string;
  created_at: string;
  status_closure: string | null;
  exit_production: string | null;
  exit_execution: string | null;
  responsible_id: number;
  responsible: string;
  customers?: string | { name: string; customer_id?: number; identification?: string; origin?: string } | { name: string; customer_id?: number; identification?: string; origin?: string }[];
}

interface Movement {
  lawsuit_id: number;
  date: string;
  title: string;
  header: string;
  process_number: string;
  protocol_number: string | null;
  customers: string | { name: string; customer_id?: number; identification?: string; origin?: string } | { name: string; customer_id?: number; identification?: string; origin?: string }[];
}

export default function ProcessosAtivos() {
  const CACHE_KEY = 'advbox-processos-cache';
  const CACHE_TIMESTAMP_KEY = 'advbox-processos-cache-timestamp';

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      if (cached && timestamp) {
        const data = JSON.parse(cached);
        return { ...data, lastUpdate: new Date(timestamp) };
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
    }
    return null;
  };

  const cachedData = loadFromCache();

  const [lawsuits, setLawsuits] = useState<Lawsuit[]>(cachedData?.lawsuits || []);
  const [loading, setLoading] = useState(!cachedData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(cachedData?.lastUpdate);
  const [metadata, setMetadata] = useState<any>(cachedData?.metadata || null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [showAllResponsibles, setShowAllResponsibles] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showAllTypes, setShowAllTypes] = useState(true);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [showAllAreas, setShowAllAreas] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>('all');

  // Dialogs
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [petitionDialogLawsuit, setPetitionDialogLawsuit] = useState<Lawsuit | null>(null);
  const [messageDialogLawsuit, setMessageDialogLawsuit] = useState<Lawsuit | null>(null);
  const [selectedMessageType, setSelectedMessageType] = useState<string>('');
  const [sendingDocRequest, setSendingDocRequest] = useState<number | null>(null);

  // Document generation dialogs
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [procuracaoDialogOpen, setProcuracaoDialogOpen] = useState(false);
  const [declaracaoDialogOpen, setDeclaracaoDialogOpen] = useState(false);
  const [selectedDocClient, setSelectedDocClient] = useState<any>(null);
  const [selectedDocQualification, setSelectedDocQualification] = useState('');
  const [selectedDocProduct, setSelectedDocProduct] = useState('');

  const { toast } = useToast();

  const getCustomerName = (customers: Lawsuit['customers']): string => {
    if (!customers) return '';
    if (typeof customers === 'string') return customers;
    if (Array.isArray(customers)) return customers.map((c) => c.name).join(', ');
    return customers.name ?? '';
  };

  const isLawsuitActive = (lawsuit: Lawsuit): boolean => {
    return !lawsuit.status_closure && !lawsuit.exit_production && !lawsuit.exit_execution;
  };

  // Extract unique values for filters
  const responsibles = Array.from(new Set(lawsuits.map(l => l.responsible).filter(Boolean))).sort();
  const actionTypes = Array.from(new Set(lawsuits.map(l => l.type).filter(Boolean))).sort();
  const areas = Array.from(new Set(lawsuits.map(l => l.group).filter(Boolean))).sort();

  // Filter lawsuits
  const filteredLawsuits = lawsuits.filter(lawsuit => {
    const customerName = getCustomerName(lawsuit.customers);
    const active = isLawsuitActive(lawsuit);

    const matchesSearch = !searchTerm ||
      lawsuit.process_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.group?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.responsible?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.folder?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && active) ||
      (statusFilter === 'inactive' && !active);

    const matchesResponsible = showAllResponsibles ||
      selectedResponsibles.includes(lawsuit.responsible);

    const matchesType = showAllTypes ||
      selectedTypes.includes(lawsuit.type);

    const matchesArea = showAllAreas ||
      selectedAreas.includes(lawsuit.group);

    const matchesPeriod = (() => {
      if (periodFilter === 'all') return true;
      const days = parseInt(periodFilter);
      const startDate = startOfDay(subDays(new Date(), days));
      const processDate = lawsuit.process_date ? new Date(lawsuit.process_date) :
        lawsuit.created_at ? new Date(lawsuit.created_at) : null;
      return processDate ? !isBefore(processDate, startDate) : false;
    })();

    return matchesSearch && matchesStatus && matchesResponsible && matchesType && matchesArea && matchesPeriod;
  });

  const activeCount = lawsuits.filter(l => isLawsuitActive(l)).length;
  const inactiveCount = lawsuits.length - activeCount;

  useEffect(() => {
    if (cachedData) {
      setIsRefreshing(true);
      fetchData().finally(() => setIsRefreshing(false));
    } else {
      fetchData();
    }
  }, []);

  const fetchData = async (forceRefresh = false) => {
    try {
      const refreshParam = forceRefresh ? '?force_refresh=true' : '';
      const { data: rawLawsuits, error } = await supabase.functions.invoke(
        `advbox-integration/lawsuits-full${refreshParam}`
      );

      if (error) throw error;

      const lawsuitsPayload = Array.isArray(rawLawsuits) ? { data: rawLawsuits } : (rawLawsuits || {});
      const lawsuitsArray: Lawsuit[] = (lawsuitsPayload.data as Lawsuit[]) || [];

      const finalLawsuits = lawsuitsArray.length === 0 && lawsuits.length > 0 ? lawsuits : lawsuitsArray;
      setLawsuits(finalLawsuits);
      setLastUpdate(new Date());

      const rootMetadata = !Array.isArray(rawLawsuits) ? rawLawsuits?.metadata : undefined;
      if (rootMetadata) setMetadata(rootMetadata);
    } catch (error) {
      console.error('Error fetching lawsuits:', error);
      if (!cachedData) {
        toast({ title: 'Erro ao carregar processos', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSelectedResponsibles([]);
    setShowAllResponsibles(true);
    setSelectedTypes([]);
    setShowAllTypes(true);
    setSelectedAreas([]);
    setShowAllAreas(true);
    setPeriodFilter('all');
  };

  const openTaskDialogFromLawsuit = (lawsuit: Lawsuit) => {
    const virtualMovement: Movement = {
      lawsuit_id: lawsuit.id,
      date: lawsuit.created_at || new Date().toISOString(),
      title: `Tarefa para processo ${lawsuit.process_number}`,
      header: `Acompanhamento do processo ${lawsuit.process_number}`,
      process_number: lawsuit.process_number,
      protocol_number: lawsuit.protocol_number,
      customers: lawsuit.customers || '',
    };
    setSelectedMovement(virtualMovement);
    setTaskDialogOpen(true);
  };

  const sendDocumentRequest = async (lawsuit: Lawsuit) => {
    let customerName = '';
    let customerId = '';

    if (lawsuit.customers) {
      if (typeof lawsuit.customers === 'string') {
        customerName = lawsuit.customers;
      } else if (Array.isArray(lawsuit.customers) && lawsuit.customers.length > 0) {
        customerName = lawsuit.customers[0].name || '';
        customerId = lawsuit.customers[0].customer_id?.toString() || '';
      } else if (typeof lawsuit.customers === 'object') {
        const customer = lawsuit.customers as { name: string; customer_id?: number };
        customerName = customer.name || '';
        customerId = customer.customer_id?.toString() || '';
      }
    }

    try {
      setSendingDocRequest(lawsuit.id);
      const { data: customerData } = await supabase.functions.invoke('advbox-integration/customers', { body: { force_refresh: false } });
      let customers: any[] = Array.isArray(customerData) ? customerData : customerData?.data?.data || customerData?.data || [];
      const customerInfo = customers.find((c: any) => (customerId && c.id?.toString() === customerId) || (customerName && c.name?.toLowerCase() === customerName.toLowerCase()));
      if (!customerInfo) throw new Error(`Cliente não encontrado: ${customerName || customerId}`);
      const customerPhone = customerInfo.cellphone || customerInfo.phone || '';
      if (!customerPhone) throw new Error('Cliente não possui telefone cadastrado');

      const { data: response, error } = await supabase.functions.invoke('send-document-request', {
        body: { customerId: customerInfo.id?.toString() || customerId, customerName: customerInfo.name || customerName, customerPhone, processNumber: lawsuit.process_number, processId: lawsuit.id }
      });
      if (error) throw error;
      if (!response?.success) throw new Error(response?.error || 'Erro ao enviar mensagem');
      toast({ title: 'Mensagem enviada', description: `Cobrança de documentos enviada para ${customerInfo.name}` });
    } catch (error: any) {
      toast({ title: 'Erro ao enviar mensagem', description: error.message, variant: 'destructive' });
    } finally {
      setSendingDocRequest(null);
    }
  };

  const handleSendMessage = async () => {
    if (!messageDialogLawsuit || !selectedMessageType) return;
    if (selectedMessageType === 'cobranca_documentos') await sendDocumentRequest(messageDialogLawsuit);
    setMessageDialogLawsuit(null);
    setSelectedMessageType('');
  };

  const handleDocumentFromLawsuit = async (lawsuit: Lawsuit, type: 'contrato' | 'procuracao' | 'declaracao') => {
    let customerId: number | null = null;
    let customerName = '';

    if (lawsuit.customers) {
      if (typeof lawsuit.customers === 'string') {
        customerName = lawsuit.customers;
      } else if (Array.isArray(lawsuit.customers) && lawsuit.customers.length > 0) {
        customerName = lawsuit.customers[0].name || '';
        customerId = lawsuit.customers[0].customer_id || null;
      } else if (typeof lawsuit.customers === 'object') {
        const c = lawsuit.customers as { name: string; customer_id?: number };
        customerName = c.name || '';
        customerId = c.customer_id || null;
      }
    }

    // Fetch customer data from advbox_customers
    let clientData: any = null;
    if (customerId) {
      const { data } = await supabase
        .from('advbox_customers')
        .select('*')
        .eq('advbox_id', customerId)
        .single();
      clientData = data;
    } else if (customerName) {
      const { data } = await supabase
        .from('advbox_customers')
        .select('*')
        .ilike('name', `%${customerName}%`)
        .limit(1)
        .single();
      clientData = data;
    }

    // Build Client object
    const client = {
      id: clientData?.advbox_id || 0,
      nomeCompleto: clientData?.name || customerName,
      cpf: clientData?.cpf || clientData?.tax_id || '',
      documentoIdentidade: '',
      dataNascimento: clientData?.birthday || '',
      estadoCivil: '',
      profissao: '',
      telefone: clientData?.phone || '',
      email: clientData?.email || '',
      cep: '',
      cidade: '',
      rua: '',
      numero: '',
      complemento: '',
      bairro: '',
      estado: '',
    };

    // Try to get extra data from client_form_overrides
    if (clientData?.advbox_id) {
      const { data: overrides } = await supabase
        .from('client_form_overrides')
        .select('*')
        .eq('client_row_id', clientData.advbox_id)
        .single();
      if (overrides) {
        client.documentoIdentidade = overrides.documento_identidade || '';
        client.estadoCivil = overrides.estado_civil || '';
        client.profissao = overrides.profissao || '';
        client.cep = overrides.cep || '';
        client.cidade = overrides.cidade || '';
        client.rua = overrides.rua || '';
        client.numero = overrides.numero || '';
        client.complemento = overrides.complemento || '';
        client.bairro = overrides.bairro || '';
        client.estado = overrides.estado || '';
        if (!client.cpf && overrides.cpf) client.cpf = overrides.cpf;
        if (!client.dataNascimento && overrides.data_nascimento) client.dataNascimento = overrides.data_nascimento;
        if (!client.telefone && overrides.telefone) client.telefone = overrides.telefone;
        if (!client.email && overrides.email) client.email = overrides.email;
      }
    }

    // Build qualification string
    const parts = [client.nomeCompleto];
    if (client.estadoCivil) parts.push(client.estadoCivil);
    if (client.profissao) parts.push(client.profissao);
    if (client.cpf) parts.push(`inscrito(a) no CPF sob o nº ${client.cpf}`);
    if (client.documentoIdentidade) parts.push(`portador(a) do RG nº ${client.documentoIdentidade}`);
    if (client.rua) {
      let endereco = `residente e domiciliado(a) na ${client.rua}`;
      if (client.numero) endereco += `, nº ${client.numero}`;
      if (client.bairro) endereco += `, ${client.bairro}`;
      if (client.cidade) endereco += `, ${client.cidade}`;
      if (client.estado) endereco += `/${client.estado}`;
      parts.push(endereco);
    }
    const qualification = parts.join(', ');

    setSelectedDocClient(client);
    setSelectedDocQualification(qualification);
    setSelectedDocProduct(lawsuit.type || 'Processo Judicial');

    if (type === 'contrato') setContractDialogOpen(true);
    else if (type === 'procuracao') setProcuracaoDialogOpen(true);
    else setDeclaracaoDialogOpen(true);
  };

  const handleExportExcel = () => {
    try {
      const data = filteredLawsuits.map(l => ({
        'Número do Processo': l.process_number,
        'Cliente': getCustomerName(l.customers),
        'Tipo': l.type,
        'Área': l.group,
        'Responsável': l.responsible,
        'Pasta': l.folder || '',
        'Data de Criação': l.created_at ? format(new Date(l.created_at), 'dd/MM/yyyy') : '',
        'Data do Processo': l.process_date ? format(new Date(l.process_date), 'dd/MM/yyyy') : '',
        'Status': isLawsuitActive(l) ? 'Ativo' : 'Inativo',
        'Data Encerramento': l.status_closure ? format(new Date(l.status_closure), 'dd/MM/yyyy') : '',
      }));
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Processos');
      XLSX.writeFile(workbook, `processos_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`);
      toast({ title: 'Excel gerado', description: 'Relatório exportado com sucesso.' });
    } catch (error) {
      toast({ title: 'Erro ao gerar Excel', variant: 'destructive' });
    }
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || !showAllResponsibles || !showAllTypes || !showAllAreas || periodFilter !== 'all';

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando processos...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Briefcase className="h-8 w-8 text-primary" />
              Processos
            </h1>
            <p className="text-muted-foreground mt-2">
              Visualize e gerencie todos os processos do escritório
            </p>
            <div className="mt-2 flex items-center gap-3">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
              {isRefreshing && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Atualizando dados...
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchData(true); }} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('all')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{lawsuits.length.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total de Processos</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('active')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                {activeCount.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Processos Ativos</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('inactive')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                {inactiveCount.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Processos Inativos</div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número de processo, nome da parte, tipo, responsável, pasta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {/* Period Filter */}
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="180">Últimos 6 meses</SelectItem>
                    <SelectItem value="365">Último ano</SelectItem>
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>

                {/* Advanced Filters */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="relative">
                      <Filter className="h-4 w-4" />
                      {(!showAllResponsibles || !showAllTypes || !showAllAreas) && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 max-h-[500px] overflow-y-auto" align="end">
                    <div className="space-y-6">
                      {/* Responsável */}
                      <div>
                        <h4 className="font-medium mb-2">Responsável</h4>
                        <div className="flex items-center space-x-2 mb-2">
                          <Checkbox id="all-resp" checked={showAllResponsibles}
                            onCheckedChange={(checked) => { setShowAllResponsibles(checked as boolean); if (checked) setSelectedResponsibles([]); }} />
                          <label htmlFor="all-resp" className="text-sm cursor-pointer">Todos</label>
                        </div>
                        <div className="border-t pt-2 space-y-1 max-h-32 overflow-y-auto">
                          {responsibles.map(r => (
                            <div key={r} className="flex items-center space-x-2">
                              <Checkbox id={`resp-${r}`} checked={selectedResponsibles.includes(r)} disabled={showAllResponsibles}
                                onCheckedChange={(checked) => {
                                  if (checked) { setSelectedResponsibles([...selectedResponsibles, r]); setShowAllResponsibles(false); }
                                  else { const next = selectedResponsibles.filter(x => x !== r); setSelectedResponsibles(next); if (next.length === 0) setShowAllResponsibles(true); }
                                }} />
                              <label htmlFor={`resp-${r}`} className="text-sm cursor-pointer">{r}</label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tipo de Ação */}
                      <div>
                        <h4 className="font-medium mb-2">Tipo de Ação</h4>
                        <div className="flex items-center space-x-2 mb-2">
                          <Checkbox id="all-types" checked={showAllTypes}
                            onCheckedChange={(checked) => { setShowAllTypes(checked as boolean); if (checked) setSelectedTypes([]); }} />
                          <label htmlFor="all-types" className="text-sm cursor-pointer">Todos</label>
                        </div>
                        <div className="border-t pt-2 space-y-1 max-h-32 overflow-y-auto">
                          {actionTypes.map(t => (
                            <div key={t} className="flex items-center space-x-2">
                              <Checkbox id={`type-${t}`} checked={selectedTypes.includes(t)} disabled={showAllTypes}
                                onCheckedChange={(checked) => {
                                  if (checked) { setSelectedTypes([...selectedTypes, t]); setShowAllTypes(false); }
                                  else { const next = selectedTypes.filter(x => x !== t); setSelectedTypes(next); if (next.length === 0) setShowAllTypes(true); }
                                }} />
                              <label htmlFor={`type-${t}`} className="text-sm cursor-pointer">{t}</label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Área */}
                      <div>
                        <h4 className="font-medium mb-2">Área / Grupo</h4>
                        <div className="flex items-center space-x-2 mb-2">
                          <Checkbox id="all-areas" checked={showAllAreas}
                            onCheckedChange={(checked) => { setShowAllAreas(checked as boolean); if (checked) setSelectedAreas([]); }} />
                          <label htmlFor="all-areas" className="text-sm cursor-pointer">Todos</label>
                        </div>
                        <div className="border-t pt-2 space-y-1 max-h-32 overflow-y-auto">
                          {areas.map(a => (
                            <div key={a} className="flex items-center space-x-2">
                              <Checkbox id={`area-${a}`} checked={selectedAreas.includes(a)} disabled={showAllAreas}
                                onCheckedChange={(checked) => {
                                  if (checked) { setSelectedAreas([...selectedAreas, a]); setShowAllAreas(false); }
                                  else { const next = selectedAreas.filter(x => x !== a); setSelectedAreas(next); if (next.length === 0) setShowAllAreas(true); }
                                }} />
                              <label htmlFor={`area-${a}`} className="text-sm cursor-pointer">{a}</label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                          Limpar Todos os Filtros
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Active filters summary */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2">
                  {statusFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      Status: {statusFilter === 'active' ? 'Ativos' : 'Inativos'}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter('all')} />
                    </Badge>
                  )}
                  {periodFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      Período: {periodFilter} dias
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setPeriodFilter('all')} />
                    </Badge>
                  )}
                  {!showAllResponsibles && selectedResponsibles.map(r => (
                    <Badge key={r} variant="secondary" className="gap-1">
                      {r}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => {
                        const next = selectedResponsibles.filter(x => x !== r);
                        setSelectedResponsibles(next);
                        if (next.length === 0) setShowAllResponsibles(true);
                      }} />
                    </Badge>
                  ))}
                  {!showAllTypes && selectedTypes.map(t => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => {
                        const next = selectedTypes.filter(x => x !== t);
                        setSelectedTypes(next);
                        if (next.length === 0) setShowAllTypes(true);
                      }} />
                    </Badge>
                  ))}
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6">
                    Limpar tudo
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredLawsuits.length.toLocaleString()} processo{filteredLawsuits.length !== 1 ? 's' : ''} encontrado{filteredLawsuits.length !== 1 ? 's' : ''}
            {hasActiveFilters && ` (de ${lawsuits.length.toLocaleString()} total)`}
          </p>
        </div>

        {/* Processes List */}
        <div className="space-y-3">
          {filteredLawsuits.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">
                  {hasActiveFilters ? 'Nenhum processo encontrado com os filtros aplicados' : 'Nenhum processo encontrado'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredLawsuits.slice(0, 100).map((lawsuit) => {
              const active = isLawsuitActive(lawsuit);
              return (
                <Card key={lawsuit.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm">
                              {lawsuit.process_number || <span className="text-muted-foreground italic font-normal">Sem número</span>}
                            </p>
                            <Badge variant={active ? 'default' : 'secondary'} className="text-xs">
                              {active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Cliente: {lawsuit.customers ? (
                              <span className="font-medium text-foreground">{getCustomerName(lawsuit.customers)}</span>
                            ) : (
                              <span className="italic">Cliente não vinculado</span>
                            )}
                          </p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{lawsuit.type}</Badge>
                            <Badge variant="secondary" className="text-xs">{lawsuit.group}</Badge>
                            {lawsuit.folder && <Badge variant="outline" className="text-xs">📁 {lawsuit.folder}</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => { setMessageDialogLawsuit(lawsuit); setSelectedMessageType(''); }} disabled={sendingDocRequest === lawsuit.id}>
                            <MessageSquare className="h-4 w-4 mr-1" />
                            <span className="hidden md:inline">{sendingDocRequest === lawsuit.id ? 'Enviando...' : 'Mensagem'}</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openTaskDialogFromLawsuit(lawsuit)}>
                            <ListTodo className="h-4 w-4 mr-1" />
                            <span className="hidden md:inline">Tarefa</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setPetitionDialogLawsuit(lawsuit)} title="Sugestão de petição por IA">
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Responsável: </span>
                        {lawsuit.responsible ? (
                          <span className="font-medium">{lawsuit.responsible}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Sem responsável</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-2 border-t">
                        {lawsuit.process_date && (
                          <div>
                            <span className="text-muted-foreground">Data processo: </span>
                            <span>{new Date(lawsuit.process_date).toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                        {lawsuit.created_at && (
                          <div>
                            <span className="text-muted-foreground">Cadastro: </span>
                            <span>{new Date(lawsuit.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                        {lawsuit.status_closure && (
                          <div>
                            <span className="text-muted-foreground">Encerrado: </span>
                            <span>{new Date(lawsuit.status_closure).toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                        {lawsuit.exit_production && (
                          <div>
                            <span className="text-muted-foreground">Saída produção: </span>
                            <span>{new Date(lawsuit.exit_production).toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                      </div>
                      {(lawsuit.fees_expec || lawsuit.fees_money || lawsuit.contingency) && (
                        <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t">
                          {lawsuit.fees_expec != null && (
                            <div>
                              <span className="text-muted-foreground">Honorários Esperados: </span>
                              <span className="font-medium">{lawsuit.fees_expec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                          )}
                          {lawsuit.fees_money != null && (
                            <div>
                              <span className="text-muted-foreground">Honorários: </span>
                              <span className="font-medium">{lawsuit.fees_money.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                          )}
                          {lawsuit.contingency != null && (
                            <div>
                              <span className="text-muted-foreground">Contingência: </span>
                              <span className="font-medium">{lawsuit.contingency.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
          {filteredLawsuits.length > 100 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Mostrando 100 de {filteredLawsuits.length.toLocaleString()} processos. Use os filtros para refinar a busca.
            </p>
          )}
        </div>

        {/* Task Dialog */}
        <TaskCreationDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          selectedMovement={selectedMovement}
          lawsuits={lawsuits}
          onTaskCreated={() => {
            setSelectedMovement(null);
            toast({ title: 'Tarefa criada', description: 'Tarefa criada com sucesso no Advbox.' });
          }}
        />

        {/* Petition Dialog */}
        {petitionDialogLawsuit && (
          <PetitionSuggestionDialog
            open={!!petitionDialogLawsuit}
            onOpenChange={(open) => !open && setPetitionDialogLawsuit(null)}
            processNumber={petitionDialogLawsuit.process_number}
            processType={petitionDialogLawsuit.type}
            processGroup={petitionDialogLawsuit.group}
            clientName={getCustomerName(petitionDialogLawsuit.customers)}
          />
        )}

        {/* Message Dialog */}
        <Dialog open={!!messageDialogLawsuit} onOpenChange={(open) => { if (!open) { setMessageDialogLawsuit(null); setSelectedMessageType(''); } }}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Enviar Mensagem</DialogTitle>
              <DialogDescription>
                Processo: <span className="font-semibold">{messageDialogLawsuit?.process_number}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label className="text-sm font-medium mb-3 block">Tipo de Mensagem</Label>
              <RadioGroup value={selectedMessageType} onValueChange={setSelectedMessageType}>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="cobranca_documentos" id="msg_cobranca_docs" />
                  <Label htmlFor="msg_cobranca_docs" className="flex-1 cursor-pointer">
                    <span className="font-medium">Cobrança de Documentos</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Solicita ao cliente os documentos necessários</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setMessageDialogLawsuit(null); setSelectedMessageType(''); }}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={handleSendMessage} disabled={!selectedMessageType || sendingDocRequest === messageDialogLawsuit?.id}>
                <Send className="h-4 w-4 mr-1" /> {sendingDocRequest === messageDialogLawsuit?.id ? 'Enviando...' : 'Enviar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
