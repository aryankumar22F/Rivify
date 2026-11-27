import { useEffect, useMemo, useState } from 'react';
import { Check, FileDown, PenTool, Save, Sparkles } from 'lucide-react';
import { solveMathProblem, type SolverMode } from '../engine/solver';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { HandwritingPadModal } from './HandwritingPadModal';
import { MathTex } from './MathTex';

interface MathSolverViewProps {
  settings: AppSettings;
  externalInput?: { expr: string; mode?: SolverMode; nonce: number } | null;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

const MODE_LABELS: { id: SolverMode; label: string }[] = [
  { id: 'auto', label: 'Auto Detect' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'evaluate', label: 'Evaluate' },
  { id: 'derivative', label: 'Derivative' },
  { id: 'integral', label: 'Integral' },
  { id: 'limit', label: 'Limit' },
  { id: 'equation', label: 'Solve Equation' },
  { id: 'linear-system', label: 'Linear System' },
];

export function MathSolverView({
  settings,
  externalInput,
  onSaveToNotebook,
}: MathSolverViewProps) {
  const [mode, setMode] = useState<SolverMode>('auto');
  const [input, setInput] = useState('x^2 - 5*x + 6 = 0');
  const [variable, setVariable] = useState('x');
  const [px, setPx] = useState('1');
  const [py, setPy] = useState('1');
  const [pz, setPz] = useState('1');
  const [lower, setLower] = useState('0');
  const [upper, setUpper] = useState('2');
  const [handwritingOpen, setHandwritingOpen] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    if (externalInput && externalInput.expr.trim()) {
      setInput(externalInput.expr);
      if (externalInput.mode) setMode(externalInput.mode);
      else setMode('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalInput?.nonce]);

  const computed = useMemo(() => {
    try {
      const res = solveMathProblem({
        input,
        mode,
        variable,
        point: {
          x: Number(px) || 0,
          y: Number(py) || 0,
          z: Number(pz) || 0,
        },
        bounds: {
          lower: Number(lower) || 0,
          upper: Number(upper) || 1,
        },
        angleUnit: settings.angleUnit,
      });
      return { res, error: null as string | null };
    } catch (e) {
      return {
        res: null,
        error: e instanceof Error ? e.message : 'Unable to parse or solve problem.',
      };
    }
  }, [input, mode, variable, px, py, pz, lower, upper, settings.angleUnit]);

  const applyPreset = (nextMode: SolverMode, nextInput: string, nextVar = 'x') => {
    setMode(nextMode);
    setInput(nextInput);
    setVariable(nextVar);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#2F7CF6]" />
              Mathematical Problem Solver
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Accepts normal text, LaTeX (<span className="font-mono">\frac&#123;\partial f&#125;&#123;\partial x&#125; = 2xy + 3y^2</span>), Unicode (<span className="font-mono">∂f/∂x = 2xy + 3y²</span>), or standard ASCII (<span className="font-mono">2*x*y + 3*y^2</span>).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHandwritingOpen(true)}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0"
          >
            <PenTool className="w-4 h-4 text-[#2F7CF6]" />
            <span>Draw Equation</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {MODE_LABELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                mode === m.id
                  ? 'bg-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Examples:</span>
          <button
            type="button"
            onClick={() => applyPreset('equation', 'x^3 - 6*x^2 + 11*x - 6 = 0')}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200"
          >
            Cubic Roots
          </button>
          <button
            type="button"
            onClick={() => applyPreset('linear-system', '2*x + 3*y = 8; x - y = 1')}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200"
          >
            2×2 Linear System
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset('linear-system', 'x + y + z = 6; 2*x - y + z = 3; x + 2*y - z = 2')
            }
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200"
          >
            3×3 Linear System
          </button>
          <button
            type="button"
            onClick={() => applyPreset('integral', '3*x^2 + 4*x + 1')}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200"
          >
            Polynomial Integral
          </button>
          <button
            type="button"
            onClick={() => applyPreset('derivative', 'e^(x^2) * sin(3*x)')}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200"
          >
            Chain/Product Deriv
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div>
            <label htmlFor="solver-input" className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'linear-system'
                ? 'Equations (separate with ";" or newline)'
                : 'Expression or Equation'}
            </label>
            <textarea
              id="solver-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Normal text, LaTeX (\frac{\partial f}{\partial x} = 2xy + 3y^2), or ASCII (2*x*y + 3*y^2)"
              className="mt-1 w-full p-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
            />
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            <div>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">Var</label>
              <select
                value={variable}
                onChange={(e) => setVariable(e.target.value)}
                className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#191C24] font-mono text-sm text-slate-900 dark:text-white"
              >
                <option value="x">x</option>
                <option value="y">y</option>
                <option value="z">z</option>
                <option value="t">t</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">x</label>
              <input
                type="number"
                step="any"
                value={px}
                onChange={(e) => setPx(e.target.value)}
                className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">y</label>
              <input
                type="number"
                step="any"
                value={py}
                onChange={(e) => setPy(e.target.value)}
                className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">z</label>
              <input
                type="number"
                step="any"
                value={pz}
                onChange={(e) => setPz(e.target.value)}
                className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {(mode === 'integral' || mode === 'auto') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Integral Lower Bound
                </label>
                <input
                  type="number"
                  step="any"
                  value={lower}
                  onChange={(e) => setLower(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Integral Upper Bound
                </label>
                <input
                  type="number"
                  step="any"
                  value={upper}
                  onChange={(e) => setUpper(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {computed.error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300"
            >
              {computed.error}
            </div>
          )}
        </div>

        <div
          aria-live="polite"
          className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {computed.res ? computed.res.headline : 'Solver Output'}
              </h3>
              {computed.res && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Mode: {computed.res.detectedMode}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (!computed.res) return;
                  triggerHaptic(settings.hapticsEnabled, 12);
                  onSaveToNotebook({
                    title: `${computed.res.headline}: ${input.slice(0, 40)}`,
                    topic: 'Math Solver',
                    content: `$$${computed.res.resultLatex}$$`,
                  });
                  setSavedNote(true);
                  setTimeout(() => setSavedNote(false), 1800);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
              >
                {savedNote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savedNote ? 'Saved' : 'Note'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!computed.res) return;
                  triggerHaptic(settings.hapticsEnabled, 12);
                  downloadSingleSolutionPdf({
                    title: computed.res.headline,
                    expression: input,
                    resultPlain: computed.res.resultPlain,
                    steps: computed.res.steps,
                  });
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          {computed.res && (
            <>
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={computed.res.resultLatex} display />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
                {computed.res.steps.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-3 text-xs space-y-1"
                  >
                    <div className="font-semibold text-[#2F7CF6]">{s.rule}</div>
                    <div className="text-slate-600 dark:text-slate-400">{s.description}</div>
                    <div className="overflow-x-auto text-slate-900 dark:text-slate-100">
                      <MathTex tex={s.latex} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <HandwritingPadModal
        open={handwritingOpen}
        onClose={() => setHandwritingOpen(false)}
        onInsertExpression={(exprText) => setInput(exprText)}
      />
    </div>
  );
}
