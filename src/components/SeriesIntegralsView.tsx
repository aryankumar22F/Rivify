import { useMemo, useState } from 'react';
import { Check, FileDown, Save, Sigma } from 'lucide-react';
import { solveTaylorSeries } from '../engine/calculus';
import {
  solveChangeOfVariablesIntegral,
  solveCylindricalIntegral,
  solveDoubleIntegral,
  solveLineIntegral,
  solvePolarIntegral,
  solveSphericalIntegral,
  solveSurfaceIntegral,
  solveTripleIntegral,
} from '../engine/integrals';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

type SeriesIntegralMode =
  | 'taylor'
  | 'double'
  | 'triple'
  | 'line'
  | 'surface'
  | 'polar'
  | 'cylindrical'
  | 'spherical'
  | 'change-vars';

interface SeriesIntegralsViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

export function SeriesIntegralsView({
  settings,
  onSaveToNotebook,
}: SeriesIntegralsViewProps) {
  const [mode, setMode] = useState<SeriesIntegralMode>('taylor');

  // Taylor / Maclaurin state
  const [taylorExpr, setTaylorExpr] = useState('e^x * cos(y)');
  const [taylorMulti, setTaylorMulti] = useState(true);
  const [taylorDegree, setTaylorDegree] = useState(2);
  const [centerX, setCenterX] = useState('0');
  const [centerY, setCenterY] = useState('0');
  const [evalX, setEvalX] = useState('0.2');
  const [evalY, setEvalY] = useState('0.1');

  // Multiple & Surface Integrals state
  const [intExpr, setIntExpr] = useState('x^2 + y^2');
  const [surfGExpr, setSurfGExpr] = useState('x + 2*y');
  const [xMin, setXMin] = useState('0');
  const [xMax, setXMax] = useState('1');
  const [yMin, setYMin] = useState('0');
  const [yMax, setYMax] = useState('2');
  const [zMin, setZMin] = useState('0');
  const [zMax, setZMax] = useState('1');

  // Line Integral state
  const [lineP, setLineP] = useState('-y');
  const [lineQ, setLineQ] = useState('x');
  const [curveX, setCurveX] = useState('cos(t)');
  const [curveY, setCurveY] = useState('sin(t)');
  const [tMin, setTMin] = useState('0');
  const [tMax, setTMax] = useState('3.141593');

  // Polar / Cylindrical / Spherical state
  const [rMin, setRMin] = useState('0');
  const [rMax, setRMax] = useState('2');
  const [thetaMin, setThetaMin] = useState('0');
  const [thetaMax, setThetaMax] = useState('6.283185');
  const [phiMin, setPhiMin] = useState('0');
  const [phiMax, setPhiMax] = useState('3.141593');

  // Change of variables (u, v) state
  const [covXExpr, setCovXExpr] = useState('u*cos(v)');
  const [covYExpr, setCovYExpr] = useState('u*sin(v)');
  const [uMin, setUMin] = useState('0');
  const [uMax, setUMax] = useState('2');
  const [vMin, setVMin] = useState('0');
  const [vMax, setVMax] = useState('3.141593');

  const [savedNote, setSavedNote] = useState(false);

  const fmt = (n: number) => Number(n.toFixed(settings.precision)).toString();

  const computed = useMemo(() => {
    try {
      if (mode === 'taylor') {
        const cx = Number(centerX) || 0;
        const cy = Number(centerY) || 0;
        const ex = evalX !== '' && Number.isFinite(Number(evalX)) ? Number(evalX) : undefined;
        const ey = evalY !== '' && Number.isFinite(Number(evalY)) ? Number(evalY) : undefined;
        const res = solveTaylorSeries(
          taylorExpr,
          taylorDegree,
          { x: cx, y: cy },
          taylorMulti,
          ex !== undefined ? { x: ex, y: ey ?? 0 } : undefined,
          settings.angleUnit
        );
        return { kind: 'taylor' as const, res, error: null as string | null };
      }
      if (mode === 'double') {
        const res = solveDoubleIntegral(
          intExpr,
          Number(xMin) || 0,
          Number(xMax) || 1,
          Number(yMin) || 0,
          Number(yMax) || 1,
          settings.angleUnit
        );
        return { kind: 'integral' as const, res, error: null };
      }
      if (mode === 'triple') {
        const res = solveTripleIntegral(
          intExpr,
          Number(xMin) || 0,
          Number(xMax) || 1,
          Number(yMin) || 0,
          Number(yMax) || 1,
          Number(zMin) || 0,
          Number(zMax) || 1,
          settings.angleUnit
        );
        return { kind: 'integral' as const, res, error: null };
      }
      if (mode === 'line') {
        const res = solveLineIntegral(
          lineP,
          lineQ,
          curveX,
          curveY,
          Number(tMin) || 0,
          Number(tMax) || 1,
          settings.angleUnit
        );
        return { kind: 'integral' as const, res, error: null };
      }
      if (mode === 'polar') {
        const res = solvePolarIntegral(
          intExpr,
          Number(rMin) || 0,
          Number(rMax) || 1,
          Number(thetaMin) || 0,
          Number(thetaMax) || Math.PI * 2,
          settings.angleUnit
        );
        return { kind: 'integral' as const, res, error: null };
      }
      if (mode === 'cylindrical') {
        const res = solveCylindricalIntegral(
          intExpr,
          Number(rMin) || 0,
          Number(rMax) || 1,
          Number(thetaMin) || 0,
          Number(thetaMax) || Math.PI * 2,
          Number(zMin) || 0,
          Number(zMax) || 1,
          settings.angleUnit
        );
        return { kind: 'integral' as const, res, error: null };
      }
      if (mode === 'spherical') {
        const res = solveSphericalIntegral(
          intExpr,
          Number(rMin) || 0,
          Number(rMax) || 1,
          Number(thetaMin) || 0,
          Number(thetaMax) || Math.PI * 2,
          Number(phiMin) || 0,
          Number(phiMax) || Math.PI,
          settings.angleUnit
        );
        return { kind: 'integral' as const, res, error: null };
      }
      if (mode === 'change-vars') {
        const res = solveChangeOfVariablesIntegral(
          intExpr,
          covXExpr,
          covYExpr,
          Number(uMin) || 0,
          Number(uMax) || 1,
          Number(vMin) || 0,
          Number(vMax) || 1,
          settings.angleUnit
        );
        return { kind: 'integral' as const, res, error: null };
      }
      const res = solveSurfaceIntegral(
        intExpr,
        surfGExpr,
        Number(xMin) || 0,
        Number(xMax) || 1,
        Number(yMin) || 0,
        Number(yMax) || 1,
        settings.angleUnit
      );
      return { kind: 'integral' as const, res, error: null };
    } catch (e) {
      return {
        kind: mode === 'taylor' ? ('taylor' as const) : ('integral' as const),
        res: null,
        error: e instanceof Error ? e.message : 'Unable to evaluate expression',
      };
    }
  }, [
    mode,
    taylorExpr,
    taylorMulti,
    taylorDegree,
    centerX,
    centerY,
    evalX,
    evalY,
    intExpr,
    surfGExpr,
    xMin,
    xMax,
    yMin,
    yMax,
    zMin,
    zMax,
    lineP,
    lineQ,
    curveX,
    curveY,
    tMin,
    tMax,
    rMin,
    rMax,
    thetaMin,
    thetaMax,
    phiMin,
    phiMax,
    covXExpr,
    covYExpr,
    uMin,
    uMax,
    vMin,
    vMax,
    settings.angleUnit,
  ]);

  const titleMap: Record<SeriesIntegralMode, string> = {
    taylor: 'Taylor & Maclaurin Series',
    double: 'Double Integral',
    triple: 'Triple Integral',
    line: 'Line Integral',
    surface: 'Surface Integral',
    polar: 'Polar Coordinates Integral',
    cylindrical: 'Cylindrical Coordinates Integral',
    spherical: 'Spherical Coordinates Integral',
    'change-vars': 'Change of Variables (Jacobian)',
  };

  const resultPlainText =
    computed.kind === 'taylor' && computed.res
      ? computed.res.seriesLatex
      : computed.kind === 'integral' && computed.res
      ? `Value ≈ ${fmt(computed.res.value)}`
      : '';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Sigma className="w-5 h-5 text-[#2F7CF6]" />
            Series Expansions, Integrals & Coordinate Systems
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Compute 1D/2D Taylor series, multiple integrals, line/surface integrals, polar/cylindrical/spherical coordinates, and Jacobian variable transformations.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'taylor', label: 'Taylor & Maclaurin' },
              { id: 'double', label: 'Double ∬' },
              { id: 'triple', label: 'Triple ∭' },
              { id: 'polar', label: 'Polar r dr dθ' },
              { id: 'cylindrical', label: 'Cylindrical' },
              { id: 'spherical', label: 'Spherical' },
              { id: 'change-vars', label: 'Change of Vars J' },
              { id: 'line', label: 'Line ∫ F·dr' },
              { id: 'surface', label: 'Surface ∬ dS' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id);
                if (tab.id === 'triple' && intExpr === 'x^2 + y^2') {
                  setIntExpr('x*y*z');
                } else if (tab.id === 'surface' && intExpr === 'x*y*z') {
                  setIntExpr('1');
                } else if (tab.id === 'polar') {
                  setIntExpr('x^2 + y^2');
                } else if (tab.id === 'cylindrical') {
                  setIntExpr('x^2 + y^2 + z');
                } else if (tab.id === 'spherical') {
                  setIntExpr('1');
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                mode === tab.id
                  ? 'bg-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          {mode === 'taylor' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Dimension
                </span>
                <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#12141B] border border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setTaylorMulti(false);
                      setTaylorExpr('sin(x)');
                      setTaylorDegree(4);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${
                      !taylorMulti ? 'bg-[#2F7CF6] text-white' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    1D f(x)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaylorMulti(true);
                      setTaylorExpr('e^x * cos(y)');
                      setTaylorDegree(2);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${
                      taylorMulti ? 'bg-[#2F7CF6] text-white' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    2D f(x, y)
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="tay-expr" className="text-xs text-slate-500 dark:text-slate-400">
                  Function
                </label>
                <input
                  id="tay-expr"
                  type="text"
                  value={taylorExpr}
                  onChange={(e) => setTaylorExpr(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Polynomial Degree</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {taylorDegree}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={taylorMulti ? 3 : 5}
                  value={taylorDegree}
                  onChange={(e) => setTaylorDegree(Number(e.target.value))}
                  className="w-full accent-[#2F7CF6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">
                    Center a (x₀)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={centerX}
                    onChange={(e) => setCenterX(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                {taylorMulti && (
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">
                      Center b (y₀)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={centerY}
                      onChange={(e) => setCenterY(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">
                    Test Point x
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={evalX}
                    onChange={(e) => setEvalX(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                {taylorMulti && (
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">
                      Test Point y
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={evalY}
                      onChange={(e) => setEvalY(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {(mode === 'double' || mode === 'triple' || mode === 'surface') && (
            <>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Integrand {mode === 'triple' ? 'f(x, y, z)' : mode === 'surface' ? 'f(x, y, z)' : 'f(x, y)'}
                </label>
                <input
                  type="text"
                  value={intExpr}
                  onChange={(e) => setIntExpr(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>

              {mode === 'surface' && (
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Surface Height z = g(x, y)
                  </label>
                  <input
                    type="text"
                    value={surfGExpr}
                    onChange={(e) => setSurfGExpr(e.target.value)}
                    className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
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
                {mode === 'triple' && (
                  <>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">z min</label>
                      <input
                        type="number"
                        step="any"
                        value={zMin}
                        onChange={(e) => setZMin(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">z max</label>
                      <input
                        type="number"
                        step="any"
                        value={zMax}
                        onChange={(e) => setZMax(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {(mode === 'polar' || mode === 'cylindrical' || mode === 'spherical') && (
            <>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Integrand {mode === 'polar' ? 'f(x, y)' : 'f(x, y, z)'} (auto-substituted)
                </label>
                <input
                  type="text"
                  value={intExpr}
                  onChange={(e) => setIntExpr(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">
                    {mode === 'spherical' ? 'ρ min' : 'r min'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={rMin}
                    onChange={(e) => setRMin(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">
                    {mode === 'spherical' ? 'ρ max' : 'r max'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={rMax}
                    onChange={(e) => setRMax(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">θ min</label>
                  <input
                    type="number"
                    step="any"
                    value={thetaMin}
                    onChange={(e) => setThetaMin(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">θ max</label>
                  <input
                    type="number"
                    step="any"
                    value={thetaMax}
                    onChange={(e) => setThetaMax(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                {mode === 'cylindrical' && (
                  <>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">z min</label>
                      <input
                        type="number"
                        step="any"
                        value={zMin}
                        onChange={(e) => setZMin(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">z max</label>
                      <input
                        type="number"
                        step="any"
                        value={zMax}
                        onChange={(e) => setZMax(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                  </>
                )}
                {mode === 'spherical' && (
                  <>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">φ min</label>
                      <input
                        type="number"
                        step="any"
                        value={phiMin}
                        onChange={(e) => setPhiMin(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">φ max</label>
                      <input
                        type="number"
                        step="any"
                        value={phiMax}
                        onChange={(e) => setPhiMax(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {mode === 'change-vars' && (
            <>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Integrand f(x, y)
                </label>
                <input
                  type="text"
                  value={intExpr}
                  onChange={(e) => setIntExpr(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">x(u, v)</label>
                  <input
                    type="text"
                    value={covXExpr}
                    onChange={(e) => setCovXExpr(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">y(u, v)</label>
                  <input
                    type="text"
                    value={covYExpr}
                    onChange={(e) => setCovYExpr(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">u min</label>
                  <input
                    type="number"
                    step="any"
                    value={uMin}
                    onChange={(e) => setUMin(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">u max</label>
                  <input
                    type="number"
                    step="any"
                    value={uMax}
                    onChange={(e) => setUMax(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">v min</label>
                  <input
                    type="number"
                    step="any"
                    value={vMin}
                    onChange={(e) => setVMin(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">v max</label>
                  <input
                    type="number"
                    step="any"
                    value={vMax}
                    onChange={(e) => setVMax(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'line' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Field P(x, y)</label>
                  <input
                    type="text"
                    value={lineP}
                    onChange={(e) => setLineP(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Field Q(x, y)</label>
                  <input
                    type="text"
                    value={lineQ}
                    onChange={(e) => setLineQ(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Curve x(t)</label>
                  <input
                    type="text"
                    value={curveX}
                    onChange={(e) => setCurveX(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Curve y(t)</label>
                  <input
                    type="text"
                    value={curveY}
                    onChange={(e) => setCurveY(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">t min</label>
                  <input
                    type="number"
                    step="any"
                    value={tMin}
                    onChange={(e) => setTMin(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">t max</label>
                  <input
                    type="number"
                    step="any"
                    value={tMax}
                    onChange={(e) => setTMax(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </>
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

        {/* Result */}
        <div
          aria-live="polite"
          className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {titleMap[mode]}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(settings.hapticsEnabled, 12);
                  onSaveToNotebook({
                    title: `${titleMap[mode]}: ${mode === 'taylor' ? taylorExpr : intExpr}`,
                    topic: titleMap[mode],
                    content:
                      computed.kind === 'taylor' && computed.res
                        ? `$$${computed.res.seriesLatex}$$`
                        : computed.kind === 'integral' && computed.res
                        ? `$$${computed.res.equationLatex}$$`
                        : '',
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
                    title: titleMap[mode],
                    expression: mode === 'taylor' ? taylorExpr : intExpr,
                    resultPlain: resultPlainText,
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

          {computed.kind === 'taylor' && computed.res && (
            <div className="space-y-4">
              <div className="text-xs font-medium text-[#2F7CF6]">
                {computed.res.isMaclaurin ? 'Maclaurin Expansion (centered at 0)' : 'Taylor Expansion'}
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={computed.res.seriesLatex} display />
              </div>

              {computed.res.approxValue !== undefined && computed.res.exactValue !== undefined && (
                <div className="rounded-xl border border-[#2F7CF6]/30 bg-[#2F7CF6]/5 p-4 text-xs flex flex-wrap gap-4 tabular-nums text-slate-800 dark:text-slate-100">
                  <span>
                    Approximation T = <strong>{fmt(computed.res.approxValue)}</strong>
                  </span>
                  <span>
                    Exact f = <strong>{fmt(computed.res.exactValue)}</strong>
                  </span>
                  <span>
                    |Error| = <strong>{fmt(computed.res.error ?? 0)}</strong>
                  </span>
                </div>
              )}

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

          {computed.kind === 'integral' && computed.res && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={computed.res.equationLatex} display />
              </div>

              <div className="rounded-xl border border-[#2F7CF6]/30 bg-[#2F7CF6]/5 p-4 text-xs flex flex-wrap justify-between gap-2 tabular-nums">
                <span className="text-slate-800 dark:text-slate-100">
                  Numerical Integral = <strong className="text-sm">{fmt(computed.res.value)}</strong>
                </span>
                {computed.res.jacobianLatex && (
                  <span className="text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">
                    Jacobian: <MathTex tex={`|J| = \\left|${computed.res.jacobianLatex}\\right|`} />
                  </span>
                )}
                <span className="text-slate-500 dark:text-slate-400">
                  Est. quadrature delta: {computed.res.errorEstimate.toExponential(2)}
                </span>
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
