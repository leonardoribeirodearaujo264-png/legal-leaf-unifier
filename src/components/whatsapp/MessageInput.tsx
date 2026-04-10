import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Mic, MicOff, Clock, X, Check, Image, FileText, StickyNote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

interface Template {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
}

interface MessageInputProps {
  onSendMessage: (type: 'text' | 'audio' | 'image' | 'document', content: string, mediaUrl?: string, filename?: string) => Promise<any>;
  conversationPhone: string;
  onToggleComment?: () => void;
}

export function MessageInput({ onSendMessage, conversationPhone, onToggleComment }: MessageInputProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('shortcut');
      if (data) setTemplates(data as Template[]);
    };
    fetchTemplates();
  }, []);

  // Handle slash commands
  const handleTextChange = (value: string) => {
    setText(value);
    if (value.startsWith('/') || value.includes('\n/')) {
      const lines = value.split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine.startsWith('/')) {
        setTemplateFilter(lastLine.substring(1));
        setShowTemplates(true);
        return;
      }
    }
    setShowTemplates(false);
  };

  const handleSelectTemplate = (template: Template) => {
    const lines = text.split('\n');
    lines[lines.length - 1] = template.content;
    setText(lines.join('\n'));
    setShowTemplates(false);
    textareaRef.current?.focus();
  };

  const filteredTemplates = templates.filter(t =>
    t.shortcut.toLowerCase().includes(templateFilter.toLowerCase()) ||
    t.title.toLowerCase().includes(templateFilter.toLowerCase())
  );

  // Send text message
  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage('text', text.trim());
      setText('');
    } catch (err) {
      toast({ title: 'Erro ao enviar', description: 'Tente novamente.', variant: 'destructive' });
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showTemplates && filteredTemplates.length > 0) {
        handleSelectTemplate(filteredTemplates[0]);
      } else {
        handleSend();
      }
    }
    if (e.key === 'Escape') {
      setShowTemplates(false);
    }
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      toast({ title: 'Erro', description: 'Não foi possível acessar o microfone.', variant: 'destructive' });
    }
  };

  const stopRecording = (send: boolean) => {
    if (!mediaRecorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    mediaRecorderRef.current.onstop = async () => {
      const stream = mediaRecorderRef.current?.stream;
      stream?.getTracks().forEach(track => track.stop());

      if (send && audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
        const filename = `audio-${Date.now()}.ogg`;
        const file = new File([audioBlob], filename, { type: 'audio/ogg' });

        // Upload to storage
        const path = `whatsapp-audio/${filename}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(path, file);

        if (uploadError) {
          toast({ title: 'Erro ao enviar áudio', description: uploadError.message, variant: 'destructive' });
          return;
        }

        const { data: { publicUrl } } = supabase.storage.from('task-attachments').getPublicUrl(path);
        
        try {
          await onSendMessage('audio', '', publicUrl);
        } catch (err) {
          toast({ title: 'Erro ao enviar áudio', variant: 'destructive' });
        }
      }

      setIsRecording(false);
      setRecordingTime(0);
    };

    mediaRecorderRef.current.stop();
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // File upload
  const handleFileUpload = async (file: File, type: 'image' | 'document') => {
    const path = `whatsapp-${type}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('task-attachments')
      .upload(path, file);

    if (uploadError) {
      toast({ title: 'Erro ao enviar arquivo', description: uploadError.message, variant: 'destructive' });
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('task-attachments').getPublicUrl(path);

    try {
      if (type === 'image') {
        await onSendMessage('image', text.trim(), publicUrl);
      } else {
        await onSendMessage('document', file.name, publicUrl, file.name);
      }
      setText('');
    } catch (err) {
      toast({ title: 'Erro ao enviar', variant: 'destructive' });
    }
  };

  // Schedule message
  const handleSchedule = async () => {
    if (!scheduleDate || !text.trim() || !user) return;

    const [hours, minutes] = scheduleTime.split(':');
    const scheduledAt = new Date(scheduleDate);
    scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const { error } = await supabase.from('whatsapp_scheduled_messages').insert({
      phone: conversationPhone,
      message_type: 'text',
      content: text.trim(),
      scheduled_at: scheduledAt.toISOString(),
      created_by: user.id,
    });

    if (error) {
      toast({ title: 'Erro ao agendar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Mensagem agendada com sucesso!' });
      setText('');
      setScheduleOpen(false);
      setScheduleDate(undefined);
    }
  };

  if (isRecording) {
    return (
      <div className="px-4 py-3 border-t bg-card flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => stopRecording(false)} className="text-destructive">
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-foreground">{formatRecordingTime(recordingTime)}</span>
          <span className="text-xs text-muted-foreground">Gravando...</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => stopRecording(true)} className="text-green-600">
          <Check className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t bg-card relative">
      {/* Templates popup */}
      {showTemplates && filteredTemplates.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
          {filteredTemplates.map(t => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t)}
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-primary">/{t.shortcut}</span>
                <span className="text-sm text-foreground">{t.title}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{t.content}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attachment menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <Paperclip className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => imageInputRef.current?.click()} className="gap-2 cursor-pointer">
              <Image className="h-4 w-4" /> Imagem
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4" /> Documento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file, 'image');
            e.target.value = '';
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file, 'document');
            e.target.value = '';
          }}
        />

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          placeholder='Digite uma mensagem... (Use "/" para templates)'
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.startsWith('image/')) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) {
                  handleFileUpload(file, 'image');
                }
                return;
              }
            }
          }}
          className="min-h-[40px] max-h-32 resize-none text-sm"
          rows={1}
        />

        {/* Comment toggle button */}
        {onToggleComment && (
          <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={onToggleComment} title="Comentário interno">
            <StickyNote className="h-5 w-5" />
          </Button>
        )}

        {/* Schedule button */}
        <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setScheduleOpen(true)} title="Agendar mensagem">
          <Clock className="h-5 w-5" />
        </Button>

        {/* Audio / Send button */}
        {text.trim() ? (
          <Button size="icon" className="flex-shrink-0 bg-green-600 hover:bg-green-700" onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={startRecording}>
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Schedule Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Mensagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Texto da mensagem"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Calendar
                mode="single"
                selected={scheduleDate}
                onSelect={setScheduleDate}
                locale={ptBR}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            <Button onClick={handleSchedule} className="w-full" disabled={!scheduleDate || !text.trim()}>
              Agendar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
