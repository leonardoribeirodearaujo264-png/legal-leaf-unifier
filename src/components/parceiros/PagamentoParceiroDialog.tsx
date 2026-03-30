import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { format, addMonths } from 'date-fns';

interface Indicacao {
  id: string;
  nome_cliente: string;
  valor_comissao: number | null;
}

interface Parcela {
  parcela_atual: number;
  data_vencimento: string;
  valor_bruto: string;
  valor_abatimentos: string;
  valor_liquido: number;
  pagar_agora: boolean;
}

interface PagamentoParceiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parceiroId: string;
  parceiroTipo: string;
  indicacoes: Indicacao[];
  onSuccess: () => void;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function PagamentoParceiroDialog({ open, onOpenChange, parceiroId, parceiroTipo, indicacoes, onSuccess }: PagamentoParceiroDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'receber' as 'receber' | 'pagar',
    indicacao_id: '',
    valor_bruto: '',
    valor_abatimentos: '0',
    descricao_abatimentos: '',
    data_vencimento: format(new Date(), 'yyyy-MM-dd'),
    forma_pagamento: '',
    total_parcelas: '1',
    observacoes: ''
  });
  const [parcelas, setParcelas] = useState<Parcela[]>([]);

  // Calcular valor líquido global
  const valorBrutoNum = parseFloat(formData.valor_bruto) || 0;
  const valorAbatNum = parseFloat(formData.valor_abatimentos) || 0;
  const valorLiquidoTotal = Math.max(0, valorBrutoNum - valorAbatNum);
  const totalParcelas = parseInt(formData.total_parcelas) || 1;

  useEffect(() => {
    if (open) {
      const tipoDefault = parceiroTipo === 'indicamos' ? 'receber' :
        parceiroTipo === 'nos_indicam' ? 'pagar' : 'receber';
      setFormData({
        tipo: tipoDefault,
        indicacao_id: '',
        valor_bruto: '',
        valor_abatimentos: '0',
        descricao_abatimentos: '',
        data_vencimento: format(new Date(), 'yyyy-MM-dd'),
        forma_pagamento: '',
        total_parcelas: '1',
        observacoes: ''
      });
      setParcelas([]);
    }
  }, [open, parceiroTipo]);

  // Recalcular parcelas quando mudam dados relevantes
  useEffect(() => {
    if (totalParcelas > 1 && valorBrutoNum > 0) {
      const valorBrutoParcela = valorBrutoNum / totalParcelas;
      const valorAbatParcela = valorAbatNum / totalParcelas;
      const dataBase = formData.data_vencimento ? new Date(formData.data_vencimento + 'T12:00:00') : new Date();

      setParcelas(prev => {
        const newParcelas: Parcela[] = [];
        for (let i = 0; i < totalParcelas; i++) {
          const existing = prev[i];
          const vencimento = format(addMonths(dataBase, i), 'yyyy-MM-dd');
          const vb = existing ? parseFloat(existing.valor_bruto) || valorBrutoParcela : valorBrutoParcela;
          const va = existing ? parseFloat(existing.valor_abatimentos) || valorAbatParcela : valorAbatParcela;
          newParcelas.push({
            parcela_atual: i + 1,
            data_vencimento: existing?.data_vencimento || vencimento,
            valor_bruto: existing ? existing.valor_bruto : valorBrutoParcela.toFixed(2),
            valor_abatimentos: existing ? existing.valor_abatimentos : valorAbatParcela.toFixed(2),
            valor_liquido: Math.max(0, vb - va),
            pagar_agora: existing?.pagar_agora || false,
          });
        }
        return newParcelas;
      });
    } else {
      setParcelas([]);
    }
  }, [totalParcelas, valorBrutoNum, valorAbatNum, formData.data_vencimento]);

  const handleIndicacaoChange = (indicacaoId: string) => {
    setFormData(prev => ({ ...prev, indicacao_id: indicacaoId }));
    const indicacao = indicacoes.find(i => i.id === indicacaoId);
    if (indicacao?.valor_comissao) {
      setFormData(prev => ({ ...prev, indicacao_id: indicacaoId, valor_bruto: String(indicacao.valor_comissao) }));
    }
  };

  const updateParcela = (index: number, field: keyof Parcela, value: string | boolean) => {
    setParcelas(prev => {
      const updated = [...prev];
      const p = { ...updated[index] };
      if (field === 'pagar_agora') {
        p.pagar_agora = value as boolean;
      } else if (field === 'valor_bruto' || field === 'valor_abatimentos') {
        (p as any)[field] = value as string;
        const vb = parseFloat(field === 'valor_bruto' ? (value as string) : p.valor_bruto) || 0;
        const va = parseFloat(field === 'valor_abatimentos' ? (value as string) : p.valor_abatimentos) || 0;
        p.valor_liquido = Math.max(0, vb - va);
      } else {
        (p as any)[field] = value;
      }
      updated[index] = p;
      return updated;
    });
  };

  const handleSave = async () => {
    if (!formData.valor_bruto || valorBrutoNum <= 0) {
      toast.error('Valor bruto é obrigatório');
      return;
    }

    setLoading(true);
    try {
      if (totalParcelas > 1 && parcelas.length > 0) {
        // Inserir parcelas individuais
        for (const parcela of parcelas) {
          const vb = parseFloat(parcela.valor_bruto) || 0;
          const va = parseFloat(parcela.valor_abatimentos) || 0;
          const vl = Math.max(0, vb - va);

          const { error } = await supabase
            .from('parceiros_pagamentos')
            .insert({
              parceiro_id: parceiroId,
              indicacao_id: formData.indicacao_id && formData.indicacao_id !== 'none' ? formData.indicacao_id : null,
              tipo: formData.tipo,
              valor: vl,
              valor_bruto: vb,
              valor_abatimentos: va,
              valor_liquido: vl,
              descricao_abatimentos: formData.descricao_abatimentos || null,
              data_vencimento: parcela.data_vencimento,
              data_pagamento: parcela.pagar_agora ? format(new Date(), 'yyyy-MM-dd') : null,
              forma_pagamento: formData.forma_pagamento || null,
              parcela_atual: parcela.parcela_atual,
              total_parcelas: totalParcelas,
              status: parcela.pagar_agora ? 'pago' : 'pendente',
              observacoes: formData.observacoes || null,
              created_by: user?.id
            });

          if (error) throw error;
        }
      } else {
        // Parcela única
        const { error } = await supabase
          .from('parceiros_pagamentos')
          .insert({
            parceiro_id: parceiroId,
            indicacao_id: formData.indicacao_id && formData.indicacao_id !== 'none' ? formData.indicacao_id : null,
            tipo: formData.tipo,
            valor: valorLiquidoTotal,
            valor_bruto: valorBrutoNum,
            valor_abatimentos: valorAbatNum,
            valor_liquido: valorLiquidoTotal,
            descricao_abatimentos: formData.descricao_abatimentos || null,
            data_vencimento: formData.data_vencimento,
            forma_pagamento: formData.forma_pagamento || null,
            parcela_atual: 1,
            total_parcelas: 1,
            status: 'pendente',
            observacoes: formData.observacoes || null,
            created_by: user?.id
          });

        if (error) throw error;
      }

      toast.success(`${totalParcelas > 1 ? totalParcelas + ' parcelas criadas' : 'Pagamento criado'} com sucesso!`);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao criar pagamento:', error);
      toast.error(`Erro ao criar pagamento: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pagamento</DialogTitle>
          <DialogDescription>
            Registre um pagamento a receber ou a pagar relacionado ao parceiro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <Label>Tipo *</Label>
            <Select
              value={formData.tipo}
              onValueChange={(v: 'receber' | 'pagar') => setFormData({ ...formData, tipo: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(parceiroTipo === 'indicamos' || parceiroTipo === 'ambos') && (
                  <SelectItem value="receber">A Receber (parceiro nos paga)</SelectItem>
                )}
                {(parceiroTipo === 'nos_indicam' || parceiroTipo === 'ambos') && (
                  <SelectItem value="pagar">A Pagar (pagamos ao parceiro)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Indicação */}
          {indicacoes.length > 0 && (
            <div>
              <Label>Indicação Relacionada</Label>
              <Select value={formData.indicacao_id} onValueChange={handleIndicacaoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {indicacoes.map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>
                      {ind.nome_cliente}
                      {ind.valor_comissao && ` - ${fmt.format(ind.valor_comissao)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Valores */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="valor_bruto">Valor Bruto (R$) *</Label>
              <Input
                id="valor_bruto"
                type="number"
                step="0.01"
                value={formData.valor_bruto}
                onChange={(e) => setFormData({ ...formData, valor_bruto: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="valor_abatimentos">Abatimentos (R$)</Label>
              <Input
                id="valor_abatimentos"
                type="number"
                step="0.01"
                value={formData.valor_abatimentos}
                onChange={(e) => setFormData({ ...formData, valor_abatimentos: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Descrição dos abatimentos */}
          {valorAbatNum > 0 && (
            <div>
              <Label htmlFor="desc_abat">Descrição dos Abatimentos</Label>
              <Input
                id="desc_abat"
                value={formData.descricao_abatimentos}
                onChange={(e) => setFormData({ ...formData, descricao_abatimentos: e.target.value })}
                placeholder="Ex: Taxa cartão 3% + ISS 5%"
              />
            </div>
          )}

          {/* Preview do valor líquido */}
          {valorBrutoNum > 0 && (
            <div className="p-3 bg-muted rounded-md">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Bruto:</span>
                <span>{fmt.format(valorBrutoNum)}</span>
              </div>
              {valorAbatNum > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Abatimentos:</span>
                  <span className="text-destructive">- {fmt.format(valorAbatNum)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold mt-1 pt-1 border-t border-border">
                <span>Valor Líquido:</span>
                <span className="text-primary">{fmt.format(valorLiquidoTotal)}</span>
              </div>
            </div>
          )}

          {/* Parcelas e data */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vencimento">Data do 1º Vencimento *</Label>
              <Input
                id="vencimento"
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="parcelas">Número de Parcelas</Label>
              <Input
                id="parcelas"
                type="number"
                min="1"
                max="60"
                value={formData.total_parcelas}
                onChange={(e) => setFormData({ ...formData, total_parcelas: e.target.value })}
              />
            </div>
          </div>

          {/* Tabela de parcelas editáveis */}
          {totalParcelas > 1 && valorBrutoNum > 0 && parcelas.length > 0 && (
            <div>
              <Label className="mb-2 block">Parcelas (editáveis individualmente)</Label>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor Bruto</TableHead>
                      <TableHead>Abatimento</TableHead>
                      <TableHead>Valor Líquido</TableHead>
                      <TableHead className="w-24 text-center">Pagar agora?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelas.map((parcela, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-muted-foreground">
                          {parcela.parcela_atual}/{totalParcelas}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={parcela.data_vencimento}
                            onChange={(e) => updateParcela(idx, 'data_vencimento', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={parcela.valor_bruto}
                            onChange={(e) => updateParcela(idx, 'valor_bruto', e.target.value)}
                            className="h-8 text-sm w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={parcela.valor_abatimentos}
                            onChange={(e) => updateParcela(idx, 'valor_abatimentos', e.target.value)}
                            className="h-8 text-sm w-28"
                          />
                        </TableCell>
                        <TableCell className="font-medium text-primary">
                          {fmt.format(parcela.valor_liquido)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={parcela.pagar_agora}
                            onCheckedChange={(v) => updateParcela(idx, 'pagar_agora', !!v)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Forma de pagamento */}
          <div>
            <Label htmlFor="forma">Forma de Pagamento</Label>
            <Input
              id="forma"
              value={formData.forma_pagamento}
              onChange={(e) => setFormData({ ...formData, forma_pagamento: e.target.value })}
              placeholder="Ex: PIX, Transferência, Boleto..."
            />
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações sobre o pagamento..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : `Criar ${totalParcelas > 1 ? totalParcelas + ' Parcelas' : 'Pagamento'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
