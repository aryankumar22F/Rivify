import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, FileDown, GitBranch, Save } from 'lucide-react';
import {
  solveFirstOrderOde,
  solveIntroPde,
  solveSecondOrderOde,
} from '../engine/differentialEquations';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface DifferentialEquationsViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

type DeMode = 'ode1' | 'ode2' | 'pde';

export function DifferentialEquationsView({
  settings,
  onSaveToNotebook,
}: DifferentialEquationsViewProps) {
  const [mode, setMode] = useState<DeMode>('ode1');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  // 1st-Order ODE state
  const [rhsExpr, setRhsExpr] = useState('-0.5*y + sin(x)');
  const [ode1X0, setOde1X0] = useState('0');
  const [ode1Y0, setOde1Y0] = useState('1.5');
  const [ode1XEnd, setOde1XEnd] = useState('8');

  // 2nd-Order ODE state
  const [coefA, setCoefA] = useState('1');
  const [coefB, setCoefB] = useState('0.4');
  const [coefC, setCoefC] = useState('4');
  const [forcingExpr, setForcingExpr] = useState('0');
  const [ode2Mode, setOde2Mode] = useState<'ivp' | 'bvp'>('ivp');
  const [ode2X0, setOde2X0] = useState('0');
  const [ode2Y0, setOde2Y0] = useState('2');
  const [ode2Yp0, setOde2Yp0] = useState('0');
  const [ode2XEnd, setOde2XEnd] = useState('10');
  const [ode2YEnd, setOde2YEnd] = useState('-1');

  // PDE state
  const [pdeType, setPdeType] = useState<'heat' | 'wave' | 'laplace'>('heat');
  const [pdeLength, setPdeLength] = useState('1');
  const [pdeCoeff, setPdeCoeff] = useState('0.15');
  const [pdeDuration, setPdeDuration] = useState('1.2');

  const computed = useMemo(() => {
    try {
      if (mode === 'ode1') {
        const res = solveFirstOrderOde({
          rhsExpr,
          x0: Number(ode1X0) || 0,
          y0: Number(ode1Y0) || 0,
          xEnd: Number(ode1XEnd) || 6,
          angleUnit: settings.angleUnit,
        });
        return { mode: 'ode1' as const, res, error: null as string | null };
      }
      if (mode === 'ode2') {
        const res = solveSecondOrderOde({
          a: Number(coefA) || 1,
          b: Number(coefB) || 0,
          c: Number(coefC) || 0,
          forcingExpr,
          problemMode: ode2Mode,
          x0: Number(ode2X0) || 0,
          y0: Number(ode2Y0) || 0,
          yp0: Number(ode2Yp0) || 0,
          xEnd: Number(ode2XEnd) || 8,
          yEnd: Number(ode2YEnd) || 0,
          angleUnit: settings.angleUnit,
        });
        return { mode: 'ode2' as const, res, error: null as string | null };
      }
      const res = solveIntroPde({
        pdeType,
        length: Number(pdeLength) || 1,
        coeff: Number(pdeCoeff) || 0.15,
        duration: Number(pdeDuration) || 1,
      });
      return { mode: 'pde' as const, res, error: null as string | null };
    } catch (e) {
      return {
        mode,
        res: null,
        error: e instanceof Error ? e.message : 'Unable to solve differential equation.',
      };
    }
  }, [
    mode,
    rhsExpr,
    ode1X0,
    ode1Y0,
    ode1XEnd,
    coefA,
    coefB,
    coefC,
    forcingExpr,
    ode2Mode,
    ode2X0,
    ode2Y0,
    ode2Yp0,
    ode2XEnd,
    ode2YEnd,
    pdeType,
    pdeLength,
    pdeCoeff,
    pdeDuration,
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

    const pad = 40;
    const drawAxes = (xMin: number, xMax: number, yMin: number, yMax: number) => {
      const toX = (x: number) => pad + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * (w - pad * 2);
      const toY = (y: number) => h - pad - ((y - yMin) / Math.max(1e-6, yMax - yMin)) * (h - pad * 2);

      ctx.strokeStyle = dark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 6; i++) {
        const gx = pad + (i / 6) * (w - pad * 2);
        const gy = pad + (i / 6) * (h - pad * 2);
        ctx.beginPath();
        ctx.moveTo(gx, pad);
        ctx.lineTo(gx, h - pad);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad, gy);
        ctx.lineTo(w - pad, gy);
        ctx.stroke();
      }
      if (yMin <= 0 && yMax >= 0) {
        const y0 = toY(0);
        ctx.strokeStyle = dark ? 'rgba(226,232,240,0.35)' : 'rgba(15,23,42,0.35)';
        ctx.beginPath();
        ctx.moveTo(pad, y0);
        ctx.lineTo(w - pad, y0);
        ctx.stroke();
      }
      ctx.fillStyle = dark ? '#94A3B8' : '#475569';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(xMin.toFixed(1), pad, h - 14);
      ctx.fillText(xMax.toFixed(1), w - pad - 24, h - 14);
      ctx.fillText(yMax.toFixed(2), 6, pad + 6);
      ctx.fillText(yMin.toFixed(2), 6, h - pad);

      return { toX, toY };
    };

    if (computed.mode === 'ode1' && computed.res) {
      const pts = computed.res.points;
      const sf = computed.res.slopeField;
      const allX = [...pts.map((p) => p.x), ...sf.map((s) => s.x)];
      const allY = [...pts.map((p) => p.y), ...sf.map((s) => s.y)];
      const xMin = Math.min(...allX);
      const xMax = Math.max(...allX);
      const yMin = Math.min(...allY);
      const yMax = Math.max(...allY);
      const { toX, toY } = drawAxes(xMin, xMax, yMin, yMax);

      // Draw slope field segments
      ctx.strokeStyle = dark ? 'rgba(148,163,184,0.45)' : 'rgba(71,85,105,0.45)';
      ctx.lineWidth = 1.2;
      for (const seg of sf) {
        const sx = toX(seg.x);
        const sy = toY(seg.y);
        const ang = Math.atan(seg.slope);
        const len = 8;
        ctx.beginPath();
        ctx.moveTo(sx - len * Math.cos(ang), sy + len * Math.sin(ang));
        ctx.lineTo(sx + len * Math.cos(ang), sy - len * Math.sin(ang));
        ctx.stroke();
      }

      // RK4 trajectory
      if (pts.length > 1) {
        ctx.strokeStyle = '#2F7CF6';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        pts.forEach((p, idx) => {
          const sx = toX(p.x);
          const sy = toY(p.y);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();

        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(toX(pts[0].x), toY(pts[0].y), 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (computed.mode === 'ode2' && computed.res) {
      const pts = computed.res.points;
      const xMin = pts[0]?.x ?? 0;
      const xMax = pts[pts.length - 1]?.x ?? 1;
      const ys = pts.flatMap((p) => [p.y, p.yp ?? 0]);
      const yMin = Math.min(...ys, -0.5);
      const yMax = Math.max(...ys, 0.5);
      const { toX, toY } = drawAxes(xMin, xMax, yMin, yMax);

      // Derivative y'(x) dashed emerald
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.7;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const sx = toX(p.x);
        const sy = toY(p.yp ?? 0);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Solution y(x) solid blue
      ctx.strokeStyle = '#2F7CF6';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const sx = toX(p.x);
        const sy = toY(p.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
    } else if (computed.mode === 'pde' && computed.res) {
      const { pdeType: pt, gridX, profiles } = computed.res;
      if (pt === 'laplace') {
        const rows = profiles.length;
        const cols = profiles[0].length;
        const flat = profiles.flat();
        const maxAbs = Math.max(1e-5, ...flat.map(Math.abs));
        const cw = (w - pad * 2) / cols;
        const ch = (h - pad * 2) / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const val = profiles[rows - 1 - r][c] / maxAbs;
            const hue = 225 - Math.max(0, val) * 185;
            ctx.fillStyle = `hsl(${hue}, 78%, ${dark ? '48%' : '54%'})`;
            ctx.fillRect(pad + c * cw, pad + r * ch, cw + 0.6, ch + 0.6);
          }
        }
      } else {
        const allY = profiles.flat();
        const yMin = Math.min(...allY, -0.5);
        const yMax = Math.max(...allY, 0.5);
        const { toX, toY } = drawAxes(gridX[0], gridX[gridX.length - 1], yMin, yMax);
        const idxs = [0, 5, 11, 18, 25, profiles.length - 1].filter(
          (i) => i >= 0 && i < profiles.length
        );
        idxs.forEach((tIdx, step) => {
          const alpha = 0.28 + (step / Math.max(1, idxs.length - 1)) * 0.72;
          ctx.strokeStyle =
            pt === 'heat' ? `rgba(249, 115, 22, ${alpha})` : `rgba(47, 124, 246, ${alpha})`;
          ctx.lineWidth = step === idxs.length - 1 ? 2.6 : 1.6;
          ctx.beginPath();
          profiles[tIdx].forEach((u, xi) => {
            const sx = toX(gridX[xi]);
            const sy = toY(u);
            if (xi === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          });
          ctx.stroke();
        });
      }
    }

    ctx.restore();
  }, [computed, settings.theme]);

  const handleSave = () => {
    if (!computed.res) return;
    triggerHaptic(settings.hapticsEnabled, 12);
    const latex =
      computed.mode === 'ode1'
        ? computed.res.particularSolutionLatex
        : computed.mode === 'ode2'
        ? computed.res.solutionLatex
        : computed.res.fourierSolutionLatex;
    onSaveToNotebook({
      title: `DE Lab (${mode.toUpperCase()})`,
      topic: 'Differential Equations',
      content: `$$${latex}$$`,
    });
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 1600);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-[#2F7CF6]" />
              Differential Equations Lab
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Analyze 1st-order ODE slope fields, 2nd-order IVP/BVP systems via characteristic equations &amp; RK4 shooting, and classical PDEs (Heat, Wave, Laplace).
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'ode1', label: '1st-Order ODE' },
                { id: 'ode2', label: '2nd-Order IVP/BVP' },
                { id: 'pde', label: 'Intro PDEs' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === tab.id
                    ? 'bg-[#2F7CF6] text-white'
                    : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          {mode === 'ode1' && (
            <>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  dy/dx = f(x, y)
                </label>
                <input
                  type="text"
                  value={rhsExpr}
                  onChange={(e) => setRhsExpr(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">x₀</label>
                  <input
                    type="number"
                    step="any"
                    value={ode1X0}
                    onChange={(e) => setOde1X0(e.target.value)}
                    className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">y(x₀)</label>
                  <input
                    type="number"
                    step="any"
                    value={ode1Y0}
                    onChange={(e) => setOde1Y0(e.target.value)}
                    className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">x end</label>
                  <input
                    type="number"
                    step="any"
                    value={ode1XEnd}
                    onChange={(e) => setOde1XEnd(e.target.value)}
                    className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { label: "y' = 0.5y", rhs: '0.5*y' },
                  { label: "Logistic", rhs: 'y*(1 - y/4)' },
                  { label: "Linear", rhs: '-y + cos(x)' },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setRhsExpr(p.rhs)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#22252E] font-mono text-slate-700 dark:text-slate-200"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === 'ode2' && (
            <>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                ay′′ + by′ + cy = g(x)
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { lbl: 'a', val: coefA, set: setCoefA },
                  { lbl: 'b', val: coefB, set: setCoefB },
                  { lbl: 'c', val: coefC, set: setCoefC },
                ].map((item) => (
                  <div key={item.lbl}>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">{item.lbl}</label>
                    <input
                      type="number"
                      step="any"
                      value={item.val}
                      onChange={(e) => item.set(e.target.value)}
                      className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Forcing g(x)</label>
                <input
                  type="text"
                  value={forcingExpr}
                  onChange={(e) => setForcingExpr(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                {(['ivp', 'bvp'] as const).map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setOde2Mode(pm)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-semibold uppercase ${
                      ode2Mode === pm
                        ? 'bg-[#2F7CF6] text-white'
                        : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {pm === 'ivp' ? 'IVP (y₀, y′₀)' : 'BVP (y(x₀), y(xₙ))'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">x₀</label>
                  <input
                    type="number"
                    step="any"
                    value={ode2X0}
                    onChange={(e) => setOde2X0(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">y(x₀)</label>
                  <input
                    type="number"
                    step="any"
                    value={ode2Y0}
                    onChange={(e) => setOde2Y0(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">x end</label>
                  <input
                    type="number"
                    step="any"
                    value={ode2XEnd}
                    onChange={(e) => setOde2XEnd(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">
                    {ode2Mode === 'ivp' ? "y'(x₀)" : 'y(x end)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={ode2Mode === 'ivp' ? ode2Yp0 : ode2YEnd}
                    onChange={(e) =>
                      ode2Mode === 'ivp' ? setOde2Yp0(e.target.value) : setOde2YEnd(e.target.value)
                    }
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'pde' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'heat', label: '1D Heat (Parabolic)' },
                    { id: 'wave', label: '1D Wave (Hyperbolic)' },
                    { id: 'laplace', label: '2D Laplace (Elliptic)' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPdeType(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                      pdeType === p.id
                        ? 'bg-[#2F7CF6] text-white'
                        : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Length L</label>
                  <input
                    type="number"
                    step="any"
                    value={pdeLength}
                    onChange={(e) => setPdeLength(e.target.value)}
                    className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">
                    {pdeType === 'heat' ? 'α' : pdeType === 'wave' ? 'c' : 'Top U₀'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={pdeCoeff}
                    onChange={(e) => setPdeCoeff(e.target.value)}
                    className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Max t</label>
                  <input
                    type="number"
                    step="any"
                    value={pdeDuration}
                    onChange={(e) => setPdeDuration(e.target.value)}
                    className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums"
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
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
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

        {/* Visualization + Summary Panel */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {computed.mode === 'ode1' && computed.res
                  ? computed.res.classification
                  : computed.mode === 'ode2' && computed.res
                  ? computed.res.classification
                  : computed.mode === 'pde' && computed.res
                  ? `Fourier Analytical & Numerical Profile (${computed.res.pdeType.toUpperCase()})`
                  : 'Solution & Plot'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'ode1'
                  ? 'Direction field segments with RK4 integral curve'
                  : mode === 'ode2'
                  ? 'Blue: displacement y(x) · Dashed emerald: velocity y′(x)'
                  : pdeType === 'laplace'
                  ? 'Steady-state 2D temperature/potential heatmap'
                  : 'Time-evolved spatial profiles u(x, t)'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSave}
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
                    title: `Differential Equations (${mode.toUpperCase()})`,
                    expression:
                      mode === 'ode1'
                        ? `dy/dx = ${rhsExpr}`
                        : mode === 'ode2'
                        ? `${coefA}y'' + ${coefB}y' + ${coefC}y = ${forcingExpr}`
                        : `${pdeType.toUpperCase()} PDE (L=${pdeLength}, coeff=${pdeCoeff})`,
                    resultPlain:
                      computed.mode === 'ode1'
                        ? computed.res.particularSolutionLatex
                        : computed.mode === 'ode2'
                        ? computed.res.solutionLatex
                        : computed.res.fourierSolutionLatex,
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
            <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-3.5 overflow-x-auto text-slate-900 dark:text-white">
              <MathTex
                tex={
                  computed.mode === 'ode1'
                    ? `${computed.res.generalSolutionLatex} \\quad|\\quad ${computed.res.particularSolutionLatex}`
                    : computed.mode === 'ode2'
                    ? computed.res.solutionLatex
                    : computed.res.fourierSolutionLatex
                }
                display
              />
            </div>
          )}

          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 h-[360px]">
            <canvas ref={canvasRef} className="w-full h-full block" />
          </div>
        </div>
      </div>
    </div>
  );
}
