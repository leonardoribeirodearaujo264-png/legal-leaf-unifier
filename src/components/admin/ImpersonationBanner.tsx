import { useNavigate } from 'react-router-dom';
import { Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export function ImpersonationBanner() {
  const { user } = useAuth();
  const { impersonation, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();

  if (!impersonation.isActive) return null;

  const handleStop = async () => {
    if (user) await stopImpersonation(user.id);
    navigate('/admin');
  };

  return (
    <div
      className="relative flex items-center justify-between gap-4 px-5 py-2.5 text-white"
      style={{
        background: 'linear-gradient(90deg, #92400e 0%, #b45309 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Shield className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium truncate">
          Modo suporte ativo — você está acessando como{' '}
          <strong>{impersonation.targetUserName}</strong>
          {impersonation.targetUserEmail && (
            <span className="opacity-75 font-normal ml-1">({impersonation.targetUserEmail})</span>
          )}
        </span>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={handleStop}
        className="shrink-0 h-7 gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
        Encerrar acesso assistido
      </Button>
    </div>
  );
}
