import { useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, FileDown, GitFork, Save } from 'lucide-react';
import { solveMultivariableLimit } from '../engine/advancedMath';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { GraphPanel } from './GraphPanel';
import { MathTex } from './MathTex';

interface LimitsContinuityViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

export function LimitsContinuityView({
  settings,
  onSaveToNotebook,
}: LimitsContinuityViewProps) {
  const [is3D, setIs3D] = useState(false);
  const [expr, setExpr] = useState('(x^2 - y^2) / (x^2 + y^2)');
  const [x0, setX0] = useState('0');
  const [y0, setY0] = useState('0');
  const [z0, setZ0] = useState('0');
  const [savedNote, setSavedNote] = useState(false);

  const fmt = (n: number) => Number(n.toFixed(settings.precision)).toString();

  const computed = useMemo(() => {
    try {
      const px = Number(x0);
      const py = Number(y0);
      const pz = Number(z0);
      if (!Number.isFinite(px) || !Number.isFinite(py) || (is3D && !Number.isFinite(pz))) {
        throw new Error('Target point coordinates must be finite numbers.');
      }
      const res = solveMultivariableLimit(
        expr,
        { x0: px, y0: py, z0: pz },
        is3D,
        settings.angleUnit
      );
      return { res, error: null as string | null };
    } catch (e) {
      return {
        res: null,
        error: e instanceof Error ? e.message : 'Unable to evaluate limit expression.',
      };
    }
  }, [expr, x0, y0, z0, is3D, settings.angleUnit]);

  const applyPreset = (presetExpr: string, dim3D: boolean, px = '0', py = '0', pz = '0') => {
    setIs3D(dim3D);
    setExpr(presetExpr);
    setX0(px);
    setY0(py);
    setZ0(pz);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <GitFork className="w-5 h-5 text-[#2F7CF6]" />
              Multivariable Limits & Continuity Explorer
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Test path-dependent convergence, removable discontinuities, radial neighborhoods, and continuity for 2-variable and 3-variable functions.
            </p>
          </div>

          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 self-start">
            <button
              type="button"
              onClick={() => setIs3D(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                !is3D ? 'bg-[#2F7CF6] text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              2-Variable (x, y)
            </button>
            <button
              type="button"
              onClick={() => setIs3D(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                is3D ? 'bg-[#2F7CF6] text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              3-Variable (x, y, z)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset('(x^2 - y^2) / (x^2 + y^2)', false)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] border border-transparent font-mono"
          >
            (x²−y²)/(x²+y²) [DNE]
          </button>
          <button
            type="button"
            onClick={() => applyPreset('(x^2 * y) / (x^2 + y^2)', false)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] border border-transparent font-mono"
          >
            x²y/(x²+y²) [Removable]
          </button>
          <button
            type="button"
            onClick={() => applyPreset('sin(x*y) / (x*y + 1)', false, '1', '0')}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] border border-transparent font-mono"
          >
            sin(xy)/(xy+1) [Continuous]
          </button>
          <button
            type="button"
            onClick={() => applyPreset('(x*y*z) / (x^2 + y^2 + z^2)', true, '0', '0', '0')}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] border border-transparent font-mono"
          >
            3D xyz/(x²+y²+z²)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div>
              <label htmlFor="lim-expr" className="text-xs text-slate-500 dark:text-slate-400">
                Function {is3D ? 'f(x, y, z)' : 'f(x, y)'}
              </label>
              <input
                id="lim-expr"
                type="text"
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
              />
            </div>

            <div className={`grid gap-3 ${is3D ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">x₀</label>
                <input
                  type="number"
                  step="any"
                  value={x0}
                  onChange={(e) => setX0(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">y₀</label>
                <input
                  type="number"
                  step="any"
                  value={y0}
                  onChange={(e) => setY0(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              {is3D && (
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">z₀</label>
                  <input
                    type="number"
                    step="any"
                    value={z0}
                    onChange={(e) => setZ0(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
              )}
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

          {!is3D && (
            <GraphPanel
              tool="partial-derivative"
              expression={expr}
              anchorPoint={{ x: Number(x0) || 0, y: Number(y0) || 0 }}
              angleUnit={settings.angleUnit}
              theme={settings.theme}
            />
          )}
        </div>

        <div
          aria-live="polite"
          className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Limit & Continuity Analysis
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (!computed.res) return;
                  triggerHaptic(settings.hapticsEnabled, 12);
                  onSaveToNotebook({
                    title: `Multivariable Limit: ${expr}`,
                    topic: 'Limits & Continuity',
                    content: `$$${computed.res.summaryLatex}$$\n\nStatus: ${computed.res.status}`,
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
                    title: 'Multivariable Limit & Continuity',
                    expression: expr,
                    resultPlain:
                      computed.res.estimatedLimit !== null
                        ? `${computed.res.status} (L ≈ ${fmt(computed.res.estimatedLimit)})`
                        : computed.res.status,
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
                <MathTex tex={computed.res.summaryLatex} display />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  className={`rounded-xl border p-3.5 ${
                    computed.res.isContinuous
                      ? 'border-emerald-500/40 bg-emerald-500/8'
                      : computed.res.status === 'Removable Discontinuity'
                      ? 'border-amber-500/40 bg-amber-500/8'
                      : 'border-rose-500/40 bg-rose-500/8'
                  }`}
                >
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Classification</div>
                  <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {computed.res.isContinuous ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span>{computed.res.status}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3.5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    f({x0}, {y0}{is3D ? `, ${z0}` : ''}) Value
                  </div>
                  <div className="mt-1 text-sm font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                    {computed.res.valueAtPoint !== null ? fmt(computed.res.valueAtPoint) : 'Undefined'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3.5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Radial Angular Spread
                  </div>
                  <div className="mt-1 text-sm font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                    {(computed.res.polarSpread ?? 0).toExponential(2)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Path-Based Limit Exploration
                </h4>
                <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#12141B] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Approach Path</th>
                        <th className="py-2.5 px-3 font-medium">Trajectory</th>
                        <th className="py-2.5 px-3 font-medium text-right">Limit Estimate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                      {computed.res.paths.map((p) => (
                        <tr key={p.pathName} className="text-slate-800 dark:text-slate-200">
                          <td className="py-2.5 px-3 font-medium">{p.pathName}</td>
                          <td className="py-2.5 px-3 overflow-x-auto">
                            <MathTex tex={p.pathLatex} />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                            {p.diverges || p.estimatedLimit === null
                              ? 'Diverges / DNE'
                              : fmt(p.estimatedLimit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
    </div>
  );
}
