import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bot, History, FolderOpen, Shield, Sparkles, Scale, FileText, Clock } from 'lucide-react';

interface HistoryItem {
  id: string;
  tool_name: string | null;
  module: string | null;
  action: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const quickActions = [
  {
    title: 'Assistente de IA',
    description: 'Chat multi-modelo com IA jurídica',
    icon: Sparkles,
    path: '/assistente-ia',
    iconBg: 'bg-blue-500/12 dark:bg-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    title: 'Agentes do Tribuna IA',
    description: 'Agentes especializados personalizáveis',
    icon: Bot,
    path: '/agentes-ia',
    iconBg: 'bg-violet-500/12 dark:bg-violet-500/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    title: 'Especialistas',
    description: 'Agentes jurídicos por área de atuação',
    icon: Scale,
    path: '/especialistas',
    iconBg: 'bg-emerald-500/12 dark:bg-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    title: 'Corretor Jurídico',
    description: 'Revisão gramatical e jurídica de textos',
    icon: FileText,
    path: '/corretor-portugues',
    iconBg: 'bg-amber-500/12 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    border: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  {
    title: 'Casos',
    description: 'Gerenciar e acompanhar casos jurídicos',
    icon: FolderOpen,
    path: '/casos',
    iconBg: 'bg-rose-500/12 dark:bg-rose-500/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    border: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
  {
    title: 'Histórico',
    description: 'Registro de todas as ações realizadas',
    icon: History,
    path: '/historico',
    iconBg: 'bg-slate-500/12 dark:bg-slate-500/20',
    iconColor: 'text-slate-600 dark:text-slate-400',
    border: 'hover:border-slate-300 dark:hover:border-slate-600',
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isAdmin, loading } = useUserRole();
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('usage_history')
        .select('id, tool_name, module, action, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentHistory((data || []) as HistoryItem[]);
      setLoadingHistory(false);
    };

    loadHistory();
  }, [user]);

  const firstName = (profile?.full_name || user?.email || 'usuário').split(' ')[0];

  return (
    <Layout>
      <div className="space-y-7">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-blue-700 p-7 text-white shadow-xl shadow-primary/20">
          <div className="relative z-10">
            <p className="text-sm font-medium text-blue-100/90 tracking-wide">Bem-vindo de volta</p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight md:text-4xl">
              Olá, {firstName} 👋
            </h1>
            <p className="mt-2 text-base text-blue-100/75">
              Sua plataforma de inteligência artificial jurídica
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/25 text-sm px-3 py-1">
                {isAdmin ? '🛡️ Administrador' : '👤 Usuário'}
              </Badge>
              <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/25 text-sm px-3 py-1">
                {loading ? 'Carregando...' : '✅ Sessão ativa'}
              </Badge>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-16 right-24 h-64 w-64 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute top-1/2 -right-4 h-32 w-32 rounded-full bg-blue-400/10" />
        </div>

        {/* Quick actions grid */}
        <div>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Acesso rápido
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.path}
                  className={[
                    'group cursor-pointer border-border/60 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
                    item.border,
                  ].join(' ')}
                  onClick={() => navigate(item.path)}
                >
                  <CardHeader className="space-y-0 pb-3 pt-5 px-5">
                    <div className="flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.iconBg}`}>
                        <Icon className={`h-6 w-6 ${item.iconColor}`} />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/0 transition-all duration-200 group-hover:text-muted-foreground mt-1" />
                    </div>
                    <CardTitle className="mt-3.5 text-[17px] font-semibold leading-snug">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-5 px-5">
                    <p className="text-[15px] text-muted-foreground leading-relaxed">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base font-semibold">Atividade recente</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <p className="text-[15px] text-muted-foreground">Carregando histórico...</p>
            ) : recentHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-[15px] text-muted-foreground">Nenhuma atividade registrada ainda.</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Use as ferramentas acima para começar.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs px-2 py-0.5">
                          {item.tool_name || item.module || 'Ferramenta'}
                        </Badge>
                        <span className="truncate text-[15px] font-medium">{item.action}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/historico')} className="shrink-0 h-8 w-8 p-0">
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="border-primary/25 bg-primary/5 dark:bg-primary/10">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-[17px] font-semibold">Painel administrativo disponível</p>
                <p className="text-[15px] text-muted-foreground mt-0.5">Gerencie usuários, permissões e configurações.</p>
              </div>
              <Button onClick={() => navigate('/admin')} className="shrink-0 h-10 px-5">
                <Shield className="mr-2 h-4 w-4" />
                Administração
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
