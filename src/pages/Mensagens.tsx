import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useMessaging, Conversation, Message } from '@/hooks/useMessaging';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  MessageSquare,
  Send,
  Plus,
  Users,
  User,
  Search,
  ArrowLeft,
  Loader2,
  Mic,
  MicOff,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Check,
  Reply,
  Sparkles,
  Eye,
  Volume2,
  Paperclip,
  FileText,
  Download,
  BookmarkPlus,
  BookMarked,
  File,
  Image as ImageIcon,
  Settings,
  UserPlus,
  UserMinus,
  Star
} from 'lucide-react';
import { format, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
}

interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface AttachedFile {
  file: File;
  preview?: string;
}

const Mensagens = () => {
  const { user } = useAuth();
  const location = useLocation();
  const {
    conversations,
    loading,
    activeConversation,
    setActiveConversation,
    messages,
    loadingMessages,
    sendMessage,
    createConversation,
    deleteConversation,
    editMessage,
    deleteMessage,
    addParticipants,
    removeParticipant,
    fetchConversations
  } = useMessaging();

  // Handle opening conversation from notification
  useEffect(() => {
    const state = location.state as { openConversation?: string } | null;
    if (state?.openConversation && conversations.length > 0) {
      const conv = conversations.find(c => c.id === state.openConversation);
      if (conv) {
        setActiveConversation(conv);
        setShowMobileChat(true);
        // Clear the state to prevent reopening on refresh
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, conversations, setActiveConversation]);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [isSocio, setIsSocio] = useState(false);
  const [isAdminOrSocio, setIsAdminOrSocio] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [isRecordingForAI, setIsRecordingForAI] = useState(false);
  const [recordingTimeAI, setRecordingTimeAI] = useState(0);
  
  // Document attachments
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Templates
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [editTemplateTitle, setEditTemplateTitle] = useState('');
  const [editTemplateContent, setEditTemplateContent] = useState('');
  
  // Group management
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [groupAvailableUsers, setGroupAvailableUsers] = useState<UserProfile[]>([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [loadingGroupUsers, setLoadingGroupUsers] = useState(false);

  // Favorites
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavorites, setShowFavorites] = useState(false);

  // In-conversation search
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);

  // Unread filter
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const aiAudioChunksRef = useRef<Blob[]>([]);
  const aiRecordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if user is socio or admin
  useEffect(() => {
    const checkSocioAndAdmin = async () => {
      if (!user) return;
      const { data: profileData } = await supabase
        .from('profiles')
        .select('position, email')
        .eq('id', user.id)
        .single();
      
      const socio = profileData?.position === 'socio' || profileData?.email === 'rafael@eggnunes.com.br';
      setIsSocio(socio);

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdminOrSocio(socio || !!roleData);
    };
    checkSocioAndAdmin();
  }, [user]);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setTemplates(data);
    };
    loadTemplates();
  }, [user]);

  // Load favorites for active conversation
  useEffect(() => {
    const loadFavorites = async () => {
      if (!user || !activeConversation) return;
      const { data } = await supabase
        .from('message_favorites')
        .select('message_id')
        .eq('user_id', user.id);
      
      if (data) {
        setFavorites(new Set(data.map(f => f.message_id)));
      }
    };
    loadFavorites();
  }, [user, activeConversation]);

  const toggleFavorite = async (messageId: string) => {
    if (!user) return;
    const isFav = favorites.has(messageId);
    
    if (isFav) {
      const { error } = await supabase
        .from('message_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('message_id', messageId);
      if (!error) {
        setFavorites(prev => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    } else {
      const { error } = await supabase
        .from('message_favorites')
        .insert({ user_id: user.id, message_id: messageId });
      if (!error) {
        setFavorites(prev => new Set(prev).add(messageId));
      }
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, position')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .eq('is_suspended', false)
        .neq('id', user?.id || '');

      setAvailableUsers(data || []);
    };

    if (showNewConversation) {
      fetchUsers();
    }
  }, [showNewConversation, user]);

  // Reset scroll tracking when switching conversations
  useEffect(() => {
    prevMessageCountRef.current = 0;
  }, [activeConversation?.id]);

  // Auto-scroll to bottom: after loading finishes or new messages arrive
  useEffect(() => {
    // Don't scroll while still loading
    if (loadingMessages) return;
    if (messages.length === 0) {
      prevMessageCountRef.current = 0;
      return;
    }

    const scrollToBottom = () => {
      const viewport = messagesScrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const isInitialLoad = prevMessageCountRef.current === 0;
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: isInitialLoad ? 'instant' : 'smooth',
        });
      }
      prevMessageCountRef.current = messages.length;
    };

    // Use double rAF to ensure DOM has rendered the messages
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });
  }, [messages, loadingMessages]);

  // File handling functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: AttachedFile[] = files.map(file => {
      const attachment: AttachedFile = { file };
      if (file.type.startsWith('image/')) {
        attachment.preview = URL.createObjectURL(file);
      }
      return attachment;
    });
    setAttachedFiles(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const getContentType = (file: File): string => {
    if (file.type && file.type !== 'application/octet-stream') return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      txt: 'text/plain',
      csv: 'text/csv',
    };
    return mimeMap[ext || ''] || 'application/octet-stream';
  };

  const sanitizeFileName = (name: string): string => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_');
  };

  const uploadFile = async (file: File, retryCount = 0): Promise<string | null> => {
    try {
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`Arquivo "${file.name}" excede o limite de 50MB.`);
        return null;
      }

      const sanitizedName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}_${sanitizedName}`;
      const filePath = `${user?.id}/${fileName}`;
      const contentType = getContentType(file);

      console.log(`Uploading "${file.name}" as "${filePath}" (type: ${contentType}, size: ${file.size})`);

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file, {
          contentType,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error(`Upload error for "${file.name}":`, uploadError.message);
        throw uploadError;
      }

      console.log(`Upload successful for "${file.name}", generating signed URL...`);

      // Generate signed URL (valid for 1 year)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(filePath, 31536000);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error(`Signed URL error for "${file.name}":`, signedUrlError?.message);
        // Fallback: try public URL even though bucket is private
        const { data: publicData } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(filePath);
        
        if (publicData?.publicUrl) {
          console.log(`Using fallback public URL for "${file.name}"`);
          return publicData.publicUrl;
        }
        throw signedUrlError || new Error('Falha ao gerar link do arquivo');
      }

      console.log(`Signed URL generated for "${file.name}"`);
      return signedUrlData.signedUrl;
    } catch (error: any) {
      console.error(`Error uploading file "${file.name}":`, error?.message || error);
      if (retryCount < 1) {
        console.log(`Retrying upload for "${file.name}" (attempt ${retryCount + 2})...`);
        await new Promise(r => setTimeout(r, 1000));
        return uploadFile(file, retryCount + 1);
      }
      toast.error(`Falha ao enviar "${file.name}": ${error?.message || 'Erro desconhecido'}`);
      return null;
    }
  };

  // Template functions
  const saveTemplate = async () => {
    if (!templateTitle.trim() || !newMessage.trim() || !user) return;
    
    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        user_id: user.id,
        title: templateTitle,
        content: newMessage
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao salvar template');
      return;
    }

    if (data) {
      setTemplates(prev => [data, ...prev]);
      toast.success('Template salvo!');
      setShowSaveTemplate(false);
      setTemplateTitle('');
    }
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir template');
      return;
    }

    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Template excluído');
  };

  const useTemplate = (content: string) => {
    setNewMessage(content);
    setShowTemplates(false);
  };

  const startEditTemplate = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setEditTemplateTitle(template.title);
    setEditTemplateContent(template.content);
  };

  const saveEditTemplate = async () => {
    if (!editingTemplate || !editTemplateTitle.trim() || !editTemplateContent.trim()) return;
    
    const { error } = await supabase
      .from('message_templates')
      .update({
        title: editTemplateTitle,
        content: editTemplateContent
      })
      .eq('id', editingTemplate.id);

    if (error) {
      toast.error('Erro ao atualizar template');
      return;
    }

    setTemplates(prev => prev.map(t => 
      t.id === editingTemplate.id 
        ? { ...t, title: editTemplateTitle, content: editTemplateContent }
        : t
    ));
    toast.success('Template atualizado!');
    setEditingTemplate(null);
    setEditTemplateTitle('');
    setEditTemplateContent('');
  };

  const cancelEditTemplate = () => {
    setEditingTemplate(null);
    setEditTemplateTitle('');
    setEditTemplateContent('');
  };

  const handleSend = async () => {
    if (!activeConversation || sending) return;
    if (!newMessage.trim() && attachedFiles.length === 0) return;

    setSending(true);
    let hasUploadFailures = false;
    try {
      let messageContent = newMessage.trim();

      // Upload attached files
      if (attachedFiles.length > 0) {
        toast.info(`Enviando ${attachedFiles.length} arquivo(s)...`);
        const fileUrls: string[] = [];
        const failedFiles: string[] = [];
        const successIndexes: number[] = [];
        
        for (let i = 0; i < attachedFiles.length; i++) {
          const attachment = attachedFiles[i];
          const url = await uploadFile(attachment.file);
          if (url) {
            const isImage = attachment.file.type.startsWith('image/');
            fileUrls.push(`${isImage ? '🖼️' : '📎'} ${attachment.file.name}: ${url}`);
            successIndexes.push(i);
          } else {
            failedFiles.push(attachment.file.name);
          }
        }

        if (fileUrls.length > 0) {
          messageContent = messageContent 
            ? `${messageContent}\n\n${fileUrls.join('\n')}`
            : fileUrls.join('\n');
        }

        // If all uploads failed and no text, don't send and keep files
        if (fileUrls.length === 0 && !messageContent) {
          toast.error(`Nenhum arquivo foi enviado. Verifique os erros acima e tente novamente.`);
          hasUploadFailures = true;
          return;
        }

        if (failedFiles.length > 0) {
          hasUploadFailures = true;
          // Keep only failed files in the attachment area
          setAttachedFiles(prev => prev.filter((_, i) => !successIndexes.includes(i)));
          if (fileUrls.length > 0) {
            toast.warning(`${failedFiles.length} arquivo(s) não enviado(s): ${failedFiles.join(', ')}. Eles permanecem anexados para reenvio.`);
          }
        }
      }

      if (messageContent) {
        await sendMessage(activeConversation.id, messageContent, replyingTo?.id);
      }
      
      setNewMessage('');
      setReplyingTo(null);
      if (!hasUploadFailures) {
        setAttachedFiles([]);
      }
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) return;

    setCreatingConversation(true);
    try {
      const isGroup = selectedUsers.length > 1;
      const conv = await createConversation(
        selectedUsers,
        isGroup ? groupName : undefined,
        isGroup
      );

      if (conv) {
        setActiveConversation(conv);
        setShowMobileChat(true);
      }

      setShowNewConversation(false);
      setSelectedUsers([]);
      setGroupName('');
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!deleteConversationId) return;
    await deleteConversation(deleteConversationId);
    setDeleteConversationId(null);
  };

  const canEditMessage = (msg: Message) => {
    // Admins e sócios podem editar qualquer mensagem a qualquer momento
    if (isAdminOrSocio) return true;
    // Autor pode editar dentro de 6 horas
    if (msg.sender_id !== user?.id) return false;
    const minutesSinceSent = differenceInMinutes(new Date(), new Date(msg.created_at));
    return minutesSinceSent <= 360;
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return;
    
    const success = await editMessage(editingMessageId, editingContent);
    if (success) {
      setEditingMessageId(null);
      setEditingContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use a supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          toast.error('Nenhum áudio foi gravado');
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await sendAudioMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording with timeslice to collect data periodically
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Request final data before stopping
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.requestData();
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Clear audio chunks FIRST to prevent onstop from processing them
      audioChunksRef.current = [];
      
      // Remove the onstop handler to prevent it from being called
      mediaRecorderRef.current.onstop = null;
      
      // Stop the MediaRecorder if it's recording
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop all audio tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      setIsRecording(false);
      setRecordingTime(0);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      toast.info('Gravação cancelada');
    }
  };

  const sendAudioMessage = async (audioBlob: Blob) => {
    if (!activeConversation) return;

    // Validate audio blob has actual content
    if (!audioBlob || audioBlob.size < 1000) {
      console.error('Audio blob is empty or too small:', audioBlob?.size);
      toast.error('Áudio não foi gravado corretamente. Tente novamente.');
      return;
    }

    console.log('Sending audio blob:', { size: audioBlob.size, type: audioBlob.type });

    try {
      setSending(true);
      
      // Upload audio to storage with proper content type
      const extension = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `audio_${Date.now()}.${extension}`;
      const filePath = `${user?.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, audioBlob, {
          contentType: audioBlob.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Use signed URL for private bucket (valid for 1 year)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(filePath, 31536000);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw signedUrlError || new Error('Failed to create signed URL');
      }

      // Send message with audio link
      await sendMessage(activeConversation.id, `🎤 Mensagem de voz: ${signedUrlData.signedUrl}`);
      toast.success('Áudio enviado');
    } catch (error) {
      console.error('Error sending audio:', error);
      toast.error('Erro ao enviar áudio');
    } finally {
      setSending(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // AI Message Generation Functions
  const generateMessageWithAI = async (prompt: string) => {
    if (!prompt.trim()) return;

    setGeneratingAI(true);
    try {
      const context = messages.slice(-5).map(m => 
        `${m.sender?.full_name || 'Usuário'}: ${m.content}`
      ).join('\n');

      const { data, error } = await supabase.functions.invoke('generate-chat-message', {
        body: { prompt, context }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGeneratedMessage(data.message || '');
    } catch (error) {
      console.error('Error generating AI message:', error);
      toast.error('Erro ao gerar mensagem com IA');
    } finally {
      setGeneratingAI(false);
    }
  };

  const startRecordingForAI = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use a supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      aiMediaRecorderRef.current = mediaRecorder;
      aiAudioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          aiAudioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (aiAudioChunksRef.current.length === 0) {
          toast.error('Nenhum áudio foi gravado');
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        const audioBlob = new Blob(aiAudioChunksRef.current, { type: mimeType });
        await transcribeAndGenerate(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      // Start with timeslice to collect data periodically
      mediaRecorder.start(100);
      setIsRecordingForAI(true);
      setRecordingTimeAI(0);
      
      aiRecordingIntervalRef.current = setInterval(() => {
        setRecordingTimeAI(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecordingForAI = () => {
    if (aiMediaRecorderRef.current && isRecordingForAI) {
      // Request final data before stopping
      if (aiMediaRecorderRef.current.state === 'recording') {
        aiMediaRecorderRef.current.requestData();
      }
      aiMediaRecorderRef.current.stop();
      setIsRecordingForAI(false);
      if (aiRecordingIntervalRef.current) {
        clearInterval(aiRecordingIntervalRef.current);
      }
    }
  };

  const cancelRecordingForAI = () => {
    if (aiMediaRecorderRef.current && isRecordingForAI) {
      // Clear audio chunks FIRST to prevent onstop from processing them
      aiAudioChunksRef.current = [];
      
      // Remove the onstop handler to prevent it from being called
      aiMediaRecorderRef.current.onstop = null;
      
      // Stop the MediaRecorder if it's recording
      if (aiMediaRecorderRef.current.state === 'recording') {
        aiMediaRecorderRef.current.stop();
      }
      
      // Stop all audio tracks
      aiMediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      setIsRecordingForAI(false);
      setRecordingTimeAI(0);
      
      if (aiRecordingIntervalRef.current) {
        clearInterval(aiRecordingIntervalRef.current);
        aiRecordingIntervalRef.current = null;
      }
      
      toast.info('Gravação cancelada');
    }
  };

  const transcribeAndGenerate = async (audioBlob: Blob) => {
    setGeneratingAI(true);
    try {
      // Convert audio to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      // Transcribe audio
      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });

      if (transcriptError) throw transcriptError;
      if (transcriptData?.error) throw new Error(transcriptData.error);

      const transcribedText = transcriptData.text || '';
      setAiPrompt(transcribedText);

      // Generate message based on transcription
      await generateMessageWithAI(transcribedText);
    } catch (error) {
      console.error('Error transcribing and generating:', error);
      toast.error('Erro ao processar áudio');
    } finally {
      setGeneratingAI(false);
    }
  };

  const useGeneratedMessage = () => {
    setNewMessage(generatedMessage);
    setShowAIGenerator(false);
    setAiPrompt('');
    setGeneratedMessage('');
  };

  const resetAIGenerator = () => {
    setShowAIGenerator(false);
    setAiPrompt('');
    setGeneratedMessage('');
    setIsRecordingForAI(false);
    if (aiRecordingIntervalRef.current) {
      clearInterval(aiRecordingIntervalRef.current);
    }
  };

  // Helper function to render message content with audio player and file support
  const renderMessageContent = (content: string, isMe: boolean) => {
    const elements: JSX.Element[] = [];
    const lines = content.split('\n');
    let textLines: string[] = [];

    const flushTextLines = () => {
      if (textLines.length > 0) {
        elements.push(
          <p key={`text-${elements.length}`} className="text-sm whitespace-pre-wrap break-words">
            {textLines.join('\n')}
          </p>
        );
        textLines = [];
      }
    };

    for (const line of lines) {
      // Check for voice message
      const audioMatch = line.match(/🎤\s*Mensagem de voz:\s*(https:\/\/[^\s]+)/i);
      if (audioMatch) {
        flushTextLines();
        const audioUrl = audioMatch[1];
        const audioId = `audio-${elements.length}`;
        elements.push(
          <div key={audioId} className="flex flex-col gap-2 my-2 min-w-[320px] max-w-[400px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className={cn("h-4 w-4 flex-shrink-0", isMe ? "text-primary-foreground" : "text-muted-foreground")} />
                <span className="text-xs opacity-70">Mensagem de voz</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 1.5, 2].map(speed => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => {
                      const audio = document.getElementById(audioId + '-player') as HTMLAudioElement;
                      if (audio) audio.playbackRate = speed;
                    }}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                      isMe 
                        ? "hover:bg-primary-foreground/20 text-primary-foreground/80" 
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
            <audio
              id={audioId + '-player'}
              controls
              preload="auto"
              crossOrigin="anonymous"
              className="w-full h-10"
              style={{ filter: isMe ? 'invert(1) brightness(2)' : 'none' }}
              onError={(e) => {
                console.error('Audio playback error:', e);
                const audio = e.currentTarget;
                fetch(audioUrl)
                  .then(res => res.blob())
                  .then(blob => {
                    audio.src = URL.createObjectURL(blob);
                  })
                  .catch(err => console.error('Fallback audio fetch failed:', err));
              }}
            >
              <source src={audioUrl} type="audio/webm" />
              <source src={audioUrl} type="audio/mp4" />
              <source src={audioUrl} type="audio/mpeg" />
              Seu navegador não suporta o elemento de áudio.
            </audio>
          </div>
        );
        continue;
      }

      // Check for image attachment
      const imageMatch = line.match(/🖼️\s*([^:]+):\s*(https:\/\/[^\s]+)/);
      if (imageMatch) {
        flushTextLines();
        const fileName = imageMatch[1];
        const fileUrl = imageMatch[2];
        elements.push(
          <div key={`img-${elements.length}`} className="my-2">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
              <img 
                src={fileUrl} 
                alt={fileName} 
                className="max-w-[250px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
              />
            </a>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs opacity-70 truncate max-w-[200px]">{fileName}</span>
              <a 
                href={fileUrl} 
                download={fileName}
                className={cn(
                  "text-xs underline hover:no-underline",
                  isMe ? "text-primary-foreground/80" : "text-primary"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-3 w-3 inline" />
              </a>
            </div>
          </div>
        );
        continue;
      }

      // Check for document attachment
      const docMatch = line.match(/📎\s*([^:]+):\s*(https:\/\/[^\s]+)/);
      if (docMatch) {
        flushTextLines();
        const fileName = docMatch[1];
        const fileUrl = docMatch[2];
        elements.push(
          <div 
            key={`doc-${elements.length}`} 
            className={cn(
              "flex items-center gap-2 my-2 p-2 rounded-lg",
              isMe ? "bg-primary-foreground/10" : "bg-background/50"
            )}
          >
            <FileText className={cn("h-8 w-8 flex-shrink-0", isMe ? "text-primary-foreground" : "text-primary")} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <a 
                href={fileUrl} 
                download={fileName}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-xs underline hover:no-underline flex items-center gap-1",
                  isMe ? "text-primary-foreground/80" : "text-primary"
                )}
              >
                <Download className="h-3 w-3" />
                Baixar
              </a>
            </div>
          </div>
        );
        continue;
      }

      // Regular text line
      textLines.push(line);
    }

    flushTextLines();

    return <div className="space-y-1">{elements}</div>;
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.is_group && conv.name) return conv.name;

    const otherParticipant = conv.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.full_name || 'Conversa';
  };

  const getConversationAvatar = (conv: Conversation) => {
    if (conv.is_group) return null;
    const otherParticipant = conv.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.avatar_url;
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Ontem';
    return format(date, 'dd/MM', { locale: ptBR });
  };

  // Check if message was read by other participants
  const isMessageRead = (msg: Message) => {
    if (!activeConversation?.participants) return false;
    
    // Get other participants (not the sender)
    const otherParticipants = activeConversation.participants.filter(
      p => p.user_id !== msg.sender_id
    );
    
    // Check if at least one other participant has read the message
    return otherParticipants.some(p => {
      if (!p.last_read_at) return false;
      return new Date(p.last_read_at) >= new Date(msg.created_at);
    });
  };

  // Group management functions
  const openGroupManagement = async () => {
    if (!activeConversation?.is_group) return;
    setShowGroupManagement(true);
    setGroupSearchTerm('');
    setSelectedNewMembers([]);
    setLoadingGroupUsers(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, position')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .eq('is_suspended', false)
        .neq('id', user?.id || '');
      setGroupAvailableUsers(data || []);
    } catch {
      setGroupAvailableUsers([]);
    } finally {
      setLoadingGroupUsers(false);
    }
  };

  const handleAddGroupMembers = async () => {
    if (!activeConversation || selectedNewMembers.length === 0) return;
    await addParticipants(activeConversation.id, selectedNewMembers);
    setSelectedNewMembers([]);
    setShowGroupManagement(false);
    // Refresh to get updated participants
    await fetchConversations();
  };

  const handleRemoveGroupMember = async (userId: string) => {
    if (!activeConversation) return;
    await removeParticipant(activeConversation.id, userId);
    setShowGroupManagement(false);
    await fetchConversations();
  };

  const currentParticipantIds = activeConversation?.participants?.map(p => p.user_id) || [];
  const filteredGroupUsers = groupAvailableUsers
    .filter(u => !currentParticipantIds.includes(u.id))
    .filter(u => u.full_name.toLowerCase().includes(groupSearchTerm.toLowerCase()));

  const filteredUsers = availableUsers.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredConversations = conversations.filter(conv => {
    const name = getConversationName(conv);
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (showUnreadOnly && (!conv.unread_count || conv.unread_count === 0)) return false;
    return true;
  });

  // Filter messages by favorites and search
  const filteredMessages = messages.filter(msg => {
    if (showFavorites && !favorites.has(msg.id)) return false;
    if (messageSearchTerm && !msg.content.toLowerCase().includes(messageSearchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <Layout>
      <div className="-m-4 md:-m-6 lg:-m-8 flex flex-col h-[calc(100dvh-3.5rem)] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-6 md:pt-6 lg:px-8 lg:pt-8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Mensagens</h1>
          </div>

          <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conversa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Conversa</DialogTitle>
                <DialogDescription>
                  Selecione os participantes para iniciar uma conversa
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pessoas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {selectedUsers.length > 1 && (
                  <div>
                    <Label>Nome do Grupo</Label>
                    <Input
                      placeholder="Ex: Equipe Jurídica"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </div>
                )}

                <ScrollArea className="h-60">
                  <div className="space-y-2">
                    {filteredUsers.map(u => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => {
                          setSelectedUsers(prev =>
                            prev.includes(u.id)
                              ? prev.filter(id => id !== u.id)
                              : [...prev, u.id]
                          );
                        }}
                      >
                        <Checkbox checked={selectedUsers.includes(u.id)} />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatar_url || ''} />
                          <AvatarFallback>{u.full_name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">{u.position}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Button
                  className="w-full"
                  onClick={handleCreateConversation}
                  disabled={selectedUsers.length === 0 || creatingConversation}
                >
                  {creatingConversation ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : selectedUsers.length > 1 ? (
                    <Users className="h-4 w-4 mr-2" />
                  ) : (
                    <User className="h-4 w-4 mr-2" />
                  )}
                  {selectedUsers.length > 1 ? 'Criar Grupo' : 'Iniciar Conversa'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 flex rounded-lg border overflow-hidden bg-card mx-4 mb-4 md:mx-6 md:mb-6 lg:mx-8 lg:mb-8 min-h-0">
          {/* Conversations List */}
          <div className={cn(
            "w-full md:w-[360px] border-r flex flex-col min-w-0 md:min-w-[360px] md:max-w-[360px]",
            showMobileChat && "hidden md:flex"
          )}>
            <div className="p-3 border-b space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar conversas..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                variant={showUnreadOnly ? "default" : "outline"}
                size="sm"
                className="w-full text-xs h-7"
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              >
                {showUnreadOnly ? "Mostrando não lidas" : "Filtrar não lidas"}
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-3 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma conversa</p>
                  <p className="text-xs">Comece uma nova conversa!</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredConversations.map(conv => (
                    <div key={conv.id} className="relative group">
                      <button
                        onClick={async () => {
                          setActiveConversation(conv);
                          setShowMobileChat(true);
                          setShowFavorites(false);
                          setShowMessageSearch(false);
                          setMessageSearchTerm('');
                          // After messages load and are marked read, refresh list
                          setTimeout(() => fetchConversations(), 1500);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                          activeConversation?.id === conv.id
                            ? "bg-primary/10"
                            : conv.unread_count && conv.unread_count > 0
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-muted"
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            {conv.is_group ? (
                              <AvatarFallback className="bg-primary/20">
                                <Users className="h-5 w-5" />
                              </AvatarFallback>
                            ) : (
                              <>
                                <AvatarImage src={getConversationAvatar(conv) || ''} />
                                <AvatarFallback>
                                  {getConversationName(conv)[0]}
                                </AvatarFallback>
                              </>
                            )}
                          </Avatar>
                          {conv.unread_count && conv.unread_count > 0 && (
                            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "leading-tight break-words",
                              conv.unread_count && conv.unread_count > 0 ? "font-bold" : "font-medium"
                            )} style={{ wordBreak: 'break-word' }}>
                              {getConversationName(conv)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm text-muted-foreground truncate flex-1">
                              {conv.last_message?.content || 'Nenhuma mensagem'}
                            </p>
                            {conv.last_message && (
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {formatMessageDate(conv.last_message.created_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      
                      {/* Delete button for sócios */}
                      {isSocio && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConversationId(conv.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className={cn(
            "flex-1 flex flex-col min-w-0",
            !showMobileChat && "hidden md:flex"
          )}>
            {activeConversation ? (
              <>
                {/* Header */}
                <div className="h-14 border-b flex items-center justify-between px-4">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setShowMobileChat(false)}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-8 w-8">
                      {activeConversation.is_group ? (
                        <AvatarFallback className="bg-primary/20">
                          <Users className="h-4 w-4" />
                        </AvatarFallback>
                      ) : (
                        <>
                          <AvatarImage src={getConversationAvatar(activeConversation) || ''} />
                          <AvatarFallback>
                            {getConversationName(activeConversation)[0]}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {getConversationName(activeConversation)}
                      </p>
                      {activeConversation.is_group && (
                        <p className="text-xs text-muted-foreground">
                          {activeConversation.participants?.length} participantes
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowMessageSearch(!showMessageSearch);
                        if (showMessageSearch) setMessageSearchTerm('');
                      }}
                      title="Buscar na conversa"
                      className={cn(showMessageSearch && "bg-primary/10")}
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowFavorites(!showFavorites)}
                      title={showFavorites ? "Mostrar todas" : "Mostrar favoritas"}
                      className={cn(showFavorites && "bg-primary/10")}
                    >
                      <Star className={cn("h-5 w-5", showFavorites && "fill-yellow-400 text-yellow-400")} />
                    </Button>
                    {activeConversation.is_group && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={openGroupManagement}
                        title="Gerenciar grupo"
                      >
                        <Settings className="h-5 w-5" />
                      </Button>
                    )}
                    {isSocio && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConversationId(activeConversation.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Conversa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Search bar */}
                {showMessageSearch && (
                  <div className="px-4 py-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar nas mensagens..."
                        className="pl-9 pr-8"
                        value={messageSearchTerm}
                        onChange={(e) => setMessageSearchTerm(e.target.value)}
                        autoFocus
                      />
                      {messageSearchTerm && (
                        <button
                          onClick={() => setMessageSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <ScrollArea ref={messagesScrollAreaRef} className="flex-1 p-4 min-h-0">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>{showFavorites ? 'Nenhuma mensagem favorita' : messageSearchTerm ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem ainda. Diga olá!'}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredMessages.map((msg, i) => {
                        const isMe = msg.sender_id === user?.id;
                        const showAvatar = i === 0 || messages[i - 1].sender_id !== msg.sender_id;
                        const isEditing = editingMessageId === msg.id;

                        // Date separator logic
                        const msgDate = new Date(msg.created_at);
                        const prevDate = i > 0 ? new Date(filteredMessages[i - 1].created_at) : null;
                        const showDateSeparator = !prevDate || 
                          msgDate.toDateString() !== prevDate.toDateString();

                        const getDateLabel = (date: Date) => {
                          if (isToday(date)) return 'Hoje';
                          if (isYesterday(date)) return 'Ontem';
                          return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                        };

                        return (
                          <div key={msg.id}>
                            {showDateSeparator && (
                              <div className="flex items-center justify-center my-4">
                                <div className="bg-muted/80 text-muted-foreground text-xs font-medium px-3 py-1 rounded-full shadow-sm">
                                  {getDateLabel(msgDate)}
                                </div>
                              </div>
                            )}
                          <div
                            className={cn(
                              "flex gap-2 group",
                              isMe ? "flex-row-reverse" : "flex-row"
                            )}
                          >
                            {!isMe && showAvatar && (
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarImage src={msg.sender?.avatar_url || ''} />
                                <AvatarFallback>
                                  {msg.sender?.full_name?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            {!isMe && !showAvatar && <div className="w-8 flex-shrink-0" />}
                            
                            <div className={cn(
                              "flex items-start gap-1",
                              isMe ? "flex-row-reverse" : "flex-row"
                            )}>
                              {/* Action buttons */}
                              <div className={cn(
                                "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                                isMe ? "flex-row-reverse" : "flex-row"
                              )}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleFavorite(msg.id)}
                                  title={favorites.has(msg.id) ? "Remover favorito" : "Favoritar"}
                                >
                                  <Star className={cn("h-3 w-3", favorites.has(msg.id) && "fill-yellow-400 text-yellow-400")} />
                                </Button>
                                {canEditMessage(msg) && !isEditing && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleStartEdit(msg)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                {isSocio && !isEditing && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteMessageId(msg.id)}
                                    title="Excluir mensagem"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setReplyingTo(msg)}
                                >
                                  <Reply className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              <div
                                className={cn(
                                  "min-w-[100px] rounded-2xl px-4 py-2",
                                  isEditing ? "max-w-[95%]" : "max-w-[90%]",
                                  isMe
                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                    : "bg-muted rounded-tl-sm"
                                )}
                              >
                                {/* Reply reference */}
                                {msg.reply_to && (
                                  <div className={cn(
                                    "text-xs mb-2 pb-2 border-b",
                                    isMe ? "border-primary-foreground/20" : "border-border"
                                  )}>
                                    <p className="font-medium opacity-70">
                                      {msg.reply_to.sender?.full_name || 'Usuário'}
                                    </p>
                                    <p className="opacity-60 truncate max-w-[200px]">
                                      {msg.reply_to.content}
                                    </p>
                                  </div>
                                )}

                                {!isMe && showAvatar && activeConversation.is_group && (
                                  <p className="text-xs font-medium mb-1 opacity-70">
                                    {msg.sender?.full_name}
                                  </p>
                                )}
                                
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={editingContent}
                                      onChange={(e) => setEditingContent(e.target.value)}
                                      className="min-h-[120px] max-h-[300px] text-sm bg-background text-foreground resize-y overflow-auto"
                                      autoFocus
                                    />
                                    <div className="flex gap-1 justify-end">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={handleCancelEdit}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={handleSaveEdit}
                                      >
                                        <Check className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {renderMessageContent(msg.content, isMe)}
                                    <div className={cn(
                                      "flex items-center gap-1 mt-1",
                                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                                    )}>
                                      <span className="text-[10px]">
                                        {format(new Date(msg.created_at), 'HH:mm')}
                                      </span>
                                      {msg.is_edited && (
                                        <span className="text-[10px]">(editado)</span>
                                      )}
                                      {isMe && (
                                        isMessageRead(msg) ? (
                                          <span className="ml-1 inline-flex items-center">
                                            <Check className="h-3 w-3 text-blue-500" />
                                            <Check className="h-3 w-3 -ml-1.5 text-blue-500" />
                                          </span>
                                        ) : (
                                          <span className="ml-1 inline-flex items-center">
                                            <Check className="h-3 w-3 text-muted-foreground" />
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t">
                  {/* AI Generator */}
                  {showAIGenerator && (
                    <div className="mb-3 p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Gerar mensagem com IA</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={resetAIGenerator}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      {isRecordingForAI ? (
                        <div className="flex items-center gap-3 bg-destructive/10 rounded-lg p-3 mb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="h-3 w-3 bg-destructive rounded-full animate-pulse" />
                            <span className="text-sm font-medium">
                              Gravando... {formatRecordingTime(recordingTimeAI)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={cancelRecordingForAI}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="icon"
                            onClick={stopRecordingForAI}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : !generatedMessage ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Descreva o que você quer dizer... Ex: 'agradecer pela ajuda de ontem'"
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              className="min-h-[60px] text-sm"
                              disabled={generatingAI}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={startRecordingForAI}
                              disabled={generatingAI}
                              className="flex-1"
                            >
                              <Mic className="h-4 w-4 mr-2" />
                              Falar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => generateMessageWithAI(aiPrompt)}
                              disabled={!aiPrompt.trim() || generatingAI}
                              className="flex-1"
                            >
                              {generatingAI ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4 mr-2" />
                              )}
                              Gerar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Pré-visualização</span>
                          </div>
                          <Textarea
                            value={generatedMessage}
                            onChange={(e) => setGeneratedMessage(e.target.value)}
                            className="min-h-[80px] text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setGeneratedMessage('');
                                setAiPrompt('');
                              }}
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Refazer
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={useGeneratedMessage}
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Usar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reply indicator */}
                  {replyingTo && (
                    <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg">
                      <Reply className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          Respondendo a {replyingTo.sender?.full_name || 'Usuário'}
                        </p>
                        <p className="text-sm truncate">{replyingTo.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setReplyingTo(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* Attached files preview */}
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {attachedFiles.map((attachment, index) => (
                        <div key={index} className="relative group">
                          {attachment.preview ? (
                            <img 
                              src={attachment.preview} 
                              alt={attachment.file.name}
                              className="h-16 w-16 object-cover rounded-lg border"
                            />
                          ) : (
                            <div className="h-16 w-16 flex flex-col items-center justify-center bg-muted rounded-lg border">
                              <File className="h-6 w-6 text-muted-foreground" />
                              <span className="text-[8px] text-muted-foreground truncate max-w-[60px] px-1">
                                {attachment.file.name}
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Templates panel */}
                  {showTemplates && (
                    <div className="mb-2 p-2 bg-muted/50 rounded-lg border max-h-48 overflow-y-auto">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Seus templates</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowTemplates(false)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      {templates.length > 0 ? (
                        <div className="space-y-1">
                          {templates.map(template => (
                            <div key={template.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer group">
                              <button
                                type="button"
                                onClick={() => useTemplate(template.content)}
                                className="flex-1 text-left"
                              >
                                <p className="text-sm font-medium">{template.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{template.content}</p>
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditTemplate(template);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTemplate(template.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Nenhum template salvo. Digite uma mensagem e clique no botão de salvar template.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Edit template dialog */}
                  {editingTemplate && (
                    <div className="mb-2 p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Editar template</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={cancelEditTemplate}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Nome do template..."
                        value={editTemplateTitle}
                        onChange={(e) => setEditTemplateTitle(e.target.value)}
                        className="mb-2"
                      />
                      <Textarea
                        placeholder="Conteúdo do template..."
                        value={editTemplateContent}
                        onChange={(e) => setEditTemplateContent(e.target.value)}
                        className="mb-2 min-h-[80px]"
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1"
                          onClick={cancelEditTemplate}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={saveEditTemplate}
                          disabled={!editTemplateTitle.trim() || !editTemplateContent.trim()}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Save template dialog */}
                  {showSaveTemplate && (
                    <div className="mb-2 p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Salvar como template</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowSaveTemplate(false)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Nome do template..."
                        value={templateTitle}
                        onChange={(e) => setTemplateTitle(e.target.value)}
                        className="mb-2"
                      />
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={saveTemplate}
                        disabled={!templateTitle.trim() || !newMessage.trim()}
                      >
                        <BookmarkPlus className="h-4 w-4 mr-2" />
                        Salvar
                      </Button>
                    </div>
                  )}

                  {isRecording ? (
                    <div className="flex items-center gap-3 bg-destructive/10 rounded-lg p-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="h-3 w-3 bg-destructive rounded-full animate-pulse" />
                        <span className="text-sm font-medium">
                          Gravando... {formatRecordingTime(recordingTime)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={cancelRecording}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        size="icon"
                        onClick={stopRecording}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                      }}
                      className="space-y-2"
                    >
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Digite sua mensagem..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                          onPaste={(e) => {
                            const items = e.clipboardData?.items;
                            if (!items) return;
                            for (let i = 0; i < items.length; i++) {
                              if (items[i].type.startsWith('image/')) {
                                e.preventDefault();
                                const file = items[i].getAsFile();
                                if (file) {
                                  const attachment: AttachedFile = {
                                    file,
                                    preview: URL.createObjectURL(file),
                                  };
                                  setAttachedFiles(prev => [...prev, attachment]);
                                }
                                return;
                              }
                            }
                          }}
                          onFocus={() => {
                            if (templates.length > 0 && !newMessage.trim()) {
                              setShowTemplates(true);
                            }
                          }}
                          disabled={sending}
                          className="flex-1 min-h-[44px] max-h-[200px] resize-none"
                          rows={1}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={sending}
                          title="Anexar arquivo"
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowTemplates(!showTemplates)}
                          disabled={sending}
                          className={cn(showTemplates && "bg-primary/10 border-primary")}
                          title="Templates salvos"
                        >
                          <BookMarked className="h-4 w-4" />
                        </Button>
                        {newMessage.trim() && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                            disabled={sending}
                            className={cn(showSaveTemplate && "bg-primary/10 border-primary")}
                            title="Salvar como template"
                          >
                            <BookmarkPlus className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowAIGenerator(!showAIGenerator)}
                          disabled={sending}
                          className={cn(showAIGenerator && "bg-primary/10 border-primary")}
                          title="Gerar mensagem com IA"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={startRecording}
                          disabled={sending}
                          title="Gravar áudio"
                        >
                          <Mic className="h-4 w-4" />
                        </Button>
                        <Button 
                          type="submit" 
                          size="icon" 
                          disabled={(!newMessage.trim() && attachedFiles.length === 0) || sending}
                        >
                          {sending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Selecione uma conversa</p>
                  <p className="text-sm">ou inicie uma nova</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Conversation Dialog */}
      <AlertDialog open={!!deleteConversationId} onOpenChange={() => setDeleteConversationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita e todas as mensagens serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteConversation}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Message Dialog */}
      <AlertDialog open={!!deleteMessageId} onOpenChange={() => setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                if (deleteMessageId) {
                  await deleteMessage(deleteMessageId);
                  setDeleteMessageId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group Management Dialog */}
      <Dialog open={showGroupManagement} onOpenChange={setShowGroupManagement}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciar Grupo
            </DialogTitle>
            <DialogDescription>
              Adicione ou remova membros do grupo "{activeConversation?.name}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current participants */}
            <div>
              <Label className="text-sm font-medium">Membros atuais ({activeConversation?.participants?.length})</Label>
              <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                {activeConversation?.participants?.map(p => (
                  <div key={p.user_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={p.profile?.avatar_url || ''} />
                        <AvatarFallback className="text-xs">
                          {p.profile?.full_name?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {p.profile?.full_name || 'Usuário'}
                          {p.user_id === user?.id && <span className="text-xs text-muted-foreground ml-1">(você)</span>}
                        </p>
                        {p.profile?.position && (
                          <p className="text-xs text-muted-foreground">{p.profile.position}</p>
                        )}
                      </div>
                    </div>
                    {p.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveGroupMember(p.user_id)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add new members */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Adicionar membros
              </Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar colaboradores..."
                  className="pl-9"
                  value={groupSearchTerm}
                  onChange={(e) => setGroupSearchTerm(e.target.value)}
                />
              </div>
              <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
                {loadingGroupUsers ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredGroupUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {groupSearchTerm ? 'Nenhum colaborador encontrado' : 'Todos os colaboradores já fazem parte do grupo'}
                  </p>
                ) : (
                  filteredGroupUsers.map(u => (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedNewMembers.includes(u.id)}
                        onCheckedChange={(checked) => {
                          setSelectedNewMembers(prev =>
                            checked
                              ? [...prev, u.id]
                              : prev.filter(id => id !== u.id)
                          );
                        }}
                      />
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={u.avatar_url || ''} />
                        <AvatarFallback className="text-xs">{u.full_name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{u.full_name}</p>
                        {u.position && <p className="text-xs text-muted-foreground">{u.position}</p>}
                      </div>
                    </label>
                  ))
                )}
              </div>
              {selectedNewMembers.length > 0 && (
                <Button
                  className="w-full mt-3"
                  onClick={handleAddGroupMembers}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar {selectedNewMembers.length} membro(s)
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Mensagens;
