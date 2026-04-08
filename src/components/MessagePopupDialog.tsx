import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, MessageCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface PopupMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface MessagePopupDialogProps {
  message: PopupMessage | null;
  onDismiss: () => void;
  enabled: boolean;
}

export function MessagePopupDialog({ message, onDismiss, enabled }: MessagePopupDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [senderAvatar, setSenderAvatar] = useState('');
  const [conversationName, setConversationName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, 15000);
  }, [onDismiss]);

  const resetTimer = useCallback(() => {
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    if (!message || !enabled) return;

    const fetchSenderInfo = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', message.sender_id)
        .single();

      setSenderName(profile?.full_name || 'Alguém');
      setSenderAvatar(profile?.avatar_url || '');

      const { data: conv } = await supabase
        .from('conversations')
        .select('name, is_group')
        .eq('id', message.conversation_id)
        .single();

      if (conv?.is_group && conv?.name) {
        setConversationName(conv.name);
      } else {
        setConversationName(profile?.full_name || 'Conversa');
      }
    };

    fetchSenderInfo();
    startTimer();
    setReplyText('');

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, enabled, startTimer]);

  if (!message || !enabled) return null;

  const truncatedContent = message.content
    ? message.content.length > 120
      ? message.content.substring(0, 120) + '...'
      : message.content
    : 'Enviou um anexo';

  const handleSendReply = async () => {
    if (!replyText.trim() || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: message.conversation_id,
        sender_id: user.id,
        content: replyText.trim(),
      });

      if (error) throw error;

      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', message.conversation_id)
        .eq('user_id', user.id);

      window.dispatchEvent(new Event('messages-read'));
      toast.success('Resposta enviada!');
      onDismiss();
    } catch {
      toast.error('Erro ao enviar resposta');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const handleOpenConversation = () => {
    onDismiss();
    navigate('/mensagens', { state: { openConversation: message.conversation_id } });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 80, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 80, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="fixed top-4 right-4 z-[200] w-[380px] max-w-[calc(100vw-2rem)] bg-card border-2 border-primary/30 rounded-xl shadow-2xl overflow-hidden"
        onMouseEnter={resetTimer}
        onClick={resetTimer}
      >
        {/* Colored left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-l-xl" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-primary/10">
          <div className="flex items-center gap-2">
            <div className="relative">
              <MessageCircle className="h-5 w-5 text-primary" />
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-destructive rounded-full animate-pulse" />
            </div>
            <span className="text-sm font-bold text-foreground">Nova mensagem</span>
          </div>
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Sender info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 ring-2 ring-primary/20">
              <AvatarImage src={senderAvatar} />
              <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                {senderName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{senderName}</p>
              <p className="text-xs text-muted-foreground truncate">{conversationName}</p>
            </div>
          </div>

          {/* Message content */}
          <div className="bg-muted/60 rounded-lg p-3 border border-border/50">
            <p className="text-sm text-foreground leading-relaxed">{truncatedContent}</p>
          </div>

          {/* Quick reply */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={resetTimer}
              placeholder="Resposta rápida..."
              className="flex-1 h-9 text-sm"
              disabled={sending}
            />
            <Button
              size="sm"
              onClick={handleSendReply}
              disabled={!replyText.trim() || sending}
              className="h-9 px-3"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Open conversation link */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenConversation}
            className="w-full text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir conversa completa
          </Button>
        </div>

        {/* Auto-dismiss progress bar */}
        <motion.div
          className="h-1 bg-primary/40"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: 15, ease: 'linear' }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
