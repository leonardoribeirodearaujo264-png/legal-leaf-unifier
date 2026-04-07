import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { ContractGenerator } from "@/components/ContractGenerator";
import { ProcuracaoGenerator } from "@/components/ProcuracaoGenerator";
import { DeclaracaoGenerator } from "@/components/DeclaracaoGenerator";
import { DocumentTemplatesManager } from "@/components/DocumentTemplatesManager";
import { LeadsDashboard } from "@/components/LeadsDashboard";
import { 
  RefreshCw, 
  Search, 
  FileText, 
  Users, 
  Clock,
  Eye,
  FileSignature,
  Scale,
  FileCheck,
  Phone,
  Mail,
  MapPin,
  Calendar as CalendarIcon,
  CreditCard,
  X,
  Package,
  Loader2,
  Check,
  RotateCcw,
  Save,
  Settings,
  BarChart3,
  Upload,
  Pencil,
  AlertCircle
} from "lucide-react";
import { format, parse, isAfter, isBefore, isEqual, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: number;
  timestamp: string;
  nomeCompleto: string;
  cpf: string;
  documentoIdentidade: string;
  comoConheceu: string;
  dataNascimento: string;
  estadoCivil: string;
  profissao: string;
  telefone: string;
  temWhatsapp: string;
  email: string;
  cep: string;
  cidade: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  estado: string;
  nomePai: string;
  nomeMae: string;
  opcaoPagamento: string;
  quantidadeParcelas: string;
  dataVencimento: string;
  aposentado: string;
  previsaoAposentadoria: string;
  possuiEmprestimo: string;
  doencaGrave: string;
  planoSaude: string;
  qualPlanoSaude: string;
  negativaPlano: string;
  doencaNegativa: string;
  conheceAlguemSituacao: string;
  conheceAlguemMesmaSituacao: string;
  telefoneAlternativo: string;
  _hasOverride?: boolean;
}

interface ClientFormOverride {
  id: string;
  client_row_id: number;
  nome_completo: string | null;
  cpf: string | null;
  documento_identidade: string | null;
  como_conheceu: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  profissao: string | null;
  telefone: string | null;
  tem_whatsapp: string | null;
  email: string | null;
  cep: string | null;
  cidade: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  estado: string | null;
  nome_pai: string | null;
  nome_mae: string | null;
  opcao_pagamento: string | null;
  quantidade_parcelas: string | null;
  data_vencimento: string | null;
  aposentado: string | null;
  previsao_aposentadoria: string | null;
  possui_emprestimo: string | null;
  doenca_grave: string | null;
  plano_saude: string | null;
  qual_plano_saude: string | null;
  negativa_plano: string | null;
  doenca_negativa: string | null;
  conhece_alguem_situacao: string | null;
  conhece_alguem_mesma_situacao: string | null;
  telefone_alternativo: string | null;
}

interface RDStationProduct {
  _id: string;
  name: string;
  description?: string;
  base_price?: number;
  recurrence?: string;
}

// Field mapping: Client key -> DB column
const fieldMapping: Record<string, string> = {
  nomeCompleto: 'nome_completo',
  cpf: 'cpf',
  documentoIdentidade: 'documento_identidade',
  comoConheceu: 'como_conheceu',
  dataNascimento: 'data_nascimento',
  estadoCivil: 'estado_civil',
  profissao: 'profissao',
  telefone: 'telefone',
  temWhatsapp: 'tem_whatsapp',
  email: 'email',
  cep: 'cep',
  cidade: 'cidade',
  rua: 'rua',
  numero: 'numero',
  complemento: 'complemento',
  bairro: 'bairro',
  estado: 'estado',
  nomePai: 'nome_pai',
  nomeMae: 'nome_mae',
  opcaoPagamento: 'opcao_pagamento',
  quantidadeParcelas: 'quantidade_parcelas',
  dataVencimento: 'data_vencimento',
  aposentado: 'aposentado',
  previsaoAposentadoria: 'previsao_aposentadoria',
  possuiEmprestimo: 'possui_emprestimo',
  doencaGrave: 'doenca_grave',
  planoSaude: 'plano_saude',
  qualPlanoSaude: 'qual_plano_saude',
  negativaPlano: 'negativa_plano',
  doencaNegativa: 'doenca_negativa',
  conheceAlguemSituacao: 'conhece_alguem_situacao',
  conheceAlguemMesmaSituacao: 'conhece_alguem_mesma_situacao',
  telefoneAlternativo: 'telefone_alternativo',
};

// Reverse mapping: DB column -> Client key
const reverseFieldMapping: Record<string, string> = Object.fromEntries(
  Object.entries(fieldMapping).map(([k, v]) => [v, k])
);

const applyOverrides = (clients: Client[], overrides: ClientFormOverride[]): Client[] => {
  const overrideMap = new Map(overrides.map(o => [o.client_row_id, o]));
  return clients.map(client => {
    const override = overrideMap.get(client.id);
    if (!override) return client;
    const merged = { ...client, _hasOverride: true };
    for (const [dbCol, clientKey] of Object.entries(reverseFieldMapping)) {
      const val = (override as any)[dbCol];
      if (val !== null && val !== undefined) {
        (merged as any)[clientKey] = val;
      }
    }
    return merged;
  });
};

// Função para formatar CPF no padrão XXX.XXX.XXX-XX
const formatCPF = (cpf: string): string => {
  if (!cpf) return '[CPF]';
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return cpf;
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

// Função para gerar a qualificação do cliente no formato jurídico
const generateClientQualification = (client: Client): string => {
  const parts = [
    client.nomeCompleto || '[NOME]',
    'brasileiro(a)',
    client.estadoCivil?.toLowerCase() || '[ESTADO CIVIL]',
    client.profissao?.toLowerCase() || '[PROFISSÃO]',
    `portador(a) do documento de identidade nº ${client.documentoIdentidade || '[RG]'}`,
    `e do CPF nº ${formatCPF(client.cpf)}`,
    `nascido(a) em ${client.dataNascimento || '[DATA NASCIMENTO]'}`,
    `residente na ${client.rua || '[RUA]'}`,
    `nº ${client.numero || '[NÚMERO]'}`,
    client.complemento ? client.complemento : null,
    `bairro ${client.bairro || '[BAIRRO]'}`,
    client.cidade || '[CIDADE]',
    client.estado || '[ESTADO]',
    `CEP ${client.cep || '[CEP]'}`,
    `e-mail: ${client.email || '[E-MAIL]'}`,
    `telefone: ${client.telefone || '[TELEFONE]'}`
  ];
  return parts.filter(Boolean).join(', ') + ';';
};

// Editable fields config
const editableFields: { key: string; label: string; section: string }[] = [
  { key: 'nomeCompleto', label: 'Nome Completo', section: 'pessoal' },
  { key: 'cpf', label: 'CPF', section: 'pessoal' },
  { key: 'documentoIdentidade', label: 'RG', section: 'pessoal' },
  { key: 'dataNascimento', label: 'Data de Nascimento', section: 'pessoal' },
  { key: 'estadoCivil', label: 'Estado Civil', section: 'pessoal' },
  { key: 'profissao', label: 'Profissão', section: 'pessoal' },
  { key: 'nomePai', label: 'Nome do Pai', section: 'pessoal' },
  { key: 'nomeMae', label: 'Nome da Mãe', section: 'pessoal' },
  { key: 'telefone', label: 'Telefone', section: 'contato' },
  { key: 'temWhatsapp', label: 'WhatsApp', section: 'contato' },
  { key: 'email', label: 'Email', section: 'contato' },
  { key: 'telefoneAlternativo', label: 'Telefone Alternativo', section: 'contato' },
  { key: 'cep', label: 'CEP', section: 'endereco' },
  { key: 'estado', label: 'Estado', section: 'endereco' },
  { key: 'cidade', label: 'Cidade', section: 'endereco' },
  { key: 'bairro', label: 'Bairro', section: 'endereco' },
  { key: 'rua', label: 'Rua', section: 'endereco' },
  { key: 'numero', label: 'Número', section: 'endereco' },
  { key: 'complemento', label: 'Complemento', section: 'endereco' },
  { key: 'opcaoPagamento', label: 'Opção de Pagamento', section: 'pagamento' },
  { key: 'quantidadeParcelas', label: 'Parcelas', section: 'pagamento' },
  { key: 'dataVencimento', label: 'Vencimento', section: 'pagamento' },
  { key: 'aposentado', label: 'Aposentado', section: 'adicional' },
  { key: 'previsaoAposentadoria', label: 'Previsão Aposentadoria', section: 'adicional' },
  { key: 'possuiEmprestimo', label: 'Empréstimo Consignado', section: 'adicional' },
  { key: 'doencaGrave', label: 'Doença Grave', section: 'adicional' },
  { key: 'planoSaude', label: 'Plano de Saúde', section: 'adicional' },
  { key: 'qualPlanoSaude', label: 'Qual Plano', section: 'adicional' },
  { key: 'negativaPlano', label: 'Negativa do Plano', section: 'adicional' },
  { key: 'doencaNegativa', label: 'Doença da Negativa', section: 'adicional' },
  { key: 'comoConheceu', label: 'Como Conheceu', section: 'adicional' },
  { key: 'conheceAlguemSituacao', label: 'Conhece Alguém na Situação', section: 'adicional' },
  { key: 'conheceAlguemMesmaSituacao', label: 'Conhece Alguém Mesma Situação', section: 'adicional' },
];

const SetorComercial = () => {
  const navigate = useNavigate();
  const { hasPermission, loading: permissionsLoading } = useAdminPermissions();
  const { isAdmin } = useUserRole();
  const [clients, setClients] = useState<Client[]>([]);
  const [overrides, setOverrides] = useState<ClientFormOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [profissaoFilter, setProfissaoFilter] = useState<string>("all");
  
  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  
  // RD Station products
  const [products, setProducts] = useState<RDStationProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [clientForDocument, setClientForDocument] = useState<Client | null>(null);
  
  // Qualificação editável
  const [editedQualification, setEditedQualification] = useState<string>("");
  const [qualificationSaved, setQualificationSaved] = useState(false);
  
  // Contract generator
  const [contractGeneratorOpen, setContractGeneratorOpen] = useState(false);
  
  // Procuração generator
  const [procuracaoGeneratorOpen, setProcuracaoGeneratorOpen] = useState(false);
  const [clientForProcuracao, setClientForProcuracao] = useState<Client | null>(null);
  const [objetoContratoForProcuracao, setObjetoContratoForProcuracao] = useState("");
  
  // Document Templates Manager
  const [templatesManagerOpen, setTemplatesManagerOpen] = useState(false);
  
  // Declaração generator
  const [declaracaoGeneratorOpen, setDeclaracaoGeneratorOpen] = useState(false);
  const [clientForDeclaracao, setClientForDeclaracao] = useState<Client | null>(null);

  // ADVBox sync
  const [syncingAdvbox, setSyncingAdvbox] = useState(false);

  const fetchOverrides = async () => {
    try {
      const { data, error } = await supabase
        .from('client_form_overrides')
        .select('*');
      if (error) throw error;
      setOverrides((data || []) as unknown as ClientFormOverride[]);
    } catch (err) {
      console.error('Error fetching overrides:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      const { data, error } = await supabase.functions.invoke('rd-station-products');
      if (error) throw error;
      if (data.products) {
        setProducts(data.products);
      }
    } catch (error: unknown) {
      console.error('Error fetching products:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar produtos';
      toast.error(errorMessage);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchClients = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const { data, error } = await supabase.functions.invoke('google-sheets-integration');
      if (error) throw error;
      if (data.clients) {
        setClients(data.clients);
        if (showToast) {
          toast.success(`${data.clients.length} clientes carregados`);
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching clients:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const syncToAdvbox = async () => {
    try {
      setSyncingAdvbox(true);
      toast.info('Sincronizando clientes com ADVBox...');
      const { data, error } = await supabase.functions.invoke('sync-sheets-to-advbox');
      if (error) throw error;
      if (data.success) {
        const { this_run, pending } = data;
        if (this_run.synced > 0 || this_run.existing > 0) {
          toast.success(
            `Sincronização concluída! ${this_run.synced} novos clientes cadastrados` +
            (this_run.existing > 0 ? `, ${this_run.existing} já existiam` : '') +
            (pending > 0 ? `. ${pending} aguardando próxima execução.` : '')
          );
        } else if (this_run.errors > 0) {
          toast.error(`Erros durante sincronização: ${this_run.errors} falhas`);
        } else {
          toast.info('Nenhum cliente novo para sincronizar');
        }
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error: unknown) {
      console.error('Error syncing to ADVBox:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao sincronizar';
      toast.error(errorMessage);
    } finally {
      setSyncingAdvbox(false);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchProducts();
    fetchOverrides();
  }, []);

  // Merge clients with overrides
  const mergedClients = applyOverrides(clients, overrides);

  // Parse timestamp from Google Sheets format
  const parseTimestamp = (timestamp: string): Date | null => {
    if (!timestamp) return null;
    try {
      const parsed = parse(timestamp, 'dd/MM/yyyy HH:mm:ss', new Date());
      if (!isNaN(parsed.getTime())) return parsed;
      const parsedDate = parse(timestamp, 'dd/MM/yyyy', new Date());
      if (!isNaN(parsedDate.getTime())) return parsedDate;
      return null;
    } catch {
      return null;
    }
  };

  // Reverse order to show most recent first
  const reversedClients = [...mergedClients].reverse();
  
  // Apply date filter
  const dateFilteredClients = reversedClients.filter(client => {
    if (!startDate && !endDate) return true;
    const clientDate = parseTimestamp(client.timestamp);
    if (!clientDate) return true;
    const clientDay = startOfDay(clientDate);
    if (startDate && endDate) {
      return (isAfter(clientDay, startOfDay(startDate)) || isEqual(clientDay, startOfDay(startDate))) &&
             (isBefore(clientDay, endOfDay(endDate)) || isEqual(clientDay, startOfDay(endDate)));
    }
    if (startDate) {
      return isAfter(clientDay, startOfDay(startDate)) || isEqual(clientDay, startOfDay(startDate));
    }
    if (endDate) {
      return isBefore(clientDay, endOfDay(endDate)) || isEqual(clientDay, startOfDay(endDate));
    }
    return true;
  });

  // Apply profession filter
  const professionFilteredClients = profissaoFilter === "all" 
    ? dateFilteredClients 
    : dateFilteredClients.filter(c => c.profissao?.toLowerCase() === profissaoFilter.toLowerCase());

  // Multi-term search (comma separated, OR logic)
  const searchTerms = searchTerm.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  
  const filteredClients = professionFilteredClients.filter(client => {
    if (searchTerms.length === 0) return true;
    return searchTerms.some(term =>
      client.nomeCompleto?.toLowerCase().includes(term) ||
      client.cpf?.includes(term) ||
      client.email?.toLowerCase().includes(term) ||
      client.telefone?.includes(term) ||
      client.profissao?.toLowerCase().includes(term)
    );
  });
  
  // Unique professions for filter
  const uniqueProfessions = Array.from(
    new Set(mergedClients.map(c => c.profissao).filter(Boolean))
  ).sort();

  // Limit to 30 unless showAll is true
  const displayedClients = showAll ? filteredClients : filteredClients.slice(0, 30);
  const hasMoreClients = filteredClients.length > 30;
  
  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const handleViewDetails = (client: Client) => {
    setSelectedClient(client);
    setEditedQualification(generateClientQualification(client));
    setQualificationSaved(false);
    setIsEditing(false);
    setEditData({});
    setDetailsOpen(true);
  };

  const startEditing = () => {
    if (!selectedClient) return;
    const data: Record<string, string> = {};
    editableFields.forEach(f => {
      data[f.key] = (selectedClient as any)[f.key] || '';
    });
    setEditData(data);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData({});
  };

  const saveEdits = async () => {
    if (!selectedClient) return;
    try {
      setSavingEdit(true);
      const dbData: Record<string, any> = { client_row_id: selectedClient.id };
      for (const [clientKey, dbCol] of Object.entries(fieldMapping)) {
        const val = editData[clientKey];
        if (val !== undefined && val !== '') {
          dbData[dbCol] = val;
        }
      }

      const { data: user } = await supabase.auth.getUser();
      if (user?.user?.id) {
        dbData.updated_by = user.user.id;
      }
      dbData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('client_form_overrides')
        .upsert(dbData as any, { onConflict: 'client_row_id' });

      if (error) throw error;

      // Update local state
      await fetchOverrides();
      
      // Update selectedClient in place
      const updatedClient = { ...selectedClient };
      for (const [key, val] of Object.entries(editData)) {
        if (val) (updatedClient as any)[key] = val;
      }
      updatedClient._hasOverride = true;
      setSelectedClient(updatedClient);
      setEditedQualification(generateClientQualification(updatedClient));

      setIsEditing(false);
      toast.success('Dados do cliente atualizados com sucesso!');
    } catch (err: any) {
      console.error('Error saving overrides:', err);
      toast.error(err.message || 'Erro ao salvar edições');
    } finally {
      setSavingEdit(false);
    }
  };

  const openProductDialog = (client: Client) => {
    setClientForDocument(client);
    setSelectedProduct("");
    setProductDialogOpen(true);
  };

  const handleGenerateDocument = () => {
    if (!selectedProduct) {
      toast.error('Selecione um produto');
      return;
    }
    if (!clientForDocument) {
      toast.error('Cliente não selecionado');
      return;
    }
    setProductDialogOpen(false);
    setContractGeneratorOpen(true);
  };

  const handleGenerateContract = (client: Client) => {
    openProductDialog(client);
  };

  const handleGenerateProcuracao = (client: Client) => {
    const qualification = qualificationSaved && selectedClient?.id === client.id 
      ? editedQualification 
      : generateClientQualification(client);
    setClientForProcuracao(client);
    setEditedQualification(qualification);
    setProcuracaoGeneratorOpen(true);
  };

  const handleGenerateDeclaracao = (client: Client) => {
    const qualification = qualificationSaved && selectedClient?.id === client.id 
      ? editedQualification 
      : generateClientQualification(client);
    setClientForDeclaracao(client);
    setEditedQualification(qualification);
    setDeclaracaoGeneratorOpen(true);
  };

  if (permissionsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  const canAccess = hasPermission('advbox', 'view');

  if (!canAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Scale className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta seção.</p>
        </div>
      </Layout>
    );
  }

  // Render field: editable or static
  const renderField = (key: string, label: string, value: string) => {
    if (isEditing) {
      return (
        <div key={key}>
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Input
            value={editData[key] || ''}
            onChange={(e) => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
            className="mt-1 h-8 text-sm"
          />
        </div>
      );
    }
    return (
      <div key={key}>
        <p className="text-muted-foreground">{label}</p>
        <p className="font-medium">{value || '-'}</p>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contratos e Documentos</h1>
            <p className="text-muted-foreground">
              Geração de contratos, procurações e declarações a partir dos formulários de clientes
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button 
                onClick={() => setTemplatesManagerOpen(true)} 
                variant="outline"
              >
                <Settings className="h-4 w-4 mr-2" />
                Modelos
              </Button>
            )}
            <Button 
              onClick={syncToAdvbox}
              disabled={syncingAdvbox}
              variant="outline"
              title="Sincronizar novos clientes do formulário com o ADVBox"
            >
              {syncingAdvbox ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Sincronizar ADVBox
            </Button>
            <Button 
              onClick={() => fetchClients(true)} 
              disabled={refreshing}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Clientes que Preencheram o Formulário</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{clients.length}</div>
                  <p className="text-xs text-muted-foreground">
                    registros no formulário
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Último Registro</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {reversedClients.length > 0 
                      ? reversedClients[0]?.nomeCompleto?.split(' ')[0] || '-'
                      : '-'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {reversedClients.length > 0 ? reversedClients[0]?.timestamp : 'Nenhum registro'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Documentos</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">3</div>
                  <p className="text-xs text-muted-foreground">
                    tipos disponíveis para geração
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Search and Table */}
            <Card>
          <CardHeader>
            <CardTitle>Clientes do Formulário</CardTitle>
            <CardDescription>
              Dados recebidos via Google Forms para geração de documentos. Busque por múltiplos termos separados por vírgula.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, email, telefone ou profissão (separe por vírgula)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Profession filter */}
              <Select value={profissaoFilter} onValueChange={setProfissaoFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Profissão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas profissões</SelectItem>
                  {uniqueProfessions.map(p => (
                    <SelectItem key={p} value={p!.toLowerCase()}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Date filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal w-full sm:w-[140px]",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Data início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal w-full sm:w-[140px]",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Data fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                
                {(startDate || endDate || profissaoFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { clearDateFilters(); setProfissaoFilter("all"); }}
                    title="Limpar filtros"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Active filters badge */}
            {(startDate || endDate || profissaoFilter !== "all") && (
              <div className="flex items-center gap-2 flex-wrap">
                {(startDate || endDate) && (
                  <Badge variant="secondary" className="text-xs">
                    {startDate && endDate 
                      ? `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`
                      : startDate 
                        ? `A partir de ${format(startDate, "dd/MM/yyyy")}`
                        : `Até ${format(endDate!, "dd/MM/yyyy")}`
                    }
                  </Badge>
                )}
                {profissaoFilter !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    Profissão: {profissaoFilter}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {filteredClients.length} resultado(s)
                </span>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum cliente encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Tente uma busca diferente' : 'Aguardando respostas do formulário'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead className="hidden md:table-cell">Telefone</TableHead>
                      <TableHead className="hidden lg:table-cell">Email</TableHead>
                      <TableHead className="hidden lg:table-cell">Profissão</TableHead>
                      <TableHead className="hidden xl:table-cell">Pagamento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium">{client.nomeCompleto}</p>
                              <p className="text-xs text-muted-foreground md:hidden">
                                {client.telefone}
                              </p>
                            </div>
                            {client._hasOverride && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                <Pencil className="h-2.5 w-2.5 mr-0.5" />
                                Editado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{client.cpf}</TableCell>
                        <TableCell className="hidden md:table-cell">{client.telefone}</TableCell>
                        <TableCell className="hidden lg:table-cell">{client.email}</TableCell>
                        <TableCell className="hidden lg:table-cell">{client.profissao || '-'}</TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <Badge variant="outline">
                            {client.opcaoPagamento || 'Não informado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(client)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateContract(client)}
                              title="Gerar contrato"
                            >
                              <FileSignature className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateProcuracao(client)}
                              title="Gerar procuração"
                            >
                              <Scale className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateDeclaracao(client)}
                              title="Gerar declaração"
                            >
                              <FileCheck className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Show more button */}
            {!loading && hasMoreClients && !searchTerm && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll 
                    ? 'Mostrar apenas os 30 últimos' 
                    : `Ver todos os ${filteredClients.length} clientes`
                  }
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        

      {/* Client Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) setIsEditing(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Detalhes do Cliente</DialogTitle>
                <DialogDescription>
                  Informações completas do formulário
                  {selectedClient?._hasOverride && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      <Pencil className="h-2.5 w-2.5 mr-1" />
                      Editado localmente
                    </Badge>
                  )}
                </DialogDescription>
              </div>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={cancelEditing} disabled={savingEdit}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={saveEdits} disabled={savingEdit}>
                    {savingEdit ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          {selectedClient && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Personal Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Dados Pessoais
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {renderField('nomeCompleto', 'Nome Completo', selectedClient.nomeCompleto)}
                    {renderField('cpf', 'CPF', selectedClient.cpf)}
                    {renderField('documentoIdentidade', 'RG', selectedClient.documentoIdentidade)}
                    {renderField('dataNascimento', 'Data de Nascimento', selectedClient.dataNascimento)}
                    {renderField('estadoCivil', 'Estado Civil', selectedClient.estadoCivil)}
                    {renderField('profissao', 'Profissão', selectedClient.profissao)}
                    {renderField('nomePai', 'Nome do Pai', selectedClient.nomePai)}
                    {renderField('nomeMae', 'Nome da Mãe', selectedClient.nomeMae)}
                  </div>
                </div>

                <Separator />

                {/* Contact Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Contato
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {renderField('telefone', 'Telefone', selectedClient.telefone)}
                    {renderField('temWhatsapp', 'WhatsApp', selectedClient.temWhatsapp)}
                    {renderField('email', 'Email', selectedClient.email)}
                    {renderField('telefoneAlternativo', 'Telefone Alternativo', selectedClient.telefoneAlternativo)}
                  </div>
                </div>

                <Separator />

                {/* Address */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {renderField('cep', 'CEP', selectedClient.cep)}
                    {renderField('estado', 'Estado', selectedClient.estado)}
                    {renderField('cidade', 'Cidade', selectedClient.cidade)}
                    {renderField('bairro', 'Bairro', selectedClient.bairro)}
                    {renderField('rua', 'Rua', selectedClient.rua)}
                    {renderField('numero', 'Número', selectedClient.numero)}
                    {renderField('complemento', 'Complemento', selectedClient.complemento)}
                  </div>
                </div>

                <Separator />

                {/* Payment Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Pagamento
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {renderField('opcaoPagamento', 'Opção de Pagamento', selectedClient.opcaoPagamento)}
                    {renderField('quantidadeParcelas', 'Parcelas', selectedClient.quantidadeParcelas)}
                    {renderField('dataVencimento', 'Vencimento', selectedClient.dataVencimento)}
                  </div>
                </div>

                <Separator />

                {/* Additional Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Informações Adicionais
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {renderField('aposentado', 'Aposentado', selectedClient.aposentado)}
                    {renderField('previsaoAposentadoria', 'Previsão Aposentadoria', selectedClient.previsaoAposentadoria)}
                    {renderField('possuiEmprestimo', 'Empréstimo Consignado', selectedClient.possuiEmprestimo)}
                    {renderField('doencaGrave', 'Doença Grave', selectedClient.doencaGrave)}
                    {renderField('planoSaude', 'Plano de Saúde', selectedClient.planoSaude)}
                    {renderField('qualPlanoSaude', 'Qual Plano', selectedClient.qualPlanoSaude)}
                    {renderField('negativaPlano', 'Negativa do Plano', selectedClient.negativaPlano)}
                    {renderField('doencaNegativa', 'Doença da Negativa', selectedClient.doencaNegativa)}
                    {renderField('comoConheceu', 'Como Conheceu', selectedClient.comoConheceu)}
                    {renderField('conheceAlguemSituacao', 'Conhece Alguém na Situação', selectedClient.conheceAlguemSituacao)}
                    {renderField('conheceAlguemMesmaSituacao', 'Conhece Alguém Mesma Situação', selectedClient.conheceAlguemMesmaSituacao)}
                    <div>
                      <p className="text-muted-foreground">Data do Registro</p>
                      <p className="font-medium">{selectedClient.timestamp}</p>
                    </div>
                  </div>
                </div>

                {!isEditing && (
                  <>
                    <Separator />

                    {/* Qualification Preview - Editable */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <FileSignature className="h-4 w-4" />
                          Qualificação do Cliente
                        </h3>
                        {qualificationSaved && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Salvo
                          </Badge>
                        )}
                      </div>
                      <Textarea
                        value={editedQualification}
                        onChange={(e) => {
                          setEditedQualification(e.target.value);
                          setQualificationSaved(false);
                        }}
                        className="min-h-[120px] text-sm leading-relaxed"
                        placeholder="Qualificação do cliente..."
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          Edite conforme necessário. A versão salva será usada nos documentos.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditedQualification(generateClientQualification(selectedClient));
                              setQualificationSaved(false);
                            }}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restaurar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setQualificationSaved(true);
                              toast.success("Qualificação salva com sucesso!");
                            }}
                            disabled={qualificationSaved}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Salvar
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-4">
                      <Button onClick={() => handleGenerateContract(selectedClient)}>
                        <FileSignature className="h-4 w-4 mr-2" />
                        Gerar Contrato
                      </Button>
                      <Button variant="outline" onClick={() => handleGenerateProcuracao(selectedClient)}>
                        <Scale className="h-4 w-4 mr-2" />
                        Gerar Procuração
                      </Button>
                      <Button variant="outline" onClick={() => handleGenerateDeclaracao(selectedClient)}>
                        <FileCheck className="h-4 w-4 mr-2" />
                        Gerar Declaração
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Selection Dialog - Only for Contracts */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Selecionar Produto
            </DialogTitle>
            <DialogDescription>
              Selecione o produto/serviço para o contrato de {clientForDocument?.nomeCompleto?.split(' ')[0]}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product">Produto *</Label>
              {productsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando produtos do RD Station...
                </div>
              ) : products.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  <p>Nenhum produto encontrado no RD Station.</p>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto" 
                    onClick={fetchProducts}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product._id} value={product._id}>
                        <div className="flex flex-col">
                          <span>{product.name}</span>
                          {product.base_price && (
                            <span className="text-xs text-muted-foreground">
                              R$ {product.base_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerateDocument} disabled={!selectedProduct || productsLoading}>
              <FileSignature className="h-4 w-4 mr-2" />
              Gerar Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Generator Dialog */}
      <ContractGenerator
        open={contractGeneratorOpen}
        onOpenChange={setContractGeneratorOpen}
        client={clientForDocument}
        productName={products.find(p => p._id === selectedProduct)?.name || ''}
        qualification={clientForDocument ? (qualificationSaved ? editedQualification : generateClientQualification(clientForDocument)) : ''}
      />

      {/* Procuração Generator Dialog */}
      <ProcuracaoGenerator
        open={procuracaoGeneratorOpen}
        onOpenChange={setProcuracaoGeneratorOpen}
        client={clientForProcuracao}
        qualification={clientForProcuracao ? (qualificationSaved && selectedClient?.id === clientForProcuracao.id ? editedQualification : generateClientQualification(clientForProcuracao)) : ''}
        objetoContrato={objetoContratoForProcuracao}
        productName={products.find(p => p._id === selectedProduct)?.name || ''}
      />

      {/* Document Templates Manager */}
      <DocumentTemplatesManager
        open={templatesManagerOpen}
        onOpenChange={setTemplatesManagerOpen}
      />

      {/* Declaração Generator Dialog */}
      <DeclaracaoGenerator
        open={declaracaoGeneratorOpen}
        onOpenChange={setDeclaracaoGeneratorOpen}
        client={clientForDeclaracao}
        qualification={clientForDeclaracao ? (qualificationSaved && selectedClient?.id === clientForDeclaracao.id ? editedQualification : generateClientQualification(clientForDeclaracao)) : ''}
      />
      </div>
    </Layout>
  );
};

export default SetorComercial;
