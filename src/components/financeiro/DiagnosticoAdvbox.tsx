import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, AlertTriangle, CheckCircle2, Activity, Zap, FlaskConical } from 'lucide-react';

// Gabaritos do ADVBox (referência atualizada manualmente)
const GABARITOS = {
  saldo_total: 301974.74,
  receita_realizada: 103420.30,
  receita_prevista: 127801.69,
  despesa_realizada: -153081.54,
  atrasados: -3191.96,
};

interface Conta {
  id: string;
  nome: string;
  saldo_inicial: number;
  saldo_atual: number;
  advbox_account_id: number | null;
  ativa: boolean;
}

interface OrphanLanc {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_vencimento: string;
  observacoes: string | null;
  advbox_id: number | null;
}

interface WritebackLog {
  id: string;
  lancamento_id: string | null;
  advbox_id: number | null;
  status: string;
  http_status: number | null;
  error_message: string | null;
  created_at: string;
}

interface ExcludedLanc {
  id: string;
  data_vencimento: string;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  reason: string;
}

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function deltaCell(intranet: number, advbox: number) {
  const delta = intranet - advbox;
  const ok = Math.abs(delta) < 1;
  return (
    <span className={ok ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
      {ok ? '✅ OK' : `Δ ${fmtBRL(delta)}`}
    </span>
  );
}

export function DiagnosticoAdvbox() {
  const [loading, setLoading] = useState(true);
  const [diagnostico, setDiagnostico] = useState<any>(null);
  const [contas, setContas] = useState<Conta[]>([]);
  const [orphans, setOrphans] = useState<OrphanLanc[]>([]);
  const [logs, setLogs] = useState<WritebackLog[]>([]);
  const [writebackEnabled, setWritebackEnabled] = useState(false);
  const [writebackTestMode, setWritebackTestMode] = useState(true);
  const [testing, setTesting] = useState(false);
  const [excluded, setExcluded] = useState<ExcludedLanc[]>([]);
  const [resyncing, setResyncing] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [diagRes, contasRes, orphansRes, settingsRes, logsRes, excludedRes] = await Promise.all([
        supabase.rpc('fin_advbox_diagnostico'),
        supabase.from('fin_contas').select('*').eq('ativa', true).order('saldo_atual', { ascending: false }),
        supabase
          .from('fin_lancamentos')
          .select('id, descricao, valor, tipo, data_vencimento, observacoes, advbox_id')
          .eq('needs_review', true)
          .is('deleted_at', null)
          .limit(50),
        supabase.from('fin_settings').select('*').eq('id', 'singleton').maybeSingle(),
        supabase
          .from('fin_advbox_writeback_logs')
          .select('id, lancamento_id, advbox_id, status, http_status, error_message, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.rpc('fin_advbox_excluded_by_filter'),
      ]);

      setDiagnostico(diagRes.data ?? null);
      setContas((contasRes.data as any) ?? []);
      setOrphans((orphansRes.data as any) ?? []);
      setLogs((logsRes.data as any) ?? []);
      setExcluded((excludedRes.data as any) ?? []);
      if (settingsRes.data) {
        setWritebackEnabled(settingsRes.data.writeback_enabled === true);
        setWritebackTestMode(settingsRes.data.writeback_test_mode === true);
      }
    } catch (e) {
      console.error('Erro ao carregar diagnóstico:', e);
      toast.error('Erro ao carregar diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleForceRefresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('fin_force_refresh_dashboard');
      if (error) throw error;
      toast.success(`Saldos recalculados (${(data as any)?.contas_recalculadas ?? 0} contas) e cache limpo.`);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao recalcular');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWriteback = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('fin_settings')
        .update({ writeback_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', 'singleton');
      if (error) throw error;
      setWritebackEnabled(enabled);
      toast.success(`Writeback ADVBox ${enabled ? 'habilitado' : 'desabilitado'}`);
    } catch (e) {
      toast.error('Erro ao atualizar configuração');
    }
  };

  const handleToggleTestMode = async (testMode: boolean) => {
    try {
      const { error } = await supabase
        .from('fin_settings')
        .update({ writeback_test_mode: testMode, updated_at: new Date().toISOString() })
        .eq('id', 'singleton');
      if (error) throw error;
      setWritebackTestMode(testMode);
      toast.success(`Modo teste ${testMode ? 'ATIVO' : 'desativado'}`);
    } catch (e) {
      toast.error('Erro ao atualizar configuração');
    }
  };

  const handleTestWriteback = async () => {
    setTesting(true);
    try {
      // Pega o primeiro lançamento da conta Asaas pra teste
      const { data: contaAsaas } = await supabase
        .from('fin_contas')
        .select('id')
        .ilike('nome', '%asaas%')
        .limit(1)
        .maybeSingle();

      if (!contaAsaas) {
        toast.error('Conta Asaas não encontrada para teste');
        setTesting(false);
        return;
      }

      const { data: testLanc, error: insertErr } = await supabase
        .from('fin_lancamentos')
        .insert([{
          tipo: 'receita',
          valor: 1.00,
          descricao: 'TESTE WRITEBACK ADVBox - ' + new Date().toISOString(),
          data_vencimento: new Date().toISOString().slice(0, 10),
          data_pagamento: new Date().toISOString().slice(0, 10),
          status: 'pago',
          conta_origem_id: contaAsaas.id,
          observacoes: 'Lançamento de teste do writeback bidirecional',
        } as any])
        .select('id')
        .single();

      if (insertErr || !testLanc) throw insertErr ?? new Error('Falha ao criar lançamento de teste');

      const { data: result, error: writeErr } = await supabase.functions.invoke('advbox-write-lancamento', {
        body: { lancamento_id: testLanc.id },
      });

      if (writeErr) throw writeErr;

      if ((result as any)?.success) {
        toast.success(
          (result as any).test_mode
            ? `✅ TEST MODE: payload simulado gerado. Veja em "Logs" abaixo.`
            : `✅ Lançamento criado no ADVBox! ID: ${(result as any).advbox_id}`,
          { duration: 6000 }
        );
      } else {
        toast.warning(`Resposta: ${JSON.stringify(result)}`);
      }

      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro no teste');
    } finally {
      setTesting(false);
    }
  };

  const contasComAdvbox = contas.filter((c) => c.advbox_account_id !== null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Diagnóstico ADVBox
            </CardTitle>
            <CardDescription>
              Cross-check de saldos e métricas entre ADVBox e Intranet · Gabaritos manuais
            </CardDescription>
          </div>
          <Button onClick={handleForceRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Forçar Recálculo + Limpar Cache
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="metricas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="metricas">Métricas-Gabarito</TabsTrigger>
            <TabsTrigger value="contas">Contas ({contasComAdvbox.length})</TabsTrigger>
            <TabsTrigger value="orfaos">Órfãos ({orphans.length})</TabsTrigger>
            <TabsTrigger value="writeback">Writeback Bidirecional</TabsTrigger>
          </TabsList>

          {/* Tab 1: Métricas-Gabarito */}
          <TabsContent value="metricas" className="space-y-4">
            {diagnostico && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Métrica</TableHead>
                    <TableHead className="text-right">ADVBox (gabarito)</TableHead>
                    <TableHead className="text-right">Intranet</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Saldo Total em Caixa</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(GABARITOS.saldo_total)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(Number(diagnostico.saldo_total_intranet))}</TableCell>
                    <TableCell className="text-right">
                      {deltaCell(Number(diagnostico.saldo_total_intranet), GABARITOS.saldo_total)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Receita realizada (mês)</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(GABARITOS.receita_realizada)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(Number(diagnostico.receita_realizada))}</TableCell>
                    <TableCell className="text-right">
                      {deltaCell(Number(diagnostico.receita_realizada), GABARITOS.receita_realizada)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Receita prevista (mês)</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(GABARITOS.receita_prevista)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(Number(diagnostico.receita_prevista))}</TableCell>
                    <TableCell className="text-right">
                      {deltaCell(Number(diagnostico.receita_prevista), GABARITOS.receita_prevista)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Despesa realizada (mês)</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(GABARITOS.despesa_realizada)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(Number(diagnostico.despesa_realizada))}</TableCell>
                    <TableCell className="text-right">
                      {deltaCell(Number(diagnostico.despesa_realizada), GABARITOS.despesa_realizada)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Atrasados (mês)</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(GABARITOS.atrasados)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(Number(diagnostico.atrasados))}</TableCell>
                    <TableCell className="text-right">
                      {deltaCell(Number(diagnostico.atrasados), GABARITOS.atrasados)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
            <div className="text-xs text-muted-foreground">
              Gabaritos extraídos do ADVBox em 24/04 23h45 BRT. Atualize <code>GABARITOS</code> em <code>DiagnosticoAdvbox.tsx</code> conforme necessário.
            </div>
          </TabsContent>

          {/* Tab 2: Contas com advbox_account_id */}
          <TabsContent value="contas" className="space-y-4">
            <Alert>
              <AlertTitle>Contas vinculadas ao ADVBox</AlertTitle>
              <AlertDescription>
                {diagnostico && (
                  <>
                    {diagnostico.contas_com_advbox} contas vinculadas, {diagnostico.contas_sem_advbox} sem vínculo.
                    Saldo total intranet: <strong>{fmtBRL(Number(diagnostico.saldo_total_intranet))}</strong>.
                  </>
                )}
              </AlertDescription>
            </Alert>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">ADVBox ID</TableHead>
                  <TableHead className="text-right">Saldo Inicial</TableHead>
                  <TableHead className="text-right">Saldo Atual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contasComAdvbox.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{c.advbox_account_id}</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(Number(c.saldo_inicial))}</TableCell>
                    <TableCell className={`text-right font-mono font-medium ${Number(c.saldo_atual) >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                      {fmtBRL(Number(c.saldo_atual))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Tab 3: Lançamentos órfãos */}
          <TabsContent value="orfaos" className="space-y-4">
            <Alert variant={orphans.length > 0 ? 'default' : 'default'}>
              {orphans.length > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertTitle>
                {orphans.length} lançamento(s) órfão(s)
              </AlertTitle>
              <AlertDescription>
                Lançamentos sincronizados do ADVBox cuja conta não pôde ser identificada (bank_name não casa). Atribua manualmente uma conta editando o lançamento em "Movimentações → Lançamentos".
              </AlertDescription>
            </Alert>
            {orphans.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">ADVBox ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orphans.slice(0, 30).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.data_vencimento}</TableCell>
                      <TableCell>
                        <Badge variant={l.tipo === 'receita' ? 'default' : 'destructive'}>{l.tipo}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{l.descricao}</TableCell>
                      <TableCell className="text-right font-mono">{fmtBRL(Number(l.valor))}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{l.advbox_id ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Tab 4: Writeback */}
          <TabsContent value="writeback" className="space-y-4">
            <Alert>
              <Zap className="h-4 w-4" />
              <AlertTitle>Sincronização Bidirecional Intranet → ADVBox</AlertTitle>
              <AlertDescription>
                Quando habilitado, lançamentos criados na intranet são automaticamente enviados para o ADVBox.
                <strong className="block mt-2">⚠️ Comece com Modo Teste ATIVO para validar o payload sem fazer chamadas reais.</strong>
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="writeback-toggle" className="text-base font-medium">
                        Writeback ADVBox
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Habilita o envio automático de novos lançamentos para o ADVBox
                      </p>
                    </div>
                    <Switch
                      id="writeback-toggle"
                      checked={writebackEnabled}
                      onCheckedChange={handleToggleWriteback}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="testmode-toggle" className="text-base font-medium flex items-center gap-2">
                        <FlaskConical className="h-4 w-4" /> Modo Teste
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Apenas registra payload; não chama o ADVBox real
                      </p>
                    </div>
                    <Switch
                      id="testmode-toggle"
                      checked={writebackTestMode}
                      onCheckedChange={handleToggleTestMode}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div>
                    <Label className="text-base font-medium">Teste R$ 1,00</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cria um lançamento "TESTE WRITEBACK" R$ 1,00 na conta Asaas e dispara o writeback.
                    </p>
                  </div>
                  <Button onClick={handleTestWriteback} disabled={testing} className="w-full">
                    {testing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Testando...
                      </>
                    ) : (
                      <>
                        <FlaskConical className="h-4 w-4 mr-2" />
                        Disparar teste R$ 1,00
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Últimos logs de writeback</h4>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum log ainda. Dispare um teste acima.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>HTTP</TableHead>
                      <TableHead>ADVBox ID</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">
                          {new Date(l.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              l.status === 'success' ? 'default' :
                              l.status === 'error' ? 'destructive' :
                              'secondary'
                            }
                          >
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.http_status ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{l.advbox_id ?? '—'}</TableCell>
                        <TableCell className="text-xs text-red-600 max-w-md truncate">{l.error_message ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
