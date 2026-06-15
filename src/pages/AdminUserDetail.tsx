import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bot,
  Clock,
  FolderOpen,
  Loader2,
  Monitor,
  Scale,
  Shield,
  UserCheck,
  UserX,
  Activity,
  Calendar,
} from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  approval_status: string;
  is_active: boolean | null;
  is_suspended: boolean | null;
  avatar_url: string | null;
  created_at: string | null;
  last_seen_at: string | null;
  role: string | null;
  is_admin?: boolean;
}

interface UserStats {
  totalCasos: number;
  totalAgentes: number;
  totalAiUses: number;
  totalSessions: number;
  totalDurationSeconds: number;
}

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  last_activity_at: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  CASE_CREATED: 'Caso criado',
  CASE_IMPORTED: 'Caso importado',
  CASE_UPDATED: 'Caso atualizado',
  AI_USED: 'IA utilizada',
  AGENT_CREATED: 'Agente criado',
  AGENT_USED: 'Agente utilizado',
  SPECIALIST_USED: 'Especialista consultado',
  REPORT_GENERATED: 'Relatório gerado',
  PROFILE_UPDATED: 'Perfil atualizado',
  ADMIN_APPROVED_USER: 'Usuário aprovado',
  ADMIN_REJECTED_USER: 'Usuário rejeitado',
  ADMIN_CHANGED_ROLE: 'Perfil alterado',
  ADMIN_IMPERSONATION_STARTED: 'Acesso assistido iniciado',
  ADMIN_IMPERSONATION_ENDED: 'Acesso assistido encerrado',
};

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: adminUser } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { startImpersonation } = useImpersonation();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [impersonationReason, setImpersonationReason] = useState('');
  const [showImpersonationModal, setShowImpersonationModal] = useState(false);

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (!isAdmin || !userId) return;
    loadAll();
  }, [isAdmin, userId]);

  const loadAll = async () => {
    if (!userId) return;
    setLoading(true);

    const [profileRes, rolesRes, casosRes, agentesRes, historyRes, sessionsRes, logsRes] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, approval_status, is_active, is_suspended, avatar_url, created_at, last_seen_at, role')
          .eq('id', userId)
          .single(),
        supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin'),
        supabase.from('casos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('intranet_agents').select('id', { count: 'exact', head: true }).eq('created_by', userId),
        supabase.from('usage_history').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase
          .from('user_sessions')
          .select('id, started_at, ended_at, duration_seconds, last_activity_at')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(10),
        supabase
          .from('user_activity_logs')
          .select('id, action, entity_type, metadata, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

    if (profileRes.data) {
      const isAdmin = (rolesRes.data ?? []).length > 0;
      setProfile({ ...profileRes.data, is_admin: isAdmin });
    }

    const totalDuration = (sessionsRes.data ?? []).reduce(
      (sum, s) => sum + (s.duration_seconds ?? 0),
      0
    );

    setStats({
      totalCasos: casosRes.count ?? 0,
      totalAgentes: agentesRes.count ?? 0,
      totalAiUses: historyRes.count ?? 0,
      totalSessions: (sessionsRes.data ?? []).length,
      totalDurationSeconds: totalDuration,
    });

    setSessions(sessionsRes.data ?? []);
    setActivityLogs((logsRes.data ?? []) as ActivityLog[]);
    setLoading(false);
  };

  const updateApproval = async (approval_status: string) => {
    if (!userId) return;
    setSaving('approval');
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status, updated_at: new Date().toISOString() })
      .eq('id', userId);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    setProfile((p) => p ? { ...p, approval_status } : p);

    // Audit log
    await supabase.from('user_activity_logs').insert({
      user_id: adminUser!.id,
      action: approval_status === 'approved' ? 'ADMIN_APPROVED_USER' : 'ADMIN_REJECTED_USER',
      entity_type: 'user',
      entity_id: userId,
      metadata: { target_name: profile?.full_name },
    });

    toast.success('Status atualizado');
  };

  const toggleAdmin = async () => {
    if (!userId || !profile) return;
    setSaving('role');
    const currentIsAdmin = profile.is_admin === true;
    const result = currentIsAdmin
      ? await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin')
      : await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
    setSaving(null);
    if (result.error) { toast.error(result.error.message); return; }

    await supabase.from('user_activity_logs').insert({
      user_id: adminUser!.id,
      action: 'ADMIN_CHANGED_ROLE',
      entity_type: 'user',
      entity_id: userId,
      metadata: { new_role: currentIsAdmin ? 'user' : 'admin', target_name: profile.full_name },
    });

    setProfile((p) => p ? { ...p, is_admin: !currentIsAdmin } : p);
    toast.success(currentIsAdmin ? 'Admin removido' : 'Admin concedido');
  };

  const toggleSuspend = async () => {
    if (!userId || !profile) return;
    setSaving('suspend');
    const is_suspended = !profile.is_suspended;
    const { error } = await supabase
      .from('profiles')
      .update({ is_suspended, updated_at: new Date().toISOString() })
      .eq('id', userId);
    setSaving(null);
    if (error) { toast.error(error.message); return; }

    await supabase.from('user_activity_logs').insert({
      user_id: adminUser!.id,
      action: is_suspended ? 'ADMIN_BLOCKED_USER' : 'ADMIN_UNBLOCKED_USER',
      entity_type: 'user',
      entity_id: userId,
      metadata: { target_name: profile.full_name },
    });

    setProfile((p) => p ? { ...p, is_suspended } : p);
    toast.success(is_suspended ? 'Usuário suspenso' : 'Usuário desbloqueado');
  };

  const handleStartImpersonation = async () => {
    if (!adminUser || !profile || !impersonationReason.trim()) return;
    setSaving('impersonation');
    await startImpersonation({
      adminId: adminUser.id,
      targetId: profile.id,
      targetName: profile.full_name,
      targetEmail: profile.email,
      reason: impersonationReason.trim(),
    });
    setSaving(null);
    setShowImpersonationModal(false);
    toast.success('Modo suporte ativado');
    navigate('/dashboard');
  };

  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="text-center py-20 text-muted-foreground">Usuário não encontrado.</div>
      </Layout>
    );
  }

  const statusColor = {
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  }[profile.approval_status] ?? 'bg-muted text-muted-foreground';

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        {/* Voltar */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar para Admin
        </Button>

        {/* Header do usuário */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1D4ED8 100%)',
            border: '1px solid rgba(212,175,55,0.35)',
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shrink-0"
                style={{ background: 'rgba(212,175,55,0.20)', border: '1px solid rgba(212,175,55,0.45)' }}
              >
                {profile.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{profile.full_name || 'Sem nome'}</h1>
                <p className="text-sm text-white/70">{profile.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                    {profile.approval_status}
                  </span>
                  <Badge
                    className="text-white"
                    style={{ background: 'rgba(212,175,55,0.20)', border: '1px solid rgba(212,175,55,0.45)' }}
                  >
                    {profile.is_admin ? '🛡️ Admin' : '👤 Usuário'}
                  </Badge>
                  {profile.is_suspended && <Badge variant="destructive">Suspenso</Badge>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white gap-1.5"
                onClick={() => setShowImpersonationModal(true)}
              >
                <Monitor className="h-3.5 w-3.5" />
                Entrar como Usuário
              </Button>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Casos', value: stats.totalCasos, icon: FolderOpen, color: 'text-rose-500' },
              { label: 'Agentes', value: stats.totalAgentes, icon: Bot, color: 'text-violet-500' },
              { label: 'Usos de IA', value: stats.totalAiUses, icon: Scale, color: 'text-blue-500' },
              { label: 'Sessões', value: stats.totalSessions, icon: Activity, color: 'text-emerald-500' },
              {
                label: 'Tempo total',
                value: formatDuration(stats.totalDurationSeconds),
                icon: Clock,
                color: 'text-amber-500',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="flex flex-col items-center justify-center gap-1.5 p-4 text-center">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <span className="text-2xl font-bold">{value}</span>
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info + Ações */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cadastro</span>
                <span>
                  {profile.created_at
                    ? format(new Date(profile.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Último acesso</span>
                <span>
                  {profile.last_seen_at
                    ? formatDistanceToNow(new Date(profile.last_seen_at), { addSuffix: true, locale: ptBR })
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="capitalize">{profile.approval_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Perfil</span>
                <span>{profile.is_admin ? 'Administrador' : 'Usuário'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Suspenso</span>
                <span>{profile.is_suspended ? 'Sim' : 'Não'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Ações Administrativas
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  size="sm" className="flex-1" variant="secondary"
                  onClick={() => updateApproval('approved')}
                  disabled={!!saving || profile.approval_status === 'approved'}
                >
                  <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Aprovar
                </Button>
                <Button
                  size="sm" className="flex-1" variant="outline"
                  onClick={() => updateApproval('pending')}
                  disabled={!!saving || profile.approval_status === 'pending'}
                >
                  Pendente
                </Button>
                <Button
                  size="sm" className="flex-1" variant="destructive"
                  onClick={() => updateApproval('rejected')}
                  disabled={!!saving || profile.approval_status === 'rejected'}
                >
                  <UserX className="mr-1.5 h-3.5 w-3.5" /> Rejeitar
                </Button>
              </div>
              <Button
                size="sm" variant="outline" className="w-full"
                onClick={toggleAdmin} disabled={!!saving}
              >
                {profile.is_admin ? 'Remover Admin' : 'Tornar Admin'}
              </Button>
              <Button
                size="sm"
                variant={profile.is_suspended ? 'secondary' : 'destructive'}
                className="w-full"
                onClick={toggleSuspend} disabled={!!saving}
              >
                {profile.is_suspended ? 'Desbloquear Acesso' : 'Bloquear Acesso'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sessões recentes */}
        {sessions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Sessões Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        {format(new Date(s.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                      {s.ended_at && (
                        <span className="ml-2 text-muted-foreground">
                          → {format(new Date(s.ended_at), "HH:mm")}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[11px]">
                      {formatDuration(s.duration_seconds)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico de atividades */}
        {activityLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Histórico de Atividades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-l-2 border-primary/25 pl-5 space-y-1">
                {activityLogs.map((log) => (
                  <div key={log.id} className="relative pb-3 last:pb-0">
                    <span className="absolute -left-[23px] top-2 flex h-3 w-3 items-center justify-center rounded-full border-2 border-primary/40 bg-card">
                      <span className="h-1 w-1 rounded-full bg-primary" />
                    </span>
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                      <span className="text-sm font-medium">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      <span className="text-[12px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de impersonação */}
      <Dialog open={showImpersonationModal} onOpenChange={setShowImpersonationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-amber-500" />
              Acesso Assistido
            </DialogTitle>
            <DialogDescription>
              Você está prestes a acessar o ambiente de{' '}
              <strong>{profile.full_name}</strong>. Essa ação será registrada na auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="text-sm font-medium">Motivo do acesso assistido *</label>
            <Textarea
              placeholder="Descreva o motivo do suporte técnico..."
              value={impersonationReason}
              onChange={(e) => setImpersonationReason(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImpersonationModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleStartImpersonation}
              disabled={!impersonationReason.trim() || saving === 'impersonation'}
              className="gap-2"
            >
              {saving === 'impersonation' && <Loader2 className="h-4 w-4 animate-spin" />}
              Iniciar Acesso Assistido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
