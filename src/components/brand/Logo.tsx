import { cn } from '@/lib/utils';
import { BRAND } from '@/config/branding';

interface LogoProps {
  variant?: 'full' | 'compact' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  iconClassName?: string;
}

const sizeMap = {
  xs: { icon: 24, title: 'text-sm', subtitle: 'text-[10px]', gap: 'gap-1.5' },
  sm: { icon: 32, title: 'text-base', subtitle: 'text-[11px]', gap: 'gap-2' },
  md: { icon: 40, title: 'text-lg', subtitle: 'text-xs', gap: 'gap-2.5' },
  lg: { icon: 56, title: 'text-2xl', subtitle: 'text-sm', gap: 'gap-3' },
  xl: { icon: 80, title: 'text-4xl', subtitle: 'text-base', gap: 'gap-4' },
};

function ScaleIcon({ size, className }: { size: number; className?: string }) {
  const g = (n: number) => (n * size) / 48;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="tribuna-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0C040" />
          <stop offset="100%" stopColor="#B8860B" />
        </linearGradient>
        <radialGradient id="tribuna-bg" cx="30%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#1A2744" />
          <stop offset="100%" stopColor="#0F172A" />
        </radialGradient>
      </defs>

      {/* Background rounded square */}
      <rect width="48" height="48" rx={g(10)} fill="url(#tribuna-bg)" />

      {/* Subtle inner ring */}
      <rect
        x="2" y="2" width="44" height="44" rx={g(9)}
        fill="none"
        stroke="rgba(212,175,55,0.18)"
        strokeWidth="1"
      />

      {/* Top knob */}
      <circle cx="24" cy="8" r="2.5" fill="url(#tribuna-gold)" />

      {/* Center pole */}
      <rect x="22.5" y="8" width="3" height="24" rx="1.5" fill="url(#tribuna-gold)" />

      {/* Crossbeam */}
      <rect x="6" y="18" width="36" height="2.5" rx="1.25" fill="url(#tribuna-gold)" />

      {/* Beam end caps */}
      <circle cx="6" cy="19.25" r="2.5" fill="url(#tribuna-gold)" />
      <circle cx="42" cy="19.25" r="2.5" fill="url(#tribuna-gold)" />

      {/* Left cord */}
      <rect x="5" y="21.5" width="2" height="9" rx="1" fill="url(#tribuna-gold)" opacity="0.85" />

      {/* Right cord */}
      <rect x="41" y="21.5" width="2" height="9" rx="1" fill="url(#tribuna-gold)" opacity="0.85" />

      {/* Left pan */}
      <path
        d="M0 30.5 Q6 38 12 30.5"
        stroke="url(#tribuna-gold)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Right pan */}
      <path
        d="M36 30.5 Q42 38 48 30.5"
        stroke="url(#tribuna-gold)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Base foot */}
      <rect x="18" y="32" width="12" height="2.5" rx="1.25" fill="url(#tribuna-gold)" opacity="0.9" />

      {/* IA label */}
      <text
        x="24"
        y="44"
        fontFamily="Georgia, serif"
        fontSize="8"
        fontWeight="700"
        fill="#D4AF37"
        textAnchor="middle"
        letterSpacing="1.5"
      >
        IA
      </text>
    </svg>
  );
}

export function Logo({ variant = 'full', size = 'md', className, iconClassName }: LogoProps) {
  const s = sizeMap[size];

  if (variant === 'icon') {
    return <ScaleIcon size={s.icon} className={cn(iconClassName, className)} />;
  }

  return (
    <div className={cn('flex items-center', s.gap, className)}>
      <ScaleIcon size={s.icon} className={cn('flex-shrink-0', iconClassName)} />

      {variant === 'full' ? (
        <div className="min-w-0">
          <p className={cn('font-bold leading-tight text-foreground truncate', s.title)}>
            {BRAND.name}
          </p>
          <p className={cn('text-muted-foreground truncate', s.subtitle)}>
            {BRAND.slogan}
          </p>
        </div>
      ) : (
        <p className={cn('font-bold leading-tight text-foreground truncate', s.title)}>
          {BRAND.name}
        </p>
      )}
    </div>
  );
}

export function LogoHero({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <ScaleIcon size={80} />
      <h1 className="mt-5 text-5xl font-bold tracking-tight">
        Tribuna <span style={{ color: '#D4AF37' }}>IA</span>
      </h1>
      <p className="mt-2 text-lg text-white/70">{BRAND.slogan} para Advogados</p>
    </div>
  );
}
