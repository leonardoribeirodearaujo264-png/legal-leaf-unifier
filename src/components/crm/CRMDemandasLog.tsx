import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, XCircle, RefreshCw, User, ArrowRightLeft, History, Filter, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Demanda {
  id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  vendedor_id: string;
  vendedor_nome: string;
  criado_por_nome: string;
  chatguru_note_id: string | null;
  crm_activity_id: string | null;
  status: string;
  created_at: string;
}

interface Vendedor {
  id: string;
  vendedor_id: string;
  vendedor_nome: string;
  ativo: boolean;
}

interface HistoricoItem {
  id: string;
  vendedor_anterior_nome: string | null;
  vendedor_novo_nome: string;
  alterado_por_nome: string;
  motivo: string | null;
  created_at: string;
}

export const CRMDemandasLog = () => {
  const { user, profile } = useAuth();
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVendedor, setFilterVendedor] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState('');

  // Reassign state
  const [reassignDialog, setReassignDialog] = useState(false);
  const [selectedDemanda, setSelectedDemanda] = useState<Demanda | null>(null);
  const [newVendedorId, setNewVendedorId] = useState('');
  const [reassignMotivo, setReassignMotivo] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // History state
  const [historyDialog, setHistoryDialog] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoricoItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchDemandas();
    fetchVendedores();
  }, []);

  const fetchDemandas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('comercial_demandas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) setDemandas(data as any);
    setLoading(false);
  };

  const fetchVendedores = async () => {
    const { data } = await supabase
      .from('comercial_vendedores_config')
      .select('*')
      .eq('ativo', true);
    if (data) setVendedores(data as any);
  };

  const openReassign = (demanda: Demanda) => {
    setSelectedDemanda(demanda);
    setNewVendedorId('');
    setReassignMotivo('');
    setReassignDialog(true);
  };

  const handleReassign = async () => {
    if (!selectedDemanda || !newVendedorId || !user) return;
    setReassigning(true);

    const newVendedor = vendedores.find(v => v.vendedor_id === newVendedorId);
    if (!newVendedor) {
      toast.error('Vendedor não encontrado');
      setReassigning(false);
      return;
    }

    // Insert history
    const { error: histError } = await supabase
      .from('comercial_demanda_historico')
      .insert({
        demanda_id: selectedDemanda.id,
        vendedor_anterior_id: selectedDemanda.vendedor_id,
        vendedor_anterior_nome: selectedDemanda.vendedor_nome,
        vendedor_novo_id: newVendedorId,
        vendedor_novo_nome: newVendedor.vendedor_nome,
        alterado_por: user.id,
        alterado_por_nome: profile?.full_name || user.email || 'Usuário',
        motivo: reassignMotivo || null,
      } as any);

    if (histError) {
      toast.error('Erro ao registrar histórico');
      setReassigning(false);
      return;
    }

    // Update demanda
    const { error: updError } = await supabase
      .from('comercial_demandas')
      .update({
        vendedor_id: newVendedorId,
        vendedor_nome: newVendedor.vendedor_nome,
      } as any)
      .eq('id', selectedDemanda.id);

    if (updError) {
      toast.error('Erro ao atualizar demanda');
      setReassigning(false);
      return;
    }

    // Update CRM activity if exists
    if (selectedDemanda.crm_activity_id) {
      await supabase
        .from('crm_activities')
        .update({ owner_id: newVendedorId })
        .eq('id', selectedDemanda.crm_activity_id);
    }

    toast.success(`Demanda reatribuída para ${newVendedor.vendedor_nome}`);
    setReassignDialog(false);
    setReassigning(false);
    fetchDemandas();
  };

  const openHistory = async (demandaId: string) => {
    setHistoryDialog(true);
    setHistoryLoading(true);
    const { data } = await supabase
      .from('comercial_demanda_historico')
      .select('*')
      .eq('demanda_id', demandaId)
      .order('created_at', { ascending: false });
    setHistoryItems((data || []) as any);
    setHistoryLoading(false);
  };

  const filtered = demandas.filter(d => {
    if (filterVendedor !== 'all' && d.vendedor_id !== filterVendedor) return false;
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      return d.cliente_nome.toLowerCase().includes(s) || d.criado_por_nome.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Demandas</p>
            <p className="text-2xl font-bold">{demandas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">ChatGuru OK</p>
            <p className="text-2xl font-bold text-green-600">{demandas.filter(d => d.chatguru_note_id).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">ChatGuru Falhou</p>
            <p className="text-2xl font-bold text-destructive">{demandas.filter(d => !d.chatguru_note_id).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Tarefa CRM Criada</p>
            <p className="text-2xl font-bold text-blue-600">{demandas.filter(d => d.crm_activity_id).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou criador..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterVendedor} onValueChange={setFilterVendedor}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {vendedores.map(v => (
              <SelectItem key={v.vendedor_id} value={v.vendedor_id}>{v.vendedor_nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchDemandas}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma demanda encontrada</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>ChatGuru</TableHead>
                <TableHead>CRM</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(d => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{d.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground">{d.cliente_telefone || '—'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{d.vendedor_nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{d.criado_por_nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(d.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {d.chatguru_note_id ? (
                      <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
                        <XCircle className="h-3 w-3 mr-1" /> Falha
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.crm_activity_id ? (
                      <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Sim
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs">Não</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openReassign(d)} title="Reatribuir">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openHistory(d.id)} title="Histórico">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Reassign Dialog */}
      <Dialog open={reassignDialog} onOpenChange={setReassignDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Reatribuir Demanda
            </DialogTitle>
          </DialogHeader>
          {selectedDemanda && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-sm"><strong>Cliente:</strong> {selectedDemanda.cliente_nome}</p>
                <p className="text-sm"><strong>Responsável atual:</strong> {selectedDemanda.vendedor_nome}</p>
              </div>
              <div>
                <Label>Novo responsável</Label>
                <Select value={newVendedorId} onValueChange={setNewVendedorId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.filter(v => v.vendedor_id !== selectedDemanda.vendedor_id).map(v => (
                      <SelectItem key={v.vendedor_id} value={v.vendedor_id}>{v.vendedor_nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motivo (opcional)</Label>
                <Textarea
                  value={reassignMotivo}
                  onChange={(e) => setReassignMotivo(e.target.value)}
                  placeholder="Por que está reatribuindo?"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialog(false)} disabled={reassigning}>Cancelar</Button>
            <Button onClick={handleReassign} disabled={!newVendedorId || reassigning}>
              {reassigning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Reatribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Alterações
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-center py-4 text-muted-foreground">Nenhuma alteração registrada</p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {historyItems.map(h => (
                  <div key={h.id} className="border rounded-md p-3 text-sm space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground text-xs">
                      {format(new Date(h.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      <span>— por {h.alterado_por_nome}</span>
                    </div>
                    <p>
                      <span className="text-destructive">{h.vendedor_anterior_nome || '—'}</span>
                      {' → '}
                      <span className="text-green-600 font-medium">{h.vendedor_novo_nome}</span>
                    </p>
                    {h.motivo && <p className="text-xs text-muted-foreground italic">{h.motivo}</p>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
