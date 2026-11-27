import { useId } from 'react';

interface RivifyLogoMarkProps {
  size?: number;
  className?: string;
}

export function RivifyLogoMark({ size = 32, className = '' }: RivifyLogoMarkProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `rivify-bg-${uid}`;
  const borderId = `rivify-border-${uid}`;
  const strokeId = `rivify-stroke-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-200 ${className}`}
    >
      <defs>
        <linearGradient id={bgId} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0E1015" />
          <stop offset="100%" stopColor="#171C28" />
        </linearGradient>
        <linearGradient id={borderId} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={strokeId} x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="38%" stopColor="#8B5CF6" />
          <stop offset="76%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${bgId})`} />
      <rect
        x="2.75"
        y="2.75"
        width="58.5"
        height="58.5"
        rx="15.25"
        stroke={`url(#${borderId})`}
        strokeWidth="1.5"
      />
      {/* Custom geometric R fused with a continuous infinity-inspired waist curve */}
      <path
        d="M18.5 47.25V17.75Q18.5 16.75 19.5 16.75H34C42.25 16.75 46 20.625 46 25.75C46 31 41.125 34.625 32.625 34.625C27.5 34.625 24.625 32.625 24.625 29.25C24.625 25.875 27.75 24.875 31.5 28C36.25 32 41 39.375 45.5 47.25"
        stroke={`url(#${strokeId})`}
        strokeWidth="4.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface RivifyBrandLockupProps {
  showTagline?: boolean;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

export function RivifyBrandLockup({
  showTagline = false,
  compact = false,
  onClick,
  className = '',
}: RivifyBrandLockupProps) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      <RivifyLogoMark
        size={compact ? 28 : 34}
        className="group-hover:scale-105 group-hover:drop-shadow-[0_0_12px_rgba(139,92,246,0.45)]"
      />
      <span className="flex flex-col text-left leading-none">
        <span
          className={`font-display font-bold tracking-[0.16em] text-slate-900 dark:text-white transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-300 whitespace-nowrap ${
            compact ? 'text-sm' : 'text-base'
          }`}
        >
          RIVIFY
        </span>
        {showTagline && (
          <span className="mt-1 text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Explore. Calculate. Master.
          </span>
        )}
      </span>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-xl"
      >
        {content}
      </button>
    );
  }

  return content;
}
