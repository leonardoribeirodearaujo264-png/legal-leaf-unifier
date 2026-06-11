import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  conversation_name?: string;
}

export const useMessageNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [popupEnabled, setPopupEnabled] = useState(true);
  const [lastReceivedMessage, setLastReceivedMessage] = useState<NewMessage | null>(null);
  const processedMessages = useRef<Set<string>>(new Set());

  // Stable refs to avoid re-creating the realtime subscription
  const popupEnabledRef = useRef(popupEnabled);
  const locationRef = useRef(location.pathname);
  const navigateRef = useRef(navigate);
  const conversationIdsRef = useRef<string[]>([]);

  useEffect(() => { popupEnabledRef.current = popupEnabled; }, [popupEnabled]);
  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  // Fetch popup preference
  const fetchPopupPreference = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('email_notification_preferences')
      .select('popup_messages_enabled')
      .eq('user_id', user.id)
      .maybeSingle();

    setPopupEnabled((data as any)?.popup_messages_enabled ?? true);
  }, [user]);

  useEffect(() => {
    if (user) fetchPopupPreference();
  }, [user, fetchPopupPreference]);

  // Fetch unread messages count — also updates conversationIdsRef
  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (partError) throw partError;
      if (!participations || participations.length === 0) {
        setUnreadCount(0);
        conversationIdsRef.current = [];
        return;
      }

      // Update the dynamic conversation list
      conversationIdsRef.current = participations.map(p => p.conversation_id);

      let totalUnread = 0;

      for (const participation of participations) {
        const { count, error } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', participation.conversation_id)
          .neq('sender_id', user.id)
          .gt('created_at', participation.last_read_at || '1970-01-01');

        if (!error && count) {
          totalUnread += count;
        }
      }

      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [user]);

  // Get sender name
  const getSenderName = async (senderId: string): Promise<string> => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', senderId)
      .single();
    return data?.full_name || 'Alguém';
  };

  // Service Worker registration ref
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // VAPID public key for push subscription
  const VAPID_PUBLIC_KEY = 'BIjQRFZC_PKAeEbkSCHlfGM8oFUDkOQWPzlMlZmZO35QGe5GM0aV0wUr5YsUMH3wtZep5F4ehwytsn-gKzfAy7s';

  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  };

  // Register Service Worker + request notification permission + subscribe to push
  useEffect(() => {
    if (!user) return;

    // Register SW for background notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-notifications.js')
        .then(async (registration) => {
          swRegistrationRef.current = registration;
          console.log('[MessageNotifications] SW registered');

          // Request permission if needed
          if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
          }

          // Subscribe to push if permission granted
          if ('Notification' in window && Notification.permission === 'granted' && 'PushManager' in window) {
            try {
              const existing = await registration.pushManager.getSubscription();
              let subscription = existing;

              if (!subscription) {
                const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer;
                subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey,
                });
              }

              // Save subscription to backend
              const subJSON = subscription.toJSON();
              const endpoint = subJSON.endpoint!;
              const p256dh = subJSON.keys!.p256dh!;
              const auth = subJSON.keys!.auth!;

              await supabase.from('browser_push_subscriptions').upsert(
                {
                  user_id: user.id,
                  endpoint,
                  p256dh,
                  auth,
                  is_active: true,
                  user_agent: navigator.userAgent,
                },
                { onConflict: 'endpoint' }
              );
              console.log('[MessageNotifications] Push subscription saved');
            } catch (err) {
              console.warn('[MessageNotifications] Push subscription failed:', err);
            }
          }
        })
        .catch((err) => {
          console.warn('[MessageNotifications] SW registration failed:', err);
        });

      // Listen for notification clicks routed via SW postMessage
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.conversationId) {
          navigateRef.current('/mensagens', {
            state: { openConversation: event.data.conversationId },
          });
        }
      });
    }
  }, [user]);

  // Send native browser notification via Service Worker (works even when tab is minimized)
  const sendNativeNotification = useCallback((title: string, body: string, conversationId: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const options = {
      body,
      icon: '/logo-eggnunes.png',
      tag: `msg-${conversationId}`,
      data: { conversationId },
      requireInteraction: false,
    };

    try {
      if (swRegistrationRef.current) {
        // Use SW — works even with minimized/suspended tabs
        swRegistrationRef.current.showNotification(title, options);
      } else {
        // Fallback to direct Notification API
        const notification = new Notification(title, options);
        notification.onclick = () => {
          window.focus();
          navigateRef.current('/mensagens', { state: { openConversation: conversationId } });
          notification.close();
        };
        setTimeout(() => notification.close(), 10000);
      }
    } catch {
      // Silent fallback
    }
  }, []);

  // Dismiss popup
  const dismissPopup = useCallback(() => {
    setLastReceivedMessage(null);
  }, []);

  // Show notification — stable via refs
  const showNotificationRef = useRef<(message: NewMessage) => Promise<void>>();

  showNotificationRef.current = async (message: NewMessage) => {
    const isPageVisible = document.visibilityState === 'visible' && document.hasFocus();
    const isOnMensagens = locationRef.current === '/mensagens';

    // If on mensagens AND page is visible/focused, just update count (user is reading)
    if (isOnMensagens && isPageVisible) {
      fetchUnreadCount();
      return;
    }

    // Request permission if not yet granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const senderName = await getSenderName(message.sender_id);
    const truncatedContent = message.content?.length > 50
      ? message.content.substring(0, 50) + '...'
      : message.content;

    // Send native browser notification
    sendNativeNotification(
      `Nova mensagem de ${senderName}`,
      truncatedContent || 'Enviou um anexo',
      message.conversation_id
    );

    // If popup is enabled, set the message for the popup dialog
    if (popupEnabledRef.current) {
      setLastReceivedMessage(message);
    } else {
      // Fallback: show toast
      toast.custom(
        (t) => (
          <div className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm w-full">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Nova mensagem de {senderName}
                </p>
                <p className="text-sm text-foreground/80 mt-1 line-clamp-2">
                  {truncatedContent}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-xs"
                  onClick={() => {
                    toast.dismiss(t);
                    navigateRef.current('/mensagens', {
                      state: { openConversation: message.conversation_id }
                    });
                  }}
                >
                  Responder
                </Button>
              </div>
              <button
                onClick={() => toast.dismiss(t)}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground"
              >
                <span className="sr-only">Fechar</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ),
        { duration: 8000, position: 'top-right' }
      );
    }

    // Play notification sound
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  };

  // Subscribe to new messages — STABLE, only depends on user
  useEffect(() => {
    if (!user) return;

    fetchUnreadCount();

    const channel = supabase
      .channel('message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as NewMessage;

          // Check against dynamic conversation list
          if (!conversationIdsRef.current.includes(newMessage.conversation_id)) return;
          if (newMessage.sender_id === user.id) return;
          if (processedMessages.current.has(newMessage.id)) return;

          processedMessages.current.add(newMessage.id);

          if (processedMessages.current.size > 100) {
            const arr = Array.from(processedMessages.current);
            processedMessages.current = new Set(arr.slice(-50));
          }

          await showNotificationRef.current?.(newMessage);
          fetchUnreadCount();
        }
      )
      .subscribe((status) => {
        console.log('[MessageNotifications] Channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  // Listen for 'messages-read' events
  useEffect(() => {
    const handler = () => fetchUnreadCount();
    window.addEventListener('messages-read', handler);
    return () => window.removeEventListener('messages-read', handler);
  }, [fetchUnreadCount]);

  // Refresh when navigating to /mensagens
  useEffect(() => {
    if (location.pathname === '/mensagens') {
      fetchUnreadCount();
    }
  }, [location.pathname, fetchUnreadCount]);

  // Subscribe to conversation_participants updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('participants-read-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  // Listen for popup preference changes
  useEffect(() => {
    const handler = () => fetchPopupPreference();
    window.addEventListener('popup-preference-changed', handler);
    return () => window.removeEventListener('popup-preference-changed', handler);
  }, [fetchPopupPreference]);

  // Update document title and favicon with unread count
  useEffect(() => {
    const baseTitle = 'Tribuna IA';
    const faviconPath = '/logo-eggnunes.png?v=2';
    
    if (unreadCount > 0) {
      document.title = `● (${unreadCount}) ${baseTitle}`;
      
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = faviconPath;
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 128, 128);
          const badgeRadius = 36;
          const x = 128 - badgeRadius;
          const y = badgeRadius;
          ctx.beginPath();
          ctx.arc(x, y, badgeRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 42px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const displayCount = unreadCount > 9 ? '9+' : String(unreadCount);
          ctx.fillText(displayCount, x, y + 1);
          const link = document.getElementById('app-favicon') as HTMLLinkElement;
          if (link) {
            link.href = canvas.toDataURL('image/png');
          }
        };
        img.onerror = () => {
          ctx.beginPath();
          ctx.arc(64, 64, 56, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 56px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const displayCount = unreadCount > 9 ? '9+' : String(unreadCount);
          ctx.fillText(displayCount, 64, 64);
          const link = document.getElementById('app-favicon') as HTMLLinkElement;
          if (link) {
            link.href = canvas.toDataURL('image/png');
          }
        };
      }
    } else {
      document.title = baseTitle;
      const link = document.getElementById('app-favicon') as HTMLLinkElement;
      if (link) {
        link.href = faviconPath;
      }
    }
  }, [unreadCount]);

  return {
    unreadCount,
    refetchUnreadCount: fetchUnreadCount,
    popupEnabled,
    lastReceivedMessage,
    dismissPopup,
  };
};
