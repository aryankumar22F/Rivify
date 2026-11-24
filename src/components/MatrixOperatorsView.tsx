import { useMemo, useState } from 'react';
import { Calculator, Check, Copy, FileDown, Grid3X3, MessageSquare, Save } from 'lucide-react';
import {
  solveHessianAndLaplacian,
  solveJacobian,
  type HessianLaplacianResult,
  type JacobianResult,
} from '../engine/calculus';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, shareSolutionText, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface MatrixOperatorsViewProps {
  settings: AppSettings;
  onAskAI: (ctx: { tool: string; expression: string; result: string }) => void;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

export function MatrixOperatorsView({
  settings,
  onAskAI,
  onSaveToNotebook,
}: MatrixOperatorsViewProps) {
  const [mode, setMode] = useState<'jacobian' | 'hessian'>('jacobian');
  const [dim3D, setDim3D] = useState(false);

  // Jacobian inputs
  const [f1, setF1] = useState('x^2*y + sin(x)');
  const [f2, setF2] = useState('e^x * cos(y)');
  const [f3, setF3] = useState('x*y*z');

  // Hessian & Laplacian input
  const [scalarExpr, setScalarExpr] = useState('x^3 + y^3 - 3*x*y');

  // Point evaluation
  const [px, setPx] = useState('1');
  const [py, setPy] = useState('0');
  const [pz, setPz] = useState('1');

  const [copied, setCopied] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  const fmt = (n: number) => Number(n.toFixed(settings.precision)).toString();

  const pointScope = useMemo(() => {
    const scope: Record<string, number> = {};
    if (px !== '' && Number.isFinite(Number(px))) scope.x = Number(px);
    if (py !== '' && Number.isFinite(Number(py))) scope.y = Number(py);
    if (pz !== '' && Number.isFinite(Number(pz))) scope.z = Number(pz);
    return scope;
  }, [px, py, pz]);

  const jacobianResult = useMemo<{ res: JacobianResult | null; err: string | null }>(() => {
    if (mode !== 'jacobian') return { res: null, err: null };
    try {
      const exprs = dim3D ? [f1, f2, f3] : [f1, f2];
      const vars = dim3D ? ['x', 'y', 'z'] : ['x', 'y'];
      return { res: solveJacobian(exprs, vars, pointScope, settings.angleUnit), err: null };
    } catch (e) {
      return { res: null, err: e instanceof Error ? e.message : 'Invalid expression' };
    }
  }, [mode, dim3D, f1, f2, f3, pointScope, settings.angleUnit]);

  const hessianResult = useMemo<{ res: HessianLaplacianResult | null; err: string | null }>(() => {
    if (mode !== 'hessian') return { res: null, err: null };
    try {
      const vars = dim3D ? ['x', 'y', 'z'] : ['x', 'y'];
      return {
        res: solveHessianAndLaplacian(scalarExpr, vars, pointScope, settings.angleUnit),
        err: null,
      };
    } catch (e) {
      return { res: null, err: e instanceof Error ? e.message : 'Invalid expression' };
    }
  }, [mode, dim3D, scalarExpr, pointScope, settings.angleUnit]);

  const activeError = mode === 'jacobian' ? jacobianResult.err : hessianResult.err;

  const summaryPlain =
    mode === 'jacobian' && jacobianResult.res
      ? `Jacobian of ⟨${dim3D ? `${f1}, ${f2}, ${f3}` : `${f1}, ${f2}`}⟩${
          jacobianResult.res.evaluatedDet !== undefined
            ? `, det(J) = ${fmt(jacobianResult.res.evaluatedDet)}`
            : ''
        }`
      : mode === 'hessian' && hessianResult.res
      ? `Laplacian = ${hessianResult.res.laplacianPlain}${
          hessianResult.res.definiteness ? `, ${hessianResult.res.definiteness}` : ''
        }`
      : '';

  const handleExportPdf = () => {
    triggerHaptic(settings.hapticsEnabled, 12);
    if (mode === 'jacobian' && jacobianResult.res) {
      downloadSingleSolutionPdf({
        title: 'Jacobian Matrix',
        expression: dim3D ? `<${f1}, ${f2}, ${f3}>` : `<${f1}, ${f2}>`,
        secondary: `Point (${px}, ${py}${dim3D ? `, ${pz}` : ''})`,
        resultPlain: summaryPlain,
        steps: jacobianResult.res.steps,
      });
    } else if (mode === 'hessian' && hessianResult.res) {
      downloadSingleSolutionPdf({
        title: 'Hessian Matrix & Laplacian',
        expression: scalarExpr,
        secondary: `Point (${px}, ${py}${dim3D ? `, ${pz}` : ''})`,
        resultPlain: summaryPlain,
        steps: hessianResult.res.steps,
      });
    }
  };

  const handleShare = async () => {
    triggerHaptic(settings.hapticsEnabled, 10);
    const status = await shareSolutionText('Derivify Matrix Calculation', summaryPlain);
    if (status === 'copied' || status === 'shared') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const handleSaveNote = () => {
    triggerHaptic(settings.hapticsEnabled, 12);
    if (mode === 'jacobian' && jacobianResult.res) {
      onSaveToNotebook({
        title: `Jacobian Matrix: ${dim3D ? '3D' : '2D'} Map`,
        topic: 'Jacobian Matrix',
        content: `Components: $F = (${f1}, ${f2}${dim3D ? `, ${f3}` : ''})$\n\n$$${jacobianResult.res.symbolicMatrixLatex}$$\n\n${
          jacobianResult.res.detLatex ? `Determinant: $${jacobianResult.res.detLatex}$` : ''
        }`,
      });
    } else if (mode === 'hessian' && hessianResult.res) {
      onSaveToNotebook({
        title: `Hessian & Laplacian: ${scalarExpr}`,
        topic: 'Hessian & Laplacian',
        content: `Function: $f = ${scalarExpr}$\n\n$$${hessianResult.res.hessianLatex}$$\n\nLaplacian: $$\\nabla^2 f = ${hessianResult.res.laplacianLatex}$$`,
      });
    }
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 1800);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-[#2F7CF6]" />
            Jacobian, Hessian & Laplacian Operators
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Compute symbolic multivariable derivative matrices, determinants, Laplacian traces, and curvature classification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#12141B] border border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => setMode('jacobian')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'jacobian'
                  ? 'bg-[#2F7CF6] text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Jacobian J(F)
            </button>
            <button
              type="button"
              onClick={() => setMode('hessian')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'hessian'
                  ? 'bg-[#2F7CF6] text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Hessian & Laplacian
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDim3D((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
              dim3D
                ? 'bg-[#2F7CF6]/15 border-[#2F7CF6] text-[#2F7CF6] dark:text-[#7EB0FF]'
                : 'border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300'
            }`}
          >
            {dim3D ? '3D (x, y, z)' : '2D (x, y)'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Inputs */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          {mode === 'jacobian' ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Vector Function Components
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setF1('r*cos(t)');
                    setF2('r*sin(t)');
                  }}
                  className="hidden"
                  aria-hidden="true"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="jac-f1" className="text-xs text-slate-500 dark:text-slate-400">
                    f₁({dim3D ? 'x, y, z' : 'x, y'})
                  </label>
                  <input
                    id="jac-f1"
                    type="text"
                    value={f1}
                    onChange={(e) => setF1(e.target.value)}
                    className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                  />
                </div>
                <div>
                  <label htmlFor="jac-f2" className="text-xs text-slate-500 dark:text-slate-400">
                    f₂({dim3D ? 'x, y, z' : 'x, y'})
                  </label>
                  <input
                    id="jac-f2"
                    type="text"
                    value={f2}
                    onChange={(e) => setF2(e.target.value)}
                    className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                  />
                </div>
                {dim3D && (
                  <div>
                    <label htmlFor="jac-f3" className="text-xs text-slate-500 dark:text-slate-400">
                      f₃(x, y, z)
                    </label>
                    <input
                      id="jac-f3"
                      type="text"
                      value={f3}
                      onChange={(e) => setF3(e.target.value)}
                      className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <label htmlFor="hess-f" className="text-sm font-semibold text-slate-900 dark:text-white block">
                Scalar Field f({dim3D ? 'x, y, z' : 'x, y'})
              </label>
              <input
                id="hess-f"
                type="text"
                value={scalarExpr}
                onChange={(e) => setScalarExpr(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Saddle x³+y³−3xy', expr: 'x^3 + y^3 - 3*x*y' },
                  { label: 'Harmonic x²−y²', expr: 'x^2 - y^2' },
                  { label: 'Wave sin(x)cos(y)', expr: 'sin(x)*cos(y)' },
                ].map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => setScalarExpr(ex.expr)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-100 dark:bg-[#22252E] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-[#2F7CF6]"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Evaluation Point */}
          <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Evaluate Matrix at Point P
            </span>
            <div className={`grid gap-2.5 ${dim3D ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <input
                type="number"
                step="any"
                value={px}
                onChange={(e) => setPx(e.target.value)}
                aria-label="x coordinate"
                placeholder="x"
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
              />
              <input
                type="number"
                step="any"
                value={py}
                onChange={(e) => setPy(e.target.value)}
                aria-label="y coordinate"
                placeholder="y"
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
              />
              {dim3D && (
                <input
                  type="number"
                  step="any"
                  value={pz}
                  onChange={(e) => setPz(e.target.value)}
                  aria-label="z coordinate"
                  placeholder="z"
                  className="h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                />
              )}
            </div>
          </div>

          {activeError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300"
            >
              {activeError}
            </div>
          )}
        </div>

        {/* Result Output */}
        <div
          aria-live="polite"
          className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#2F7CF6]" />
              <span>{mode === 'jacobian' ? 'Jacobian Matrix Result' : 'Hessian & Laplacian Result'}</span>
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onAskAI({
                    tool: mode === 'jacobian' ? 'Jacobian Matrix' : 'Hessian & Laplacian',
                    expression: mode === 'jacobian' ? `⟨${f1}, ${f2}⟩` : scalarExpr,
                    result: summaryPlain,
                  })
                }
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-[#2F7CF6] hover:bg-[#2F7CF6]/10 inline-flex items-center gap-1"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
              >
                {savedNote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savedNote ? 'Saved' : 'Note'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Shared' : 'Share'}</span>
              </button>
            </div>
          </div>

          {mode === 'jacobian' && jacobianResult.res && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={jacobianResult.res.symbolicMatrixLatex} display />
              </div>

              {jacobianResult.res.detLatex && (
                <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-3.5 overflow-x-auto text-slate-900 dark:text-white">
                  <MathTex tex={`\\det(J_{\\mathbf{F}}) = ${jacobianResult.res.detLatex}`} />
                </div>
              )}

              {jacobianResult.res.evaluatedMatrix && (
                <div className="rounded-xl border border-[#2F7CF6]/30 bg-[#2F7CF6]/5 p-4 space-y-2 text-xs">
                  <div className="font-semibold text-[#2F7CF6]">
                    Evaluated at ({px}, {py}
                    {dim3D ? `, ${pz}` : ''})
                  </div>
                  <div className="overflow-x-auto text-slate-900 dark:text-white">
                    <MathTex
                      tex={`J(P) = \\begin{bmatrix} ${jacobianResult.res.evaluatedMatrix
                        .map((r) => r.map(fmt).join(' & '))
                        .join(' \\\\ ')} \\end{bmatrix}${
                        jacobianResult.res.evaluatedDet !== undefined
                          ? `, \\quad \\det = ${fmt(jacobianResult.res.evaluatedDet)}`
                          : ''
                      }`}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
                {jacobianResult.res.steps.map((s) => (
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

          {mode === 'hessian' && hessianResult.res && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={hessianResult.res.hessianLatex} display />
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={`\\nabla^2 f = ${hessianResult.res.laplacianLatex}`} display />
              </div>

              {hessianResult.res.evaluatedHessian && (
                <div className="rounded-xl border border-[#2F7CF6]/30 bg-[#2F7CF6]/5 p-4 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#2F7CF6]">
                      Curvature at ({px}, {py}
                      {dim3D ? `, ${pz}` : ''})
                    </span>
                    {hessianResult.res.definiteness && (
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {hessianResult.res.definiteness}
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto text-slate-900 dark:text-white">
                    <MathTex
                      tex={`H_f(P) = \\begin{bmatrix} ${hessianResult.res.evaluatedHessian
                        .map((r) => r.map(fmt).join(' & '))
                        .join(' \\\\ ')} \\end{bmatrix}, \\quad \\nabla^2 f(P) = ${fmt(
                        hessianResult.res.evaluatedLaplacian ?? 0
                      )}${
                        hessianResult.res.determinant !== undefined
                          ? `, \\quad \\det(H) = ${fmt(hessianResult.res.determinant)}`
                          : ''
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
