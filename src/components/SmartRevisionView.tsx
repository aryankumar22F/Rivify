import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { FORMULA_SHEET } from '../data/formulaSheet';
import type {
  AppSettings,
  ExamAttempt,
  FlashcardProgress,
  QuizAttempt,
} from '../types';
import { MathTex } from './MathTex';

interface SmartRevisionViewProps {
  settings: AppSettings;
  flashcardProgress: Record<string, FlashcardProgress>;
  quizAttempts: QuizAttempt[];
  examAttempts: ExamAttempt[];
  onRateCard: (formulaId: string, quality: 1 | 2 | 3 | 4) => void;
  onOpenFlashcards: () => void;
  onPracticeLevel: (level: 1 | 2 | 3 | 4) => void;
  onUpdateReminder: (enabled: boolean, time: string) => void;
}

const TOPIC_TO_LEVEL: Record<string, 1 | 2 | 3 | 4> = {
  'Partial Derivative': 1,
  'Limits & Continuity': 2,
  'Chain Rule': 2,
  Integration: 2,
  Gradient: 3,
  'Directional Derivative': 3,
  'Linear Approximation': 3,
  'Maxima & Minima': 4,
  Optimization: 4,
  'Vector Field': 4,
};

export function SmartRevisionView({
  settings,
  flashcardProgress,
  quizAttempts,
  examAttempts,
  onRateCard,
  onOpenFlashcards,
  onPracticeLevel,
  onUpdateReminder,
}: SmartRevisionViewProps) {
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const revisionStats = useMemo(() => {
    const dueCards = FORMULA_SHEET.filter((f) => {
      const p = flashcardProgress[f.id];
      return !p || p.nextReviewAt <= now;
    });
    const masteredCount = FORMULA_SHEET.filter((f) => {
      const p = flashcardProgress[f.id];
      return p && p.repetitions >= 2 && p.intervalDays >= 3;
    }).length;
    const avgEase =
      Object.values(flashcardProgress).length > 0
        ? (
            Object.values(flashcardProgress).reduce((s, p) => s + p.easeFactor, 0) /
            Object.values(flashcardProgress).length
          ).toFixed(2)
        : '2.50';

    // 7-day revision schedule forecast
    const forecast: { dayLabel: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const start = now + d * dayMs;
      const end = start + dayMs;
      const dateObj = new Date(start);
      const dayLabel =
        d === 0
          ? 'Today'
          : d === 1
          ? 'Tmrw'
          : dateObj.toLocaleDateString(undefined, { weekday: 'short' });
      const count = FORMULA_SHEET.filter((f) => {
        const p = flashcardProgress[f.id];
        if (!p) return d === 0;
        if (d === 0) return p.nextReviewAt <= end;
        return p.nextReviewAt > start && p.nextReviewAt <= end;
      }).length;
      forecast.push({ dayLabel, count });
    }

    // Weak topic detection from real Quiz & Exam performance
    const topicMap = new Map<string, { total: number; correct: number }>();
    for (const q of quizAttempts) {
      const cur = topicMap.get(q.category) ?? { total: 0, correct: 0 };
      cur.total += 1;
      if (q.correct) cur.correct += 1;
      topicMap.set(q.category, cur);
    }
    for (const ex of examAttempts) {
      for (const [t, b] of Object.entries(ex.topicBreakdown)) {
        const cur = topicMap.get(t) ?? { total: 0, correct: 0 };
        cur.total += b.total;
        cur.correct += b.correct;
        topicMap.set(t, cur);
      }
    }

    const topicRows = Array.from(topicMap.entries())
      .map(([topic, d]) => ({
        topic,
        total: d.total,
        correct: d.correct,
        accuracy: Math.round((d.correct / d.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const weakTopics = topicRows.filter((r) => r.accuracy < 75);

    return {
      dueCards,
      masteredCount,
      avgEase,
      forecast,
      topicRows,
      weakTopics,
    };
  }, [flashcardProgress, quizAttempts, examAttempts, now, dayMs]);

  const activeCard = revisionStats.dueCards[0] ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#2F7CF6]" />
              Smart Revision System (SM-2 Spaced Repetition)
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Adaptive formula recall queue, 7-day review timeline, and weak-topic prioritization computed from your quiz and exam results.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenFlashcards}
            className="h-9 px-4 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <span>Open Full Flashcards Deck</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3.5">
            <div className="text-slate-500 dark:text-slate-400">Due Now</div>
            <div className="text-xl font-bold text-[#2F7CF6] tabular-nums mt-0.5">
              {revisionStats.dueCards.length} cards
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3.5">
            <div className="text-slate-500 dark:text-slate-400">Retained / Mastered</div>
            <div className="text-xl font-bold text-emerald-500 tabular-nums mt-0.5">
              {revisionStats.masteredCount} / {FORMULA_SHEET.length}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3.5">
            <div className="text-slate-500 dark:text-slate-400">Mean SM-2 Ease</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {revisionStats.avgEase}×
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3.5">
            <div className="text-slate-500 dark:text-slate-400">Weak Topics Flagged</div>
            <div className="text-xl font-bold text-amber-500 tabular-nums mt-0.5">
              {revisionStats.weakTopics.length}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Inline Active SM-2 Review Card */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#2F7CF6]" />
              Instant Revision Card
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {revisionStats.dueCards.length} remaining due
            </span>
          </div>

          {!activeCard ? (
            <div className="py-10 text-center space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8">
              <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-500" />
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                All spaced-repetition reviews completed!
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your next scheduled cards will unlock according to your SM-2 intervals.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#12151C] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#2F7CF6]">{activeCard.category}</span>
                  <span className="text-slate-500 dark:text-slate-400">{activeCard.subtopic}</span>
                </div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">
                  {activeCard.title}
                </div>

                {flippedCardId === activeCard.id ? (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
                    <div className="overflow-x-auto text-slate-900 dark:text-white">
                      <MathTex tex={activeCard.formulaLatex} display />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{activeCard.note}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFlippedCardId(activeCard.id)}
                    className="w-full py-6 rounded-xl border border-dashed border-slate-300 dark:border-white/20 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-[#2F7CF6] inline-flex items-center justify-center gap-2"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Reveal Formula &amp; Conditions
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { q: 1 as const, label: 'Again (10m)', cls: 'bg-rose-500/12 text-rose-600 dark:text-rose-300 border-rose-500/30' },
                    { q: 2 as const, label: 'Hard (1d)', cls: 'bg-amber-500/12 text-amber-600 dark:text-amber-300 border-amber-500/30' },
                    { q: 3 as const, label: 'Good (3d+)', cls: 'bg-[#2F7CF6]/12 text-[#2F7CF6] border-[#2F7CF6]/30' },
                    { q: 4 as const, label: 'Easy (4d+)', cls: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' },
                  ]
                ).map((btn) => (
                  <button
                    key={btn.q}
                    type="button"
                    onClick={() => {
                      onRateCard(activeCard.id, btn.q);
                      setFlippedCardId(null);
                    }}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-semibold transition-colors ${btn.cls}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 7-Day Forecast */}
          <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2.5">
            <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#2F7CF6]" />
              7-Day Spaced Repetition Schedule
            </div>
            <div className="grid grid-cols-7 gap-2">
              {revisionStats.forecast.map((d) => (
                <div
                  key={d.dayLabel}
                  className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-2.5 text-center space-y-1"
                >
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{d.dayLabel}</div>
                  <div className="text-sm font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                    {d.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weak Topics + Daily Reminder Scheduler */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Weak Topic Revision Targets
            </h3>

            {revisionStats.topicRows.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                Attempt a quiz or mock test to automatically detect weak topics and build a targeted revision queue.
              </p>
            ) : (
              <div className="space-y-2.5">
                {revisionStats.topicRows.slice(0, 6).map((row) => {
                  const weak = row.accuracy < 75;
                  return (
                    <div
                      key={row.topic}
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {row.topic}
                        </div>
                        <div className={`text-[11px] tabular-nums ${weak ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {row.accuracy}% ({row.correct}/{row.total}) · {weak ? 'Needs Revision' : 'Strong'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPracticeLevel(TOPIC_TO_LEVEL[row.topic] ?? 2)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#2F7CF6] text-white text-[11px] font-semibold shrink-0"
                      >
                        Drill
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#2F7CF6]" />
                Revision Reminder Alert
              </span>
              <input
                type="checkbox"
                checked={settings.reminderEnabled}
                onChange={(e) => onUpdateReminder(e.target.checked, settings.reminderTime)}
                aria-label="Enable daily revision reminder"
                className="accent-[#2F7CF6] w-4 h-4"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Daily study reminder at</span>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => onUpdateReminder(settings.reminderEnabled, e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
