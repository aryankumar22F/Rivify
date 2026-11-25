import { useEffect, useMemo, useRef, useState } from 'react';
import { Grid3X3, Pause, Play, RotateCcw } from 'lucide-react';
import { computeEigen, determinantAndRank, multiplyMatrices } from '../engine/linearAlgebra';
import type { AppSettings } from '../types';
import { MathTex } from './MathTex';

interface MatrixVisualizerViewProps {
  settings: AppSettings;
}

export function MatrixVisualizerView({ settings }: MatrixVisualizerViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [a00, setA00] = useState('1.5');
  const [a01, setA01] = useState('0.8');
  const [a10, setA10] = useState('0');
  const [a11, setA11] = useState('1.2');

  const [composeB, setComposeB] = useState(false);
  const [b00, setB00] = useState('0');
  const [b01, setB01] = useState('-1');
  const [b10, setB10] = useState('1');
  const [b11, setB11] = useState('0');

  const [vxStr, setVxStr] = useState('1.5');
  const [vyStr, setVyStr] = useState('1');
  const [tVal, setTVal] = useState(1);
  const [playing, setPlaying] = useState(false);

  const analysis = useMemo(() => {
    const A = [
      [Number(a00) || 0, Number(a01) || 0],
      [Number(a10) || 0, Number(a11) || 0],
    ];
    const B = [
      [Number(b00) || 0, Number(b01) || 0],
      [Number(b10) || 0, Number(b11) || 0],
    ];
    const M = composeB ? multiplyMatrices(B, A).resultMatrix! : A;
    const detRank = determinantAndRank(M);
    const eig = computeEigen(M);
    const vx = Number(vxStr) || 0;
    const vy = Number(vyStr) || 0;
    const mappedV = [M[0][0] * vx + M[0][1] * vy, M[1][0] * vx + M[1][1] * vy];
    return {
      A,
      B,
      M,
      det: detRank.scalarResult ?? 0,
      rank: detRank.rank ?? 0,
      eig,
      v: [vx, vy],
      mappedV,
    };
  }, [a00, a01, a10, a11, b00, b01, b10, b11, composeB, vxStr, vyStr]);

  useEffect(() => {
    if (!playing) return;
    let dir = 1;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTVal((prev) => {
        const next = prev + dir * dt * 0.45;
        if (next >= 1) {
          dir = -1;
          return 1;
        }
        if (next <= 0) {
          dir = 1;
          return 0;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

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

    const scale = 58;
    const cx = w / 2;
    const cy = h / 2;
    const toSX = (x: number) => cx + x * scale;
    const toSY = (y: number) => cy - y * scale;

    // Interpolated matrix M(t) = (1 - t)I + tM
    const M = analysis.M;
    const Mt = [
      [1 - tVal + tVal * M[0][0], tVal * M[0][1]],
      [tVal * M[1][0], 1 - tVal + tVal * M[1][1]],
    ];
    const applyM = (x: number, y: number): [number, number] => [
      Mt[0][0] * x + Mt[0][1] * y,
      Mt[1][0] * x + Mt[1][1] * y,
    ];

    // Background fixed reference grid
    ctx.strokeStyle = dark ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.07)';
    ctx.lineWidth = 1;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(toSX(i), 0);
      ctx.lineTo(toSX(i), h);
      ctx.moveTo(0, toSY(i));
      ctx.lineTo(w, toSY(i));
      ctx.stroke();
    }

    // Transformed grid lines (cyan/blue tint)
    ctx.strokeStyle = dark ? 'rgba(47, 124, 246, 0.24)' : 'rgba(47, 124, 246, 0.2)';
    ctx.lineWidth = 1.1;
    for (let i = -5; i <= 5; i++) {
      const [x1, y1] = applyM(i, -5);
      const [x2, y2] = applyM(i, 5);
      ctx.beginPath();
      ctx.moveTo(toSX(x1), toSY(y1));
      ctx.lineTo(toSX(x2), toSY(y2));
      ctx.stroke();

      const [hx1, hy1] = applyM(-5, i);
      const [hx2, hy2] = applyM(5, i);
      ctx.beginPath();
      ctx.moveTo(toSX(hx1), toSY(hy1));
      ctx.lineTo(toSX(hx2), toSY(hy2));
      ctx.stroke();
    }

    // Main axes
    ctx.strokeStyle = dark ? 'rgba(226,232,240,0.35)' : 'rgba(15,23,42,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // Unit square -> Transformed Determinant Parallelogram
    const sqPts = [
      applyM(0, 0),
      applyM(1, 0),
      applyM(1, 1),
      applyM(0, 1),
    ];
    ctx.fillStyle = analysis.det >= 0 ? 'rgba(47, 124, 246, 0.22)' : 'rgba(244, 63, 94, 0.22)';
    ctx.strokeStyle = analysis.det >= 0 ? '#2F7CF6' : '#F43F5E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    sqPts.forEach(([px, py], idx) =>
      idx === 0 ? ctx.moveTo(toSX(px), toSY(py)) : ctx.lineTo(toSX(px), toSY(py))
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Eigenvector lines (infinite spans when real)
    if (analysis.eig.eigenvectors && analysis.eig.eigenvectors.length > 0) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 1.5;
      for (const ev of analysis.eig.eigenvectors) {
        ctx.beginPath();
        ctx.moveTo(toSX(-ev[0] * 6), toSY(-ev[1] * 6));
        ctx.lineTo(toSX(ev[0] * 6), toSY(ev[1] * 6));
        ctx.stroke();
      }
      ctx.restore();
    }

    const drawVec = (tx: number, ty: number, col: string, label: string) => {
      const sx = cx;
      const sy = cy;
      const ex = toSX(tx);
      const ey = toSY(ty);
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      const ang = Math.atan2(ey - sy, ex - sx);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 9 * Math.cos(ang - 0.45), ey - 9 * Math.sin(ang - 0.45));
      ctx.lineTo(ex - 9 * Math.cos(ang + 0.45), ey - 9 * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
      ctx.font = '700 12px JetBrains Mono, monospace';
      ctx.fillText(label, ex + 6, ey - 6);
    };

    // Transformed basis i-hat, j-hat, and custom vector v
    const [ix, iy] = applyM(1, 0);
    const [jx, jy] = applyM(0, 1);
    const [tvx, tvy] = applyM(analysis.v[0], analysis.v[1]);
    drawVec(ix, iy, '#EF4444', 'T(î)');
    drawVec(jx, jy, '#10B981', 'T(ĵ)');
    drawVec(tvx, tvy, '#F59E0B', 'T(v)');
  }, [analysis, tVal, settings.theme]);

  const applyPreset = (vals: [string, string, string, string]) => {
    setA00(vals[0]);
    setA01(vals[1]);
    setA10(vals[2]);
    setA11(vals[3]);
    setTVal(1);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-[#2F7CF6]" />
              2D Linear Transformation &amp; Matrix Visualizer
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Explore rotations, scaling, reflections, shear, matrix composition, unit-square area distortion (det A), and invariant eigenspaces.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Rotate 45°', v: ['0.707', '-0.707', '0.707', '0.707'] as [string, string, string, string] },
              { label: 'Shear', v: ['1', '1.2', '0', '1'] as [string, string, string, string] },
              { label: 'Reflect y=x', v: ['0', '1', '1', '0'] as [string, string, string, string] },
              { label: 'Scale (2, 0.5)', v: ['2', '0', '0', '0.5'] as [string, string, string, string] },
              { label: 'Project x-axis', v: ['1', '0', '0', '0'] as [string, string, string, string] },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.v)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#22252E] hover:border-[#2F7CF6] border border-transparent text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div className="text-xs font-semibold text-slate-900 dark:text-white">
            Primary Transformation Matrix A
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: a00, set: setA00 },
              { val: a01, set: setA01 },
              { val: a10, set: setA10 },
              { val: a11, set: setA11 },
            ].map((cell, idx) => (
              <input
                key={idx}
                type="number"
                step="any"
                value={cell.val}
                onChange={(e) => cell.set(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-center tabular-nums text-slate-900 dark:text-white"
              />
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={composeB}
              onChange={(e) => setComposeB(e.target.checked)}
              className="accent-[#2F7CF6]"
            />
            Compose Second Matrix B · A
          </label>

          {composeB && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                { val: b00, set: setB00 },
                { val: b01, set: setB01 },
                { val: b10, set: setB10 },
                { val: b11, set: setB11 },
              ].map((cell, idx) => (
                <input
                  key={idx}
                  type="number"
                  step="any"
                  value={cell.val}
                  onChange={(e) => cell.set(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-center tabular-nums text-slate-900 dark:text-white"
                />
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">Test Vector v</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                value={vxStr}
                onChange={(e) => setVxStr(e.target.value)}
                aria-label="Vector x"
                className="h-9 px-3 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
              />
              <input
                type="number"
                step="any"
                value={vyStr}
                onChange={(e) => setVyStr(e.target.value)}
                aria-label="Vector y"
                className="h-9 px-3 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Animation Interpolation Slider */}
          <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900 dark:text-white">
                Interpolation t = {tVal.toFixed(2)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="px-2.5 py-1 rounded-lg bg-[#2F7CF6] text-white text-[11px] font-semibold inline-flex items-center gap-1"
                >
                  {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {playing ? 'Pause' : 'Animate'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setTVal(1);
                  }}
                  aria-label="Snap to final state"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={tVal}
              onChange={(e) => {
                setPlaying(false);
                setTVal(Number(e.target.value));
              }}
              className="w-full accent-[#2F7CF6]"
            />
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Determinant (Area Scale)</span>
              <span className="font-mono font-bold text-[#2F7CF6] tabular-nums">
                {analysis.det.toFixed(3)} {analysis.det < 0 ? '(Orientation Flipped)' : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Rank · Output T(v)</span>
              <span className="font-mono text-slate-900 dark:text-white tabular-nums">
                rank {analysis.rank} · ({analysis.mappedV[0].toFixed(2)}, {analysis.mappedV[1].toFixed(2)})
              </span>
            </div>
            <div className="overflow-x-auto pt-1 text-slate-900 dark:text-white">
              <MathTex tex={analysis.eig.resultLatex} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-white/10 flex flex-wrap gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="text-rose-500 font-semibold">Red: T(î)</span>
            <span className="text-emerald-500 font-semibold">Green: T(ĵ)</span>
            <span className="text-amber-500 font-semibold">Amber: T(v)</span>
            <span className="text-purple-400 font-semibold">Dashed Purple: Eigenspaces</span>
            <span className="text-[#2F7CF6] font-semibold">Shaded: Unit Square Area = |det|</span>
          </div>
          <canvas ref={canvasRef} width={860} height={520} className="w-full h-[380px] sm:h-[480px] block" />
        </div>
      </div>
    </div>
  );
}
