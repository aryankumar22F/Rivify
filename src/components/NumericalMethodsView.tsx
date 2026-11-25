import { useEffect, useMemo, useRef, useState } from 'react';
import { Binary, Check, FileDown, Save } from 'lucide-react';
import {
  solveGaussEliminationNumerical,
  solveGaussSeidel,
  solveNumericalIntegration,
  solveRootMethod,
} from '../engine/numericalMethods';
import { evaluateAST, parseExpression } from '../engine/symbolic';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface NumericalMethodsViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

type NmCategory = 'roots' | 'linear' | 'integration';

export function NumericalMethodsView({ settings, onSaveToNotebook }: NumericalMethodsViewProps) {
  const [category, setCategory] = useState<NmCategory>('roots');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  // Root-finding state
  const [rootMethod, setRootMethod] = useState<'bisection' | 'newton' | 'regula-falsi' | 'secant'>('newton');
  const [rootExpr, setRootExpr] = useState('x^3 - x - 2');
  const [bracketA, setBracketA] = useState('1');
  const [bracketB, setBracketB] = useState('2');
  const [guessX0, setGuessX0] = useState('1.5');
  const [guessX1, setGuessX1] = useState('2');
  const [tol, setTol] = useState('0.00001');

  // Linear system state (3x3)
  const [linMethod, setLinMethod] = useState<'gauss-elim' | 'gauss-seidel'>('gauss-seidel');
  const [matA, setMatA] = useState<number[][]>([
    [10, -1, 2],
    [-1, 11, -1],
    [2, -1, 10],
  ]);
  const [vecB, setVecB] = useState<number[]>([6, 25, -11]);

  // Integration state
  const [intRule, setIntRule] = useState<'trapezoidal' | 'simpson-1-3' | 'simpson-3-8'>('simpson-1-3');
  const [intExpr, setIntExpr] = useState('1 / (1 + x^2)');
  const [intA, setIntA] = useState('0');
  const [intB, setIntB] = useState('1');
  const [intN, setIntN] = useState('6');

  const computed = useMemo(() => {
    try {
      if (category === 'roots') {
        const res = solveRootMethod({
          method: rootMethod,
          expr: rootExpr,
          a: Number(bracketA) || 0,
          b: Number(bracketB) || 2,
          x0: Number(guessX0) || 1,
          x1: Number(guessX1) || 2,
          tol: Math.max(1e-10, Number(tol) || 1e-5),
          angleUnit: settings.angleUnit,
        });
        return { category: 'roots' as const, res, error: null as string | null };
      }
      if (category === 'linear') {
        if (linMethod === 'gauss-seidel') {
          const res = solveGaussSeidel(matA, vecB, Math.max(1e-10, Number(tol) || 1e-5), 25);
          return { category: 'gauss-seidel' as const, res, error: null as string | null };
        }
        const res = solveGaussEliminationNumerical(matA, vecB);
        return { category: 'gauss-elim' as const, res, error: null as string | null };
      }
      const res = solveNumericalIntegration({
        rule: intRule,
        expr: intExpr,
        a: Number(intA) || 0,
        b: Number(intB) || 1,
        n: Math.max(2, Number(intN) || 6),
        angleUnit: settings.angleUnit,
      });
      return { category: 'integration' as const, res, error: null as string | null };
    } catch (e) {
      return {
        category,
        res: null,
        error: e instanceof Error ? e.message : 'Unable to compute numerical method.',
      };
    }
  }, [
    category,
    rootMethod,
    rootExpr,
    bracketA,
    bracketB,
    guessX0,
    guessX1,
    tol,
    linMethod,
    matA,
    vecB,
    intRule,
    intExpr,
    intA,
    intB,
    intN,
    settings.angleUnit,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !computed.res) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    const dark = settings.theme === 'dark';

    ctx.fillStyle = dark ? '#12151C' : '#F8FAFC';
    ctx.fillRect(0, 0, w, h);
    const pad = 38;

    if (computed.category === 'roots' && computed.res) {
      const xs = computed.res.iterations.map((it) => it.x);
      const minX = Math.min(Number(bracketA) || 0, Number(guessX0) || 0, ...xs) - 0.5;
      const maxX = Math.max(Number(bracketB) || 2, Number(guessX1) || 2, ...xs) + 0.5;
      const ast = parseExpression(rootExpr);
      const pts: { x: number; y: number }[] = [];
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i <= 160; i++) {
        const x = minX + (i / 160) * (maxX - minX);
        try {
          const y = evaluateAST(ast, { x }, settings.angleUnit);
          if (Number.isFinite(y) && Math.abs(y) < 1e4) {
            pts.push({ x, y });
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        } catch {
          // skip
        }
      }
      if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
        minY = -5;
        maxY = 5;
      }
      if (Math.abs(maxY - minY) < 1e-4) {
        minY -= 1;
        maxY += 1;
      }
      const toX = (x: number) => pad + ((x - minX) / (maxX - minX)) * (w - pad * 2);
      const toY = (y: number) => h - pad - ((y - minY) / (maxY - minY)) * (h - pad * 2);

      if (minY <= 0 && maxY >= 0) {
        ctx.strokeStyle = dark ? 'rgba(203,213,225,0.4)' : 'rgba(15,23,42,0.4)';
        ctx.beginPath();
        ctx.moveTo(pad, toY(0));
        ctx.lineTo(w - pad, toY(0));
        ctx.stroke();
      }
      ctx.strokeStyle = '#2F7CF6';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(toX(p.x), toY(p.y));
        else ctx.lineTo(toX(p.x), toY(p.y));
      });
      ctx.stroke();

      // Iterates
      computed.res.iterations.forEach((it, idx) => {
        const isLast = idx === computed.res.iterations.length - 1;
        ctx.fillStyle = isLast ? '#10B981' : '#F59E0B';
        ctx.beginPath();
        ctx.arc(toX(it.x), toY(it.fx), isLast ? 5.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (computed.category === 'integration' && computed.res) {
      const { samples } = computed.res;
      const a = samples[0].x;
      const b = samples[samples.length - 1].x;
      const ys = samples.map((s) => s.y);
      const minY = Math.min(0, ...ys);
      const maxY = Math.max(0.2, ...ys);
      const toX = (x: number) => pad + ((x - a) / (b - a)) * (w - pad * 2);
      const toY = (y: number) => h - pad - ((y - minY) / Math.max(1e-5, maxY - minY)) * (h - pad * 2);

      // Shaded quadrature strips
      ctx.fillStyle = 'rgba(47, 124, 246, 0.18)';
      ctx.strokeStyle = 'rgba(47, 124, 246, 0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < samples.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(toX(samples[i].x), toY(0));
        ctx.lineTo(toX(samples[i].x), toY(samples[i].y));
        ctx.lineTo(toX(samples[i + 1].x), toY(samples[i + 1].y));
        ctx.lineTo(toX(samples[i + 1].x), toY(0));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Smooth integrand curve
      const ast = parseExpression(intExpr);
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i <= 140; i++) {
        const x = a + (i / 140) * (b - a);
        const y = evaluateAST(ast, { x }, settings.angleUnit);
        if (i === 0) ctx.moveTo(toX(x), toY(y));
        else ctx.lineTo(toX(x), toY(y));
      }
      ctx.stroke();
    } else if (computed.category === 'gauss-seidel' && computed.res) {
      const rows = computed.res.rows;
      const maxErr = Math.max(1e-6, ...rows.map((r) => r.maxError));
      const toX = (i: number) => pad + (i / Math.max(1, rows.length - 1)) * (w - pad * 2);
      const toY = (err: number) =>
        h - pad - (Math.log10(Math.max(1e-10, err) / 1e-10) / Math.log10(Math.max(1e-8, maxErr) / 1e-10)) * (h - pad * 2);
      ctx.strokeStyle = '#2F7CF6';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      rows.forEach((r, idx) => {
        const sx = toX(idx);
        const sy = toY(r.maxError);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.fillStyle = dark ? '#94A3B8' : '#475569';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText('Log-scale Gauss-Seidel Step Error Convergence', pad, 22);
    }

    ctx.restore();
  }, [computed, rootExpr, bracketA, bracketB, guessX0, guessX1, intExpr, settings.angleUnit, settings.theme]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Binary className="w-5 h-5 text-[#2F7CF6]" />
              Numerical Methods Lab
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Root-finding iterations (Bisection, Newton-Raphson, Regula Falsi, Secant), linear solvers (Gauss Elimination, Gauss-Seidel), and quadrature (Trapezoidal, Simpson 1/3 &amp; 3/8) with step tables and error analysis.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'roots', label: 'Root Finding' },
                { id: 'linear', label: 'Linear Systems' },
                { id: 'integration', label: 'Numerical Integration' },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap ${
                  category === c.id
                    ? 'bg-[#2F7CF6] text-white'
                    : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          {category === 'roots' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'bisection', label: 'Bisection' },
                    { id: 'newton', label: 'Newton-Raphson' },
                    { id: 'regula-falsi', label: 'Regula Falsi' },
                    { id: 'secant', label: 'Secant' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setRootMethod(m.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                      rootMethod === m.id
                        ? 'bg-[#2F7CF6] text-white'
                        : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Equation f(x) = 0</label>
                <input
                  type="text"
                  value={rootExpr}
                  onChange={(e) => setRootExpr(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {rootMethod === 'bisection' || rootMethod === 'regula-falsi' ? (
                  <>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">Bracket a</label>
                      <input
                        type="number"
                        step="any"
                        value={bracketA}
                        onChange={(e) => setBracketA(e.target.value)}
                        className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">Bracket b</label>
                      <input
                        type="number"
                        step="any"
                        value={bracketB}
                        onChange={(e) => setBracketB(e.target.value)}
                        className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">Initial x₀</label>
                      <input
                        type="number"
                        step="any"
                        value={guessX0}
                        onChange={(e) => setGuessX0(e.target.value)}
                        className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                      />
                    </div>
                    {rootMethod === 'secant' && (
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400">Second x₁</label>
                        <input
                          type="number"
                          step="any"
                          value={guessX1}
                          onChange={(e) => setGuessX1(e.target.value)}
                          className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                        />
                      </div>
                    )}
                  </>
                )}
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Tolerance</label>
                  <input
                    type="number"
                    step="any"
                    value={tol}
                    onChange={(e) => setTol(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
              </div>
            </>
          )}

          {category === 'linear' && (
            <>
              <div className="flex gap-2">
                {(
                  [
                    { id: 'gauss-seidel', label: 'Gauss-Seidel Iterative' },
                    { id: 'gauss-elim', label: 'Gauss Elimination' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setLinMethod(m.id)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium ${
                      linMethod === m.id
                        ? 'bg-[#2F7CF6] text-white'
                        : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">3×3 Matrix A &amp; Vector b</div>
                {matA.map((row, r) => (
                  <div key={r} className="grid grid-cols-4 gap-2">
                    {row.map((v, c) => (
                      <input
                        key={c}
                        type="number"
                        step="any"
                        value={v}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setMatA((prev) => prev.map((rw, ri) => (ri === r ? rw.map((cl, ci) => (ci === c ? val : cl)) : rw)));
                        }}
                        className="h-9 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent text-center font-mono text-xs tabular-nums"
                      />
                    ))}
                    <input
                      type="number"
                      step="any"
                      value={vecB[r]}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setVecB((prev) => prev.map((b, ri) => (ri === r ? val : b)));
                      }}
                      className="h-9 px-2 rounded-lg border border-[#2F7CF6]/40 bg-transparent text-center font-mono text-xs tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {category === 'integration' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'trapezoidal', label: 'Trapezoidal' },
                    { id: 'simpson-1-3', label: "Simpson's 1/3" },
                    { id: 'simpson-3-8', label: "Simpson's 3/8" },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setIntRule(r.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      intRule === r.id
                        ? 'bg-[#2F7CF6] text-white'
                        : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Integrand f(x)</label>
                <input
                  type="text"
                  value={intExpr}
                  onChange={(e) => setIntExpr(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Lower a</label>
                  <input
                    type="number"
                    step="any"
                    value={intA}
                    onChange={(e) => setIntA(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Upper b</label>
                  <input
                    type="number"
                    step="any"
                    value={intB}
                    onChange={(e) => setIntB(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Subintervals n</label>
                  <input
                    type="number"
                    min="2"
                    max="60"
                    value={intN}
                    onChange={(e) => setIntN(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
              </div>
            </>
          )}

          {computed.error && (
            <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
              {computed.error}
            </div>
          )}

          {computed.res && (
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
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
          )}
        </div>

        {/* Results, Iteration Table & Canvas */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {computed.category === 'roots' && computed.res
                  ? `Root Approximation: x* ≈ ${Number(computed.res.root.toFixed(7))}`
                  : computed.category === 'integration' && computed.res
                  ? `Quadrature Value ≈ ${Number(computed.res.approxValue.toFixed(7))}`
                  : computed.category === 'gauss-seidel' && computed.res
                  ? `Gauss-Seidel Solution (${computed.res.converged ? 'Converged' : 'Stopped'})`
                  : computed.category === 'gauss-elim' && computed.res
                  ? computed.res.operation
                  : 'Computation Output'}
              </h3>
              {computed.category === 'integration' && computed.res && (
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Abs Error: {computed.res.absoluteError.toExponential(3)} · Rel Error:{' '}
                  {computed.res.relativeErrorPct.toFixed(4)}% · h = {computed.res.stepSizeH.toFixed(5)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!computed.res}
                onClick={() => {
                  if (!computed.res) return;
                  triggerHaptic(settings.hapticsEnabled, 12);
                  onSaveToNotebook({
                    title: `Numerical Methods (${category})`,
                    topic: 'Numerical Methods',
                    content: computed.res.steps.map((s) => `${s.rule}: $$${s.latex}$$`).join('\n'),
                  });
                  setSavedNote(true);
                  setTimeout(() => setSavedNote(false), 1600);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
              >
                {savedNote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savedNote ? 'Saved' : 'Note'}</span>
              </button>
              <button
                type="button"
                disabled={!computed.res}
                onClick={() => {
                  if (!computed.res) return;
                  downloadSingleSolutionPdf({
                    title: `Numerical Methods (${category})`,
                    expression: category === 'roots' ? rootExpr : category === 'integration' ? intExpr : '3x3 Linear System',
                    resultPlain: computed.res.steps[computed.res.steps.length - 1]?.description ?? 'Solved',
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

          {category !== 'linear' || linMethod === 'gauss-seidel' ? (
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 h-[250px]">
              <canvas ref={canvasRef} className="w-full h-full block" />
            </div>
          ) : null}

          {computed.category === 'roots' && computed.res && (
            <div className="overflow-x-auto max-h-[260px] border border-slate-200 dark:border-white/10 rounded-xl">
              <table className="w-full text-xs font-mono tabular-nums text-left">
                <thead className="bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Iter</th>
                    <th className="px-3 py-2">x</th>
                    <th className="px-3 py-2">f(x)</th>
                    <th className="px-3 py-2">|Δx| Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {computed.res.iterations.map((row) => (
                    <tr key={row.iter}>
                      <td className="px-3 py-1.5">{row.iter}</td>
                      <td className="px-3 py-1.5 font-semibold text-[#2F7CF6]">{row.x.toFixed(6)}</td>
                      <td className="px-3 py-1.5">{row.fx.toExponential(2)}</td>
                      <td className="px-3 py-1.5">{row.error.toExponential(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {computed.category === 'gauss-seidel' && computed.res && (
            <div className="overflow-x-auto max-h-[260px] border border-slate-200 dark:border-white/10 rounded-xl">
              <table className="w-full text-xs font-mono tabular-nums text-left">
                <thead className="bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">k</th>
                    <th className="px-3 py-2">x₁</th>
                    <th className="px-3 py-2">x₂</th>
                    <th className="px-3 py-2">x₃</th>
                    <th className="px-3 py-2">Max Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {computed.res.rows.map((row) => (
                    <tr key={row.iter}>
                      <td className="px-3 py-1.5">{row.iter}</td>
                      {row.x.map((val, idx) => (
                        <td key={idx} className="px-3 py-1.5">{val.toFixed(5)}</td>
                      ))}
                      <td className="px-3 py-1.5 text-amber-500">{row.maxError.toExponential(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {computed.category === 'gauss-elim' && computed.res && (
            <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto">
              <MathTex tex={computed.res.resultLatex} display />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
