import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo, LogoHero } from '@/components/brand/Logo';

const validatePassword = (password: string) => ({
  minLength: password.length >= 8,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const isPasswordValid = useMemo(() =>
    Object.values(passwordValidation).every(Boolean),
    [passwordValidation]
  );

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: 'Bem-vindo de volta!' });
        navigate('/dashboard');
      } else {
        if (!isPasswordValid) {
          toast({ title: 'Senha inválida', description: 'Verifique os requisitos abaixo.', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast({ title: 'Conta criada!', description: 'Agora você já pode entrar com seu e-mail e senha.' });
        setIsLogin(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao autenticar.';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col items-center justify-center p-14"
        style={{ background: 'linear-gradient(135deg, #0D1829 0%, #0F172A 45%, #0A1020 100%)' }}
      >
        {/* Radial glows */}
        <div className="absolute top-1/4 left-1/6 w-72 h-72 rounded-full blur-3xl pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(30,64,175,0.30), transparent)' }} />
        <div className="absolute bottom-1/4 right-1/5 w-56 h-56 rounded-full blur-3xl pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.14), transparent)' }} />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)', backgroundSize: '48px 48px' }}
        />

        {/* Gold left accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'linear-gradient(to bottom, #D4AF37, #B8860B)' }} />

        <div className="relative z-10 text-center space-y-10 max-w-md">
          {/* Logo hero */}
          <LogoHero />

          {/* Feature list */}
          <div className="space-y-3.5 text-left">
            {[
              'Assistente de IA multi-modelo',
              'Agentes especializados por área',
              'Leitura universal de documentos (PDF, DOCX…)',
              'Corretor jurídico inteligente',
              'Gestão de casos e processos',
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.35)' }}
                >
                  <Check className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                </div>
                <span className="text-slate-300 text-[16px]">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-[26rem] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-2xl shadow-slate-200/60 dark:shadow-slate-900/60 space-y-7">
          {/* Mobile header */}
          <div className="lg:hidden flex justify-center mb-2">
            <Logo variant="full" size="md" />
          </div>

          <div>
            <h2 className="text-[26px] font-bold tracking-tight">
              {isLogin ? 'Entrar na plataforma' : 'Criar conta'}
            </h2>
            <p className="text-[15px] text-muted-foreground mt-1.5">
              {isLogin
                ? 'Use suas credenciais para acessar'
                : 'Informe nome, e-mail e senha para criar sua conta'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-[15px] font-medium">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 text-[15px]"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[15px] font-medium">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-12 text-[15px]"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-[15px] font-medium">Senha</Label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) {
                        toast({ title: 'Informe o e-mail', description: 'Digite seu e-mail acima.', variant: 'destructive' });
                        return;
                      }
                      try {
                        const { error } = await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: `${window.location.origin}/reset-password`,
                        });
                        if (error) throw error;
                        toast({ title: 'E-mail enviado!', description: 'Verifique sua caixa de entrada.' });
                      } catch (err) {
                        const message = err instanceof Error ? err.message : 'Falha ao enviar e-mail.';
                        toast({ title: 'Erro', description: message, variant: 'destructive' });
                      }
                    }}
                    className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                  className="h-12 text-[15px] pr-12"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>

              {!isLogin && password.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2.5">
                  {([
                    [passwordValidation.minLength, '8+ caracteres'],
                    [passwordValidation.hasUppercase, 'Maiúscula'],
                    [passwordValidation.hasLowercase, 'Minúscula'],
                    [passwordValidation.hasNumber, 'Número'],
                  ] as [boolean, string][]).map(([ok, label]) => (
                    <div key={label} className={cn('flex items-center gap-2 text-[13px]', ok ? 'text-emerald-600' : 'text-muted-foreground')}>
                      {ok
                        ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        : <X className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      }
                      {label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-[16px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-500/25 transition-all rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2.5">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processando…
                </span>
              ) : isLogin ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setPassword(''); }}
              className="text-[15px] text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              {isLogin
                ? <><span>Não tem conta? </span><span className="text-emerald-700 dark:text-emerald-400 font-semibold">Cadastre-se</span></>
                : <><span>Já tem conta? </span><span className="text-emerald-700 dark:text-emerald-400 font-semibold">Faça login</span></>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
