import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, Calculator, Check, Eraser, Loader2, Trash2 } from 'lucide-react';

export type ActionStatus = 'idle' | 'calculating' | 'success' | 'error';

interface CalculateActionButtonProps {
  label?: string;
  calculatingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  status: ActionStatus;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  size?: 'md' | 'sm';
  className?: string;
  ariaLabel?: string;
}

export function CalculateActionButton({
  label = 'Calculate',
  calculatingLabel = 'Calculating...',
  successLabel = 'Calculated',
  errorLabel = 'Check Input',
  status,
  type = 'button',
  onClick,
  disabled = false,
  icon,
  size = 'md',
  className = '',
  ariaLabel,
}: CalculateActionButtonProps) {
  const [pressedFlash, setPressedFlash] = useState(false);
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const isCalculating = status === 'calculating';
  const isDisabled = disabled || isCalculating;

  const triggerClickPulse = () => {
    setPressedFlash(true);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setPressedFlash(false), 220);
  };

  const sizeCls =
    size === 'sm'
      ? 'min-h-[40px] h-10 px-4 text-xs rounded-xl gap-1.5'
      : 'min-h-[48px] h-12 px-5 text-sm rounded-xl gap-2';

  let stateCls =
    'bg-gradient-to-r from-[#2F7CF6] via-[#2A72EC] to-[#2563EB] text-white ' +
    'shadow-[0_4px_14px_-2px_rgba(47,124,246,0.45),inset_0_1px_0_rgba(255,255,255,0.22)]';

  if (status === 'error') {
    stateCls =
      'bg-gradient-to-r from-rose-600 to-rose-500 text-white ' +
      'ring-2 ring-rose-400/60 shadow-[0_4px_14px_-2px_rgba(225,29,72,0.45)]';
  } else if (status === 'success') {
    stateCls =
      'bg-gradient-to-r from-[#2F7CF6] via-[#2573EE] to-emerald-600 text-white ' +
      'ring-2 ring-emerald-400/50 shadow-[0_6px_18px_-2px_rgba(16,185,129,0.35),inset_0_1px_0_rgba(255,255,255,0.22)]';
  }

  const interactiveCls = isDisabled
    ? 'opacity-85 cursor-not-allowed'
    : 'cursor-pointer hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-4px_rgba(47,124,246,0.58),inset_0_1px_0_rgba(255,255,255,0.26)] active:scale-[0.96] active:translate-y-0 active:brightness-95';

  const displayLabel = isCalculating
    ? calculatingLabel
    : status === 'success'
    ? successLabel
    : status === 'error'
    ? errorLabel
    : label;

  const displayIcon = isCalculating ? (
    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
  ) : status === 'success' ? (
    <Check className="w-4 h-4 shrink-0" />
  ) : status === 'error' ? (
    <AlertCircle className="w-4 h-4 shrink-0" />
  ) : (
    icon ?? <Calculator className="w-4 h-4 shrink-0" />
  );

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isCalculating}
      aria-label={ariaLabel ?? displayLabel}
      onClick={() => {
        if (isDisabled) return;
        triggerClickPulse();
        onClick?.();
      }}
      className={`font-semibold inline-flex items-center justify-center whitespace-nowrap select-none touch-manipulation transition-all duration-150 ease-out ${sizeCls} ${stateCls} ${interactiveCls} ${
        pressedFlash ? 'scale-[0.97] ring-2 ring-[#93C5FD]/80' : ''
      } ${className}`}
    >
      {displayIcon}
      <span>{displayLabel}</span>
    </button>
  );
}

interface ClearAllActionButtonProps {
  label?: string;
  clearedLabel?: string;
  cleared?: boolean;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'neutral' | 'danger';
  size?: 'md' | 'sm';
  icon?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function ClearAllActionButton({
  label = 'Clear All',
  clearedLabel = 'Cleared',
  cleared = false,
  onClick,
  disabled = false,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
  ariaLabel,
}: ClearAllActionButtonProps) {
  const [pressedFlash, setPressedFlash] = useState(false);
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const triggerClickPulse = () => {
    setPressedFlash(true);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setPressedFlash(false), 200);
  };

  const sizeCls =
    size === 'sm'
      ? 'min-h-[36px] h-9 px-3 text-xs rounded-xl gap-1.5'
      : 'min-h-[48px] h-12 px-4 text-sm rounded-xl gap-2';

  let styleCls = '';
  if (cleared) {
    styleCls =
      'border border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-xs';
  } else if (variant === 'danger') {
    styleCls =
      'border border-rose-500/25 dark:border-rose-400/25 bg-rose-500/5 text-rose-600 dark:text-rose-400 ' +
      'hover:bg-rose-500/12 hover:border-rose-500/45';
  } else {
    styleCls =
      'border border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-[#1B1E26] text-slate-700 dark:text-slate-200 ' +
      'hover:bg-slate-100 dark:hover:bg-[#282C38] hover:border-slate-400 dark:hover:border-white/35';
  }

  const interactiveCls = disabled
    ? 'opacity-45 cursor-not-allowed'
    : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.96] active:translate-y-0 active:brightness-95';

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      onClick={() => {
        if (disabled) return;
        triggerClickPulse();
        onClick();
      }}
      className={`font-medium inline-flex items-center justify-center whitespace-nowrap select-none touch-manipulation transition-all duration-150 ease-out ${sizeCls} ${styleCls} ${interactiveCls} ${
        pressedFlash ? 'scale-[0.96]' : ''
      } ${className}`}
    >
      {cleared ? (
        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        icon ??
        (variant === 'danger' ? (
          <Trash2 className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Eraser className="w-4 h-4 shrink-0" />
        ))
      )}
      <span>{cleared ? clearedLabel : label}</span>
    </button>
  );
}
