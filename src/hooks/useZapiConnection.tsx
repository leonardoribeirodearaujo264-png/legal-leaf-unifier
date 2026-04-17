import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ZapiStatus {
  connected: boolean | null;
  statusData: Record<string, any> | null;
  loading: boolean;
  error: string | null;
}

export function useZapiConnection(pollIntervalMs = 5 * 60 * 1000) {
  const [status, setStatus] = useState<ZapiStatus>({
    connected: null,
    statusData: null,
    loading: true,
    error: null,
  });
  const [settingUpWebhooks, setSettingUpWebhooks] = useState(false);
  const previousConnected = useRef<boolean | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));
      const { data, error } = await supabase.functions.invoke('zapi-send-message', {
        body: { action: 'test-connection' },
      });

      if (error) {
        console.error('[Z-API Status] Error:', error);
        setStatus({ connected: false, statusData: null, loading: false, error: error.message });
        return;
      }

      const isConnected = data?.connected === true;
      
      // Detect disconnection
      if (previousConnected.current === true && !isConnected) {
        console.warn('[Z-API Status] Connection lost!');
      }
      previousConnected.current = isConnected;

      setStatus({
        connected: isConnected,
        statusData: data?.status || null,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('[Z-API Status] Exception:', err);
      setStatus({
        connected: false,
        statusData: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  }, []);

  const setupWebhooks = useCallback(async () => {
    setSettingUpWebhooks(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-send-message', {
        body: { action: 'setup-webhooks' },
      });

      if (error) throw error;
      return data;
    } catch (err) {
      throw err;
    } finally {
      setSettingUpWebhooks(false);
    }
  }, []);

  // Initial check
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Polling — só quando a aba está visível para reduzir consumo de Cloud
  useEffect(() => {
    const tick = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        checkConnection();
      }
    };
    const interval = setInterval(tick, pollIntervalMs);
    return () => clearInterval(interval);
  }, [checkConnection, pollIntervalMs]);

  return {
    ...status,
    settingUpWebhooks,
    checkConnection,
    setupWebhooks,
  };
}
