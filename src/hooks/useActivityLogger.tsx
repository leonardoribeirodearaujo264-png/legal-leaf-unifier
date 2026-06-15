import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ActivityAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CASE_CREATED'
  | 'CASE_IMPORTED'
  | 'CASE_UPDATED'
  | 'AI_USED'
  | 'AGENT_CREATED'
  | 'AGENT_USED'
  | 'SPECIALIST_USED'
  | 'REPORT_GENERATED'
  | 'PROFILE_UPDATED'
  | 'ADMIN_APPROVED_USER'
  | 'ADMIN_REJECTED_USER'
  | 'ADMIN_CHANGED_ROLE'
  | 'ADMIN_BLOCKED_USER'
  | 'ADMIN_UNBLOCKED_USER'
  | 'ADMIN_IMPERSONATION_STARTED'
  | 'ADMIN_IMPERSONATION_ENDED';

export function useActivityLogger() {
  const { user } = useAuth();

  const logActivity = useCallback(
    async (
      action: ActivityAction,
      entityType?: string,
      entityId?: string,
      metadata?: Record<string, unknown>
    ) => {
      if (!user) return;
      try {
        await supabase.from('user_activity_logs').insert({
          user_id: user.id,
          action,
          entity_type: entityType ?? null,
          entity_id: entityId ?? null,
          metadata: metadata ?? {},
        });
      } catch {
        // non-critical: swallow silently
      }
    },
    [user]
  );

  return { logActivity };
}
