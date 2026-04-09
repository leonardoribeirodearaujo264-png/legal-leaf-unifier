import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cake, Calendar, Copy, Download, Ban, Eye, EyeOff, Send, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { useUserRole } from '@/hooks/useUserRole';
import HistoricoMensagensAniversario from './HistoricoMensagensAniversario';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birthday: string;
}

interface CustomerExclusion {
  id: string;
  customer_id: string;
  customer_name: string;
  reason: string | null;
  excluded_by: string;
  created_at: string;
}

type FilterType = 'dia' | 'semana' | 'mes';

export default function AniversariosClientes({ embedded = false }: { embedded?: boolean }) {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'historico' ? 'historico' : 'aniversarios';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { isAdmin } = useUserRole();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [exclusions, setExclusions] = useState<CustomerExclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('mes');
  const [showExcluded, setShowExcluded] = useState(false);
  const [excludeDialogOpen, setExcludeDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [exclusionReason, setExclusionReason] = useState('');
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);
  const [sendingMessages, setSendingMessages] = useState(false);
  const [confirmSendDialogOpen, setConfirmSendDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [filter, customers, exclusions, showExcluded]);

  const fetchData = async () => {
    await Promise.all([
      fetchCustomerBirthdays(),
      fetchExclusions(),
    ]);
  };

  const fetchExclusions = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_birthday_exclusions')
        .select('*');

      if (error) throw error;
      setExclusions(data || []);
    } catch (error) {
      console.error('Error fetching exclusions:', error);
    }
  };

  const fetchCustomerBirthdays = async (forceRefresh = false) => {
    setLoading(true);
    try {
      console.log('Fetching customer birthdays...');
      const { data, error } = await supabase.functions.invoke('advbox-integration/customer-birthdays', {
        body: { force_refresh: forceRefresh },
      });

      console.log('Customer birthdays raw response:', { data, error });

      if (error) {
        console.error('Error from edge function:', error);
        throw error;
      }

      // A resposta vem como: { data: { data: { data: [...], offset, limit, totalCount } } }
      const apiResponse = (data as any)?.data || data;
      const rawCustomers: any[] = apiResponse?.data || [];
      setMetadata((data as any)?.metadata);
      setLastUpdate(new Date());

      console.log('Parsed customers array:', rawCustomers);

      const normalizedCustomers: Customer[] = rawCustomers
        .map((c) => {
          // birthdate vem da API no formato dd/MM/yyyy
          let birthdayIso = '';
          const rawBirth = c.birthdate || c.birthday;

          if (rawBirth) {
            const parts = String(rawBirth).split(/[\/\-]/); // aceita 06/11/1933
            if (parts.length === 3) {
              const [day, month, year] = parts;
              const date = new Date(Number(year), Number(month) - 1, Number(day));
              if (!isNaN(date.getTime())) {
                birthdayIso = date.toISOString();
              }
            } else {
              const date = new Date(rawBirth);
              if (!isNaN(date.getTime())) {
                birthdayIso = date.toISOString();
              }
            }
          }

          if (!birthdayIso) return null;

          return {
            id: String(c.id ?? c.customer_id ?? ''),
            name: c.name ?? '',
            email: c.email ?? undefined,
            // Priorizar sempre o celular em vez do telefone fixo
            phone: c.cellphone ?? c.phone ?? undefined,
            birthday: birthdayIso,
          } as Customer;
        })
        .filter((c): c is Customer => c !== null);

      console.log('Normalized customers:', normalizedCustomers);
      setCustomers(normalizedCustomers);

      if (forceRefresh) {
        toast({
          title: 'Dados atualizados',
          description: 'Os aniversários foram recarregados.',
        });
      }
    } catch (error) {
      console.error('Error fetching customer birthdays:', error);
      toast({
        title: 'Erro ao carregar aniversários',
        description: 'Não foi possível carregar os aniversários dos clientes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    if (!customers.length) {
      setFilteredCustomers([]);
      return;
    }

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const excludedIds = new Set(exclusions.map(e => e.customer_id));

    let filtered = customers.filter((customer) => {
      // Filtro de exclusão
      const isExcluded = excludedIds.has(customer.id);
      if (!showExcluded && isExcluded) return false;

      const birthday = new Date(customer.birthday);
      const birthDay = birthday.getDate();
      const birthMonth = birthday.getMonth();
      
      switch (filter) {
        case 'dia':
          return birthDay === currentDay && birthMonth === currentMonth;
        
        case 'semana':
          const weekEnd = new Date(currentYear, currentMonth, currentDay + 7);
          const birthThisYear = new Date(currentYear, birthMonth, birthDay);
          const birthToCompare = birthThisYear < now 
            ? new Date(currentYear + 1, birthMonth, birthDay)
            : birthThisYear;
          return birthToCompare >= now && birthToCompare <= weekEnd;
        
        case 'mes':
          return birthMonth === currentMonth;
        
        default:
          return true;
      }
    });

    filtered.sort((a, b) => {
      const dateA = new Date(a.birthday);
      const dateB = new Date(b.birthday);
      return dateA.getDate() - dateB.getDate();
    });

    setFilteredCustomers(filtered);
  };

  const copyContactsToClipboard = async () => {
    if (filteredCustomers.length === 0) {
      toast({
        title: 'Nenhum contato para copiar',
        description: 'Não há aniversariantes no período selecionado.',
        variant: 'destructive',
      });
      return;
    }

    const excludedIds = new Set(exclusions.map(e => e.customer_id));
    const contactsToCopy = filteredCustomers.filter(c => !excludedIds.has(c.id));

    if (contactsToCopy.length === 0) {
      toast({
        title: 'Nenhum contato para copiar',
        description: 'Todos os clientes deste período estão marcados como "não enviar".',
        variant: 'destructive',
      });
      return;
    }

    const filterLabel = 
      filter === 'dia' ? 'Hoje' :
      filter === 'semana' ? 'Esta Semana' :
      'Este Mês';

    let textToCopy = `📅 Aniversariantes - ${filterLabel}\n`;
    textToCopy += `Total: ${contactsToCopy.length} ${contactsToCopy.length === 1 ? 'cliente' : 'clientes'}\n`;
    textToCopy += `\n`;

    contactsToCopy.forEach((customer, index) => {
      const birthday = new Date(customer.birthday);
      const day = birthday.getDate().toString().padStart(2, '0');
      const month = (birthday.getMonth() + 1).toString().padStart(2, '0');
      
      textToCopy += `${index + 1}. ${customer.name}\n`;
      textToCopy += `   📅 ${day}/${month}\n`;
      
      if (customer.phone) {
        textToCopy += `   📱 ${customer.phone}\n`;
      }
      
      if (customer.email) {
        textToCopy += `   📧 ${customer.email}\n`;
      }
      
      textToCopy += `\n`;
    });

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: 'Contatos copiados!',
        description: `${contactsToCopy.length} ${contactsToCopy.length === 1 ? 'contato foi copiado' : 'contatos foram copiados'} para a área de transferência.`,
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar os contatos. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const exportToCSV = () => {
    if (filteredCustomers.length === 0) {
      toast({
        title: 'Nenhum contato para exportar',
        description: 'Não há aniversariantes no período selecionado.',
        variant: 'destructive',
      });
      return;
    }

    const excludedIds = new Set(exclusions.map(e => e.customer_id));
    const contactsToExport = filteredCustomers.filter(c => !excludedIds.has(c.id));

    if (contactsToExport.length === 0) {
      toast({
        title: 'Nenhum contato para exportar',
        description: 'Todos os clientes deste período estão marcados como "não enviar".',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['Nome', 'Data Aniversário', 'Telefone', 'Email'];
    const rows = contactsToExport.map(customer => {
      const birthday = new Date(customer.birthday);
      const day = birthday.getDate().toString().padStart(2, '0');
      const month = (birthday.getMonth() + 1).toString().padStart(2, '0');
      
      return [
        customer.name,
        `${day}/${month}`,
        customer.phone || '',
        customer.email || '',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const filterLabel = 
      filter === 'dia' ? 'hoje' :
      filter === 'semana' ? 'semana' :
      'mes';
    
    link.setAttribute('href', url);
    link.setAttribute('download', `aniversariantes_${filterLabel}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'CSV exportado!',
      description: `${contactsToExport.length} ${contactsToExport.length === 1 ? 'contato foi exportado' : 'contatos foram exportados'}.`,
    });
  };

  const handleExcludeCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setExclusionReason('');
    setExcludeDialogOpen(true);
  };

  const confirmExclusion = async () => {
    if (!selectedCustomer) return;

    try {
      const { error } = await supabase
        .from('customer_birthday_exclusions')
        .insert({
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          reason: exclusionReason || null,
          excluded_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;

      await fetchExclusions();
      setExcludeDialogOpen(false);
      setSelectedCustomer(null);
      setExclusionReason('');

      toast({
        title: 'Cliente marcado',
        description: `${selectedCustomer.name} não receberá mensagens de aniversário.`,
      });
    } catch (error: any) {
      console.error('Error excluding customer:', error);
      toast({
        title: 'Erro ao marcar cliente',
        description: error.message || 'Não foi possível marcar o cliente.',
        variant: 'destructive',
      });
    }
  };

  const handleUnexcludeCustomer = async (customerId: string, customerName: string) => {
    try {
      const { error } = await supabase
        .from('customer_birthday_exclusions')
        .delete()
        .eq('customer_id', customerId);

      if (error) throw error;

      await fetchExclusions();

      toast({
        title: 'Marca removida',
        description: `${customerName} voltará a receber mensagens de aniversário.`,
      });
    } catch (error: any) {
      console.error('Error unexcluding customer:', error);
      toast({
        title: 'Erro ao desmarcar cliente',
        description: error.message || 'Não foi possível desmarcar o cliente.',
        variant: 'destructive',
      });
    }
  };

  const isCustomerExcluded = (customerId: string) => {
    return exclusions.some(e => e.customer_id === customerId);
  };

  const getTodayCustomers = () => {
    const excludedIds = new Set(exclusions.map(e => e.customer_id));
    const now = new Date();
    return customers
      .filter(c => {
        const birthday = new Date(c.birthday);
        return birthday.getDate() === now.getDate() &&
               birthday.getMonth() === now.getMonth() &&
               !excludedIds.has(c.id) &&
               c.phone;
      })
      .map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        birthday: c.birthday,
      }));
  };

  const handleSendBirthdayMessages = async (forceResend = false) => {
    setConfirmSendDialogOpen(false);
    setSendingMessages(true);

    try {
      const todayCustomers = getTodayCustomers();

      const { data, error } = await supabase.functions.invoke('birthday-messages', {
        body: { customers: todayCustomers, forceResend },
      });

      if (error) {
        throw error;
      }

      const results = data?.results;

      if (results) {
        const wasForceResend = forceResend || results.forceResend;
        
        if (results.backgroundProcessing) {
          toast({
            title: wasForceResend ? 'Reenvio iniciado via WhatsApp Avisos' : 'Envio iniciado via WhatsApp Avisos',
            description: `${results.total} mensagem(ns) serão enviadas em background com intervalo de segurança. Acompanhe no histórico.`,
          });
        } else if (results.total === 0 && (!results.alreadySentToday || results.alreadySentToday === 0)) {
          toast({
            title: 'Nenhum aniversariante elegível',
            description: 'Nenhum aniversariante elegível encontrado para envio hoje. Verifique se há clientes com aniversário hoje e telefone cadastrado.',
            variant: 'destructive',
          });
        } else if (results.total === 0 && results.alreadySentToday > 0 && !wasForceResend) {
          toast({
            title: 'Mensagens já enviadas',
            description: `Todas as ${results.alreadySentToday} mensagens de hoje já foram enviadas anteriormente. Use "Reenviar" se precisar enviar novamente.`,
          });
        } else if (results.remaining > 0) {
          toast({
            title: 'Processamento parcial',
            description: `${results.sent} enviada(s), ${results.remaining} pendente(s). Clique novamente para continuar o envio.`,
          });
        } else {
          toast({
            title: wasForceResend ? 'Reenvio concluído!' : 'Mensagens enviadas!',
            description: `${results.sent} mensagem(ns) enviada(s) com sucesso via WhatsApp Avisos.${results.failed > 0 ? ` ${results.failed} falhou(aram).` : ''}`,
          });
        }

        if (results.errors && results.errors.length > 0) {
          console.error('Errors sending messages:', results.errors);
        }
      } else {
        toast({
          title: 'Mensagens processadas',
          description: 'As mensagens de aniversário foram processadas via WhatsApp Avisos.',
        });
      }
    } catch (error: any) {
      console.error('Error sending birthday messages:', error);
      toast({
        title: 'Erro ao enviar mensagens',
        description: error.message || 'Não foi possível enviar as mensagens de aniversário.',
        variant: 'destructive',
      });
    } finally {
      setSendingMessages(false);
    }
  };

  const openConfirmSendDialog = () => {
    const excludedIds = new Set(exclusions.map(e => e.customer_id));
    const todayCustomers = customers.filter((customer) => {
      const birthday = new Date(customer.birthday);
      const now = new Date();
      return birthday.getDate() === now.getDate() && 
             birthday.getMonth() === now.getMonth() &&
             !excludedIds.has(customer.id) &&
             customer.phone;
    });

    if (todayCustomers.length === 0) {
      toast({
        title: 'Nenhuma mensagem para enviar',
        description: 'Não há aniversariantes hoje com telefone cadastrado que possam receber mensagens.',
        variant: 'destructive',
      });
      return;
    }

    setConfirmSendDialogOpen(true);
  };

  const content = (
    <>
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Cake className="h-8 w-8 text-primary" />
            Aniversários de Clientes
          </h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe os aniversários dos seus clientes
          </p>
          <div className="mt-2">
            <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
          </div>
        </div>
      </div>

        {metadata && <AdvboxCacheAlert metadata={metadata} />}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="aniversarios" className="gap-2">
              <Cake className="h-4 w-4" />
              Aniversários
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="historico" className="gap-2">
                <History className="h-4 w-4" />
                Histórico de Mensagens
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="aniversarios" className="space-y-4">

        {/* Filtros e Ações */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2">
              <Button
                variant={filter === 'dia' ? 'default' : 'outline'}
                onClick={() => setFilter('dia')}
                size="sm"
              >
                Hoje
              </Button>
              <Button
                variant={filter === 'semana' ? 'default' : 'outline'}
                onClick={() => setFilter('semana')}
                size="sm"
              >
                Esta Semana
              </Button>
              <Button
                variant={filter === 'mes' ? 'default' : 'outline'}
                onClick={() => setFilter('mes')}
                size="sm"
              >
                Este Mês
              </Button>
            </div>
            
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExcluded(!showExcluded)}
              >
                {showExcluded ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showExcluded ? 'Ocultar Excluídos' : 'Mostrar Excluídos'}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={openConfirmSendDialog}
              disabled={sendingMessages}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendingMessages ? 'Enviando...' : 'Enviar Mensagens de Aniversário'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSendBirthdayMessages(true)}
              disabled={sendingMessages}
              title="Reenviar ignorando mensagens já enviadas hoje"
            >
              <Send className="h-4 w-4 mr-2" />
              Reenviar Mensagens
            </Button>
            
            {filteredCustomers.length > 0 && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyContactsToClipboard}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Contatos
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={exportToCSV}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Lista de Aniversariantes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Aniversariantes
              {filter === 'dia' && ' de Hoje'}
              {filter === 'semana' && ' da Semana'}
              {filter === 'mes' && ' do Mês'}
            </CardTitle>
            <CardDescription>
              {filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente' : 'clientes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <Cake className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum aniversariante encontrado para este período
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCustomers.map((customer) => {
                    const excluded = isCustomerExcluded(customer.id);
                    return (
                      <Card key={customer.id} className={`hover:shadow-md transition-shadow ${excluded ? 'opacity-60 border-destructive/50' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-sm">{customer.name}</p>
                                {excluded && (
                                  <Badge variant="destructive" className="text-xs">
                                    <Ban className="h-3 w-3 mr-1" />
                                    Não enviar
                                  </Badge>
                                )}
                              </div>
                              {customer.email && (
                                <p className="text-sm text-muted-foreground">{customer.email}</p>
                              )}
                              {customer.phone && (
                                <p className="text-sm text-muted-foreground">{customer.phone}</p>
                              )}
                              {excluded && (
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                  {exclusions.find(e => e.customer_id === customer.id)?.reason || 'Cliente excluído das mensagens de aniversário'}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge className="mb-1">
                                {format(new Date(customer.birthday), 'dd/MM', { locale: ptBR })}
                              </Badge>
                              {excluded ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnexcludeCustomer(customer.id, customer.name)}
                                  className="h-8 text-xs"
                                >
                                  Desmarcar
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleExcludeCustomer(customer)}
                                  className="h-8 text-xs text-destructive hover:text-destructive"
                                >
                                  <Ban className="h-3 w-3 mr-1" />
                                  Não enviar
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="historico">
              <HistoricoMensagensAniversario embedded defaultTypeFilter="birthday" />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Dialog de Exclusão */}
      <Dialog open={excludeDialogOpen} onOpenChange={setExcludeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar cliente como "não enviar"</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.name} não receberá mensagens de aniversário. Esta marcação é permanente até ser removida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                placeholder="Ex: Cliente solicitou não receber mensagens, problemas anteriores com o escritório, etc."
                value={exclusionReason}
                onChange={(e) => setExclusionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcludeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmExclusion}>
              <Ban className="h-4 w-4 mr-2" />
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Envio */}
      <Dialog open={confirmSendDialogOpen} onOpenChange={setConfirmSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Mensagens de Aniversário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja enviar as mensagens de aniversário para os clientes de hoje?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              As mensagens serão enviadas apenas para os clientes que fazem aniversário hoje, 
              que têm telefone cadastrado e que não estão marcados como "não enviar".
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              As mensagens serão enviadas via WhatsApp Avisos (Z-API) com intervalo de segurança entre cada envio para evitar bloqueios.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleSendBirthdayMessages(false)}>
              <Send className="h-4 w-4 mr-2" />
              Confirmar Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (loading && !embedded) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando aniversários...</div>
        </div>
      </Layout>
    );
  }

  if (loading && embedded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Carregando aniversários...</div>
      </div>
    );
  }

  if (embedded) return content;

  return <Layout>{content}</Layout>;
}
