import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Bookmark,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileDown,
  Flame,
  Lock,
  Share2,
  Target,
  Trophy,
} from 'lucide-react';
import type { GamificationSummary } from '../engine/gamification';
import type { ActivityEvent, HistoryItem, QuizAttempt } from '../types';
import { shareSolutionText } from '../utils/pdfReport';

interface DashboardViewProps {
  history: HistoryItem[];
  quizAttempts: QuizAttempt[];
  activityEvents: ActivityEvent[];
  favoriteFormulaIds: string[];
  gamification: GamificationSummary;
  dailyGoal: number;
  onPracticeTopic: (level: 1 | 2 | 3 | 4) => void;
  onOpenQuiz: () => void;
  onOpenFlashcards: () => void;
  onDownloadPdf: () => void;
}

const TOPIC_TO_LEVEL: Record<string, 1 | 2 | 3 | 4> = {
  'Partial Derivative': 1,
  Gradient: 3,
  'Directional Derivative': 3,
  'Linear Approximation': 3,
  'Chain Rule': 2,
  'Maxima & Minima': 4,
  'Vector Field': 4,
  'Mixed Partials': 4,
};

function getLast14Days(): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    days.push({ key, label });
  }
  return days;
}

export function DashboardView({
  history,
  quizAttempts,
  activityEvents,
  favoriteFormulaIds,
  gamification,
  dailyGoal,
  onPracticeTopic,
  onOpenQuiz,
  onOpenFlashcards,
  onDownloadPdf,
}: DashboardViewProps) {
  const [sharedBadgeId, setSharedBadgeId] = useState<string | null>(null);
  const stats = useMemo(() => {
    const totalCalculations = history.length;
    const totalQuizAnswered = quizAttempts.length;
    const correctQuiz = quizAttempts.filter((a) => a.correct).length;
    const accuracy =
      totalQuizAnswered > 0 ? Math.round((correctQuiz / totalQuizAnswered) * 100) : null;

    const topicMap = new Map<string, { total: number; correct: number }>();
    for (const att of quizAttempts) {
      const cur = topicMap.get(att.category) ?? { total: 0, correct: 0 };
      cur.total += 1;
      if (att.correct) cur.correct += 1;
      topicMap.set(att.category, cur);
    }

    const topicBreakdown = Array.from(topicMap.entries())
      .map(([category, data]) => ({
        category,
        total: data.total,
        correct: data.correct,
        accuracy: Math.round((data.correct / data.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const weakTopics = topicBreakdown.filter((t) => t.accuracy < 75);

    const dayCounts = new Map<string, { calc: number; quiz: number }>();
    for (const ev of activityEvents) {
      const cur = dayCounts.get(ev.dateKey) ?? { calc: 0, quiz: 0 };
      if (ev.kind === 'calculation') cur.calc += 1;
      else cur.quiz += 1;
      dayCounts.set(ev.dateKey, cur);
    }

    const days14 = getLast14Days().map((d) => {
      const counts = dayCounts.get(d.key) ?? { calc: 0, quiz: 0 };
      return {
        ...d,
        calc: counts.calc,
        quiz: counts.quiz,
        total: counts.calc + counts.quiz,
      };
    });

    const activeDaysCount = days14.filter((d) => d.total > 0).length;
    const weeklyActions = days14.slice(-7).reduce((sum, d) => sum + d.total, 0);
    const maxDayTotal = Math.max(1, ...days14.map((d) => d.total));
    const levelsCompleted = new Set(quizAttempts.map((a) => a.level)).size;

    return {
      totalProblemsSolved: totalCalculations + totalQuizAnswered,
      totalCalculations,
      totalQuizAnswered,
      correctQuiz,
      accuracy,
      topicBreakdown,
      weakTopics,
      days14,
      activeDaysCount,
      weeklyActions,
      maxDayTotal,
      levelsCompleted,
    };
  }, [history, quizAttempts, activityEvents]);

  const xpPct = Math.round((gamification.xpIntoLevel / gamification.xpForNextLevel) * 100);
  const goalPct = Math.min(100, Math.round((gamification.todaySolved / Math.max(1, dailyGoal)) * 100));
  const earnedCount = gamification.badges.filter((b) => b.earned).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header + Gamification + Top 4 Real Metric Cards */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Learning Dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Real-time overview of your XP, daily goals, calculations, quiz accuracy, and study path.
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadPdf}
            className="h-10 px-4 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <FileDown className="w-4 h-4" />
            <span>Download PDF Report</span>
          </button>
        </div>

        {/* Gamification: Level/XP + Streak/Daily Goal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#2F7CF6]/25 bg-slate-50 dark:bg-[#22252E] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#2F7CF6]" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                  Level {gamification.level} Scholar
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-[#2F7CF6] tabular-nums">
                {gamification.xp} XP
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <div
                style={{ width: `${xpPct}%` }}
                className="h-full rounded-full bg-[#2F7CF6] transition-all"
              />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {gamification.xpIntoLevel} / {gamification.xpForNextLevel} XP to Level{' '}
              {gamification.level + 1}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/25 bg-slate-50 dark:bg-[#22252E] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                  {gamification.currentStreak} Day Streak
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                {gamification.todaySolved} / {dailyGoal} today
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <div
                style={{ width: `${goalPct}%` }}
                className="h-full rounded-full bg-amber-500 transition-all"
              />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {gamification.todaySolved >= dailyGoal
                ? 'Daily learning goal reached!'
                : `${dailyGoal - gamification.todaySolved} more actions to hit your daily goal`}
            </div>
          </div>
        </div>

        {/* Top 4 Real Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Problems Solved</span>
              <CheckCircle2 className="w-4 h-4 text-[#2F7CF6]" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.totalProblemsSolved}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {stats.totalCalculations} calculations · {stats.totalQuizAnswered} quiz items
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Quiz Accuracy</span>
              <Target className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.accuracy !== null ? `${stats.accuracy}%` : '—'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {stats.totalQuizAnswered > 0
                ? `${stats.correctQuiz} of ${stats.totalQuizAnswered} correct`
                : 'Complete a quiz to track accuracy'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>7-Day / 14-Day Study</span>
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.weeklyActions} this week
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {stats.activeDaysCount}/14 active days · Levels: {stats.levelsCompleted}/4
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Saved Bookmarks</span>
              <Bookmark className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {history.filter((h) => h.bookmarked).length + favoriteFormulaIds.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {history.filter((h) => h.bookmarked).length} solutions · {favoriteFormulaIds.length} formulas
            </div>
          </div>
        </div>
      </div>

      {/* 14-Day Activity + Topic Mastery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#2F7CF6]" />
                Daily Activity (Last 14 Days)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Combined calculations, quizzes, mock tests, and flashcard reviews
              </p>
            </div>
          </div>

          <div className="h-44 flex items-end gap-1.5 sm:gap-2 pt-4">
            {stats.days14.map((day) => {
              const heightPct =
                day.total > 0 ? Math.max(12, Math.round((day.total / stats.maxDayTotal) * 100)) : 4;
              return (
                <div
                  key={day.key}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                >
                  <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.total}
                  </div>
                  <div
                    title={`${day.label}: ${day.calc} calculations, ${day.quiz} study actions`}
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-md transition-all ${
                      day.total > 0 ? 'bg-[#2F7CF6]' : 'bg-slate-200 dark:bg-white/10'
                    }`}
                  />
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-full">
                    {day.key.slice(8)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-[#2F7CF6]" />
            Topic Mastery & Weak Areas
          </h3>

          {stats.topicBreakdown.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No quiz attempts recorded yet. Complete a practice quiz or mock test to identify weak topics.
              </p>
              <button
                type="button"
                onClick={onOpenQuiz}
                className="px-4 py-2 rounded-xl bg-[#2F7CF6] text-white text-xs font-semibold hover:bg-[#256AE0] transition-colors"
              >
                Start Practice Quiz
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {stats.topicBreakdown.map((t) => {
                const isWeak = t.accuracy < 75;
                return (
                  <div key={t.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                        {isWeak && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                        {t.category}
                      </span>
                      <span className="tabular-nums text-slate-600 dark:text-slate-400">
                        {t.accuracy}% ({t.correct}/{t.total})
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                      <div
                        style={{ width: `${t.accuracy}%` }}
                        className={`h-full rounded-full ${
                          isWeak ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}

              {stats.weakTopics.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() =>
                      onPracticeTopic(TOPIC_TO_LEVEL[stats.weakTopics[0].category] ?? 2)
                    }
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500/12 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-semibold flex items-center justify-between transition-colors"
                  >
                    <span>Practice Weak Topic: {stats.weakTopics[0].category}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Personalized Learning Path + Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Personalized Learning Path */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#2F7CF6]" />
              Personalized Learning Path
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Adaptive curriculum recommendations ordered by your current accuracy
            </p>
          </div>

          <div className="space-y-3">
            {gamification.learningPath.map((step) => {
              const isFocus = step.priority === 'Focus Area';
              const isMastery = step.priority === 'Mastery';
              return (
                <div
                  key={step.id}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-semibold ${
                          isFocus
                            ? 'text-amber-600 dark:text-amber-400'
                            : isMastery
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-[#2F7CF6]'
                        }`}
                      >
                        {step.priority}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {step.topic}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {step.reason}
                    </p>
                  </div>

                  {step.recommendedAction === 'flashcards' ? (
                    <button
                      type="button"
                      onClick={onOpenFlashcards}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#191C24] hover:border-[#2F7CF6] text-xs font-semibold text-slate-800 dark:text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Brain className="w-3.5 h-3.5 text-[#2F7CF6]" />
                      <span>Flashcards</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPracticeTopic(step.level ?? 2)}
                      className="px-3 py-2 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <span>Practice</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Achievements & Badges */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Achievements & Badges
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Unlocked automatically from your recorded study milestones
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {earnedCount} / {gamification.badges.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gamification.badges.map((badge) => (
              <div
                key={badge.id}
                className={`rounded-xl border p-3.5 space-y-1.5 ${
                  badge.earned
                    ? 'border-emerald-500/40 bg-emerald-500/8'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {badge.title}
                  </span>
                  {badge.earned ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {badge.description}
                </p>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {badge.progressText}
                  </span>
                  {badge.earned && (
                    <button
                      type="button"
                      onClick={async () => {
                        await shareSolutionText(
                          `Derivify Achievement Unlocked: ${badge.title}`,
                          `I unlocked "${badge.title}" on Derivify (${badge.description}) · Level ${gamification.level} (${gamification.xp} XP)`
                        );
                        setSharedBadgeId(badge.id);
                        setTimeout(() => setSharedBadgeId(null), 1600);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2F7CF6] hover:underline"
                    >
                      {sharedBadgeId === badge.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Shared</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3 h-3" />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
