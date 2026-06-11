import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UsageHistoryItem {
  id: string;
  tool_name: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function Historico() {
  const { user } = useAuth();
  const [history, setHistory] = useState<UsageHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('usage_history')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    setHistory(data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Meu Histórico</h1>
          <p className="text-muted-foreground text-lg">
            Acompanhe o histórico de uso das ferramentas
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Atividades</CardTitle>
            <CardDescription>
              Registro de todas as suas atividades no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma atividade registrada ainda
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 border border-border rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline">{item.tool_name}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.action}
                    </p>
                    {item.metadata && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        {item.metadata.fileCount && (
                          <div>Arquivos processados: {item.metadata.fileCount}</div>
                        )}
                        {item.metadata.documentCount && (
                          <div>Documentos gerados: {item.metadata.documentCount}</div>
                        )}
                        {item.metadata.processingTime && (
                          <div>Tempo de processamento: {item.metadata.processingTime}s</div>
                        )}
                        {item.metadata.mergedAll !== undefined && (
                          <div>
                            Modo: {item.metadata.mergedAll ? 'Mesclado (único PDF)' : 'Agrupado por tipo'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
