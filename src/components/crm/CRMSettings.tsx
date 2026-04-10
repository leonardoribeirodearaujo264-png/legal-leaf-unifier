import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

interface SyncLog {
  id: string;
  sync_type: string;
  entity_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface CRMSettingsProps {
  onSettingsChange: () => void;
}

export const CRMSettings = ({ onSettingsChange }: CRMSettingsProps) => {
  const { profile } = useUserRole();
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSyncLogs();
    setLoading(false);
  }, []);

  const fetchSyncLogs = async () => {
    const { data } = await supabase
      .from('crm_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    setSyncLogs(data || []);
  };

  const getSyncTypeName = (type: string) => {
    const types: Record<string, string> = {
      full: 'Sincronização Completa',
      manual: 'Manual',
      webhook: 'Webhook',
      bidirectional: 'Bidirecional'
    };
    return types[type] || type;
  };

  const getEntityTypeName = (type: string) => {
    const types: Record<string, string> = {
      pipeline: 'Pipeline',
      contact: 'Contato',
      deal: 'Oportunidade',
      stage: 'Etapa',
      deal_stage: 'Etapa de Oportunidade',
      activity: 'Atividade'
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status do CRM */}
      <Card>
        <CardHeader>
          <CardTitle>Modo de Operação</CardTitle>
          <CardDescription>
            Configuração do CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-green-700">CRM Independente</p>
              <p className="text-sm text-green-600">
                O CRM opera de forma totalmente independente. Todos os dados estão armazenados localmente na intranet.
                Contatos, oportunidades e atividades são gerenciados diretamente aqui.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Logs (historical) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Sincronização
          </CardTitle>
          <CardDescription>
            Registro histórico de sincronizações anteriores com RD Station
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum registro de sincronização
            </p>
          ) : (
            <div className="space-y-2">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {log.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {getSyncTypeName(log.sync_type)} - {getEntityTypeName(log.entity_type)}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-red-500">{log.error_message}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
