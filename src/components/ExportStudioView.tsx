import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, FileCode2, FileDown, FileOutput, Plus } from 'lucide-react';
import type {
  ExamAttempt,
  HistoryItem,
  NotebookNote,
  ScientificHistoryItem,
} from '../types';
import {
  buildLatexDocument,
  downloadCustomPdfReport,
  downloadLatexFile,
  type ExportDocumentItem,
} from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface ExportStudioViewProps {
  authorName: string;
  history: HistoryItem[];
  scientificHistory: ScientificHistoryItem[];
  notes: NotebookNote[];
  examAttempts: ExamAttempt[];
  externalItem?: { heading: string; plainText: string; latex?: string; nonce: number } | null;
}

export function ExportStudioView({
  authorName,
  history,
  scientificHistory,
  notes,
  examAttempts,
  externalItem,
}: ExportStudioViewProps) {
  const [docTitle, setDocTitle] = useState('RIVIFY Engineering Mathematics Solution Sheet');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customItems, setCustomItems] = useState<ExportDocumentItem[]>([
    {
      heading: 'Multivariable Gradient Identity',
      subtitle: 'Sample Reference Equation',
      plainText: 'Direction of steepest ascent for f(x, y, z)',
      latex: '\\nabla f = \\frac{\\partial f}{\\partial x}\\hat{i} + \\frac{\\partial f}{\\partial y}\\hat{j} + \\frac{\\partial f}{\\partial z}\\hat{k}',
    },
  ]);
  const [customHeading, setCustomHeading] = useState('');
  const [customPlain, setCustomPlain] = useState('');
  const [customLatex, setCustomLatex] = useState('');
  const [copiedTex, setCopiedTex] = useState(false);

  useEffect(() => {
    if (externalItem) {
      setCustomItems((prev) => [
        {
          heading: externalItem.heading,
          subtitle: 'Imported from Calculator',
          plainText: externalItem.plainText,
          latex: externalItem.latex,
        },
        ...prev,
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalItem?.nonce]);

  const catalog = useMemo(() => {
    const entries: { id: string; group: string; item: ExportDocumentItem }[] = [];
    for (const h of history.slice(0, 20)) {
      entries.push({
        id: `hist-${h.id}`,
        group: 'Symbolic Calculus',
        item: {
          heading: `${h.toolLabel}: ${h.expression}`,
          subtitle: new Date(h.timestamp).toLocaleString(),
          plainText: h.resultPlain,
          latex: h.resultLatex,
        },
      });
    }
    for (const s of scientificHistory.slice(0, 15)) {
      entries.push({
        id: `sci-${s.id}`,
        group: 'Scientific Calculator',
        item: {
          heading: `Scientific (${s.angleUnit.toUpperCase()}): ${s.expression}`,
          subtitle: new Date(s.timestamp).toLocaleString(),
          plainText: `Result = ${s.result}`,
        },
      });
    }
    for (const n of notes.slice(0, 15)) {
      entries.push({
        id: `note-${n.id}`,
        group: 'Math Notebook',
        item: {
          heading: `${n.title} (${n.topic})`,
          subtitle: new Date(n.updatedAt).toLocaleDateString(),
          plainText: n.content,
        },
      });
    }
    for (const e of examAttempts.slice(0, 10)) {
      entries.push({
        id: `exam-${e.id}`,
        group: 'Exam Summary',
        item: {
          heading: e.title,
          subtitle: new Date(e.timestamp).toLocaleString(),
          plainText: `Score: ${e.scoreMarks}/${e.maxMarks} (${e.correctCount}/${e.totalQuestions} correct)`,
        },
      });
    }
    return entries;
  }, [history, scientificHistory, notes, examAttempts]);

  const activeItems = useMemo(() => {
    const picked = catalog
      .filter((c) => selectedIds.includes(c.id))
      .map((c) => c.item);
    return [...customItems, ...picked];
  }, [catalog, selectedIds, customItems]);

  const latexSource = useMemo(
    () =>
      buildLatexDocument({
        title: docTitle,
        author: authorName,
        items: activeItems,
      }),
    [docTitle, authorName, activeItems]
  );

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileOutput className="w-5 h-5 text-[#2F7CF6]" />
            Math Export Studio
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Bundle symbolic solutions, scientific calculations, notebook entries, exam score summaries, and custom LaTeX equations into formatted PDFs or compilable .tex documents.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              downloadCustomPdfReport({
                title: docTitle,
                author: authorName,
                items: activeItems,
              })
            }
            className="h-10 px-4 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <FileDown className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
          <button
            type="button"
            onClick={() => downloadLatexFile(latexSource)}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-white/15 hover:border-[#2F7CF6] text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
          >
            <FileCode2 className="w-4 h-4 text-emerald-500" />
            <span>Download .tex</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(latexSource);
              setCopiedTex(true);
              setTimeout(() => setCopiedTex(false), 1600);
            }}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
          >
            {copiedTex ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedTex ? 'Copied' : 'Copy LaTeX'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Picker & Custom Entry */}
        <div className="lg:col-span-6 space-y-5">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Document Title
            </label>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Add Custom Equation / Note
            </h3>
            <input
              type="text"
              value={customHeading}
              onChange={(e) => setCustomHeading(e.target.value)}
              placeholder="Section heading (e.g. Euler's Formula)"
              className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-xs"
            />
            <input
              type="text"
              value={customPlain}
              onChange={(e) => setCustomPlain(e.target.value)}
              placeholder="Description / plain explanation"
              className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-xs"
            />
            <input
              type="text"
              value={customLatex}
              onChange={(e) => setCustomLatex(e.target.value)}
              placeholder="LaTeX equation (e.g. e^{i\pi} + 1 = 0)"
              className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs"
            />
            {customLatex.trim() && (
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] p-3 overflow-x-auto">
                <MathTex tex={customLatex} display />
              </div>
            )}
            <button
              type="button"
              disabled={!customHeading.trim() && !customLatex.trim()}
              onClick={() => {
                setCustomItems((prev) => [
                  {
                    heading: customHeading.trim() || 'Custom Equation',
                    plainText: customPlain.trim(),
                    latex: customLatex.trim() || undefined,
                  },
                  ...prev,
                ]);
                setCustomHeading('');
                setCustomPlain('');
                setCustomLatex('');
              }}
              className="h-9 px-3.5 rounded-xl bg-[#2F7CF6] disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Export Bundle</span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Select From Saved Records ({catalog.length})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(
                    selectedIds.length === catalog.length ? [] : catalog.map((c) => c.id)
                  )
                }
                className="text-xs text-[#2F7CF6] hover:underline"
              >
                {selectedIds.length === catalog.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {catalog.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solve calculations, save notebook entries, or complete an exam to include them here.
              </p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {catalog.map((entry) => (
                  <label
                    key={entry.id}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(entry.id)}
                      onChange={() => toggleId(entry.id)}
                      className="mt-0.5 accent-[#2F7CF6]"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {entry.item.heading}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {entry.group} · {entry.item.plainText.slice(0, 70)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live LaTeX Preview */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Compilable LaTeX Source Preview ({activeItems.length} sections)
            </h3>
          </div>
          <pre className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto max-h-[540px] whitespace-pre-wrap">
            {latexSource}
          </pre>
        </div>
      </div>
    </div>
  );
}
