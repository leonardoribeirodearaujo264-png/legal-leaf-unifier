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
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, RefreshCw, Bot, FileText, Users,
  List, Timeline, StickyNote, Hash, Scale, Gavel, Calendar,
  AlertTriangle, CheckSquare, ChevronRight, Sparkles,
  Download, Copy, Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { refreshProcess } from '@/services/datajudService';
import {
  analyzeCase, generateCaseSummary, generateCaseStrategy, generateClientQuestions,
} from '@/services/caseAiService';
import type { CaseAiAnalysis } from '@/services/caseAiService';
import type { DatajudProcess } from '@/services/datajudService';
import ReactMarkdown from 'react-markdown';

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
interface AiOutput { id: string; output_type: string; content: string; created_at: string; }

const STATUS_COLORS: Record<string, string> = {
  ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  aguardando: 'bg-amber-100 text-amber-700 border-amber-200',
  arquivado: 'bg-slate-100 text-slate-600 border-slate-200',
  encerrado: 'bg-red-100 text-red-700 border-red-200',
  imported: 'bg-blue-100 text-blue-700 border-blue-200',
};

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
  const [copied, setCopied] = useState(false);

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
    const newMovements = (p.movimentos || []).filter(m => {
      const key = (m.dataHora || '') + (m.nome || '');
      return !existingIds.has(key);
    });

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
    if (error) toast.error('Erro ao salvar');
    else toast.success('Anotações salvas');
  };

  // ── AI actions ────────────────────────────────────────────────────────────

  const runAi = async (type: string, fn: () => Promise<string | string[]>) => {
    if (!caso || !user) return;
    setAiLoading(type);
    setActiveAiText('');
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
      toast.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
    setAiLoading(null);
  };

  const runFullAnalysis = async () => {
    if (!caso?.datajud_raw || !user) { toast.error('Dados do DataJud não disponíveis para análise completa'); return; }
    setAiLoading('full_analysis');
    try {
      const process = caso.datajud_raw as unknown as DatajudProcess;
      const analysis = await analyzeCase(process, 'gemini-flash', caso.cliente);
      const text = JSON.stringify(analysis, null, 2);

      await supabase.from('casos').update({
        summary: analysis.resumo_executivo,
        ai_analysis: analysis as unknown as Record<string, unknown>,
        current_phase: analysis.fase_atual,
      }).eq('id', caso.id);

      await supabase.from('case_ai_outputs').insert({
        case_id: caso.id, user_id: user.id,
        output_type: 'full_analysis', content: text,
        metadata: { generated_at: new Date().toISOString() },
      });

      toast.success('Análise completa atualizada');
      loadAll();
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
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
    area: caso.area_juridica, tribunal: caso.court_name, classe: caso.case_class,
    assunto: caso.subject, fase: caso.current_phase, status: caso.status,
    ultima_movimentacao: caso.last_movement,
    movimentacoes: movements.slice(0, 20).map(m => ({ data: m.movement_date, titulo: m.title })),
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/casos')} className="mt-1 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold truncate">{caso.nome}</h1>
              <Badge variant="outline" className={`text-xs border shrink-0 ${STATUS_COLORS[caso.status] || ''}`}>
                {caso.status}
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
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Atualizar DataJud
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Visão Geral</TabsTrigger>
            <TabsTrigger value="parties" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Partes</TabsTrigger>
            <TabsTrigger value="movements" className="gap-1.5"><List className="h-3.5 w-3.5" /> Movimentações</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5"><ChevronRight className="h-3.5 w-3.5" /> Linha do Tempo</TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5"><Bot className="h-3.5 w-3.5" /> IA do Caso</TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5"><StickyNote className="h-3.5 w-3.5" /> Anotações</TabsTrigger>
          </TabsList>

          {/* ── Overview ─────────────────────────────────────────────────── */}
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
                    { l: 'Distribuição', v: caso.distribution_date ? format(new Date(caso.distribution_date), 'dd/MM/yyyy', { locale: ptBR }) : null },
                    { l: 'Valor da Causa', v: caso.claim_value ? `R$ ${caso.claim_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null },
                    { l: 'Fase atual', v: caso.current_phase },
                    { l: 'Área', v: caso.area_juridica },
                  ].filter(x => x.v).map(({ l, v, mono }) => (
                    <div key={l} className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">{l}</span>
                      <span className={`text-right ${mono ? 'font-mono text-xs' : ''}`}>{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* AI summary + checklist */}
              <div className="space-y-4">
                {caso.summary && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Resumo da IA</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">{caso.summary}</p>
                    </CardContent>
                  </Card>
                )}
                {analysis?.proximos_passos && analysis.proximos_passos.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><ChevronRight className="h-4 w-4 text-emerald-500" /> Próximos Passos</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {analysis.proximos_passos.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-emerald-500 shrink-0 mt-0.5">→</span>
                          <span>{s}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {analysis?.riscos && analysis.riscos.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Riscos</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {analysis.riscos.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {analysis?.checklist_documentos && analysis.checklist_documentos.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CheckSquare className="h-4 w-4 text-blue-500" /> Checklist de Documentos</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {analysis.checklist_documentos.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="h-3.5 w-3.5 shrink-0" readOnly />
                          <span>{d}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Strategy */}
            {analysis?.estrategia_inicial && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /> Estratégia Inicial</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed">{analysis.estrategia_inicial}</p></CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Parties ──────────────────────────────────────────────────── */}
          <TabsContent value="parties" className="space-y-4 mt-4">
            {parties.length === 0 && lawyers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma parte registrada</p>
            ) : (
              <>
                {parties.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Partes do Processo</CardTitle></CardHeader>
                    <CardContent className="divide-y">
                      {parties.map(p => (
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
                {lawyers.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Advogados</CardTitle></CardHeader>
                    <CardContent className="divide-y">
                      {lawyers.map(l => (
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
              </>
            )}
          </TabsContent>

          {/* ── Movements ────────────────────────────────────────────────── */}
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
                          <div className={`absolute left-1.5 top-2 h-3 w-3 rounded-full border-2 ${m.is_important ? 'border-primary bg-primary' : 'border-border bg-background'}`} />
                          <div className="py-2">
                            <p className="font-medium text-sm leading-snug">{m.title}</p>
                            {m.movement_date && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(m.movement_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            )}
                            {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Timeline ─────────────────────────────────────────────────── */}
          <TabsContent value="timeline" className="mt-4">
            {analysis?.linha_do_tempo && analysis.linha_do_tempo.length > 0 ? (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Linha do Tempo — IA</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4 relative before:absolute before:left-2.5 before:top-0 before:bottom-0 before:w-px before:bg-border/60">
                    {analysis.linha_do_tempo.map((item, i) => (
                      <div key={i} className="pl-8 relative">
                        <div className="absolute left-0 top-1 h-5 w-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-primary">{i + 1}</span>
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground">{item.data}</p>
                        <p className="text-sm mt-0.5">{item.evento}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <ChevronRight className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm font-semibold">Linha do tempo não disponível</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Gere a análise completa com IA para ver a linha do tempo</p>
                  <Button size="sm" onClick={runFullAnalysis} disabled={aiLoading === 'full_analysis'} className="gap-2">
                    {aiLoading === 'full_analysis' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Gerar Análise Completa
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── AI ───────────────────────────────────────────────────────── */}
          <TabsContent value="ai" className="space-y-4 mt-4">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" disabled={!!aiLoading}
                onClick={() => runAi('summary', () => generateCaseSummary(caseDataForAi))}>
                {aiLoading === 'summary' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Gerar Resumo
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={!!aiLoading}
                onClick={() => runAi('strategy', () => generateCaseStrategy(caseDataForAi, analysis))}>
                {aiLoading === 'strategy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />}
                Gerar Estratégia
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={!!aiLoading}
                onClick={() => runAi('questions', () => generateClientQuestions(caseDataForAi))}>
                {aiLoading === 'questions' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                Perguntas para Cliente
              </Button>
              <Button size="sm" className="gap-1.5" disabled={!!aiLoading}
                onClick={runFullAnalysis}>
                {aiLoading === 'full_analysis' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                Análise Completa
              </Button>
            </div>

            {/* Active AI output */}
            {activeAiText && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Resultado da IA</CardTitle>
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

            {/* Past outputs */}
            {aiOutputs.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">Histórico de outputs ({aiOutputs.length})</p>
                {aiOutputs.slice(0, 5).map(out => (
                  <Card key={out.id} className="border-border/60">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{out.output_type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(out.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyText(out.content)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground line-clamp-3">{out.content.slice(0, 300)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Notes ────────────────────────────────────────────────────── */}
          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Anotações do Caso</CardTitle>
                  <Button size="sm" onClick={saveNotes} className="h-7 text-xs gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5" /> Salvar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações internas sobre o caso, estratégias, observações, lembretes…"
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
