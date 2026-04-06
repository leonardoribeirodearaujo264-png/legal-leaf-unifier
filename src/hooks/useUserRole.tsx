import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'user' | null;

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  avatar_url: string | null;
  position: 'socio' | 'advogado' | 'estagiario' | 'comercial' | 'administrativo' | null;
  birth_date: string | null;
  oab_number: string | null;
  oab_state: string | null;
  join_date: string | null;
  is_active: boolean;
  is_suspended: boolean;
  suspended_reason: string | null;
}

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('useUserRole: Safety timeout triggered');
        setLoading(false);
      }
    }, 10000);

    return () => clearTimeout(safetyTimeout);
  }, [loading]);

  // Track which user we already fetched to avoid redundant queries
  const fetchedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    
    if (!user) {
      fetchedUserIdRef.current = null;
      setRole(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    // Skip re-fetch if we already have data for the same user
    if (fetchedUserIdRef.current === user.id && profile && role) {
      setLoading(false);
      return;
    }

    const fetchRoleAndProfile = async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      setRole(roleData?.role as UserRole || 'user');
      fetchedUserIdRef.current = user.id;
      setLoading(false);
    };

    fetchRoleAndProfile();
  }, [user, authLoading]);

  return { 
    role, 
    profile, 
    loading, 
    isAdmin: role === 'admin', 
    isApproved: profile?.approval_status === 'approved',
    isSuspended: profile?.is_suspended === true,
    isInactive: profile?.is_active === false,
  };
};
