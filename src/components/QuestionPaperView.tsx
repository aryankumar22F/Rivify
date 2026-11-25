import { useMemo, useState } from 'react';
import { Eye, EyeOff, FileCode, FileDown, FileText, Info, RefreshCw } from 'lucide-react';
import {
  generateCustomQuestionPaper,
  PAPER_TOPICS,
  type PaperDifficulty,
} from '../data/classroomAndPapers';
import {
  buildLatexDocument,
  downloadCustomPdfReport,
  downloadLatexFile,
  type ExportDocumentItem,
} from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface QuestionPaperViewProps {
  authorName: string;
}

export function QuestionPaperView({ authorName }: QuestionPaperViewProps) {
  const [title, setTitle] = useState('Engineering Mathematics Mid-Semester Practice Paper');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([
    'Multivariable Calculus',
    'Differential Equations',
    'Linear Algebra',
  ]);
  const [difficultyMix, setDifficultyMix] = useState<'balanced' | PaperDifficulty>('balanced');
  const [targetMarks, setTargetMarks] = useState(30);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [includeMcq, setIncludeMcq] = useState(true);
  const [includeNumerical, setIncludeNumerical] = useState(true);
  const [includeDescriptive, setIncludeDescriptive] = useState(true);
  const [seed, setSeed] = useState(1);
  const [showSolutions, setShowSolutions] = useState(false);

  const paper = useMemo(
    () =>
      generateCustomQuestionPaper({
        title,
        topics: selectedTopics,
        difficultyMix,
        targetMarks,
        durationMinutes,
        includeMcq,
        includeNumerical,
        includeDescriptive,
        seed,
      }),
    [
      title,
      selectedTopics,
      difficultyMix,
      targetMarks,
      durationMinutes,
      includeMcq,
      includeNumerical,
      includeDescriptive,
      seed,
    ]
  );

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const toExportItems = (withSolutions: boolean): ExportDocumentItem[] =>
    paper.questions.map((q, idx) => ({
      heading: `Q${idx + 1} [${q.topic} · ${q.difficulty.toUpperCase()} · ${q.marks} Marks]`,
      subtitle: q.optionsLatex
        ? `Options: ${q.optionsLatex.join('  |  ')}`
        : `Format: ${q.qType.toUpperCase()} (${q.sourceNote})`,
      plainText: withSolutions
        ? `${q.prompt}\nAnswer: ${q.answerText}`
        : q.prompt,
      latex: withSolutions
        ? `${q.expressionLatex} \\\\\\\\ \\text{Solution: } ${q.solutionLatex}`
        : q.expressionLatex,
    }));

  const handleDownloadPaperPdf = () => {
    downloadCustomPdfReport({
      title: `${paper.title} (${paper.totalMarks} Marks | ${paper.durationMinutes} min)`,
      author: `${authorName} — Custom Practice Paper (Not official PYQs)`,
      items: toExportItems(false),
      filename: `rivify-question-paper-${Date.now()}.pdf`,
    });
  };

  const handleDownloadSolutionsPdf = () => {
    downloadCustomPdfReport({
      title: `${paper.title} — Answer Key & Solutions`,
      author: authorName,
      items: toExportItems(true),
      filename: `rivify-answer-key-${Date.now()}.pdf`,
    });
  };

  const handleDownloadLatex = () => {
    const tex = buildLatexDocument({
      title: `${paper.title} (${paper.totalMarks} Marks · ${paper.durationMinutes} min)`,
      author: authorName,
      items: toExportItems(showSolutions),
    });
    downloadLatexFile(tex, `rivify-paper-${Date.now()}.tex`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2F7CF6]" />
              Question Paper Generator
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Assemble custom printable engineering math papers with mark weighting, answer keys, and PDF/LaTeX exports.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Shuffle Set
            </button>
            <button
              type="button"
              onClick={handleDownloadLatex}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              .TEX
            </button>
            <button
              type="button"
              onClick={handleDownloadSolutionsPdf}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              Solutions PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadPaperPdf}
              className="h-9 px-3.5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              Paper PDF
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-sky-500/30 bg-sky-500/8 px-3.5 py-2.5 text-xs text-sky-700 dark:text-sky-200 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>
            Custom Generated Sample Paper — assembled dynamically from practice templates for study drills, NOT official university previous-year question papers (PYQs).
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Config Panel */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Paper Header Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">Difficulty</label>
              <select
                value={difficultyMix}
                onChange={(e) => setDifficultyMix(e.target.value as 'balanced' | PaperDifficulty)}
                className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-slate-900 dark:text-white"
              >
                <option value="balanced">Balanced Mix</option>
                <option value="easy">Easy (2-mark focus)</option>
                <option value="medium">Medium (5-mark focus)</option>
                <option value="hard">Hard (10-mark proofs)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">Target Marks</label>
              <select
                value={targetMarks}
                onChange={(e) => setTargetMarks(Number(e.target.value))}
                className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-slate-900 dark:text-white"
              >
                <option value={15}>15 Marks</option>
                <option value={30}>30 Marks</option>
                <option value={50}>50 Marks</option>
                <option value={75}>75 Marks</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Duration (minutes)</label>
            <input
              type="number"
              min={10}
              max={180}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 30)}
              className="mt-1 w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold text-slate-900 dark:text-white">Question Formats</div>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={includeMcq} onChange={(e) => setIncludeMcq(e.target.checked)} className="accent-[#2F7CF6]" />
              Multiple Choice (2 Marks)
            </label>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={includeNumerical} onChange={(e) => setIncludeNumerical(e.target.checked)} className="accent-[#2F7CF6]" />
              Numerical Evaluation (5 Marks)
            </label>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={includeDescriptive} onChange={(e) => setIncludeDescriptive(e.target.checked)} className="accent-[#2F7CF6]" />
              Long Proof / Derivation (10 Marks)
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              Topics Included ({selectedTopics.length || 'All'})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PAPER_TOPICS.map((t) => {
                const active = selectedTopics.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTopic(t)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      active
                        ? 'bg-[#2F7CF6] text-white'
                        : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Paper Preview */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-white/10">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{paper.title}</h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                {paper.questions.length} Questions · Total Marks: {paper.totalMarks} · Time Allowed: {paper.durationMinutes} min
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSolutions((s) => !s)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5 shrink-0"
            >
              {showSolutions ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showSolutions ? 'Hide Answer Key' : 'Show Answer Key'}</span>
            </button>
          </div>

          <div className="space-y-4">
            {paper.questions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#2F7CF6]">
                    Q{idx + 1}. {q.topic} ({q.difficulty})
                  </span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                    [{q.marks} Marks]
                  </span>
                </div>
                <p className="text-sm text-slate-900 dark:text-white">{q.prompt}</p>
                <div className="overflow-x-auto text-slate-900 dark:text-white">
                  <MathTex tex={q.expressionLatex} />
                </div>
                {q.optionsLatex && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.optionsLatex.map((opt, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] px-3 py-2 text-xs text-slate-800 dark:text-slate-200 overflow-x-auto"
                      >
                        <span className="font-mono font-bold mr-1.5">({String.fromCharCode(65 + i)})</span>
                        <MathTex tex={opt} />
                      </div>
                    ))}
                  </div>
                )}

                {showSolutions && (
                  <div className="mt-2 pt-2.5 border-t border-emerald-500/30 text-xs space-y-1">
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Answer: {q.answerText}
                    </div>
                    <div className="overflow-x-auto text-slate-700 dark:text-slate-200">
                      <MathTex tex={q.solutionLatex} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
