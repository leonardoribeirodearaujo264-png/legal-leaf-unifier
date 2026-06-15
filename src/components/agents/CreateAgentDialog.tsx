import { useState, useRef, useEffect } from 'react';
import { extractFromFile } from '@/services/universalDocumentService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { generateWithClaude } from '@/services/claudeService';
import { toast } from 'sonner';
import {
  Sparkles, Upload, X, Link2, Loader2, FileText, Globe,
  BookOpen, Bot, Cpu, ChevronRight, Check, User, Target,
  Zap, Brain, Search,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingAgent?: Record<string, unknown> | null;
}

type KnowledgeFile = {
  name: string;
  type: string;
  file?: File;
  url?: string;
  extractedText?: string;
};

// ── Constants ──────────────────────────────────────────────────────────────

const EMOJI_OPTIONS = [
  '🤖', '⚖️', '📝', '📊', '🔍', '💼', '📋', '🏛️',
  '🧠', '💡', '📑', '🎯', '🔬', '📚', '🏆', '✍️',
];

const COLOR_OPTIONS = [
  { value: 'purple', label: 'Roxo',     class: 'bg-purple-500' },
  { value: 'blue',   label: 'Azul',     class: 'bg-blue-500' },
  { value: 'green',  label: 'Verde',    class: 'bg-green-500' },
  { value: 'orange', label: 'Laranja',  class: 'bg-orange-500' },
  { value: 'red',    label: 'Vermelho', class: 'bg-red-500' },
  { value: 'yellow', label: 'Amarelo',  class: 'bg-yellow-500' },
  { value: 'pink',   label: 'Rosa',     class: 'bg-pink-500' },
];

const SPECIALTY_CHIPS = [
  'Previdenciário', 'Trabalhista', 'Família', 'Cível', 'Criminal',
  'Tribunal do Júri', 'Consumidor', 'Bancário', 'Tributário',
  'Imobiliário', 'Empresarial', 'Administrativo', 'Saúde',
  'Direito do Autista', 'Licitações',
];

const MODEL_OPTIONS = [
  {
    value: 'gemini-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'Google',
    icon: '⚡',
    badge: 'Recomendado',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    description: 'Rápido e eficiente para uso geral e análise de documentos',
    bestFor: 'Atendimento geral, análise de processos',
  },
  {
    value: 'claude-sonnet',
    label: 'Claude Sonnet 4',
    provider: 'Anthropic',
    icon: '🟠',
    badge: 'Melhor para peças',
    badgeColor: 'bg-orange-100 text-orange-700',
    description: 'Excelente para redigir peças jurídicas complexas e argumentações',
    bestFor: 'Petições, recursos, contratos, pareceres',
  },
  {
    value: 'gemini-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'Google',
    icon: '🌟',
    badge: 'Contexto longo',
    badgeColor: 'bg-violet-100 text-violet-700',
    description: 'Raciocínio avançado e capacidade para documentos extensos',
    bestFor: 'Análise de processos volumosos, laudos',
  },
  {
    value: 'claude-haiku',
    label: 'Claude Haiku 4',
    provider: 'Anthropic',
    icon: '🟡',
    badge: 'Econômico',
    badgeColor: 'bg-amber-100 text-amber-700',
    description: 'Rápido e de baixo custo, ideal para tarefas simples e frequentes',
    bestFor: 'Triagem, respostas rápidas, FAQ',
  },
  {
    value: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    icon: '🤖',
    badge: '',
    badgeColor: '',
    description: 'Modelo multimodal da OpenAI, ótimo para textos e imagens',
    bestFor: 'Análise geral, revisão, sumarização',
  },
  {
    value: 'perplexity-large',
    label: 'Perplexity Large',
    provider: 'Perplexity',
    icon: '🔎',
    badge: 'Com internet',
    badgeColor: 'bg-blue-100 text-blue-700',
    description: 'Acessa a internet em tempo real — ideal para jurisprudência atualizada',
    bestFor: 'Pesquisa jurídica, jurisprudência recente',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsText(file, 'UTF-8');
  });

function buildClaudePrompt(params: {
  name: string;
  specialty: string;
  objective: string;
  model: string;
  knowledgeSummary: string;
  extraContext: string;
}): string {
  const { name, specialty, objective, model, knowledgeSummary, extraContext } = params;

  return `Você é um especialista em engenharia de prompts jurídicos para sistemas de IA usados por advogados brasileiros.

Crie um System Prompt completo, técnico e profissional para o seguinte agente jurídico:

DADOS DO AGENTE:
- Nome: ${name}
- Especialidade: ${specialty || 'Direito Geral'}
- Objetivo: ${objective}
- Modelo de IA: ${model}
${extraContext ? `- Contexto adicional: ${extraContext}` : ''}
${knowledgeSummary ? `\nBASE DE CONHECIMENTO FORNECIDA:\n${knowledgeSummary}` : ''}

O System Prompt deve conter obrigatoriamente as seguintes seções:

1. IDENTIDADE E PAPEL
   - Quem é o agente, nome, especialidade e papel no escritório
   - Tom profissional e técnico-jurídico

2. CONHECIMENTOS JURÍDICOS OBRIGATÓRIOS
   - Legislação aplicável à área (cite leis, códigos, súmulas relevantes)
   - Jurisprudência dos tribunais superiores (STF, STJ, TST, TRFs)
   - Doutrina relevante para a especialidade

3. ESCOPO DE ATUAÇÃO
   - O que o agente deve e não deve fazer
   - Casos típicos de uso
   - Limites de responsabilidade

4. ESTILO DE ESCRITA E COMUNICAÇÃO
   - Linguagem técnica-jurídica precisa
   - Citações normativas obrigatórias (art., §, inc., alínea)
   - Estrutura das peças (quando aplicável)
   - Tom formal, objetivo e fundamentado

5. ESTRUTURA DAS RESPOSTAS
   - Como organizar cada tipo de resposta
   - Quando usar tópicos vs. parágrafos
   - Quando citar jurisprudência e como formatá-la

6. ESTRATÉGIA JURÍDICA
   - Como analisar problemas jurídicos
   - Hierarquia de argumentos
   - Como identificar pontos fortes e fracos do caso

7. USO DA BASE DE CONHECIMENTO
   - Como aplicar os documentos fornecidos como referência
   - Manter padrão de estrutura e linguagem dos modelos fornecidos

8. CONTROLE DE QUALIDADE
   - Verificações obrigatórias antes de cada resposta
   - Consistência com o ordenamento jurídico brasileiro vigente
   - Citação sempre de fontes e fundamentos

9. CONDUTA QUANDO FALTAM INFORMAÇÕES
   - Quais perguntas fazer para completar o contexto
   - Como sinalizar lacunas ao usuário

10. ORIENTAÇÕES FINAIS
    - O agente deve sempre recomendar a consulta ao advogado responsável para decisões finais
    - Manter confidencialidade das informações do cliente

REGRAS PARA O PROMPT:
- Escreva na segunda pessoa do singular, dirigindo-se diretamente ao agente
- Use linguagem direta e assertiva
- O prompt deve ter no mínimo 600 palavras
- Não coloque avisos excessivos dizendo que "não é advogado"
- O sistema é de uso profissional exclusivo por advogados
- Não gere prompt genérico ou vago
- Inclua exemplos concretos de como responder quando relevante

Retorne APENAS o System Prompt final, sem nenhum título, prefácio ou explicação.`;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CreateAgentDialog({ open, onOpenChange, onSuccess, editingAgent }: CreateAgentDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('identity');

  // Form state
  const [name, setName] = useState('');
  const [functionRole, setFunctionRole] = useState('');
  const [objective, setObjective] = useState('');
  const [instructions, setInstructions] = useState('');
  const [iconEmoji, setIconEmoji] = useState('🤖');
  const [cardColor, setCardColor] = useState('purple');
  const [isActive, setIsActive] = useState(true);
  const [selectedModel, setSelectedModel] = useState('gemini-flash');
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [suggestInput, setSuggestInput] = useState('');

  // UI state
  const [suggestingInstructions, setSuggestingInstructions] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab('identity');
      if (editingAgent) {
        setName(String(editingAgent.name || ''));
        setFunctionRole(String(editingAgent.function_role || ''));
        setObjective(String(editingAgent.objective || ''));
        setInstructions(String(editingAgent.instructions || ''));
        setIconEmoji(String(editingAgent.icon_emoji || '🤖'));
        setCardColor(String(editingAgent.card_color || 'purple'));
        setIsActive(editingAgent.is_active !== false);
        const m = String(editingAgent.model || 'gemini-flash');
        setSelectedModel(MODEL_OPTIONS.find(o => o.value === m) ? m : 'gemini-flash');
      } else {
        resetForm();
      }
    }
  }, [editingAgent, open]);

  const resetForm = () => {
    setName(''); setFunctionRole(''); setObjective(''); setInstructions('');
    setIconEmoji('🤖'); setCardColor('purple'); setIsActive(true);
    setSelectedModel('gemini-flash'); setFiles([]); setLinkUrl(''); setSuggestInput('');
  };

  // ── Claude prompt generator ──────────────────────────────────────────────

  const suggestInstructions = async () => {
    if (!name.trim() && !objective.trim()) {
      toast.error('Preencha o nome e objetivo primeiro (aba Identidade)');
      return;
    }
    setSuggestingInstructions(true);
    try {
      const knowledgeSummary = files
        .filter(f => f.extractedText)
        .map(f => `--- ${f.name} ---\n${f.extractedText!.slice(0, 2000)}`)
        .join('\n\n');

      const modelInfo = MODEL_OPTIONS.find(m => m.value === selectedModel);

      const prompt = buildClaudePrompt({
        name: name.trim() || 'Agente Jurídico',
        specialty: functionRole.trim() || 'Direito Geral',
        objective: objective.trim() || 'Assistir advogados',
        model: modelInfo ? `${modelInfo.label} (${modelInfo.provider})` : selectedModel,
        knowledgeSummary,
        extraContext: suggestInput.trim(),
      });

      toast.info('Gerando prompt completo com Claude…', { duration: 3000 });
      const result = await generateWithClaude(prompt);
      if (result) {
        setInstructions(result);
        toast.success('Prompt profissional gerado com sucesso!');
        setActiveTab('instructions');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar com Claude. Verifique a chave da API.');
    }
    setSuggestingInstructions(false);
  };

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: KnowledgeFile[] = [];
    for (const file of Array.from(selectedFiles)) {
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();

      // Determina o tipo para exibição
      const displayType = file.type.includes('pdf') || ext === 'pdf' ? 'pdf'
        : ['docx', 'doc'].includes(ext) || file.type.includes('word') ? 'docx'
        : ['xlsx', 'xls'].includes(ext) ? 'xlsx'
        : file.type.startsWith('text/') || ['txt', 'md', 'csv'].includes(ext) ? 'txt'
        : 'document';

      // Usa o serviço universal para extrair texto de TODOS os formatos
      let extractedText: string | undefined;
      try {
        toast.info(`Processando ${file.name}…`, { duration: 2000 });
        const result = await extractFromFile(file);
        if (result.text.trim()) extractedText = result.text;
      } catch {
        // ignora — arquivo será salvo sem texto extraído
      }

      newFiles.push({ name: file.name, type: displayType, file, extractedText });
    }

    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';

    const extracted = newFiles.filter(f => f.extractedText).length;
    if (extracted > 0) {
      toast.success(
        `${newFiles.length} arquivo(s) adicionado(s). ${extracted} com texto extraído para o prompt.`
      );
    } else {
      toast.success('Arquivo(s) adicionado(s) à base de conhecimento.');
    }
  };

  const addLink = () => {
    if (!linkUrl.trim()) return;
    setFiles(prev => [...prev, { name: linkUrl, type: 'link', url: linkUrl }]);
    setLinkUrl('');
    toast.success('Link adicionado à base de conhecimento.');
  };

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome do agente é obrigatório'); setActiveTab('identity'); return; }
    if (!objective.trim()) { toast.error('Objetivo é obrigatório'); setActiveTab('identity'); return; }
    if (!instructions.trim()) { toast.error('Instruções são obrigatórias'); setActiveTab('instructions'); return; }

    // Valida sessão ativa direto no servidor (evita dessincronismo do estado React)
    const { data: { user: freshUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !freshUser) {
      toast.error('Usuário não autenticado. Faça login novamente.');
      return;
    }

    // Logs temporários — remover após confirmar funcionamento
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[CreateAgent] User:', freshUser.id);
    console.log('[CreateAgent] Session:', session ? 'ativa' : 'nenhuma');
    console.log('[CreateAgent] Payload created_by:', freshUser.id);

    setSaving(true);
    try {
      const knowledgeBase = files
        .filter(f => f.extractedText)
        .map(f => `=== ${f.name} ===\n${f.extractedText}`)
        .join('\n\n') || null;

      const knowledgeFiles = files.map(f => ({
        name: f.name, type: f.type, url: f.url || null, hasText: !!f.extractedText,
      }));

      // Base payload — always safe (uses existing schema columns only)
      const basePayload = {
        name: name.trim(),
        objective: objective.trim(),
        instructions: instructions.trim(),
        model: selectedModel,
        icon_emoji: iconEmoji,
        function_role: functionRole.trim() || null,
        card_color: cardColor,
        is_active: isActive,
        data_access: [] as string[],
      };

      // Extended payload — includes knowledge columns (requires migration add-agent-knowledge.sql)
      const fullPayload = {
        ...basePayload,
        knowledge_base: knowledgeBase,
        knowledge_files: knowledgeFiles,
      };

      // Helper to resolve which payload to use after a column-not-found error
      const isColumnError = (e: unknown) =>
        typeof e === 'object' && e !== null &&
        ('code' in e) && (e as { code: string }).code === '42703';

      if (editingAgent) {
        let { error } = await supabase
          .from('intranet_agents')
          .update(fullPayload)
          .eq('id', editingAgent.id as string);

        // Retry without knowledge columns if migration hasn't been run
        if (error && isColumnError(error)) {
          const retry = await supabase
            .from('intranet_agents')
            .update(basePayload)
            .eq('id', editingAgent.id as string);
          error = retry.error;
        }
        if (error) throw error;
        toast.success('Agente atualizado com sucesso!');
      } else {
        const insertPayload = { ...fullPayload, created_by: freshUser.id };
        console.log('[CreateAgent] Insert payload:', insertPayload);

        let { data: agentData, error } = await supabase
          .from('intranet_agents')
          .insert(insertPayload)
          .select()
          .single();

        // Retry without knowledge columns if migration hasn't been run
        if (error && isColumnError(error)) {
          const retry = await supabase
            .from('intranet_agents')
            .insert({ ...basePayload, created_by: freshUser.id })
            .select()
            .single();
          error = retry.error;
          agentData = retry.data;
        }
        if (error) throw error;

        for (const f of files) {
          if (f.type === 'link' && f.url) {
            await supabase.from('intranet_agent_files').insert({
              agent_id: agentData.id, file_name: f.name, file_type: 'link', file_url: f.url,
            });
          } else if (f.file) {
            const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `${agentData.id}/${Date.now()}_${safeName}`;
            const { error: upErr } = await supabase.storage.from('agent-files').upload(filePath, f.file);
            if (!upErr) {
              const { data: urlData } = supabase.storage.from('agent-files').getPublicUrl(filePath);
              await supabase.from('intranet_agent_files').insert({
                agent_id: agentData.id, file_name: f.name, file_type: f.type,
                file_url: urlData.publicUrl, file_size: f.file.size,
              });
            }
          }
        }
        toast.success('Agente criado com sucesso!');
      }

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      console.error('Save agent error:', e);
      // PostgrestError from Supabase is not an instanceof Error — extract .message explicitly
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: unknown }).message)
            : JSON.stringify(e);
      toast.error(`Erro ao salvar: ${msg}`);
    }
    setSaving(false);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const selectedModelInfo = MODEL_OPTIONS.find(m => m.value === selectedModel);
  const selectedColor = COLOR_OPTIONS.find(c => c.value === cardColor);

  const isIdentityValid = !!name.trim() && !!objective.trim();
  const isInstructionsValid = !!instructions.trim();
  const canSave = isIdentityValid && isInstructionsValid;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        {/* Fixed Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span>{editingAgent ? 'Editar Agente' : 'Criar Novo Agente'}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="flex w-full rounded-none border-b bg-transparent h-auto px-6 py-0 shrink-0">
            {[
              { value: 'identity',     label: '1. Identidade',     icon: <User className="h-3 w-3" />,       valid: isIdentityValid },
              { value: 'model',        label: '2. Modelo de IA',   icon: <Cpu className="h-3 w-3" />,        valid: !!selectedModel },
              { value: 'instructions', label: '3. Instruções',     icon: <Brain className="h-3 w-3" />,      valid: isInstructionsValid },
              { value: 'knowledge',    label: '4. Conhecimento',   icon: <BookOpen className="h-3 w-3" />,   valid: null },
              { value: 'review',       label: '5. Revisar',        icon: <Check className="h-3 w-3" />,      valid: canSave },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-colors"
              >
                {tab.valid === true && <span className="h-3.5 w-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px]">✓</span>}
                {tab.valid === false && <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 text-muted-foreground/50 flex items-center justify-center">{tab.icon}</span>}
                {tab.valid === null && tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── 1. Identidade ─────────────────────────────────────────── */}
            <TabsContent value="identity" className="p-6 space-y-5 mt-0">
              {/* Appearance row */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ícone</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_OPTIONS.map(emoji => (
                      <button
                        key={emoji} type="button" onClick={() => setIconEmoji(emoji)}
                        className={`text-xl p-2 rounded-lg border-2 transition-all hover:scale-105 ${iconEmoji === emoji ? 'border-primary bg-primary/10 shadow-sm' : 'border-transparent hover:border-muted bg-muted/30'}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <span className={`text-sm font-medium ${isActive ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cor do Card</Label>
                <div className="flex gap-2.5">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color.value} type="button" onClick={() => setCardColor(color.value)}
                      title={color.label}
                      className={`h-8 w-8 rounded-full ${color.class} transition-all hover:scale-110 ${cardColor === color.value ? 'ring-2 ring-offset-2 ring-primary scale-110 shadow-md' : 'opacity-60 hover:opacity-100'}`}
                    />
                  ))}
                </div>
              </div>

              {/* Name + Specialty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-name">
                    Nome do Agente <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="agent-name" value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Gerador de Petições Trabalhistas"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-function">Especialidade / Função</Label>
                  <Input
                    id="agent-function" value={functionRole}
                    onChange={e => setFunctionRole(e.target.value)}
                    placeholder="Ex: Direito Trabalhista"
                  />
                </div>
              </div>

              {/* Quick specialty chips */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Sugestões rápidas de especialidade</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALTY_CHIPS.map(chip => (
                    <button
                      key={chip} type="button"
                      onClick={() => setFunctionRole(chip)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${functionRole === chip ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Objective */}
              <div className="space-y-1.5">
                <Label htmlFor="agent-objective">
                  Objetivo <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="agent-objective" value={objective}
                  onChange={e => setObjective(e.target.value)}
                  placeholder="Descreva de forma clara o que este agente deve fazer. Ex: Gerar petições iniciais trabalhistas com base nos dados do cliente e na jurisprudência do TST."
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setActiveTab('model')}
                  disabled={!isIdentityValid}
                  className="gap-2"
                >
                  Próximo: Modelo de IA <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* ── 2. Modelo de IA ───────────────────────────────────────── */}
            <TabsContent value="model" className="p-6 space-y-4 mt-0">
              <div className="space-y-1">
                <p className="text-sm font-medium">Escolha o modelo mais adequado para este agente</p>
                <p className="text-xs text-muted-foreground">O modelo determina a capacidade e o custo de cada interação.</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {MODEL_OPTIONS.map(m => (
                  <Card
                    key={m.value}
                    className={`cursor-pointer transition-all ${selectedModel === m.value ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/40 hover:bg-muted/30'}`}
                    onClick={() => setSelectedModel(m.value)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl text-xl ${selectedModel === m.value ? 'bg-primary/10' : 'bg-muted/50'}`}>
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{m.label}</span>
                          <span className="text-xs text-muted-foreground">— {m.provider}</span>
                          {m.badge && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${m.badgeColor}`}>
                              {m.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                        <p className="text-xs text-primary/70 mt-0.5">✓ Ideal para: {m.bestFor}</p>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${selectedModel === m.value ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                        {selectedModel === m.value && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setActiveTab('identity')}>Voltar</Button>
                <Button onClick={() => setActiveTab('instructions')} className="gap-2">
                  Próximo: Instruções <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* ── 3. Instruções ─────────────────────────────────────────── */}
            <TabsContent value="instructions" className="p-6 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">System Prompt / Instruções</p>
                  <p className="text-xs text-muted-foreground">Defina o comportamento completo do agente.</p>
                </div>
                <Button
                  variant="outline" size="sm" className="gap-1.5 h-8 shrink-0"
                  onClick={suggestInstructions} disabled={suggestingInstructions}
                >
                  {suggestingInstructions
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando…</>
                    : <><Sparkles className="h-3.5 w-3.5 text-amber-500" /> Gerar com Claude</>
                  }
                </Button>
              </div>

              {/* Context hint for Claude */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Orientação extra para o Claude (opcional)</Label>
                <Input
                  value={suggestInput}
                  onChange={e => setSuggestInput(e.target.value)}
                  placeholder="Ex: Focar em ações previdenciárias do JEF, usar linguagem mais acessível..."
                  className="text-sm"
                />
              </div>

              {/* Instructions status */}
              {!instructions && (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
                  <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Gere um prompt profissional</p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                      Clique em "Gerar com Claude" para criar um System Prompt completo e técnico com base nos dados preenchidos na aba Identidade.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="agent-instructions">
                    Instruções <span className="text-destructive">*</span>
                  </Label>
                  {instructions && (
                    <span className="text-xs text-muted-foreground">{instructions.length} caracteres</span>
                  )}
                </div>
                <Textarea
                  id="agent-instructions" value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Escreva ou gere as instruções do agente aqui..."
                  rows={14}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setActiveTab('model')}>Voltar</Button>
                <Button onClick={() => setActiveTab('knowledge')} disabled={!isInstructionsValid} className="gap-2">
                  Próximo: Conhecimento <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* ── 4. Base de Conhecimento ───────────────────────────────── */}
            <TabsContent value="knowledge" className="p-6 space-y-5 mt-0">
              {/* Explanation */}
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 space-y-1">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Como funciona a base de conhecimento
                </p>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/70">
                  Envie petições, recursos, contratos ou modelos do escritório. O agente aprende sua estrutura, linguagem e padrão de argumentação para gerar peças futuras no mesmo estilo.
                </p>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/70">
                  Arquivos de texto (.txt, .md) têm o conteúdo extraído automaticamente e usado na geração do prompt.
                </p>
              </div>

              {/* Upload actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline" className="gap-1.5 flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> Enviar Arquivo
                  <span className="text-xs text-muted-foreground">(PDF, DOCX, TXT)</span>
                </Button>
                <div className="flex gap-2 flex-1">
                  <Input
                    value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                    placeholder="Cole um link de referência..."
                    className="text-sm"
                    onKeyDown={e => e.key === 'Enter' && addLink()}
                  />
                  <Button variant="outline" size="sm" onClick={addLink} disabled={!linkUrl.trim()}>
                    <Link2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <input
                ref={fileInputRef} type="file" className="hidden" multiple
                accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
              />

              {/* File list */}
              {files.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border/50 p-8 text-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum arquivo adicionado ainda</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">A base de conhecimento é opcional</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {files.length} arquivo{files.length !== 1 ? 's' : ''} adicionado{files.length !== 1 ? 's' : ''}
                  </p>
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
                      <div className="flex-shrink-0">
                        {file.type === 'pdf' && <FileText className="h-5 w-5 text-red-500" />}
                        {file.type === 'link' && <Globe className="h-5 w-5 text-green-500" />}
                        {(file.type === 'txt' || file.type === 'document' || file.type === 'docx') && <FileText className="h-5 w-5 text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.type.toUpperCase()}
                          {file.extractedText && ` · ${file.extractedText.length.toLocaleString()} caracteres extraídos`}
                          {file.file && ` · ${(file.file.size / 1024).toFixed(0)} KB`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {file.extractedText && (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                            ✓ texto extraído
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeFile(i)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setActiveTab('instructions')}>Voltar</Button>
                <Button onClick={() => setActiveTab('review')} className="gap-2">
                  Revisar e Criar <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* ── 5. Revisar ────────────────────────────────────────────── */}
            <TabsContent value="review" className="p-6 space-y-5 mt-0">
              <div className="space-y-1">
                <p className="text-sm font-medium">Revise as configurações do agente antes de criar</p>
                <p className="text-xs text-muted-foreground">Clique em qualquer aba para fazer ajustes.</p>
              </div>

              {/* Preview card */}
              <Card className={`border-t-4 ${selectedColor ? `border-t-${cardColor}-500` : 'border-t-primary'}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none flex-shrink-0">{iconEmoji}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base">{name || 'Nome do agente'}</h3>
                        <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      {functionRole && <p className="text-sm text-muted-foreground italic">{functionRole}</p>}
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{objective || 'Objetivo não definido'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">Modelo de IA</p>
                      <p className="font-medium flex items-center gap-1.5">
                        <span>{selectedModelInfo?.icon}</span>
                        <span>{selectedModelInfo?.label}</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">Conhecimento</p>
                      <p className="font-medium">
                        {files.length > 0 ? `${files.length} arquivo${files.length !== 1 ? 's' : ''}` : 'Nenhum'}
                      </p>
                    </div>
                  </div>

                  {instructions && (
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Instruções</p>
                      <p className="text-xs text-muted-foreground line-clamp-3 font-mono">{instructions.slice(0, 200)}…</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{instructions.length.toLocaleString()} caracteres</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Validation */}
              {!canSave && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-sm font-medium text-destructive">Campos obrigatórios pendentes:</p>
                  {!name.trim() && <p className="text-xs text-destructive/80">• Nome do agente (aba 1)</p>}
                  {!objective.trim() && <p className="text-xs text-destructive/80">• Objetivo (aba 1)</p>}
                  {!instructions.trim() && <p className="text-xs text-destructive/80">• Instruções (aba 3)</p>}
                </div>
              )}

              <div className="flex justify-between pt-2 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !canSave}
                  className="gap-2 min-w-32"
                >
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</>
                    : editingAgent
                      ? <><Check className="h-4 w-4" /> Salvar Alterações</>
                      : <><Zap className="h-4 w-4" /> Criar Agente</>
                  }
                </Button>
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
