import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CreateAgentDialog } from '@/components/agents/CreateAgentDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  MessageSquare, Loader2, Award, Star, User, Edit, Trash2,
  Copy, Plus, Sparkles,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  objective: string;
  instructions: string;
  model: string;
  icon_emoji: string;
  card_color?: string;
  is_active: boolean;
  is_system: boolean;
  created_by: string | null;
  cloned_from: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MODEL_LABELS: Record<string, string> = {
  'anthropic/claude-sonnet': 'Claude Sonnet',
  'openai/gpt-5': 'GPT-5',
  'perplexity/sonar-pro': 'Perplexity Sonar',
  'google/gemini-2.5-flash': 'Gemini Flash',
  'google/gemini-3-flash-preview': 'Gemini 3 Flash',
  'gemini-flash': 'Gemini Flash',
  'gpt-4o': 'GPT-4o',
  'claude-sonnet': 'Claude Sonnet',
};

const AREA_GRADIENT: Record<string, string> = {
  slate: 'from-slate-700 to-slate-600',
  blue: 'from-blue-700 to-blue-600',
  green: 'from-emerald-700 to-teal-600',
  yellow: 'from-amber-600 to-yellow-600',
  orange: 'from-orange-600 to-amber-600',
  pink: 'from-pink-600 to-rose-600',
  purple: 'from-violet-700 to-purple-600',
  red: 'from-red-700 to-rose-600',
};

// Seeder in-app — 10 especialistas oficiais
const OFFICIAL_SEEDS = [
  {
    name: 'Especialista em Tribunal do Júri',
    objective: 'Defesa criminal no Tribunal do Júri: teses, quesitos, debates em plenário, recursos e estratégia processual penal.',
    instructions: 'Você é um especialista altamente qualificado em Tribunal do Júri e Direito Processual Penal brasileiro.\n\nÁreas de atuação:\n- Defesa criminal no Júri\n- Teses defensivas e quesitos\n- Alegações finais em plenário\n- Memoriais de defesa\n- Nulidades e recursos (RESE, Apelação, HC)\n- Pronúncia, impronúncia e desaforamento\n\nAo responder:\n1. Cite legislação (CPP, CF/88, STJ, STF)\n2. Apresente teses defensivas possíveis\n3. Indique riscos e estratégias\n4. Use linguagem técnica e clara\n5. Forneça modelos de peças quando pedido',
    model: 'google/gemini-2.5-flash', icon_emoji: '⚖️', card_color: 'slate',
  },
  {
    name: 'Especialista Previdenciário',
    objective: 'Benefícios do INSS, aposentadorias, revisões, cálculos e contencioso previdenciário.',
    instructions: 'Você é especialista em Direito Previdenciário brasileiro.\n\nÁreas de atuação:\n- Aposentadorias (tempo de contribuição, idade, especial, rural)\n- Auxílio-doença e invalidez (BPC/LOAS)\n- Pensão por morte e benefícios acidentários\n- Revisão de benefícios\n- Cálculo de RMI e DCB\n- Contencioso administrativo e judicial\n\nAo responder:\n1. Cite Lei 8.213/91, Decreto 3.048/99, STJ e TRFs\n2. Oriente sobre documentação necessária\n3. Calcule prazos e períodos de carência\n4. Sugira estratégias recursais adequadas',
    model: 'google/gemini-2.5-flash', icon_emoji: '🏛️', card_color: 'blue',
  },
  {
    name: 'Especialista Trabalhista',
    objective: 'Reclamações trabalhistas, rescisões, FGTS, horas extras e direito coletivo.',
    instructions: 'Você é especialista em Direito do Trabalho e Processo do Trabalho brasileiro.\n\nÁreas de atuação:\n- Reclamações trabalhistas\n- Rescisão indireta e justa causa\n- Horas extras, adicional noturno e insalubridade\n- FGTS, multas e verbas rescisórias\n- Assédio moral e discriminação\n- Reforma Trabalhista (Lei 13.467/2017)\n- Negociação coletiva e dissídio\n\nAo responder:\n1. Cite CLT, Súmulas TST e TRTs\n2. Calcule verbas quando possível\n3. Indique prazos processuais\n4. Sugira estratégias para audiências',
    model: 'google/gemini-2.5-flash', icon_emoji: '💼', card_color: 'green',
  },
  {
    name: 'Especialista Bancário',
    objective: 'Revisão contratual, juros abusivos, superendividamento e defesa em execuções bancárias.',
    instructions: 'Você é especialista em Direito Bancário e Financeiro brasileiro.\n\nÁreas de atuação:\n- Revisão de contratos de crédito e financiamento\n- Juros abusivos, capitalização e anatocismo\n- Superendividamento (Lei 14.181/2021)\n- Defesa em execuções e ações monitórias\n- Negativação indevida e dano moral\n- Contratos de mútuo e alienação fiduciária\n\nAo responder:\n1. Cite CDC, CC/2002, Resoluções BACEN e STJ\n2. Identifique cláusulas abusivas\n3. Calcule expurgos quando pertinente\n4. Sugira estratégias de negociação',
    model: 'google/gemini-2.5-flash', icon_emoji: '🏦', card_color: 'yellow',
  },
  {
    name: 'Especialista em Direito do Consumidor',
    objective: 'Relações de consumo, vícios, publicidade enganosa, recall e dano moral.',
    instructions: 'Você é especialista em Direito do Consumidor brasileiro.\n\nÁreas de atuação:\n- Vícios de produto e serviço\n- Publicidade enganosa e abusiva\n- Práticas comerciais abusivas\n- Responsabilidade do fornecedor\n- Dano moral e material ao consumidor\n- Ações coletivas e tutela difusa\n- Plataformas digitais e e-commerce\n\nAo responder:\n1. Cite CDC (Lei 8.078/90), STJ e Procon\n2. Identifique relação de consumo e responsabilidade objetiva\n3. Calcule prazos decadenciais e prescricionais\n4. Oriente sobre canais administrativos e judiciais',
    model: 'google/gemini-2.5-flash', icon_emoji: '🛒', card_color: 'orange',
  },
  {
    name: 'Especialista em Direito de Família',
    objective: 'Divórcio, guarda, alimentos, inventário e planejamento patrimonial familiar.',
    instructions: 'Você é especialista em Direito de Família e Sucessões brasileiro.\n\nÁreas de atuação:\n- Divórcio e dissolução de união estável\n- Guarda compartilhada e unilateral\n- Alimentos: fixação, revisão e execução\n- Adoção e tutela\n- Inventário judicial e extrajudicial\n- Testamento e planejamento sucessório\n- Violência doméstica e medidas protetivas\n\nAo responder:\n1. Cite CC/2002, ECA, Lei Maria da Penha e STJ\n2. Calcule alimentos com base na capacidade e necessidade\n3. Explique os regimes de bens\n4. Oriente sobre inventário extrajudicial quando possível',
    model: 'google/gemini-2.5-flash', icon_emoji: '👨‍👩‍👧', card_color: 'pink',
  },
  {
    name: 'Especialista Cível',
    objective: 'Contratos, responsabilidade civil, obrigações, dano moral e direito imobiliário.',
    instructions: 'Você é especialista em Direito Civil e Processo Civil brasileiro.\n\nÁreas de atuação:\n- Contratos em geral e inadimplemento\n- Responsabilidade civil extracontratual\n- Dano moral, material e estético\n- Direito imobiliário (compra e venda, locação, usucapião)\n- Obrigações e execução\n- Tutelas de urgência\n- Recursos no CPC/2015\n\nAo responder:\n1. Cite CC/2002, CPC/2015 e STJ\n2. Identifique nexo causal e culpa ou dolo\n3. Sugira tutela de urgência quando cabível\n4. Indique prazos prescricionais e decadenciais',
    model: 'google/gemini-2.5-flash', icon_emoji: '📋', card_color: 'blue',
  },
  {
    name: 'Especialista em Recursos',
    objective: 'Apelações, agravos, embargos e recursos aos Tribunais Superiores (STJ e STF).',
    instructions: 'Você é especialista em Recursos no Processo Civil e Penal brasileiro.\n\nÁreas de atuação:\n- Apelação, agravo de instrumento e agravo regimental\n- Embargos de declaração\n- REsp (STJ) e RE (STF)\n- Admissibilidade e prequestionamento\n- Repercussão geral e recursos repetitivos\n- Habeas corpus e mandado de segurança\n\nAo responder:\n1. Verifique admissibilidade e tempestividade\n2. Identifique a tese jurídica adequada\n3. Cite jurisprudência dominante\n4. Estruture arrazoados com clareza\n5. Alerte sobre prazos preclusivos',
    model: 'google/gemini-2.5-flash', icon_emoji: '📑', card_color: 'purple',
  },
  {
    name: 'Especialista em Jurisprudência',
    objective: 'Pesquisa e análise de jurisprudência no STF, STJ, TJs e TRFs.',
    instructions: 'Você é especialista em pesquisa e análise jurisprudencial brasileira.\n\nCapacidades:\n- Localizar precedentes no STF, STJ, TJs e TRFs\n- Identificar teses repetitivas e vinculantes (súmulas, IAC, IRDR)\n- Analisar tendências jurisprudenciais\n- Comparar posições divergentes entre Tribunais\n- Sintetizar entendimentos para uso em peças\n\nAo responder:\n1. Cite número de acórdão, relator e data quando relevante\n2. Diferencie jurisprudência vinculante da persuasiva\n3. Alerte sobre mudanças de posicionamento recentes\n4. Sugira estratégias baseadas nas tendências identificadas',
    model: 'google/gemini-2.5-flash', icon_emoji: '🔍', card_color: 'slate',
  },
  {
    name: 'Gerador de Peças Jurídicas',
    objective: 'Gera petições, contestações, recursos e documentos jurídicos com qualidade profissional.',
    instructions: 'Você é um especialista em redação jurídica de alto nível para o Direito brasileiro.\n\nCapacidades:\n- Petições iniciais em todas as áreas\n- Contestações, reconvenções e réplicas\n- Recursos (apelação, agravo, REsp, RE)\n- Memoriais, alegações finais e pareceres\n- Contratos e documentos extrajudiciais\n- Notificações, requerimentos e ofícios\n\nPara cada peça:\n1. Solicite os fatos e documentos necessários\n2. Identifique a tese jurídica adequada\n3. Estruture com ementa, fatos, direito e pedidos\n4. Cite legislação e jurisprudência pertinentes\n5. Use linguagem técnica e formal\n6. Forneça versão completa e revisada',
    model: 'google/gemini-2.5-flash', icon_emoji: '📝', card_color: 'green',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function modelLabel(model: string) {
  return MODEL_LABELS[model] || model.split('/').pop() || model;
}

function gradient(card_color?: string) {
  return AREA_GRADIENT[card_color || 'blue'] || AREA_GRADIENT.blue;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Especialistas() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  const [systemAgents, setSystemAgents] = useState<Agent[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Record<string, unknown> | null>(null);

  useEffect(() => { loadAgents(); }, [user]);

  const loadAgents = async () => {
    setLoading(true);

    const sysRes = await supabase
      .from('intranet_agents')
      .select('id, name, objective, instructions, model, icon_emoji, card_color, is_active, is_system, created_by, cloned_from')
      .eq('is_system', true)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    setSystemAgents((sysRes.data || []) as Agent[]);

    if (user) {
      const myRes = await supabase
        .from('intranet_agents')
        .select('id, name, objective, instructions, model, icon_emoji, card_color, is_active, is_system, created_by, cloned_from')
        .eq('is_system', false)
        .eq('created_by', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setMyAgents((myRes.data || []) as Agent[]);
    }

    setLoading(false);
  };

  const handleClone = async (agent: Agent) => {
    if (!user) return;
    setCloningId(agent.id);
    const { data: cloned, error } = await supabase
      .from('intranet_agents')
      .insert({
        name: agent.name,
        objective: agent.objective,
        instructions: agent.instructions || '',
        model: agent.model,
        icon_emoji: agent.icon_emoji,
        card_color: agent.card_color || 'blue',
        is_active: true,
        is_system: false,
        created_by: user.id,
        cloned_from: agent.id,
      })
      .select()
      .single();

    setCloningId(null);

    if (error) {
      toast.error('Erro ao clonar especialista: ' + error.message);
      return;
    }

    toast.success('Especialista adicionado ao seu perfil! Agora você pode personalizá-lo.');
    await loadAgents();
    setEditingAgent(cloned as Record<string, unknown>);
    setEditOpen(true);
  };

  const handleDuplicate = async (agent: Agent) => {
    if (!user) return;
    const { error } = await supabase
      .from('intranet_agents')
      .insert({
        name: agent.name + ' (Cópia)',
        objective: agent.objective,
        instructions: agent.instructions || '',
        model: agent.model,
        icon_emoji: agent.icon_emoji,
        card_color: agent.card_color || 'blue',
        is_active: true,
        is_system: false,
        created_by: user.id,
        cloned_from: agent.id,
      });

    if (error) { toast.error('Erro ao duplicar especialista'); return; }
    toast.success('Especialista duplicado com sucesso!');
    loadAgents();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from('intranet_agents').delete().eq('id', deletingId);
    if (error) { toast.error('Erro ao excluir especialista'); return; }
    toast.success('Especialista excluído.');
    setDeletingId(null);
    loadAgents();
  };

  const seedOfficialAgents = async () => {
    if (!user) return;
    setSeeding(true);
    const { error } = await supabase
      .from('intranet_agents')
      .insert(
        OFFICIAL_SEEDS.map(s => ({
          ...s,
          is_active: true,
          is_system: true,
          created_by: null,
          cloned_from: null,
        }))
      );

    if (error) {
      toast.error('Erro ao criar especialistas: ' + error.message);
    } else {
      toast.success('10 especialistas oficiais criados com sucesso!');
      loadAgents();
    }
    setSeeding(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-8">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="border-b pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 shadow-md">
              <Award className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Especialistas</h1>
              <p className="text-[14px] text-muted-foreground">
                Agentes de IA especializados por área jurídica
              </p>
            </div>
          </div>
        </div>

        {/* ── Admin: seeder banner ─────────────────────────────── */}
        {!loading && systemAgents.length === 0 && isAdmin && (
          <div
            className="flex flex-col gap-4 rounded-[18px] p-5 sm:flex-row sm:items-center"
            style={{ border: '1px solid rgba(212,175,55,0.45)', background: 'rgba(212,175,55,0.06)' }}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Criar especialistas oficiais</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Clique para criar os 10 especialistas oficiais do Tribuna IA visíveis para todos os usuários.
              </p>
            </div>
            <Button
              onClick={seedOfficialAgents}
              disabled={seeding}
              className="flex-shrink-0 gap-2 rounded-xl"
              style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', border: '1px solid rgba(212,175,55,0.35)' }}
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Criar Especialistas Oficiais
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            {/* ── Seção 1: Especialistas Oficiais ──────────────── */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                <h2 className="text-[17px] font-semibold">Especialistas Oficiais do Tribuna IA</h2>
                <Badge
                  className="ml-1 text-[11px]"
                  style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.45)', color: '#B45309' }}
                >
                  {systemAgents.length} especialistas
                </Badge>
              </div>

              {systemAgents.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <Award className="mb-3 h-10 w-10 text-amber-400/50" />
                    <p className="text-[15px] font-medium">Nenhum especialista oficial disponível</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {isAdmin
                        ? 'Use o banner acima para criar os especialistas oficiais.'
                        : 'Os especialistas serão adicionados em breve pelo administrador.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {systemAgents.map(agent => (
                    <OfficialCard
                      key={agent.id}
                      agent={agent}
                      gradient={gradient(agent.card_color)}
                      modelLabel={modelLabel(agent.model)}
                      cloningId={cloningId}
                      onConsult={() => navigate(`/agentes-ia/${agent.id}`)}
                      onClone={() => handleClone(agent)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Seção 2: Meus Especialistas ──────────────────── */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-[17px] font-semibold">Meus Especialistas</h2>
                  {myAgents.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[11px]">
                      {myAgents.length}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl text-[13px]"
                  onClick={() => { setEditingAgent(null); setEditOpen(true); }}
                >
                  <Plus className="h-3.5 w-3.5" /> Criar do zero
                </Button>
              </div>

              {myAgents.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <User className="mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-[15px] font-medium">Nenhum especialista personalizado ainda</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Clique em <strong>Usar no Meu Perfil</strong> em um especialista oficial para personalizá-lo,
                      ou crie um do zero.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {myAgents.map(agent => (
                    <MyCard
                      key={agent.id}
                      agent={agent}
                      gradient={gradient(agent.card_color)}
                      modelLabel={modelLabel(agent.model)}
                      onConsult={() => navigate(`/agentes-ia/${agent.id}`)}
                      onEdit={() => { setEditingAgent(agent as unknown as Record<string, unknown>); setEditOpen(true); }}
                      onDuplicate={() => handleDuplicate(agent)}
                      onDelete={() => setDeletingId(agent.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Edit / Create dialog ────────────────────────────────── */}
      <CreateAgentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={loadAgents}
        editingAgent={editingAgent}
      />

      {/* ── Delete confirm ──────────────────────────────────────── */}
      <AlertDialog open={!!deletingId} onOpenChange={o => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir especialista?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O especialista personalizado será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OfficialCard({
  agent, gradient, modelLabel, cloningId, onConsult, onClone,
}: {
  agent: Agent;
  gradient: string;
  modelLabel: string;
  cloningId: string | null;
  onConsult: () => void;
  onClone: () => void;
}) {
  return (
    <div
      className="group overflow-hidden rounded-[18px] bg-card transition-all duration-[250ms] hover:-translate-y-1"
      style={{
        border: '1px solid rgba(212,175,55,0.45)',
        boxShadow: '0 10px 30px rgba(15,23,42,0.10)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.85)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 40px rgba(15,23,42,0.16), 0 0 0 1px rgba(212,175,55,0.25)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.45)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 30px rgba(15,23,42,0.10)';
      }}
    >
      {/* gradient bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-6 space-y-4">
        {/* Avatar + name + badge oficial */}
        <div className="flex items-start gap-3">
          <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-2xl shadow-md`}>
            {agent.icon_emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold leading-snug">{agent.name}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                className="text-[10px] px-2 py-0.5"
                style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.45)', color: '#B45309' }}
              >
                ⭐ Oficial Tribuna IA
              </Badge>
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-normal">
                {modelLabel}
              </Badge>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
          {agent.objective}
        </p>

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 rounded-xl text-[13px]"
            onClick={onConsult}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Consultar
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 rounded-xl text-[13px]"
            style={{
              background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
              border: '1px solid rgba(212,175,55,0.35)',
            }}
            onClick={onClone}
            disabled={cloningId === agent.id}
          >
            {cloningId === agent.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Copy className="h-3.5 w-3.5" />}
            Usar no Meu Perfil
          </Button>
        </div>
      </div>
    </div>
  );
}

function MyCard({
  agent, gradient, modelLabel, onConsult, onEdit, onDuplicate, onDelete,
}: {
  agent: Agent;
  gradient: string;
  modelLabel: string;
  onConsult: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group overflow-hidden rounded-[18px] bg-card transition-all duration-[250ms] hover:-translate-y-1"
      style={{
        border: '1px solid rgba(var(--border))',
        boxShadow: '0 6px 20px rgba(15,23,42,0.07)',
      }}
    >
      {/* gradient bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-6 space-y-4">
        {/* Avatar + name */}
        <div className="flex items-start gap-3">
          <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-2xl shadow-md`}>
            {agent.icon_emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold leading-snug">{agent.name}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {agent.cloned_from && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-normal gap-1">
                  <Copy className="h-2.5 w-2.5" /> Personalizado
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-normal">
                {modelLabel}
              </Badge>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
          {agent.objective}
        </p>

        {/* Buttons row */}
        <div className="space-y-2 pt-1">
          <Button
            className={`w-full gap-1.5 rounded-xl text-[13px] bg-gradient-to-r ${gradient} text-white hover:opacity-90`}
            size="sm"
            onClick={onConsult}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Consultar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 rounded-xl text-[12px]" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 rounded-xl text-[12px]" onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" /> Duplicar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
