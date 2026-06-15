import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Shield,
  UserCheck,
  UserX,
  Search,
  Settings2,
  Save,
  Loader2,
  Monitor,
  Eye,
  Clock,
  Activity,
} from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  approval_status: string;
  is_active: boolean | null;
  is_suspended: boolean | null;
  avatar_url: string | null;
  created_at: string | null;
  last_seen_at: string | null;
  is_admin?: boolean;
}

interface AppSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
}

interface RoleRow { user_id: string; role: string }
interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  approval_status: string;
  is_active: boolean | null;
  is_suspended: boolean | null;
  avatar_url: string | null;
  created_at: string | null;
  last_seen_at: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  pending:  'border-amber-200  bg-amber-50  text-amber-700  dark:bg-amber-900/20  dark:text-amber-400',
  rejected: 'border-red-200    bg-red-50    text-red-700    dark:bg-red-900/20    dark:text-red-400',
};

export default function Admin() {
  const navigate = useNavigate();
  const { user: adminUser } = useAuth();
  const { isAdmin, loading } = useUserRole();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    const loadData = async () => {
      const [usersRes, rolesRes, settingsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, full_name, approval_status, is_active, is_suspended, avatar_url, created_at, last_seen_at')
          .order('full_name', { ascending: true }),
        supabase.from('user_roles').select('user_id, role').eq('role', 'admin'),
        supabase.from('app_settings').select('id, setting_key, setting_value, description').order('setting_key'),
      ]);

      const adminIds = new Set(((rolesRes.data || []) as RoleRow[]).map((r) => r.user_id));
      setUsers(
        ((usersRes.data || []) as ProfileRow[]).map((u) => ({ ...u, is_admin: adminIds.has(u.id) }))
      );
      setSettings(settingsRes.data || []);
    };

    loadData();
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) =>
      [u.full_name, u.email, u.approval_status].join(' ').toLowerCase().includes(term)
    );
  }, [search, users]);

  const updateApproval = async (userId: string, approval_status: string, targetName: string) => {
    setSaving(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status, updated_at: new Date().toISOString() })
      .eq('id', userId);
    setSaving(null);

    if (error) { toast.error(error.message); return; }

    if (adminUser) {
      await supabase.from('user_activity_logs').insert({
        user_id: adminUser.id,
        action: approval_status === 'approved' ? 'ADMIN_APPROVED_USER' : 'ADMIN_REJECTED_USER',
        entity_type: 'user',
        entity_id: userId,
        metadata: { target_name: targetName },
      });
    }

    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, approval_status } : u));
    toast.success('Status atualizado');
  };

  const toggleAdminRole = async (userId: string, currentIsAdmin: boolean, targetName: string) => {
    setSaving(userId + '_role');
    const result = currentIsAdmin
      ? await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin')
      : await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
    setSaving(null);

    if (result.error) { toast.error(result.error.message); return; }

    if (adminUser) {
      await supabase.from('user_activity_logs').insert({
        user_id: adminUser.id,
        action: 'ADMIN_CHANGED_ROLE',
        entity_type: 'user',
        entity_id: userId,
        metadata: { new_role: currentIsAdmin ? 'user' : 'admin', target_name: targetName },
      });
    }

    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_admin: !currentIsAdmin } : u));
    toast.success(currentIsAdmin ? 'Admin removido' : 'Admin concedido');
  };

  const updateSetting = async (setting: AppSetting, value: string) => {
    setSaving(setting.setting_key);
    const { error } = await supabase
      .from('app_settings')
      .update({ setting_value: value, updated_at: new Date().toISOString() })
      .eq('id', setting.id);
    setSaving(null);

    if (error) { toast.error(error.message); return; }

    setSettings((prev) => prev.map((item) => item.id === setting.id ? { ...item, setting_value: value } : item));
    toast.success('Configuração salva');
  };

  if (loading || !isAdmin) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold">Administração</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle de usuários, permissões e configurações do app.
          </p>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou email"
                  className="pl-9"
                />
              </div>
              <Badge variant="outline">{filteredUsers.length} usuários</Badge>
            </div>

            <div className="grid gap-4">
              {filteredUsers.map((user) => {
                const currentAdmin = user.is_admin === true;
                const isSaving = saving === user.id || saving === user.id + '_role';
                const statusStyle = STATUS_STYLES[user.approval_status] ?? 'border-border bg-muted text-muted-foreground';

                return (
                  <Card key={user.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Top accent bar */}
                      <div
                        className="h-1 w-full"
                        style={{
                          background: user.approval_status === 'approved'
                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                            : user.approval_status === 'rejected'
                            ? 'linear-gradient(90deg, #ef4444, #f87171)'
                            : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                        }}
                      />

                      <div className="p-4">
                        {/* Row 1: identity + badges */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex items-start gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-white"
                              style={{ background: 'linear-gradient(135deg, #1D4ED8, #4f46e5)' }}
                            >
                              {user.full_name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{user.full_name || 'Sem nome'}</p>
                              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyle}`}>
                                  {user.approval_status}
                                </span>
                                <Badge variant={currentAdmin ? 'default' : 'secondary'} className="text-[11px]">
                                  {currentAdmin ? '🛡️ Admin' : '👤 Usuário'}
                                </Badge>
                                {user.is_suspended && <Badge variant="destructive" className="text-[11px]">Suspenso</Badge>}
                              </div>
                            </div>
                          </div>

                          {/* Meta: último acesso */}
                          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground shrink-0 mt-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {user.last_seen_at
                                ? formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true, locale: ptBR })
                                : 'Nunca acessou'}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: action buttons */}
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                          <Button
                            size="sm" variant="secondary"
                            onClick={() => updateApproval(user.id, 'approved', user.full_name)}
                            disabled={isSaving || user.approval_status === 'approved'}
                            className="gap-1"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Aprovar
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => updateApproval(user.id, 'pending', user.full_name)}
                            disabled={isSaving || user.approval_status === 'pending'}
                            className="gap-1"
                          >
                            <Shield className="h-3.5 w-3.5" /> Pendente
                          </Button>
                          <Button
                            size="sm" variant="destructive"
                            onClick={() => updateApproval(user.id, 'rejected', user.full_name)}
                            disabled={isSaving || user.approval_status === 'rejected'}
                            className="gap-1"
                          >
                            <UserX className="h-3.5 w-3.5" /> Rejeitar
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => toggleAdminRole(user.id, currentAdmin, user.full_name)}
                            disabled={isSaving}
                          >
                            {currentAdmin ? 'Remover Admin' : 'Tornar Admin'}
                          </Button>

                          <div className="ml-auto flex gap-2">
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => navigate(`/admin/users/${user.id}`)}
                              className="gap-1 text-primary hover:text-primary"
                            >
                              <Eye className="h-3.5 w-3.5" /> Ver Perfil
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => navigate(`/admin/users/${user.id}?action=impersonate`)}
                              className="gap-1 text-amber-600 hover:text-amber-600 dark:text-amber-400"
                            >
                              <Monitor className="h-3.5 w-3.5" /> Suporte
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6 space-y-4">
            {settings.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Nenhuma configuração cadastrada.
                </CardContent>
              </Card>
            ) : (
              settings.map((setting) => (
                <Card key={setting.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Settings2 className="h-4 w-4" />
                      {setting.setting_key}
                    </CardTitle>
                    {setting.description && (
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
                    <Input
                      value={setting.setting_value}
                      onChange={(e) =>
                        setSettings((prev) =>
                          prev.map((item) =>
                            item.id === setting.id ? { ...item, setting_value: e.target.value } : item
                          )
                        )
                      }
                    />
                    <Button
                      onClick={() => updateSetting(setting, setting.setting_value)}
                      disabled={saving === setting.setting_key}
                    >
                      <Save className="mr-2 h-4 w-4" /> Salvar
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
