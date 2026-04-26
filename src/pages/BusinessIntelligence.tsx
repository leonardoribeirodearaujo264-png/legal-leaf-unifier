// =====================================================================
// /business-intelligence — espelha /managementV2 do ADVBox
// 5 abas: Produtividade | Estoque & Prospecção | Tempo & Honorários | Custos | Safra & Qualidade
// Filtros globais: Classificar por | Período (mês específico) | Advogados (multiselect)
// Dados reais via edge function bi-aggregates (read-only).
// =====================================================================
import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, Clock, DollarSign,
  Briefcase, Users, RefreshCw, ChevronDown, CheckCircle2, Calendar,
} from "lucide-react";

// Paleta oficial ADVBox (HSL via tailwind tokens)
const STAGE_COLORS = {
  prospeccao: "hsl(262, 83%, 58%)",
  producao: "hsl(217, 91%, 60%)",
  execucao: "hsl(160, 84%, 39%)",
  rotacao: "hsl(38, 92%, 50%)",
};

// Formatadores
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n || 0));
const fmtCurr = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;
const fmtMeses = (n: number) => `${(n || 0).toFixed(n < 10 ? 1 : 0)}m`;

// Iniciais para avatar
function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// Mês YYYY-MM -> "Abr/2026"
function labelMes(yyyymm: string) {
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) return yyyymm;
  const [y, m] = yyyymm.split("-").map(Number);
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[m - 1]}/${y}`;
}

interface BIData {
  produtividade: any;
  estoque: any;
  tempo: any;
  custos: any;
  safra: any;
  advogados_disponiveis: string[];
  meses_disponiveis: string[];
  meta: any;
}

export default function BusinessIntelligence() {
  const [data, setData] = useState<BIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Filtros globais
  const hojeMes = useMemo(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [mes, setMes] = useState<string>(hojeMes);
  const [sortBy, setSortBy] = useState<string>("pontos");
  const [advogadosSelecionados, setAdvogadosSelecionados] = useState<string[]>([]); // [] = todos

  // Carrega dados
  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setErro(null);
      try {
        // Busca uma vez por advogado selecionado e mescla? Não: o backend aceita 1 advogado.
        // Para multiselect, fazemos múltiplas chamadas e mesclamos quando for >1.
        // Para simplificar e respeitar a edge function existente, enviamos "todos" quando lista vazia,
        // o nome direto quando 1 selecionado, e fazemos chamadas paralelas + merge quando >1.
        const params = new URLSearchParams();
        params.set("mes", mes);
        params.set("sort_by", sortBy);

        const fazer = (adv: string) => {
          const p = new URLSearchParams(params);
          p.set("advogado", adv);
          return supabase.functions.invoke(`bi-aggregates?${p.toString()}`, { method: "GET" });
        };

        let resp: any;
        if (advogadosSelecionados.length <= 1) {
          const advParam = advogadosSelecionados[0] || "todos";
          resp = await fazer(advParam);
        } else {
          // Multi: chama N vezes e soma os agregados principais (KPIs).
          // OBS: Para gráficos complexos, usa o primeiro como base e soma KPIs comuns.
          const todas = await Promise.all(advogadosSelecionados.map(fazer));
          const base = todas[0]?.data;
          if (base) {
            // Soma KPIs de produtividade
            for (let i = 1; i < todas.length; i++) {
              const d = todas[i]?.data;
              if (!d) continue;
              base.produtividade.kpis.atribuidas += d.produtividade.kpis.atribuidas;
              base.produtividade.kpis.concluidas += d.produtividade.kpis.concluidas;
              base.produtividade.kpis.atrasadas += d.produtividade.kpis.atrasadas;
              base.produtividade.kpis.prazo_fatal_5d += d.produtividade.kpis.prazo_fatal_5d;
              // Acumula advogados (lista única)
              base.produtividade.advogados = [
                ...base.produtividade.advogados,
                ...d.produtividade.advogados.filter(
                  (a: any) => !base.produtividade.advogados.find((x: any) => x.nome === a.nome)
                ),
              ];
            }
            base.produtividade.progresso_mes.atribuidas = base.produtividade.kpis.atribuidas;
            base.produtividade.progresso_mes.concluidas = base.produtividade.kpis.concluidas;
            base.produtividade.progresso_mes.percentual =
              base.produtividade.kpis.atribuidas > 0
                ? (base.produtividade.kpis.concluidas / base.produtividade.kpis.atribuidas) * 100
                : 0;
          }
          resp = { data: base, error: todas.find((t) => t.error)?.error };
        }

        if (cancel) return;
        if (resp.error) throw resp.error;
        setData(resp.data);
      } catch (e: any) {
        if (cancel) return;
        console.error("[BI] erro carregando:", e);
        setErro(e.message || "Erro ao carregar Business Intelligence");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, [mes, sortBy, advogadosSelecionados]);

  const atualizadoEm = useMemo(() => {
    if (!data?.meta?.gerado_em) return "";
    const d = new Date(data.meta.gerado_em);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }, [data]);

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Business Intelligence</h1>
              <p className="text-sm text-muted-foreground">
                Indicadores espelhados do ADVBox — leitura em tempo real do cache local
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMes((m) => m)}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Recarregar
            </Button>
          </div>

          {/* Filtros globais */}
          <div className="flex flex-wrap items-center gap-3 mt-2 p-3 rounded-lg bg-muted/40 border">
            {/* Classificar por */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Classificar por:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pontos">Pontuação</SelectItem>
                  <SelectItem value="atividades">Atividades</SelectItem>
                  <SelectItem value="tempo">Tempo</SelectItem>
                  <SelectItem value="honorarios">Honorários</SelectItem>
                  <SelectItem value="custos">Custos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Período (mês específico) */}
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Período:</span>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder={labelMes(mes)} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(data?.meses_disponiveis || [hojeMes]).map((m) => (
                    <SelectItem key={m} value={m}>{labelMes(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Advogados (multiselect) */}
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Advogados:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 min-w-[160px] justify-between">
                    <span className="truncate">
                      {advogadosSelecionados.length === 0
                        ? "Todos"
                        : advogadosSelecionados.length === 1
                          ? advogadosSelecionados[0]
                          : `${advogadosSelecionados.length} selecionados`}
                    </span>
                    <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <ScrollArea className="h-[300px]">
                    <div className="p-2 space-y-1">
                      <button
                        type="button"
                        className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent"
                        onClick={() => setAdvogadosSelecionados([])}
                      >
                        Limpar seleção (Todos)
                      </button>
                      {(data?.advogados_disponiveis || []).map((a) => {
                        const checked = advogadosSelecionados.includes(a);
                        return (
                          <label
                            key={a}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                if (c) setAdvogadosSelecionados([...advogadosSelecionados, a]);
                                else setAdvogadosSelecionados(advogadosSelecionados.filter((x) => x !== a));
                              }}
                            />
                            <span className="truncate">{a}</span>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            {/* Atualizado em */}
            {atualizadoEm && (
              <div className="ml-auto text-xs text-muted-foreground">
                Atualizado em {atualizadoEm}
              </div>
            )}
          </div>
        </div>

        {erro && (
          <Card className="border-destructive">
            <CardContent className="p-4 flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              {erro}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="produtividade" className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full h-auto">
            <TabsTrigger value="produtividade">Produtividade</TabsTrigger>
            <TabsTrigger value="estoque">Estoque & Prospecção</TabsTrigger>
            <TabsTrigger value="tempo">Tempo & Honorários</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
            <TabsTrigger value="safra">Safra & Qualidade</TabsTrigger>
          </TabsList>

          {/* ============= ABA 1 — PRODUTIVIDADE ============= */}
          <TabsContent value="produtividade" className="space-y-4">
            <AtualizadoEm valor={atualizadoEm} />
            {loading ? <SkeletonGrid /> : data && (
              <ProdutividadeTab data={data.produtividade} />
            )}
          </TabsContent>

          {/* ============= ABA 2 — ESTOQUE & PROSPECÇÃO ============= */}
          <TabsContent value="estoque" className="space-y-4">
            <AtualizadoEm valor={atualizadoEm} />
            {loading ? <SkeletonGrid /> : data && (
              <EstoqueTab data={data.estoque} />
            )}
          </TabsContent>

          {/* ============= ABA 3 — TEMPO & HONORÁRIOS ============= */}
          <TabsContent value="tempo" className="space-y-4">
            <AtualizadoEm valor={atualizadoEm} />
            {loading ? <SkeletonGrid /> : data && (
              <TempoTab data={data.tempo} />
            )}
          </TabsContent>

          {/* ============= ABA 4 — CUSTOS ============= */}
          <TabsContent value="custos" className="space-y-4">
            <AtualizadoEm valor={atualizadoEm} />
            {loading ? <SkeletonGrid /> : data && (
              <CustosTab data={data.custos} />
            )}
          </TabsContent>

          {/* ============= ABA 5 — SAFRA & QUALIDADE ============= */}
          <TabsContent value="safra" className="space-y-4">
            <AtualizadoEm valor={atualizadoEm} />
            {loading ? <SkeletonGrid /> : data && (
              <SafraTab data={data.safra} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// ============================================================
// Helpers visuais
// ============================================================
function AtualizadoEm({ valor }: { valor: string }) {
  if (!valor) return null;
  return (
    <div className="text-xs text-muted-foreground flex items-center gap-1">
      <Clock className="h-3 w-3" />
      Atualizado em {valor}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
      <Skeleton className="h-72 col-span-full" />
    </div>
  );
}

function KpiCard({
  titulo, valor, sub, icon: Icon, accent, delta,
}: { titulo: string; valor: string | number; sub?: string; icon?: any; accent?: "default" | "destructive" | "warning" | "success"; delta?: number }) {
  const accentClass = {
    default: "text-foreground",
    destructive: "text-destructive",
    warning: "text-amber-600 dark:text-amber-500",
    success: "text-emerald-600 dark:text-emerald-500",
  }[accent || "default"];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{titulo}</p>
            <p className={`text-3xl font-bold ${accentClass}`}>{valor}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            {typeof delta === "number" && delta !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
                {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {delta > 0 ? "+" : ""}{delta.toFixed(0)}% vs mês anterior
              </div>
            )}
          </div>
          {Icon && <Icon className={`h-5 w-5 ${accentClass} opacity-50`} />}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// ABA 1 — PRODUTIVIDADE
// ============================================================
function ProdutividadeTab({ data }: { data: any }) {
  const k = data?.kpis || {};
  const prog = data?.progresso_mes || {};
  return (
    <div className="space-y-4">
      {/* 4 KPIs ADVBox */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard titulo="Tarefas atribuídas" valor={fmtNum(k.atribuidas)} icon={Briefcase} />
        <KpiCard titulo="Tarefas concluídas" valor={fmtNum(k.concluidas)} icon={CheckCircle2} accent="success" />
        <KpiCard titulo="Atrasadas" valor={fmtNum(k.atrasadas)} icon={AlertTriangle} accent="destructive" />
        <KpiCard titulo="Prazo fatal (5 dias)" valor={fmtNum(k.prazo_fatal_5d)} icon={Clock} accent="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progresso do mês + série semanal */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Tarefas atribuídas e concluídas nesta semana</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.semana_serie || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="dia" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="atribuidas" name="Atribuídas" fill={STAGE_COLORS.producao} radius={[4, 4, 0, 0]} />
                <Bar dataKey="concluidas" name="Concluídas" fill={STAGE_COLORS.execucao} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progresso do mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-4xl font-bold">{fmtPct(prog.percentual || 0)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Conclusão</p>
            </div>
            <Progress value={prog.percentual || 0} className="h-3" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{fmtNum(prog.concluidas)}</span>
              <span className="font-medium">/ {fmtNum(prog.atribuidas)} TAREFAS</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarefas com mais atrasos por TIPO + Atividades recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Tarefas com mais atrasos (por tipo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.atrasadas_por_tipo || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem atrasadas no período</p>
            ) : (
              <div className="space-y-2">
                {data.atrasadas_por_tipo.map((t: any) => (
                  <div key={t.tipo} className="flex items-center justify-between p-2 rounded bg-muted/40">
                    <span className="text-sm truncate">{t.tipo}</span>
                    <Badge variant="destructive">{t.qtd}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.recentes || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem atividades concluídas no período</p>
            ) : (
              <div className="space-y-2">
                {data.recentes.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/40">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.titulo || "Sem título"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.responsavel} {r.cliente ? `• ${r.cliente}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cards por advogado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desempenho por advogado</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.advogados || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum advogado com tarefas no período</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.advogados.map((a: any) => (
                <Card key={a.nome} className="border-l-4" style={{ borderLeftColor: STAGE_COLORS.producao }}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{iniciais(a.nome)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{a.nome}</p>
                        <p className="text-xs text-muted-foreground">Advogado(a)</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Pontos</p>
                        <p className="text-sm font-bold">{fmtNum(a.pontos)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Concluídas</p>
                        <p className="text-sm font-bold text-emerald-600">{fmtNum(a.concluidas)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Atrasadas</p>
                        <p className="text-sm font-bold text-destructive">{fmtNum(a.atrasadas)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">% Concl.</p>
                        <p className="text-sm font-bold">{fmtPct(a.taxa_conclusao)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                      Média: {a.media_pontos.toFixed(1)} pts
                      {a.primeira ? ` • Desde ${new Date(a.primeira).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// ABA 2 — ESTOQUE & PROSPECÇÃO
// ============================================================
function EstoqueTab({ data }: { data: any }) {
  const k = data?.kpis || {};
  const r = data?.resumo_carteira || {};
  return (
    <div className="space-y-4">
      {/* 4 KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          titulo="Oportunidades do mês"
          valor={fmtNum(k.oportunidades_mes)}
          icon={TrendingUp}
          delta={k.oportunidades_delta}
        />
        <KpiCard titulo="Processos ativos" valor={fmtNum(k.processos_ativos)} icon={Briefcase} />
        <KpiCard titulo="Processos arquivados" valor={fmtNum(k.processos_arquivados)} />
        <KpiCard
          titulo="+120 dias parados"
          valor={fmtNum(k.processos_120_parados)}
          icon={AlertTriangle}
          accent="warning"
        />
      </div>

      {/* Resumo da carteira */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo da carteira</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniCarteira
              label="Fechamentos do mês"
              valor={fmtNum(r.fechamentos?.valor)}
              delta={r.fechamentos?.delta}
              cor={STAGE_COLORS.execucao}
            />
            <MiniCarteira
              label="Em atendimento"
              valor={`${fmtPct(r.em_atendimento?.percentual)} / ${fmtNum(r.em_atendimento?.valor)}`}
              cor={STAGE_COLORS.prospeccao}
            />
            <MiniCarteira
              label="Em produção"
              valor={`${fmtPct(r.em_producao?.percentual)} / ${fmtNum(r.em_producao?.valor)}`}
              cor={STAGE_COLORS.producao}
            />
            <MiniCarteira
              label="Em execução"
              valor={`${fmtPct(r.em_execucao?.percentual)} / ${fmtNum(r.em_execucao?.valor)}`}
              cor={STAGE_COLORS.execucao}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Por grupo de ação */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Oportunidades e fechamentos por grupo de ação</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.por_grupo_acao || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.por_grupo_acao} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" />
                  <YAxis dataKey="grupo" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="oportunidades" name="Oportunidades" fill={STAGE_COLORS.prospeccao} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="fechamentos" name="Fechamentos" fill={STAGE_COLORS.execucao} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut taxa de conversão */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Taxa de conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-[260px]">
              <div className="relative">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Convertidos", value: data?.taxa_conversao || 0 },
                        { name: "Restante", value: Math.max(0, 100 - (data?.taxa_conversao || 0)) },
                      ]}
                      innerRadius={55}
                      outerRadius={80}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                    >
                      <Cell fill={STAGE_COLORS.execucao} />
                      <Cell fill="hsl(var(--muted))" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold">{fmtPct(data?.taxa_conversao || 0)}</p>
                  <p className="text-xs text-muted-foreground">TOTAL</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Por período (linha temporal) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Oportunidades e fechamentos por período (12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.por_periodo || []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="mes" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="novos" name="Novos" stroke={STAGE_COLORS.prospeccao} strokeWidth={2} />
              <Line type="monotone" dataKey="concluidos" name="Concluídos" stroke={STAGE_COLORS.execucao} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distribuição por área do direito */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição por área do direito</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.areas || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.areas} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" />
                <YAxis dataKey="area" type="category" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qtd" name="Processos" fill={STAGE_COLORS.producao} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniCarteira({ label, valor, delta, cor }: { label: string; valor: string; delta?: number; cor: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/40 border-l-4" style={{ borderLeftColor: cor }}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-1">{valor}</p>
      {typeof delta === "number" && delta !== 0 && (
        <div className={`flex items-center gap-1 text-xs mt-1 ${delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta > 0 ? "+" : ""}{delta.toFixed(0)}%
        </div>
      )}
    </div>
  );
}

// ============================================================
// ABA 3 — TEMPO & HONORÁRIOS
// ============================================================
function TempoTab({ data }: { data: any }) {
  const stages = data?.stages || {};
  const k = data?.kpis || {};
  // Rotação: alinhada com ADVBox que exibe "X turns/ano". Mantém meses como secundário.
  const turnsAno = data?.rotacao_turns_ano ?? (stages.rotacao > 0 ? 12 / stages.rotacao : null);
  return (
    <div className="space-y-4">
      {/* Tempo médio por estágio (em meses) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard titulo="Prospecção" valor={fmtMeses(stages.prospeccao)} sub="tempo médio" />
        <KpiCard titulo="Produção" valor={fmtMeses(stages.producao)} sub="tempo médio" />
        <KpiCard titulo="Execução" valor={fmtMeses(stages.execucao)} sub="tempo médio" />
        <KpiCard
          titulo="Rotação"
          valor={turnsAno != null ? `${turnsAno.toFixed(1)} turns/ano` : "—"}
          sub={stages.rotacao ? `${fmtMeses(stages.rotacao)} por turn` : "tempo médio"}
        />
      </div>

      {/* KPIs financeiros (média) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          titulo="Honorário médio"
          valor={fmtCurr(k.honorario_medio)}
          icon={DollarSign}
          accent="success"
          sub="por processo"
        />
        <KpiCard
          titulo="Honorário / mês"
          valor={fmtCurr(k.honorario_mes)}
          icon={DollarSign}
          sub="receita média mensal por processo"
        />
        <KpiCard
          titulo="Tempo médio total"
          valor={fmtMeses(k.tempo_medio_meses)}
          icon={Clock}
          sub="ciclo completo"
        />
      </div>

      {/* Por grupo de ação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Duração média e honorários por grupo de ação</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.por_grupo || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem dados (mínimo 5 processos por grupo)</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Grupo</th>
                    <th className="p-2 text-right">Processos</th>
                    <th className="p-2 text-right">Tempo médio</th>
                    <th className="p-2 text-right">Honorário médio</th>
                    <th className="p-2 text-right">Mensal médio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.por_grupo.map((g: any) => (
                    <tr key={g.grupo} className="border-b hover:bg-muted/40">
                      <td className="p-2 font-medium">{g.grupo}</td>
                      <td className="p-2 text-right">{fmtNum(g.count)}</td>
                      <td className="p-2 text-right">{fmtMeses(g.media_meses)}</td>
                      <td className="p-2 text-right">{fmtCurr(g.media_honorario)}</td>
                      <td className="p-2 text-right">{fmtCurr(g.mensal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// ABA 4 — CUSTOS
// ============================================================
function CustosTab({ data }: { data: any }) {
  const k = data?.kpis || {};
  return (
    <div className="space-y-4">
      {/* 4 KPIs por estágio + custo/ponto */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard titulo="Prospecção" valor={fmtCurr(k.prospeccao)} sub="custo médio" />
        <KpiCard titulo="Produção" valor={fmtCurr(k.producao)} sub="custo médio" />
        <KpiCard titulo="Execução" valor={fmtCurr(k.execucao)} sub="custo médio" />
        <KpiCard titulo="Rotação" valor={fmtCurr(k.rotacao)} sub="custo médio" />
        <KpiCard titulo="Custo / ponto" valor={fmtCurr(k.custo_por_ponto)} accent="warning" />
      </div>

      {/* Custos por categoria/grupo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custos por categoria</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.grupos || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem despesas pagas no período</p>
          ) : (
            <div className="space-y-2">
              {data.grupos.map((g: any) => (
                <div key={g.grupo} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{g.grupo}</span>
                    <span className="text-muted-foreground">
                      {fmtCurr(g.valor)} <span className="text-xs">({fmtPct(g.percentual)})</span>
                    </span>
                  </div>
                  <Progress value={g.percentual} className="h-2" />
                </div>
              ))}
              <div className="pt-2 mt-2 border-t flex justify-between text-sm font-bold">
                <span>Total do mês</span>
                <span>{fmtCurr(data.total)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// ABA 5 — SAFRA & QUALIDADE
// ============================================================
function SafraTab({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {/* Top 4 áreas por % vitória */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wide">
          Top 4 áreas por taxa de vitória
        </h3>
        <p className="text-xs text-muted-foreground mb-3 italic">
          Critério: arquivado com fees_money &gt; 0 = ganho (ajustar quando ADVBox confirmar campo nativo de outcome).
        </p>
        {(data?.areas || []).length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Sem áreas com volume mínimo (≥ 5 processos fechados)
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.areas.map((a: any, i: number) => (
              <Card key={a.area}>
                <CardContent className="p-4 text-center">
                  <div className="relative mx-auto mb-2" style={{ width: 100, height: 100 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { value: a.percentual_ganho },
                            { value: 100 - a.percentual_ganho },
                          ]}
                          innerRadius={32}
                          outerRadius={45}
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                        >
                          <Cell fill={STAGE_COLORS.execucao} />
                          <Cell fill="hsl(var(--muted))" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold">{Math.round(a.percentual_ganho)}%</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold truncate">{a.area}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fmtNum(a.ganhos)} ganhos / {fmtNum(a.fechados)} fechados
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtNum(a.total)} processos no total</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Tabela Safras anuais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Safras anuais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Ano</th>
                  <th className="p-2 text-right">Distribuídos</th>
                  <th className="p-2 text-right">Em produção</th>
                  <th className="p-2 text-right">Em execução</th>
                  <th className="p-2 text-right">Concluídos</th>
                  <th className="p-2 text-right">Ganhos</th>
                  <th className="p-2 text-right">Perdas</th>
                  <th className="p-2 text-right">% Ganho</th>
                </tr>
              </thead>
              <tbody>
                {(data?.anuais || []).map((s: any) => (
                  <tr key={s.ano} className="border-b hover:bg-muted/40">
                    <td className="p-2 font-medium">{s.ano}</td>
                    <td className="p-2 text-right">{fmtNum(s.fechamentos)}</td>
                    <td className="p-2 text-right">{fmtNum(s.em_producao)}</td>
                    <td className="p-2 text-right">{fmtNum(s.em_execucao)}</td>
                    <td className="p-2 text-right">{fmtNum(s.concluidos)}</td>
                    <td className="p-2 text-right text-emerald-600">{fmtNum(s.ganhos)}</td>
                    <td className="p-2 text-right text-destructive">{fmtNum(s.perdas)}</td>
                    <td className="p-2 text-right font-medium">{fmtPct(s.pct_ganho)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
