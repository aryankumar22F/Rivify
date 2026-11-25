interface RivifyLogoMarkProps {
  size?: number;
  className?: string;
}

export function RivifyLogoMark({ size = 32, className = '' }: RivifyLogoMarkProps) {
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
        <linearGradient id="rivify-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0E1015" />
          <stop offset="100%" stopColor="#1A2940" />
        </linearGradient>
        <linearGradient id="rivify-stroke" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#2F7CF6" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#rivify-bg)" />
      <rect
        x="2.75"
        y="2.75"
        width="58.5"
        height="58.5"
        rx="15.25"
        stroke="#38BDF8"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      {/* Geometric R stem + infinity-inspired continuous loop & vector leg */}
      <path
        d="M20 47V17H33.5C40.4 17 45 21 45 26.8C45 32.2 40.6 35.8 33.8 35.8H22.5"
        stroke="url(#rivify-stroke)"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28.5 35.8C34.5 35.8 39 39.2 44.5 47"
        stroke="url(#rivify-stroke)"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Subtle infinity inflection node */}
      <circle cx="33.5" cy="26.8" r="2.6" fill="#38BDF8" />
      <circle cx="44.8" cy="47" r="2.2" fill="#10B981" />
    </svg>
  );
}

interface RivifyBrandLockupProps {
  showTagline?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function RivifyBrandLockup({
  showTagline = false,
  compact = false,
  onClick,
}: RivifyBrandLockupProps) {
  const content = (
    <span className="inline-flex items-center gap-2.5 group select-none">
      <RivifyLogoMark
        size={compact ? 28 : 34}
        className="group-hover:scale-105 group-hover:drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]"
      />
      <span className="flex flex-col text-left leading-none">
        <span
          className={`font-display font-bold tracking-[0.14em] text-slate-900 dark:text-white transition-colors group-hover:text-[#2F7CF6] dark:group-hover:text-[#60A5FA] ${
            compact ? 'text-sm' : 'text-base'
          }`}
        >
          RIVIFY
        </span>
        {showTagline && (
          <span className="mt-1 text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-400">
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
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F7CF6] rounded-xl"
      >
        {content}
      </button>
    );
  }

  return content;
}
