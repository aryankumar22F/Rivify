import { useMemo, useState } from 'react';
import { Check, CheckCircle2, FileDown, FileOutput, GitCompare, Save, XCircle } from 'lucide-react';
import { deriveAndCompare, type DerivationMode } from '../engine/formulaDerivation';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface FormulaDerivationViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
  onSendToExport: (item: { heading: string; plainText: string; latex?: string }) => void;
}

export function FormulaDerivationView({
  settings,
  onSaveToNotebook,
  onSendToExport,
}: FormulaDerivationViewProps) {
  const [mode, setMode] = useState<DerivationMode>('differentiation');
  const [expr, setExpr] = useState('x^3 * sin(x)');
  const [rhsExpr, setRhsExpr] = useState('1');
  const [variable, setVariable] = useState('x');
  const [pointX, setPointX] = useState('1');
  const [lower, setLower] = useState('0');
  const [upper, setUpper] = useState('2');
  const [taylorOrder, setTaylorOrder] = useState('4');
  const [saved, setSaved] = useState(false);

  const computed = useMemo(() => {
    try {
      const result = deriveAndCompare({
        mode,
        expr,
        rhsExpr,
        variable,
        pointX: Number(pointX),
        lower: Number(lower),
        upper: Number(upper),
        taylorOrder: Number(taylorOrder),
        angleUnit: settings.angleUnit,
      });
      return { result, error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Unable to derive formula.' };
    }
  }, [mode, expr, rhsExpr, variable, pointX, lower, upper, taylorOrder, settings.angleUnit]);

  const applyPreset = (m: DerivationMode) => {
    setMode(m);
    if (m === 'differentiation') {
      setExpr('x^3 * sin(x)');
      setPointX('1');
    } else if (m === 'integration') {
      setExpr('x^3 + 2*x');
      setLower('0');
      setUpper('2');
    } else if (m === 'taylor-expansion') {
      setExpr('sin(x) + cos(x)');
      setPointX('0');
      setTaylorOrder('5');
    } else {
      setExpr('(sin(x))^2 + (cos(x))^2');
      setRhsExpr('1');
    }
  };

  const handleSave = () => {
    if (!computed.result) return;
    triggerHaptic(settings.hapticsEnabled, 10);
    onSaveToNotebook({
      title: computed.result.headline,
      topic: 'Formula Derivation',
      content: `Expression: ${expr}\n$$${computed.result.primaryLatex}$$\n${computed.result.steps
        .map((s, i) => `${i + 1}. ${s.rule}: ${s.description}`)
        .join('\n')}`,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const handlePdf = () => {
    if (!computed.result) return;
    triggerHaptic(settings.hapticsEnabled, 10);
    downloadSingleSolutionPdf({
      title: computed.result.headline,
      expression: mode === 'identity-verify' ? `${expr} = ${rhsExpr}` : expr,
      resultPlain: computed.result.primaryLatex,
      steps: computed.result.steps,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-[#2F7CF6]" />
              Formula Derivation &amp; Verification Engine
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Generate full step-by-step symbolic derivations, cross-check methods numerically, expand Taylor series, and prove or refute identities.
            </p>
          </div>
          {computed.result && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSave}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
              >
                {saved ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saved ? 'Saved' : 'Save Note'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onSendToExport({
                    heading: computed.result!.headline,
                    plainText: computed.result!.steps.map((s) => `${s.rule}: ${s.description}`).join(' | '),
                    latex: computed.result!.primaryLatex,
                  })
                }
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
              >
                <FileOutput className="w-3.5 h-3.5" />
                <span>Export</span>
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
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'differentiation', label: 'Differentiation vs Limit' },
              { id: 'integration', label: 'Integration Comparison' },
              { id: 'taylor-expansion', label: 'Taylor Series Derivation' },
              { id: 'identity-verify', label: 'Identity Verification' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyPreset(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                mode === item.id
                  ? 'bg-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className={mode === 'identity-verify' ? 'md:col-span-5' : 'md:col-span-6'}>
          <label className="text-xs text-slate-500 dark:text-slate-400">
            {mode === 'identity-verify' ? 'Left-Hand Side (LHS)' : 'Mathematical Expression f(x)'}
          </label>
          <input
            type="text"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            className="mt-1 w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
          />
        </div>

        {mode === 'identity-verify' && (
          <div className="md:col-span-5">
            <label className="text-xs text-slate-500 dark:text-slate-400">Right-Hand Side (RHS)</label>
            <input
              type="text"
              value={rhsExpr}
              onChange={(e) => setRhsExpr(e.target.value)}
              className="mt-1 w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
            />
          </div>
        )}

        <div className="md:col-span-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">Variable</label>
          <input
            type="text"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
          />
        </div>

        {(mode === 'differentiation' || mode === 'taylor-expansion') && (
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'taylor-expansion' ? 'Center a' : `Point ${variable}₀`}
            </label>
            <input
              type="number"
              step="any"
              value={pointX}
              onChange={(e) => setPointX(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
            />
          </div>
        )}

        {mode === 'taylor-expansion' && (
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">Degree N (1–7)</label>
            <input
              type="number"
              min={1}
              max={7}
              value={taylorOrder}
              onChange={(e) => setTaylorOrder(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
            />
          </div>
        )}

        {mode === 'integration' && (
          <>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">Lower a</label>
              <input
                type="number"
                step="any"
                value={lower}
                onChange={(e) => setLower(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">Upper b</label>
              <input
                type="number"
                step="any"
                value={upper}
                onChange={(e) => setUpper(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
              />
            </div>
          </>
        )}
      </div>

      {computed.error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-300">
          {computed.error}
        </div>
      )}

      {computed.result && (
        <div className="space-y-6">
          {/* Primary Result Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#2F7CF6]">
                {computed.result.headline}
              </span>
              {typeof computed.result.verified === 'boolean' && (
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    computed.result.verified ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {computed.result.verified ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Verified Identity
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Not Identical
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="overflow-x-auto py-2 text-slate-900 dark:text-white">
              <MathTex tex={computed.result.primaryLatex} display />
            </div>
          </div>

          {/* Method Comparison */}
          {computed.result.comparison && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[computed.result.comparison.methodA, computed.result.comparison.methodB].map((m) => (
                <div
                  key={m.title}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-2"
                >
                  <div className="text-xs font-semibold text-[#2F7CF6]">{m.title}</div>
                  <div className="overflow-x-auto text-slate-900 dark:text-white">
                    <MathTex tex={m.resultLatex} />
                  </div>
                  {m.numericValue !== undefined && (
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-200 tabular-nums">
                      Value = {m.numericValue.toFixed(settings.precision)}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400">{m.summary}</p>
                </div>
              ))}
              {computed.result.comparison.delta !== undefined && (
                <div className="md:col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-2.5 text-xs font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
                  Method Agreement |Method₁ − Method₂| = {computed.result.comparison.delta.toExponential(4)}
                </div>
              )}
            </div>
          )}

          {/* Step-by-Step Derivation */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Step-by-Step Derivation ({computed.result.steps.length} steps)
            </h3>
            <div className="space-y-3">
              {computed.result.steps.map((st, idx) => (
                <div
                  key={st.id}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-1.5"
                >
                  <div className="text-xs font-semibold text-[#2F7CF6]">
                    Step {idx + 1}: {st.rule}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{st.description}</p>
                  <div className="overflow-x-auto pt-1 text-slate-900 dark:text-white">
                    <MathTex tex={st.latex} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
