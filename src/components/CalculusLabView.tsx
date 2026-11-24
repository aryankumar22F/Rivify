import { useMemo, useState } from 'react';
import { Layers, SlidersHorizontal } from 'lucide-react';
import { solveGradient, solveLinearApproximation } from '../engine/calculus';
import { evaluateAST, parseExpression, validateExpression } from '../engine/symbolic';
import type { AppSettings } from '../types';
import { GraphPanel } from './GraphPanel';
import { MathTex } from './MathTex';

interface CalculusLabViewProps {
  settings: AppSettings;
}

const LAB_PRESETS = [
  { label: 'Paraboloid', expr: 'x^2 + y^2' },
  { label: 'Hyperbolic Saddle', expr: 'x^2 - y^2' },
  { label: 'Gaussian Peak', expr: '2*e^(-0.5*(x^2 + y^2))' },
  { label: 'Wave Surface', expr: 'sin(x)*cos(y)' },
  { label: 'Monkey Saddle', expr: 'x^3 - 3*x*y^2' },
];

export function CalculusLabView({ settings }: CalculusLabViewProps) {
  const [expr, setExpr] = useState('2*e^(-0.5*(x^2 + y^2))');
  const [x0, setX0] = useState(0.6);
  const [y0, setY0] = useState(0.4);
  const [showTangentPlane, setShowTangentPlane] = useState(true);

  const fmt = (n: number) => Number(n.toFixed(settings.precision)).toString();
  const validation = useMemo(() => validateExpression(expr), [expr]);

  const analysis = useMemo(() => {
    if (!validation.valid) return null;
    try {
      const ast = parseExpression(expr);
      const f0 = evaluateAST(ast, { x: x0, y: y0, z: 0 }, settings.angleUnit);
      const grad = solveGradient(expr, { x: x0, y: y0 }, settings.angleUnit, ['x', 'y']);
      const lin = solveLinearApproximation(expr, x0, y0, undefined, undefined, settings.angleUnit);
      return { f0, grad, lin };
    } catch {
      return null;
    }
  }, [expr, x0, y0, settings.angleUnit, validation.valid]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#2F7CF6]" />
            Interactive 3D Calculus Lab
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Explore surface plots, live tangent planes, contour level curves, partial slices, and gradient vectors as you move (x₀, y₀).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {LAB_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setExpr(p.expr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                expr === p.expr
                  ? 'bg-[#2F7CF6] border-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Canvas Stage (65%) */}
        <div className="lg:col-span-8">
          <GraphPanel
            tool="linear-approximation"
            expression={expr}
            anchorPoint={{ x: x0, y: y0 }}
            tangentPlane={
              showTangentPlane && analysis
                ? {
                    f0: analysis.lin.f0,
                    fx0: analysis.lin.fx0,
                    fy0: analysis.lin.fy0,
                    x0,
                    y0,
                  }
                : undefined
            }
            gradientAtAnchor={
              analysis?.grad.evaluatedVector
                ? {
                    gx: analysis.grad.evaluatedVector[0] ?? 0,
                    gy: analysis.grad.evaluatedVector[1] ?? 0,
                  }
                : undefined
            }
            angleUnit={settings.angleUnit}
            theme={settings.theme}
          />
        </div>

        {/* Control & Live Telemetry Deck (35%) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <SlidersHorizontal className="w-4 h-4 text-[#2F7CF6]" />
            <span>Surface & Anchor Controls</span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lab-expr" className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Surface Function z = f(x, y)
            </label>
            <input
              id="lab-expr"
              type="text"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
            />
            {!validation.valid && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{validation.error}</p>
            )}
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Anchor x₀</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-white">{x0.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={-2.5}
                max={2.5}
                step={0.1}
                value={x0}
                onChange={(e) => setX0(Number(e.target.value))}
                className="w-full accent-[#2F7CF6]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Anchor y₀</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-white">{y0.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={-2.5}
                max={2.5}
                step={0.1}
                value={y0}
                onChange={(e) => setY0(Number(e.target.value))}
                className="w-full accent-[#2F7CF6]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Show Tangent Plane L(x, y)
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={showTangentPlane}
              onClick={() => setShowTangentPlane((v) => !v)}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                showTangentPlane ? 'bg-[#2F7CF6] justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          {analysis && (
            <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Elevation f(x₀, y₀)</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {fmt(analysis.f0)}
                </span>
              </div>
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Gradient ∇f(x₀, y₀)</span>
                <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                  ⟨{fmt(analysis.lin.fx0)}, {fmt(analysis.lin.fy0)}⟩
                </span>
              </div>
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Steepest Slope ||∇f||</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {fmt(analysis.grad.magnitude ?? 0)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-white/10 overflow-x-auto text-slate-900 dark:text-slate-100">
                <MathTex tex={analysis.lin.tangentPlaneLatex} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
