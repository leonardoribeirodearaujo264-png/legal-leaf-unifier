import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Search, Loader2, Copy, Download, CheckCircle2, XCircle,
  AlertTriangle, Bug, RefreshCw,
} from 'lucide-react';
import { searchProcessByNumber } from '@/services/datajudService';
import { parseProcessNumber } from '@/config/datajud';

// ── Field presence check ────────────────────────────────────────────────────

function hasField(obj: unknown, key: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (key in (obj as Record<string, unknown>)) return true;
  return Object.values(obj as Record<string, unknown>).some(v => hasField(v, key));
}

function countField(obj: unknown, key: string): number {
  if (!obj || typeof obj !== 'object') return 0;
  let count = 0;
  if (Array.isArray(obj)) {
    for (const item of obj) count += countField(item, key);
  } else {
    const rec = obj as Record<string, unknown>;
    if (key in rec) count += Array.isArray(rec[key]) ? (rec[key] as unknown[]).length : 1;
    for (const v of Object.values(rec)) count += countField(v, key);
  }
  return count;
}

// ── Highlight JSON keyword matches ──────────────────────────────────────────

function highlightJson(json: string, keyword: string): string {
  if (!keyword.trim()) return json;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return json.replace(new RegExp(`(${escaped})`, 'gi'), '<mark style="background:#fde047;color:#000">$1</mark>');
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DebugDatajud() {
  const [cnj, setCnj] = useState('');
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<Record<string, unknown> | null>(null);
  const [processData, setProcessData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');

  const parsedCnj = useMemo(() => cnj.trim() ? parseProcessNumber(cnj.trim()) : null, [cnj]);

  const handleSearch = async () => {
    const num = cnj.trim();
    if (!num) { toast.error('Informe o número CNJ'); return; }
    setLoading(true);
    setRawData(null);
    setProcessData(null);
    setError(null);

    const result = await searchProcessByNumber(num);
    setLoading(false);

    if (!result.found || !result.process) {
      setError(result.error || 'Processo não encontrado no DataJud');
      return;
    }

    setProcessData(result.process);
    setRawData((result.process._raw as Record<string, unknown>) ?? result.process as unknown as Record<string, unknown>);
    toast.success('DataJud respondeu com sucesso');
  };

  const jsonStr = rawData ? JSON.stringify(rawData, null, 2) : '';
  const processStr = processData ? JSON.stringify(processData, null, 2) : '';

  const copyJson = (str: string) => {
    navigator.clipboard.writeText(str);
    toast.success('JSON copiado para a área de transferência');
  };

  const downloadJson = (str: string, filename: string) => {
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download iniciado');
  };

  // Field analysis
  const analysis = useMemo(() => {
    if (!rawData) return null;
    const proc = processData as Record<string, unknown> | null;
    return {
      partes:          hasField(rawData, 'partes'),
      advogados:       hasField(rawData, 'advogados'),
      representantes:  hasField(rawData, 'representantes'),
      documentos:      hasField(rawData, 'documentos'),
      polo:            hasField(rawData, 'polo') || hasField(rawData, 'poloAtivo') || hasField(rawData, 'poloPassivo'),
      cpf:             hasField(rawData, 'cpf') || hasField(rawData, 'documento') || hasField(rawData, 'numeroCPF'),
      cnpj:            hasField(rawData, 'cnpj') || hasField(rawData, 'numeroCNPJ'),
      partesCount:     countField(rawData, 'partes'),
      movimentacoes:   proc ? (Array.isArray((proc as Record<string, unknown>).movimentos) ? ((proc as Record<string, unknown>).movimentos as unknown[]).length : 0) : 0,
      topLevelKeys:    Object.keys(rawData),
      jsonSize:        new Blob([jsonStr]).size,
    };
  }, [rawData, processData, jsonStr]);

  const highlightedJson = useMemo(() => highlightJson(jsonStr, keyword), [jsonStr, keyword]);
  const highlightedProcess = useMemo(() => highlightJson(processStr, keyword), [processStr, keyword]);

  const StatusRow = ({ label, value }: { label: string; value: boolean | string | number }) => (
    <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {typeof value === 'boolean' ? (
        value
          ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Sim</span>
          : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="h-3.5 w-3.5" /> Não</span>
      ) : (
        <span className="text-xs font-mono font-semibold">{value}</span>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b pb-5">
          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Bug className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Debug DataJud
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">ADMIN</Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Visualize o JSON bruto retornado pela API do DataJud/CNJ</p>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label>Número CNJ do Processo</Label>
                <Input
                  value={cnj}
                  onChange={e => setCnj(e.target.value)}
                  placeholder="0000000-00.0000.0.00.0000"
                  className="font-mono"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                {cnj.trim() && (
                  <p className={`text-xs ${parsedCnj?.index ? 'text-emerald-600' : parsedCnj ? 'text-amber-600' : 'text-red-500'}`}>
                    {parsedCnj?.index
                      ? `✓ Tribunal: ${parsedCnj.index} (J=${parsedCnj.j}, TT=${parsedCnj.tt})`
                      : parsedCnj
                      ? `⚠ Tribunal não mapeado (J=${parsedCnj.j}, TT=${parsedCnj.tt})`
                      : '✗ Formato CNJ inválido — use: NNNNNNN-DD.AAAA.J.TT.OOOO'}
                  </p>
                )}
              </div>
              <div className="pt-6">
                <Button onClick={handleSearch} disabled={loading || !cnj.trim()} className="gap-2 w-full sm:w-auto">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Consultar DataJud
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Esta tela exibe o JSON <strong>sem qualquer filtragem ou processamento</strong>. Nenhum dado é salvo no banco.
                Use para entender a estrutura real retornada pelo DataJud e ajustar os parsers.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">Erro na consulta</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {rawData && analysis && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Campos Encontrados</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <StatusRow label="Campo partes[]" value={analysis.partes} />
                  <StatusRow label="Campo advogados[]" value={analysis.advogados} />
                  <StatusRow label="Campo representantes[]" value={analysis.representantes} />
                  <StatusRow label="Campo documentos[]" value={analysis.documentos} />
                  <StatusRow label="Campo polo / poloAtivo / poloPassivo" value={analysis.polo} />
                  <StatusRow label="Campo CPF / documento" value={analysis.cpf} />
                  <StatusRow label="Campo CNPJ" value={analysis.cnpj} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Métricas</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <StatusRow label="Movimentações (parsed)" value={analysis.movimentacoes} />
                  <StatusRow label="Contagem partes (raw)" value={analysis.partesCount} />
                  <StatusRow label="Tamanho JSON bruto" value={`${(analysis.jsonSize / 1024).toFixed(1)} KB`} />
                  <div className="py-1.5">
                    <p className="text-xs text-muted-foreground mb-1">Campos de nível raiz (raw):</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.topLevelKeys.map(k => (
                        <Badge key={k} variant="secondary" className="text-[10px] font-mono">{k}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Keyword search */}
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-2 items-center">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    placeholder="Buscar no JSON… (partes, polo, advogado, OAB, cpf, cnpj…)"
                    className="h-8 text-sm"
                  />
                  {keyword && (
                    <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0" onClick={() => setKeyword('')}>
                      <RefreshCw className="h-3.5 w-3.5" /> Limpar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Raw JSON */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">JSON Bruto (DataJud raw)</CardTitle>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => copyJson(jsonStr)}>
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => downloadJson(jsonStr, `datajud-raw-${cnj.trim()}.json`)}>
                      <Download className="h-3 w-3" /> Baixar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="bg-muted rounded-lg p-4 overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre"
                  dangerouslySetInnerHTML={{ __html: highlightedJson }}
                />
              </CardContent>
            </Card>

            {/* Parsed/normalized JSON */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">JSON Normalizado (após edge function)</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">O que chega no frontend após a normalização do servidor</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => copyJson(processStr)}>
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => downloadJson(processStr, `datajud-normalized-${cnj.trim()}.json`)}>
                      <Download className="h-3 w-3" /> Baixar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="bg-muted rounded-lg p-4 overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre"
                  dangerouslySetInnerHTML={{ __html: highlightedProcess }}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
