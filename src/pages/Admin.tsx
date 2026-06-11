import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, UserCheck, UserX, Search, Settings2, Save, Loader2 } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  approval_status: string;
  is_active: boolean | null;
  is_suspended: boolean | null;
  avatar_url: string | null;
  is_admin?: boolean;
}

interface AppSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
}

interface RoleRow {
  user_id: string;
  role: string;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  approval_status: string;
  is_active: boolean | null;
  is_suspended: boolean | null;
  avatar_url: string | null;
}

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useUserRole();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    const loadData = async () => {
      const [usersRes, rolesRes, settingsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, full_name, approval_status, is_active, is_suspended, avatar_url')
          .order('full_name', { ascending: true }),
        supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('role', 'admin'),
        supabase
          .from('app_settings')
          .select('id, setting_key, setting_value, description')
          .order('setting_key', { ascending: true }),
      ]);

      const adminIds = new Set(((rolesRes.data || []) as RoleRow[]).map((role) => role.user_id));
      setUsers(((usersRes.data || []) as ProfileRow[]).map((user) => ({ ...user, is_admin: adminIds.has(user.id) })));
      setSettings(settingsRes.data || []);
    };

    loadData();
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.full_name, user.email, user.approval_status]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [search, users]);

  const updateApproval = async (userId: string, approval_status: string) => {
    setSaving(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status, updated_at: new Date().toISOString() })
      .eq('id', userId);
    setSaving(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, approval_status } : user)));
    toast.success('Status atualizado');
  };

  const toggleAdminRole = async (userId: string, currentIsAdmin: boolean) => {
    setSaving(userId);
    const result = currentIsAdmin
      ? await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin')
      : await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
    setSaving(null);

    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, is_admin: !currentIsAdmin } : user)));
    toast.success(currentIsAdmin ? 'Admin removido' : 'Admin concedido');
  };

  const updateSetting = async (setting: AppSetting, value: string) => {
    setSaving(setting.setting_key);
    const { error } = await supabase
      .from('app_settings')
      .update({ setting_value: value, updated_at: new Date().toISOString() })
      .eq('id', setting.id);
    setSaving(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSettings((prev) =>
      prev.map((item) => (item.id === setting.id ? { ...item, setting_value: value } : item))
    );
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

                return (
                  <Card key={user.id}>
                    <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{user.full_name || 'Sem nome'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">{user.approval_status}</Badge>
                          <Badge variant={currentAdmin ? 'default' : 'secondary'}>
                            {currentAdmin ? 'Admin' : 'Usuário'}
                          </Badge>
                          {user.is_suspended ? <Badge variant="destructive">Suspenso</Badge> : null}
                          {user.is_active === false ? <Badge variant="outline">Inativo</Badge> : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateApproval(user.id, 'approved')}
                          disabled={saving === user.id}
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateApproval(user.id, 'pending')}
                          disabled={saving === user.id}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Pendente
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateApproval(user.id, 'rejected')}
                          disabled={saving === user.id}
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Rejeitar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => toggleAdminRole(user.id, currentAdmin)}
                          disabled={saving === user.id}
                        >
                          {currentAdmin ? 'Remover admin' : 'Tornar admin'}
                        </Button>
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
                    <Button onClick={() => updateSetting(setting, setting.setting_value)} disabled={saving === setting.setting_key}>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar
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
