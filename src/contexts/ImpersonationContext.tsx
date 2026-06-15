import { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ImpersonationState {
  isActive: boolean;
  targetUserId: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  impersonationId: string | null;
}

interface ImpersonationContextType {
  impersonation: ImpersonationState;
  startImpersonation: (params: {
    adminId: string;
    targetId: string;
    targetName: string;
    targetEmail: string;
    reason: string;
  }) => Promise<void>;
  stopImpersonation: (adminId: string) => Promise<void>;
}

const INITIAL: ImpersonationState = {
  isActive: false,
  targetUserId: null,
  targetUserName: null,
  targetUserEmail: null,
  impersonationId: null,
};

function loadFromStorage(): ImpersonationState {
  try {
    const raw = sessionStorage.getItem('tribuna_impersonation');
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as ImpersonationState;
    return parsed.isActive ? parsed : INITIAL;
  } catch {
    return INITIAL;
  }
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonation: INITIAL,
  startImpersonation: async () => {},
  stopImpersonation: async () => {},
});

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonation, setImpersonation] = useState<ImpersonationState>(loadFromStorage);

  const startImpersonation = async ({
    adminId,
    targetId,
    targetName,
    targetEmail,
    reason,
  }: {
    adminId: string;
    targetId: string;
    targetName: string;
    targetEmail: string;
    reason: string;
  }) => {
    const { data } = await supabase
      .from('admin_impersonations')
      .insert({
        admin_user_id: adminId,
        target_user_id: targetId,
        reason,
        is_active: true,
      })
      .select('id')
      .single();

    // Log audit action
    await supabase.from('user_activity_logs').insert({
      user_id: adminId,
      action: 'ADMIN_IMPERSONATION_STARTED',
      entity_type: 'user',
      entity_id: targetId,
      metadata: { target_name: targetName, reason },
    });

    const state: ImpersonationState = {
      isActive: true,
      targetUserId: targetId,
      targetUserName: targetName,
      targetUserEmail: targetEmail,
      impersonationId: data?.id ?? null,
    };

    sessionStorage.setItem('tribuna_impersonation', JSON.stringify(state));
    setImpersonation(state);
  };

  const stopImpersonation = async (adminId: string) => {
    if (impersonation.impersonationId) {
      await supabase
        .from('admin_impersonations')
        .update({ ended_at: new Date().toISOString(), is_active: false })
        .eq('id', impersonation.impersonationId);

      await supabase.from('user_activity_logs').insert({
        user_id: adminId,
        action: 'ADMIN_IMPERSONATION_ENDED',
        entity_type: 'user',
        entity_id: impersonation.targetUserId ?? undefined,
        metadata: { target_name: impersonation.targetUserName },
      });
    }

    sessionStorage.removeItem('tribuna_impersonation');
    setImpersonation(INITIAL);
  };

  return (
    <ImpersonationContext.Provider value={{ impersonation, startImpersonation, stopImpersonation }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  return useContext(ImpersonationContext);
}
