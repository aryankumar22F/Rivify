import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BookmarkPlus,
  Calculator,
  Check,
  Copy,
  Delete,
  FileOutput,
  History,
  LineChart,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';
import { ClearAllActionButton, type ActionStatus } from './ActionButtons';
import {
  evaluateScientificExpression,
  formatScientificInputLatex,
  toSolverExpression,
  type ScientificEvaluation,
} from '../engine/scientific';
import type { AngleUnit, AppSettings, ScientificHistoryItem } from '../types';
import { triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface ScientificCalculatorViewProps {
  settings: AppSettings;
  history: ScientificHistoryItem[];
  externalExpr?: { expr: string; nonce: number } | null;
  onSaveResult: (item: ScientificHistoryItem) => void;
  onClearHistory: () => void;
  onSendToSolver: (expr: string) => void;
  onSendToGraph: (expr: string) => void;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
  onSendToExport: (item: { heading: string; plainText: string; latex?: string }) => void;
}

const PRECISION_OPTIONS = [2, 4, 6, 8, 10] as const;

export function ScientificCalculatorView({
  settings,
  history,
  externalExpr,
  onSaveResult,
  onClearHistory,
  onSendToSolver,
  onSendToGraph,
  onSaveToNotebook,
  onSendToExport,
}: ScientificCalculatorViewProps) {
  const [expr, setExpr] = useState('sin(pi/6) + sqrt(16) * 2^3');
  const [angleUnit, setAngleUnit] = useState<AngleUnit>(settings.angleUnit);
  const [precision, setPrecision] = useState<number>(Math.max(4, settings.precision));
  const [memory, setMemory] = useState<number>(0);
  const [ans, setAns] = useState<number>(0);
  const [secondMode, setSecondMode] = useState(false);
  const [evaluated, setEvaluated] = useState<ScientificEvaluation | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [evalStatus, setEvalStatus] = useState<ActionStatus>('idle');
  const [clearedNotice, setClearedNotice] = useState(false);
  const [tapeClearedNotice, setTapeClearedNotice] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const evalLockRef = useRef(false);
  const evalTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const tapeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (evalTimerRef.current) window.clearTimeout(evalTimerRef.current);
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      if (tapeTimerRef.current) window.clearTimeout(tapeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (externalExpr && externalExpr.expr.trim()) {
      setExpr(externalExpr.expr);
      try {
        const res = evaluateScientificExpression(externalExpr.expr, {
          angleUnit,
          precision,
          ansValue: ans,
        });
        setEvaluated(res);
        setEvalError(null);
      } catch {
        setEvaluated(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalExpr?.nonce]);

  const livePreview = useMemo(() => {
    if (!expr.trim()) return { res: null as ScientificEvaluation | null, error: null as string | null };
    try {
      const res = evaluateScientificExpression(expr, { angleUnit, precision, ansValue: ans });
      return { res, error: null };
    } catch (e) {
      return {
        res: null,
        error: e instanceof Error ? e.message : 'Invalid expression',
      };
    }
  }, [expr, angleUnit, precision, ans]);

  const handleEquals = useCallback(async () => {
    if (evalLockRef.current) return;
    evalLockRef.current = true;
    if (evalTimerRef.current) window.clearTimeout(evalTimerRef.current);
    setClearedNotice(false);
    setEvalError(null);
    setEvalStatus('calculating');
    triggerHaptic(settings.hapticsEnabled, 12);

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 120);
      });
    });

    try {
      const res = evaluateScientificExpression(expr, { angleUnit, precision, ansValue: ans });
      setEvaluated(res);
      setEvalError(null);
      setAns(res.value);
      onSaveResult({
        id: `sci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        expression: res.expression,
        result: res.decimalFormatted,
        numericValue: res.value,
        angleUnit,
        timestamp: Date.now(),
      });
      setEvalStatus('success');
      evalTimerRef.current = window.setTimeout(() => setEvalStatus('idle'), 1600);
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : 'Invalid expression');
      setEvalStatus('error');
      evalTimerRef.current = window.setTimeout(() => setEvalStatus('idle'), 1800);
    } finally {
      evalLockRef.current = false;
    }
  }, [expr, angleUnit, precision, ans, settings.hapticsEnabled, onSaveResult]);

  const insertToken = useCallback((token: string) => {
    triggerHaptic(settings.hapticsEnabled, 6);
    setEvalError(null);
    setClearedNotice(false);
    setExpr((prev) => prev + token);
  }, [settings.hapticsEnabled]);

  const handleBackspace = useCallback(() => {
    setEvalError(null);
    setExpr((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    triggerHaptic(settings.hapticsEnabled, 8);
    if (evalTimerRef.current) window.clearTimeout(evalTimerRef.current);
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    setEvalError(null);
    setEvaluated(null);
    setEvalStatus('idle');
    setExpr('');
    setClearedNotice(true);
    clearTimerRef.current = window.setTimeout(() => setClearedNotice(false), 2000);
  }, [settings.hapticsEnabled]);

  // Keyboard shortcuts when input is not explicitly focused (avoid double typing when focused)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingField =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (isEditingField) {
        if (target === inputRef.current && e.key === 'Enter') {
          e.preventDefault();
          handleEquals();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9+\-*/^().,%!]$/.test(e.key)) {
        e.preventDefault();
        insertToken(e.key);
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleEquals, insertToken, handleBackspace, handleClear]);

  const activeResult = evaluated ?? livePreview.res;

  const sciButtons: { label: string; token: string; title?: string }[] = secondMode
    ? [
        { label: 'sin⁻¹', token: 'asin(' },
        { label: 'cos⁻¹', token: 'acos(' },
        { label: 'tan⁻¹', token: 'atan(' },
        { label: 'sinh', token: 'sinh(' },
        { label: 'cosh', token: 'cosh(' },
        { label: 'tanh', token: 'tanh(' },
        { label: 'sinh⁻¹', token: 'asinh(' },
        { label: 'cosh⁻¹', token: 'acosh(' },
        { label: 'tanh⁻¹', token: 'atanh(' },
        { label: 'log₂', token: 'log2(' },
        { label: 'eˣ', token: 'exp(' },
        { label: 'ⁿ√x', token: 'root(', title: 'root(n, x)' },
        { label: 'nPr', token: 'npr(', title: 'npr(n, r)' },
        { label: 'nCr', token: 'ncr(', title: 'ncr(n, r)' },
        { label: 'mod', token: ' mod ' },
      ]
    : [
        { label: 'sin', token: 'sin(' },
        { label: 'cos', token: 'cos(' },
        { label: 'tan', token: 'tan(' },
        { label: 'ln', token: 'ln(' },
        { label: 'log', token: 'log(' },
        { label: '√', token: 'sqrt(' },
        { label: '∛', token: 'cbrt(' },
        { label: 'x²', token: '^2' },
        { label: 'xʸ', token: '^' },
        { label: 'n!', token: '!' },
        { label: '|x|', token: 'abs(' },
        { label: 'π', token: 'pi' },
        { label: 'e', token: 'e' },
        { label: 'Ans', token: 'ans' },
        { label: ',', token: ', ' },
      ];

  const handleCopyResult = async () => {
    if (!activeResult) return;
    try {
      await navigator.clipboard.writeText(activeResult.decimalFormatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#2F7CF6]" />
            Scientific Calculator
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Full scientific expression evaluator with DEG/RAD modes, exact fraction conversion, memory registers, keyboard input, and direct integration with Solver &amp; Grapher.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#22252E] border border-slate-200 dark:border-white/10">
            {(['rad', 'deg'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => setAngleUnit(unit)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase transition-colors ${
                  angleUnit === unit
                    ? 'bg-[#2F7CF6] text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#22252E] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5">
            <span>Precision</span>
            <select
              value={precision}
              onChange={(e) => setPrecision(Number(e.target.value))}
              className="bg-transparent font-mono font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              {PRECISION_OPTIONS.map((p) => (
                <option key={p} value={p} className="bg-white dark:bg-[#191C24]">
                  {p} dp
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Calculator Body */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          {/* Display Screen */}
          <div className="rounded-2xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>
                MODE: <strong className="text-slate-800 dark:text-slate-200 uppercase">{angleUnit}</strong> · MEM:{' '}
                <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{memory}</strong> · ANS:{' '}
                <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{Number(ans.toFixed(4))}</strong>
              </span>
              {evalStatus === 'calculating' ? (
                <span className="inline-flex items-center gap-1 text-[#2F7CF6] font-semibold">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Calculating...
                </span>
              ) : clearedNotice ? (
                <span role="status" className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Check className="w-3 h-3" />
                  Cleared successfully
                </span>
              ) : evalStatus === 'success' ? (
                <span role="status" className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Check className="w-3 h-3" />
                  Evaluated
                </span>
              ) : (
                <span>Keyboard enabled (Enter = evaluate)</span>
              )}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={expr}
              onChange={(e) => {
                setExpr(e.target.value);
                setEvalError(null);
              }}
              placeholder="Enter expression, e.g. sin(30) + 3/4 + 5!"
              aria-label="Scientific expression input"
              className="w-full bg-transparent font-mono text-base sm:text-lg text-slate-900 dark:text-white focus:outline-none border-b border-slate-200 dark:border-white/10 pb-2"
            />

            {expr.trim() && (
              <div className="text-xs text-slate-500 dark:text-slate-400 overflow-x-auto py-0.5">
                <MathTex tex={formatScientificInputLatex(expr)} />
              </div>
            )}

            {evalError || livePreview.error ? (
              <div
                role="alert"
                className="text-xs text-rose-600 dark:text-rose-300 font-medium pt-1"
              >
                {evalError || livePreview.error}
              </div>
            ) : activeResult ? (
              <div className="pt-1 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums break-all">
                    = {activeResult.decimalFormatted}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {activeResult.fractionFormatted &&
                      activeResult.fractionFormatted !== activeResult.decimalFormatted && (
                        <span>
                          Fraction:{' '}
                          <strong className="text-[#2F7CF6]">{activeResult.fractionFormatted}</strong>
                        </span>
                      )}
                    <span>
                      Sci: <strong className="text-slate-700 dark:text-slate-300">{activeResult.scientificNotation}</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCopyResult()}
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ) : (
              <div className="text-sm text-slate-400 font-mono">Ready</div>
            )}
          </div>

          {/* Memory + Shift + Cross-Module Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSecondMode((s) => !s)}
                className={`h-9 px-3 rounded-xl text-xs font-semibold transition-colors ${
                  secondMode
                    ? 'bg-[#2F7CF6] text-white'
                    : 'bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200'
                }`}
              >
                2nd ({secondMode ? 'INV/HYP' : 'MAIN'})
              </button>
              {(
                [
                  { label: 'MC', fn: () => setMemory(0) },
                  { label: 'MR', fn: () => insertToken(String(memory)) },
                  { label: 'M+', fn: () => activeResult && setMemory((m) => m + activeResult.value) },
                  { label: 'M−', fn: () => activeResult && setMemory((m) => m - activeResult.value) },
                ] as const
              ).map((mem) => (
                <button
                  key={mem.label}
                  type="button"
                  onClick={mem.fn}
                  className="h-9 px-2.5 rounded-xl bg-slate-100 dark:bg-[#22252E] hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200"
                >
                  {mem.label}
                </button>
              ))}
            </div>

            {/* Cross-Module Actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={!expr.trim()}
                onClick={() => onSendToSolver(toSolverExpression(expr))}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 hover:border-[#2F7CF6] text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#2F7CF6]" />
                <span>Solve in Solver</span>
              </button>
              <button
                type="button"
                disabled={!expr.trim()}
                onClick={() => onSendToGraph(toSolverExpression(expr))}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 hover:border-[#2F7CF6] text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
              >
                <LineChart className="w-3.5 h-3.5 text-emerald-500" />
                <span>Plot</span>
              </button>
              <button
                type="button"
                disabled={!activeResult}
                onClick={() => {
                  if (!activeResult) return;
                  onSaveToNotebook({
                    title: `Scientific Calc: ${activeResult.expression.slice(0, 32)}`,
                    topic: 'Scientific Calculator',
                    content: `${activeResult.expression} = ${activeResult.decimalFormatted}${
                      activeResult.fractionFormatted
                        ? ` (Fraction: ${activeResult.fractionFormatted})`
                        : ''
                    }`,
                  });
                  setSavedNote(true);
                  setTimeout(() => setSavedNote(false), 1600);
                }}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 hover:border-[#2F7CF6] text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
              >
                {savedNote ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>{savedNote ? 'Saved' : 'Note'}</span>
              </button>
              <button
                type="button"
                disabled={!activeResult}
                onClick={() => {
                  if (!activeResult) return;
                  onSendToExport({
                    heading: `Scientific Calculation (${angleUnit.toUpperCase()})`,
                    plainText: `${activeResult.expression} = ${activeResult.decimalFormatted}`,
                    latex: `${activeResult.latex} = ${activeResult.decimalFormatted}`,
                  });
                }}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 hover:border-[#2F7CF6] text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
              >
                <FileOutput className="w-3.5 h-3.5 text-sky-500" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Scientific Function Keypad */}
          <div className="grid grid-cols-5 gap-2">
            {sciButtons.map((b) => (
              <button
                key={b.label}
                type="button"
                title={b.title}
                onClick={() => insertToken(b.token)}
                className="h-10 rounded-xl bg-slate-100 dark:bg-[#22252E] hover:bg-slate-200 dark:hover:bg-[#2C303D] text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors"
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Core Numeric & Basic Operations Pad */}
          <div className="grid grid-cols-5 gap-2">
            {(
              [
                { label: '(', tok: '(', kind: 'op' },
                { label: ')', tok: ')', kind: 'op' },
                { label: '%', tok: '%', kind: 'op' },
                { label: '⌫', action: handleBackspace, kind: 'warn' },
                { label: 'AC', action: handleClear, kind: 'danger' },

                { label: '7', tok: '7', kind: 'num' },
                { label: '8', tok: '8', kind: 'num' },
                { label: '9', tok: '9', kind: 'num' },
                { label: '÷', tok: '/', kind: 'op' },
                { label: '1/x', tok: '^(-1)', kind: 'op' },

                { label: '4', tok: '4', kind: 'num' },
                { label: '5', tok: '5', kind: 'num' },
                { label: '6', tok: '6', kind: 'num' },
                { label: '×', tok: '*', kind: 'op' },
                { label: '10ˣ', tok: '10^', kind: 'op' },

                { label: '1', tok: '1', kind: 'num' },
                { label: '2', tok: '2', kind: 'num' },
                { label: '3', tok: '3', kind: 'num' },
                { label: '−', tok: '-', kind: 'op' },
                { label: '+/−', action: () => setExpr((p) => (p.startsWith('-') ? p.slice(1) : `-${p}`)), kind: 'op' },

                { label: '0', tok: '0', kind: 'num' },
                { label: '.', tok: '.', kind: 'num' },
                { label: 'EXP', tok: 'e', kind: 'num' },
                { label: '+', tok: '+', kind: 'op' },
                { label: '=', action: handleEquals, kind: 'eq' },
              ] as { label: string; tok?: string; action?: () => void; kind: string }[]
            ).map((btn) => {
              const isEq = btn.kind === 'eq';
              const isDanger = btn.kind === 'danger';
              const isEqCalculating = isEq && evalStatus === 'calculating';
              return (
                <button
                  key={btn.label}
                  type="button"
                  disabled={isEqCalculating}
                  aria-busy={isEqCalculating || undefined}
                  aria-label={
                    isEqCalculating
                      ? 'Calculating...'
                      : isEq
                      ? 'Evaluate'
                      : isDanger
                      ? 'Clear All'
                      : undefined
                  }
                  onClick={() => {
                    if (isEqCalculating) return;
                    if (btn.action) btn.action();
                    else if (btn.tok) insertToken(btn.tok);
                  }}
                  className={`h-11 rounded-xl font-semibold text-sm flex items-center justify-center transition-all duration-150 ease-out touch-manipulation select-none active:scale-[0.95] active:translate-y-0 ${
                    isEq
                      ? evalStatus === 'error'
                        ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white ring-2 ring-rose-400/60 shadow-md'
                        : evalStatus === 'success'
                        ? 'bg-gradient-to-r from-[#2F7CF6] to-emerald-600 text-white ring-2 ring-emerald-400/50 shadow-md'
                        : 'bg-gradient-to-r from-[#2F7CF6] to-[#2563EB] text-white shadow-[0_4px_12px_-2px_rgba(47,124,246,0.45)] hover:brightness-110 hover:-translate-y-0.5 disabled:opacity-80 disabled:cursor-wait'
                      : isDanger
                      ? 'border border-rose-500/25 bg-rose-500/12 hover:bg-rose-500/22 hover:-translate-y-0.5 text-rose-600 dark:text-rose-300'
                      : btn.kind === 'warn'
                      ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300'
                      : btn.kind === 'op'
                      ? 'bg-slate-200/80 dark:bg-[#2A2E3B] hover:bg-slate-300 dark:hover:bg-[#353A4A] text-[#2F7CF6] dark:text-sky-300'
                      : 'bg-slate-100 dark:bg-[#22252E] hover:bg-slate-200 dark:hover:bg-[#2B2F3C] text-slate-900 dark:text-white'
                  }`}
                >
                  {isEqCalculating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isEq && evalStatus === 'success' ? (
                    <Check className="w-4 h-4" />
                  ) : btn.label === '⌫' ? (
                    <Delete className="w-4 h-4" />
                  ) : (
                    btn.label
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scientific History & Quick Variables */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-[#2F7CF6]" />
              Tape History
            </h3>
            {(history.length > 0 || tapeClearedNotice) && (
              <ClearAllActionButton
                label="Clear"
                clearedLabel="Cleared successfully"
                cleared={tapeClearedNotice}
                variant="danger"
                size="sm"
                onClick={() => {
                  if (tapeTimerRef.current) window.clearTimeout(tapeTimerRef.current);
                  onClearHistory();
                  setTapeClearedNotice(true);
                  tapeTimerRef.current = window.setTimeout(() => setTapeClearedNotice(false), 2000);
                }}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">Insert var for Solver/Plot:</span>
            {['x', 'y', 'z', 't'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertToken(v)}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6]"
              >
                {v}
              </button>
            ))}
          </div>

          {history.length === 0 ? (
            <div className="py-10 text-center space-y-2 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
              <RotateCcw className="w-5 h-5 mx-auto text-slate-400" />
              <p className="text-xs text-slate-500 dark:text-slate-400 px-4">
                Press <strong>=</strong> to store evaluated calculations on your scientific tape.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="uppercase font-semibold">{item.angleUnit}</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setExpr(item.expression);
                      setAns(item.numericValue);
                    }}
                    className="w-full text-left font-mono text-xs text-slate-600 dark:text-slate-300 hover:text-[#2F7CF6] truncate flex items-center justify-between gap-2"
                    title="Click to reuse expression"
                  >
                    <span className="truncate">{item.expression}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-[#2F7CF6]" />
                  </button>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => insertToken(item.result)}
                      className="font-mono text-sm font-bold text-slate-900 dark:text-white hover:text-[#2F7CF6] tabular-nums"
                      title="Insert result value"
                    >
                      = {item.result}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSaveToNotebook({
                          title: `Sci Calc: ${item.expression.slice(0, 28)}`,
                          topic: 'Scientific Calculator',
                          content: `${item.expression} = ${item.result}`,
                        })
                      }
                      title="Save to Notebook"
                      className="text-slate-400 hover:text-[#2F7CF6]"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
