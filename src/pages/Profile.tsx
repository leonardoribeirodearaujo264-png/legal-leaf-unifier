import { useEffect, useState, type ChangeEvent } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Upload, Lock, Save, UserCircle } from 'lucide-react';

interface HistoryItem {
  id: string;
  tool_name: string | null;
  module: string | null;
  action: string;
  created_at: string;
}

export default function Profile() {
  const { user } = useAuth();
  const { profile, isAdmin } = useUserRole();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setAvatarPreview(profile.avatar_url || '');
    }
  }, [profile]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('usage_history')
        .select('id, tool_name, module, action, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setHistory((data || []) as HistoryItem[]);
    };

    loadHistory();
  }, [user]);

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !user) return avatarUrl;

    const ext = avatarFile.name.split('.').pop() || 'png';
    const filePath = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast.error('Informe seu nome.');
      return;
    }
    if (password && password !== confirmPassword) {
      toast.error('As senhas não conferem.');
      return;
    }

    setSaving(true);
    try {
      let nextAvatarUrl = avatarUrl;
      if (avatarFile) {
        nextAvatarUrl = await uploadAvatar();
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          avatar_url: nextAvatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw passwordError;
      }

      setAvatarUrl(nextAvatarUrl);
      setAvatarFile(null);
      setPassword('');
      setConfirmPassword('');
      toast.success('Perfil atualizado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar perfil.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold">Meu Perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualize seus dados básicos e a senha de acesso.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                Dados da conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarPreview || avatarUrl || ''} />
                  <AvatarFallback className="text-lg">
                    {(fullName || user?.email || '?')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label htmlFor="avatar">Foto de perfil</Label>
                  <Input id="avatar" type="file" accept="image/*" onChange={handleAvatarChange} />
                  <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP até 5MB.</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{profile?.approval_status || 'approved'}</Badge>
                  <Badge variant={isAdmin ? 'default' : 'secondary'}>{isAdmin ? 'Admin' : 'Usuário'}</Badge>
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar perfil'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Alterar senha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nova senha"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar senha</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a senha"
                />
              </div>
              <Button onClick={handleSave} variant="secondary" className="w-full">
                Atualizar senha
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente encontrada.</p>
            ) : (
              <div className="space-y-3">
                {history.map((item, index) => (
                  <div key={item.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{item.tool_name || item.module || 'Ferramenta'}</p>
                        <p className="text-xs text-muted-foreground">{item.action}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
