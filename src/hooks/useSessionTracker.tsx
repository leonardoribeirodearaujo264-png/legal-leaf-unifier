import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const SESSION_KEY = 'tribuna_session_id';
const HEARTBEAT_MS = 2 * 60 * 1000; // update last_activity_at every 2 min
const SEEN_THROTTLE_MS = 5 * 60 * 1000; // update profiles.last_seen_at every 5 min

export function useSessionTracker() {
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const startSession = async () => {
      const existingId = sessionStorage.getItem(SESSION_KEY);

      if (existingId) {
        // Resume existing tab session
        sessionIdRef.current = existingId;
        const { data } = await supabase
          .from('user_sessions')
          .select('started_at')
          .eq('id', existingId)
          .single();
        startedAtRef.current = data ? new Date(data.started_at) : new Date();
      } else {
        // Create new session
        const { data } = await supabase
          .from('user_sessions')
          .insert({
            user_id: user.id,
            user_agent: navigator.userAgent,
          })
          .select('id, started_at')
          .single();

        if (!cancelled && data) {
          sessionStorage.setItem(SESSION_KEY, data.id);
          sessionIdRef.current = data.id;
          startedAtRef.current = new Date(data.started_at);
        }
      }

      // Update profiles.last_seen_at (throttled)
      const lastSeenKey = `last_seen_${user.id}`;
      const lastSeen = parseInt(sessionStorage.getItem(lastSeenKey) || '0', 10);
      if (Date.now() - lastSeen > SEEN_THROTTLE_MS) {
        sessionStorage.setItem(lastSeenKey, String(Date.now()));
        await supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', user.id);
      }
    };

    startSession();

    // Heartbeat: keep last_activity_at fresh
    heartbeatRef.current = setInterval(async () => {
      if (!sessionIdRef.current || cancelled) return;
      const started = startedAtRef.current ?? new Date();
      const duration = Math.floor((Date.now() - started.getTime()) / 1000);
      await supabase
        .from('user_sessions')
        .update({
          last_activity_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq('id', sessionIdRef.current);
    }, HEARTBEAT_MS);

    // Use pagehide + visibilitychange to end session
    const endSession = async () => {
      if (!sessionIdRef.current) return;
      const started = startedAtRef.current ?? new Date();
      const duration = Math.floor((Date.now() - started.getTime()) / 1000);
      try {
        await supabase
          .from('user_sessions')
          .update({
            ended_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
            duration_seconds: duration,
          })
          .eq('id', sessionIdRef.current);
      } catch { /* ignore */ }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        endSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', endSession);

    return () => {
      cancelled = true;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', endSession);
      // Don't call endSession here — component unmounts on every navigation
    };
  }, [user?.id]);
}

