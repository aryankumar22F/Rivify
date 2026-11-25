import { useMemo, useState } from 'react';
import { Check, CheckCircle2, FileDown, Mountain, Save } from 'lucide-react';
import { solveGlobalOptimization, solveLagrangeMultipliers } from '../engine/advancedMath';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { GraphPanel } from './GraphPanel';
import { MathTex } from './MathTex';

interface OptimizationViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

export function OptimizationView({ settings, onSaveToNotebook }: OptimizationViewProps) {
  const [mode, setMode] = useState<'global' | 'lagrange'>('global');

  const [expr, setExpr] = useState('x^2 + y^2 - 2*x - 4*y + 6');
  const [xMin, setXMin] = useState('-2');
  const [xMax, setXMax] = useState('4');
  const [yMin, setYMin] = useState('-2');
  const [yMax, setYMax] = useState('4');

  const [constraintG, setConstraintG] = useState('x^2 + y^2');
  const [constraintC, setConstraintC] = useState('4');
  const [selectedAnchor, setSelectedAnchor] = useState<{ x: number; y: number } | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const fmt = (n: number) => Number(n.toFixed(settings.precision)).toString();

  const computed = useMemo(() => {
    try {
      const xa = Number(xMin);
      const xb = Number(xMax);
      const ya = Number(yMin);
      const yb = Number(yMax);
      if (![xa, xb, ya, yb].every(Number.isFinite) || xb <= xa || yb <= ya) {
        throw new Error('Provide valid domain intervals with max > min.');
      }

      if (mode === 'global') {
        const res = solveGlobalOptimization(expr, xa, xb, ya, yb, settings.angleUnit);
        return { kind: 'global' as const, res, error: null as string | null };
      }

      const cVal = Number(constraintC);
      if (!Number.isFinite(cVal)) throw new Error('Constraint constant c must be finite.');
      const res = solveLagrangeMultipliers(
        expr,
        constraintG,
        cVal,
        [xa, xb],
        [ya, yb],
        settings.angleUnit
      );
      return { kind: 'lagrange' as const, res, error: null as string | null };
    } catch (e) {
      return {
        kind: mode,
        res: null,
        error: e instanceof Error ? e.message : 'Unable to optimize function.',
      };
    }
  }, [mode, expr, xMin, xMax, yMin, yMax, constraintG, constraintC, settings.angleUnit]);

  const activeAnchor = useMemo(() => {
    if (selectedAnchor) return selectedAnchor;
    if (computed.kind === 'global' && computed.res) {
      return { x: computed.res.globalMax.x, y: computed.res.globalMax.y };
    }
    if (computed.kind === 'lagrange' && computed.res && computed.res.candidates[0]) {
      return { x: computed.res.candidates[0].x, y: computed.res.candidates[0].y };
    }
    return { x: 0, y: 0 };
  }, [selectedAnchor, computed]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Mountain className="w-5 h-5 text-[#2F7CF6]" />
              Global Optimization & Lagrange Multipliers
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Find global extrema over closed rectangular domains or solve constrained optimization problems using ∇f = λ∇g.
            </p>
          </div>

          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 self-start">
            <button
              type="button"
              onClick={() => {
                setMode('global');
                setSelectedAnchor(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                mode === 'global' ? 'bg-[#2F7CF6] text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Bounded Global Extrema
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('lagrange');
                setExpr('x*y');
                setConstraintG('x^2 + y^2');
                setConstraintC('8');
                setXMin('-4');
                setXMax('4');
                setYMin('-4');
                setYMax('4');
                setSelectedAnchor(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                mode === 'lagrange' ? 'bg-[#2F7CF6] text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Lagrange Multipliers
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Presets:</span>
          {mode === 'global' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setExpr('x^2 + y^2 - 2*x - 4*y + 6');
                  setXMin('-2');
                  setXMax('4');
                  setYMin('-2');
                  setYMax('4');
                  setSelectedAnchor(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200"
              >
                Paraboloid on [−2,4]²
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpr('x*y*e^(-(x^2 + y^2)/2)');
                  setXMin('-2');
                  setXMax('2');
                  setYMin('-2');
                  setYMax('2');
                  setSelectedAnchor(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200"
              >
                Gaussian Peaks
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setExpr('x*y');
                  setConstraintG('x^2 + y^2');
                  setConstraintC('8');
                  setXMin('-4');
                  setXMax('4');
                  setYMin('-4');
                  setYMax('4');
                  setSelectedAnchor(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200"
              >
                max xy s.t. x²+y²=8
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpr('3*x + 4*y');
                  setConstraintG('x^2 + y^2');
                  setConstraintC('25');
                  setXMin('-6');
                  setXMax('6');
                  setYMin('-6');
                  setYMax('6');
                  setSelectedAnchor(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200"
              >
                3x+4y on circle r=5
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Objective Function f(x, y)
              </label>
              <input
                type="text"
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
              />
            </div>

            {mode === 'lagrange' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Constraint g(x, y)
                  </label>
                  <input
                    type="text"
                    value={constraintG}
                    onChange={(e) => setConstraintG(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">Equals c</label>
                  <input
                    type="number"
                    step="any"
                    value={constraintC}
                    onChange={(e) => setConstraintC(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">x min</label>
                <input
                  type="number"
                  step="any"
                  value={xMin}
                  onChange={(e) => setXMin(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">x max</label>
                <input
                  type="number"
                  step="any"
                  value={xMax}
                  onChange={(e) => setXMax(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">y min</label>
                <input
                  type="number"
                  step="any"
                  value={yMin}
                  onChange={(e) => setYMin(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">y max</label>
                <input
                  type="number"
                  step="any"
                  value={yMax}
                  onChange={(e) => setYMax(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {computed.error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300"
              >
                {computed.error}
              </div>
            )}
          </div>

          <GraphPanel
            tool="maxima-minima"
            expression={expr}
            anchorPoint={activeAnchor}
            angleUnit={settings.angleUnit}
            theme={settings.theme}
          />
        </div>

        <div
          aria-live="polite"
          className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {mode === 'global' ? 'Bounded Global Extrema Results' : 'Lagrange Constrained Critical Points'}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (!computed.res) return;
                  triggerHaptic(settings.hapticsEnabled, 12);
                  onSaveToNotebook({
                    title: `${mode === 'global' ? 'Global Optimization' : 'Lagrange Multipliers'}: ${expr}`,
                    topic: 'Optimization',
                    content:
                      computed.kind === 'global'
                        ? `Global Max: f(${computed.res.globalMax.x}, ${computed.res.globalMax.y}) = ${fmt(
                            computed.res.globalMax.value
                          )}\nGlobal Min: f(${computed.res.globalMin.x}, ${computed.res.globalMin.y}) = ${fmt(
                            computed.res.globalMin.value
                          )}`
                        : computed.res.candidates
                            .map((c) => `${c.kind}: (${c.x}, ${c.y}), λ=${c.lambda}, f=${fmt(c.value)}`)
                            .join('\n'),
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
                    title: mode === 'global' ? 'Global Optimization' : 'Lagrange Multipliers',
                    expression: expr,
                    resultPlain:
                      computed.kind === 'global'
                        ? `Max=${fmt(computed.res.globalMax.value)}, Min=${fmt(computed.res.globalMin.value)}`
                        : `${computed.res.candidates.length} constrained critical points`,
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

          {computed.kind === 'global' && computed.res && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/8 p-4 space-y-1">
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Global Maximum
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                    {fmt(computed.res.globalMax.value)}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                    at ({computed.res.globalMax.x}, {computed.res.globalMax.y}) · {computed.res.globalMax.location}
                  </div>
                </div>

                <div className="rounded-xl border border-sky-500/40 bg-sky-500/8 p-4 space-y-1">
                  <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Global Minimum
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                    {fmt(computed.res.globalMin.value)}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                    at ({computed.res.globalMin.x}, {computed.res.globalMin.y}) · {computed.res.globalMin.location}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#12141B] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Point (x, y)</th>
                      <th className="py-2.5 px-3 font-medium">Region</th>
                      <th className="py-2.5 px-3 font-medium text-right">f(x, y)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                    {computed.res.candidates.slice(0, 12).map((c, idx) => (
                      <tr
                        key={idx}
                        onClick={() => setSelectedAnchor({ x: c.x, y: c.y })}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"
                      >
                        <td className="py-2 px-3 font-mono tabular-nums">
                          ({c.x}, {c.y})
                        </td>
                        <td className="py-2 px-3">{c.location}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums">
                          {fmt(c.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            </div>
          )}

          {computed.kind === 'lagrange' && computed.res && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#12141B] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Point (x, y)</th>
                      <th className="py-2.5 px-3 font-medium">Multiplier λ</th>
                      <th className="py-2.5 px-3 font-medium">Classification</th>
                      <th className="py-2.5 px-3 font-medium text-right">f(x, y)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                    {computed.res.candidates.map((c, idx) => (
                      <tr
                        key={idx}
                        onClick={() => setSelectedAnchor({ x: c.x, y: c.y })}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"
                      >
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          ({c.x}, {c.y})
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">{fmt(c.lambda)}</td>
                        <td className="py-2.5 px-3 font-semibold">{c.kind}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                          {fmt(c.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
