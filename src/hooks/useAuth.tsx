// Auth provider with auto-logout after 6 hours of inactivity
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const INACTIVITY_TIMEOUT = 6 * 60 * 60 * 1000; // 6 hours
const LAST_ACTIVITY_KEY = 'egg_nunes_last_activity';

interface StoredActivity {
  userId: string;
  timestamp: number;
}

function getStoredActivity(): StoredActivity | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return null;
    // Handle legacy format (plain number)
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'number') return null; // legacy, treat as invalid
    if (parsed && typeof parsed.userId === 'string' && typeof parsed.timestamp === 'number') {
      return parsed as StoredActivity;
    }
    return null;
  } catch {
    return null;
  }
}

function setStoredActivity(userId: string) {
  localStorage.setItem(LAST_ACTIVITY_KEY, JSON.stringify({ userId, timestamp: Date.now() }));
}

function clearStoredActivity() {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const forceSignOut = useCallback(async () => {
    clearStoredActivity();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    await supabase.auth.signOut();
    navigate('/auth');
  }, [navigate]);

  const signOut = useCallback(async () => {
    await forceSignOut();
  }, [forceSignOut]);

  // Check if a restored session should be invalidated due to inactivity
  const shouldInvalidateRestoredSession = useCallback((userId: string): boolean => {
    const stored = getStoredActivity();
    if (!stored) return false; // No activity record — fresh or cleared, allow
    if (stored.userId !== userId) {
      // Different user's activity — clear it and allow
      clearStoredActivity();
      return false;
    }
    return (Date.now() - stored.timestamp) > INACTIVITY_TIMEOUT;
  }, []);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback((userId: string) => {
    setStoredActivity(userId);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      console.log('Auto-logout due to 6 hours of inactivity');
      forceSignOut();
    }, INACTIVITY_TIMEOUT);
  }, [forceSignOut]);

  // Activity listeners
  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    let lastUpdate = 0;
    const throttleMs = 60000;

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > throttleMs) {
        lastUpdate = now;
        resetInactivityTimer(userId);
      } else {
        // Just reset the JS timer without writing to localStorage
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
          console.log('Auto-logout due to 6 hours of inactivity');
          forceSignOut();
        }, INACTIVITY_TIMEOUT);
      }
    };

    resetInactivityTimer(userId);

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (shouldInvalidateRestoredSession(userId)) {
          console.log('Auto-logout: tab returned after 6h inactivity');
          forceSignOut();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      activityEvents.forEach(event => document.removeEventListener(event, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, resetInactivityTimer, shouldInvalidateRestoredSession, forceSignOut]);

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        const newUserId = newSession?.user?.id ?? null;

        // Skip redundant token refreshes for same user
        if (event === 'TOKEN_REFRESHED' && newUserId === currentUserIdRef.current) {
          return;
        }

        currentUserIdRef.current = newUserId;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && newSession) {
          // Fresh login — always allow, overwrite activity immediately
          setTimeout(() => {
            setStoredActivity(newSession.user.id);
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (existingSession) {
        const uid = existingSession.user.id;
        // Check inactivity only for restored sessions (not fresh logins)
        if (shouldInvalidateRestoredSession(uid)) {
          console.log('Invalidating restored session due to inactivity on page load');
          clearStoredActivity();
          supabase.auth.signOut();
          setLoading(false);
          return;
        }
      }

      currentUserIdRef.current = existingSession?.user?.id ?? null;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
