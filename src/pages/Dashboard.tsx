import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Bot,
  History,
  FolderOpen,
  Shield,
  Sparkles,
  Scale,
  FileText,
  Clock,
} from 'lucide-react';

function CasoCard({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group cursor-pointer rounded-[18px] bg-card p-6 transition-all duration-[250ms]"
      style={{
        border: hovered
          ? '1px solid rgba(212,175,55,0.85)'
          : '1px solid rgba(212,175,55,0.45)',
        boxShadow: hovered
          ? '0 16px 40px rgba(15,23,42,0.16), 0 0 0 1px rgba(212,175,55,0.25)'
          : '0 10px 30px rgba(15,23,42,0.10)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
    >
      {children}
    </div>
  );
}

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
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
    iconColor: 'text-blue-600 dark:text-blue-400',
    hoverBorder: 'hover:border-blue-300/60 dark:hover:border-blue-700/60',
    dot: 'bg-blue-500',
  },
  {
    title: 'Agentes do Tribuna IA',
    description: 'Agentes especializados personalizáveis',
    icon: Bot,
    path: '/agentes-ia',
    iconBg: 'bg-violet-500/10 dark:bg-violet-500/15',
    iconColor: 'text-violet-600 dark:text-violet-400',
    hoverBorder: 'hover:border-violet-300/60 dark:hover:border-violet-700/60',
    dot: 'bg-violet-500',
  },
  {
    title: 'Especialistas',
    description: 'Agentes jurídicos por área de atuação',
    icon: Scale,
    path: '/especialistas',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    hoverBorder: 'hover:border-emerald-300/60 dark:hover:border-emerald-700/60',
    dot: 'bg-emerald-500',
  },
  {
    title: 'Corretor Jurídico',
    description: 'Revisão gramatical e jurídica de textos',
    icon: FileText,
    path: '/corretor-portugues',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
    hoverBorder: 'hover:border-amber-300/60 dark:hover:border-amber-700/60',
    dot: 'bg-amber-500',
  },
  {
    title: 'Casos',
    description: 'Gerenciar e acompanhar casos jurídicos',
    icon: FolderOpen,
    path: '/casos',
    iconBg: 'bg-rose-500/10 dark:bg-rose-500/15',
    iconColor: 'text-rose-600 dark:text-rose-400',
    hoverBorder: 'hover:border-rose-300/60 dark:hover:border-rose-700/60',
    dot: 'bg-rose-500',
  },
  {
    title: 'Histórico',
    description: 'Registro de todas as ações realizadas',
    icon: History,
    path: '/historico',
    iconBg: 'bg-slate-500/10 dark:bg-slate-500/15',
    iconColor: 'text-slate-600 dark:text-slate-400',
    hoverBorder: 'hover:border-slate-300/60 dark:hover:border-slate-600/60',
    dot: 'bg-slate-400',
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
      <div className="space-y-8">

        {/* ── Hero jurídico premium ──────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl px-8 py-6 text-white"
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1D4ED8 100%)',
            border: '1px solid rgba(212,175,55,0.35)',
            boxShadow: '0 18px 45px rgba(15,23,42,0.25)',
          }}
        >
          {/* overlay dourado radial */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(circle at 30% 50%, rgba(212,175,55,0.18), transparent 55%)' }}
          />

          <div className="relative z-10">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight">
              Olá, {firstName} 👋
            </h1>
            <p className="mt-1 text-[15px] text-white/75">
              A inteligência jurídica que potencializa sua advocacia.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge
                className="h-7 rounded-full px-3 text-[13px] font-medium text-white"
                style={{ background: 'rgba(212,175,55,0.20)', border: '1px solid rgba(212,175,55,0.45)' }}
              >
                {isAdmin ? '🛡️ Administrador' : '👤 Usuário'}
              </Badge>
              <Badge
                className="h-7 rounded-full border-white/20 bg-white/15 px-3 text-[13px] font-medium text-white hover:bg-white/25"
              >
                {loading ? 'Carregando...' : '✅ Sessão ativa'}
              </Badge>
            </div>
          </div>

          {/* decoração geométrica sutil */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-12 right-20 h-52 w-52 rounded-full bg-white/5" />
        </div>

        {/* ── Acesso rápido ─────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Acesso rápido
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <CasoCard
                  key={item.path}
                  onClick={() => navigate(item.path)}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${item.iconColor}`}
                      style={{
                        background: 'rgba(212,175,55,0.10)',
                        border: '1px solid rgba(212,175,55,0.35)',
                      }}
                    >
                      <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 text-muted-foreground/0 transition-all duration-200 group-hover:text-muted-foreground/60" />
                  </div>
                  <h3 className="mt-4 text-[16px] font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </CasoCard>
              );
            })}
          </div>
        </section>

        {/* ── Atividade recente — timeline ──────────────────── */}
        <section>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
            </div>
            <h2 className="text-[15px] font-semibold">Atividade recente</h2>
          </div>

          <div className="rounded-[20px] border border-border/60 bg-card p-6">
            {loadingHistory ? (
              <p className="text-[14px] text-muted-foreground">Carregando histórico...</p>
            ) : recentHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/25" strokeWidth={1.5} />
                <p className="text-[15px] text-muted-foreground">Nenhuma atividade registrada ainda.</p>
                <p className="mt-1 text-[13px] text-muted-foreground/60">Use as ferramentas acima para começar.</p>
              </div>
            ) : (
              <div className="border-l-2 border-primary/25 pl-5">
                {recentHistory.map((item) => (
                  <div key={item.id} className="relative pb-4 last:pb-0">
                    {/* dot da timeline */}
                    <span className="absolute -left-[23px] top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary/40 bg-card">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="px-2 py-0.5 text-[12px]">
                            {item.tool_name || item.module || 'Ferramenta'}
                          </Badge>
                          <span className="truncate text-[14px] font-medium">{item.action}</span>
                        </div>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate('/historico'); }}
                        className="h-8 w-8 shrink-0 p-0"
                      >
                        <History className="h-4 w-4" strokeWidth={2} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Painel admin ──────────────────────────────────── */}
        {isAdmin && (
          <div
            className="flex flex-col gap-4 rounded-[18px] p-6 sm:flex-row sm:items-center sm:justify-between"
            style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.04), rgba(29,78,216,0.06))',
              border: '1px solid rgba(212,175,55,0.35)',
              boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
            }}
          >
            <div>
              <p className="text-[17px] font-semibold">Painel administrativo disponível</p>
              <p className="mt-0.5 text-[14px] text-muted-foreground">
                Gerencie usuários, permissões e configurações.
              </p>
            </div>
            <Button
              onClick={() => navigate('/admin')}
              className="h-11 shrink-0 rounded-xl px-5 font-semibold"
              style={{
                background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
                border: '1px solid rgba(212,175,55,0.35)',
                boxShadow: '0 8px 20px rgba(37,99,235,0.25)',
              }}
            >
              <Shield className="mr-2 h-[18px] w-[18px]" strokeWidth={2} />
              Administração
            </Button>
          </div>
        )}

      </div>
    </Layout>
  );
}
