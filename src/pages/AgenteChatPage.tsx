import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { streamAI } from '@/services/aiService';
import {
  extractFromFile,
  buildDocumentContext,
  extractionMethodLabel,
  DOCUMENT_RULE,
  type ExtractionResult,
} from '@/services/universalDocumentService';
import { friendlyAIError } from '@/lib/errors';
import { AI_PROVIDER_MAP } from '@/config/ai';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ArrowLeft, Send, Loader2, User, Plus, Trash2, History, Paperclip, Mic, MicOff, X, FileText, Download, CloudUpload, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import { SaveToTeamsDialog } from '@/components/SaveToTeamsDialog';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  objective: string;
  instructions: string;
  model: string;
  icon_emoji: string;
  knowledge_base?: string | null;
}

interface Attachment {
  /** ID único local para controle de estado */
  id: string;
  name: string;
  type: string;
  base64: string;
  /** Texto extraído pelo universalDocumentService */
  extractedText?: string;
  extractionMethod?: ExtractionResult['method'];
  pages?: number;
  /** true enquanto a extração está em andamento */
  isExtracting?: boolean;
}

// Accepted file types for the file picker
const ACCEPTED_FILE_TYPES = [
  '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.csv', '.xls', '.xlsx',
  '.mp3', '.mp4', '.m4a', '.wav', '.ogg', '.webm',
].join(',');

export default function AgenteChatPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false);
  const [teamsContent, setTeamsContent] = useState({ fileName: '', fileContent: '' });
  const [clientNameDialogOpen, setClientNameDialogOpen] = useState(false);
  const [clientNameInput, setClientNameInput] = useState('');
  const [pendingTeamsContent, setPendingTeamsContent] = useState('');

  useEffect(() => {
    if (agentId) loadAgent();
  }, [agentId]);

  useEffect(() => {
    if (agent && user) loadConversations();
  }, [agent, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const loadAgent = async () => {
    setLoadingAgent(true);
    const { data, error } = await supabase
      .from('intranet_agents')
      .select('*')
      .eq('id', agentId!)
      .single();

    if (error || !data) {
      toast.error('Agente não encontrado');
      navigate('/agentes-ia');
      return;
    }
    setAgent(data);
    setLoadingAgent(false);
  };

  const loadConversations = async () => {
    if (!user || !agentId) return;
    const { data } = await supabase
      .from('intranet_agent_conversations')
      .select('*')
      .eq('agent_id', agentId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setConversations(data || []);
  };

  const loadConversation = async (conversationId: string) => {
    const { data } = await supabase
      .from('intranet_agent_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
      setCurrentConversationId(conversationId);
      setShowHistory(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setShowHistory(false);
    setAttachments([]);
  };

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase
      .from('intranet_agent_conversations')
      .delete()
      .eq('id', conversationId);
    if (!error) {
      if (currentConversationId === conversationId) startNewConversation();
      loadConversations();
    }
  };

  // ── File upload ────────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`Arquivo ${file.name} excede 50MB`);
        continue;
      }

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const attachId = crypto.randomUUID();

      // Adiciona placeholder com indicador de processamento
      setAttachments(prev => [
        ...prev,
        { id: attachId, name: file.name, type: file.type, base64, isExtracting: true },
      ]);

      // Extrai texto em background — não bloqueia a UI
      extractFromFile(file)
        .then((result) => {
          setAttachments(prev =>
            prev.map(a =>
              a.id === attachId
                ? {
                    ...a,
                    isExtracting: false,
                    extractedText: result.text || undefined,
                    extractionMethod: result.method,
                    pages: result.pages,
                  }
                : a
            )
          );
        })
        .catch(() => {
          setAttachments(prev =>
            prev.map(a => (a.id === attachId ? { ...a, isExtracting: false } : a))
          );
        });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    const count = Array.from(files).filter(f => f.size <= 50 * 1024 * 1024).length;
    if (count > 0) toast.info(`${count} arquivo(s) anexado(s) — lendo conteúdo...`);
  };

  const removeAttachment = (attachId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attachId));
  };

  // ── Voice recording via Web Speech API ────────────────────────────────────

  const startRecording = () => {
    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition })
        .SpeechRecognition ??
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast.error('Reconhecimento de voz não suportado. Use Chrome ou Edge.');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;

    let transcript = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' ';
        }
      }
    };

    recognition.onerror = () => {
      toast.error('Erro no reconhecimento de voz');
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (transcript.trim()) {
        setInput(prev => (prev ? prev + ' ' : '') + transcript.trim());
        toast.success('Áudio transcrito com sucesso!');
      }
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    toast.info('Gravando... Clique no microfone para parar.');
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming || !agent || !user) return;

    const currentAttachments = [...attachments];

    // Avisa se algum documento ainda está sendo lido, mas permite enviar
    if (currentAttachments.some(a => a.isExtracting)) {
      toast.warning('Alguns documentos ainda estão sendo lidos. Você pode enviar agora, mas o conteúdo completo pode não estar disponível.');
    }

    // Conteúdo exibido no chat — pergunta do usuário ou descrição dos arquivos
    const displayContent = input.trim() ||
      (currentAttachments.length > 0
        ? `[Arquivo(s) enviado(s): ${currentAttachments.map(a => a.name).join(', ')}]`
        : '');

    // Conteúdo enviado à IA — inclui contexto completo dos documentos
    const docContext = buildDocumentContext(
      currentAttachments
        .filter(a => a.extractedText)
        .map(a => ({
          text: a.extractedText!,
          method: a.extractionMethod ?? 'text',
          fileName: a.name,
          fileType: a.type,
          charCount: a.extractedText!.length,
          pages: a.pages,
        }))
    );

    let contentForAI = displayContent;
    if (docContext) {
      contentForAI += `\n\nDOCUMENTOS DA CONVERSA:\n\n${docContext}`;
    }

    // Arquivos sem texto extraído — apenas cita os nomes
    const unreadFiles = currentAttachments.filter(a => !a.extractedText);
    if (unreadFiles.length > 0) {
      contentForAI += `\n\n[Arquivos sem extração de texto: ${unreadFiles.map(a => a.name).join(', ')}]`;
    }

    const userMessage: Message = { role: 'user', content: displayContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setAttachments([]);
    setIsStreaming(true);

    try {
      let convId = currentConversationId;
      if (!convId) {
        const { data: conv, error } = await supabase
          .from('intranet_agent_conversations')
          .insert({ agent_id: agent.id, user_id: user.id, title: input.trim().slice(0, 100) })
          .select()
          .single();
        if (error) throw error;
        convId = conv.id;
        setCurrentConversationId(convId);
      }

      // Salva no banco somente a pergunta limpa (sem o texto dos docs)
      await supabase.from('intranet_agent_messages').insert({
        conversation_id: convId,
        role: 'user',
        content: displayContent,
      });

      // Base de conhecimento fixada no agente
      const knowledgePart = agent.knowledge_base
        ? `\n\nBASE DE CONHECIMENTO DO AGENTE:\n${agent.knowledge_base.slice(0, 20000)}`
        : '';

      const systemPrompt =
        `Você é ${agent.name}. ${agent.objective}\n\nInstruções:\n${agent.instructions}\n\n` +
        DOCUMENT_RULE +
        knowledgePart;

      const messagesWithSystem = [
        { role: 'user', content: systemPrompt },
        { role: 'assistant', content: 'Entendido. Estou pronto para ajudar.' },
        // histórico sem o último (que será inserido com o contexto dos docs)
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: contentForAI },
      ];

      let assistantContent = '';
      const agentModelId = agent.model && AI_PROVIDER_MAP[agent.model] ? agent.model : 'gemini-flash';

      await streamAI(messagesWithSystem, agentModelId, (chunk) => {
        assistantContent += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
          }
          return [...prev, { role: 'assistant', content: assistantContent }];
        });
      });

      if (assistantContent) {
        await supabase.from('intranet_agent_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: assistantContent,
        });
      }

      loadConversations();
    } catch (e) {
      console.error('Stream error:', e);
      toast.error(friendlyAIError(e));
    }

    setIsStreaming(false);
  }, [input, isStreaming, agent, user, messages, currentConversationId, attachments]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Export helpers ─────────────────────────────────────────────────────────

  const downloadAsPDF = (content: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    const lines = doc.splitTextToSize(content, maxWidth);
    let y = margin;
    const lineHeight = 7;

    for (const line of lines) {
      if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }

    doc.save(`${agent?.name || 'resposta'}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF baixado!');
  };

  const downloadAsDOCX = async (content: string) => {
    try {
      const lines = content.split('\n');
      const htmlParts: string[] = [];

      for (const line of lines) {
        if (line.startsWith('### '))      htmlParts.push(`<h3>${line.slice(4)}</h3>`);
        else if (line.startsWith('## ')) htmlParts.push(`<h2>${line.slice(3)}</h2>`);
        else if (line.startsWith('# '))  htmlParts.push(`<h1>${line.slice(2)}</h1>`);
        else if (line.startsWith('- ') || line.startsWith('* ')) htmlParts.push(`<li>${line.slice(2)}</li>`);
        else if (line.trim() === '')     htmlParts.push('<br/>');
        else htmlParts.push(`<p>${line}</p>`);
      }

      const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body style="font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.5;">${htmlParts.join('\n')}</body></html>`;
      const blob = new Blob([html], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${agent?.name || 'resposta'}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('DOCX baixado!');
    } catch {
      toast.error('Erro ao gerar DOCX');
    }
  };

  const downloadAsTXT = (content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent?.name || 'resposta'}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('TXT baixado!');
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copiado!');
  };

  const handleSaveToTeams = (content: string) => {
    setPendingTeamsContent(content);
    setClientNameInput('');
    setClientNameDialogOpen(true);
  };

  const confirmSaveToTeams = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const lines = doc.splitTextToSize(pendingTeamsContent, pageWidth - margin * 2);
    let y = margin;
    for (const line of lines) {
      if (y + 7 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 7;
    }
    setTeamsContent({
      fileName: `${agent?.name || 'resposta'}_${new Date().toISOString().slice(0, 10)}.pdf`,
      fileContent: doc.output('datauristring').split(',')[1],
    });
    setClientNameDialogOpen(false);
    setTeamsDialogOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadingAgent) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!agent) return null;

  return (
    <Layout>
      <div className="flex flex-col" style={{ height: 'calc(100vh - 10rem)', maxHeight: 'calc(100vh - 10rem)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agentes-ia')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-2xl">{agent.icon_emoji}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">{agent.name}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowHistory(!showHistory)}>
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={startNewConversation}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Conversa</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden mt-3 gap-4">
          {/* History sidebar */}
          {showHistory && (
            <div className="w-72 border rounded-lg p-3 overflow-y-auto flex-shrink-0">
              <h3 className="font-semibold text-sm mb-3">Conversas Anteriores</h3>
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
              ) : (
                <div className="space-y-1">
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm hover:bg-muted ${currentConversationId === conv.id ? 'bg-muted' : ''}`}
                    >
                      <span className="truncate flex-1">{conv.title}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={(e) => deleteConversation(conv.id, e)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            <ScrollArea ref={scrollRef} className="flex-1 pr-4 min-h-0">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center text-center pt-10 pb-6">
                  <span className="text-5xl mb-3">{agent.icon_emoji}</span>
                  <h2 className="text-xl font-semibold mb-2">Olá! Eu sou {agent.name}</h2>
                  <p className="text-muted-foreground max-w-lg text-sm">{agent.objective}</p>
                  <p className="text-sm text-muted-foreground mt-3">Envie uma mensagem ou anexe um arquivo para começar.</p>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                          {agent.icon_emoji}
                        </div>
                      )}
                      <div className="max-w-[80%]">
                        <Card className={`p-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </Card>
                        {msg.role === 'assistant' && !isStreaming && (
                          <div className="flex items-center gap-1 mt-1.5 ml-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => downloadAsPDF(msg.content)}>
                              <Download className="h-3 w-3" /> PDF
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => downloadAsDOCX(msg.content)}>
                              <FileText className="h-3 w-3" /> DOCX
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => downloadAsTXT(msg.content)}>
                              <FileText className="h-3 w-3" /> TXT
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(msg.content)}>
                              <Copy className="h-3 w-3" /> Copiar
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => handleSaveToTeams(msg.content)}>
                              <CloudUpload className="h-3 w-3" /> Teams
                            </Button>
                          </div>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                        {agent.icon_emoji}
                      </div>
                      <Card className="p-3 bg-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input area */}
            <div className="border-t pt-3 mt-2 pb-4 flex-shrink-0">
              {/* Attachments preview */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[120px]">{att.name}</span>
                      {att.isExtracting && (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                      )}
                      {!att.isExtracting && att.extractedText && (
                        <span className="text-emerald-500 text-[10px]">
                          ✓ {extractionMethodLabel(att.extractionMethod ?? 'text')}
                          {att.pages ? ` · ${att.pages}p` : ''}
                        </span>
                      )}
                      {!att.isExtracting && !att.extractedText && (
                        <span className="text-yellow-500 text-[10px]">sem texto</span>
                      )}
                      <button onClick={() => removeAttachment(att.id)} className="text-muted-foreground hover:text-foreground ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center gap-2 mb-2 text-sm text-red-500 animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  Gravando... clique no microfone para parar
                </div>
              )}

              <div className="flex gap-2 items-end">
                {/* File input — accepts all common document and media types */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileSelect}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-shrink-0 h-10 w-10"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                  title="Anexar documento (PDF, DOCX, TXT, imagens, áudio...)"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  variant={isRecording ? 'destructive' : 'outline'}
                  size="icon"
                  className="flex-shrink-0 h-10 w-10"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isStreaming}
                  title={isRecording ? 'Parar gravação' : 'Transcrever áudio (Chrome/Edge)'}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Envie uma mensagem para ${agent.name}...`}
                  rows={2}
                  className="resize-none min-h-[44px]"
                  disabled={isStreaming}
                />
                <Button
                  onClick={sendMessage}
                  disabled={(input.trim() === '' && attachments.length === 0) || isStreaming}
                  className="flex-shrink-0 h-10 w-10"
                  size="icon"
                >
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 ml-1">
                Modelo: {agent.model || 'gemini-flash'} • Enter para enviar, Shift+Enter para nova linha
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Client name dialog */}
      <Dialog open={clientNameDialogOpen} onOpenChange={setClientNameDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Salvar no Teams</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe o nome do cliente para salvar na pasta correta no Teams.</p>
            <Input
              placeholder="Nome do cliente (opcional)"
              value={clientNameInput}
              onChange={(e) => setClientNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmSaveToTeams()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientNameDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmSaveToTeams}>
              <CloudUpload className="h-4 w-4 mr-2" /> Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveToTeamsDialog
        open={teamsDialogOpen}
        onOpenChange={setTeamsDialogOpen}
        fileName={teamsContent.fileName}
        fileContent={teamsContent.fileContent}
        clientName={clientNameInput || undefined}
        onSuccess={() => toast.success('Documento salvo no Teams!')}
      />
    </Layout>
  );
}
