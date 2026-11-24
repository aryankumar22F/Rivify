import { useMemo, useState } from 'react';
import { ArrowRight, Brain, CheckCircle2, RotateCw } from 'lucide-react';
import { FORMULA_SHEET, type FormulaEntry } from '../data/formulaSheet';
import type { FlashcardProgress } from '../types';
import { MathTex } from './MathTex';

interface FlashcardsViewProps {
  progressMap: Record<string, FlashcardProgress>;
  onRateCard: (formulaId: string, quality: 1 | 2 | 3 | 4) => void;
  onTryInCalculator: (ex: NonNullable<FormulaEntry['tryExample']>) => void;
}

export function FlashcardsView({
  progressMap,
  onRateCard,
  onTryInCalculator,
}: FlashcardsViewProps) {
  const [deckMode, setDeckMode] = useState<'due' | 'all'>('due');
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const now = Date.now();

  const dueCards = useMemo(() => {
    return FORMULA_SHEET.filter((f) => {
      const p = progressMap[f.id];
      return !p || p.nextReviewAt <= now;
    });
  }, [progressMap, now]);

  const deck = deckMode === 'due' ? dueCards : FORMULA_SHEET;
  const safeIndex = deck.length > 0 ? index % deck.length : 0;
  const current = deck[safeIndex];
  const currentProgress = current ? progressMap[current.id] : undefined;

  const masteredCount = useMemo(
    () => Object.values(progressMap).filter((p) => p.repetitions >= 2).length,
    [progressMap]
  );

  const handleRate = (quality: 1 | 2 | 3 | 4) => {
    if (!current) return;
    onRateCard(current.id, quality);
    setFlipped(false);
    setIndex((prev) => (deck.length > 1 ? (prev + 1) % deck.length : 0));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#2F7CF6]" />
            Formula Flashcards & Spaced Repetition
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 tabular-nums">
            {dueCards.length} due for review · {masteredCount} of {FORMULA_SHEET.length} cards retained
          </p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#111319] border border-slate-200 dark:border-white/10 self-start">
          <button
            type="button"
            onClick={() => {
              setDeckMode('due');
              setIndex(0);
              setFlipped(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              deckMode === 'due'
                ? 'bg-[#2F7CF6] text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Due ({dueCards.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setDeckMode('all');
              setIndex(0);
              setFlipped(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              deckMode === 'all'
                ? 'bg-[#2F7CF6] text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            All ({FORMULA_SHEET.length})
          </button>
        </div>
      </div>

      {!current ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-10 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            All Due Flashcards Reviewed
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            You have completed every scheduled spaced-repetition card for now. Switch to the full deck to review any formula anytime.
          </p>
          <button
            type="button"
            onClick={() => {
              setDeckMode('all');
              setIndex(0);
            }}
            className="px-5 py-2.5 rounded-xl bg-[#2F7CF6] text-white text-sm font-semibold hover:bg-[#256AE0] transition-colors"
          >
            Browse Full Deck
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 tabular-nums">
            <span>
              Card {safeIndex + 1} of {deck.length} · {current.category}
            </span>
            <span>
              {currentProgress
                ? `Interval: ${currentProgress.intervalDays}d · Reps: ${currentProgress.repetitions}`
                : 'New card'}
            </span>
          </div>

          {/* Interactive Flip Card */}
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="w-full min-h-[260px] rounded-3xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#1E212B] p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-4 hover:border-[#2F7CF6] transition-colors"
          >
            {!flipped ? (
              <>
                <span className="text-xs font-medium text-[#2F7CF6]">
                  Recall the Formula
                </span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {current.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                  {current.category} · Click to reveal mathematical notation
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                  <RotateCw className="w-3.5 h-3.5" />
                  Tap to flip
                </span>
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {current.title}
                </span>
                <div className="w-full overflow-x-auto py-2 text-slate-900 dark:text-white">
                  <MathTex tex={current.formulaLatex} display />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg leading-relaxed">
                  {current.note}
                </p>
              </>
            )}
          </button>

          {/* Spaced Repetition Rating Bar */}
          {flipped ? (
            <div className="space-y-3">
              <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                Rate how well you recalled this formula to schedule your next review:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleRate(1)}
                  className="h-12 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300 text-xs font-semibold hover:bg-rose-500/20 transition-colors"
                >
                  Again · Today
                </button>
                <button
                  type="button"
                  onClick={() => handleRate(2)}
                  className="h-12 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
                >
                  Hard · 1d
                </button>
                <button
                  type="button"
                  onClick={() => handleRate(3)}
                  className="h-12 rounded-xl border border-[#2F7CF6]/40 bg-[#2F7CF6]/10 text-[#2F7CF6] dark:text-[#7EB0FF] text-xs font-semibold hover:bg-[#2F7CF6]/20 transition-colors"
                >
                  Good · 3d+
                </button>
                <button
                  type="button"
                  onClick={() => handleRate(4)}
                  className="h-12 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                >
                  Easy · 6d+
                </button>
              </div>
              {current.tryExample && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => onTryInCalculator(current.tryExample!)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F7CF6] hover:underline"
                  >
                    <span>Test this formula in Calculator</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="w-full h-12 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-sm font-semibold transition-colors"
            >
              Show Formula Answer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
