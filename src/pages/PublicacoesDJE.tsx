import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { FunctionRegion } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Search, Download, Eye, EyeOff, FileText, RefreshCw, Globe, ChevronDown, Filter } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Publicacao {
  id: string;
  numero_processo: string;
  tribunal: string;
  tipo_comunicacao: string;
  data_disponibilizacao: string | null;
  data_publicacao: string | null;
  conteudo: string;
  destinatario: string;
  meio: string;
  nome_advogado: string;
  numero_comunicacao: string;
  siglaTribunal: string;
  lida: boolean;
  raw_data?: any;
  created_at?: string;
}

const CACHE_KEY = 'publicacoes_dje_cache';
const CACHE_TOTAL_KEY = 'publicacoes_dje_total';

const TRIBUNAIS = [
  { value: '', label: 'Todos' },
  { value: 'TJSP', label: 'TJSP - São Paulo' },
  { value: 'TJRJ', label: 'TJRJ - Rio de Janeiro' },
  { value: 'TJMG', label: 'TJMG - Minas Gerais' },
  { value: 'TJRS', label: 'TJRS - Rio Grande do Sul' },
  { value: 'TJPR', label: 'TJPR - Paraná' },
  { value: 'TJSC', label: 'TJSC - Santa Catarina' },
  { value: 'TJBA', label: 'TJBA - Bahia' },
  { value: 'TJPE', label: 'TJPE - Pernambuco' },
  { value: 'TJCE', label: 'TJCE - Ceará' },
  { value: 'TJGO', label: 'TJGO - Goiás' },
  { value: 'TJDF', label: 'TJDF - Distrito Federal' },
  { value: 'TJES', label: 'TJES - Espírito Santo' },
  { value: 'TJMA', label: 'TJMA - Maranhão' },
  { value: 'TJPA', label: 'TJPA - Pará' },
  { value: 'TJMT', label: 'TJMT - Mato Grosso' },
  { value: 'TJMS', label: 'TJMS - Mato Grosso do Sul' },
  { value: 'TJPB', label: 'TJPB - Paraíba' },
  { value: 'TJRN', label: 'TJRN - Rio Grande do Norte' },
  { value: 'TJAL', label: 'TJAL - Alagoas' },
  { value: 'TJSE', label: 'TJSE - Sergipe' },
  { value: 'TJPI', label: 'TJPI - Piauí' },
  { value: 'TJTO', label: 'TJTO - Tocantins' },
  { value: 'TJAC', label: 'TJAC - Acre' },
  { value: 'TJAM', label: 'TJAM - Amazonas' },
  { value: 'TJRO', label: 'TJRO - Rondônia' },
  { value: 'TJRR', label: 'TJRR - Roraima' },
  { value: 'TJAP', label: 'TJAP - Amapá' },
  { value: 'TRF1', label: 'TRF1 - 1ª Região' },
  { value: 'TRF2', label: 'TRF2 - 2ª Região' },
  { value: 'TRF3', label: 'TRF3 - 3ª Região' },
  { value: 'TRF4', label: 'TRF4 - 4ª Região' },
  { value: 'TRF5', label: 'TRF5 - 5ª Região' },
  { value: 'TRF6', label: 'TRF6 - 6ª Região' },
  { value: 'TST', label: 'TST - Tribunal Superior do Trabalho' },
  { value: 'STJ', label: 'STJ - Superior Tribunal de Justiça' },
  { value: 'STF', label: 'STF - Supremo Tribunal Federal' },
];

const TIPOS_COMUNICACAO = [
  { value: '', label: 'Todos' },
  { value: 'CI', label: 'Citação' },
  { value: 'IN', label: 'Intimação' },
  { value: 'NT', label: 'Notificação' },
];

export default function PublicacoesDJE() {
  const [loading, setLoading] = useState(false);
  const [refreshingInBackground, setRefreshingInBackground] = useState(false);
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [totalCount, setTotalCount] = useState(() => {
    try {
      return parseInt(localStorage.getItem(CACHE_TOTAL_KEY) || '0', 10);
    } catch { return 0; }
  });
  const [selectedPub, setSelectedPub] = useState<Publicacao | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filtros de busca (server-side)
  const [numeroOAB, setNumeroOAB] = useState('118395');
  const [ufOAB, setUfOAB] = useState('MG');
  const [nomeAdvogado, setNomeAdvogado] = useState('Rafael Egg Nunes');
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [tribunal, setTribunal] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoComunicacao, setTipoComunicacao] = useState('');

  // Filtros de resultados (client-side)
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroLeitura, setFiltroLeitura] = useState<'todas' | 'lidas' | 'nao_lidas'>('todas');
  const [filtroPeriodo, setFiltroPeriodo] = useState<'todos' | '7' | '30' | '90' | 'dia' | 'custom'>('todos');
  const [filtroDataDia, setFiltroDataDia] = useState('');
  const [filtroDataCustomInicio, setFiltroDataCustomInicio] = useState('');
  const [filtroDataCustomFim, setFiltroDataCustomFim] = useState('');
  const [filtroAdvogado, setFiltroAdvogado] = useState('todos');
  const [filtroFonte, setFiltroFonte] = useState<'todas' | 'DataJud' | 'ComunicaPJe'>('todas');
  const [ordenacao, setOrdenacao] = useState<'recente' | 'antigo' | 'tribunal'>('recente');

  // Extract unique attorney names for filter
  const advogadosUnicos = useMemo(() => {
    const nomes = new Set<string>();
    publicacoes.forEach(p => {
      if (p.nome_advogado) nomes.add(p.nome_advogado);
    });
    return Array.from(nomes).sort();
  }, [publicacoes]);

  useEffect(() => {
    // If we have cached data, just refresh in background
    if (publicacoes.length > 0) {
      setRefreshingInBackground(true);
      loadLocal({}, 1).finally(() => setRefreshingInBackground(false));
    } else {
      setLoading(true);
      loadLocal({}, 1).finally(() => setLoading(false));
    }
  }, []);

  const buildFilters = () => {
    const filters: any = {};
    if (numeroOAB) filters.numeroOAB = numeroOAB;
    if (ufOAB) filters.ufOAB = ufOAB;
    if (nomeAdvogado) filters.nomeAdvogado = nomeAdvogado;
    if (numeroProcesso) filters.numeroProcesso = numeroProcesso;
    if (tribunal && tribunal !== 'all') filters.tribunal = tribunal;
    if (dataInicio) filters.dataInicio = dataInicio;
    if (dataFim) filters.dataFim = dataFim;
    if (tipoComunicacao && tipoComunicacao !== 'all') filters.tipoComunicacao = tipoComunicacao;
    return filters;
  };

  const loadLocal = async (filters: any, page: number, append = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('pje-publicacoes', {
        body: { action: 'search-local', filters: { ...filters, page, pageSize: 500 } },
        region: FunctionRegion.SaEast1,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const newData = data?.data || [];
      const newTotal = data?.totalCount || newData.length;
      setTotalCount(newTotal);
      if (append) {
        setPublicacoes(prev => {
          const merged = [...prev, ...newData];
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(merged)); } catch {}
          return merged;
        });
      } else {
        setPublicacoes(newData);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
          localStorage.setItem(CACHE_TOTAL_KEY, String(newTotal));
        } catch {}
      }
      setCurrentPage(page);
    } catch (err: any) {
      console.error('Erro ao carregar publicações locais:', err);
      toast.error('Erro ao carregar publicações: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleSearch = async (source: 'local' | 'api' | 'comunicapje') => {
    setLoading(true);
    try {
      const filters = buildFilters();

      if (source === 'comunicapje') {
        const { data, error } = await supabase.functions.invoke('pje-publicacoes', {
          body: { action: 'search-comunicapje', filters },
          region: FunctionRegion.SaEast1,
        });
        if (error) throw error;
        if (data?.error) {
          toast.error(data.error);
          setLoading(false);
          return;
        }
        const total = data.total || 0;
        const novas = data.novas || 0;
        toast.success(`Comunica PJe: ${total} publicações encontradas, ${novas} novas salvas.`);
        // Enriquecer dados existentes em segundo plano
        try {
          await supabase.functions.invoke('pje-publicacoes', {
            body: { action: 'enrich-existing' },
            region: FunctionRegion.SaEast1,
          });
        } catch (e) {
          console.warn('Erro ao enriquecer registros:', e);
        }
        await loadLocal({}, 1);
      } else if (source === 'api') {
        const { data, error } = await supabase.functions.invoke('pje-publicacoes', {
          body: { action: 'search-api', filters },
          region: FunctionRegion.SaEast1,
        });
        if (error) throw error;
        if (data?.error) {
          toast.error(data.error);
          setLoading(false);
          return;
        }
        const total = data.total || 0;
        const cached = data.cached || 0;
        const processosTotal = data.processos_total || 0;
        toast.success(`${processosTotal} processos consultados no DataJud. ${total} movimentações encontradas, ${cached} novas salvas.`);
        try {
          await supabase.functions.invoke('pje-publicacoes', {
            body: { action: 'enrich-existing' },
            region: FunctionRegion.SaEast1,
          });
        } catch (e) {
          console.warn('Erro ao enriquecer registros:', e);
        }
        await loadLocal({}, 1);
      } else {
        await loadLocal(filters, 1);
      }
    } catch (err: any) {
      toast.error('Erro ao buscar publicações: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadLocal(buildFilters(), currentPage + 1, true);
    } catch (err: any) {
      toast.error('Erro ao carregar mais: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoadingMore(false);
    }
  };

  // Client-side filtering
  const filteredPublicacoes = useMemo(() => {
    let result = [...publicacoes];

    // Text filter
    if (filtroTexto) {
      const termo = filtroTexto.toLowerCase();
      result = result.filter(p =>
        (p.numero_processo || '').toLowerCase().includes(termo) ||
        (p.conteudo || '').toLowerCase().includes(termo) ||
        (p.tribunal || '').toLowerCase().includes(termo) ||
        (p.siglaTribunal || '').toLowerCase().includes(termo) ||
        (p.destinatario || '').toLowerCase().includes(termo) ||
        (p.nome_advogado || '').toLowerCase().includes(termo)
      );
    }

    // Read status filter
    if (filtroLeitura === 'lidas') {
      result = result.filter(p => p.lida);
    } else if (filtroLeitura === 'nao_lidas') {
      result = result.filter(p => !p.lida);
    }

    // Source filter
    if (filtroFonte !== 'todas') {
      result = result.filter(p => p.meio === filtroFonte);
    }

    // Period filter
    if (filtroPeriodo === 'dia' && filtroDataDia) {
      result = result.filter(p => {
        if (!p.data_disponibilizacao) return false;
        return p.data_disponibilizacao.substring(0, 10) === filtroDataDia;
      });
    } else if (filtroPeriodo === 'custom') {
      if (filtroDataCustomInicio) {
        result = result.filter(p => {
          if (!p.data_disponibilizacao) return false;
          return p.data_disponibilizacao.substring(0, 10) >= filtroDataCustomInicio;
        });
      }
      if (filtroDataCustomFim) {
        result = result.filter(p => {
          if (!p.data_disponibilizacao) return false;
          return p.data_disponibilizacao.substring(0, 10) <= filtroDataCustomFim;
        });
      }
    } else if (filtroPeriodo !== 'todos') {
      const dias = parseInt(filtroPeriodo);
      const limite = subDays(new Date(), dias);
      result = result.filter(p => {
        if (!p.data_disponibilizacao) return false;
        return new Date(p.data_disponibilizacao) >= limite;
      });
    }

    // Attorney filter
    if (filtroAdvogado !== 'todos') {
      result = result.filter(p => p.nome_advogado === filtroAdvogado);
    }

    // Sort - use created_at (insertion order = Diário order) instead of data_disponibilizacao
    if (ordenacao === 'recente') {
      result.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } else if (ordenacao === 'antigo') {
      result.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    } else if (ordenacao === 'tribunal') {
      result.sort((a, b) => (a.siglaTribunal || '').localeCompare(b.siglaTribunal || ''));
    }

    return result;
  }, [publicacoes, filtroTexto, filtroLeitura, filtroFonte, filtroPeriodo, filtroDataDia, filtroDataCustomInicio, filtroDataCustomFim, filtroAdvogado, ordenacao]);

  const toggleRead = async (pub: Publicacao) => {
    try {
      const action = pub.lida ? 'mark-unread' : 'mark-read';
      await supabase.functions.invoke('pje-publicacoes', {
        body: { action, publicacaoId: pub.id },
        region: FunctionRegion.SaEast1,
      });
      setPublicacoes(prev =>
        prev.map(p => p.id === pub.id ? { ...p, lida: !p.lida } : p)
      );
    } catch {
      toast.error('Erro ao atualizar status de leitura');
    }
  };

  const exportCSV = () => {
    if (filteredPublicacoes.length === 0) {
      toast.error('Nenhuma publicação para exportar');
      return;
    }
    const headers = ['Processo', 'Tribunal', 'Tipo', 'Data Disponibilização', 'Destinatário', 'Advogado', 'Conteúdo'];
    const rows = filteredPublicacoes.map(p => [
      p.numero_processo,
      p.tribunal || p.siglaTribunal,
      p.tipo_comunicacao,
      p.data_disponibilizacao ? format(new Date(p.data_disponibilizacao), 'dd/MM/yyyy') : '',
      p.destinatario,
      p.nome_advogado,
      (p.conteudo || '').replace(/"/g, '""').substring(0, 500),
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `publicacoes_dje_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado com sucesso');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const tipoBadgeColor = (tipo: string) => {
    switch (tipo?.toUpperCase()) {
      case 'CI': case 'CITAÇÃO': return 'destructive';
      case 'IN': case 'INTIMAÇÃO': return 'default';
      case 'NT': case 'NOTIFICAÇÃO': return 'secondary';
      default: return 'outline';
    }
  };

  const stripHtml = (html: string): string => {
    if (!html) return '-';
    // Decode HTML entities
    const txt = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&Iacute;/gi, 'Í')
      .replace(/&Aacute;/gi, 'Á')
      .replace(/&Eacute;/gi, 'É')
      .replace(/&Oacute;/gi, 'Ó')
      .replace(/&Uacute;/gi, 'Ú')
      .replace(/&Atilde;/gi, 'Ã')
      .replace(/&Otilde;/gi, 'Õ')
      .replace(/&Ccedil;/gi, 'Ç')
      .replace(/&ordm;/gi, 'º')
      .replace(/&ordf;/gi, 'ª')
      .replace(/&#\d+;/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return txt || '-';
  };

  const isHtmlContent = (text: string): boolean => {
    return /<[a-z][\s\S]*>/i.test(text);
  };

  const reconstructContent = (pub: Publicacao): string => {
    const rawMovimento = pub.raw_data?.movimento;
    const rawProcesso = pub.raw_data?.processo;
    if (!rawMovimento) return pub.conteudo || '-';
    const nome = rawMovimento.nome || '';
    const complementos = (rawMovimento.complementosTabelados || [])
      .map((c: any) => {
        const label = (c.descricao || '').replace(/_/g, ' ').trim();
        const valor = (c.nome || '').trim();
        if (label && valor) return `${label}: ${valor}`;
        return label || valor || '';
      })
      .filter(Boolean)
      .join('; ');
    const classe = rawProcesso?.classe?.nome || '';
    return `${nome}${complementos ? ` | ${complementos}` : ''}${classe ? ` | ${classe}` : ''}`;
  };

  const hasMorePages = publicacoes.length < totalCount;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold text-foreground">Publicações DJE</h1>
            <p className="text-muted-foreground">Consulta de movimentações processuais via DataJud e Comunica PJe</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-600 dark:text-emerald-400 dark:border-emerald-400">
              <Globe className="h-3 w-3" /> DataJud
            </Badge>
            <Badge variant="outline" className="gap-1 text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400">
              <Globe className="h-3 w-3" /> Comunica PJe
            </Badge>
          </div>
        </div>

        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                O sistema consulta duas fontes: <strong>DataJud</strong> (movimentações por número de processo) e <strong>Comunica PJe</strong> (publicações por nome do advogado).
                Use os botões abaixo para buscar em cada fonte.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" /> Filtros de Busca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Filtros por Advogado</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Número OAB</Label>
                  <Input placeholder="Ex: 118395" value={numeroOAB} onChange={e => setNumeroOAB(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>UF da OAB</Label>
                  <Input placeholder="Ex: MG" value={ufOAB} onChange={e => setUfOAB(e.target.value.toUpperCase())} maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Advogado</Label>
                  <Input placeholder="Nome completo" value={nomeAdvogado} onChange={e => setNomeAdvogado(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            <div>
              <p className="text-sm font-medium text-foreground mb-3">Filtros Adicionais</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Número do Processo</Label>
                  <Input placeholder="0000000-00.0000.0.00.0000" value={numeroProcesso} onChange={e => setNumeroProcesso(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tribunal</Label>
                  <Select value={tribunal} onValueChange={setTribunal}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tribunal" /></SelectTrigger>
                    <SelectContent>
                      {TRIBUNAIS.map(t => (
                        <SelectItem key={t.value || 'all'} value={t.value || 'all'}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Comunicação</Label>
                  <Select value={tipoComunicacao} onValueChange={setTipoComunicacao}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_COMUNICACAO.map(t => (
                        <SelectItem key={t.value || 'all'} value={t.value || 'all'}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => handleSearch('api')} disabled={loading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Buscar no DataJud
              </Button>
              <Button onClick={() => handleSearch('comunicapje')} disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Buscar no Comunica PJe
              </Button>
              <Button variant="outline" onClick={() => handleSearch('local')} disabled={loading} className="gap-2">
                <Search className="h-4 w-4" />
                Buscar no Cache Local
              </Button>
              <Button variant="outline" onClick={exportCSV} disabled={filteredPublicacoes.length === 0} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    toast.info('Enriquecendo dados existentes...');
                    const { data, error } = await supabase.functions.invoke('pje-publicacoes', {
                      body: { action: 'enrich-existing' },
                      region: FunctionRegion.SaEast1,
                    });
                    if (error) throw error;
                    toast.success(`Dados enriquecidos: ${data?.updated || 0} clientes atualizados, ${data?.conteudo_fixed || 0} conteúdos corrigidos.`);
                    await loadLocal({}, 1);
                  } catch (err: any) {
                    toast.error('Erro ao enriquecer dados: ' + (err.message || 'Erro'));
                  }
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Enriquecer Dados
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resultados
              {totalCount > 0 && (
                <Badge variant="secondary">
                  Exibindo {filteredPublicacoes.length} de {totalCount} publicações
                </Badge>
              )}
              {refreshingInBackground && (
                <Badge variant="outline" className="gap-1 animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Atualizando publicações...
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client-side filters */}
            {publicacoes.length > 0 && (
              <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/50 rounded-lg">
                <Filter className="h-4 w-4 text-muted-foreground mt-1" />
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Buscar por processo, conteúdo, tribunal..."
                    value={filtroTexto}
                    onChange={e => setFiltroTexto(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Select value={filtroLeitura} onValueChange={(v) => setFiltroLeitura(v as any)}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="lidas">Lidas</SelectItem>
                    <SelectItem value="nao_lidas">Não lidas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroPeriodo} onValueChange={(v) => setFiltroPeriodo(v as any)}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todo período</SelectItem>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="dia">Data específica</SelectItem>
                    <SelectItem value="custom">Intervalo customizado</SelectItem>
                  </SelectContent>
                </Select>
                {filtroPeriodo === 'dia' && (
                  <Input
                    type="date"
                    value={filtroDataDia}
                    onChange={e => setFiltroDataDia(e.target.value)}
                    className="w-[160px] h-9"
                  />
                )}
                {filtroPeriodo === 'custom' && (
                  <>
                    <Input
                      type="date"
                      value={filtroDataCustomInicio}
                      onChange={e => setFiltroDataCustomInicio(e.target.value)}
                      className="w-[150px] h-9"
                      placeholder="Início"
                    />
                    <span className="text-muted-foreground text-sm">até</span>
                    <Input
                      type="date"
                      value={filtroDataCustomFim}
                      onChange={e => setFiltroDataCustomFim(e.target.value)}
                      className="w-[150px] h-9"
                      placeholder="Fim"
                    />
                  </>
                )}
                <Select value={filtroFonte} onValueChange={(v) => setFiltroFonte(v as any)}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as fontes</SelectItem>
                    <SelectItem value="DataJud">DataJud</SelectItem>
                    <SelectItem value="ComunicaPJe">Comunica PJe</SelectItem>
                  </SelectContent>
                </Select>
                {advogadosUnicos.length > 1 && (
                  <Select value={filtroAdvogado} onValueChange={setFiltroAdvogado}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Advogado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos advogados</SelectItem>
                      {advogadosUnicos.map(nome => (
                        <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as any)}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recente">Mais recente</SelectItem>
                    <SelectItem value="antigo">Mais antigo</SelectItem>
                    <SelectItem value="tribunal">Por tribunal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : publicacoes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma publicação encontrada no cache local</p>
                <p className="text-sm mt-1">Clique em <strong>"Buscar no DataJud"</strong> para consultar movimentações dos processos cadastrados</p>
              </div>
            ) : filteredPublicacoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma publicação corresponde aos filtros aplicados</p>
                <p className="text-sm mt-1">Tente ajustar os filtros acima</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Movimentação</TableHead>
                        <TableHead>Processo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tribunal</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Conteúdo</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPublicacoes.map(pub => (
                        <TableRow
                          key={pub.id}
                          className={`cursor-pointer ${pub.lida ? 'opacity-60' : ''}`}
                          onClick={() => setSelectedPub(pub)}
                        >
                          <TableCell>
                            {pub.lida ? (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Badge variant="default" className="text-xs">Nova</Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(pub.data_disponibilizacao)}</TableCell>
                          <TableCell className="font-mono text-xs">{pub.numero_processo}</TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm">{pub.destinatario || '-'}</TableCell>
                          <TableCell>{pub.tribunal}</TableCell>
                          <TableCell>
                            <Badge variant={tipoBadgeColor(pub.tipo_comunicacao) as any}>
                              {pub.tipo_comunicacao || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${pub.meio === 'ComunicaPJe' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-emerald-500 text-emerald-600 dark:text-emerald-400'}`}>
                              {pub.meio === 'ComunicaPJe' ? 'PJe' : 'DataJud'}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate text-xs">
                            {pub.meio === 'ComunicaPJe' 
                              ? stripHtml(pub.conteudo || '-').substring(0, 150) 
                              : reconstructContent(pub)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); toggleRead(pub); }}
                              title={pub.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                            >
                              {pub.lida ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Load more */}
                {hasMorePages && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="gap-2"
                    >
                      {loadingMore ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {loadingMore ? 'Carregando...' : `Carregar mais (${publicacoes.length} de ${totalCount})`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedPub} onOpenChange={() => setSelectedPub(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Movimentação</DialogTitle>
            </DialogHeader>
            {selectedPub && (() => {
              const rawProcesso = selectedPub.raw_data?.processo;
              const rawMovimento = selectedPub.raw_data?.movimento;
              const classeNome = rawProcesso?.classe?.nome;
              const orgaoJulgador = rawProcesso?.orgaoJulgador?.nome;
              const assuntos = rawProcesso?.assuntos?.map((a: any) => a.nome).filter(Boolean).join(', ');
              const complementos = rawMovimento?.complementosTabelados?.map(
                (c: any) => {
                  const label = (c.descricao || '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()).trim();
                  const valor = (c.nome || '').trim();
                  if (label && valor) return `${label}: ${valor}`;
                  return label || valor || '';
                }
              ).filter(Boolean);
              const clienteNome = selectedPub.destinatario || selectedPub.raw_data?.cliente;

              return (
                <div className="space-y-4">
                  {/* Processo e Cliente */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Processo</Label>
                      <p className="font-mono text-sm">{selectedPub.numero_processo}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Cliente</Label>
                      <p className="text-sm font-medium">{clienteNome || <span className="text-muted-foreground italic">Não identificado</span>}</p>
                    </div>
                  </div>

                  {/* Classe e Órgão Julgador */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {classeNome && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Classe Processual</Label>
                        <p className="text-sm">{classeNome}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-muted-foreground text-xs">Órgão Julgador / Tribunal</Label>
                      <p className="text-sm">{orgaoJulgador || selectedPub.tribunal}</p>
                    </div>
                  </div>

                  {/* Assuntos */}
                  {assuntos && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Assuntos</Label>
                      <p className="text-sm">{assuntos}</p>
                    </div>
                  )}

                  {/* Tipo, Data e Fonte */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Tipo da Movimentação</Label>
                      <div className="mt-1">
                        <Badge variant={tipoBadgeColor(selectedPub.tipo_comunicacao) as any}>
                          {selectedPub.tipo_comunicacao === 'IN' ? 'Intimação' :
                           selectedPub.tipo_comunicacao === 'CI' ? 'Citação' :
                           selectedPub.tipo_comunicacao === 'NT' ? 'Notificação' :
                           selectedPub.tipo_comunicacao || '-'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Data da Movimentação</Label>
                      <p className="text-sm">{formatDate(selectedPub.data_disponibilizacao)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Advogado Responsável</Label>
                      <p className="text-sm">{selectedPub.nome_advogado || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Fonte</Label>
                      <div className="mt-1">
                        <Badge variant="outline" className={`text-xs ${selectedPub.meio === 'ComunicaPJe' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-emerald-500 text-emerald-600 dark:text-emerald-400'}`}>
                          {selectedPub.meio === 'ComunicaPJe' ? 'Comunica PJe' : 'DataJud'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo da movimentação */}
                   <div>
                     <Label className="text-muted-foreground text-xs">Conteúdo da Movimentação</Label>
                     <div className="mt-2 p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                       {selectedPub.meio === 'ComunicaPJe' 
                         ? (isHtmlContent(selectedPub.conteudo || '') 
                           ? stripHtml(selectedPub.conteudo) 
                           : (selectedPub.conteudo || '-'))
                         : reconstructContent(selectedPub)}
                     </div>
                   </div>

                  {/* Complementos */}
                  {complementos && complementos.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Complementos</Label>
                      <div className="mt-1 space-y-1">
                        {complementos.map((c: string, i: number) => (
                          <p key={i} className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{c}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" onClick={() => toggleRead(selectedPub)}>
                      {selectedPub.lida ? (
                        <><EyeOff className="h-4 w-4 mr-2" /> Marcar como não lida</>
                      ) : (
                        <><Eye className="h-4 w-4 mr-2" /> Marcar como lida</>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
