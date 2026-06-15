import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Eye, EyeOff, Phone } from 'lucide-react';
import { LogoHero } from '@/components/brand/Logo';
import { maskPhone } from '@/lib/masks';

const validatePassword = (pw: string) => ({
  minLength: pw.length >= 8,
  hasUppercase: /[A-Z]/.test(pw),
  hasLowercase: /[a-z]/.test(pw),
  hasNumber: /[0-9]/.test(pw),
});

function isValidWhatsApp(masked: string): boolean {
  const digits = masked.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return false;
  const ddd = parseInt(digits.substring(0, 2), 10);
  return ddd >= 11 && ddd <= 99;
}

const FEATURES = [
  { icon: '🤖', label: 'Assistente de IA multi-modelo' },
  { icon: '⚖️', label: 'Agentes jurídicos especializados' },
  { icon: '📄', label: 'Leitura universal de documentos (PDF, DOCX…)' },
  { icon: '✍️', label: 'Corretor jurídico inteligente' },
  { icon: '📁', label: 'Gestão de casos e processos' },
];

const INPUT_BASE: React.CSSProperties = {
  height: '52px',
  borderRadius: '14px',
  border: '1px solid #E2E8F0',
  padding: '0 16px',
  fontSize: '14px',
  color: '#0F172A',
  background: '#F8FAFF',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
  boxSizing: 'border-box',
};

const BTN_BASE: React.CSSProperties = {
  height: '52px',
  borderRadius: '14px',
  fontWeight: 700,
  fontSize: '15px',
  background: 'linear-gradient(135deg, #1E40AF, #2563EB)',
  boxShadow: '0 10px 25px rgba(37,99,235,0.25)',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
  color: '#fff',
  width: '100%',
  cursor: 'pointer',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '7px' }}>
      {children}
    </label>
  );
}

function Spinner() {
  return (
    <span style={{
      width: '18px', height: '18px',
      border: '2.5px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      display: 'inline-block',
      animation: 'auth-spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { setMounted(true); }, []);

  const pwValid = useMemo(() => validatePassword(password), [password]);
  const allPwOk = useMemo(() => Object.values(pwValid).every(Boolean), [pwValid]);
  const whatsappOk = isValidWhatsApp(whatsapp);

  const inputStyle = (field: string): React.CSSProperties => ({
    ...INPUT_BASE,
    ...(focused === field
      ? { borderColor: '#2563EB', boxShadow: '0 0 0 4px rgba(37,99,235,0.14)', background: '#fff' }
      : {}),
  });

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: 'Informe o e-mail', description: 'Digite seu e-mail acima antes de redefinir a senha.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'E-mail enviado!', description: 'Verifique sua caixa de entrada.' });
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao enviar e-mail.', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: 'Bem-vindo de volta!' });
        navigate('/dashboard');
        return;
      }

      // Registration
      if (!allPwOk) {
        toast({ title: 'Senha inválida', description: 'Verifique os requisitos de senha abaixo.', variant: 'destructive' });
        return;
      }
      if (!whatsappOk) {
        toast({ title: 'WhatsApp inválido', description: 'Informe um número de WhatsApp válido.', variant: 'destructive' });
        return;
      }

      const whatsappClean = whatsapp.replace(/\D/g, '');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: fullName, whatsapp: whatsappClean },
        },
      });
      if (error) throw error;

      if (data.session) {
        // Email confirmation disabled — immediate access
        toast({ title: 'Bem-vindo ao Tribuna IA! 🎉', description: 'Sua conta foi criada. Acesse agora.' });
        navigate('/dashboard');
      } else {
        toast({ title: 'Conta criada!', description: 'Confirme seu e-mail para acessar a plataforma.' });
        setIsLogin(true);
      }
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao autenticar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin((v) => !v);
    setPassword('');
    setWhatsapp('');
  };

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: '#EEF2FF',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.45s ease',
      }}
    >
      {/* ── Left panel — Branding ─────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[54%] relative overflow-hidden flex-col items-center justify-center p-14"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E40AF 100%)' }}
      >
        {/* Glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              width: '65%', height: '65%', top: '-12%', left: '-12%',
              background: 'radial-gradient(circle, rgba(37,99,235,0.35), transparent 70%)',
            }}
          />
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              width: '55%', height: '55%', bottom: '-12%', right: '-8%',
              background: 'radial-gradient(circle, rgba(212,175,55,0.18), transparent 70%)',
            }}
          />
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              width: '35%', height: '35%', top: '45%', right: '8%',
              background: 'radial-gradient(circle, rgba(30,64,175,0.22), transparent 70%)',
            }}
          />
        </div>

        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Gold accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{ width: '3px', background: 'linear-gradient(to bottom, #F0C040, #C49A0A)' }}
        />

        {/* Content */}
        <div className="relative z-10 text-center space-y-9 max-w-[420px]">
          <LogoHero />

          <p style={{ fontSize: '17px', lineHeight: '1.7', color: 'rgba(148,163,184,0.95)' }}>
            Automatize sua advocacia com agentes inteligentes, análise jurídica avançada e geração de peças com IA.
          </p>

          <div className="space-y-3 text-left">
            {FEATURES.map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3.5">
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[16px]"
                  style={{
                    background: 'rgba(212,175,55,0.13)',
                    border: '1px solid rgba(212,175,55,0.32)',
                  }}
                >
                  {icon}
                </div>
                <span style={{ fontSize: '15px', color: 'rgba(203,213,225,0.92)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — Form ────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[29rem]">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <LogoHero />
          </div>

          {/* Card */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              border: '1px solid rgba(212,175,55,0.25)',
              boxShadow: '0 20px 60px rgba(15,23,42,0.12)',
              padding: isLogin ? '40px' : '36px 40px',
            }}
          >
            {/* Title */}
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.4px', color: '#0F172A', margin: 0 }}>
                {isLogin ? 'Entrar na Plataforma' : 'Criar Conta'}
              </h2>
              <p style={{ fontSize: '14px', color: '#64748B', marginTop: '6px' }}>
                {isLogin
                  ? 'Use suas credenciais para acessar'
                  : 'Preencha os dados abaixo para criar sua conta gratuita'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Nome completo — register only */}
              {!isLogin && (
                <div>
                  <FieldLabel>Nome Completo *</FieldLabel>
                  <input
                    type="text"
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                    required
                    disabled={loading}
                    style={inputStyle('name')}
                  />
                </div>
              )}

              {/* E-mail */}
              <div>
                <FieldLabel>E-mail *</FieldLabel>
                <input
                  type="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  required
                  disabled={loading}
                  autoComplete="email"
                  style={inputStyle('email')}
                />
              </div>

              {/* WhatsApp — register only */}
              {!isLogin && (
                <div>
                  <FieldLabel>WhatsApp *</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <Phone
                      style={{
                        position: 'absolute', left: '15px', top: '50%',
                        transform: 'translateY(-50%)',
                        width: '16px', height: '16px',
                        color: focused === 'whatsapp' ? '#2563EB' : '#94A3B8',
                        pointerEvents: 'none',
                        transition: 'color 0.2s',
                      }}
                    />
                    <input
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                      onFocus={() => setFocused('whatsapp')}
                      onBlur={() => setFocused(null)}
                      required
                      disabled={loading}
                      maxLength={15}
                      style={{ ...inputStyle('whatsapp'), paddingLeft: '42px' }}
                    />
                  </div>
                  {whatsapp.length > 4 && !whatsappOk && (
                    <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <X style={{ width: '12px', height: '12px' }} />
                      Informe um número de WhatsApp válido.
                    </p>
                  )}
                  {whatsapp.length > 4 && whatsappOk && (
                    <p style={{ fontSize: '12px', color: '#059669', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check style={{ width: '12px', height: '12px' }} />
                      Número válido
                    </p>
                  )}
                </div>
              )}

              {/* Senha */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                  <FieldLabel>Senha *</FieldLabel>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={loading}
                      style={{
                        fontSize: '13px', color: '#2563EB',
                        background: 'none', border: 'none',
                        cursor: 'pointer', padding: 0,
                        marginBottom: '7px',
                      }}
                    >
                      Esqueceu sua senha?
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    required
                    disabled={loading}
                    minLength={8}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    style={{ ...inputStyle('password'), paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute', right: '13px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: '#94A3B8', padding: '4px',
                    }}
                  >
                    {showPassword
                      ? <EyeOff style={{ width: '17px', height: '17px' }} />
                      : <Eye style={{ width: '17px', height: '17px' }} />
                    }
                  </button>
                </div>

                {/* Password checklist — register only */}
                {!isLogin && password.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '10px' }}>
                    {([
                      [pwValid.minLength, '8+ caracteres'],
                      [pwValid.hasUppercase, 'Maiúscula'],
                      [pwValid.hasLowercase, 'Minúscula'],
                      [pwValid.hasNumber, 'Número'],
                    ] as [boolean, string][]).map(([ok, label]) => (
                      <div
                        key={label}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: ok ? '#059669' : '#94A3B8' }}
                      >
                        {ok
                          ? <Check style={{ width: '13px', height: '13px', flexShrink: 0, color: '#059669' }} />
                          : <X style={{ width: '13px', height: '13px', flexShrink: 0, color: '#CBD5E1' }} />
                        }
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{ ...BTN_BASE, marginTop: '6px', opacity: loading ? 0.75 : 1 }}
                onMouseEnter={(e) => {
                  if (loading) return;
                  const el = e.currentTarget;
                  el.style.transform = 'translateY(-2px)';
                  el.style.boxShadow = '0 15px 35px rgba(37,99,235,0.38)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = '0 10px 25px rgba(37,99,235,0.25)';
                }}
              >
                {loading ? <><Spinner /> Processando…</> : isLogin ? 'Entrar' : 'Criar Conta Gratuita'}
              </button>
            </form>

            {/* Divider */}
            <div style={{ borderTop: '1px solid #F1F5F9', margin: '22px 0 0' }} />

            {/* Switch mode */}
            <div style={{ textAlign: 'center', paddingTop: '18px' }}>
              <button
                type="button"
                onClick={switchMode}
                disabled={loading}
                style={{ fontSize: '14px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {isLogin
                  ? <><span>Não possui conta? </span><span style={{ color: '#2563EB', fontWeight: 600 }}>Criar conta</span></>
                  : <><span>Já tem conta? </span><span style={{ color: '#2563EB', fontWeight: 600 }}>Fazer login</span></>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes auth-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
