import { useEffect, useMemo, useRef, useState } from 'react';
import { Film, ImageDown, Pause, Play, RotateCcw, Video } from 'lucide-react';
import {
  differentiate,
  evaluateAST,
  parseExpression,
  simplify,
  type ExprNode,
} from '../engine/symbolic';
import type { AppSettings, RecentGraphSession } from '../types';

interface GraphAnimationViewProps {
  settings: AppSettings;
  onRecordGraphSession?: (session: RecentGraphSession) => void;
}

type AnimMode =
  | 'parameter-sweep'
  | 'transformation'
  | 'derivative-tangent'
  | 'integral-riemann'
  | 'taylor-approx'
  | 'vector-field';

export function GraphAnimationView({ settings, onRecordGraphSession }: GraphAnimationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<AnimMode>('derivative-tangent');
  const [expr, setExpr] = useState('sin(x) + 0.15*x^2');
  const [paramExpr, setParamExpr] = useState('sin(a * x) * cos(0.5*x)');
  const [vecP, setVecP] = useState('-y + 0.3*a*x');
  const [vecQ, setVecQ] = useState('x');

  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0.35); // 0..1
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [recording, setRecording] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      const fAst = parseExpression(expr);
      const dfAst = simplify(differentiate(fAst, 'x'));
      const pAst = parseExpression(paramExpr);
      const vpAst = parseExpression(vecP);
      const vqAst = parseExpression(vecQ);

      // Precompute Taylor derivatives up to degree 7 around x = 0
      const taylorCoeffs: number[] = [];
      let cur: ExprNode = simplify(fAst);
      let fact = 1;
      for (let k = 0; k <= 7; k++) {
        if (k > 0) {
          fact *= k;
          cur = simplify(differentiate(cur, 'x'));
        }
        try {
          taylorCoeffs.push(evaluateAST(cur, { x: 0 }, settings.angleUnit) / fact);
        } catch {
          taylorCoeffs.push(0);
        }
      }
      return { fAst, dfAst, pAst, vpAst, vqAst, taylorCoeffs, error: null as string | null };
    } catch (e) {
      return {
        fAst: null,
        dfAst: null,
        pAst: null,
        vpAst: null,
        vqAst: null,
        taylorCoeffs: [] as number[],
        error: e instanceof Error ? e.message : 'Invalid expression syntax.',
      };
    }
  }, [expr, paramExpr, vecP, vecQ, settings.angleUnit]);

  // Log session to Dashboard when expression or mode settles
  useEffect(() => {
    if (!onRecordGraphSession || parsed.error) return;
    const t = setTimeout(() => {
      onRecordGraphSession({
        id: `ga-${mode}-${expr}`,
        title: `Animated ${mode.replace('-', ' ')}`,
        sourceTool: 'graph-animation',
        expression: mode === 'parameter-sweep' ? paramExpr : mode === 'vector-field' ? `<${vecP}, ${vecQ}>` : expr,
        timestamp: Date.now(),
      });
    }, 900);
    return () => clearTimeout(t);
  }, [mode, expr, paramExpr, vecP, vecQ, parsed.error, onRecordGraphSession]);

  // Playback loop
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => (p + dt * 0.14 * speed) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  // Render animation frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const dark = settings.theme === 'dark';

    ctx.fillStyle = dark ? '#11151E' : '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const xMin = -5;
    const xMax = 5;
    const yMin = -4;
    const yMax = 4;
    const pad = 42;
    const toSX = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * (w - pad * 2);
    const toSY = (y: number) => h - pad - ((y - yMin) / (yMax - yMin)) * (h - pad * 2);

    // Grid & axes
    ctx.strokeStyle = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const gx = pad + (i / 10) * (w - pad * 2);
      const gy = pad + (i / 8) * (h - pad * 2);
      ctx.beginPath();
      ctx.moveTo(gx, pad);
      ctx.lineTo(gx, h - pad);
      ctx.stroke();
      if (i <= 8) {
        ctx.beginPath();
        ctx.moveTo(pad, gy);
        ctx.lineTo(w - pad, gy);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = dark ? 'rgba(226,232,240,0.35)' : 'rgba(15,23,42,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, toSY(0));
    ctx.lineTo(w - pad, toSY(0));
    ctx.moveTo(toSX(0), pad);
    ctx.lineTo(toSX(0), h - pad);
    ctx.stroke();

    const drawCurve = (fn: (x: number) => number, col: string, dashed = false, lineWidth = 2.6) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dashed ? [6, 4] : []);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 260; i++) {
        const x = xMin + (i / 260) * (xMax - xMin);
        try {
          const y = fn(x);
          if (!Number.isFinite(y) || Math.abs(y) > 20) {
            started = false;
            continue;
          }
          const sx = toSX(x);
          const sy = toSY(y);
          if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
          } else {
            ctx.lineTo(sx, sy);
          }
        } catch {
          started = false;
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    const aParam = -2 + progress * 4; // [-2, 2]
    let hudText = '';

    if (mode === 'parameter-sweep' && parsed.pAst) {
      const a = 0.4 + progress * 3.2;
      drawCurve((x) => evaluateAST(parsed.pAst!, { x, a }, settings.angleUnit), '#2F7CF6');
      hudText = `Parameter a = ${a.toFixed(2)}`;
    } else if (mode === 'transformation' && parsed.fAst) {
      drawCurve((x) => evaluateAST(parsed.fAst!, { x }, settings.angleUnit), 'rgba(148,163,184,0.65)', true, 2);
      const shift = Math.sin(progress * Math.PI * 2) * 2;
      const scaleY = 0.6 + 0.8 * Math.sin(progress * Math.PI);
      drawCurve(
        (x) => scaleY * evaluateAST(parsed.fAst!, { x: x - shift }, settings.angleUnit),
        '#10B981',
        false,
        2.8
      );
      hudText = `Transformed: ${scaleY.toFixed(2)} · f(x ${shift >= 0 ? '-' : '+'} ${Math.abs(shift).toFixed(2)})`;
    } else if (mode === 'derivative-tangent' && parsed.fAst && parsed.dfAst) {
      drawCurve((x) => evaluateAST(parsed.fAst!, { x }, settings.angleUnit), '#2F7CF6');
      const x0 = -3.8 + progress * 7.6;
      try {
        const y0 = evaluateAST(parsed.fAst, { x: x0 }, settings.angleUnit);
        const slope = evaluateAST(parsed.dfAst, { x: x0 }, settings.angleUnit);
        drawCurve((x) => y0 + slope * (x - x0), '#F59E0B', false, 2.2);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(toSX(x0), toSY(y0), 6, 0, Math.PI * 2);
        ctx.fill();
        hudText = `x₀ = ${x0.toFixed(2)} | f(x₀) = ${y0.toFixed(2)} | f′(x₀) = ${slope.toFixed(2)}`;
      } catch {
        hudText = `x₀ = ${x0.toFixed(2)} (undefined)`;
      }
    } else if (mode === 'integral-riemann' && parsed.fAst) {
      const nRects = Math.max(2, Math.round(2 + progress * 34));
      const aInt = -2.5;
      const bInt = 2.5;
      const dx = (bInt - aInt) / nRects;
      let sum = 0;
      for (let i = 0; i < nRects; i++) {
        const xMid = aInt + (i + 0.5) * dx;
        try {
          const ym = evaluateAST(parsed.fAst, { x: xMid }, settings.angleUnit);
          if (Number.isFinite(ym)) {
            sum += ym * dx;
            const rx = toSX(aInt + i * dx);
            const rw = toSX(aInt + (i + 1) * dx) - rx;
            const ry0 = toSY(0);
            const rym = toSY(ym);
            ctx.fillStyle = ym >= 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
            ctx.strokeStyle = ym >= 0 ? '#10B981' : '#EF4444';
            ctx.lineWidth = 1;
            ctx.fillRect(rx, Math.min(ry0, rym), rw, Math.abs(rym - ry0));
            ctx.strokeRect(rx, Math.min(ry0, rym), rw, Math.abs(rym - ry0));
          }
        } catch {
          // ignore
        }
      }
      drawCurve((x) => evaluateAST(parsed.fAst!, { x }, settings.angleUnit), '#2F7CF6');
      hudText = `Riemann Midpoint (n = ${nRects}) on [-2.5, 2.5] ≈ ${sum.toFixed(4)}`;
    } else if (mode === 'taylor-approx' && parsed.fAst) {
      const deg = Math.min(7, Math.floor(progress * 8));
      drawCurve((x) => evaluateAST(parsed.fAst!, { x }, settings.angleUnit), 'rgba(148,163,184,0.7)', true, 2);
      drawCurve(
        (x) => {
          let acc = 0;
          for (let k = 0; k <= deg; k++) acc += (parsed.taylorCoeffs[k] ?? 0) * x ** k;
          return acc;
        },
        '#EC4899',
        false,
        2.8
      );
      hudText = `Maclaurin Polynomial P_${deg}(x) converging around x = 0`;
    } else if (mode === 'vector-field' && parsed.vpAst && parsed.vqAst) {
      const cols = 12;
      const rows = 9;
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const vx = xMin + (i / cols) * (xMax - xMin);
          const vy = yMin + (j / rows) * (yMax - yMin);
          try {
            const p = evaluateAST(parsed.vpAst, { x: vx, y: vy, a: aParam }, settings.angleUnit);
            const q = evaluateAST(parsed.vqAst, { x: vx, y: vy, a: aParam }, settings.angleUnit);
            const mag = Math.hypot(p, q);
            if (!Number.isFinite(mag) || mag < 1e-5) continue;
            const len = Math.min(24, 8 + Math.log1p(mag) * 7);
            const sx = toSX(vx);
            const sy = toSY(vy);
            const ex = sx + (p / mag) * len;
            const ey = sy - (q / mag) * len;
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          } catch {
            // ignore
          }
        }
      }
      hudText = `Dynamic Vector Field parameter a = ${aParam.toFixed(2)}`;
    }

    if (hudText) {
      ctx.fillStyle = dark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(pad + 8, 10, Math.min(w - pad * 2 - 16, 480), 26);
      ctx.font = '600 12px JetBrains Mono, monospace';
      ctx.fillStyle = dark ? '#E2E8F0' : '#0F172A';
      ctx.fillText(hudText, pad + 18, 27);
    }
  }, [mode, progress, parsed, settings.angleUnit, settings.theme]);

  const handleSaveFramePng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `rivify-animation-${mode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportVideo = () => {
    const canvas = canvasRef.current as (HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }) | null;
    if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      setStatusNote('WebM recording is not supported in this browser — use PNG frame export instead.');
      return;
    }
    try {
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        setRecording(false);
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rivify-${mode}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatusNote('Exported 4-second WebM animation clip.');
      };
      setPlaying(true);
      setRecording(true);
      setStatusNote('Recording 4s WebM animation...');
      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 4000);
    } catch {
      setRecording(false);
      setStatusNote('MediaRecorder WebM codec unavailable here — PNG frame export works everywhere.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-[#2F7CF6]" />
              Graph Animation Studio
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Animate parameter sweeps, function transformations, tangent slopes, Riemann integral convergence, Taylor polynomials, and vector fields.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveFramePng}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              <ImageDown className="w-3.5 h-3.5" />
              <span>Export Frame PNG</span>
            </button>
            <button
              type="button"
              onClick={handleExportVideo}
              disabled={recording}
              className="h-9 px-3.5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <Video className="w-3.5 h-3.5" />
              <span>{recording ? 'Recording...' : 'Record WebM'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'derivative-tangent', label: 'Tangent & Slope' },
              { id: 'integral-riemann', label: 'Riemann Integration' },
              { id: 'parameter-sweep', label: 'Parameter Sweep a' },
              { id: 'transformation', label: 'Transformations' },
              { id: 'taylor-approx', label: 'Taylor Convergence' },
              { id: 'vector-field', label: 'Vector Field' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap ${
                mode === item.id
                  ? 'bg-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {mode === 'parameter-sweep' ? (
            <div className="md:col-span-6">
              <label className="text-xs text-slate-500 dark:text-slate-400">Expression f(x, a) — animated parameter a ∈ [0.4, 3.6]</label>
              <input
                type="text"
                value={paramExpr}
                onChange={(e) => setParamExpr(e.target.value)}
                className="mt-1 w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
              />
            </div>
          ) : mode === 'vector-field' ? (
            <>
              <div className="md:col-span-3">
                <label className="text-xs text-slate-500 dark:text-slate-400">P(x, y, a)</label>
                <input
                  type="text"
                  value={vecP}
                  onChange={(e) => setVecP(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-slate-500 dark:text-slate-400">Q(x, y, a)</label>
                <input
                  type="text"
                  value={vecQ}
                  onChange={(e) => setVecQ(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-6">
              <label className="text-xs text-slate-500 dark:text-slate-400">Function f(x)</label>
              <input
                type="text"
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                className="mt-1 w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}

          {/* Timeline Controls */}
          <div className="md:col-span-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="h-10 px-3.5 rounded-xl bg-[#2F7CF6] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{playing ? 'Pause' : 'Play'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setProgress(0);
              }}
              aria-label="Reset animation"
              className="h-10 w-10 rounded-xl border border-slate-200 dark:border-white/15 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={progress}
              onChange={(e) => {
                setPlaying(false);
                setProgress(Number(e.target.value));
              }}
              aria-label="Animation timeline scrubber"
              className="flex-1 accent-[#2F7CF6]"
            />
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value) as 0.5 | 1 | 2)}
              aria-label="Playback speed"
              className="h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-xs text-slate-900 dark:text-white"
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </div>
        </div>

        {statusNote && (
          <div className="text-xs text-sky-600 dark:text-sky-300">{statusNote}</div>
        )}
        {parsed.error && (
          <div className="text-xs text-rose-500">{parsed.error}</div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] overflow-hidden">
        <canvas ref={canvasRef} width={960} height={480} className="w-full h-[380px] sm:h-[460px] block" />
      </div>
    </div>
  );
}
