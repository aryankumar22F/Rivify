import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, FileDown, Grid3X3, Save } from 'lucide-react';
import {
  addMatrices,
  computeEigen,
  determinantAndRank,
  inverseMatrix,
  luDecomposition,
  matrixToLatex,
  multiplyMatrices,
  solveLinearSystemMatrix,
  subtractMatrices,
  transposeMatrix,
  type Matrix,
} from '../engine/linearAlgebra';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface LinearAlgebraViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

type LaOperation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'transpose'
  | 'det-rank'
  | 'inverse'
  | 'lu'
  | 'system'
  | 'eigen';

function makeMatrix(rows: number, cols: number, seed = 0): Matrix {
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (__, j) => {
      if (seed === 1) return i === j ? 3 : i + 1 === j ? 1 : 0;
      return i === j ? 2 : (i + j) % 2 === 0 ? 1 : -1;
    })
  );
}

export function LinearAlgebraView({ settings, onSaveToNotebook }: LinearAlgebraViewProps) {
  const [op, setOp] = useState<LaOperation>('eigen');
  const [rowsA, setRowsA] = useState(2);
  const [colsA, setColsA] = useState(2);
  const [rowsB, setRowsB] = useState(2);
  const [colsB, setColsB] = useState(2);

  const [matA, setMatA] = useState<Matrix>([
    [4, 1],
    [2, 3],
  ]);
  const [matB, setMatB] = useState<Matrix>([
    [1, 2],
    [0, -1],
  ]);
  const [vecB, setVecB] = useState<number[]>([5, 5]);
  const [savedNote, setSavedNote] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const resizeMatrix = (
    prev: Matrix,
    r: number,
    c: number,
    fallbackSeed = 0
  ): Matrix => {
    const fresh = makeMatrix(r, c, fallbackSeed);
    return fresh.map((row, i) => row.map((v, j) => prev[i]?.[j] ?? v));
  };

  const handleSizeChange = (target: 'A' | 'B', r: number, c: number) => {
    const cr = Math.min(4, Math.max(2, r));
    const cc = Math.min(4, Math.max(2, c));
    if (target === 'A') {
      setRowsA(cr);
      setColsA(cc);
      setMatA((prev) => resizeMatrix(prev, cr, cc, 0));
      setVecB((prev) => Array.from({ length: cr }, (_, i) => prev[i] ?? i + 1));
    } else {
      setRowsB(cr);
      setColsB(cc);
      setMatB((prev) => resizeMatrix(prev, cr, cc, 1));
    }
  };

  const needsB = op === 'add' || op === 'subtract' || op === 'multiply';

  const computed = useMemo(() => {
    try {
      switch (op) {
        case 'add':
          return { res: addMatrices(matA, matB), error: null as string | null };
        case 'subtract':
          return { res: subtractMatrices(matA, matB), error: null as string | null };
        case 'multiply':
          return { res: multiplyMatrices(matA, matB), error: null as string | null };
        case 'transpose':
          return { res: transposeMatrix(matA), error: null as string | null };
        case 'det-rank':
          return { res: determinantAndRank(matA), error: null as string | null };
        case 'inverse':
          return { res: inverseMatrix(matA), error: null as string | null };
        case 'lu':
          return { res: luDecomposition(matA), error: null as string | null };
        case 'system':
          return { res: solveLinearSystemMatrix(matA, vecB), error: null as string | null };
        case 'eigen':
          return { res: computeEigen(matA), error: null as string | null };
      }
    } catch (e) {
      return {
        res: null,
        error: e instanceof Error ? e.message : 'Unable to execute matrix operation.',
      };
    }
  }, [op, matA, matB, vecB]);

  // Interactive 2D Linear Transformation & Eigenvector Visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    // Project top-left 2x2 slice of matA to show linear transformation of unit square & eigenvectors
    const m00 = matA[0]?.[0] ?? 1;
    const m01 = matA[0]?.[1] ?? 0;
    const m10 = matA[1]?.[0] ?? 0;
    const m11 = matA[1]?.[1] ?? 1;

    const span = Math.max(4, Math.hypot(m00, m10) * 1.4, Math.hypot(m01, m11) * 1.4, Math.hypot(m00 + m01, m10 + m11) * 1.3);
    const scale = Math.min(w, h) / (span * 2.2);
    const cx = w / 2;
    const cy = h / 2;
    const sx = (x: number) => cx + x * scale;
    const sy = (y: number) => cy - y * scale;

    // Grid
    ctx.strokeStyle = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
    ctx.lineWidth = 1;
    for (let g = -6; g <= 6; g++) {
      ctx.beginPath();
      ctx.moveTo(sx(g), 0);
      ctx.lineTo(sx(g), h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, sy(g));
      ctx.lineTo(w, sy(g));
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = dark ? 'rgba(203,213,225,0.4)' : 'rgba(15,23,42,0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // Unit square outline
    ctx.strokeStyle = dark ? 'rgba(148,163,184,0.45)' : 'rgba(71,85,105,0.45)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(0));
    ctx.lineTo(sx(1), sy(0));
    ctx.lineTo(sx(1), sy(1));
    ctx.lineTo(sx(0), sy(1));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Transformed parallelogram A([0,1]^2)
    ctx.fillStyle = 'rgba(47, 124, 246, 0.16)';
    ctx.strokeStyle = '#2F7CF6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(0));
    ctx.lineTo(sx(m00), sy(m10));
    ctx.lineTo(sx(m00 + m01), sy(m10 + m11));
    ctx.lineTo(sx(m01), sy(m11));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const drawVec = (vx: number, vy: number, color: string, label: string) => {
      const ex = sx(vx);
      const ey = sy(vy);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText(label, ex + 5, ey - 4);
    };

    drawVec(m00, m10, '#EF4444', 'Ae₁');
    drawVec(m01, m11, '#10B981', 'Ae₂');

    if (computed.res?.eigenvectors && rowsA === 2 && colsA === 2) {
      computed.res.eigenvectors.forEach((ev, idx) => {
        if (ev.length >= 2) {
          drawVec(ev[0] * 2.2, ev[1] * 2.2, '#F59E0B', `v${idx + 1}`);
        }
      });
    }

    ctx.restore();
  }, [matA, computed.res, rowsA, colsA, settings.theme]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-[#2F7CF6]" />
              Linear Algebra Lab
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Compute matrix arithmetic, transpose, determinant, rank, inverse, Gaussian RREF, PA=LU factorization, linear systems Ax = b, eigenvalues &amp; eigenvectors, plus 2D linear transformation geometry.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'eigen', label: 'Eigenvalues & Vectors' },
              { id: 'det-rank', label: 'Det, Rank & RREF' },
              { id: 'inverse', label: 'Inverse A⁻¹' },
              { id: 'lu', label: 'LU Decomposition' },
              { id: 'system', label: 'Solve Ax = b' },
              { id: 'transpose', label: 'Transpose Aᵀ' },
              { id: 'add', label: 'A + B' },
              { id: 'subtract', label: 'A − B' },
              { id: 'multiply', label: 'A × B' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setOp(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                op === item.id
                  ? 'bg-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-5">
          {/* Matrix A Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Matrix A ({rowsA}×{colsA})
              </span>
              <div className="flex items-center gap-1.5 text-xs">
                <select
                  aria-label="Matrix A rows"
                  value={rowsA}
                  onChange={(e) => handleSizeChange('A', Number(e.target.value), colsA)}
                  className="h-8 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] font-mono"
                >
                  {[2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n} rows</option>
                  ))}
                </select>
                <span>×</span>
                <select
                  aria-label="Matrix A columns"
                  value={colsA}
                  onChange={(e) => handleSizeChange('A', rowsA, Number(e.target.value))}
                  className="h-8 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] font-mono"
                >
                  {[2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n} cols</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {matA.map((row, rIdx) => (
                <div
                  key={rIdx}
                  style={{ gridTemplateColumns: `repeat(${colsA}, minmax(0, 1fr))` }}
                  className="grid gap-2"
                >
                  {row.map((val, cIdx) => (
                    <input
                      key={cIdx}
                      type="number"
                      step="any"
                      value={val}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setMatA((prev) =>
                          prev.map((r, i) =>
                            i === rIdx
                              ? r.map((cell, j) => (j === cIdx ? (Number.isFinite(v) ? v : 0) : cell))
                              : r
                          )
                        );
                      }}
                      className="h-10 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-center font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {needsB && (
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Matrix B ({rowsB}×{colsB})
                </span>
                <div className="flex items-center gap-1.5 text-xs">
                  <select
                    aria-label="Matrix B rows"
                    value={rowsB}
                    onChange={(e) => handleSizeChange('B', Number(e.target.value), colsB)}
                    className="h-8 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] font-mono"
                  >
                    {[2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n} rows</option>
                    ))}
                  </select>
                  <span>×</span>
                  <select
                    aria-label="Matrix B columns"
                    value={colsB}
                    onChange={(e) => handleSizeChange('B', rowsB, Number(e.target.value))}
                    className="h-8 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] font-mono"
                  >
                    {[2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n} cols</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                {matB.map((row, rIdx) => (
                  <div
                    key={rIdx}
                    style={{ gridTemplateColumns: `repeat(${colsB}, minmax(0, 1fr))` }}
                    className="grid gap-2"
                  >
                    {row.map((val, cIdx) => (
                      <input
                        key={cIdx}
                        type="number"
                        step="any"
                        value={val}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMatB((prev) =>
                            prev.map((r, i) =>
                              i === rIdx
                                ? r.map((cell, j) => (j === cIdx ? (Number.isFinite(v) ? v : 0) : cell))
                                : r
                            )
                          );
                        }}
                        className="h-10 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-center font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {op === 'system' && (
            <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-white/10">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Right-Hand Side Vector b ({rowsA}×1)
              </div>
              <div
                style={{ gridTemplateColumns: `repeat(${rowsA}, minmax(0, 1fr))` }}
                className="grid gap-2"
              >
                {vecB.slice(0, rowsA).map((val, i) => (
                  <input
                    key={i}
                    type="number"
                    step="any"
                    value={val}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVecB((prev) =>
                        prev.map((item, idx) => (idx === i ? (Number.isFinite(v) ? v : 0) : item))
                      );
                    }}
                    className="h-10 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-center font-mono text-sm tabular-nums"
                  />
                ))}
              </div>
            </div>
          )}

          {computed.error && (
            <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
              {computed.error}
            </div>
          )}

          {/* Geometric visualizer */}
          <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-white/10">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              2D Linear Transformation &amp; Eigenvectors (Top-Left 2×2 Slice)
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 h-[230px]">
              <canvas ref={canvasRef} className="w-full h-full block" />
            </div>
          </div>
        </div>

        {/* Result & Step-by-Step Panel */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {computed.res ? computed.res.operation : 'Matrix Output'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exact numerical &amp; symbolic row-operation breakdown
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!computed.res}
                onClick={() => {
                  if (!computed.res) return;
                  triggerHaptic(settings.hapticsEnabled, 12);
                  onSaveToNotebook({
                    title: computed.res.operation,
                    topic: 'Linear Algebra',
                    content: `$$${computed.res.resultLatex}$$`,
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
                    title: computed.res.operation,
                    expression: `A = ${matrixToLatex(matA, 2)}`,
                    resultPlain: computed.res.resultLatex,
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

              <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
                {computed.res.steps.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-3 text-xs space-y-1.5"
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
