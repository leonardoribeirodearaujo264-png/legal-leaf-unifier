import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, Phone, Mail, CreditCard, Cake, RefreshCw, User, Calendar, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccessTracking } from '@/hooks/useAccessTracking';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
}

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
        query = query.or(`name.ilike.${term},phone.ilike.${term},cpf.ilike.${term},cnpj.ilike.${term},tax_id.ilike.${term},email.ilike.${term}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setContacts(data || []);
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

  const formatDoc = (contact: AdvboxContact) => {
    if (contact.cpf) return contact.cpf;
    if (contact.cnpj) return contact.cnpj;
    if (contact.tax_id) return contact.tax_id;
    return null;
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
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, CPF, CNPJ ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Stats */}
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

            {/* List */}
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
                      onClick={() => setSelectedContact(contact)}
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
                              {formatDoc(contact) && (
                                <span className="flex items-center gap-1">
                                  <CreditCard className="h-3 w-3" />
                                  {formatDoc(contact)}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="aniversarios">
            <AniversariosClientesEmbedded />
          </TabsContent>
        </Tabs>
      </div>

      {/* Contact Detail Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Detalhes do Contato
            </DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold">{selectedContact.name}</h3>
                <p className="text-xs text-muted-foreground">ID ADVBox: {selectedContact.advbox_id}</p>
              </div>

              <div className="space-y-3">
                {selectedContact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="text-sm font-medium">{selectedContact.phone}</p>
                    </div>
                  </div>
                )}
                {selectedContact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">E-mail</p>
                      <p className="text-sm font-medium">{selectedContact.email}</p>
                    </div>
                  </div>
                )}
                {selectedContact.cpf && (
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">CPF</p>
                      <p className="text-sm font-medium">{selectedContact.cpf}</p>
                    </div>
                  </div>
                )}
                {selectedContact.cnpj && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">CNPJ</p>
                      <p className="text-sm font-medium">{selectedContact.cnpj}</p>
                    </div>
                  </div>
                )}
                {selectedContact.tax_id && !selectedContact.cpf && !selectedContact.cnpj && (
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Documento</p>
                      <p className="text-sm font-medium">{selectedContact.tax_id}</p>
                    </div>
                  </div>
                )}
                {selectedContact.birthday && (
                  <div className="flex items-center gap-3">
                    <Cake className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Nascimento</p>
                      <p className="text-sm font-medium">
                        {format(new Date(selectedContact.birthday), "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Última Sincronização</p>
                    <p className="text-sm font-medium">
                      {format(new Date(selectedContact.synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

// Wrapper that renders AniversariosClientes content without its own Layout
function AniversariosClientesEmbedded() {
  return <AniversariosClientes embedded />;
}
