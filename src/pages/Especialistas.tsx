import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { MessageSquare, Loader2, Sparkles, Award } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  objective: string;
  model: string;
  icon_emoji: string;
  is_active: boolean;
}

// Especialista inicial — será criado automaticamente se não existir
const TRIBUNAL_JURI_SEED = {
  name: 'Especialista em Tribunal do Júri',
  objective: 'Agente especializado em casos de Tribunal do Júri, defesa criminal, teses defensivas, quesitos, alegações, plenário, memoriais, nulidades, recursos e estratégia processual penal.',
  instructions: `Você é um especialista altamente qualificado em Tribunal do Júri e Direito Processual Penal brasileiro.

Suas áreas de especialização incluem:
- Defesa criminal no Tribunal do Júri
- Elaboração de teses defensivas
- Formulação e análise de quesitos
- Alegações finais e debates orais em plenário
- Memoriais de defesa
- Nulidades processuais
- Recursos em matéria criminal (RESE, Apelação, HC)
- Estratégia processual penal
- Pronúncia e impronúncia
- Desaforamento
- Incidente de insanidade mental
- Crimes dolosos contra a vida

Ao responder:
1. Cite a legislação aplicável (CPP, CF/88, jurisprudência do STJ e STF)
2. Apresente as teses defensivas possíveis de forma organizada
3. Indique os riscos e probabilidades de cada estratégia
4. Use linguagem técnica mas clara
5. Forneça modelos de peças quando solicitado

Você auxilia advogados e estudantes de direito na preparação de casos para o Tribunal do Júri.`,
  model: 'google/gemini-2.5-flash',
  icon_emoji: '⚖️',
  is_active: true,
};

const modelLabels: Record<string, string> = {
  'anthropic/claude-sonnet': 'Claude Sonnet',
  'openai/gpt-5': 'GPT-5',
  'perplexity/sonar-pro': 'Perplexity Sonar',
  'google/gemini-2.5-flash': 'Gemini Flash',
  'google/gemini-3-flash-preview': 'Gemini 3 Flash',
};

const areaColors: Record<string, string> = {
  '⚖️': 'from-slate-800 to-slate-700',
  '🧠': 'from-violet-700 to-purple-700',
  '💼': 'from-blue-800 to-blue-700',
  '🏛️': 'from-amber-700 to-orange-700',
  '📋': 'from-emerald-700 to-teal-700',
};

export default function Especialistas() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => { loadEspecialistas(); }, []);

  const loadEspecialistas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('intranet_agents')
      .select('id, name, objective, model, icon_emoji, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar especialistas');
      setLoading(false);
      return;
    }
    setAgents(data || []);
    setLoading(false);
  };

  const seedJuriAgent = async () => {
    if (!user) return;
    setSeeding(true);
    const { error } = await supabase
      .from('intranet_agents')
      .insert({ ...TRIBUNAL_JURI_SEED, created_by: user.id });

    if (error) {
      toast.error('Erro ao criar especialista: ' + error.message);
    } else {
      toast.success('Especialista em Tribunal do Júri criado!');
      loadEspecialistas();
    }
    setSeeding(false);
  };

  const juriExists = agents.some(a =>
    a.name.toLowerCase().includes('tribunal do júri') ||
    a.name.toLowerCase().includes('tribunal do juri')
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <Award className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                Especialistas
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Agentes de IA especializados por área jurídica
              </p>
            </div>
          </div>
        </div>

        {/* Seed banner — mostra apenas para admins quando o especialista ainda não existe */}
        {!loading && !juriExists && isAdmin && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-800 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-violet-900 dark:text-violet-200">Criar especialista inicial</p>
              <p className="text-sm text-violet-700 dark:text-violet-400 mt-0.5">
                Clique para criar o Especialista em Tribunal do Júri configurado para o sistema.
              </p>
            </div>
            <Button
              onClick={seedJuriAgent}
              disabled={seeding}
              className="bg-violet-600 hover:bg-violet-700 gap-2 flex-shrink-0"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Criar Especialista
            </Button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : agents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                <Award className="h-8 w-8 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhum especialista disponível</h3>
              <p className="text-muted-foreground max-w-sm">
                {isAdmin
                  ? 'Use o banner acima para criar o especialista inicial, ou crie agentes na tela de Agentes do Tribuna IA.'
                  : 'Os especialistas serão adicionados em breve pelo administrador.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {agents.map(agent => {
              const gradientClass = areaColors[agent.icon_emoji] || 'from-violet-700 to-blue-700';
              return (
                <Card
                  key={agent.id}
                  className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-md cursor-pointer"
                  onClick={() => navigate(`/agentes-ia/${agent.id}`)}
                >
                  {/* Gradient top bar */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${gradientClass}`} />

                  <CardContent className="p-6 space-y-4">
                    {/* Avatar + name */}
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center text-2xl shadow-lg flex-shrink-0`}>
                        {agent.icon_emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base leading-snug group-hover:text-violet-600 transition-colors">
                          {agent.name}
                        </h3>
                        <Badge variant="outline" className="mt-1.5 text-xs font-normal">
                          {modelLabels[agent.model] || agent.model}
                        </Badge>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {agent.objective}
                    </p>

                    {/* CTA */}
                    <Button
                      className={`w-full bg-gradient-to-r ${gradientClass} hover:opacity-90 text-white gap-2 transition-opacity`}
                      onClick={e => { e.stopPropagation(); navigate(`/agentes-ia/${agent.id}`); }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Consultar especialista
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
