// Auth provider with auto-logout after 6 hours of inactivity
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const INACTIVITY_TIMEOUT = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
const LAST_ACTIVITY_KEY = 'egg_nunes_last_activity';

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

  const signOut = useCallback(async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await supabase.auth.signOut();
    navigate('/auth');
  }, [navigate]);

  // Check if session should be invalidated due to inactivity
  const checkInactivityOnLoad = useCallback(() => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const lastActivityTime = parseInt(lastActivity, 10);
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTime;
      
      if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
        console.log('Auto-logout: Session expired due to inactivity (more than 6 hours since last activity)');
        return true; // Should sign out
      }
    }
    return false;
  }, []);

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }, []);

  // Reset inactivity timer on user activity
  const resetInactivityTimer = useCallback(() => {
    // Update last activity in localStorage
    updateLastActivity();
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    inactivityTimerRef.current = setTimeout(() => {
      console.log('Auto-logout due to 6 hours of inactivity');
      signOut();
    }, INACTIVITY_TIMEOUT);
  }, [signOut, updateLastActivity]);

  // Setup activity listeners for auto-logout
  useEffect(() => {
    if (!user) return;

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Throttle activity updates to avoid excessive localStorage writes
    let lastUpdate = 0;
    const throttleMs = 60000; // Update localStorage at most once per minute
    
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > throttleMs) {
        lastUpdate = now;
        resetInactivityTimer();
      } else if (inactivityTimerRef.current) {
        // Still reset the timer even if we don't update localStorage
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
          console.log('Auto-logout due to 6 hours of inactivity');
          signOut();
        }, INACTIVITY_TIMEOUT);
      }
    };

    // Start the timer and set initial activity
    resetInactivityTimer();

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Also listen for visibility change to handle when user comes back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only check inactivity - don't trigger any state updates that could cause re-renders
        // This prevents the page from refreshing when switching tabs
        if (checkInactivityOnLoad()) {
          signOut();
        }
        // Note: We intentionally DON'T call resetInactivityTimer() here
        // to avoid triggering re-renders that could cause form data loss
        // The timer will be reset on the next user interaction anyway
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, resetInactivityTimer, checkInactivityOnLoad, signOut]);

  // Stable ref to track current user id without causing re-renders
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Avoid unnecessary re-renders on TOKEN_REFRESHED when user is the same
        if (event === 'TOKEN_REFRESHED' && newSession?.user?.id === currentUserIdRef.current) {
          // Same user, just token renewal — no state update needed
          return;
        }

        currentUserIdRef.current = newSession?.user?.id ?? null;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        
        // Check inactivity on session restore (deferred to avoid deadlock)
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession) {
          setTimeout(() => {
            const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
            if (lastActivity) {
              const lastActivityTime = parseInt(lastActivity, 10);
              const now = Date.now();
              if (now - lastActivityTime > INACTIVITY_TIMEOUT) {
                console.log('Auto-logout: Session expired due to inactivity');
                supabase.auth.signOut();
                return;
              }
            }
            // Update last activity on successful sign in
            localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      // Check if we should invalidate the session due to inactivity
      if (session) {
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (lastActivity) {
          const lastActivityTime = parseInt(lastActivity, 10);
          const now = Date.now();
          if (now - lastActivityTime > INACTIVITY_TIMEOUT) {
            console.log('Invalidating session due to inactivity on page load');
            supabase.auth.signOut();
            return;
          }
        }
      }
      
      setSession(session);
      setUser(session?.user ?? null);
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
