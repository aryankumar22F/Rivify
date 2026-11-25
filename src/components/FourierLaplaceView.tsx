import { useMemo, useState } from 'react';
import { Activity, Check, FileDown, Save } from 'lucide-react';
import {
  computeConvolution,
  computeFourierSeries,
  computeFourierTransform,
  LAPLACE_PRESETS,
  solveInverseLaplaceQuadratic,
  TRANSFORM_PROPERTIES,
} from '../engine/fourierLaplace';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface FourierLaplaceViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

type FlTab = 'fourier-series' | 'fourier-transform' | 'laplace' | 'convolution' | 'properties';

export function FourierLaplaceView({ settings, onSaveToNotebook }: FourierLaplaceViewProps) {
  const [tab, setTab] = useState<FlTab>('fourier-series');
  const [saved, setSaved] = useState(false);

  // Fourier Series state
  const [fsExpr, setFsExpr] = useState('t');
  const [halfPeriod, setHalfPeriod] = useState('3.14159');
  const [harmonics, setHarmonics] = useState(6);

  // Fourier Transform state
  const [ftExpr, setFtExpr] = useState('e^(-abs(t))');
  const [ftTBound, setFtTBound] = useState('6');
  const [ftOmegaMax, setFtOmegaMax] = useState('12');

  // Laplace / Inverse Laplace state
  const [selectedLaplaceId, setSelectedLaplaceId] = useState(LAPLACE_PRESETS[3].id);
  const [ilA, setIlA] = useState('2');
  const [ilB, setIlB] = useState('5');
  const [ilP, setIlP] = useState('4');
  const [ilQ, setIlQ] = useState('13');

  // Convolution state
  const [convF, setConvF] = useState('e^(-t)');
  const [convG, setConvG] = useState('sin(2*t)');

  const computed = useMemo(() => {
    try {
      if (tab === 'fourier-series') {
        return {
          fs: computeFourierSeries(fsExpr, Number(halfPeriod) || Math.PI, harmonics),
          error: null as string | null,
        };
      }
      if (tab === 'fourier-transform') {
        return {
          ft: computeFourierTransform(ftExpr, Number(ftTBound) || 6, Number(ftOmegaMax) || 12),
          error: null as string | null,
        };
      }
      if (tab === 'laplace') {
        return {
          il: solveInverseLaplaceQuadratic(
            Number(ilA) || 0,
            Number(ilB) || 0,
            Number(ilP) || 0,
            Number(ilQ) || 1
          ),
          error: null as string | null,
        };
      }
      if (tab === 'convolution') {
        return {
          conv: computeConvolution(convF, convG, 6),
          error: null as string | null,
        };
      }
      return { error: null as string | null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Unable to evaluate transform.' };
    }
  }, [tab, fsExpr, halfPeriod, harmonics, ftExpr, ftTBound, ftOmegaMax, ilA, ilB, ilP, ilQ, convF, convG]);

  const activeLaplacePreset =
    LAPLACE_PRESETS.find((p) => p.id === selectedLaplaceId) ?? LAPLACE_PRESETS[0];

  const handleSave = () => {
    triggerHaptic(settings.hapticsEnabled, 10);
    let content = '';
    if (computed.fs) content = `Fourier Series of f(t) = ${fsExpr}\n$$${computed.fs.seriesLatex}$$`;
    else if (computed.ft) content = `Fourier Transform of ${ftExpr}\n$$${computed.ft.canonicalLatex}$$`;
    else if (computed.il) content = `$$${computed.il.inputLatex} \\implies ${computed.il.timeLatex}$$`;
    else if (computed.conv) content = `Convolution: (${convF}) * (${convG})`;
    else content = TRANSFORM_PROPERTIES.map((p) => `${p.name}: $${p.laplace}$`).join('\n');

    onSaveToNotebook({
      title: `Fourier & Laplace · ${tab}`,
      topic: 'Transforms',
      content,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const handlePdf = () => {
    triggerHaptic(settings.hapticsEnabled, 10);
    const steps =
      computed.fs?.steps ??
      computed.ft?.steps ??
      computed.il?.steps ??
      computed.conv?.steps ??
      activeLaplacePreset.steps;
    downloadSingleSolutionPdf({
      title: `Fourier & Laplace Lab (${tab})`,
      expression: tab === 'fourier-series' ? fsExpr : tab === 'fourier-transform' ? ftExpr : activeLaplacePreset.expr,
      resultPlain: steps.map((s) => `${s.rule}: ${s.description}`).join(' | '),
      steps,
    });
  };

  const plotPolyline = (
    pts: { x: number; y: number }[],
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    w = 480,
    h = 190
  ) => {
    const pad = 22;
    const dx = Math.max(1e-6, xMax - xMin);
    const dy = Math.max(1e-6, yMax - yMin);
    return pts
      .map((p) => {
        const px = pad + ((p.x - xMin) / dx) * (w - 2 * pad);
        const py = h - pad - ((p.y - yMin) / dy) * (h - 2 * pad);
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#2F7CF6]" />
              Fourier &amp; Laplace Transform Lab
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Compute Fourier series harmonics, continuous Fourier &amp; inverse Fourier transforms, Laplace &amp; partial-fraction inverse Laplace transforms, and causal convolutions.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSave}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              {saved ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saved ? 'Saved' : 'Save Note'}</span>
            </button>
            <button
              type="button"
              onClick={handlePdf}
              className="h-9 px-3.5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'fourier-series', label: 'Fourier Series' },
              { id: 'fourier-transform', label: 'Fourier & Inverse FT' },
              { id: 'laplace', label: 'Laplace & Inverse Laplace' },
              { id: 'convolution', label: 'Convolution Integral' },
              { id: 'properties', label: 'Transform Properties' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {computed.error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-300">
          {computed.error}
        </div>
      )}

      {/* FOURIER SERIES */}
      {tab === 'fourier-series' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Periodic Function f(t) on [-L, L]</label>
              <input
                type="text"
                value={fsExpr}
                onChange={(e) => setFsExpr(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Half-Period L</label>
                <input
                  type="number"
                  step="0.1"
                  value={halfPeriod}
                  onChange={(e) => setHalfPeriod(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Harmonics N: {harmonics}</label>
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={harmonics}
                  onChange={(e) => setHarmonics(Number(e.target.value))}
                  className="mt-3 w-full accent-[#2F7CF6]"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: 'Sawtooth f(t)=t', expr: 't' },
                { label: 'Parabolic f(t)=t²', expr: 't^2' },
                { label: 'Full-wave |sin(t)|', expr: 'abs(sin(t))' },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setFsExpr(p.expr)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200 font-mono"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {computed.fs && (
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Signal Comparison: Exact f(t) vs Partial Sum S_{computed.fs.harmonics}(t)
                  </span>
                  <span className="font-mono tabular-nums">RMSE: {computed.fs.rmse.toFixed(4)}</span>
                </div>
                {(() => {
                  const ys = computed.fs.samples.flatMap((s) => [s.exact, s.approx]);
                  const yMin = Math.min(-1, ...ys);
                  const yMax = Math.max(1, ...ys);
                  const L = computed.fs.halfPeriod;
                  return (
                    <svg viewBox="0 0 480 190" className="w-full h-48 rounded-xl bg-slate-50 dark:bg-[#12151C]">
                      <polyline
                        fill="none"
                        stroke="#94A3B8"
                        strokeWidth="1.6"
                        strokeDasharray="4 4"
                        points={plotPolyline(
                          computed.fs.samples.map((s) => ({ x: s.t, y: s.exact })),
                          -L,
                          L,
                          yMin,
                          yMax
                        )}
                      />
                      <polyline
                        fill="none"
                        stroke="#2F7CF6"
                        strokeWidth="2.4"
                        points={plotPolyline(
                          computed.fs.samples.map((s) => ({ x: s.t, y: s.approx })),
                          -L,
                          L,
                          yMin,
                          yMax
                        )}
                      />
                    </svg>
                  );
                })()}
                <div className="overflow-x-auto text-slate-900 dark:text-white">
                  <MathTex tex={computed.fs.seriesLatex} display />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-2">
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Step-by-Step Derivation</div>
                {computed.fs.steps.map((st) => (
                  <div key={st.id} className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3 text-xs space-y-1">
                    <div className="font-semibold text-[#2F7CF6]">{st.rule}</div>
                    <div className="text-slate-600 dark:text-slate-400">{st.description}</div>
                    <div className="overflow-x-auto text-slate-900 dark:text-white">
                      <MathTex tex={st.latex} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FOURIER TRANSFORM & INVERSE FT */}
      {tab === 'fourier-transform' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Time-Domain Signal f(t)</label>
              <input
                type="text"
                value={ftExpr}
                onChange={(e) => setFtExpr(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Window [-T, T]</label>
                <input
                  type="number"
                  value={ftTBound}
                  onChange={(e) => setFtTBound(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Frequency Max ω</label>
                <input
                  type="number"
                  value={ftOmegaMax}
                  onChange={(e) => setFtOmegaMax(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: 'Two-Sided Exp e^(-|t|)', expr: 'e^(-abs(t))' },
                { label: 'Gaussian Pulse e^(-t²)', expr: 'e^(-t^2)' },
                { label: 'Modulated Cosine', expr: 'e^(-abs(t))*cos(3*t)' },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setFtExpr(p.expr)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200 font-mono"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {computed.ft && (
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Frequency Magnitude Spectrum |F(ω)|
                </div>
                {(() => {
                  const s = computed.ft.spectrum;
                  const maxM = Math.max(0.5, ...s.map((k) => k.magnitude));
                  const wM = Math.max(1, Number(ftOmegaMax) || 12);
                  return (
                    <svg viewBox="0 0 480 180" className="w-full h-44 rounded-xl bg-slate-50 dark:bg-[#12151C]">
                      <polyline
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.4"
                        points={plotPolyline(
                          s.map((k) => ({ x: k.omega, y: k.magnitude })),
                          -wM,
                          wM,
                          0,
                          maxM,
                          480,
                          180
                        )}
                      />
                    </svg>
                  );
                })()}
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Inverse Fourier Reconstruction f(t) vs Windowed Signal
                </div>
                {(() => {
                  const ts = computed.ft.timeSamples;
                  const T = Math.max(1, Number(ftTBound) || 6);
                  const ys = ts.flatMap((k) => [k.f, k.reconstructed]);
                  return (
                    <svg viewBox="0 0 480 160" className="w-full h-40 rounded-xl bg-slate-50 dark:bg-[#12151C]">
                      <polyline
                        fill="none"
                        stroke="#94A3B8"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        points={plotPolyline(
                          ts.map((k) => ({ x: k.t, y: k.f })),
                          -T,
                          T,
                          Math.min(-0.2, ...ys),
                          Math.max(1, ...ys),
                          480,
                          160
                        )}
                      />
                      <polyline
                        fill="none"
                        stroke="#2F7CF6"
                        strokeWidth="2.2"
                        points={plotPolyline(
                          ts.map((k) => ({ x: k.t, y: k.reconstructed })),
                          -T,
                          T,
                          Math.min(-0.2, ...ys),
                          Math.max(1, ...ys),
                          480,
                          160
                        )}
                      />
                    </svg>
                  );
                })()}
                <div className="overflow-x-auto text-slate-900 dark:text-white">
                  <MathTex tex={computed.ft.canonicalLatex} display />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LAPLACE & INVERSE LAPLACE */}
      {tab === 'laplace' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Forward Laplace Transform Library
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LAPLACE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedLaplaceId(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono ${
                    selectedLaplaceId === p.id
                      ? 'bg-[#2F7CF6] text-white'
                      : 'bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-4 space-y-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Transform Pair · ROC: {activeLaplacePreset.roc}
              </div>
              <div className="overflow-x-auto text-slate-900 dark:text-white">
                <MathTex
                  tex={`\\mathcal{L}\\left\\{${activeLaplacePreset.fLatex}\\right\\} = ${activeLaplacePreset.transformLatex}`}
                  display
                />
              </div>
              {activeLaplacePreset.steps.map((st) => (
                <div key={st.id} className="text-xs pt-2 border-t border-slate-200 dark:border-white/10 space-y-1">
                  <div className="font-semibold text-[#2F7CF6]">{st.rule}</div>
                  <div className="text-slate-600 dark:text-slate-300">{st.description}</div>
                  <MathTex tex={st.latex} />
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Inverse Laplace Solver: F(s) = (a·s + b) / (s² + p·s + q)
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { label: 'a', val: ilA, set: setIlA },
                { label: 'b', val: ilB, set: setIlB },
                { label: 'p', val: ilP, set: setIlP },
                { label: 'q', val: ilQ, set: setIlQ },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">{f.label}</label>
                  <input
                    type="number"
                    value={f.val}
                    onChange={(e) => f.set(e.target.value)}
                    className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                  />
                </div>
              ))}
            </div>

            {computed.il && (
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3 overflow-x-auto text-slate-900 dark:text-white">
                  <MathTex tex={computed.il.inputLatex} display />
                  <MathTex tex={computed.il.timeLatex} display />
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {computed.il.polesDescription}
                </div>
                {(() => {
                  const ys = computed.il.samples.map((k) => k.y);
                  return (
                    <svg viewBox="0 0 480 160" className="w-full h-40 rounded-xl bg-slate-50 dark:bg-[#12151C]">
                      <polyline
                        fill="none"
                        stroke="#2F7CF6"
                        strokeWidth="2.4"
                        points={plotPolyline(
                          computed.il.samples.map((k) => ({ x: k.t, y: k.y })),
                          0,
                          6,
                          Math.min(-0.5, ...ys),
                          Math.max(0.5, ...ys),
                          480,
                          160
                        )}
                      />
                    </svg>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONVOLUTION */}
      {tab === 'convolution' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Signal f(t)</label>
              <input
                type="text"
                value={convF}
                onChange={(e) => setConvF(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Impulse Response g(t)</label>
              <input
                type="text"
                value={convG}
                onChange={(e) => setConvG(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {computed.conv && (
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Causal Convolution Output (f * g)(t) on [0, 6]
              </div>
              {(() => {
                const s = computed.conv.samples;
                const ys = s.flatMap((k) => [k.f, k.conv]);
                return (
                  <svg viewBox="0 0 480 185" className="w-full h-48 rounded-xl bg-slate-50 dark:bg-[#12151C]">
                    <polyline
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="1.4"
                      strokeDasharray="4 4"
                      points={plotPolyline(
                        s.map((k) => ({ x: k.t, y: k.f })),
                        0,
                        6,
                        Math.min(-0.5, ...ys),
                        Math.max(0.5, ...ys),
                        480,
                        185
                      )}
                    />
                    <polyline
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.6"
                      points={plotPolyline(
                        s.map((k) => ({ x: k.t, y: k.conv })),
                        0,
                        6,
                        Math.min(-0.5, ...ys),
                        Math.max(0.5, ...ys),
                        480,
                        185
                      )}
                    />
                  </svg>
                );
              })()}
              {computed.conv.steps.map((st) => (
                <div key={st.id} className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3 text-xs space-y-1">
                  <div className="font-semibold text-[#2F7CF6]">{st.rule}</div>
                  <MathTex tex={st.latex} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TRANSFORM PROPERTIES */}
      {tab === 'properties' && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-left text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3">Property</th>
                <th className="py-2.5 px-3">Laplace Domain</th>
                <th className="py-2.5 px-3">Fourier Domain</th>
              </tr>
            </thead>
            <tbody>
              {TRANSFORM_PROPERTIES.map((prop) => (
                <tr key={prop.name} className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">{prop.name}</td>
                  <td className="py-3 px-3 text-slate-800 dark:text-slate-200">
                    <MathTex tex={prop.laplace} />
                  </td>
                  <td className="py-3 px-3 text-slate-800 dark:text-slate-200">
                    <MathTex tex={prop.fourier} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
