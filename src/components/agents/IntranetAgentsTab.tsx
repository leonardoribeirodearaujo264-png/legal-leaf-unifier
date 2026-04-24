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
import { Plus, Bot, MessageSquare, Trash2, Edit, Loader2, Database } from 'lucide-react';
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
  data_access?: string[];
}

const modelLabels: Record<string, string> = {
  'anthropic/claude-sonnet': 'Claude Sonnet',
  'openai/gpt-5': 'GPT-5',
  'perplexity/sonar-pro': 'Perplexity Sonar',
  'google/gemini-2.5-flash': 'Gemini Flash',
  'google/gemini-3-flash-preview': 'Gemini 3 Flash',
};

const modelColors: Record<string, string> = {
  'anthropic/claude-sonnet': 'bg-orange-100 text-orange-700 border-orange-200',
  'openai/gpt-5': 'bg-green-100 text-green-700 border-green-200',
  'perplexity/sonar-pro': 'bg-blue-100 text-blue-700 border-blue-200',
  'google/gemini-2.5-flash': 'bg-purple-100 text-purple-700 border-purple-200',
  'google/gemini-3-flash-preview': 'bg-purple-100 text-purple-700 border-purple-200',
};

const cardColorStyles: Record<string, string> = {
  purple: 'border-t-4 border-t-purple-500',
  blue: 'border-t-4 border-t-blue-500',
  green: 'border-t-4 border-t-green-500',
  orange: 'border-t-4 border-t-orange-500',
  red: 'border-t-4 border-t-red-500',
  yellow: 'border-t-4 border-t-yellow-500',
  pink: 'border-t-4 border-t-pink-500',
};

const dataAccessLabels: Record<string, string> = {
  leads: 'Leads',
  colaboradores: 'Colaboradores',
  intimacoes: 'Intimações',
  financeiro: 'Financeiro',
  campanhas: 'Campanhas',
  tarefas: 'Tarefas',
  processos: 'Processos',
  teams_documents: 'Documentos Teams',
  all: 'Acesso Total',
};

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
    const { data, error } = await supabase
      .from('intranet_agents')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) { console.error('Error loading agents:', error); toast.error('Erro ao carregar agentes'); }
    else { setAgents(data || []); }
    setLoading(false);
  };

  const confirmDelete = async () => {
    if (!deletingAgentId) return;
    // Hard delete: a policy de UPDATE herda o WITH CHECK da SELECT (is_active = true),
    // o que bloqueia soft delete (is_active = false) com "row violates RLS policy".
    // A policy de DELETE já é restrita a criador/admin, e as FKs filhas usam ON DELETE CASCADE.
    const result = await retryWithRefresh(() =>
      supabase
        .from('intranet_agents')
        .delete()
        .eq('id', deletingAgentId)
    );

    if (result.error) {
      console.error('Delete error:', result.error);
      toast.error(`Erro ao excluir: ${result.error.message}`);
    } else {
      // Atualiza UI localmente (some imediatamente) + recarrega para garantir consistência
      setAgents(prev => prev.filter(a => a.id !== deletingAgentId));
      toast.success('Agente excluído');
      loadAgents();
    }
    setDeletingAgentId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Seus Agentes Personalizados</h2>
          <p className="text-sm text-muted-foreground">Crie agentes de IA com instruções específicas para suas necessidades</p>
        </div>
        <Button onClick={() => { setEditingAgent(null); setShowCreate(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Criar Novo Agente
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum agente criado ainda</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Crie seu primeiro agente de IA personalizado com instruções específicas para automatizar tarefas do escritório.
            </p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Criar Primeiro Agente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const colorStyle = cardColorStyles[agent.card_color || 'purple'] || cardColorStyles.purple;
            const accessList = (agent.data_access || []).filter(v => v !== '');

            return (
              <Card key={agent.id} className={`hover:shadow-lg transition-all duration-300 cursor-pointer group ${colorStyle}`} onClick={() => navigate(`/agentes-ia/${agent.id}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{agent.icon_emoji}</span>
                      <div>
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{agent.name}</h3>
                        {agent.function_role && (
                          <p className="text-xs text-muted-foreground italic">{agent.function_role}</p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{agent.objective}</p>
                      </div>
                    </div>
                  </div>

                  {accessList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {accessList.includes('all') ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Database className="h-3 w-3" /> Acesso Total
                        </Badge>
                      ) : (
                        accessList.slice(0, 3).map(acc => (
                          <Badge key={acc} variant="outline" className="text-xs">
                            {dataAccessLabels[acc] || acc}
                          </Badge>
                        ))
                      )}
                      {!accessList.includes('all') && accessList.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{accessList.length - 3}</Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <Badge variant="outline" className={`text-xs ${modelColors[agent.model] || 'bg-muted text-muted-foreground'}`}>
                      {modelLabels[agent.model] || agent.model}
                    </Badge>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {(user?.id === agent.created_by || isAdmin) && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingAgent(agent); setShowCreate(true); }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingAgentId(agent.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateAgentDialog open={showCreate} onOpenChange={setShowCreate} onSuccess={loadAgents} editingAgent={editingAgent} />

      <AlertDialog open={!!deletingAgentId} onOpenChange={(open) => { if (!open) setDeletingAgentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este agente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
