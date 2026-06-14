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
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, RefreshCw, Bot, FileText, Users,
  List, StickyNote, Hash, Scale, Calendar, AlertTriangle,
  CheckSquare, ChevronRight, Sparkles, Download, Copy, Check,
  TrendingUp, Shield, PhoneCall, FileSignature, BookOpen,
  AlertCircle, Clock, DollarSign, Gavel, Target, Activity,
  User, Building2, MessageSquare,
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
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [activeAiText, setActiveAiText] = useState('');
  const [activeAiLabel, setActiveAiLabel] = useState('');
  const [copied, setCopied] = useState(false);

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
    const [{ data: c }, { data: p }, { data: l }, { data: m }, { data: a }] = await Promise.all([
      supabase.from('casos').select('*').eq('id', id).single(),
      supabase.from('case_parties').select('*').eq('case_id', id).order('created_at'),
      supabase.from('case_lawyers').select('*').eq('case_id', id),
      supabase.from('case_movements').select('*').eq('case_id', id).order('movement_date', { ascending: false }),
      supabase.from('case_ai_outputs').select('*').eq('case_id', id).order('created_at', { ascending: false }),
    ]);

    if (!c) { toast.error('Caso não encontrado'); navigate('/casos'); return; }
    setCaso(c as CaseRow);
    setParties((p || []) as Party[]);
    setLawyers((l || []) as Lawyer[]);
    setMovements((m || []) as Movement[]);
    setAiOutputs((a || []) as AiOutput[]);
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

  // Group parties by polo
  const autores = parties.filter(p => p.type?.toLowerCase().includes('autor') || p.type?.toLowerCase().includes('reclamant') || p.type?.toLowerCase().includes('requerente') || p.type?.toLowerCase().includes('impetrante'));
  const reus = parties.filter(p => p.type?.toLowerCase().includes('réu') || p.type?.toLowerCase().includes('reclamad') || p.type?.toLowerCase().includes('requerido') || p.type?.toLowerCase().includes('impetrado'));
  const otherParties = parties.filter(p => !autores.includes(p) && !reus.includes(p));

  const authorNames = autores.map(a => a.name).join(', ') || (parties[0]?.name ?? '—');
  const reuNames = reus.map(r => r.name).join(', ') || (parties[1]?.name ?? '—');

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
          <div className="flex gap-2 shrink-0">
            {caso.numero_processo && (
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5 text-xs">
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Atualizar DataJud
              </Button>
            )}
          </div>
        </div>

        {/* ── Dashboard cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {[
            { icon: User, label: 'Autor', value: authorNames, color: 'text-blue-600' },
            { icon: Building2, label: 'Réu', value: reuNames, color: 'text-red-500' },
            { icon: Activity, label: 'Fase Atual', value: caso.current_phase || 'Não informado', color: 'text-purple-600' },
            { icon: DollarSign, label: 'Valor da Causa', value: caso.claim_value ? `R$ ${caso.claim_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado', color: 'text-emerald-600' },
            { icon: Gavel, label: 'Tribunal', value: caso.court || 'Não informado', color: 'text-slate-600' },
            { icon: Scale, label: 'Área', value: caso.area_juridica || 'Não informado', color: 'text-indigo-600' },
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
            {parties.length === 0 && lawyers.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="font-semibold text-sm">Nenhuma parte registrada</p>
                  <p className="text-xs text-muted-foreground mt-1">As partes são importadas automaticamente do DataJud</p>
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
                            <p className="font-medium text-sm leading-snug">{m.title}</p>
                            {m.movement_date && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {(() => { const d = new Date(m.movement_date); return isNaN(d.getTime()) ? m.movement_date : format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); })()}
                              </p>
                            )}
                            {m.description && <p className="text-xs text-muted-foreground mt-1 italic">{m.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" disabled={!!aiLoading} onClick={() => runAi('summary', 'Resumo Executivo', () => generateCaseSummary(caseDataForAi))}>
                {aiLoading === 'summary' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Resumo
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" disabled={!!aiLoading} onClick={() => runAi('strategy', 'Estratégia Jurídica', () => generateCaseStrategy(caseDataForAi, analysis))}>
                {aiLoading === 'strategy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />} Estratégia
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" disabled={!!aiLoading} onClick={() => runAi('questions', 'Perguntas ao Cliente', () => generateClientQuestions(caseDataForAi))}>
                {aiLoading === 'questions' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />} Perguntas
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
    </Layout>
  );
}
