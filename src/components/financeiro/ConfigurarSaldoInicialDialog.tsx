import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContaSemSaldo {
  id: string;
  nome: string;
  saldo_inicial: number | null;
}

interface ConfigurarSaldoInicialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ConfigurarSaldoInicialDialog({ open, onOpenChange, onSaved }: ConfigurarSaldoInicialDialogProps) {
  const [contas, setContas] = useState<ContaSemSaldo[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    void loadContas();
  }, [open]);

  const loadContas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fin_contas')
      .select('id, nome, saldo_inicial')
      .eq('ativa', true)
      .order('nome');

    if (error) {
      toast.error('Erro ao carregar contas');
      setLoading(false);
      return;
    }

    const semSaldo = (data || []).filter((c) => !Number(c.saldo_inicial));
    setContas(semSaldo);
    setValores({});
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(valores)
        .filter(([, v]) => v && !isNaN(parseFloat(v)))
        .map(([id, v]) => ({ id, saldo_inicial: parseFloat(v) }));

      if (updates.length === 0) {
        toast.error('Informe ao menos um saldo inicial');
        setSaving(false);
        return;
      }

      for (const u of updates) {
        const { error } = await supabase
          .from('fin_contas')
          .update({ saldo_inicial: u.saldo_inicial, saldo_atual: u.saldo_inicial })
          .eq('id', u.id);
        if (error) throw error;
      }

      toast.success(`${updates.length} conta(s) atualizada(s)`);
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Configurar saldo inicial das contas
          </DialogTitle>
          <DialogDescription>
            Informe o saldo inicial de cada conta para que apareça no Saldo Total em Caixa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto py-2">
          {loading && <p className="text-sm text-muted-foreground">Carregando contas...</p>}
          {!loading && contas.length === 0 && (
            <p className="text-sm text-muted-foreground">Todas as contas já possuem saldo inicial configurado.</p>
          )}
          {contas.map((conta) => (
            <div key={conta.id} className="grid grid-cols-[1fr_180px] gap-3 items-center">
              <Label htmlFor={`saldo-${conta.id}`} className="text-sm font-medium">
                {conta.nome}
              </Label>
              <Input
                id={`saldo-${conta.id}`}
                type="number"
                step="0.01"
                placeholder="R$ 0,00"
                value={valores[conta.id] || ''}
                onChange={(e) => setValores((prev) => ({ ...prev, [conta.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || contas.length === 0}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
