import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, X } from 'lucide-react';
import { EmojiPicker } from '@/components/EmojiPicker';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Profile {
  id: string;
  full_name: string;
}

interface InternalCommentInputProps {
  conversationId: string;
  onCommentSent: () => void;
  onCancel: () => void;
}

export function InternalCommentInput({ conversationId, onCommentSent, onCancel }: InternalCommentInputProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionStartIdx, setMentionStartIdx] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true).eq('is_suspended', false).order('full_name');
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, []);

  const handleTextChange = (value: string) => {
    setText(value);

    // Detect @mention
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBefore = value.substring(0, cursorPos);
    const atIdx = textBefore.lastIndexOf('@');

    if (atIdx >= 0 && (atIdx === 0 || textBefore[atIdx - 1] === ' ' || textBefore[atIdx - 1] === '\n')) {
      const query = textBefore.substring(atIdx + 1);
      if (!query.includes(' ') || query.length < 30) {
        setMentionFilter(query.toLowerCase());
        setMentionStartIdx(atIdx);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (profile: Profile) => {
    const before = text.substring(0, mentionStartIdx);
    const cursorPos = textareaRef.current?.selectionStart || text.length;
    const after = text.substring(cursorPos);
    const newText = `${before}@${profile.full_name} ${after}`;
    setText(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredProfiles = profiles.filter(p =>
    p.full_name.toLowerCase().includes(mentionFilter)
  );

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);

    try {
      // Insert comment
      const { data: comment, error: commentError } = await supabase
        .from('whatsapp_internal_comments')
        .insert({
          conversation_id: conversationId,
          author_id: user.id,
          content: text.trim(),
        })
        .select()
        .single();

      if (commentError) throw commentError;

      // Extract mentions and insert
      const mentionRegex = /@([A-Za-zÀ-ÿ]+(?:\s[A-Za-zÀ-ÿ]+)*)/g;
      let match;
      const mentionedIds: string[] = [];

      while ((match = mentionRegex.exec(text)) !== null) {
        const mentionedName = match[1];
        const foundProfile = profiles.find(p => p.full_name.toLowerCase() === mentionedName.toLowerCase());
        if (foundProfile && !mentionedIds.includes(foundProfile.id) && foundProfile.id !== user.id) {
          mentionedIds.push(foundProfile.id);
        }
      }

      if (mentionedIds.length > 0 && comment) {
        await supabase.from('whatsapp_comment_mentions').insert(
          mentionedIds.map(uid => ({ comment_id: comment.id, mentioned_user_id: uid }))
        );
      }

      setText('');
      onCommentSent();
    } catch (err: any) {
      toast({ title: 'Erro ao enviar comentário', description: err.message, variant: 'destructive' });
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showMentions && filteredProfiles.length > 0) {
        insertMention(filteredProfiles[0]);
      } else {
        handleSend();
      }
    }
    if (e.key === 'Escape') {
      if (showMentions) {
        setShowMentions(false);
      } else {
        onCancel();
      }
    }
  };

  return (
    <div className="px-4 py-3 border-t bg-amber-50/50 dark:bg-amber-900/10 relative">
      {/* Mentions popup */}
      {showMentions && filteredProfiles.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto z-50">
          {filteredProfiles.slice(0, 8).map(p => (
            <button
              key={p.id}
              onClick={() => insertMention(p)}
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm border-b last:border-b-0 flex items-center gap-2"
            >
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {p.full_name?.charAt(0) || '?'}
              </div>
              <span>{p.full_name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">
          💬 Comentário Interno
        </span>
        <span className="text-[10px] text-muted-foreground">(não será enviado ao cliente)</span>
      </div>

      <div className="flex items-end gap-2">
        <EmojiPicker
          onEmojiSelect={(emoji) => {
            const ta = textareaRef.current;
            const start = ta?.selectionStart || text.length;
            const end = ta?.selectionEnd || text.length;
            const newText = text.substring(0, start) + emoji + text.substring(end);
            setText(newText);
            setTimeout(() => {
              ta?.focus();
              const pos = start + emoji.length;
              ta?.setSelectionRange(pos, pos);
            }, 0);
          }}
        />

        <Textarea
          ref={textareaRef}
          placeholder='Escrever comentário interno... (use @ para mencionar)'
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[40px] max-h-32 resize-none text-sm border-amber-300 dark:border-amber-700 focus-visible:ring-amber-400"
          rows={1}
          autoFocus
        />

        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          className="flex-shrink-0 bg-amber-600 hover:bg-amber-700"
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
