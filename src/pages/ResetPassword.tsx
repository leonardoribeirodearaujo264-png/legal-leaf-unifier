import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, X, ArrowLeft } from 'lucide-react';
import logoEggNunes from '@/assets/logo-eggnunes.png';

const validatePassword = (password: string) => ({
  minLength: password.length >= 8,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
});

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const isPasswordValid = useMemo(() => Object.values(passwordValidation).every(Boolean), [passwordValidation]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      toast({ title: 'Senha inválida', description: 'A senha não atende os requisitos mínimos.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Senhas não conferem', description: 'A confirmação de senha deve ser igual à nova senha.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      toast({ title: 'Senha redefinida!', description: 'Sua senha foi alterada com sucesso.' });
      setTimeout(() => navigate('/auth'), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível redefinir a senha.';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <img src={logoEggNunes} alt="Egg Nunes Advogados" className="h-16 mx-auto" />
            <CardTitle className="text-2xl">Senha Redefinida!</CardTitle>
            <CardDescription>Sua senha foi alterada com sucesso. Você será redirecionado para o login.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/auth')}>
              Ir para o Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img src={logoEggNunes} alt="Egg Nunes Advogados" className="h-16 mx-auto" />
          <div>
            <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
            <CardDescription>Digite sua nova senha abaixo</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
              />
              {password.length > 0 && (
                <div className="text-xs space-y-1 mt-2 p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-muted-foreground mb-1">Requisitos da senha:</p>
                  {[
                    { key: 'minLength', label: 'Mínimo 8 caracteres' },
                    { key: 'hasUppercase', label: 'Uma letra maiúscula' },
                    { key: 'hasLowercase', label: 'Uma letra minúscula' },
                    { key: 'hasNumber', label: 'Um número' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-1.5">
                      {passwordValidation[key as keyof typeof passwordValidation] ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <X className="h-3 w-3 text-destructive" />
                      )}
                      <span className={passwordValidation[key as keyof typeof passwordValidation] ? 'text-emerald-600' : 'text-muted-foreground'}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !isPasswordValid}>
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => navigate('/auth')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para o login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
