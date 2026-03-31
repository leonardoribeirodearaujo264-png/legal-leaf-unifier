import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Star, Phone, Mail, Building2, Calendar, FileText, DollarSign, Plus, Pencil, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IndicacaoDialog } from './IndicacaoDialog';
import { PagamentoParceiroDialog } from './PagamentoParceiroDialog';
import { EditarParcelaDialog } from './EditarParcelaDialog';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useUserRole } from '@/hooks/useUserRole';

interface Parceiro {
  id: string;
  nome_completo: string;
  nome_escritorio: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ranking: number;
  tipo: string;
  ativo: boolean;
  data_cadastro: string;
  areas: { id: string; nome: string }[];
}

interface Indicacao {
  id: string;
  tipo_indicacao: string;
  nome_cliente: string;
  descricao_caso: string | null;
  percentual_comissao: number;
  valor_total_causa: number | null;
  valor_comissao: number | null;
  status: string;
  data_indicacao: string;
  area: { nome: string } | null;
}

interface Pagamento {
  id: string;
  tipo: string;
  valor: number;
  valor_bruto: number | null;
  valor_abatimentos: number | null;
  valor_liquido: number | null;
  descricao_abatimentos: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  parcela_atual: number;
  total_parcelas: number;
}

interface ParceiroDetalhesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parceiro: Parceiro | null;
  onRefresh: () => void;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ParceiroDetalhes({ open, onOpenChange, parceiro, onRefresh }: ParceiroDetalhesProps) {
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [indicacaoDialogOpen, setIndicacaoDialogOpen] = useState(false);
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false);
  const [selectedIndicacao, setSelectedIndicacao] = useState<Indicacao | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  // Marcar como pago
  const [pagarDialogOpen, setPagarDialogOpen] = useState(false);
  const [pagandoPagamento, setPagandoPagamento] = useState<Pagamento | null>(null);
  const [dataPagamentoConfirm, setDataPagamentoConfirm] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loadingPagar, setLoadingPagar] = useState(false);

  // Editar parcela
  const [editarParcelaOpen, setEditarParcelaOpen] = useState(false);
  const [parcelaEditando, setParcelaEditando] = useState<Pagamento | null>(null);

  // Excluir indicação
  const [excluirIndicacaoId, setExcluirIndicacaoId] = useState<string | null>(null);
  const [excluindoIndicacao, setExcluindoIndicacao] = useState(false);

  const { isSocioOrRafael } = useAdminPermissions();
  const { isAdmin, profile } = useUserRole();
  const podeEditarStatus = isSocioOrRafael || isAdmin || profile?.position === 'comercial';
  const podeExcluirIndicacao = isSocioOrRafael || isAdmin;

  useEffect(() => {
    if (open && parceiro) {
      fetchData();
    }
  }, [open, parceiro]);

  const fetchData = async () => {
    if (!parceiro) return;
    setLoading(true);
    try {
      const { data: indicacoesData, error: indicacoesError } = await supabase
        .from('parceiros_indicacoes')
        .select(`*, area:parceiros_areas_atuacao(nome)`)
        .eq('parceiro_id', parceiro.id)
        .order('data_indicacao', { ascending: false });

      if (indicacoesError) throw indicacoesError;
      setIndicacoes(indicacoesData || []);

      const { data: pagamentosData, error: pagamentosError } = await supabase
        .from('parceiros_pagamentos')
        .select('*')
        .eq('parceiro_id', parceiro.id)
        .order('data_vencimento', { ascending: true });

      if (pagamentosError) throw pagamentosError;
      setPagamentos(pagamentosData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar detalhes do parceiro');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (indicacaoId: string, newStatus: string) => {
    setSavingStatus(true);
    try {
      const { error } = await supabase
        .from('parceiros_indicacoes')
        .update({ status: newStatus })
        .eq('id', indicacaoId);

      if (error) throw error;
      toast.success('Status atualizado com sucesso!');
      setEditingStatusId(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleExcluirIndicacao = async () => {
    if (!excluirIndicacaoId) return;
    setExcluindoIndicacao(true);
    try {
      const { error } = await supabase
        .from('parceiros_indicacoes')
        .delete()
        .eq('id', excluirIndicacaoId);

      if (error) throw error;
      toast.success('Indicação excluída com sucesso!');
      setExcluirIndicacaoId(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir indicação:', error);
      toast.error('Erro ao excluir indicação');
    } finally {
      setExcluindoIndicacao(false);
    }
  };

  const handleMarcarComoPago = async () => {
    if (!pagandoPagamento) return;
    setLoadingPagar(true);
    try {
      const { error } = await supabase
        .from('parceiros_pagamentos')
        .update({
          status: 'pago',
          data_pagamento: dataPagamentoConfirm,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pagandoPagamento.id);

      if (error) throw error;

      toast.success('Parcela marcada como paga e sincronizada com o financeiro!');
      setPagarDialogOpen(false);
      setPagandoPagamento(null);
      fetchData();
    } catch (error: any) {
      console.error('Erro ao marcar como pago:', error);
      toast.error(error?.message || 'Erro ao marcar como pago');
    } finally {
      setLoadingPagar(false);
    }
  };

  const openPagarDialog = (pag: Pagamento) => {
    setPagandoPagamento(pag);
    setDataPagamentoConfirm(format(new Date(), 'yyyy-MM-dd'));
    setPagarDialogOpen(true);
  };

  const getStatusBadge = (pag: Pagamento) => {
    if (pag.status === 'pago') {
      return <Badge variant="default">Pago</Badge>;
    }
    const vencida = isPast(parseISO(pag.data_vencimento + 'T23:59:59'));
    if (vencida) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
          <AlertTriangle className="h-3 w-3" />
          Vencida
        </Badge>
      );
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const formatCurrency = (value: number | null) => {
    if (!value && value !== 0) return '-';
    return fmt.format(value);
  };

  const renderStars = (ranking: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`h-4 w-4 ${star <= ranking ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
      ))}
    </div>
  );

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'indicamos': return <Badge variant="default">Indicamos</Badge>;
      case 'nos_indicam': return <Badge variant="secondary">Nos Indicam</Badge>;
      case 'ambos': return <Badge variant="outline">Ambos</Badge>;
      default: return <Badge>{tipo}</Badge>;
    }
  };

  if (!parceiro) return null;

  const totalIndicacoesEnviadas = indicacoes.filter(i => i.tipo_indicacao === 'enviada').length;
  const totalIndicacoesRecebidas = indicacoes.filter(i => i.tipo_indicacao === 'recebida').length;
  const valorTotalReceber = pagamentos.filter(p => p.tipo === 'receber' && p.status !== 'pago').reduce((acc, p) => acc + (p.valor_liquido ?? p.valor), 0);
  const valorTotalPagar = pagamentos.filter(p => p.tipo === 'pagar' && p.status !== 'pago').reduce((acc, p) => acc + (p.valor_liquido ?? p.valor), 0);

  // Verificar se há abatimentos em algum pagamento (para mostrar coluna)
  const temAbatimentos = pagamentos.some(p => p.valor_abatimentos && p.valor_abatimentos > 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              <span>{parceiro.nome_completo}</span>
              {renderStars(parceiro.ranking)}
              {getTipoBadge(parceiro.tipo)}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {parceiro.nome_escritorio && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{parceiro.nome_escritorio}</span>
                </div>
              )}
              {parceiro.telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{parceiro.telefone}</span>
                </div>
              )}
              {parceiro.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{parceiro.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Desde {format(new Date(parceiro.data_cadastro), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-foreground">{totalIndicacoesEnviadas}</div>
                  <p className="text-sm text-muted-foreground">Causas Enviadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-foreground">{totalIndicacoesRecebidas}</div>
                  <p className="text-sm text-muted-foreground">Causas Recebidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-primary">{formatCurrency(valorTotalReceber)}</div>
                  <p className="text-sm text-muted-foreground">A Receber (líquido)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-destructive">{formatCurrency(valorTotalPagar)}</div>
                  <p className="text-sm text-muted-foreground">A Pagar (líquido)</p>
                </CardContent>
              </Card>
            </div>

            {parceiro.observacoes && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{parceiro.observacoes}</p>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="indicacoes">
              <TabsList>
                <TabsTrigger value="indicacoes">
                  <FileText className="h-4 w-4 mr-2" />
                  Indicações
                </TabsTrigger>
                <TabsTrigger value="pagamentos">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Pagamentos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="indicacoes" className="mt-4">
                <div className="flex justify-end mb-4">
                  <Button onClick={() => { setSelectedIndicacao(null); setIndicacaoDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Indicação
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      {podeExcluirIndicacao && <TableHead>Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {indicacoes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={podeExcluirIndicacao ? 8 : 7} className="text-center text-muted-foreground py-8">
                          Nenhuma indicação registrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      indicacoes.map((ind) => (
                        <TableRow key={ind.id}>
                          <TableCell>
                            <Badge variant={ind.tipo_indicacao === 'enviada' ? 'default' : 'secondary'}>
                              {ind.tipo_indicacao === 'enviada' ? 'Enviada' : 'Recebida'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{ind.nome_cliente}</TableCell>
                          <TableCell>{ind.area?.nome || '-'}</TableCell>
                          <TableCell>{ind.percentual_comissao}%</TableCell>
                          <TableCell>{formatCurrency(ind.valor_comissao)}</TableCell>
                          <TableCell>
                            {podeEditarStatus && editingStatusId === ind.id ? (
                              <Select
                                value={ind.status}
                                onValueChange={(v) => handleStatusChange(ind.id, v)}
                                disabled={savingStatus}
                              >
                                <SelectTrigger className="w-[130px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ativa">Ativa</SelectItem>
                                  <SelectItem value="fechada">Fechada</SelectItem>
                                  <SelectItem value="cancelada">Cancelada</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge variant={ind.status === 'ativa' ? 'outline' : ind.status === 'fechada' ? 'default' : 'destructive'}>
                                  {ind.status}
                                </Badge>
                                {podeEditarStatus && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingStatusId(ind.id)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(ind.data_indicacao), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          {podeExcluirIndicacao && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive/80"
                                title="Excluir indicação"
                                onClick={() => setExcluirIndicacaoId(ind.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="pagamentos" className="mt-4">
                <div className="flex justify-end mb-4">
                  <Button onClick={() => setPagamentoDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Pagamento
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Parcela</TableHead>
                      {temAbatimentos && <TableHead>Valor Bruto</TableHead>}
                      {temAbatimentos && <TableHead>Abatimento</TableHead>}
                      <TableHead>Valor Líquido</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagamentos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={temAbatimentos ? 9 : 7} className="text-center text-muted-foreground py-8">
                          Nenhum pagamento registrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagamentos.map((pag) => {
                        const isPendente = pag.status !== 'pago';
                        const valorExibir = pag.valor_liquido ?? pag.valor;
                        return (
                          <TableRow key={pag.id}>
                            <TableCell>
                              <Badge variant={pag.tipo === 'receber' ? 'default' : 'destructive'}>
                                {pag.tipo === 'receber' ? 'A Receber' : 'A Pagar'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {pag.total_parcelas > 1 ? `${pag.parcela_atual}/${pag.total_parcelas}` : 'Única'}
                            </TableCell>
                            {temAbatimentos && (
                              <TableCell className="text-sm">
                                {pag.valor_bruto ? fmt.format(pag.valor_bruto) : '-'}
                              </TableCell>
                            )}
                            {temAbatimentos && (
                              <TableCell className="text-sm text-destructive">
                                {pag.valor_abatimentos && pag.valor_abatimentos > 0
                                  ? <>- {fmt.format(pag.valor_abatimentos)}{pag.descricao_abatimentos && <div className="text-xs text-muted-foreground">{pag.descricao_abatimentos}</div>}</>
                                  : '-'}
                              </TableCell>
                            )}
                            <TableCell className="font-medium">
                              {fmt.format(valorExibir)}
                            </TableCell>
                            <TableCell>
                              {format(parseISO(pag.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              {pag.data_pagamento
                                ? format(parseISO(pag.data_pagamento), "dd/MM/yyyy", { locale: ptBR })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(pag)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {isPendente && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-primary hover:text-primary/80"
                                      title="Marcar como pago"
                                      onClick={() => openPagarDialog(pag)}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Editar parcela"
                                  onClick={() => { setParcelaEditando(pag); setEditarParcelaOpen(true); }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de pagamento */}
      <AlertDialog open={pagarDialogOpen} onOpenChange={setPagarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              {pagandoPagamento && (
                <span>
                  Parcela{' '}
                  {pagandoPagamento.total_parcelas > 1
                    ? `${pagandoPagamento.parcela_atual}/${pagandoPagamento.total_parcelas}`
                    : 'única'}{' '}
                  — Valor líquido:{' '}
                  <strong>{fmt.format(pagandoPagamento.valor_liquido ?? pagandoPagamento.valor)}</strong>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Label htmlFor="data-pag-confirm">Data do Pagamento</Label>
            <Input
              id="data-pag-confirm"
              type="date"
              value={dataPagamentoConfirm}
              onChange={(e) => setDataPagamentoConfirm(e.target.value)}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingPagar}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarcarComoPago} disabled={loadingPagar}>
              {loadingPagar ? 'Salvando...' : 'Confirmar Pagamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de exclusão de indicação */}
      <AlertDialog open={!!excluirIndicacaoId} onOpenChange={(o) => { if (!o) setExcluirIndicacaoId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Indicação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta indicação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindoIndicacao}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluirIndicacao}
              disabled={excluindoIndicacao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindoIndicacao ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <IndicacaoDialog
        open={indicacaoDialogOpen}
        onOpenChange={setIndicacaoDialogOpen}
        parceiroId={parceiro.id}
        parceiroTipo={parceiro.tipo}
        indicacao={selectedIndicacao}
        onSuccess={fetchData}
      />

      <PagamentoParceiroDialog
        open={pagamentoDialogOpen}
        onOpenChange={setPagamentoDialogOpen}
        parceiroId={parceiro.id}
        parceiroTipo={parceiro.tipo}
        indicacoes={indicacoes}
        onSuccess={fetchData}
      />

      <EditarParcelaDialog
        open={editarParcelaOpen}
        onOpenChange={setEditarParcelaOpen}
        pagamento={parcelaEditando}
        onSuccess={fetchData}
      />
    </>
  );
}
