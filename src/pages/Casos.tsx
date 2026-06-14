import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Plus, Loader2, FolderOpen, Edit, Trash2, Search,
  Scale, User, Hash, Calendar, Download, Bot,
  ArrowRight, Gavel, FileSearch,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { searchProcessByNumber } from '@/services/datajudService';
import { analyzeCase } from '@/services/caseAiService';
import { parseProcessNumber } from '@/config/datajud';
import type { DatajudProcess } from '@/services/datajudService';

interface Caso {
  id: string;
  nome: string;
  cliente: string;
  numero_processo: string | null;
  area_juridica: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  court?: string | null;
  court_name?: string | null;
  case_class?: string | null;
  subject?: string | null;
  last_movement?: string | null;
  summary?: string | null;
  import_source?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo', aguardando: 'Aguardando',
  arquivado: 'Arquivado', encerrado: 'Encerrado',
  imported: 'Importado',
};
const STATUS_COLORS: Record<string, string> = {
  ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  aguardando: 'bg-amber-100 text-amber-700 border-amber-200',
  arquivado: 'bg-slate-100 text-slate-600 border-slate-200',
  encerrado: 'bg-red-100 text-red-700 border-red-200',
  imported: 'bg-blue-100 text-blue-700 border-blue-200',
};
const AREAS = [
  'Cível', 'Criminal', 'Trabalhista', 'Previdenciário', 'Tributário',
  'Família', 'Imobiliário', 'Empresarial', 'Administrativo', 'Constitucional',
  'Tribunal do Júri', 'Consumidor', 'Bancário', 'Saúde', 'Licitações', 'Outro',
];
const EMPTY_FORM = { nome: '', cliente: '', numero_processo: '', area_juridica: '', status: 'ativo', observacoes: '' };
const FILTER_TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'imported', label: 'Importados' },
  { value: 'ativo', label: 'Em andamento' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'encerrado', label: 'Encerrados' },
  { value: 'arquivado', label: 'Arquivados' },
];

export default function Casos() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCaso, setEditingCaso] = useState<Caso | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [importOpen, setImportOpen] = useState(false);
  const [importNumber, setImportNumber] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<DatajudProcess | null>(null);
  const [importClientName, setImportClientName] = useState('');
  const [importAnalyzing, setImportAnalyzing] = useState(false);
  const [newCaseOpen, setNewCaseOpen] = useState(false);

  useEffect(() => { loadCasos(); }, []);

  const loadCasos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('casos')
      .select('id, nome, cliente, numero_processo, area_juridica, status, observacoes, created_at, updated_at, court, court_name, case_class, subject, last_movement, summary, import_source')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Casos] loadCasos error:', error);
      toast.error(`Erro ao carregar casos: ${error.message}`);
      setLoading(false);
      return;
    }
    setCasos((data || []) as Caso[]);
    setLoading(false);
  };

  const openNew = () => { setEditingCaso(null); setForm(EMPTY_FORM); setNewCaseOpen(false); setDialogOpen(true); };

  const openEdit = (caso: Caso, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCaso(caso);
    setForm({ nome: caso.nome, cliente: caso.cliente, numero_processo: caso.numero_processo || '', area_juridica: caso.area_juridica || '', status: caso.status, observacoes: caso.observacoes || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.cliente.trim()) { toast.error('Nome e cliente são obrigatórios'); return; }
    setSaving(true);
    const payload = { nome: form.nome.trim(), cliente: form.cliente.trim(), numero_processo: form.numero_processo.trim() || null, area_juridica: form.area_juridica || null, status: form.status, observacoes: form.observacoes.trim() || null };
    if (editingCaso) {
      const { error } = await supabase.from('casos').update(payload).eq('id', editingCaso.id);
      if (error) { toast.error('Erro ao atualizar caso'); setSaving(false); return; }
      toast.success('Caso atualizado');
    } else {
      const { error } = await supabase.from('casos').insert({ ...payload, user_id: user!.id, import_source: 'manual' });
      if (error) { toast.error('Erro ao criar caso'); setSaving(false); return; }
      toast.success('Caso criado');
    }
    setSaving(false); setDialogOpen(false); loadCasos();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from('casos').delete().eq('id', deletingId);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Caso excluído'); loadCasos(); }
    setDeletingId(null);
  };

  const handleSearch = async () => {
    if (!importNumber.trim()) { toast.error('Informe o número do processo'); return; }
    setImportLoading(true); setImportPreview(null);
    const result = await searchProcessByNumber(importNumber.trim());
    setImportLoading(false);
    if (!result.found || !result.process) {
      toast.error(result.error || 'Processo não encontrado');
      return;
    }
    setImportPreview(result.process);
    toast.success('Processo encontrado!');
  };

  const guessArea = (p: DatajudProcess): string => {
    const text = [p.classe?.nome, ...(p.assuntos?.map(a => a.nome) ?? [])].join(' ').toLowerCase();
    if (text.includes('trabalh')) return 'Trabalhista';
    if (text.includes('previdenc') || text.includes('inss')) return 'Previdenciário';
    if (text.includes('famil') || text.includes('aliment')) return 'Família';
    if (text.includes('tribut') || text.includes('fiscal')) return 'Tributário';
    if (text.includes('criminal') || text.includes('penal')) return 'Criminal';
    if (text.includes('consumid')) return 'Consumidor';
    if (text.includes('empresar') || text.includes('falênc')) return 'Empresarial';
    return 'Cível';
  };

  const guessClientName = (p: DatajudProcess): string => {
    const parte = p.partes?.find(pt => (pt.tipoParte || '').toLowerCase().includes('réu') || (pt.tipoParte || '').toLowerCase().includes('reclamad'));
    const autor = p.partes?.find(pt => (pt.tipoParte || '').toLowerCase().includes('autor') || (pt.tipoParte || '').toLowerCase().includes('reclamant'));
    return parte?.nome || autor?.nome || '';
  };

  const handleImport = async () => {
    if (!importPreview || !user) return;
    setImportAnalyzing(true);
    try {
      const p = importPreview;
      const area = guessArea(p);
      const lastMov = p.movimentos?.[0];
      const lastMovText = lastMov
        ? `${lastMov.dataHora ? new Date(lastMov.dataHora).toLocaleDateString('pt-BR') : ''} — ${lastMov.nome || ''}`.trim()
        : null;
      const parsedDate = p.dataAjuizamento ? new Date(p.dataAjuizamento) : null;

      const { data: existing } = await supabase.from('casos').select('id').eq('numero_processo', p.numeroProcesso).maybeSingle();
      if (existing) {
        toast.error('Este processo já foi importado. Abra o caso e use "Atualizar pelo DataJud".');
        setImportAnalyzing(false);
        return;
      }

      const clientName = importClientName.trim() || guessClientName(p) || 'Cliente não identificado';

      // Limit raw data so JSONB stays manageable
      const rawForStorage: Record<string, unknown> = p._raw
        ? {
            ...(p._raw as Record<string, unknown>),
            movimentos: Array.isArray((p._raw as Record<string, unknown[]>).movimentos)
              ? ((p._raw as Record<string, unknown[]>).movimentos as unknown[]).slice(0, 30)
              : [],
          }
        : {};

      const payload = {
        user_id: user.id,
        nome: `${p.classe?.nome || 'Processo'} — ${clientName}`,
        cliente: clientName,
        numero_processo: p.numeroProcesso,
        area_juridica: area,
        status: 'imported',
        court: p.tribunal ?? null,
        court_name: p.orgaoJulgador?.nome ?? null,
        case_class: p.classe?.nome ?? null,
        subject: p.assuntos?.map(a => a.nome).filter(Boolean).join(', ') || null,
        jurisdiction_body: p.orgaoJulgador?.nome ?? null,
        degree: p.grau ?? null,
        distribution_date: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().split('T')[0] : null,
        claim_value: p.valorCausa ?? null,
        last_movement: lastMovText,
        import_source: 'datajud',
        datajud_raw: rawForStorage,
      };

      const { data: caseData, error: caseErr } = await supabase.from('casos').insert(payload).select().single();

      if (caseErr || !caseData) {
        // Format Supabase error properly (it's not always an Error instance)
        const msg = caseErr
          ? caseErr.message || (caseErr as unknown as { details?: string }).details || JSON.stringify(caseErr)
          : 'Caso não foi criado. Verifique as permissões do banco.';
        throw new Error(msg);
      }

      // Insert parties and lawyers (errors are non-fatal — logged but don't stop import)
      if (p.partes && p.partes.length > 0) {
        const { error: partiesErr } = await supabase.from('case_parties').insert(
          p.partes.map(pt => ({
            case_id: caseData.id,
            user_id: user.id,
            name: pt.nome || 'Parte',           // NOT NULL — always provide a value
            type: pt.tipoParte ?? null,
            raw_data: (pt as unknown as Record<string, unknown>),
          }))
        );
        if (partiesErr) console.warn('[Import] case_parties insert error:', partiesErr.message);

        const lawyers = p.partes.flatMap(pt =>
          (pt.advogados || []).map(adv => ({
            case_id: caseData.id,
            user_id: user.id,
            name: adv.nome || 'Advogado',       // NOT NULL — always provide a value
            oab: adv.numeroOAB ?? null,
            party_name: pt.nome ?? null,
            raw_data: (adv as unknown as Record<string, unknown>),
          }))
        );
        if (lawyers.length > 0) {
          const { error: lawyersErr } = await supabase.from('case_lawyers').insert(lawyers);
          if (lawyersErr) console.warn('[Import] case_lawyers insert error:', lawyersErr.message);
        }
      }

      // Insert movements (non-fatal)
      if (p.movimentos && p.movimentos.length > 0) {
        const { error: movErr } = await supabase.from('case_movements').insert(
          p.movimentos.slice(0, 100).map(m => ({
            case_id: caseData.id,
            user_id: user.id,
            movement_date: m.dataHora || null,
            title: m.nome || 'Movimentação',
            description: m.complementosTabelados?.[0]?.descricao || null,
            raw_data: (m as unknown as Record<string, unknown>),
          }))
        );
        if (movErr) console.warn('[Import] case_movements insert error:', movErr.message);
      }

      // ── Close modal and navigate IMMEDIATELY — don't wait for AI ──────────
      setImportOpen(false);
      setImportPreview(null);
      setImportNumber('');
      setImportClientName('');
      setImportAnalyzing(false);
      toast.success('Caso importado! Gerando análise de IA em segundo plano…');
      loadCasos();
      navigate(`/casos/${caseData.id}`);

      // ── Run AI analysis asynchronously (fire-and-forget) ─────────────────
      analyzeCase(p, 'gemini-flash', clientName)
        .then(async (analysis) => {
          await supabase.from('casos').update({
            summary: analysis.resumo_executivo,
            ai_analysis: analysis as unknown as Record<string, unknown>,
            area_juridica: area || analysis.area_direito,
            current_phase: analysis.fase_atual,
          }).eq('id', caseData.id);
          await supabase.from('case_ai_outputs').insert({
            case_id: caseData.id,
            user_id: user.id,
            output_type: 'full_analysis',
            content: JSON.stringify(analysis),
            metadata: { model: 'gemini-flash', generated_at: new Date().toISOString() },
          });
          toast.success('Análise de IA concluída! Recarregue o caso para ver.');
        })
        .catch((aiErr) => {
          console.warn('[Import] AI analysis failed (non-fatal):', aiErr);
          toast.warning('Análise de IA não gerada. Você pode gerá-la dentro do caso.');
        });

      return; // already cleared setImportAnalyzing above
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
      toast.error(`Erro ao importar: ${message}`);
    }
    setImportAnalyzing(false);
  };

  const filtered = casos.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search || c.nome.toLowerCase().includes(q) || c.cliente.toLowerCase().includes(q) || (c.numero_processo || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-2xl font-bold">Casos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerencie os processos jurídicos do escritório</p>
          </div>
          <Button onClick={() => setNewCaseOpen(true)} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Novo Caso
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(tab => (
            <button key={tab.value} onClick={() => setFilterStatus(tab.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${filterStatus === tab.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {tab.label}
              {tab.value !== 'todos' && <span className="ml-1.5 text-xs opacity-70">{casos.filter(c => c.status === tab.value).length}</span>}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, cliente ou nº do processo…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <FolderOpen className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{casos.length === 0 ? 'Nenhum caso cadastrado' : 'Nenhum caso encontrado'}</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-sm">
                {casos.length === 0 ? 'Importe pelo número do processo ou crie manualmente.' : 'Ajuste os filtros ou a busca.'}
              </p>
              {casos.length === 0 && <Button onClick={() => setNewCaseOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Criar Primeiro Caso</Button>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(caso => (
              <Card key={caso.id} className="group cursor-pointer border-t-4 border-t-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200" onClick={() => navigate(`/casos/${caso.id}`)}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[15px] truncate group-hover:text-primary transition-colors">{caso.nome}</h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <User className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{caso.cliente}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[11px] flex-shrink-0 border ${STATUS_COLORS[caso.status] || ''}`}>
                      {STATUS_LABELS[caso.status] || caso.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    {caso.numero_processo && <div className="flex items-center gap-1.5 text-muted-foreground"><Hash className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate font-mono text-xs">{caso.numero_processo}</span></div>}
                    {caso.area_juridica && <div className="flex items-center gap-1.5 text-muted-foreground"><Scale className="h-3.5 w-3.5 flex-shrink-0" /><span>{caso.area_juridica}</span></div>}
                    {caso.court_name && <div className="flex items-center gap-1.5 text-muted-foreground"><Gavel className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate text-xs">{caso.court_name}</span></div>}
                    <div className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="h-3.5 w-3.5 flex-shrink-0" /><span className="text-xs">{format(new Date(caso.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span></div>
                  </div>
                  {caso.summary && <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 rounded p-2">{caso.summary}</p>}
                  {caso.import_source === 'datajud' && <Badge variant="secondary" className="text-[10px] gap-1"><Download className="h-3 w-3" /> DataJud</Badge>}
                  <div className="flex gap-2 pt-1 border-t border-border/50" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="flex-1 gap-1.5 text-xs" onClick={() => navigate(`/casos/${caso.id}`)}><ArrowRight className="h-3.5 w-3.5" /> Ver caso</Button>
                    <Button variant="ghost" size="sm" onClick={e => openEdit(caso, e)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={e => { e.stopPropagation(); setDeletingId(caso.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Mode selector */}
      <Dialog open={newCaseOpen} onOpenChange={setNewCaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Caso</DialogTitle><DialogDescription>Como deseja criar o caso?</DialogDescription></DialogHeader>
          <div className="grid gap-3 py-2">
            <button className="flex items-start gap-4 rounded-xl border-2 border-primary/20 bg-primary/5 p-4 text-left hover:border-primary/50 transition-all" onClick={() => { setNewCaseOpen(false); setImportOpen(true); }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 flex-shrink-0"><FileSearch className="h-5 w-5 text-primary" /></div>
              <div><p className="font-semibold text-sm">Importar pelo número do processo</p><p className="text-xs text-muted-foreground mt-0.5">Busca no DataJud e monta o caso completo com IA automaticamente</p></div>
            </button>
            <button className="flex items-start gap-4 rounded-xl border-2 border-border bg-muted/30 p-4 text-left hover:border-primary/30 transition-all" onClick={openNew}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0"><FolderOpen className="h-5 w-5 text-muted-foreground" /></div>
              <div><p className="font-semibold text-sm">Criar manualmente</p><p className="text-xs text-muted-foreground mt-0.5">Preencha os dados sem consultar o DataJud</p></div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DataJud import modal */}
      <Dialog open={importOpen} onOpenChange={o => { if (!o) { setImportPreview(null); setImportNumber(''); setImportClientName(''); } setImportOpen(o); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSearch className="h-5 w-5 text-primary" /> Importar do DataJud</DialogTitle>
            <DialogDescription>Informe o número CNJ para buscar automaticamente os dados do processo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Número do Processo (CNJ)</Label>
                <Input placeholder="0000000-00.0000.0.00.0000" value={importNumber} onChange={e => { setImportNumber(e.target.value); setImportPreview(null); }} className="font-mono" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                <p className="text-xs text-muted-foreground">Exemplo: 0801234-56.2026.8.10.0082</p>
              </div>
              <div className="pt-6">
                <Button onClick={handleSearch} disabled={importLoading || !importNumber.trim()} className="gap-2">
                  {importLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
                </Button>
              </div>
            </div>

            {importNumber.trim() && (() => {
              const parsed = parseProcessNumber(importNumber.trim());
              if (!parsed) return <p className="text-xs text-destructive">⚠️ Formato inválido. Use: NNNNNNN-DD.AAAA.J.TT.OOOO</p>;
              if (!parsed.index) return <p className="text-xs text-amber-600">⚠️ Tribunal não mapeado (J={parsed.j}, TT={parsed.tt}).</p>;
              return <p className="text-xs text-emerald-600">✓ Válido — endpoint: {parsed.index}</p>;
            })()}

            {importPreview && (
              <div className="space-y-4 border rounded-xl p-4 bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <p className="text-sm font-semibold">Processo encontrado</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { l: 'Número', v: importPreview.numeroProcesso },
                    { l: 'Tribunal', v: importPreview.tribunal },
                    { l: 'Classe', v: importPreview.classe?.nome },
                    { l: 'Grau', v: importPreview.grau },
                    { l: 'Órgão', v: importPreview.orgaoJulgador?.nome },
                    { l: 'Distribuição', v: importPreview.dataAjuizamento ? new Date(importPreview.dataAjuizamento).toLocaleDateString('pt-BR') : undefined },
                    { l: 'Valor', v: importPreview.valorCausa ? `R$ ${importPreview.valorCausa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : undefined },
                    { l: 'Situação', v: importPreview.situacao },
                  ].filter(x => x.v).map(({ l, v }) => (
                    <div key={l}><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium text-sm truncate">{v}</p></div>
                  ))}
                </div>
                {importPreview.assuntos?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Assuntos</p>
                    <div className="flex flex-wrap gap-1">{importPreview.assuntos.map((a, i) => <Badge key={i} variant="secondary" className="text-xs">{a.nome}</Badge>)}</div>
                  </div>
                )}
                {importPreview.partes?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Partes ({importPreview.partes.length})</p>
                    {importPreview.partes.slice(0, 4).map((pt, i) => (
                      <p key={i} className="text-xs"><span className="text-muted-foreground">{pt.tipoParte}: </span><span className="font-medium">{pt.nome}</span></p>
                    ))}
                    {importPreview.partes.length > 4 && <p className="text-xs text-muted-foreground">+{importPreview.partes.length - 4} partes</p>}
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Movimentações: {importPreview.movimentos?.length ?? 0} registros</p>
                  {importPreview.movimentos?.[0] && (
                    <p className="text-xs mt-0.5"><span className="text-muted-foreground">Última: </span>{importPreview.movimentos[0].dataHora ? new Date(importPreview.movimentos[0].dataHora).toLocaleDateString('pt-BR') : ''} — {importPreview.movimentos[0].nome}</p>
                  )}
                </div>
                <div className="space-y-1.5 pt-2 border-t">
                  <Label>Nome do Cliente no escritório (opcional)</Label>
                  <Input placeholder="Ex: João da Silva" value={importClientName} onChange={e => setImportClientName(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Se não informar, usaremos o nome encontrado nas partes.</p>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-3">
                  <Bot className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">A IA irá montar automaticamente: resumo, linha do tempo, riscos, próximos passos e estratégia inicial.</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importAnalyzing}>Cancelar</Button>
            {importPreview && (
              <Button onClick={handleImport} disabled={importAnalyzing} className="gap-2">
                {importAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando + IA…</> : <><Download className="h-4 w-4" /> Importar e Analisar</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual create/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingCaso ? 'Editar Caso' : 'Novo Caso'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2"><Label>Nome do caso *</Label><Input placeholder="Ex: Defesa Criminal – João Silva" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Cliente *</Label><Input placeholder="Nome do cliente" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Nº do processo</Label><Input placeholder="0000000-00.0000.0.00.0000" value={form.numero_processo} onChange={e => setForm(f => ({ ...f, numero_processo: e.target.value }))} className="font-mono" /></div>
              <div className="space-y-1.5"><Label>Área jurídica</Label>
                <Select value={form.area_juridica} onValueChange={v => setForm(f => ({ ...f, area_juridica: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).filter(([k]) => k !== 'imported').map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea placeholder="Informações relevantes…" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nome.trim() || !form.cliente.trim()} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}{editingCaso ? 'Salvar' : 'Criar caso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={o => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir caso?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
