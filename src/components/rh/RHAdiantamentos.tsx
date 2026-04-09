import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Wallet, AlertCircle, Check, X, History, Pencil, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatLocalDate, formatMesReferencia } from '@/lib/dateUtils';

interface Colaborador {
  id: string;
  full_name: string;
  email: string;
}

interface Conta {
  id: string;
  nome: string;
}

interface Adiantamento {
  id: string;
  colaborador_id: string;
  tipo_adiantamento: string;
  tipo_adiantamento_outro: string | null;
  valor: number;
  conta_pagamento_id: string | null;
  data_adiantamento: string;
  forma_desconto: string;
  numero_parcelas: number;
  valor_parcela: number | null;
  mes_inicio_desconto: string | null;
  status: string;
  saldo_restante: number;
  observacoes: string | null;
  lancamento_financeiro_id: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
  fin_contas?: { nome: string } | null;
}

const TIPO_ADIANTAMENTO_LABELS: Record<string, string> = {
  'salario': 'Adiantamento Salarial',
  '13_salario': 'Adiantamento de 13º Salário',
  'ferias': 'Adiantamento de Férias',
  'bonus': 'Adiantamento de Bônus',
  'outro': 'Outro'
};

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  'ativo': { label: 'Ativo', variant: 'default' },
  'quitado': { label: 'Quitado', variant: 'secondary' },
  'cancelado': { label: 'Cancelado', variant: 'destructive' }
};

export function RHAdiantamentos() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [adiantamentos, setAdiantamentos] = useState<Adiantamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedAdiantamento, setSelectedAdiantamento] = useState<Adiantamento | null>(null);
  const [descontos, setDescontos] = useState<any[]>([]);

  // Edit form state
  const [editObservacoes, setEditObservacoes] = useState('');
  const [editFormaDesconto, setEditFormaDesconto] = useState('');
  const [editNumeroParcelas, setEditNumeroParcelas] = useState('');
  const [editMesInicioDesconto, setEditMesInicioDesconto] = useState('');

  // Formulário
  const [selectedColaborador, setSelectedColaborador] = useState('');
  const [tipoAdiantamento, setTipoAdiantamento] = useState('salario');
  const [tipoAdiantamentoOutro, setTipoAdiantamentoOutro] = useState('');
  const [valor, setValor] = useState('');
  const [contaPagamentoId, setContaPagamentoId] = useState('');
  const [dataAdiantamento, setDataAdiantamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formaDesconto, setFormaDesconto] = useState('parcela_unica');
  const [numeroParcelas, setNumeroParcelas] = useState('1');
  const [mesInicioDesconto, setMesInicioDesconto] = useState(format(addMonths(new Date(), 1), 'yyyy-MM'));
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [colabRes, contasRes, adiantamentosRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('approval_status', 'approved')
          .eq('is_active', true)
          .eq('is_suspended', false)
          .order('full_name'),
        supabase
          .from('fin_contas')
          .select('id, nome')
          .eq('ativa', true)
          .order('nome'),
        supabase
          .from('rh_adiantamentos')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (colabRes.error) throw colabRes.error;
      if (contasRes.error) throw contasRes.error;
      if (adiantamentosRes.error) throw adiantamentosRes.error;

      setColaboradores(colabRes.data || []);
      setContas(contasRes.data || []);

      // Buscar nomes dos colaboradores e contas para cada adiantamento
      const colaboradorIds = [...new Set((adiantamentosRes.data || []).map(a => a.colaborador_id))];
      const contaIds = [...new Set((adiantamentosRes.data || []).map(a => a.conta_pagamento_id).filter(Boolean))];

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', colaboradorIds);

      const { data: contasData } = await supabase
        .from('fin_contas')
        .select('id, nome')
        .in('id', contaIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      const contasMap = new Map((contasData || []).map(c => [c.id, c]));

      const adiantamentosEnriquecidos = (adiantamentosRes.data || []).map(a => ({
        ...a,
        profiles: profilesMap.get(a.colaborador_id) || null,
        fin_contas: a.conta_pagamento_id ? contasMap.get(a.conta_pagamento_id) || null : null
      }));

      setAdiantamentos(adiantamentosEnriquecidos);
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedColaborador || !valor || !contaPagamentoId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const valorNumerico = parseFloat(valor.replace(/[^\d,.-]/g, '').replace(',', '.'));
    const numParcelas = parseInt(numeroParcelas);
    const valorParcela = valorNumerico / numParcelas;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      // Buscar categoria de despesa para "RH" ou "Pessoal"
      const { data: categorias } = await supabase
        .from('fin_categorias')
        .select('id')
        .eq('tipo', 'despesa')
        .or('nome.ilike.%pessoal%,nome.ilike.%rh%,nome.ilike.%folha%')
        .limit(1);

      const categoriaId = categorias?.[0]?.id || null;

      // Buscar nome do colaborador para descrição
      const colaborador = colaboradores.find(c => c.id === selectedColaborador);
      const tipoLabel = TIPO_ADIANTAMENTO_LABELS[tipoAdiantamento];
      const descricao = `${tipoLabel} - ${colaborador?.full_name || 'Colaborador'}`;

      // 1. Criar lançamento financeiro (saída de caixa)
      const { data: lancamento, error: lancError } = await supabase
        .from('fin_lancamentos')
        .insert({
          tipo: 'despesa',
          descricao,
          valor: valorNumerico,
          data_lancamento: dataAdiantamento,
          data_vencimento: dataAdiantamento,
          data_pagamento: dataAdiantamento,
          status: 'pago',
          origem: 'escritorio',
          categoria_id: categoriaId,
          conta_origem_id: contaPagamentoId,
          observacoes: `Adiantamento para ${colaborador?.full_name}. ${observacoes || ''}`.trim(),
          created_by: user.user.id
        })
        .select()
        .single();

      if (lancError) throw lancError;

      // 2. Criar registro de adiantamento
      const { data: adiantamento, error: adiantError } = await supabase
        .from('rh_adiantamentos')
        .insert({
          colaborador_id: selectedColaborador,
          tipo_adiantamento: tipoAdiantamento,
          tipo_adiantamento_outro: tipoAdiantamento === 'outro' ? tipoAdiantamentoOutro : null,
          valor: valorNumerico,
          conta_pagamento_id: contaPagamentoId,
          data_adiantamento: dataAdiantamento,
          forma_desconto: formaDesconto,
          numero_parcelas: numParcelas,
          valor_parcela: valorParcela,
          mes_inicio_desconto: mesInicioDesconto,
          saldo_restante: valorNumerico,
          lancamento_financeiro_id: lancamento.id,
          observacoes,
          created_by: user.user.id
        })
        .select()
        .single();

      if (adiantError) throw adiantError;

      toast.success('Adiantamento registrado com sucesso! Lançamento financeiro gerado.');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao registrar adiantamento: ' + error.message);
    }
  };

  const resetForm = () => {
    setSelectedColaborador('');
    setTipoAdiantamento('salario');
    setTipoAdiantamentoOutro('');
    setValor('');
    setContaPagamentoId('');
    setDataAdiantamento(format(new Date(), 'yyyy-MM-dd'));
    setFormaDesconto('parcela_unica');
    setNumeroParcelas('1');
    setMesInicioDesconto(format(addMonths(new Date(), 1), 'yyyy-MM'));
    setObservacoes('');
  };

  const handleViewHistory = async (adiantamento: Adiantamento) => {
    setSelectedAdiantamento(adiantamento);
    
    try {
      const { data, error } = await supabase
        .from('rh_adiantamento_descontos')
        .select('*')
        .eq('adiantamento_id', adiantamento.id)
        .order('parcela_numero');

      if (error) throw error;
      setDescontos(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar histórico: ' + error.message);
    }
    
    setHistoryDialogOpen(true);
  };

  const handleCancelAdiantamento = async (adiantamento: Adiantamento) => {
    if (!confirm('Tem certeza que deseja cancelar este adiantamento? O lançamento financeiro não será afetado.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('rh_adiantamentos')
        .update({ status: 'cancelado' })
        .eq('id', adiantamento.id);

      if (error) throw error;
      toast.success('Adiantamento cancelado');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao cancelar: ' + error.message);
    }
  };

  const handleOpenDetail = (adiantamento: Adiantamento) => {
    setSelectedAdiantamento(adiantamento);
    setEditMode(false);
    setEditObservacoes(adiantamento.observacoes || '');
    setEditFormaDesconto(adiantamento.forma_desconto);
    setEditNumeroParcelas(String(adiantamento.numero_parcelas));
    setEditMesInicioDesconto(adiantamento.mes_inicio_desconto || '');
    setDetailDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedAdiantamento) return;

    const numParcelas = parseInt(editNumeroParcelas) || 1;
    const valorParcela = selectedAdiantamento.valor / numParcelas;

    try {
      const { error } = await supabase
        .from('rh_adiantamentos')
        .update({
          observacoes: editObservacoes || null,
          forma_desconto: editFormaDesconto,
          numero_parcelas: numParcelas,
          valor_parcela: valorParcela,
          mes_inicio_desconto: editMesInicioDesconto || null,
        })
        .eq('id', selectedAdiantamento.id);

      if (error) throw error;
      toast.success('Adiantamento atualizado com sucesso');
      setEditMode(false);
      setDetailDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const valorParcela = () => {
    const valorNum = parseFloat(valor.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
    const parcelas = parseInt(numeroParcelas) || 1;
    return valorNum / parcelas;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  const adiantamentosAtivos = adiantamentos.filter(a => a.status === 'ativo');
  const totalPendente = adiantamentosAtivos.reduce((acc, a) => acc + a.saldo_restante, 0);

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Wallet className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Registrado</p>
                <p className="text-2xl font-bold">{adiantamentos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Adiantamentos Ativos</p>
                <p className="text-2xl font-bold">{adiantamentosAtivos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Wallet className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo a Descontar</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPendente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Adiantamentos
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Adiantamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Adiantamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Colaborador *</Label>
                    <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {colaboradores.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Adiantamento *</Label>
                    <Select value={tipoAdiantamento} onValueChange={setTipoAdiantamento}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_ADIANTAMENTO_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {tipoAdiantamento === 'outro' && (
                  <div className="space-y-2">
                    <Label>Especifique o tipo</Label>
                    <Input 
                      value={tipoAdiantamentoOutro}
                      onChange={(e) => setTipoAdiantamentoOutro(e.target.value)}
                      placeholder="Descreva o tipo de adiantamento"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <Input 
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data do Adiantamento *</Label>
                    <Input 
                      type="date"
                      value={dataAdiantamento}
                      onChange={(e) => setDataAdiantamento(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Conta de Pagamento (saída de caixa) *</Label>
                  <Select value={contaPagamentoId} onValueChange={setContaPagamentoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="De onde sairá o valor" />
                    </SelectTrigger>
                    <SelectContent>
                      {contas.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Como será descontado?</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Forma de Desconto</Label>
                      <Select value={formaDesconto} onValueChange={setFormaDesconto}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parcela_unica">Parcela Única</SelectItem>
                          <SelectItem value="parcelado">Parcelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formaDesconto === 'parcelado' && (
                      <div className="space-y-2">
                        <Label>Número de Parcelas</Label>
                        <Input 
                          type="number"
                          min="2"
                          value={numeroParcelas}
                          onChange={(e) => setNumeroParcelas(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label>Mês de Início do Desconto</Label>
                      <Input 
                        type="month"
                        value={mesInicioDesconto}
                        onChange={(e) => setMesInicioDesconto(e.target.value)}
                      />
                    </div>
                    {valor && (
                      <div className="flex items-end">
                        <Alert className="flex-1">
                          <AlertDescription>
                            Valor por parcela: <strong>{formatCurrency(valorParcela())}</strong>
                            {formaDesconto === 'parcelado' && ` x ${numeroParcelas} vezes`}
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea 
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações adicionais..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Registrar Adiantamento
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {adiantamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum adiantamento registrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adiantamentos.map((adiantamento) => (
                  <TableRow key={adiantamento.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenDetail(adiantamento)}>
                    <TableCell className="font-medium">
                      {adiantamento.profiles?.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {adiantamento.tipo_adiantamento === 'outro' 
                        ? adiantamento.tipo_adiantamento_outro 
                        : TIPO_ADIANTAMENTO_LABELS[adiantamento.tipo_adiantamento]}
                    </TableCell>
                    <TableCell>{formatCurrency(adiantamento.valor)}</TableCell>
                    <TableCell className={adiantamento.saldo_restante > 0 ? 'text-amber-600 font-medium' : 'text-green-600'}>
                      {formatCurrency(adiantamento.saldo_restante)}
                    </TableCell>
                    <TableCell>
                      {adiantamento.forma_desconto === 'parcelado' 
                        ? `${adiantamento.numero_parcelas}x de ${formatCurrency(adiantamento.valor_parcela || 0)}`
                        : 'À vista'}
                    </TableCell>
                    <TableCell>
                      {formatLocalDate(adiantamento.data_adiantamento)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGES[adiantamento.status]?.variant || 'default'}>
                        {STATUS_BADGES[adiantamento.status]?.label || adiantamento.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleOpenDetail(adiantamento)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleViewHistory(adiantamento)}
                          title="Ver histórico de descontos"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        {adiantamento.status === 'ativo' && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleCancelAdiantamento(adiantamento)}
                            title="Cancelar adiantamento"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Histórico de Descontos */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de Descontos</DialogTitle>
          </DialogHeader>
          {selectedAdiantamento && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p><strong>Colaborador:</strong> {selectedAdiantamento.profiles?.full_name}</p>
                <p><strong>Valor original:</strong> {formatCurrency(selectedAdiantamento.valor)}</p>
                <p><strong>Saldo restante:</strong> {formatCurrency(selectedAdiantamento.saldo_restante)}</p>
              </div>
              
              {descontos.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum desconto aplicado ainda
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Mês Ref.</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {descontos.map((desconto) => (
                      <TableRow key={desconto.id}>
                        <TableCell>{desconto.parcela_numero}/{selectedAdiantamento.numero_parcelas}</TableCell>
                        <TableCell>
                          {formatMesReferencia(desconto.mes_referencia + '-01')}
                        </TableCell>
                        <TableCell>{formatCurrency(desconto.valor_descontado)}</TableCell>
                        <TableCell>
                          {desconto.data_desconto 
                            ? formatLocalDate(desconto.data_desconto)
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
