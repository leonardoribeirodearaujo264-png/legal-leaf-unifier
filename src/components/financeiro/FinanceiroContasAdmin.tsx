import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Loader2, Wallet, Landmark, CreditCard, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface Conta {
  id: string;
  nome: string;
  tipo: string;
  banco: string | null;
  agencia: string | null;
  numero_conta: string | null;
  saldo_inicial: number;
  saldo_atual: number;
  cor: string;
  ativa: boolean;
  advbox_account_id: number | null;
}

export function FinanceiroContasAdmin() {
  const [loading, setLoading] = useState(true);
  const [contas, setContas] = useState<Conta[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingConta, setEditingConta] = useState<Conta | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState('corrente');
  const [formBanco, setFormBanco] = useState('');
  const [formAgencia, setFormAgencia] = useState('');
  const [formNumeroConta, setFormNumeroConta] = useState('');
  const [formSaldoInicial, setFormSaldoInicial] = useState('0');
  const [formCor, setFormCor] = useState('#3B82F6');
  const [formAdvboxId, setFormAdvboxId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('fin_contas')
        .select('*')
        .order('nome');

      setContas(data || []);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'corrente':
      case 'poupanca':
        return <Landmark className="h-4 w-4" />;
      case 'pagamentos':
        return <CreditCard className="h-4 w-4" />;
      case 'investimento':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  const openDialog = (conta?: Conta) => {
    if (conta) {
      setEditingConta(conta);
      setFormNome(conta.nome);
      setFormTipo(conta.tipo);
      setFormBanco(conta.banco || '');
      setFormAgencia(conta.agencia || '');
      setFormNumeroConta(conta.numero_conta || '');
      setFormSaldoInicial(conta.saldo_inicial.toString());
      setFormCor(conta.cor);
      setFormAdvboxId(conta.advbox_account_id ? String(conta.advbox_account_id) : '');
    } else {
      setEditingConta(null);
      setFormNome('');
      setFormTipo('corrente');
      setFormBanco('');
      setFormAgencia('');
      setFormNumeroConta('');
      setFormSaldoInicial('0');
      setFormCor('#3B82F6');
      setFormAdvboxId('');
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formNome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        nome: formNome.trim(),
        tipo: formTipo,
        banco: formBanco.trim() || null,
        agencia: formAgencia.trim() || null,
        numero_conta: formNumeroConta.trim() || null,
        saldo_inicial: parseFloat(formSaldoInicial) || 0,
        cor: formCor,
        advbox_account_id: formAdvboxId.trim() ? parseInt(formAdvboxId.trim(), 10) : null,
      };

      if (editingConta) {
        const { error } = await supabase
          .from('fin_contas')
          .update(data)
          .eq('id', editingConta.id);

        if (error) throw error;
        toast.success('Conta atualizada');
      } else {
        const { error } = await supabase
          .from('fin_contas')
          .insert({ ...data, saldo_atual: data.saldo_inicial });

        if (error) throw error;
        toast.success('Conta criada');
      }

      setShowDialog(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar conta:', error);
      toast.error('Erro ao salvar conta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;

    try {
      const { error } = await supabase
        .from('fin_contas')
        .update({ ativa: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Conta inativada');
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      toast.error('Erro ao excluir conta');
    }
  };

  const totalSaldo = contas.filter(c => c.ativa).reduce((acc, c) => acc + Number(c.saldo_atual), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Contas</CardTitle>
            <CardDescription>Gerencie as contas bancárias e caixas</CardDescription>
          </div>
          <Button onClick={() => openDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Resumo */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <div className="text-sm text-muted-foreground">Saldo Total</div>
          <div className="text-3xl font-bold">{formatCurrency(totalSaldo)}</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead className="text-right">ID ADVBox</TableHead>
                <TableHead className="text-right">Saldo Inicial</TableHead>
                <TableHead className="text-right">Saldo Atual</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map((conta) => (
                <TableRow key={conta.id} className={!conta.ativa ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="p-2 rounded"
                        style={{ backgroundColor: conta.cor + '20', color: conta.cor }}
                      >
                        {getIcon(conta.tipo)}
                      </div>
                      <span className="font-medium">{conta.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{conta.tipo}</TableCell>
                  <TableCell>{conta.banco || '-'}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {conta.advbox_account_id ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(conta.saldo_inicial)}</TableCell>
                  <TableCell className={`text-right font-medium ${
                    conta.saldo_atual >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(conta.saldo_atual)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={conta.ativa ? 'default' : 'secondary'}>
                      {conta.ativa ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(conta)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(conta.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConta ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formTipo} onValueChange={setFormTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Conta Corrente</SelectItem>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                  <SelectItem value="caixa">Caixa</SelectItem>
                  <SelectItem value="pagamentos">Pagamentos</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input value={formBanco} onChange={(e) => setFormBanco(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input value={formAgencia} onChange={(e) => setFormAgencia(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número da Conta</Label>
                <Input value={formNumeroConta} onChange={(e) => setFormNumeroConta(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Saldo Inicial</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formSaldoInicial} 
                  onChange={(e) => setFormSaldoInicial(e.target.value)} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input 
                  type="color" 
                  value={formCor} 
                  onChange={(e) => setFormCor(e.target.value)} 
                  className="w-16 h-10 p-1" 
                />
                <Input value={formCor} onChange={(e) => setFormCor(e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
