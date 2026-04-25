// Página /business-intelligence — espelha o /managementV2 do ADVBox
// 5 abas: Produtividade | Estoque | Tempo & Honorários | Custos | Safra
// Todos os dados vêm da edge function bi-aggregates (read-only).
import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Award, AlertTriangle, Clock, DollarSign,
  Briefcase, Target, Users, Activity, RefreshCw,
} from "lucide-react";

// Paleta oficial das fases ADVBox (mesma do edge function)
const STAGE_COLORS = {
  prospeccao: "hsl(262, 83%, 58%)",
  producao: "hsl(217, 91%, 60%)",
  execucao: "hsl(160, 84%, 39%)",
  rotacao: "hsl(38, 92%, 50%)",
};

// Formatadores
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
const fmtCurr = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

interface BIData {
  produtividade: any;
  estoque: any;
  tempo: any;
  custos: any;
  safra: any;
  advogados_disponiveis: string[];
  meta: any;
}

export default function BusinessIntelligence() {
  const [data, setData] = useState<BIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState("mes");
  const [advogado, setAdvogado] = useState("todos");

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const { data: result, error } = await supabase.functions.invoke("bi-aggregates", {
        body: null,
        method: "GET" as any,
        headers: {} as any,
      });
      // Edge function lê via query string — refazemos via fetch direto
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bi-aggregates?periodo=${periodo}&advogado=${encodeURIComponent(advogado)}`;
      const session = await supabase.auth.getSession();
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      console.error("[BI] erro carregando agregados:", e);
      setErro(e.message || "Falha ao carregar BI");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, advogado]);

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header com filtros */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Business Intelligence</h1>
            <p className="text-muted-foreground">
              Espelho do painel /managementV2 do ADVBox — dados em tempo real
              {data?.meta?.updated_at && (
                <span className="ml-2 text-xs">
                  · atualizado {new Date(data.meta.updated_at).toLocaleString("pt-BR")}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês atual</SelectItem>
                <SelectItem value="trimestre">Último trimestre</SelectItem>
                <SelectItem value="ano">Ano atual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={advogado} onValueChange={setAdvogado}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="todos">Todos advogados</SelectItem>
                {(data?.advogados_disponiveis || []).map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        {erro && (
          <Card className="border-destructive">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium">Erro ao carregar BI</p>
                <p className="text-sm text-muted-foreground">{erro}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="produtividade" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="produtividade">Produtividade</TabsTrigger>
            <TabsTrigger value="estoque">Estoque & Prospecção</TabsTrigger>
            <TabsTrigger value="tempo">Tempo & Honorários</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
            <TabsTrigger value="safra">Safra & Qualidade</TabsTrigger>
          </TabsList>

          {/* ============ ABA 1: PRODUTIVIDADE ============ */}
          <TabsContent value="produtividade" className="space-y-4 mt-6">
            <ProdutividadeTab data={data?.produtividade} loading={loading} />
          </TabsContent>

          {/* ============ ABA 2: ESTOQUE ============ */}
          <TabsContent value="estoque" className="space-y-4 mt-6">
            <EstoqueTab data={data?.estoque} loading={loading} />
          </TabsContent>

          {/* ============ ABA 3: TEMPO E HONORÁRIOS ============ */}
          <TabsContent value="tempo" className="space-y-4 mt-6">
            <TempoTab data={data?.tempo} loading={loading} />
          </TabsContent>

          {/* ============ ABA 4: CUSTOS ============ */}
          <TabsContent value="custos" className="space-y-4 mt-6">
            <CustosTab data={data?.custos} loading={loading} />
          </TabsContent>

          {/* ============ ABA 5: SAFRA ============ */}
          <TabsContent value="safra" className="space-y-4 mt-6">
            <SafraTab data={data?.safra} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// ============= COMPONENTES DE ABA =============

function KpiCard({ icon: Icon, label, value, subtitle, color = "text-primary" }: any) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function ProdutividadeTab({ data, loading }: any) {
  if (loading || !data) return <SkeletonGrid />;
  const { kpis, serie_semanal, advogados, atrasadas } = data;
  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Activity} label="Atividades concluídas" value={fmtNum(kpis.atividades_concluidas)} color="text-blue-500" />
        <KpiCard icon={Award} label="Pontos" value={fmtNum(kpis.pontos)} color="text-amber-500" />
        <KpiCard icon={TrendingUp} label="Ganhos" value={fmtNum(kpis.ganhos)} color="text-emerald-500" />
        <KpiCard icon={TrendingDown} label="Perdas" value={fmtNum(kpis.perdas)} color="text-rose-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart semanal */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Produtividade da semana</CardTitle>
            <CardDescription>Atividades concluídas e pontos nas últimas 7 semanas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={serie_semanal}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="semana" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="concluidas" name="Concluídas" fill={STAGE_COLORS.producao} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pontos" name="Pontos" fill={STAGE_COLORS.execucao} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tarefas atrasadas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tarefas com mais atrasos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {atrasadas.length === 0 && <p className="text-sm text-muted-foreground">Sem atrasos 🎉</p>}
            {atrasadas.map((t: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-2 pb-3 border-b last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.titulo || "Sem título"}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.cliente || t.responsavel}</p>
                </div>
                <Badge variant="destructive">{t.dias_atraso}d</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de advogados */}
      <Card>
        <CardHeader>
          <CardTitle>Desempenho por advogado</CardTitle>
          <CardDescription>Ranking por pontos no período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {advogados.map((a: any) => {
              const taxa = a.tarefas > 0 ? (a.concluidas / a.tarefas) * 100 : 0;
              return (
                <div key={a.nome} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm truncate">{a.nome}</p>
                    <Badge variant="secondary">{fmtNum(a.pontos)} pts</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Tarefas</span>
                      <p className="font-bold">{fmtNum(a.tarefas)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Concluídas</span>
                      <p className="font-bold">{fmtNum(a.concluidas)}</p>
                    </div>
                  </div>
                  <Progress value={taxa} className="h-2" />
                  <p className="text-xs text-muted-foreground">{fmtPct(taxa)} de conclusão</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function EstoqueTab({ data, loading }: any) {
  if (loading || !data) return <SkeletonGrid />;
  const { kpis, fechamentos, areas, evolucao, composicao } = data;
  const totalAtivo = kpis.em_prospeccao + kpis.em_producao + kpis.em_execucao + kpis.em_rotacao;
  return (
    <>
      {/* KPIs por fase com cores oficiais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card style={{ borderTop: `4px solid ${STAGE_COLORS.prospeccao}` }}>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Em prospecção</p>
            <p className="text-3xl font-bold mt-1" style={{ color: STAGE_COLORS.prospeccao }}>{fmtNum(kpis.em_prospeccao)}</p>
          </CardContent>
        </Card>
        <Card style={{ borderTop: `4px solid ${STAGE_COLORS.producao}` }}>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Em produção</p>
            <p className="text-3xl font-bold mt-1" style={{ color: STAGE_COLORS.producao }}>{fmtNum(kpis.em_producao)}</p>
          </CardContent>
        </Card>
        <Card style={{ borderTop: `4px solid ${STAGE_COLORS.execucao}` }}>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Em execução</p>
            <p className="text-3xl font-bold mt-1" style={{ color: STAGE_COLORS.execucao }}>{fmtNum(kpis.em_execucao)}</p>
          </CardContent>
        </Card>
        <Card style={{ borderTop: `4px solid ${STAGE_COLORS.rotacao}` }}>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Em rotação</p>
            <p className="text-3xl font-bold mt-1" style={{ color: STAGE_COLORS.rotacao }}>{fmtNum(kpis.em_rotacao)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distribuição por área */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Distribuição por área do direito</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={areas} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="area" type="category" width={140} className="text-xs" />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="qtd" fill={STAGE_COLORS.producao} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Composição da carteira (donut) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composição da carteira</CardTitle>
            <CardDescription>{fmtNum(totalAtivo)} processos ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={composicao} dataKey="qtd" nameKey="fase" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {composicao.map((c: any, i: number) => <Cell key={i} fill={c.cor} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Evolução */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução do estoque (12 meses)</CardTitle>
          <CardDescription>Novos cadastros vs encerramentos · Fechamentos no período: {fmtNum(fechamentos)}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey="mes" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Line type="monotone" dataKey="novos" stroke={STAGE_COLORS.execucao} strokeWidth={2} name="Novos" />
              <Line type="monotone" dataKey="concluidos" stroke={STAGE_COLORS.rotacao} strokeWidth={2} name="Concluídos" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}

function TempoTab({ data, loading }: any) {
  if (loading || !data) return <SkeletonGrid />;
  const { stages, kpis, por_grupo } = data;
  return (
    <>
      {/* Stage cards horizontais com paleta oficial */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Prospecção", val: stages.prospeccao, color: STAGE_COLORS.prospeccao },
          { label: "Produção", val: stages.producao, color: STAGE_COLORS.producao },
          { label: "Execução", val: stages.execucao, color: STAGE_COLORS.execucao },
          { label: "Rotação", val: stages.rotacao, color: STAGE_COLORS.rotacao },
        ].map((s) => (
          <Card key={s.label} style={{ borderLeft: `4px solid ${s.color}` }}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>
                {s.val.toFixed(1)}m
              </p>
              <p className="text-xs text-muted-foreground">tempo médio</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPIs financeiros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={DollarSign} label="Honorário médio" value={fmtCurr(kpis.honorario_medio)} color="text-emerald-500" />
        <KpiCard icon={Target} label="Honorário/mês" value={fmtCurr(kpis.honorario_mes)} color="text-blue-500" />
        <KpiCard icon={Clock} label="Tempo médio" value={`${kpis.tempo_medio_meses.toFixed(0)}m`} color="text-amber-500" />
      </div>

      {/* Tabela de honorários por grupo */}
      <Card>
        <CardHeader>
          <CardTitle>Duração média e honorários por grupo de ação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Grupo</th>
                  <th className="text-right py-2 px-2">Processos</th>
                  <th className="text-right py-2 px-2">Média (meses)</th>
                  <th className="text-right py-2 px-2">Honorário médio</th>
                  <th className="text-right py-2 px-2">Mensal (R$)</th>
                </tr>
              </thead>
              <tbody>
                {por_grupo.map((g: any) => (
                  <tr key={g.grupo} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{g.grupo}</td>
                    <td className="text-right py-2 px-2">{fmtNum(g.count)}</td>
                    <td className="text-right py-2 px-2">{g.media_meses.toFixed(1)}</td>
                    <td className="text-right py-2 px-2">{fmtCurr(g.media_honorario)}</td>
                    <td className="text-right py-2 px-2">{fmtCurr(g.mensal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function CustosTab({ data, loading }: any) {
  if (loading || !data) return <SkeletonGrid />;
  const { kpis, grupos, total } = data;
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Prospecção", val: kpis.prospeccao, color: STAGE_COLORS.prospeccao },
          { label: "Produção", val: kpis.producao, color: STAGE_COLORS.producao },
          { label: "Execução", val: kpis.execucao, color: STAGE_COLORS.execucao },
          { label: "Rotação", val: kpis.rotacao, color: STAGE_COLORS.rotacao },
          { label: "Custo/Ponto", val: kpis.custo_por_ponto, color: "hsl(var(--primary))" },
        ].map((s) => (
          <Card key={s.label} style={{ borderTop: `4px solid ${s.color}` }}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: s.color }}>{fmtCurr(s.val)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custos por categoria</CardTitle>
          <CardDescription>Total no período: {fmtCurr(total)}</CardDescription>
        </CardHeader>
        <CardContent>
          {grupos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sem despesas registradas no período
            </p>
          ) : (
            <div className="space-y-3">
              {grupos.map((g: any) => {
                const pct = total > 0 ? (g.valor / total) * 100 : 0;
                return (
                  <div key={g.grupo}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{g.grupo}</span>
                      <span className="text-sm">{fmtCurr(g.valor)} <span className="text-muted-foreground">({fmtPct(pct)})</span></span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function SafraTab({ data, loading }: any) {
  if (loading || !data) return <SkeletonGrid />;
  const { areas, anuais } = data;
  return (
    <>
      {/* Mini-donuts por área (top 4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {areas.slice(0, 4).map((a: any) => (
          <Card key={a.area}>
            <CardContent className="p-4 text-center">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Ganhos", value: a.ganhos, fill: STAGE_COLORS.execucao },
                      { name: "Perdas", value: a.perdas, fill: "hsl(var(--destructive))" },
                      { name: "Em curso", value: a.total - a.ganhos - a.perdas, fill: "hsl(var(--muted))" },
                    ]}
                    dataKey="value" innerRadius={30} outerRadius={50}
                  >
                    {[STAGE_COLORS.execucao, "hsl(var(--destructive))", "hsl(var(--muted))"].map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <p className="text-xs font-semibold mt-2 truncate" title={a.area}>{a.area}</p>
              <p className="text-xs text-muted-foreground">
                {fmtPct(a.percentual_ganho)} · {a.ganhos} ganhos
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela de safras anuais */}
      <Card>
        <CardHeader>
          <CardTitle>Safras anuais</CardTitle>
          <CardDescription>Cadastros, andamento e desfechos por ano</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Ano</th>
                  <th className="text-right py-2 px-2">Cadastros</th>
                  <th className="text-right py-2 px-2">Em produção</th>
                  <th className="text-right py-2 px-2">Em execução</th>
                  <th className="text-right py-2 px-2">Concluídos</th>
                  <th className="text-right py-2 px-2">Ganhos</th>
                  <th className="text-right py-2 px-2">Perdas</th>
                  <th className="text-right py-2 px-2">Ganho %</th>
                </tr>
              </thead>
              <tbody>
                {anuais.map((s: any) => {
                  const pct = s.concluidos > 0 ? (s.ganhos / s.concluidos) * 100 : 0;
                  return (
                    <tr key={s.ano} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-bold">{s.ano}</td>
                      <td className="text-right py-2 px-2">{fmtNum(s.fechamentos)}</td>
                      <td className="text-right py-2 px-2">{fmtNum(s.em_producao)}</td>
                      <td className="text-right py-2 px-2">{fmtNum(s.em_execucao)}</td>
                      <td className="text-right py-2 px-2">{fmtNum(s.concluidos)}</td>
                      <td className="text-right py-2 px-2 text-success">{fmtNum(s.ganhos)}</td>
                      <td className="text-right py-2 px-2 text-destructive">{fmtNum(s.perdas)}</td>
                      <td className="text-right py-2 px-2">
                        <Badge variant={pct >= 50 ? "default" : "secondary"}>{fmtPct(pct)}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-64" />
    </div>
  );
}
