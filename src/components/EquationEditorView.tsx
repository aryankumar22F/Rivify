import { useEffect, useRef, useState } from 'react';
import { BookMarked, Check, Copy, FileOutput, Grid3X3, Plus, Save, Sigma, Trash2 } from 'lucide-react';
import type { AppSettings, SavedEquation } from '../types';
import { triggerHaptic } from '../utils/pdfReport';
import { ClearAllActionButton } from './ActionButtons';
import { MathTex } from './MathTex';

interface EquationEditorViewProps {
  settings: AppSettings;
  savedEquations: SavedEquation[];
  onSaveEquation: (eq: SavedEquation) => void;
  onDeleteEquation: (id: string) => void;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
  onSendToExport: (item: { heading: string; plainText: string; latex?: string }) => void;
}

type SymbolGroup = 'structures' | 'calculus' | 'greek' | 'logic';

const PALETTE: Record<SymbolGroup, { label: string; snippet: string }[]> = {
  structures: [
    { label: 'Fraction a/b', snippet: '\\frac{a}{b}' },
    { label: 'Power x^n', snippet: 'x^{n}' },
    { label: 'Subscript x_i', snippet: 'x_{i}' },
    { label: 'Square Root', snippet: '\\sqrt{x}' },
    { label: 'nth Root', snippet: '\\sqrt[n]{x}' },
    { label: 'Parentheses', snippet: '\\left( x \\right)' },
    { label: 'Cases / Piecewise', snippet: '\\begin{cases} x^2 & x \\ge 0 \\\\ -x & x < 0 \\end{cases}' },
    { label: 'Overline / Vec', snippet: '\\vec{v}' },
  ],
  calculus: [
    { label: 'd/dx', snippet: '\\frac{d}{dx}' },
    { label: '∂f/∂x', snippet: '\\frac{\\partial f}{\\partial x}' },
    { label: 'Gradient ∇f', snippet: '\\nabla f(x, y)' },
    { label: 'Laplacian ∇²', snippet: '\\nabla^2 u = 0' },
    { label: 'Definite Integral', snippet: '\\int_{a}^{b} f(x)\\,dx' },
    { label: 'Double Integral', snippet: '\\iint_{D} f(x,y)\\,dA' },
    { label: 'Closed Contour ∮', snippet: '\\oint_{C} \\mathbf{F}\\cdot d\\mathbf{r}' },
    { label: 'Limit x→a', snippet: '\\lim_{x \\to a} f(x)' },
    { label: 'Summation ∑', snippet: '\\sum_{k=1}^{n} a_k' },
    { label: 'Product ∏', snippet: '\\prod_{i=1}^{n} x_i' },
  ],
  greek: [
    { label: 'α', snippet: '\\alpha' },
    { label: 'β', snippet: '\\beta' },
    { label: 'γ', snippet: '\\gamma' },
    { label: 'δ', snippet: '\\delta' },
    { label: 'ε', snippet: '\\varepsilon' },
    { label: 'θ', snippet: '\\theta' },
    { label: 'λ', snippet: '\\lambda' },
    { label: 'μ', snippet: '\\mu' },
    { label: 'π', snippet: '\\pi' },
    { label: 'σ', snippet: '\\sigma' },
    { label: 'φ', snippet: '\\phi' },
    { label: 'ω', snippet: '\\omega' },
    { label: 'Δ', snippet: '\\Delta' },
    { label: 'Σ', snippet: '\\Sigma' },
    { label: 'Ω', snippet: '\\Omega' },
  ],
  logic: [
    { label: '∈', snippet: '\\in' },
    { label: '∉', snippet: '\\notin' },
    { label: '⊆', snippet: '\\subseteq' },
    { label: '∪', snippet: '\\cup' },
    { label: '∩', snippet: '\\cap' },
    { label: '∀', snippet: '\\forall' },
    { label: '∃', snippet: '\\exists' },
    { label: '⇒', snippet: '\\implies' },
    { label: '⇔', snippet: '\\iff' },
    { label: '∧', snippet: '\\land' },
    { label: '∨', snippet: '\\lor' },
    { label: '¬', snippet: '\\neg' },
    { label: '≠', snippet: '\\neq' },
    { label: '≤', snippet: '\\le' },
    { label: '≥', snippet: '\\ge' },
    { label: '∞', snippet: '\\infty' },
  ],
};

export function EquationEditorView({
  settings,
  savedEquations,
  onSaveEquation,
  onDeleteEquation,
  onSaveToNotebook,
  onSendToExport,
}: EquationEditorViewProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [eqTitle, setEqTitle] = useState("Euler-Lagrange / Stokes' Identity");
  const [category, setCategory] = useState('Multivariable Calculus');
  const [latex, setLatex] = useState(
    '\\iint_{S} (\\nabla \\times \\mathbf{F}) \\cdot d\\mathbf{S} = \\oint_{\\partial S} \\mathbf{F} \\cdot d\\mathbf{r}'
  );
  const [group, setGroup] = useState<SymbolGroup>('calculus');
  const [matRows, setMatRows] = useState(2);
  const [matCols, setMatCols] = useState(2);
  const [copied, setCopied] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const [noteFlag, setNoteFlag] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const insertSnippet = (snippet: string) => {
    const el = inputRef.current;
    if (!el) {
      setLatex((prev) => `${prev} ${snippet}`.trim());
      return;
    }
    const start = el.selectionStart ?? latex.length;
    const end = el.selectionEnd ?? latex.length;
    const next = latex.slice(0, start) + snippet + latex.slice(end);
    setLatex(next);
    setTimeout(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const insertMatrix = (env: 'bmatrix' | 'pmatrix' | 'vmatrix') => {
    const rows = Array.from({ length: matRows }, (_, r) =>
      Array.from({ length: matCols }, (__, c) => `a_{${r + 1}${c + 1}}`).join(' & ')
    ).join(' \\\\ ');
    insertSnippet(`\\begin{${env}} ${rows} \\end{${env}}`);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(latex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleSaveToLibrary = () => {
    if (!latex.trim()) return;
    triggerHaptic(settings.hapticsEnabled, 10);
    onSaveEquation({
      id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: eqTitle.trim() || 'Saved Equation',
      latex: latex.trim(),
      category,
      updatedAt: Date.now(),
    });
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 1600);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Sigma className="w-5 h-5 text-[#2F7CF6]" />
              Visual LaTeX Equation Editor
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Compose publication-grade equations with live KaTeX preview, dynamic matrix templates, symbol palettes, and reusable saved libraries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy LaTeX'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveToNotebook({
                  title: eqTitle || 'Composed Equation',
                  topic: category,
                  content: `$$${latex}$$`,
                });
                setNoteFlag(true);
                setTimeout(() => setNoteFlag(false), 1600);
              }}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>{noteFlag ? 'Added to Note' : 'Notebook'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onSendToExport({
                  heading: eqTitle || 'LaTeX Equation',
                  plainText: `Category: ${category}`,
                  latex,
                })
              }
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              <FileOutput className="w-3.5 h-3.5" />
              <span>Export Studio</span>
            </button>
            <button
              type="button"
              onClick={handleSaveToLibrary}
              className="h-9 px-3.5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              {savedFlag ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savedFlag ? 'Saved' : 'Save Equation'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={eqTitle}
            onChange={(e) => setEqTitle(e.target.value)}
            placeholder="Equation title"
            className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-sm text-slate-900 dark:text-white"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-sm text-slate-900 dark:text-white"
          >
            <option>Multivariable Calculus</option>
            <option>Differential Equations</option>
            <option>Linear Algebra</option>
            <option>Transforms &amp; Signals</option>
            <option>Discrete Mathematics</option>
            <option>Physics &amp; Mechanics</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Symbol Toolbar + Matrix Builder */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'structures', label: 'Structures' },
                { id: 'calculus', label: 'Calculus' },
                { id: 'greek', label: 'Greek' },
                { id: 'logic', label: 'Logic & Sets' },
              ] as const
            ).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                  group === g.id
                    ? 'bg-[#2F7CF6] text-white'
                    : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PALETTE[group].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => insertSnippet(item.snippet)}
                className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6] text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                title={item.snippet}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Dynamic Matrix Builder */}
          <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-3">
            <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Grid3X3 className="w-3.5 h-3.5 text-[#2F7CF6]" />
              Matrix &amp; Determinant Builder
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Rows</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={matRows}
                  onChange={(e) => setMatRows(Math.max(1, Math.min(5, Number(e.target.value) || 2)))}
                  className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Columns</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={matCols}
                  onChange={(e) => setMatCols(Math.max(1, Math.min(5, Number(e.target.value) || 2)))}
                  className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => insertMatrix('bmatrix')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] hover:border-[#2F7CF6] border border-transparent text-xs font-medium text-slate-800 dark:text-slate-200 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> [Brackets]
              </button>
              <button
                type="button"
                onClick={() => insertMatrix('pmatrix')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] hover:border-[#2F7CF6] border border-transparent text-xs font-medium text-slate-800 dark:text-slate-200 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> (Parens)
              </button>
              <button
                type="button"
                onClick={() => insertMatrix('vmatrix')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] hover:border-[#2F7CF6] border border-transparent text-xs font-medium text-slate-800 dark:text-slate-200 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> |Det|
              </button>
            </div>
          </div>
        </div>

        {/* Right: Source + Live KaTeX Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-900 dark:text-white">
                LaTeX Source
              </label>
              <ClearAllActionButton
                label="Clear"
                clearedLabel="Cleared successfully"
                cleared={clearedNotice}
                variant="danger"
                size="sm"
                onClick={() => {
                  if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
                  setLatex('');
                  setClearedNotice(true);
                  clearTimerRef.current = window.setTimeout(() => setClearedNotice(false), 2000);
                }}
              />
            </div>
            <textarea
              ref={inputRef}
              rows={5}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-[#12151C] font-mono text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-6 space-y-3">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Live Rendered KaTeX Preview
            </div>
            <div className="min-h-[120px] flex items-center justify-center rounded-xl bg-slate-50 dark:bg-[#12151C] p-6 overflow-x-auto text-slate-900 dark:text-white">
              {latex.trim() ? (
                <MathTex tex={latex} display />
              ) : (
                <span className="text-xs text-slate-400">Type LaTeX or click a template button above</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Saved Equations Library */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Saved Equations Library ({savedEquations.length})
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">Click Load to edit</span>
        </div>

        {savedEquations.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
            No saved equations yet. Compose any formula and click &ldquo;Save Equation&rdquo;.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedEquations.map((eq) => (
              <div
                key={eq.id}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {eq.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{eq.category}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEqTitle(eq.title);
                        setCategory(eq.category);
                        setLatex(eq.latex);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#2F7CF6] text-white text-[11px] font-semibold"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${eq.title}`}
                      onClick={() => onDeleteEquation(eq.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto py-1 text-slate-900 dark:text-white">
                  <MathTex tex={eq.latex} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
