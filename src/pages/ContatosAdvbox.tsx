import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Users, Search, Phone, Mail, CreditCard, Cake, RefreshCw, User, Building2, MapPin, Briefcase, Edit, Save, X, Loader2, Plus, Tag, Megaphone, Settings, CheckCircle2, AlertTriangle, XCircle, MinusCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccessTracking } from '@/hooks/useAccessTracking';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import AniversariosClientes from './AniversariosClientes';

interface AdvboxContact {
  id: string;
  advbox_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  tax_id: string | null;
  birthday: string | null;
  synced_at: string;
  rg: string | null;
  orgao_emissor: string | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  estado_civil: string | null;
  profissao: string | null;
  sexo: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone_fixo: string | null;
  celular: string | null;
  telefone_comercial: string | null;
  nome_mae: string | null;
  nome_pai: string | null;
  observacoes: string | null;
  origem: string | null;
  raw_data: Record<string, any> | null;
}

interface VendedorConfig {
  id: string;
  vendedor_id: string;
  vendedor_nome: string;
  ativo: boolean;
  chatguru_user_id: string | null;
}

const EDITABLE_FIELDS = [
  { key: 'name', label: 'Nome Completo', section: 'pessoal' },
  { key: 'cpf', label: 'CPF', section: 'documentos' },
  { key: 'cnpj', label: 'CNPJ', section: 'documentos' },
  { key: 'rg', label: 'RG', section: 'documentos' },
  { key: 'orgao_emissor', label: 'Órgão Emissor', section: 'documentos' },
  { key: 'email', label: 'E-mail', section: 'contato' },
  { key: 'phone', label: 'Telefone Principal', section: 'contato' },
  { key: 'telefone_fixo', label: 'Telefone Fixo', section: 'contato' },
  { key: 'celular', label: 'Celular', section: 'contato' },
  { key: 'telefone_comercial', label: 'Telefone Comercial', section: 'contato' },
  { key: 'birthday', label: 'Data de Nascimento', section: 'pessoal' },
  { key: 'sexo', label: 'Sexo', section: 'pessoal' },
  { key: 'estado_civil', label: 'Estado Civil', section: 'pessoal' },
  { key: 'profissao', label: 'Profissão', section: 'pessoal' },
  { key: 'nacionalidade', label: 'Nacionalidade', section: 'pessoal' },
  { key: 'naturalidade', label: 'Naturalidade', section: 'pessoal' },
  { key: 'nome_mae', label: 'Nome da Mãe', section: 'familia' },
  { key: 'nome_pai', label: 'Nome do Pai', section: 'familia' },
  { key: 'endereco', label: 'Endereço', section: 'endereco' },
  { key: 'numero', label: 'Número', section: 'endereco' },
  { key: 'complemento', label: 'Complemento', section: 'endereco' },
  { key: 'bairro', label: 'Bairro', section: 'endereco' },
  { key: 'cidade', label: 'Cidade', section: 'endereco' },
  { key: 'estado', label: 'Estado', section: 'endereco' },
  { key: 'cep', label: 'CEP', section: 'endereco' },
  { key: 'origem', label: 'Origem', section: 'outros' },
  { key: 'observacoes', label: 'Observações', section: 'outros' },
] as const;

type FieldKey = typeof EDITABLE_FIELDS[number]['key'];

export default function ContatosAdvbox() {
  useAccessTracking();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [userName, setUserName] = useState('');
  const initialTab = searchParams.get('tab') === 'aniversarios' ? 'aniversarios' : 'contatos';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [contacts, setContacts] = useState<AdvboxContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<AdvboxContact | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createData, setCreateData] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [origens, setOrigens] = useState<string[]>([]);

  // Nova Demanda states
  const [showDemandaDialog, setShowDemandaDialog] = useState(false);
  const [demandaSearch, setDemandaSearch] = useState('');
  const [demandaResults, setDemandaResults] = useState<AdvboxContact[]>([]);
  const [demandaSearching, setDemandaSearching] = useState(false);
  const [selectedDemandaClient, setSelectedDemandaClient] = useState<AdvboxContact | null>(null);
  const [sendingDemanda, setSendingDemanda] = useState(false);

  // Vendedores config states
  const [showVendedoresConfig, setShowVendedoresConfig] = useState(false);
  const [vendedores, setVendedores] = useState<VendedorConfig[]>([]);
  const [loadingVendedores, setLoadingVendedores] = useState(false);

  // Admin config states
  const [adminConfig, setAdminConfig] = useState<Record<string, string>>({});
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Recent demandas for badge
  const [recentDemandas, setRecentDemandas] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 50;

  // Fetch user name
  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('full_name').eq('id', user.id).single().then(({ data }) => {
        if (data?.full_name) setUserName(data.full_name);
      });
    }
  }, [user?.id]);

  // Fetch available origins from ADVBox settings
  useEffect(() => {
    const fetchOrigens = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('advbox-integration/settings');
        if (!error && data?.customers_origins) {
          setOrigens(data.customers_origins.map((o: any) => typeof o === 'string' ? o : o.name || o.label || String(o)));
        }
      } catch {
        // Non-critical
      }
    };
    fetchOrigens();
  }, []);

  // Fetch recent demandas (last 7 days)
  useEffect(() => {
    const fetchRecentDemandas = async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data } = await supabase
        .from('comercial_demandas')
        .select('cliente_advbox_id')
        .gte('created_at', sevenDaysAgo.toISOString());
      if (data) {
        setRecentDemandas(new Set(data.map((d: any) => d.cliente_advbox_id)));
      }
    };
    fetchRecentDemandas();
  }, []);

  const fetchContacts = useCallback(async (search: string, pageNum: number) => {
    setLoading(true);
    try {
      let query = supabase
        .from('advbox_customers')
        .select('*', { count: 'exact' })
        .order('name')
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`name.ilike.${term},phone.ilike.${term},cpf.ilike.${term},cnpj.ilike.${term},tax_id.ilike.${term},email.ilike.${term},profissao.ilike.${term}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setContacts((data as AdvboxContact[]) || []);
      setTotalCount(count);
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'contatos') {
      const debounce = setTimeout(() => {
        setPage(0);
        fetchContacts(searchTerm, 0);
      }, 400);
      return () => clearTimeout(debounce);
    }
  }, [searchTerm, activeTab, fetchContacts]);

  useEffect(() => {
    if (activeTab === 'contatos' && page > 0) {
      fetchContacts(searchTerm, page);
    }
  }, [page]);

  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 0;

  const RAW_DATA_KEY_MAP: Record<string, string[]> = {
    cpf: ['identification', 'cpf', 'individual_registration'],
    rg: ['document', 'rg', 'identity_card'],
    profissao: ['occupation', 'profession', 'profissao'],
    estado_civil: ['civil_status', 'marital_status', 'estado_civil'],
    nacionalidade: ['country', 'nationality', 'nacionalidade'],
    endereco: ['street', 'address', 'endereco'],
    bairro: ['region', 'neighborhood', 'bairro'],
    cidade: ['city', 'cidade'],
    estado: ['state', 'estado'],
    cep: ['postalcode', 'zip_code', 'cep'],
    sexo: ['gender', 'sex', 'sexo'],
    celular: ['cellphone', 'mobile_phone', 'celular'],
    telefone_fixo: ['phone', 'landline', 'telefone_fixo'],
    observacoes: ['notes', 'observations', 'observacoes'],
    origem: ['origin', 'source', 'origem'],
  };

  const getVal = (contact: AdvboxContact, key: string): string => {
    const directVal = (contact as any)[key];
    if (directVal) return directVal;
    if (contact.raw_data) {
      if (contact.raw_data[key]) return contact.raw_data[key];
      const mappedKeys = RAW_DATA_KEY_MAP[key];
      if (mappedKeys) {
        for (const mk of mappedKeys) {
          if (contact.raw_data[mk]) return contact.raw_data[mk];
        }
      }
    }
    return '';
  };

  const startEditing = () => {
    if (!selectedContact) return;
    const data: Record<string, string> = {};
    EDITABLE_FIELDS.forEach(f => {
      data[f.key] = getVal(selectedContact, f.key);
    });
    setEditData(data);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditData({});
  };

  const saveChanges = async () => {
    if (!selectedContact) return;
    setSaving(true);
    try {
      const updatePayload: Record<string, any> = {};
      EDITABLE_FIELDS.forEach(f => {
        updatePayload[f.key] = editData[f.key] || null;
      });

      const { error: dbError } = await supabase
        .from('advbox_customers')
        .update(updatePayload)
        .eq('id', selectedContact.id);

      if (dbError) throw dbError;

      try {
        const advboxPayload: Record<string, any> = { customer_id: selectedContact.advbox_id };
        if (editData.name) advboxPayload.name = editData.name;
        if (editData.email) advboxPayload.email = editData.email;
        if (editData.phone) advboxPayload.phone = editData.phone;
        if (editData.cpf) advboxPayload.cpf = editData.cpf;
        if (editData.cnpj) advboxPayload.cnpj = editData.cnpj;
        if (editData.rg) advboxPayload.rg = editData.rg;
        if (editData.profissao) advboxPayload.profession = editData.profissao;
        if (editData.birthday) advboxPayload.birthdate = editData.birthday;
        if (editData.endereco) advboxPayload.address = editData.endereco;
        if (editData.numero) advboxPayload.number = editData.numero;
        if (editData.complemento) advboxPayload.complement = editData.complemento;
        if (editData.bairro) advboxPayload.neighborhood = editData.bairro;
        if (editData.cidade) advboxPayload.city = editData.cidade;
        if (editData.estado) advboxPayload.state = editData.estado;
        if (editData.cep) advboxPayload.zip_code = editData.cep;
        if (editData.estado_civil) advboxPayload.marital_status = editData.estado_civil;
        if (editData.observacoes) advboxPayload.observations = editData.observacoes;
        if (editData.origem) advboxPayload.origin = editData.origem;

        const { error: fnError } = await supabase.functions.invoke('advbox-integration/update-customer', {
          body: advboxPayload,
        });
        if (fnError) {
          console.warn('Erro ao sincronizar com ADVBox (dados locais salvos):', fnError);
          toast.warning('Dados salvos localmente. Sincronização com ADVBox pode ter falhado.');
        } else {
          toast.success('Contato atualizado com sucesso!');
        }
      } catch {
        toast.warning('Dados salvos localmente. Sincronização com ADVBox pode ter falhado.');
      }

      const updated = { ...selectedContact, ...updatePayload } as AdvboxContact;
      setSelectedContact(updated);
      setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
      setEditing(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!createData.name?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/create-customer', {
        body: createData,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Cliente cadastrado com sucesso no ADVBox!');
        setShowCreateDialog(false);
        setCreateData({});
        fetchContacts(searchTerm, page);
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao cadastrar cliente');
    } finally {
      setCreating(false);
    }
  };

  // Nova Demanda: search clients
  useEffect(() => {
    if (!demandaSearch.trim() || demandaSearch.length < 2) {
      setDemandaResults([]);
      return;
    }
    const debounce = setTimeout(async () => {
      setDemandaSearching(true);
      try {
        const term = `%${demandaSearch.trim()}%`;
        const { data } = await supabase
          .from('advbox_customers')
          .select('*')
          .or(`name.ilike.${term},phone.ilike.${term},cpf.ilike.${term}`)
          .order('name')
          .limit(10);
        setDemandaResults((data as AdvboxContact[]) || []);
      } catch {
        setDemandaResults([]);
      } finally {
        setDemandaSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [demandaSearch]);

  const handleSendDemanda = async () => {
    if (!selectedDemandaClient) return;
    setSendingDemanda(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-commercial-demand', {
        body: {
          cliente_advbox_id: String(selectedDemandaClient.advbox_id),
          cliente_nome: selectedDemandaClient.name,
          cliente_telefone: selectedDemandaClient.phone || selectedDemandaClient.celular || '',
          user_name: userName || 'Usuário',
        },
      });

      if (error) throw error;

      if (data?.success) {
        const steps: Array<{ key: string; label: string; ok: boolean; skipped?: boolean; message?: string | null }> =
          Array.isArray(data.steps_summary) ? data.steps_summary : [];

        const okCount = steps.filter((s) => s.ok).length;
        const skippedCount = steps.filter((s) => s.skipped).length;
        const failCount = steps.filter((s) => !s.ok && !s.skipped).length;

        const headerVariant: 'success' | 'warning' | 'error' =
          failCount > 0 ? 'error' : skippedCount > 0 ? 'warning' : 'success';

        toast.custom(
          (t) => (
            <div className="bg-card border border-border rounded-lg shadow-lg p-4 w-[380px] max-w-[90vw]">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  {headerVariant === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />}
                  {headerVariant === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />}
                  {headerVariant === 'error' && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                  <div>
                    <p className="font-semibold text-sm">
                      {headerVariant === 'success' && 'Demanda criada com sucesso'}
                      {headerVariant === 'warning' && 'Demanda criada com avisos'}
                      {headerVariant === 'error' && 'Demanda criada com falhas'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vendedor: {data.vendedor_nome} · {okCount} ok · {skippedCount} pulado · {failCount} falha
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toast.dismiss(t)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ul className="space-y-1.5 text-xs max-h-[260px] overflow-y-auto pr-1">
                {steps.map((step) => (
                  <li key={step.key} className="flex items-start gap-2">
                    {step.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    ) : step.skipped ? (
                      <MinusCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className={step.ok ? 'text-foreground' : step.skipped ? 'text-muted-foreground' : 'text-destructive'}>
                        {step.label}
                      </p>
                      {step.message && (
                        <p className="text-[11px] text-muted-foreground leading-tight">{step.message}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ),
          { duration: failCount > 0 || skippedCount > 0 ? 15000 : 7000 }
        );

        setRecentDemandas((prev) => new Set([...prev, String(selectedDemandaClient.advbox_id)]));
        setShowDemandaDialog(false);
        setSelectedDemandaClient(null);
        setDemandaSearch('');
        setDemandaResults([]);
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao criar demanda:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar demanda');
    } finally {
      setSendingDemanda(false);
    }
  };

  // Vendedores config
  const fetchVendedores = async () => {
    setLoadingVendedores(true);
    const { data } = await supabase
      .from('comercial_vendedores_config')
      .select('*')
      .order('vendedor_nome');
    setVendedores((data as VendedorConfig[]) || []);
    setLoadingVendedores(false);
  };

  const fetchAdminConfig = async () => {
    setLoadingConfig(true);
    const { data } = await supabase
      .from('comercial_config')
      .select('key, value');
    const map: Record<string, string> = {};
    if (data) data.forEach((r: any) => { map[r.key] = r.value; });
    setAdminConfig(map);
    setLoadingConfig(false);
  };

  const updateConfig = async (key: string, value: string) => {
    setAdminConfig(prev => ({ ...prev, [key]: value }));
    await supabase.from('comercial_config').update({ value } as any).eq('key', key);
  };

  const toggleVendedor = async (id: string, ativo: boolean) => {
    const { error } = await supabase
      .from('comercial_vendedores_config')
      .update({ ativo } as any)
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar vendedor');
    } else {
      setVendedores(prev => prev.map(v => v.id === id ? { ...v, ativo } : v));
      toast.success(ativo ? 'Vendedor ativado no rodízio' : 'Vendedor removido do rodízio');
    }
  };

  const renderSection = (title: string, sectionKey: string, icon: React.ReactNode) => {
    const fields = EDITABLE_FIELDS.filter(f => f.section === sectionKey);

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {icon}
          {title}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fields.map(f => {
            const val = editing ? editData[f.key] : getVal(selectedContact!, f.key);
            return (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                {editing ? (
                  f.key === 'origem' && origens.length > 0 ? (
                    <Select value={editData[f.key] || ''} onValueChange={v => setEditData(prev => ({ ...prev, [f.key]: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {origens.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={editData[f.key] || ''}
                      onChange={e => setEditData(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  )
                ) : (
                  <p className="text-sm font-medium">{val || <span className="text-muted-foreground/50 italic">—</span>}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCreateSection = (title: string, sectionKey: string, icon: React.ReactNode) => {
    const fields = EDITABLE_FIELDS.filter(f => f.section === sectionKey);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {icon}
          {title}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fields.map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {f.label} {f.key === 'name' && <span className="text-destructive">*</span>}
              </Label>
              {f.key === 'origem' && origens.length > 0 ? (
                <Select value={createData[f.key] || ''} onValueChange={v => setCreateData(prev => ({ ...prev, [f.key]: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {origens.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={createData[f.key] || ''}
                  onChange={e => setCreateData(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder={f.label}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Contatos ADVBox
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os contatos sincronizados do ADVBox
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="contatos" className="gap-2">
              <Users className="h-4 w-4" />
              Contatos
            </TabsTrigger>
            <TabsTrigger value="aniversarios" className="gap-2">
              <Cake className="h-4 w-4" />
              Aniversários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contatos" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone, CPF, CNPJ, e-mail ou profissão..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={() => {
                  setSelectedDemandaClient(null);
                  setDemandaSearch('');
                  setDemandaResults([]);
                  setShowDemandaDialog(true);
                }}
                className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Megaphone className="h-4 w-4" />
                Nova Demanda
              </Button>
              <Button onClick={() => { setCreateData({}); setShowCreateDialog(true); }} className="gap-2 shrink-0" variant="outline">
                <Plus className="h-4 w-4" />
                Novo Cliente
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { fetchVendedores(); fetchAdminConfig(); setShowVendedoresConfig(true); }}
                title="Configurar vendedores do rodízio"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {totalCount !== null
                  ? `${totalCount.toLocaleString('pt-BR')} contato${totalCount !== 1 ? 's' : ''} encontrado${totalCount !== 1 ? 's' : ''}`
                  : 'Carregando...'}
              </span>
              {totalPages > 1 && (
                <span>Página {page + 1} de {totalPages}</span>
              )}
            </div>

            <ScrollArea className="h-[calc(100vh-340px)]">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm ? 'Nenhum contato encontrado para esta busca' : 'Nenhum contato disponível'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <Card
                      key={contact.id}
                      className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/30"
                      onClick={() => { setSelectedContact(contact); setEditing(false); }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm truncate">{contact.name}</p>
                              {recentDemandas.has(String(contact.advbox_id)) && (
                                <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 shrink-0">
                                  Demanda
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {contact.phone}
                                </span>
                              )}
                              {contact.email && (
                                <span className="flex items-center gap-1 truncate max-w-[200px]">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  {contact.email}
                                </span>
                              )}
                              {(contact.cpf || contact.cnpj || contact.tax_id) && (
                                <span className="flex items-center gap-1">
                                  <CreditCard className="h-3 w-3" />
                                  {contact.cpf || contact.cnpj || contact.tax_id}
                                </span>
                              )}
                            </div>
                          </div>
                          {contact.birthday && (
                            <Badge variant="outline" className="shrink-0 ml-2 text-xs">
                              <Cake className="h-3 w-3 mr-1" />
                              {format(new Date(contact.birthday), 'dd/MM')}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Próxima
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="aniversarios">
            <AniversariosClientes embedded />
          </TabsContent>
        </Tabs>
      </div>

      {/* Contact Detail Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={(open) => { if (!open) { setSelectedContact(null); setEditing(false); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {editing ? 'Editar Contato' : 'Detalhes do Contato'}
              </DialogTitle>
              {!editing && (
                <Button variant="outline" size="sm" onClick={startEditing} className="gap-1">
                  <Edit className="h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
            </div>
          </DialogHeader>

          {selectedContact && (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-4">
                {!editing && (
                  <div className="text-center pb-3 border-b">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <User className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold">{selectedContact.name}</h3>
                    <p className="text-xs text-muted-foreground">ID ADVBox: {selectedContact.advbox_id}</p>
                  </div>
                )}

                {renderSection('Dados Pessoais', 'pessoal', <User className="h-3.5 w-3.5" />)}
                <Separator />
                {renderSection('Documentos', 'documentos', <CreditCard className="h-3.5 w-3.5" />)}
                <Separator />
                {renderSection('Contato', 'contato', <Phone className="h-3.5 w-3.5" />)}
                <Separator />
                {renderSection('Família', 'familia', <Users className="h-3.5 w-3.5" />)}
                <Separator />
                {renderSection('Endereço', 'endereco', <MapPin className="h-3.5 w-3.5" />)}
                <Separator />
                {renderSection('Outros', 'outros', <Tag className="h-3.5 w-3.5" />)}

                {!editing && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshCw className="h-3 w-3" />
                      Sincronizado em {format(new Date(selectedContact.synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}

          {editing && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button onClick={saveChanges} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Cadastrar Novo Cliente
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-4">
              {renderCreateSection('Dados Pessoais', 'pessoal', <User className="h-3.5 w-3.5" />)}
              <Separator />
              {renderCreateSection('Documentos', 'documentos', <CreditCard className="h-3.5 w-3.5" />)}
              <Separator />
              {renderCreateSection('Contato', 'contato', <Phone className="h-3.5 w-3.5" />)}
              <Separator />
              {renderCreateSection('Família', 'familia', <Users className="h-3.5 w-3.5" />)}
              <Separator />
              {renderCreateSection('Endereço', 'endereco', <MapPin className="h-3.5 w-3.5" />)}
              <Separator />
              {renderCreateSection('Outros', 'outros', <Tag className="h-3.5 w-3.5" />)}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button onClick={handleCreateCustomer} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova Demanda Dialog */}
      <Dialog open={showDemandaDialog} onOpenChange={setShowDemandaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Megaphone className="h-5 w-5" />
              Nova Demanda
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Selecionar Cliente</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou CPF..."
                  value={demandaSearch}
                  onChange={(e) => {
                    setDemandaSearch(e.target.value);
                    setSelectedDemandaClient(null);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {demandaSearching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            )}

            {!selectedDemandaClient && demandaResults.length > 0 && (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {demandaResults.map((c) => (
                    <div
                      key={c.id}
                      className="p-2 rounded-md cursor-pointer hover:bg-accent text-sm border"
                      onClick={() => {
                        setSelectedDemandaClient(c);
                        setDemandaSearch(c.name);
                        setDemandaResults([]);
                      }}
                    >
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.phone || c.celular || '—'} • {c.cpf || c.cnpj || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {selectedDemandaClient && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{selectedDemandaClient.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedDemandaClient.phone || selectedDemandaClient.celular || 'Sem telefone'}
                        {selectedDemandaClient.cpf && ` • CPF: ${selectedDemandaClient.cpf}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        setSelectedDemandaClient(null);
                        setDemandaSearch('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">O que acontece ao enviar:</p>
              <p>• Um vendedor será atribuído automaticamente por rodízio</p>
              <p>• Uma observação será registrada no ChatGuru</p>
              <p>• O chat será marcado como "aberto" no ChatGuru</p>
              <p>• Uma tarefa será criada no CRM</p>
              <p>• Marcos e o setor comercial serão marcados como responsáveis</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDemandaDialog(false)} disabled={sendingDemanda}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendDemanda}
              disabled={!selectedDemandaClient || sendingDemanda}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {sendingDemanda ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Enviar Demanda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendedores Config Dialog */}
      <Dialog open={showVendedoresConfig} onOpenChange={setShowVendedoresConfig}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações do Comercial
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-5">
              {/* Vendedores */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Vendedores do Rodízio</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Ative ou desative vendedores do rodízio automático.
                </p>

                {loadingVendedores ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : vendedores.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-4">Nenhum vendedor configurado</p>
                ) : (
                  vendedores.map((v) => (
                    <div key={v.id} className="p-3 border rounded-lg space-y-2 mb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${v.ativo ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
                            <User className={`h-4 w-4 ${v.ativo ? 'text-green-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{v.vendedor_nome}</p>
                            <p className="text-xs text-muted-foreground">{v.ativo ? 'Ativo no rodízio' : 'Inativo'}</p>
                          </div>
                        </div>
                        <Switch
                          checked={v.ativo}
                          onCheckedChange={(checked) => toggleVendedor(v.id, checked)}
                        />
                      </div>
                      <div className="pl-11">
                        <Label className="text-xs text-muted-foreground">ID ChatGuru</Label>
                        <Input
                          value={v.chatguru_user_id || ''}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setVendedores(prev => prev.map(vv => vv.id === v.id ? { ...vv, chatguru_user_id: newVal } : vv));
                          }}
                          onBlur={async (e) => {
                            const newVal = e.target.value || null;
                            await supabase.from('comercial_vendedores_config').update({ chatguru_user_id: newVal } as any).eq('id', v.id);
                          }}
                          placeholder="Ex: 66392c1575f9357baf26ad8a"
                          className="h-7 text-xs mt-1"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              {/* Admin Config */}
              {loadingConfig ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Participantes Obrigatórios</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Marcos (Head Comercial)</p>
                          <p className="text-xs text-muted-foreground">Sempre marcado como responsável</p>
                        </div>
                        <Switch
                          checked={adminConfig['marcos_obrigatorio'] !== 'false'}
                          onCheckedChange={(checked) => updateConfig('marcos_obrigatorio', checked ? 'true' : 'false')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 pr-2">
                          <p className="text-sm font-medium">Setor Comercial</p>
                          <p className="text-xs text-muted-foreground">Marcar setor como responsável</p>
                          {!adminConfig['setor_comercial_chatguru_id'] && (
                            <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>O ChatGuru não possui um usuário "Setor Comercial". Sem o ID, esta atribuição é ignorada automaticamente.</span>
                            </div>
                          )}
                        </div>
                        <Switch
                          checked={adminConfig['setor_comercial_obrigatorio'] !== 'false' && !!adminConfig['setor_comercial_chatguru_id']}
                          disabled={!adminConfig['setor_comercial_chatguru_id']}
                          onCheckedChange={(checked) => updateConfig('setor_comercial_obrigatorio', checked ? 'true' : 'false')}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-semibold mb-3">Integração ChatGuru</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">ChatGuru ativo</p>
                          <p className="text-xs text-muted-foreground">Enviar notas e marcações automaticamente</p>
                        </div>
                        <Switch
                          checked={adminConfig['chatguru_ativo'] !== 'false'}
                          onCheckedChange={(checked) => updateConfig('chatguru_ativo', checked ? 'true' : 'false')}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Texto da observação no ChatGuru</Label>
                        <Input
                          value={adminConfig['texto_observacao_chatguru'] || 'Nova análise de caso para o comercial'}
                          onChange={(e) => setAdminConfig(prev => ({ ...prev, texto_observacao_chatguru: e.target.value }))}
                          onBlur={(e) => updateConfig('texto_observacao_chatguru', e.target.value)}
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">ID ChatGuru do Setor Comercial</Label>
                        <Input
                          value={adminConfig['setor_comercial_chatguru_id'] || ''}
                          onChange={(e) => setAdminConfig(prev => ({ ...prev, setor_comercial_chatguru_id: e.target.value }))}
                          onBlur={(e) => updateConfig('setor_comercial_chatguru_id', e.target.value)}
                          placeholder="Preencher quando localizado"
                          className="h-8 text-sm mt-1"
                        />
                        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                          <Info className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>O ChatGuru não disponibiliza um perfil "Setor Comercial". Sem ID válido, esta etapa é pulada — apenas o vendedor do rodízio e o Marcos são marcados como responsáveis.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-semibold mb-3">Tarefa Comercial</h4>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Método de distribuição</Label>
                        <Select
                          value={adminConfig['metodo_distribuicao'] || 'rodizio'}
                          onValueChange={(v) => updateConfig('metodo_distribuicao', v)}
                        >
                          <SelectTrigger className="h-8 text-sm mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rodizio">Rodízio (round-robin)</SelectItem>
                            <SelectItem value="sorteio">Sorteio aleatório</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Prazo padrão da tarefa (horas)</Label>
                        <Input
                          type="number"
                          value={adminConfig['prazo_padrao_horas'] || '48'}
                          onChange={(e) => setAdminConfig(prev => ({ ...prev, prazo_padrao_horas: e.target.value }))}
                          onBlur={(e) => updateConfig('prazo_padrao_horas', e.target.value || '48')}
                          className="h-8 text-sm mt-1 w-24"
                          min={1}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
