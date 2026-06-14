import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, RefreshCw, Bot, FileText, Users,
  List, StickyNote, Hash, Scale, Calendar, AlertTriangle,
  CheckSquare, ChevronRight, Sparkles, Download, Copy, Check,
  TrendingUp, Shield, PhoneCall, FileSignature, BookOpen,
  AlertCircle, Clock, DollarSign, Gavel, Target, Activity,
  User, Building2, MessageSquare, Upload, ExternalLink,
  Folder, Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { refreshProcess } from '@/services/datajudService';
import {
  analyzeCase, generateCaseSummary, generateCaseStrategy,
  generateClientQuestions, assessSuccessProbability, assessProcessRisk,
  generatePetition, generateResource, explainToClient,
} from '@/services/caseAiService';
import type { CaseAiAnalysis, SuccessProbability, ProcessRisk } from '@/services/caseAiService';
import type { DatajudProcess } from '@/services/datajudService';
import ReactMarkdown from 'react-markdown';
import { friendlyAIError } from '@/lib/errors';

// ── Types ──────────────────────────────────────────────────────────────────

interface CaseRow {
  id: string;
  nome: string;
  cliente: string;
  numero_processo: string | null;
  area_juridica: string | null;
  status: string;
  observacoes: string | null;
  court: string | null;
  court_name: string | null;
  case_class: string | null;
  subject: string | null;
  jurisdiction_body: string | null;
  degree: string | null;
  distribution_date: string | null;
  claim_value: number | null;
  current_phase: string | null;
  last_movement: string | null;
  summary: string | null;
  ai_analysis: Record<string, unknown> | null;
  datajud_raw: Record<string, unknown> | null;
  import_source: string | null;
  created_at: string;
}

interface Party { id: string; name: string; type: string | null; document: string | null; }
interface Lawyer { id: string; name: string; oab: string | null; party_name: string | null; }
interface Movement {
  id: string;
  movement_date: string | null;
  title: string;
  description: string | null;
  is_important: boolean;
}
interface AiOutput { id: string; output_type: string; content: string; created_at: string; metadata?: Record<string, unknown>; }
interface CaseDocument { id: string; file_name: string; file_url: string; file_type: string | null; file_size: number | null; created_at: string; }

const STATUS_COLORS: Record<string, string> = {
  ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  aguardando: 'bg-amber-100 text-amber-700 border-amber-200',
  arquivado: 'bg-slate-100 text-slate-600 border-slate-200',
  encerrado: 'bg-red-100 text-red-700 border-red-200',
  imported: 'bg-blue-100 text-blue-700 border-blue-200',
};

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo', aguardando: 'Aguardando', arquivado: 'Arquivado',
  encerrado: 'Encerrado', imported: 'Importado',
};

// ── Risk & Probability helpers ─────────────────────────────────────────────

function RiskBadge({ nivel }: { nivel: 'critico' | 'atencao' | 'favoravel' | string }) {
  if (nivel === 'critico') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">🔴 Crítico</span>;
  if (nivel === 'atencao') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">🟡 Atenção</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">🟢 Favorável</span>;
}

function SuccessBadge({ nivel, percentual }: { nivel: string; percentual: number }) {
  if (nivel === 'alta') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">🟢 Alta ({percentual}%)</span>;
  if (nivel === 'moderada') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">🟡 Moderada ({percentual}%)</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">🔴 Baixa ({percentual}%)</span>;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [caso, setCaso] = useState<CaseRow | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [aiOutputs, setAiOutputs] = useState<AiOutput[]>([]);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [activeAiText, setActiveAiText] = useState('');
  const [activeAiLabel, setActiveAiLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [movementAiId, setMovementAiId] = useState<string | null>(null);
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [partyForm, setPartyForm] = useState({ name: '', document: '', type: '', pole: 'ativo' });
  const [savingParty, setSavingParty] = useState(false);
  const [reprocessingParties, setReprocessingParties] = useState(false);

  // Advanced AI results
  const [successProb, setSuccessProb] = useState<SuccessProbability | null>(null);
  const [processRisk, setProcessRisk] = useState<ProcessRisk | null>(null);

  // Petition / resource type selectors
  const [petitionType, setPetitionType] = useState('contestacao');
  const [resourceType, setResourceType] = useState('apelacao');

  useEffect(() => { if (id) loadAll(); }, [id]);

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: c }, { data: p }, { data: l }, { data: m }, { data: a }, { data: d }] = await Promise.all([
      supabase.from('casos').select('*').eq('id', id).single(),
      supabase.from('case_parties').select('*').eq('case_id', id).order('created_at'),
      supabase.from('case_lawyers').select('*').eq('case_id', id),
      supabase.from('case_movements').select('*').eq('case_id', id).order('movement_date', { ascending: false }),
      supabase.from('case_ai_outputs').select('*').eq('case_id', id).order('created_at', { ascending: false }),
      supabase.from('case_documents').select('*').eq('case_id', id).order('created_at', { ascending: false }),
    ]);

    if (!c) { toast.error('Caso não encontrado'); navigate('/casos'); return; }
    setCaso(c as CaseRow);
    setParties((p || []) as Party[]);
    setLawyers((l || []) as Lawyer[]);
    setMovements((m || []) as Movement[]);
    setAiOutputs((a || []) as AiOutput[]);
    setDocuments((d || []) as CaseDocument[]);
    setNotes((c as CaseRow).observacoes || '');
    setLoading(false);
  };

  // ── DataJud refresh ──────────────────────────────────────────────────────

  const handleRefresh = async () => {
    if (!caso?.numero_processo) { toast.error('Sem número de processo para atualizar'); return; }
    setRefreshing(true);
    const result = await refreshProcess(caso.numero_processo);
    if (!result.found || !result.process) {
      toast.error(result.error || 'Processo não encontrado');
      setRefreshing(false);
      return;
    }
    const p = result.process;
    const existingIds = new Set(movements.map(m => m.movement_date + m.title));
    const newMovements = (p.movimentos || []).filter(m => !existingIds.has((m.dataHora || '') + (m.nome || '')));
    if (newMovements.length > 0 && user) {
      await supabase.from('case_movements').insert(
        newMovements.map(m => ({
          case_id: caso.id, user_id: user.id,
          movement_date: m.dataHora || null,
          title: m.nome || 'Movimentação',
          description: m.complementosTabelados?.[0]?.descricao || null,
          raw_data: m as unknown as Record<string, unknown>,
        }))
      );
      toast.success(`${newMovements.length} nova(s) movimentação(ões) adicionada(s)`);
    } else {
      toast.info('Nenhuma movimentação nova encontrada');
    }
    const lastMov = p.movimentos?.[0];
    await supabase.from('casos').update({
      last_movement: lastMov ? `${lastMov.dataHora ? new Date(lastMov.dataHora).toLocaleDateString('pt-BR') : ''} — ${lastMov.nome || ''}` : null,
      datajud_raw: (p._raw ?? {}) as Record<string, unknown>,
    }).eq('id', caso.id);
    loadAll();
    setRefreshing(false);
  };

  // ── Save notes ────────────────────────────────────────────────────────────

  const saveNotes = async () => {
    if (!caso) return;
    const { error } = await supabase.from('casos').update({ observacoes: notes }).eq('id', caso.id);
    if (error) toast.error('Erro ao salvar'); else toast.success('Anotações salvas');
  };

  // ── Generic AI runner ─────────────────────────────────────────────────────

  const runAi = async (type: string, label: string, fn: () => Promise<string | string[]>) => {
    if (!caso || !user) return;
    setAiLoading(type);
    setActiveAiText('');
    setActiveAiLabel(label);
    try {
      const result = await fn();
      const text = Array.isArray(result) ? result.map((s, i) => `${i + 1}. ${s}`).join('\n') : result;
      setActiveAiText(text);
      await supabase.from('case_ai_outputs').insert({
        case_id: caso.id, user_id: user.id,
        output_type: type, content: text,
        metadata: { generated_at: new Date().toISOString() },
      });
      loadAll();
    } catch (err) {
      toast.error(friendlyAIError(err));
    }
    setAiLoading(null);
  };

  // ── Full analysis ─────────────────────────────────────────────────────────

  const runFullAnalysis = async () => {
    if (!caso?.datajud_raw || !user) { toast.error('Dados do DataJud não disponíveis para análise completa'); return; }
    setAiLoading('full_analysis');
    try {
      const process = caso.datajud_raw as unknown as DatajudProcess;
      const analysis = await analyzeCase(process, 'gemini-flash', caso.cliente);
      await supabase.from('casos').update({
        summary: analysis.resumo_executivo,
        ai_analysis: analysis as unknown as Record<string, unknown>,
        current_phase: analysis.fase_atual,
      }).eq('id', caso.id);
      await supabase.from('case_ai_outputs').insert({
        case_id: caso.id, user_id: user.id,
        output_type: 'full_analysis', content: JSON.stringify(analysis, null, 2),
        metadata: { generated_at: new Date().toISOString() },
      });
      toast.success('Análise completa atualizada');
      loadAll();
    } catch (err) {
      toast.error(friendlyAIError(err));
    }
    setAiLoading(null);
  };

  // ── Success probability ───────────────────────────────────────────────────

  const runSuccessProbability = async () => {
    if (!caso || !user) return;
    setAiLoading('success_probability');
    try {
      const result = await assessSuccessProbability(caseDataForAi, analysis, 'gemini-flash');
      setSuccessProb(result);
      await supabase.from('case_ai_outputs').insert({
        case_id: caso.id, user_id: user.id,
        output_type: 'success_probability', content: JSON.stringify(result, null, 2),
        metadata: { generated_at: new Date().toISOString() },
      });
      toast.success('Probabilidade de êxito calculada');
    } catch (err) {
      toast.error(friendlyAIError(err));
    }
    setAiLoading(null);
  };

  // ── Risk assessment ───────────────────────────────────────────────────────

  const runRiskAssessment = async () => {
    if (!caso || !user) return;
    setAiLoading('risk_assessment');
    try {
      const result = await assessProcessRisk(caseDataForAi, movements, analysis, 'gemini-flash');
      setProcessRisk(result);
      await supabase.from('case_ai_outputs').insert({
        case_id: caso.id, user_id: user.id,
        output_type: 'risk_assessment', content: JSON.stringify(result, null, 2),
        metadata: { generated_at: new Date().toISOString() },
      });
      toast.success('Avaliação de risco concluída');
    } catch (err) {
      toast.error(friendlyAIError(err));
    }
    setAiLoading(null);
  };

  // ── Per-movement AI analysis ──────────────────────────────────────────────

  const analyzeMovement = async (movement: Movement) => {
    if (!caso || !user) return;
    setMovementAiId(movement.id);
    try {
      const prompt = `Analise esta movimentação processual de forma objetiva e técnica para uso interno do escritório jurídico:

Processo: ${caso.nome}
Número: ${caso.numero_processo || 'N/A'}
Tribunal: ${caso.court || caso.court_name || 'N/A'}

Movimentação:
- Data: ${movement.movement_date ? new Date(movement.movement_date).toLocaleDateString('pt-BR') : 'N/A'}
- Tipo/Título: ${movement.title}
- Descrição: ${movement.description || 'Sem descrição adicional'}

Forneça:
1. O que significa essa movimentação no contexto processual
2. Impacto para o caso
3. Ação imediata recomendada para o advogado
4. Prazo a observar (se houver)

Seja técnico, direto e prático.`;

      let result = '';
      const { streamAI } = await import('@/services/aiService');
      await streamAI([{ role: 'user', content: prompt }], 'gemini-flash', (c) => { result += c; });

      setActiveAiText(result);
      setActiveAiLabel(`Análise: ${movement.title}`);
      await supabase.from('case_ai_outputs').insert({
        case_id: caso.id, user_id: user.id,
        output_type: 'movement_analysis', content: result,
        metadata: { movement_id: movement.id, movement_title: movement.title, generated_at: new Date().toISOString() },
      });
    } catch (err) {
      toast.error(friendlyAIError(err));
    }
    setMovementAiId(null);
  };

  // ── Add party manually ────────────────────────────────────────────────────

  const addPartyManually = async () => {
    if (!caso || !user || !partyForm.name.trim()) return;
    setSavingParty(true);
    const { error } = await supabase.from('case_parties').insert({
      case_id: caso.id,
      user_id: user.id,
      name: partyForm.name.trim(),
      type: partyForm.pole === 'ativo' ? 'Autor' : partyForm.pole === 'passivo' ? 'Réu' : (partyForm.type || 'Outro'),
      document: partyForm.document.trim() || null,
      raw_data: { source: 'manual', added_at: new Date().toISOString() },
    });
    if (error) {
      toast.error('Erro ao adicionar parte: ' + error.message);
    } else {
      toast.success('Parte adicionada com sucesso');
      setAddPartyOpen(false);
      setPartyForm({ name: '', document: '', type: '', pole: 'ativo' });
      loadAll();
    }
    setSavingParty(false);
  };

  // ── Reprocess parties from AI ─────────────────────────────────────────────

  const reprocessParties = async () => {
    if (!caso || !user) return;
    setReprocessingParties(true);
    try {
      const movTexts = movements.slice(0, 15).map(m => `${m.movement_date ? new Date(m.movement_date).toLocaleDateString('pt-BR') : '?'}: ${m.title}${m.description ? ' — ' + m.description : ''}`).join('\n');
      const prompt = `Você é um especialista em identificação de partes processuais. Com base nos dados abaixo, identifique todas as partes do processo.

Processo: ${caso.nome}
Número: ${caso.numero_processo || 'N/A'}
Classe: ${caso.case_class || 'N/A'}
Tribunal: ${caso.court || caso.court_name || 'N/A'}

Movimentações recentes:
${movTexts || 'Nenhuma movimentação disponível'}

Retorne APENAS JSON válido:
{
  "partes": [
    { "nome": "string", "polo": "ativo" | "passivo" | "outro", "tipo": "string", "documento": "string ou null" }
  ]
}

Regras:
- polo "ativo" = Autor, Requerente, Reclamante, Exequente
- polo "passivo" = Réu, Requerido, Reclamado, Executado
- Se não encontrar informação, retorne array vazio
- Retorne APENAS o JSON`;

      let raw = '';
      const { streamAI } = await import('@/services/aiService');
      await streamAI([{ role: 'user', content: prompt }], 'gemini-flash', (c) => { raw += c; });
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('IA não retornou JSON válido');
      const result = JSON.parse(match[0]) as { partes: { nome: string; polo: string; tipo: string; documento: string | null }[] };
      if (result.partes && result.partes.length > 0) {
        await supabase.from('case_parties').insert(
          result.partes.map(p => ({
            case_id: caso.id, user_id: user.id,
            name: p.nome,
            type: p.polo === 'ativo' ? (p.tipo || 'Autor') : p.polo === 'passivo' ? (p.tipo || 'Réu') : (p.tipo || 'Outro'),
            document: p.documento ?? null,
            raw_data: { source: 'ai_reprocess', generated_at: new Date().toISOString() },
          }))
        );
        toast.success(`${result.partes.length} parte(s) identificada(s) pela IA`);
        loadAll();
      } else {
        toast.info('IA não identificou partes adicionais nas movimentações');
      }
    } catch (err) {
      toast.error(friendlyAIError(err));
    }
    setReprocessingParties(false);
  };

  // ── Generate complete report (print-to-PDF) ───────────────────────────────

  const generateReport = () => {
    if (!caso) return;
    const authorList = autores.map(a => {
      const advs = lawyers.filter(l => l.party_name === a.name);
      return `${a.name}${a.document ? ' — ' + a.document : ''}${advs.length > 0 ? '\n  Adv: ' + advs.map(adv => adv.name + (adv.oab ? ' OAB ' + adv.oab : '')).join(', ') : ''}`;
    }).join('\n');
    const reuList = reus.map(r => {
      const advs = lawyers.filter(l => l.party_name === r.name);
      return `${r.name}${r.document ? ' — ' + r.document : ''}${advs.length > 0 ? '\n  Adv: ' + advs.map(adv => adv.name + (adv.oab ? ' OAB ' + adv.oab : '')).join(', ') : ''}`;
    }).join('\n');
    const movList = movements.slice(0, 30).map(m => `• ${m.movement_date ? new Date(m.movement_date).toLocaleDateString('pt-BR') : '?'} — ${m.title}`).join('\n');
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Relatório — ${caso.nome}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #111; line-height: 1.6; }
  h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { font-size: 15px; color: #444; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
  .meta div { padding: 4px 0; }
  .label { font-weight: bold; color: #555; }
  pre { background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 12px; white-space: pre-wrap; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
  .badge-alta { background: #d1fae5; color: #065f46; }
  .badge-moderada { background: #fef3c7; color: #92400e; }
  .badge-baixa { background: #fee2e2; color: #991b1b; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>Relatório — ${caso.nome}</h1>
<p style="color:#666;font-size:13px">Gerado em ${new Date().toLocaleString('pt-BR')} · Tribuna IA</p>

<h2>Dados do Processo</h2>
<div class="meta">
  <div><span class="label">Número:</span> ${caso.numero_processo || 'N/A'}</div>
  <div><span class="label">Tribunal:</span> ${caso.court || 'N/A'}</div>
  <div><span class="label">Órgão:</span> ${caso.court_name || 'N/A'}</div>
  <div><span class="label">Classe:</span> ${caso.case_class || 'N/A'}</div>
  <div><span class="label">Área:</span> ${caso.area_juridica || 'N/A'}</div>
  <div><span class="label">Grau:</span> ${caso.degree || 'N/A'}</div>
  <div><span class="label">Distribuição:</span> ${caso.distribution_date ? new Date(caso.distribution_date).toLocaleDateString('pt-BR') : 'N/A'}</div>
  <div><span class="label">Valor da Causa:</span> ${caso.claim_value ? 'R$ ' + caso.claim_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'N/A'}</div>
  <div><span class="label">Fase Atual:</span> ${caso.current_phase || 'N/A'}</div>
  <div><span class="label">Última Mov.:</span> ${caso.last_movement || 'N/A'}</div>
</div>

<h2>Partes</h2>
${authorList ? `<p><strong>Polo Ativo (Autor):</strong><pre>${authorList}</pre></p>` : ''}
${reuList ? `<p><strong>Polo Passivo (Réu):</strong><pre>${reuList}</pre></p>` : ''}

<h2>Resumo do Caso</h2>
<pre>${caso.summary || analysis?.resumo_executivo || 'Não disponível. Gere a análise completa na aba IA do Caso.'}</pre>

${analysis?.estrategia_inicial ? `<h2>Estratégia Jurídica</h2><pre>${analysis.estrategia_inicial}</pre>` : ''}

${successProb ? `<h2>Chance de Êxito</h2>
<p><span class="badge badge-${successProb.nivel}">${successProb.nivel.toUpperCase()} — ${successProb.percentual}%</span></p>
<pre>${successProb.justificativa}</pre>` : ''}

${processRisk ? `<h2>Risco Processual</h2>
<p><span class="badge badge-${processRisk.nivel_geral === 'critico' ? 'baixa' : processRisk.nivel_geral === 'atencao' ? 'moderada' : 'alta'}">${processRisk.nivel_geral.toUpperCase()}</span></p>
<pre>${processRisk.recomendacoes?.join('\n') || ''}</pre>` : ''}

${analysis?.proximos_passos?.length ? `<h2>Próximos Passos</h2><pre>${analysis.proximos_passos.map((s, i) => `${i + 1}. ${s}`).join('\n')}</pre>` : ''}

${movements.length > 0 ? `<h2>Movimentações (${movements.length})</h2><pre>${movList}${movements.length > 30 ? '\n... +' + (movements.length - 30) + ' movimentações anteriores' : ''}</pre>` : ''}

<hr style="margin-top:32px;border-color:#ddd">
<p style="font-size:11px;color:#999;text-align:center">Relatório gerado pelo Tribuna IA · ${new Date().toLocaleDateString('pt-BR')}</p>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  // ── Preparar Atuação ──────────────────────────────────────────────────────

  const prepareActuation = () => {
    const lastMovs = movements.slice(0, 5).map(m => `• ${m.movement_date ? new Date(m.movement_date).toLocaleDateString('pt-BR') : '?'}: ${m.title}`).join('\n');
    const prompt = `Você é um advogado experiente. Prepare um guia de atuação para o processo abaixo.

Processo: ${caso?.nome}
Número: ${caso?.numero_processo || 'N/A'}
Classe: ${caso?.case_class || 'N/A'}
Fase atual: ${caso?.current_phase || 'N/A'}
Área: ${caso?.area_juridica || 'N/A'}
Última movimentação: ${caso?.last_movement || 'N/A'}

Últimas movimentações:
${lastMovs || 'Sem movimentações registradas'}

${analysis ? `Estratégia anterior: ${analysis.estrategia_inicial || 'N/A'}\nRiscos: ${analysis.riscos?.slice(0, 3).join('; ') || 'N/A'}` : ''}

Com base na fase atual e nas últimas movimentações, prepare:

## Situação Atual do Processo

## Próxima Atuação Necessária
(Especifique: audiência, prazo, recurso, manifestação, etc.)

## Roteiro de Preparação
(Passos concretos para o advogado se preparar)

## Peças a Elaborar
(Quais documentos/petições preparar)

## Pontos de Atenção
(O que não pode ser esquecido)

## Prazos Críticos
(Identifique prazos processuais relacionados)

Seja objetivo, técnico e prático. Foco em ação imediata.`;

    runAi('prepare_actuation', 'Preparar Atuação', async () => {
      let result = '';
      const { streamAI } = await import('@/services/aiService');
      await streamAI([{ role: 'user', content: prompt }], 'gemini-flash', (c) => { result += c; });
      return result;
    });
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const analysis = caso?.ai_analysis as CaseAiAnalysis | null;

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </Layout>
  );

  if (!caso) return null;

  const caseDataForAi = {
    nome: caso.nome, cliente: caso.cliente, numero_processo: caso.numero_processo,
    area: caso.area_juridica, tribunal: caso.court || caso.court_name, classe: caso.case_class,
    assunto: caso.subject, fase: caso.current_phase, status: caso.status,
    ultima_movimentacao: caso.last_movement, valor_causa: caso.claim_value,
    movimentacoes: movements.slice(0, 20).map(m => ({ data: m.movement_date, titulo: m.title })),
  };

  const isAutorPolo = (type: string | null): boolean => {
    if (!type) return false;
    const t = type.toLowerCase();
    return t === 'ativo' || t.includes('autor') || t.includes('reclamant') || t.includes('requerente') || t.includes('impetrante');
  };

  const isReuPolo = (type: string | null): boolean => {
    if (!type) return false;
    const t = type.toLowerCase();
    return t === 'passivo' || t.includes('réu') || t.includes('reo') || t.includes('reclamad') || t.includes('requerido') || t.includes('impetrado');
  };

  // Group parties by polo
  const autores = parties.filter(p => isAutorPolo(p.type));
  const reus = parties.filter(p => isReuPolo(p.type));
  const otherParties = parties.filter(p => !autores.includes(p) && !reus.includes(p));

  const NI = 'Não informado pelo DataJud';
  const authorNames = autores.map(a => a.name).join(', ') || (parties[0]?.name ?? NI);
  const reuNames = reus.map(r => r.name).join(', ') || (parties[1]?.name ?? NI);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-5">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/casos')} className="mt-0.5 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold truncate">{caso.nome}</h1>
              <Badge variant="outline" className={`text-xs border shrink-0 ${STATUS_COLORS[caso.status] || ''}`}>
                {STATUS_LABELS[caso.status] || caso.status}
              </Badge>
              {caso.import_source === 'datajud' && (
                <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
                  <Download className="h-3 w-3" /> DataJud
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{caso.cliente}</p>
            {caso.numero_processo && (
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{caso.numero_processo}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {caso.numero_processo && (
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5 text-xs">
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Atualizar DataJud
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={generateReport} className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Gerar Relatório
            </Button>
          </div>
        </div>

        {/* ── Dashboard cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {[
            { icon: User, label: 'Autor', value: authorNames, color: 'text-blue-600' },
            { icon: Building2, label: 'Réu', value: reuNames, color: 'text-red-500' },
            { icon: Activity, label: 'Fase Atual', value: caso.current_phase || NI, color: 'text-purple-600' },
            { icon: DollarSign, label: 'Valor da Causa', value: caso.claim_value ? `R$ ${caso.claim_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : NI, color: 'text-emerald-600' },
            { icon: Gavel, label: 'Tribunal', value: caso.court || NI, color: 'text-slate-600' },
            { icon: Scale, label: 'Área', value: caso.area_juridica || NI, color: 'text-indigo-600' },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                </div>
                <p className="text-sm font-semibold truncate">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Probability + Risk cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Success probability */}
          <Card className={`border-l-4 ${successProb?.nivel === 'alta' ? 'border-l-emerald-500' : successProb?.nivel === 'moderada' ? 'border-l-amber-500' : successProb ? 'border-l-red-500' : 'border-l-border'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Chance de Êxito</p>
                </div>
                {!successProb && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={!!aiLoading} onClick={runSuccessProbability}>
                    {aiLoading === 'success_probability' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Calcular
                  </Button>
                )}
              </div>
              {successProb ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SuccessBadge nivel={successProb.nivel} percentual={successProb.percentual} />
                  </div>
                  <p className="text-xs text-muted-foreground">{successProb.justificativa}</p>
                  {successProb.pontos_favoraveis?.length > 0 && (
                    <div className="text-xs space-y-0.5">
                      {successProb.pontos_favoraveis.slice(0, 2).map((p, i) => (
                        <p key={i} className="text-emerald-700">✓ {p}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Gere uma avaliação de probabilidade de êxito com IA</p>
              )}
            </CardContent>
          </Card>

          {/* Risk motor */}
          <Card className={`border-l-4 ${processRisk?.nivel_geral === 'critico' ? 'border-l-red-500' : processRisk?.nivel_geral === 'atencao' ? 'border-l-amber-500' : processRisk ? 'border-l-emerald-500' : 'border-l-border'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Risco Processual</p>
                </div>
                {!processRisk && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={!!aiLoading} onClick={runRiskAssessment}>
                    {aiLoading === 'risk_assessment' ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                    Avaliar
                  </Button>
                )}
              </div>
              {processRisk ? (
                <div className="space-y-2">
                  <RiskBadge nivel={processRisk.nivel_geral} />
                  <div className="space-y-1">
                    {processRisk.fatores.slice(0, 3).map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-[10px] mt-0.5">{f.nivel === 'critico' ? '🔴' : f.nivel === 'atencao' ? '🟡' : '🟢'}</span>
                        <p className="text-xs text-muted-foreground">{f.descricao}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Avalie prazos, riscos de prescrição e diligências pendentes</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Próxima Ação Recomendada ─────────────────────────────────── */}
        {(() => {
          const nextAction =
            (analysis?.proximos_passos && analysis.proximos_passos.length > 0 ? analysis.proximos_passos[0] : null) ||
            (processRisk?.recomendacoes && processRisk.recomendacoes.length > 0 ? processRisk.recomendacoes[0] : null) ||
            (caso.current_phase ? `Acompanhar fase: ${caso.current_phase}` : null) ||
            'Aguardar próxima movimentação do processo';
          const urgency = processRisk?.nivel_geral === 'critico' ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' :
            processRisk?.nivel_geral === 'atencao' ? 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20' :
            'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20';
          return (
            <Card className={`border-l-4 ${urgency}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <Zap className={`h-5 w-5 mt-0.5 shrink-0 ${processRisk?.nivel_geral === 'critico' ? 'text-red-500' : processRisk?.nivel_geral === 'atencao' ? 'text-amber-500' : 'text-emerald-600'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Próxima Ação Recomendada</p>
                  <p className="text-sm font-semibold">{nextAction}</p>
                  {analysis?.proximos_passos && analysis.proximos_passos.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">+{analysis.proximos_passos.length - 1} ações adicionais na aba IA do Caso</p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs gap-1" onClick={runFullAnalysis} disabled={!!aiLoading}>
                  {aiLoading === 'full_analysis' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Reprocessar IA
                </Button>
              </CardContent>
            </Card>
          );
        })()}

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Visão Geral</TabsTrigger>
            <TabsTrigger value="parties" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Partes
              {parties.length > 0 && <span className="ml-1 text-[10px] bg-primary/20 text-primary rounded-full px-1.5">{parties.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="movements" className="gap-1.5 text-xs">
              <List className="h-3.5 w-3.5" /> Movimentações
              {movements.length > 0 && <span className="ml-1 text-[10px] bg-primary/20 text-primary rounded-full px-1.5">{movements.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 text-xs">
              <Folder className="h-3.5 w-3.5" /> Documentos
              {documents.length > 0 && <span className="ml-1 text-[10px] bg-primary/20 text-primary rounded-full px-1.5">{documents.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Linha do Tempo</TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 text-xs"><Bot className="h-3.5 w-3.5" /> IA do Caso</TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 text-xs"><StickyNote className="h-3.5 w-3.5" /> Anotações</TabsTrigger>
          </TabsList>

          {/* ── Overview ────────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Process data */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Hash className="h-4 w-4 text-primary" /> Dados do Processo</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    { l: 'Número', v: caso.numero_processo, mono: true },
                    { l: 'Tribunal', v: caso.court },
                    { l: 'Órgão Julgador', v: caso.court_name },
                    { l: 'Classe', v: caso.case_class },
                    { l: 'Assunto', v: caso.subject },
                    { l: 'Grau', v: caso.degree },
                    { l: 'Distribuição', v: caso.distribution_date ? (() => { const d = new Date(caso.distribution_date!); return isNaN(d.getTime()) ? caso.distribution_date : format(d, 'dd/MM/yyyy', { locale: ptBR }); })() : null },
                    { l: 'Valor da Causa', v: caso.claim_value ? `R$ ${caso.claim_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null },
                    { l: 'Fase atual', v: caso.current_phase },
                    { l: 'Área', v: caso.area_juridica },
                    { l: 'Última movimentação', v: caso.last_movement },
                  ].filter(x => x.v).map(({ l, v, mono }) => (
                    <div key={l} className="flex justify-between gap-2 py-1 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground shrink-0 text-xs">{l}</span>
                      <span className={`text-right text-xs ${mono ? 'font-mono' : ''}`}>{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-4">
                {caso.summary && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Resumo da IA</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{caso.summary}</p></CardContent>
                  </Card>
                )}
                {analysis?.objeto_processo && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-indigo-500" /> Objeto do Processo</CardTitle></CardHeader>
                    <CardContent><p className="text-sm leading-relaxed">{analysis.objeto_processo}</p></CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Pontos favoráveis / desfavoráveis */}
            {analysis && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.proximos_passos && analysis.proximos_passos.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><ChevronRight className="h-4 w-4 text-emerald-500" /> Próximos Passos</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {analysis.proximos_passos.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-emerald-500 shrink-0 mt-0.5">→</span><span>{s}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {analysis.riscos && analysis.riscos.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Riscos Identificados</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {analysis.riscos.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-amber-500 shrink-0 mt-0.5">⚠</span><span>{r}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {analysis?.checklist_documentos && analysis.checklist_documentos.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CheckSquare className="h-4 w-4 text-blue-500" /> Checklist de Documentos</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {analysis.checklist_documentos.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-3.5 w-3.5 shrink-0 accent-primary" readOnly />
                      <span>{d}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {analysis?.estrategia_inicial && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /> Estratégia Inicial</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed">{analysis.estrategia_inicial}</p></CardContent>
              </Card>
            )}

            {!caso.summary && !analysis && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Bot className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-semibold text-sm mb-1">Análise de IA não gerada</p>
                  <p className="text-xs text-muted-foreground mb-4">Gere a análise completa para ver resumo, riscos, estratégia e checklist</p>
                  <Button size="sm" onClick={runFullAnalysis} disabled={!!aiLoading} className="gap-2">
                    {aiLoading === 'full_analysis' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Gerar Análise Completa
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Parties ─────────────────────────────────────────────────── */}
          <TabsContent value="parties" className="space-y-4 mt-4">
            {/* Action bar */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setAddPartyOpen(true)}>
                <User className="h-3.5 w-3.5" /> Adicionar Parte Manualmente
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" disabled={reprocessingParties} onClick={reprocessParties}>
                {reprocessingParties ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Reprocessar Identificação
              </Button>
            </div>

            {parties.length === 0 && lawyers.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="font-semibold text-sm">Nenhuma parte registrada</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    As partes são importadas automaticamente do DataJud.<br />
                    Se não apareceram, clique em <strong>Reprocessar Identificação</strong> ou adicione manualmente.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Polo Ativo */}
                {autores.length > 0 && (
                  <Card className="border-l-4 border-l-blue-400">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-500" /> Polo Ativo — Autor(es)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y space-y-0">
                      {autores.map(p => {
                        const advs = lawyers.filter(l => l.party_name === p.name);
                        return (
                          <div key={p.id} className="py-3 first:pt-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-sm">{p.name}</p>
                                {p.document && <p className="text-xs text-muted-foreground">CPF/CNPJ: {p.document}</p>}
                                {p.type && <Badge variant="outline" className="text-[10px] mt-1">{p.type}</Badge>}
                              </div>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copyText(p.name)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            {advs.length > 0 && (
                              <div className="mt-2 pl-3 border-l border-blue-200 space-y-1">
                                {advs.map(a => (
                                  <p key={a.id} className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Adv:</span> {a.name}{a.oab ? ` — OAB ${a.oab}` : ''}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Polo Passivo */}
                {reus.length > 0 && (
                  <Card className="border-l-4 border-l-red-400">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-red-500" /> Polo Passivo — Réu(s)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y space-y-0">
                      {reus.map(p => {
                        const advs = lawyers.filter(l => l.party_name === p.name);
                        return (
                          <div key={p.id} className="py-3 first:pt-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-sm">{p.name}</p>
                                {p.document && <p className="text-xs text-muted-foreground">CPF/CNPJ: {p.document}</p>}
                                {p.type && <Badge variant="outline" className="text-[10px] mt-1">{p.type}</Badge>}
                              </div>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copyText(p.name)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            {advs.length > 0 && (
                              <div className="mt-2 pl-3 border-l border-red-200 space-y-1">
                                {advs.map(a => (
                                  <p key={a.id} className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Adv:</span> {a.name}{a.oab ? ` — OAB ${a.oab}` : ''}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Other parties */}
                {otherParties.length > 0 && (
                  <Card className="md:col-span-2">
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Outras Partes</CardTitle></CardHeader>
                    <CardContent className="divide-y">
                      {otherParties.map(p => (
                        <div key={p.id} className="py-2.5 flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-sm">{p.name}</p>
                            {p.document && <p className="text-xs text-muted-foreground">Doc: {p.document}</p>}
                          </div>
                          {p.type && <Badge variant="outline" className="text-xs shrink-0">{p.type}</Badge>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Advogados sem parte vinculada */}
                {lawyers.filter(l => !parties.find(p => p.name === l.party_name)).length > 0 && (
                  <Card className="md:col-span-2">
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Advogados</CardTitle></CardHeader>
                    <CardContent className="divide-y">
                      {lawyers.filter(l => !parties.find(p => p.name === l.party_name)).map(l => (
                        <div key={l.id} className="py-2.5">
                          <p className="font-medium text-sm">{l.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.oab && `OAB: ${l.oab}`}{l.oab && l.party_name && ' — '}{l.party_name && `Representa: ${l.party_name}`}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Movements ───────────────────────────────────────────────── */}
          <TabsContent value="movements" className="mt-4">
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação registrada</p>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Movimentações ({movements.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-1 relative before:absolute before:left-3 before:top-0 before:bottom-0 before:w-px before:bg-border/60">
                      {movements.map((m) => (
                        <div key={m.id} className="pl-8 relative">
                          <div className={`absolute left-1.5 top-2.5 h-3 w-3 rounded-full border-2 ${m.is_important ? 'border-primary bg-primary' : 'border-border bg-background'}`} />
                          <div className="py-2.5 border-b border-border/30 last:border-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm leading-snug">{m.title}</p>
                                {m.movement_date && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {(() => { const d = new Date(m.movement_date); return isNaN(d.getTime()) ? m.movement_date : format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); })()}
                                  </p>
                                )}
                                {m.description && <p className="text-xs text-muted-foreground mt-1 italic">{m.description}</p>}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] gap-1 shrink-0 text-primary hover:bg-primary/10"
                                disabled={movementAiId === m.id || !!aiLoading}
                                onClick={() => analyzeMovement(m)}
                              >
                                {movementAiId === m.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Bot className="h-3 w-3" />}
                                Analisar
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Documents ───────────────────────────────────────────────── */}
          <TabsContent value="documents" className="mt-4 space-y-4">
            {/* Upload prompt */}
            <Card className="border-dashed border-2 border-primary/30 bg-primary/3">
              <CardContent className="p-4">
                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer py-4 text-center">
                  <Upload className="h-8 w-8 text-primary/60" />
                  <p className="text-sm font-semibold text-primary/80">Fazer upload de documento</p>
                  <p className="text-xs text-muted-foreground">PDF ou DOCX — o documento será vinculado a este caso</p>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !caso || !user) return;
                      const path = `${user.id}/${caso.id}/${Date.now()}_${file.name}`;
                      const { error: uploadErr } = await supabase.storage.from('case-documents').upload(path, file, { upsert: false });
                      if (uploadErr) { toast.error('Erro ao fazer upload: ' + uploadErr.message); return; }
                      const { data: urlData } = supabase.storage.from('case-documents').getPublicUrl(path);
                      const { error: dbErr } = await supabase.from('case_documents').insert({
                        case_id: caso.id, user_id: user.id,
                        file_name: file.name, file_url: urlData.publicUrl,
                        file_type: file.type, file_size: file.size,
                      });
                      if (dbErr) { toast.error('Erro ao salvar documento'); return; }
                      toast.success('Documento enviado com sucesso');
                      loadAll();
                    }}
                  />
                  <Button size="sm" variant="outline" className="gap-1.5 pointer-events-none mt-1">
                    <Upload className="h-3.5 w-3.5" /> Selecionar arquivo
                  </Button>
                </label>
              </CardContent>
            </Card>

            {documents.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Folder className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="font-semibold text-sm">Nenhum documento anexado</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Documentos do DataJud não estão disponíveis para download direto.<br />
                    Faça upload manual dos autos para análise completa com IA.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Folder className="h-4 w-4 text-primary" /> Documentos ({documents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  {documents.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.file_type || 'Arquivo'}{doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                            {' · '}{format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" /> Abrir
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1" asChild>
                          <a href={doc.file_url} download={doc.file_name}>
                            <Download className="h-3 w-3" /> Baixar
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10"
                          disabled={!!aiLoading}
                          onClick={async () => {
                            if (!caso || !user) return;
                            setAiLoading(`doc_${doc.id}`);
                            try {
                              let result = '';
                              const { streamAI } = await import('@/services/aiService');
                              await streamAI([{
                                role: 'user',
                                content: `Analise o documento "${doc.file_name}" vinculado ao processo ${caso.nome} (${caso.numero_processo || 'N/A'}).\n\nComo não temos o conteúdo extraído, forneça:\n1. O que tipicamente este tipo de documento representa no processo\n2. Ações imediatas sugeridas ao advogado\n3. Prazos ou atenções a ter com este tipo de peça\n\nSeja objetivo e prático.`,
                              }], 'gemini-flash', (c) => { result += c; });
                              setActiveAiText(result);
                              setActiveAiLabel(`Análise: ${doc.file_name}`);
                            } catch (err) {
                              toast.error(friendlyAIError(err));
                            }
                            setAiLoading(null);
                          }}
                        >
                          {aiLoading === `doc_${doc.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                          Analisar
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Active AI output (shared with AI tab) */}
            {activeAiText && (
              <Card className="border-primary/30 bg-primary/3">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> {activeAiLabel || 'Análise da IA'}
                    </CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => copyText(activeAiText)} className="gap-1.5 h-7 text-xs">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{activeAiText}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Timeline ────────────────────────────────────────────────── */}
          <TabsContent value="timeline" className="mt-4 space-y-4">
            {/* AI Timeline */}
            {analysis?.linha_do_tempo && analysis.linha_do_tempo.length > 0 ? (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Linha do Tempo — IA</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4 relative before:absolute before:left-2.5 before:top-0 before:bottom-0 before:w-px before:bg-border/60">
                    {analysis.linha_do_tempo.map((item, i) => (
                      <div key={i} className="pl-8 relative">
                        <div className={`absolute left-0 top-1 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-primary/10 border border-primary/30 text-primary'}`}>
                          {i + 1}
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground">{item.data}</p>
                        <p className="text-sm mt-0.5">{item.evento}</p>
                      </div>
                    ))}
                    {/* Current state */}
                    <div className="pl-8 relative">
                      <div className="absolute left-0 top-1 h-5 w-5 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center">
                        <span className="text-[8px]">⏳</span>
                      </div>
                      <p className="text-[11px] font-semibold text-amber-600">Hoje</p>
                      <p className="text-sm mt-0.5">{caso.current_phase || caso.last_movement || 'Aguardando próxima movimentação'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="font-semibold text-sm">Linha do tempo não disponível</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Gere a análise completa com IA para ver a linha do tempo</p>
                  <Button size="sm" onClick={runFullAnalysis} disabled={!!aiLoading} className="gap-2">
                    {aiLoading === 'full_analysis' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Gerar Análise Completa
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Real movements mini-timeline */}
            {movements.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Movimentações Reais (DataJud)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 relative before:absolute before:left-2 before:top-0 before:bottom-0 before:w-px before:bg-border/40">
                    {movements.slice(0, 8).map((m) => (
                      <div key={m.id} className="pl-7 relative">
                        <div className="absolute left-0.5 top-1.5 h-3 w-3 rounded-full bg-muted border border-border" />
                        <p className="text-xs text-muted-foreground">
                          {m.movement_date ? (() => { const d = new Date(m.movement_date); return isNaN(d.getTime()) ? m.movement_date : format(d, 'dd/MM/yyyy', { locale: ptBR }); })() : '?'}
                        </p>
                        <p className="text-sm font-medium">✓ {m.title}</p>
                      </div>
                    ))}
                    {movements.length > 8 && <p className="text-xs text-muted-foreground pl-7">+{movements.length - 8} movimentações anteriores</p>}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── AI Tab ──────────────────────────────────────────────────── */}
          <TabsContent value="ai" className="space-y-4 mt-4">
            {/* Quick actions */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" disabled={!!aiLoading} onClick={() => runAi('summary', 'Resumo Executivo', () => generateCaseSummary(caseDataForAi))}>
                {aiLoading === 'summary' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Resumo
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" disabled={!!aiLoading} onClick={() => runAi('strategy', 'Estratégia Jurídica', () => generateCaseStrategy(caseDataForAi, analysis))}>
                {aiLoading === 'strategy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />} Estratégia
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" disabled={!!aiLoading} onClick={() => runAi('questions', 'Perguntas ao Cliente', () => generateClientQuestions(caseDataForAi))}>
                {aiLoading === 'questions' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />} Perguntas
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" disabled={!!aiLoading} onClick={prepareActuation}>
                {aiLoading === 'prepare_actuation' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Preparar Atuação
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" onClick={generateReport}>
                <FileText className="h-3.5 w-3.5" /> Gerar Relatório
              </Button>
              <Button size="sm" className="gap-1.5 h-9 text-xs" disabled={!!aiLoading} onClick={runFullAnalysis}>
                {aiLoading === 'full_analysis' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />} Análise Completa
              </Button>
            </div>

            {/* Petition generator */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><FileSignature className="h-4 w-4 text-primary" /> Gerar Peça Processual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Select value={petitionType} onValueChange={setPetitionType}>
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inicial">Petição Inicial</SelectItem>
                      <SelectItem value="contestacao">Contestação</SelectItem>
                      <SelectItem value="replica">Réplica</SelectItem>
                      <SelectItem value="manifestacao">Manifestação</SelectItem>
                      <SelectItem value="cumprimento">Cumprimento de Sentença</SelectItem>
                      <SelectItem value="impugnacao">Impugnação ao Cumprimento</SelectItem>
                      <SelectItem value="embargos_execucao">Embargos à Execução</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="gap-1.5 shrink-0" disabled={!!aiLoading}
                    onClick={() => runAi(`petition_${petitionType}`, `Peça: ${petitionType}`, () => generatePetition(petitionType, caseDataForAi, analysis))}>
                    {aiLoading?.startsWith('petition_') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSignature className="h-3.5 w-3.5" />}
                    Gerar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resource generator */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Gavel className="h-4 w-4 text-amber-600" /> Gerar Recurso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Select value={resourceType} onValueChange={setResourceType}>
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apelacao">Apelação</SelectItem>
                      <SelectItem value="agravo_instrumento">Agravo de Instrumento</SelectItem>
                      <SelectItem value="agravo_regimental">Agravo Regimental</SelectItem>
                      <SelectItem value="recurso_inominado">Recurso Inominado</SelectItem>
                      <SelectItem value="embargos_declaracao">Embargos de Declaração</SelectItem>
                      <SelectItem value="recurso_especial">Recurso Especial</SelectItem>
                      <SelectItem value="recurso_extraordinario">Recurso Extraordinário</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" disabled={!!aiLoading}
                    onClick={() => runAi(`resource_${resourceType}`, `Recurso: ${resourceType}`, () => generateResource(resourceType, caseDataForAi, analysis))}>
                    {aiLoading?.startsWith('resource_') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gavel className="h-3.5 w-3.5" />}
                    Gerar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Client explanation */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><PhoneCall className="h-4 w-4 text-emerald-600" /> Explicar ao Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Gera uma explicação do processo em linguagem simples, pronta para enviar ao cliente.</p>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={!!aiLoading}
                  onClick={() => runAi('client_explanation', 'Explicação ao Cliente', () => explainToClient(caseDataForAi, analysis))}>
                  {aiLoading === 'client_explanation' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5" />}
                  Gerar Explicação
                </Button>
              </CardContent>
            </Card>

            {/* Active AI output */}
            {activeAiText && (
              <Card className="border-primary/30 bg-primary/3">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> {activeAiLabel || 'Resultado da IA'}
                    </CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => copyText(activeAiText)} className="gap-1.5 h-7 text-xs">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{activeAiText}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Output history */}
            {aiOutputs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico ({aiOutputs.length})</p>
                {aiOutputs.slice(0, 6).map(out => (
                  <Card key={out.id} className="border-border/50">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{out.output_type.replace(/_/g, ' ')}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(out.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setActiveAiText(out.content); setActiveAiLabel(out.output_type); }}>
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <p className="text-xs text-muted-foreground line-clamp-2">{out.content.slice(0, 200)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Notes ───────────────────────────────────────────────────── */}
          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Anotações Internas</CardTitle>
                  <Button size="sm" onClick={saveNotes} className="h-7 text-xs gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5" /> Salvar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações internas: estratégias, observações, lembretes, datas importantes…"
                  rows={16}
                  className="resize-none font-mono text-sm"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Adicionar Parte Manualmente ─────────────────────────────── */}
      <Dialog open={addPartyOpen} onOpenChange={setAddPartyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User className="h-4 w-4" /> Adicionar Parte Manualmente</DialogTitle>
            <DialogDescription>Preencha os dados da parte que deseja incluir neste processo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input placeholder="Nome da parte" value={partyForm.name} onChange={e => setPartyForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>CPF / CNPJ</Label>
              <Input placeholder="000.000.000-00" value={partyForm.document} onChange={e => setPartyForm(f => ({ ...f, document: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Polo</Label>
              <Select value={partyForm.pole} onValueChange={v => setPartyForm(f => ({ ...f, pole: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Polo Ativo (Autor / Requerente)</SelectItem>
                  <SelectItem value="passivo">Polo Passivo (Réu / Requerido)</SelectItem>
                  <SelectItem value="outro">Outro / Interveniente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo da parte (opcional)</Label>
              <Input placeholder="Ex: Autor, Réu, Litisconsorte, Assistente…" value={partyForm.type} onChange={e => setPartyForm(f => ({ ...f, type: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPartyOpen(false)} disabled={savingParty}>Cancelar</Button>
            <Button onClick={addPartyManually} disabled={savingParty || !partyForm.name.trim()} className="gap-2">
              {savingParty && <Loader2 className="h-4 w-4 animate-spin" />} Salvar Parte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
