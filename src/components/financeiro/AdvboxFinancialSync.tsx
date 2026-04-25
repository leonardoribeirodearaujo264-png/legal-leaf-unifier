import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Database,
  ArrowDownCircle,
  Info,
  Loader2,
  Play,
  Square
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SyncStatus {
  id: string;
  sync_type: string;
  status: string;
  last_offset: number;
  total_processed: number;
  total_created: number;
  total_updated: number;
  total_skipped: number;
  months: number;
  start_date: string | null;
  end_date: string | null;
  started_at: string | null;
  last_run_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export function AdvboxFinancialSync() {
  const [syncing, setSyncing] = useState(false);
  const [months, setMonths] = useState('60');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [stats, setStats] = useState<{
    totalLocal: number;
    lastUpdated: string | null;
  }>({ totalLocal: 0, lastUpdated: null });

  const fetchSyncStatus = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('advbox_sync_status')
        .select('*')
        .eq('sync_type', 'financial')
        .single();

      if (data) {
        setSyncStatus(data as SyncStatus);
        setSyncing(data.status === 'running');
      }
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { count: localCount } = await supabase
        .from('fin_lancamentos')
        .select('*', { count: 'exact', head: true })
        .not('advbox_transaction_id', 'is', null);

      const { data: lastSyncData } = await supabase
        .from('advbox_financial_sync')
        .select('last_updated')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      setStats({
        totalLocal: localCount || 0,
        lastUpdated: lastSyncData?.last_updated || null,
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchSyncStatus();
  }, [fetchStats, fetchSyncStatus]);

  // Poll for status updates while syncing
  useEffect(() => {
    if (!syncing) return;

    const interval = setInterval(() => {
      fetchSyncStatus();
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [syncing, fetchSyncStatus, fetchStats]);

  const handleStartSync = async () => {
    setSyncing(true);

    try {
      toast.info('Iniciando sincronização automática com ADVBox...');

      const { data, error } = await supabase.functions.invoke('sync-advbox-financial', {
        body: { 
          months: parseInt(months),
          force_restart: true
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.message || data.error || 'Erro desconhecido');
      }

      if (data.status === 'completed') {
        toast.success(`Sincronização concluída! ${data.total_created} novos registros.`);
        setSyncing(false);
      } else if (data.status === 'running') {
        toast.success('Sincronização iniciada! O processo continuará automaticamente em segundo plano.');
      }

      fetchSyncStatus();
      fetchStats();

    } catch (error) {
      console.error('Erro na sincronização:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao sincronizar');
      setSyncing(false);
    }
  };

  const handleStopSync = async () => {
    try {
      await supabase
        .from('advbox_sync_status')
        .update({ status: 'idle' })
        .eq('sync_type', 'financial');
      
      toast.info('Sincronização pausada.');
      setSyncing(false);
      fetchSyncStatus();
    } catch (error) {
      console.error('Erro ao parar sincronização:', error);
    }
  };

  const handleResync = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso irá APAGAR todos os lançamentos importados do ADVBox e reimportá-los com as classificações corretas.\n\nTransferências entre contas serão ignoradas.\n\nDeseja continuar?')) {
      return;
    }

    setSyncing(true);

    try {
      toast.info('Limpando dados antigos do ADVBox... Isso pode levar alguns minutos.');

      // Usar RPC para deletar em lotes e evitar timeout
      // Primeiro, limpar tabela de sincronização (FK constraint)
      let deletedSyncCount = 0;
      let hasMoreSync = true;
      
      while (hasMoreSync) {
        const { data: syncBatch } = await supabase
          .from('advbox_financial_sync')
          .select('id')
          .limit(500);
        
        if (!syncBatch || syncBatch.length === 0) {
          hasMoreSync = false;
          break;
        }

        const idsToDelete = syncBatch.map(r => r.id);
        const { error: deleteSyncError } = await supabase
          .from('advbox_financial_sync')
          .delete()
          .in('id', idsToDelete);

        if (deleteSyncError) {
          throw new Error(`Erro ao limpar sincronização: ${deleteSyncError.message}`);
        }

        deletedSyncCount += idsToDelete.length;
        toast.info(`Limpando sincronização... ${deletedSyncCount} registros removidos`);
      }

      // Agora deletar lançamentos em lotes
      let deletedLancCount = 0;
      let hasMoreLanc = true;
      
      while (hasMoreLanc) {
        const { data: lancBatch } = await supabase
          .from('fin_lancamentos')
          .select('id')
          .not('advbox_transaction_id', 'is', null)
          .limit(500);
        
        if (!lancBatch || lancBatch.length === 0) {
          hasMoreLanc = false;
          break;
        }

        const idsToDelete = lancBatch.map(r => r.id);
        const { error: deleteError } = await supabase
          .from('fin_lancamentos')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          throw new Error(`Erro ao limpar lançamentos: ${deleteError.message}`);
        }

        deletedLancCount += idsToDelete.length;
        toast.info(`Limpando lançamentos... ${deletedLancCount} registros removidos`);
      }

      // Resetar status
      await supabase
        .from('advbox_sync_status')
        .update({ 
          status: 'idle',
          last_offset: 0,
          total_processed: 0,
          total_created: 0,
          total_updated: 0,
          total_skipped: 0,
          completed_at: null,
          error_message: null
        })
        .eq('sync_type', 'financial');

      toast.success(`Dados limpos! ${deletedLancCount} lançamentos removidos. Iniciando nova sincronização...`);
      
      // Iniciar nova sincronização
      await handleStartSync();
      
    } catch (error) {
      console.error('Erro na resincronização:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao resincronizar');
      setSyncing(false);
    }
  };

  const getProgressPercent = () => {
    if (!syncStatus || syncStatus.status !== 'running') return 0;
    // Estimate based on typical transaction counts
    const estimatedTotal = 10000; // rough estimate
    return Math.min(95, (syncStatus.total_processed / estimatedTotal) * 100);
  };

  const getMinutesSinceLastRun = (): number | null => {
    if (!syncStatus?.last_run_at) return null;
    const last = new Date(syncStatus.last_run_at).getTime();
    return Math.floor((Date.now() - last) / 60000);
  };

  const isStalled = (): boolean => {
    if (syncStatus?.status !== 'running') return false;
    const mins = getMinutesSinceLastRun();
    return mins !== null && mins > 15;
  };

  const getStatusBadge = () => {
    if (!syncStatus) return <Badge variant="outline">Não iniciado</Badge>;

    if (isStalled()) {
      const mins = getMinutesSinceLastRun();
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Sync parado há {mins} min
        </Badge>
      );
    }

    switch (syncStatus.status) {
      case 'running':
        return (
          <Badge variant="secondary" className="animate-pulse gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Sincronizando ({syncStatus.total_processed} processados)
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Concluído
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Erro
          </Badge>
        );
      default:
        return <Badge variant="outline">Aguardando</Badge>;
    }
  };

  const handleForceResync = async () => {
    if (!confirm('Forçar resync irá resetar o cursor (offset=0) e descartar o cache antes de disparar a sincronização. Continuar?')) {
      return;
    }
    try {
      // Reset cursor
      await supabase
        .from('advbox_sync_status')
        .update({
          status: 'idle',
          last_offset: 0,
          total_processed: 0,
          total_created: 0,
          total_updated: 0,
          total_skipped: 0,
          completed_at: null,
          error_message: null,
        })
        .eq('sync_type', 'financial');

      // Limpar cache do dashboard
      await supabase.from('advbox_dashboard_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      toast.info('Cursor resetado e cache limpo. Iniciando resync...');
      await handleStartSync();
    } catch (error) {
      console.error('Erro ao forçar resync:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao forçar resync');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sincronização ADVBox
            </CardTitle>
            <CardDescription>
              Importe lançamentos financeiros do ADVBox automaticamente
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Download className="h-4 w-4" />
              Importados
            </div>
            <div className="text-2xl font-bold mt-1">{stats.totalLocal}</div>
            <div className="text-xs text-muted-foreground">lançamentos do ADVBox</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Última Atualização
            </div>
            <div className="text-lg font-semibold mt-1">
              {stats.lastUpdated 
                ? format(new Date(stats.lastUpdated), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                : 'Nunca'
              }
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownCircle className="h-4 w-4" />
              Novos Registros
            </div>
            <div className="text-2xl font-bold mt-1 text-green-600">
              {syncStatus?.total_created || 0}
            </div>
            <div className="text-xs text-muted-foreground">nesta sincronização</div>
          </div>
        </div>

        {/* Progress Section */}
        {syncStatus?.status === 'running' && (
          <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="font-medium">Sincronização em andamento</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {syncStatus.total_processed} registros processados
              </span>
            </div>
            <Progress value={getProgressPercent()} className="h-2" />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Novos:</span>{' '}
                <span className="font-medium text-green-600">{syncStatus.total_created}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Atualizados:</span>{' '}
                <span className="font-medium text-blue-600">{syncStatus.total_updated}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Já existentes:</span>{' '}
                <span className="font-medium text-muted-foreground">{syncStatus.total_skipped}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A sincronização continua automaticamente a cada 2 minutos até ser concluída.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {syncStatus?.status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro na Sincronização</AlertTitle>
            <AlertDescription>
              {syncStatus.error_message || 'Ocorreu um erro durante a sincronização.'}
              <br />
              <span className="text-sm">
                Processados até o momento: {syncStatus.total_processed} ({syncStatus.total_created} criados)
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Completed Alert */}
        {syncStatus?.status === 'completed' && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-200">Sincronização Concluída!</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                <div>Total verificados: <strong>{syncStatus.total_processed}</strong></div>
                <div>Novos importados: <strong className="text-green-600">{syncStatus.total_created}</strong></div>
                <div>Atualizados: <strong className="text-blue-600">{syncStatus.total_updated}</strong></div>
                <div>Já existentes: <strong className="text-muted-foreground">{syncStatus.total_skipped}</strong></div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                * "Já existentes" são registros que já haviam sido importados anteriormente.
              </p>
              {syncStatus.completed_at && (
                <p className="mt-2 text-sm">
                  Concluído em: {format(new Date(syncStatus.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Sync Options */}
        <div className="rounded-lg border p-4 space-y-4">
          <h4 className="font-medium">Opções de Sincronização</h4>
          
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={months} onValueChange={setMonths} disabled={syncing}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Último mês</SelectItem>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Último ano</SelectItem>
                <SelectItem value="24">Últimos 2 anos</SelectItem>
                <SelectItem value="60">Últimos 5 anos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            {syncing ? (
              <Button 
                onClick={handleStopSync} 
                variant="destructive"
                className="flex-1"
                size="lg"
              >
                <Square className="h-4 w-4 mr-2" />
                Parar Sincronização
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleStartSync} 
                  className="flex-1"
                  size="lg"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {syncStatus?.status === 'completed' ? 'Sincronizar Novamente' : 'Iniciar Sincronização'}
                </Button>
                {stats.totalLocal > 0 && (
                  <Button 
                    onClick={handleResync} 
                    variant="outline"
                    size="lg"
                    title="Limpar todos os dados e reimportar com classificações corretas"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resincronizar
                  </Button>
                )}
              </>
            )}
          </div>
          
          {stats.totalLocal > 0 && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Correção de Classificação</AlertTitle>
              <AlertDescription className="text-sm">
                Se os dados financeiros estão mostrando valores incorretos, use o botão <strong>"Resincronizar"</strong> para limpar e reimportar todos os lançamentos com as classificações corrigidas.
                <br />
                <span className="text-xs text-muted-foreground mt-1 block">
                  Transferências entre contas serão ignoradas (não afetam o resultado).
                </span>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sincronização Automática</AlertTitle>
          <AlertDescription className="text-sm">
            Ao iniciar a sincronização, o sistema busca automaticamente todos os lançamentos do ADVBox no período selecionado.
            O processo continua em segundo plano a cada 2 minutos até que todos os registros sejam importados.
            Você pode acompanhar o progresso nesta tela ou sair e voltar mais tarde.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
