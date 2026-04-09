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
import { Users, Search, Phone, Mail, CreditCard, Cake, RefreshCw, User, Building2, MapPin, Briefcase, Edit, Save, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccessTracking } from '@/hooks/useAccessTracking';
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
  raw_data: Record<string, any> | null;
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
  { key: 'observacoes', label: 'Observações', section: 'outros' },
] as const;

type FieldKey = typeof EDITABLE_FIELDS[number]['key'];

export default function ContatosAdvbox() {
  useAccessTracking();
  const [searchParams] = useSearchParams();
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
  const PAGE_SIZE = 50;

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

  const getVal = (contact: AdvboxContact, key: string): string => {
    const directVal = (contact as any)[key];
    if (directVal) return directVal;
    // Fallback to raw_data
    if (contact.raw_data && contact.raw_data[key]) return contact.raw_data[key];
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
      // 1. Update local DB
      const updatePayload: Record<string, any> = {};
      EDITABLE_FIELDS.forEach(f => {
        updatePayload[f.key] = editData[f.key] || null;
      });

      const { error: dbError } = await supabase
        .from('advbox_customers')
        .update(updatePayload)
        .eq('id', selectedContact.id);

      if (dbError) throw dbError;

      // 2. Sync to ADVBox via edge function
      try {
        const advboxPayload: Record<string, any> = { customer_id: selectedContact.advbox_id };
        // Map fields to possible ADVBox API field names
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

      // Update local state
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

  const renderSection = (title: string, sectionKey: string, icon: React.ReactNode) => {
    const fields = EDITABLE_FIELDS.filter(f => f.section === sectionKey);
    const hasData = fields.some(f => editing ? editData[f.key] : getVal(selectedContact!, f.key));
    if (!editing && !hasData) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {icon}
          {title}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fields.map(f => {
            const val = editing ? editData[f.key] : getVal(selectedContact!, f.key);
            if (!editing && !val) return null;
            return (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                {editing ? (
                  <Input
                    value={editData[f.key] || ''}
                    onChange={e => setEditData(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium">{val}</p>
                )}
              </div>
            );
          })}
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, CPF, CNPJ, e-mail ou profissão..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
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
                            <p className="font-semibold text-sm truncate">{contact.name}</p>
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
                {/* Header */}
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
                {renderSection('Outros', 'outros', <Briefcase className="h-3.5 w-3.5" />)}

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
    </Layout>
  );
}
