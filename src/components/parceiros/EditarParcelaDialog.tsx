import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface EditarParcelaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagamento: Pagamento | null;
  onSuccess: () => void;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function EditarParcelaDialog({ open, onOpenChange, pagamento, onSuccess }: EditarParcelaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [valorBruto, setValorBruto] = useState('');
  const [valorAbatimentos, setValorAbatimentos] = useState('0');
  const [descricaoAbatimentos, setDescricaoAbatimentos] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [status, setStatus] = useState('pendente');

  const valorBrutoNum = parseFloat(valorBruto) || 0;
  const valorAbatNum = parseFloat(valorAbatimentos) || 0;
  const valorLiquido = Math.max(0, valorBrutoNum - valorAbatNum);

  useEffect(() => {
    if (open && pagamento) {
      setValorBruto(String(pagamento.valor_bruto ?? pagamento.valor ?? ''));
      setValorAbatimentos(String(pagamento.valor_abatimentos ?? 0));
      setDescricaoAbatimentos(pagamento.descricao_abatimentos ?? '');
      setDataVencimento(pagamento.data_vencimento ?? '');
      setDataPagamento(pagamento.data_pagamento ?? '');
      setStatus(pagamento.status ?? 'pendente');
    }
  }, [open, pagamento]);

  const handleSave = async () => {
    if (!pagamento) return;
    if (valorBrutoNum <= 0) {
      toast.error('Valor bruto é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('parceiros_pagamentos')
        .update({
          valor: valorLiquido,
          valor_bruto: valorBrutoNum,
          valor_abatimentos: valorAbatNum,
          valor_liquido: valorLiquido,
          descricao_abatimentos: descricaoAbatimentos || null,
          data_vencimento: dataVencimento,
          data_pagamento: dataPagamento || null,
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pagamento.id);

      if (error) throw error;

      toast.success('Parcela atualizada com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao atualizar parcela:', error);
      toast.error(error?.message || 'Erro ao atualizar parcela');
    } finally {
      setLoading(false);
    }
  };

  if (!pagamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Parcela {pagamento.parcela_atual}/{pagamento.total_parcelas}</DialogTitle>
          <DialogDescription>
            Atualize os valores, datas e status desta parcela
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-vencimento">Data de Vencimento</Label>
              <Input
                id="edit-vencimento"
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-pagamento">Data de Pagamento</Label>
              <Input
                id="edit-pagamento"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-bruto">Valor Bruto (R$)</Label>
              <Input
                id="edit-bruto"
                type="number"
                step="0.01"
                value={valorBruto}
                onChange={(e) => setValorBruto(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="edit-abat">Abatimentos (R$)</Label>
              <Input
                id="edit-abat"
                type="number"
                step="0.01"
                value={valorAbatimentos}
                onChange={(e) => setValorAbatimentos(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {valorAbatNum > 0 && (
            <div>
              <Label htmlFor="edit-desc-abat">Descrição dos Abatimentos</Label>
              <Input
                id="edit-desc-abat"
                value={descricaoAbatimentos}
                onChange={(e) => setDescricaoAbatimentos(e.target.value)}
                placeholder="Ex: Taxa cartão 3% + ISS 5%"
              />
            </div>
          )}

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
                <span className="text-primary">{fmt.format(valorLiquido)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
