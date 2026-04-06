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

  // Fetch unread messages count
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
        return;
      }

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

  // Get conversation display name
  const getConversationName = async (conversationId: string, senderId: string): Promise<string> => {
    const { data: conv } = await supabase
      .from('conversations')
      .select('name, is_group')
      .eq('id', conversationId)
      .single();

    if (conv?.is_group && conv?.name) {
      return conv.name;
    }

    const senderName = await getSenderName(senderId);
    return senderName;
  };

  // Request native notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Send native browser notification
  const sendNativeNotification = useCallback((title: string, body: string, conversationId: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `msg-${conversationId}`,
        } as NotificationOptions);
        notification.onclick = () => {
          window.focus();
          navigate('/mensagens', { state: { openConversation: conversationId } });
          notification.close();
        };
        setTimeout(() => notification.close(), 10000);
      } catch {
        // Fallback silently
      }
    }
  }, [navigate]);

  // Dismiss popup
  const dismissPopup = useCallback(() => {
    setLastReceivedMessage(null);
  }, []);

  // Show notification pop-up
  const showNotification = useCallback(async (message: NewMessage) => {
    // Don't show notification if already on mensagens page
    if (location.pathname === '/mensagens') {
      fetchUnreadCount();
      return;
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
    if (popupEnabled) {
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
                    navigate('/mensagens', {
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
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
  }, [location.pathname, navigate, fetchUnreadCount, popupEnabled, sendNativeNotification]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user) return;

    fetchUnreadCount();

    const setupSubscription = async () => {
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!participations || participations.length === 0) return;

      const conversationIds = participations.map(p => p.conversation_id);

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

            if (!conversationIds.includes(newMessage.conversation_id)) return;
            if (newMessage.sender_id === user.id) return;
            if (processedMessages.current.has(newMessage.id)) return;

            processedMessages.current.add(newMessage.id);

            if (processedMessages.current.size > 100) {
              const arr = Array.from(processedMessages.current);
              processedMessages.current = new Set(arr.slice(-50));
            }

            await showNotification(newMessage);
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupSubscription();

    return () => {
      cleanup.then(fn => fn?.());
    };
  }, [user, fetchUnreadCount, showNotification]);

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
    const baseTitle = 'Intranet Egg Nunes';
    
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`;
      
      // Generate favicon with red badge
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = '/favicon.ico';
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 32, 32);
          // Red circle
          const badgeSize = 14;
          const x = 32 - badgeSize / 2;
          const y = badgeSize / 2;
          ctx.beginPath();
          ctx.arc(x, y, badgeSize / 2 + 1, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          // White text
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(unreadCount > 99 ? '99+' : String(unreadCount), x, y);
          // Apply
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) {
            link.href = canvas.toDataURL('image/png');
          }
        };
        img.onerror = () => {
          // If no favicon, just draw the badge alone
          ctx.beginPath();
          ctx.arc(16, 16, 14, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(unreadCount > 99 ? '99+' : String(unreadCount), 16, 16);
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) {
            link.href = canvas.toDataURL('image/png');
          }
        };
      }
    } else {
      document.title = baseTitle;
      // Restore original favicon
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = '/favicon.ico';
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
