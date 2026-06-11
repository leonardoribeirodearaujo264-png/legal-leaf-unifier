import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useSessionRefresh } from '@/hooks/useSessionRefresh';
import { toast } from 'sonner';
import { Plus, Bot, Trash2, Edit, Loader2, Play, User } from 'lucide-react';
import { CreateAgentDialog } from './CreateAgentDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Agent {
  id: string;
  name: string;
  objective: string;
  instructions: string;
  model: string;
  icon_emoji: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  function_role?: string;
  card_color?: string;
  creator_name?: string;
  knowledge_base?: string | null;
}

const MODEL_LABELS: Record<string, string> = {
  'gemini-flash': 'Gemini Flash',
  'gemini-pro': 'Gemini Pro',
  'claude-sonnet': 'Claude Sonnet',
  'claude-haiku': 'Claude Haiku',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'perplexity-large': 'Perplexity',
  'anthropic/claude-sonnet': 'Claude Sonnet',
  'openai/gpt-5': 'GPT-5',
  'google/gemini-2.5-flash': 'Gemini Flash',
  'google/gemini-3-flash-preview': 'Gemini Flash',
  'perplexity/sonar-pro': 'Perplexity',
};

const MODEL_COLORS: Record<string, string> = {
  'gemini-flash': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
  'gemini-pro': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
  'claude-sonnet': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
  'claude-haiku': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  'gpt-4o': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  'gpt-4o-mini': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  'perplexity-large': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
};

const CARD_COLORS: Record<string, string> = {
  purple: 'border-t-4 border-t-purple-500',
  blue: 'border-t-4 border-t-blue-500',
  green: 'border-t-4 border-t-green-500',
  orange: 'border-t-4 border-t-orange-500',
  red: 'border-t-4 border-t-red-500',
  yellow: 'border-t-4 border-t-yellow-500',
  pink: 'border-t-4 border-t-pink-500',
};

function modelLabel(model: string) {
  return MODEL_LABELS[model] || model.split('/').pop() || model;
}

function modelColor(model: string) {
  return MODEL_COLORS[model] || 'bg-muted text-muted-foreground border-border';
}

export function IntranetAgentsTab() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { retryWithRefresh } = useSessionRefresh();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);

  useEffect(() => { loadAgents(); }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('intranet_agents')
        .select('id, name, objective, instructions, model, icon_emoji, created_by, is_active, created_at, function_role, card_color, knowledge_base')
        .order('created_at', { ascending: false });

      if (error) {
        // If columns like knowledge_base don't exist yet, fall back to base columns
        if (error.code === '42703') {
          const fallback = await supabase
            .from('intranet_agents')
            .select('id, name, objective, instructions, model, icon_emoji, created_by, is_active, created_at, function_role, card_color')
            .order('created_at', { ascending: false });
          if (fallback.error) throw fallback.error;
          setAgents((fallback.data || []).map((a) => ({ ...a, creator_name: 'Usuário' })));
          setLoading(false);
          return;
        }
        throw error;
      }

      const list = data || [];
      const creatorIds = [...new Set(list.map((a) => a.created_by).filter(Boolean))];
      let creatorMap: Record<string, string> = {};

      if (creatorIds.length > 0) {
        // profiles_safe may not exist in all environments — ignore errors gracefully
        const { data: profiles } = await supabase
          .from('profiles_safe')
          .select('id, full_name')
          .in('id', creatorIds);
        creatorMap = (profiles || []).reduce((acc, p) => {
          if (p.id && p.full_name) acc[p.id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }

      setAgents(list.map((a) => ({ ...a, creator_name: creatorMap[a.created_by] || 'Usuário' })));
    } catch (err) {
      console.error('Error loading agents:', err);
      const msg =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      toast.error(`Erro ao carregar agentes: ${msg}`);
    }
    setLoading(false);
  };

  const confirmDelete = async () => {
    if (!deletingAgentId) return;
    const result = await retryWithRefresh(() =>
      supabase.from('intranet_agents').delete().eq('id', deletingAgentId)
    );
    if (result.error) {
      toast.error(`Erro ao excluir: ${result.error.message}`);
    } else {
      setAgents((prev) => prev.filter((a) => a.id !== deletingAgentId));
      toast.success('Agente excluído');
      loadAgents();
    }
    setDeletingAgentId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Seus Agentes Personalizados</h2>
          <p className="text-sm text-muted-foreground">
            {agents.length > 0
              ? `${agents.length} agente${agents.length !== 1 ? 's' : ''} configurado${agents.length !== 1 ? 's' : ''}`
              : 'Crie agentes especializados para o seu escritório'}
          </p>
        </div>
        <Button onClick={() => { setEditingAgent(null); setShowCreate(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Criar Novo Agente
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Nenhum agente criado ainda</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm">
              Crie seu primeiro agente com instruções específicas, modelo de IA e base de conhecimento própria.
            </p>
            <Button onClick={() => { setEditingAgent(null); setShowCreate(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Criar Primeiro Agente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const topColor = CARD_COLORS[agent.card_color || 'purple'] || CARD_COLORS.purple;
            const canEdit = user?.id === agent.created_by || isAdmin;

            return (
              <Card
                key={agent.id}
                className={`group flex flex-col transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${topColor}`}
                onClick={() => navigate(`/agentes-ia/${agent.id}`)}
              >
                <CardContent className="flex flex-col flex-1 p-5 gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl flex-shrink-0 leading-none">{agent.icon_emoji}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-[15px] leading-tight group-hover:text-primary transition-colors truncate">
                        {agent.name}
                      </h3>
                      {agent.function_role && (
                        <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{agent.function_role}</p>
                      )}
                    </div>
                    {!agent.is_active && (
                      <Badge variant="outline" className="text-[10px] shrink-0">Inativo</Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {agent.objective}
                  </p>

                  {agent.knowledge_base && (
                    <Badge variant="secondary" className="self-start text-[10px]">
                      📄 Base de conhecimento
                    </Badge>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                    <Badge variant="outline" className={`text-[10px] border ${modelColor(agent.model)}`}>
                      {modelLabel(agent.model)}
                    </Badge>

                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 gap-1 text-xs text-primary hover:bg-primary/10"
                        onClick={() => navigate(`/agentes-ia/${agent.id}`)}
                      >
                        <Play className="h-3 w-3" /> Executar
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setEditingAgent(agent); setShowCreate(true); }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeletingAgentId(agent.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50 -mt-1">
                    <User className="h-3 w-3" />
                    <span className="truncate">{agent.creator_name}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateAgentDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={loadAgents}
        editingAgent={editingAgent}
      />

      <AlertDialog open={!!deletingAgentId} onOpenChange={(o) => { if (!o) setDeletingAgentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agente e todas as suas conversas serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
