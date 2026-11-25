import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  Bookmark,
  Brain,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  FileDown,
  Flame,
  FolderKanban,
  History,
  Layers,
  LineChart,
  Lock,
  PenTool,
  Share2,
  Target,
  Trophy,
} from 'lucide-react';
import { CLASSROOM_LESSONS } from '../data/classroomAndPapers';
import { FORMULA_SHEET } from '../data/formulaSheet';
import type { GamificationSummary } from '../engine/gamification';
import type {
  ActivityEvent,
  ClassroomLessonProgress,
  ExamAttempt,
  FlashcardProgress,
  HistoryItem,
  QuizAttempt,
  RecentGraphSession,
  ResearchProject,
  SavedEquation,
  ScientificHistoryItem,
  ToolId,
  WhiteboardSession,
} from '../types';
import { shareSolutionText } from '../utils/pdfReport';

interface DashboardViewProps {
  history: HistoryItem[];
  scientificHistory?: ScientificHistoryItem[];
  examAttempts?: ExamAttempt[];
  quizAttempts: QuizAttempt[];
  activityEvents: ActivityEvent[];
  favoriteFormulaIds: string[];
  flashcardProgress?: Record<string, FlashcardProgress>;
  whiteboards?: WhiteboardSession[];
  researchProjects?: ResearchProject[];
  recentGraphs?: RecentGraphSession[];
  savedEquations?: SavedEquation[];
  classroomProgress?: Record<string, ClassroomLessonProgress>;
  gamification: GamificationSummary;
  dailyGoal: number;
  onPracticeTopic: (level: 1 | 2 | 3 | 4) => void;
  onOpenQuiz: () => void;
  onOpenFlashcards: () => void;
  onOpenTool: (tool: ToolId) => void;
  onReopenCalculation: (item: HistoryItem) => void;
  onDownloadPdf: () => void;
}

const TOPIC_TO_LEVEL: Record<string, 1 | 2 | 3 | 4> = {
  'Partial Derivative': 1,
  'Limits & Continuity': 2,
  'Chain Rule': 2,
  Integration: 2,
  Gradient: 3,
  'Directional Derivative': 3,
  'Linear Approximation': 3,
  'Linear Algebra': 3,
  'Maxima & Minima': 4,
  Optimization: 4,
  'Vector Field': 4,
  'Vector Theorems': 4,
  'Mixed Partials': 4,
};

const MODULE_TRACKER_TOPICS = [
  'Partial Derivative',
  'Limits & Continuity',
  'Gradient',
  'Directional Derivative',
  'Linear Approximation',
  'Integration',
  'Maxima & Minima',
  'Optimization',
  'Vector Field',
  'Vector Theorems',
  'Linear Algebra',
  'Differential Equations',
  'Numerical Methods',
  'Probability & Statistics',
  'Complex Analysis',
  'Discrete Mathematics',
  'Fourier & Laplace',
  'Operations Research',
  'Advanced Geometry',
] as const;

const TOTAL_PLATFORM_MODULES = 45;

const QUICK_LAUNCH_TOOLS: { id: ToolId; label: string; subtitle: string }[] = [
  { id: 'scientific-calculator', label: 'Scientific Calculator', subtitle: 'DEG/RAD, fractions & tape' },
  { id: 'math-solver', label: 'Math Problem Solver', subtitle: 'Symbolic & equations' },
  { id: 'discrete-math', label: 'Discrete Mathematics Lab', subtitle: 'Sets, logic, graphs & induction' },
  { id: 'fourier-laplace', label: 'Fourier & Laplace Lab', subtitle: 'Series, spectra & Laplace pairs' },
  { id: 'operations-research', label: 'Operations Research Lab', subtitle: 'Simplex LP & VAM transport' },
  { id: 'math-whiteboard', label: 'Math Whiteboard', subtitle: 'Draw, KaTeX pins & PNG/PDF' },
  { id: 'formula-derivation', label: 'Formula Derivation Engine', subtitle: 'Proofs, Taylor & identity checks' },
  { id: 'graph-animation', label: 'Graph Animation Studio', subtitle: 'Animate sweeps, Riemann & Taylor' },
  { id: 'smart-revision', label: 'Smart Revision System', subtitle: 'SM-2 queue & weak-topic focus' },
  { id: 'virtual-classroom', label: 'Virtual Classroom', subtitle: 'Interactive lessons & demos' },
  { id: 'question-paper', label: 'Question Paper Generator', subtitle: 'Custom papers & answer keys' },
  { id: 'research-workspace', label: 'Research Workspace', subtitle: 'Projects, LaTeX & report PDF' },
];

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
  scientificHistory = [],
  examAttempts = [],
  quizAttempts,
  activityEvents,
  favoriteFormulaIds,
  flashcardProgress = {},
  whiteboards = [],
  researchProjects = [],
  recentGraphs = [],
  savedEquations = [],
  classroomProgress = {},
  gamification,
  dailyGoal,
  onPracticeTopic,
  onOpenQuiz,
  onOpenFlashcards,
  onOpenTool,
  onReopenCalculation,
  onDownloadPdf,
}: DashboardViewProps) {
  const [sharedBadgeId, setSharedBadgeId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalCalculations = history.length + scientificHistory.length;
    const examQuestionsCount = examAttempts.reduce((s, e) => s + e.totalQuestions, 0);
    const examCorrectCount = examAttempts.reduce((s, e) => s + e.correctCount, 0);
    const totalQuizAnswered = quizAttempts.length;
    const correctQuiz = quizAttempts.filter((a) => a.correct).length;
    const totalAssessed = totalQuizAnswered + examQuestionsCount;
    const totalAssessedCorrect = correctQuiz + examCorrectCount;
    const accuracy =
      totalAssessed > 0 ? Math.round((totalAssessedCorrect / totalAssessed) * 100) : null;
    const examAvgPct =
      examAttempts.length > 0
        ? Math.round(
            examAttempts.reduce(
              (acc, a) => acc + (a.scoreMarks / Math.max(1, a.maxMarks)) * 100,
              0
            ) / examAttempts.length
          )
        : null;

    const topicMap = new Map<string, { total: number; correct: number }>();
    for (const att of quizAttempts) {
      const cur = topicMap.get(att.category) ?? { total: 0, correct: 0 };
      cur.total += 1;
      if (att.correct) cur.correct += 1;
      topicMap.set(att.category, cur);
    }
    for (const ex of examAttempts) {
      for (const [topic, br] of Object.entries(ex.topicBreakdown)) {
        const cur = topicMap.get(topic) ?? { total: 0, correct: 0 };
        cur.total += br.total;
        cur.correct += br.correct;
        topicMap.set(topic, cur);
      }
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

    const touchedTopics = new Set<string>();
    for (const h of history) touchedTopics.add(h.toolLabel);
    for (const a of quizAttempts) touchedTopics.add(a.category);
    for (const e of examAttempts) touchedTopics.add(e.topic);
    for (const ev of activityEvents) {
      if (ev.topic) touchedTopics.add(ev.topic);
    }

    const completedModulesCount = MODULE_TRACKER_TOPICS.filter((mod) => {
      const q = topicMap.get(mod);
      if (q && q.total > 0 && q.correct / q.total >= 0.75) return true;
      return (
        history.some((h) => h.toolLabel.toLowerCase().includes(mod.toLowerCase())) ||
        activityEvents.some((ev) => ev.topic.toLowerCase().includes(mod.toLowerCase()))
      );
    }).length;

    // Recently used tools derived strictly from calculation history & scientific calculator
    const recentToolsMap = new Map<
      ToolId,
      { tool: ToolId; label: string; count: number; lastUsed: number }
    >();
    for (const h of history) {
      const existing = recentToolsMap.get(h.tool);
      if (!existing) {
        recentToolsMap.set(h.tool, {
          tool: h.tool,
          label: h.toolLabel,
          count: 1,
          lastUsed: h.timestamp,
        });
      } else {
        existing.count += 1;
        existing.lastUsed = Math.max(existing.lastUsed, h.timestamp);
      }
    }
    if (scientificHistory.length > 0) {
      recentToolsMap.set('scientific-calculator', {
        tool: 'scientific-calculator',
        label: 'Scientific Calculator',
        count: scientificHistory.length,
        lastUsed: scientificHistory[0].timestamp,
      });
    }
    if (examAttempts.length > 0) {
      recentToolsMap.set('exam-prep', {
        tool: 'exam-prep',
        label: 'Exam Preparation Center',
        count: examAttempts.length,
        lastUsed: examAttempts[0].timestamp,
      });
    }
    const recentTools = Array.from(recentToolsMap.values())
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, 6);

    const dueRevisionCount = FORMULA_SHEET.filter((f) => {
      const p = flashcardProgress[f.id];
      return !p || p.nextReviewAt <= Date.now();
    }).length;
    const masteredFlashcards = FORMULA_SHEET.filter((f) => {
      const p = flashcardProgress[f.id];
      return p && p.repetitions >= 2 && p.intervalDays >= 3;
    }).length;
    const classroomCompletedCount = Object.values(classroomProgress).filter((c) => c.completed).length;

    return {
      totalProblemsSolved: totalCalculations + totalAssessed,
      totalCalculations,
      totalQuizAnswered,
      correctQuiz,
      totalAssessed,
      totalAssessedCorrect,
      accuracy,
      examAvgPct,
      topicBreakdown,
      weakTopics,
      days14,
      activeDaysCount,
      weeklyActions,
      maxDayTotal,
      levelsCompleted,
      topicsCoveredCount: touchedTopics.size,
      completedModulesCount,
      recentTools,
      recentCalculations: history.slice(0, 5),
      recentScientific: scientificHistory.slice(0, 4),
      recentExams: examAttempts.slice(0, 4),
      dueRevisionCount,
      masteredFlashcards,
      classroomCompletedCount,
    };
  }, [history, scientificHistory, examAttempts, quizAttempts, activityEvents, flashcardProgress, classroomProgress]);

  const xpPct = Math.round((gamification.xpIntoLevel / gamification.xpForNextLevel) * 100);
  const goalPct = Math.min(100, Math.round((gamification.todaySolved / Math.max(1, dailyGoal)) * 100));
  const earnedCount = gamification.badges.filter((b) => b.earned).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header + Gamification + Top 4 Real Metric Cards */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2F7CF6] mb-1">
              RIVIFY · Explore. Calculate. Master.
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Learning Dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Real-time overview of problems solved, quiz accuracy, topic coverage, recent calculations, and study progress.
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
              {history.length} symbolic · {scientificHistory.length} sci · {stats.totalAssessed} quiz/exam
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Practice &amp; Exam Accuracy</span>
              <Target className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.accuracy !== null ? `${stats.accuracy}%` : '—'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {stats.totalAssessed > 0
                ? `${stats.totalAssessedCorrect} of ${stats.totalAssessed} correct`
                : 'Complete a quiz or exam to track'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Modules &amp; Completed Topics</span>
              <Layers className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {TOTAL_PLATFORM_MODULES} modules
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {stats.completedModulesCount}/{MODULE_TRACKER_TOPICS.length} core topics · {stats.topicsCoveredCount} touched
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Exams &amp; 7-Day Study</span>
              <Bookmark className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {examAttempts.length > 0 && stats.examAvgPct !== null
                ? `${stats.examAvgPct}% avg`
                : `${stats.weeklyActions} actions`}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {examAttempts.length} exams · {stats.activeDaysCount}/14 active days ·{' '}
              {history.filter((h) => h.bookmarked).length + favoriteFormulaIds.length} saved
            </div>
          </div>
        </div>
      </div>

      {/* Quick Launch & Recently Used Tools + Recent Calculations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <LineChart className="w-4 h-4 text-[#2F7CF6]" />
                Tools & Recently Used
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Jump directly into university solvers, graphing, or your most used tools
              </p>
            </div>
          </div>

          {stats.recentTools.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recently Used Calculators
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stats.recentTools.map((rt) => (
                  <button
                    key={rt.tool}
                    type="button"
                    onClick={() => onOpenTool(rt.tool)}
                    className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6] px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {rt.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {rt.count} {rt.count === 1 ? 'run' : 'runs'} ·{' '}
                        {new Date(rt.lastUsed).toLocaleDateString()}
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-[#2F7CF6] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Advanced Mathematics Modules
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_LAUNCH_TOOLS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenTool(item.id)}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6] px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-[#2F7CF6]" />
                Recent Calculations
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click any calculation to reopen it in the symbolic workspace
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {history.length} total
            </span>
          </div>

          {stats.recentCalculations.length === 0 ? (
            <div className="py-8 text-center space-y-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
              <Calculator className="w-6 h-6 mx-auto text-slate-400" />
              <p className="text-xs text-slate-500 dark:text-slate-400 px-4">
                No calculations saved yet. Solve a problem in any calculator tool and it will appear here automatically.
              </p>
              <button
                type="button"
                onClick={() => onOpenTool('partial-derivative')}
                className="px-3.5 py-2 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold transition-colors"
              >
                Open Calculator
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.recentCalculations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onReopenCalculation(item)}
                  className="w-full text-left rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6] p-3 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-[#2F7CF6]">{item.toolLabel}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs font-mono font-semibold text-slate-900 dark:text-white truncate">
                      {item.expression}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate">
                      → {item.resultPlain}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scientific Calculator Usage History & Exam Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#2F7CF6]" />
              Scientific Calculator History
            </h3>
            <button
              type="button"
              onClick={() => onOpenTool('scientific-calculator')}
              className="text-xs font-semibold text-[#2F7CF6] hover:underline"
            >
              Open Scientific Calc
            </button>
          </div>
          {stats.recentScientific.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              No scientific expressions evaluated yet. Use the Scientific Calculator to see your expression tape here.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.recentScientific.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-mono text-slate-700 dark:text-slate-200 truncate">
                    {item.expression}
                  </span>
                  <span className="font-mono font-bold text-[#2F7CF6] shrink-0 tabular-nums">
                    = {item.result}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-500" />
              Exam Preparation Performance
            </h3>
            <button
              type="button"
              onClick={() => onOpenTool('exam-prep')}
              className="text-xs font-semibold text-[#2F7CF6] hover:underline"
            >
              Open Exam Center
            </button>
          </div>
          {stats.recentExams.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              No timed exams completed yet. Try Topic-Wise Practice, Engineering Mock, or AKTU-Style Mode.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.recentExams.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {ex.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {ex.correctCount}/{ex.totalQuestions} correct · {new Date(ex.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-500 shrink-0 tabular-nums">
                    {ex.scoreMarks}/{ex.maxMarks}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revision Progress, Whiteboards, Research Projects & Recent Graphs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#2F7CF6]" />
              Revision &amp; Classroom
            </h3>
            <button
              type="button"
              onClick={() => onOpenTool('smart-revision')}
              className="text-xs font-semibold text-[#2F7CF6] hover:underline"
            >
              Revise
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
              <div className="text-slate-500 dark:text-slate-400">Due Cards</div>
              <div className="font-mono font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {stats.dueRevisionCount} due
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
              <div className="text-slate-500 dark:text-slate-400">Retained</div>
              <div className="font-mono font-bold text-emerald-500 tabular-nums mt-0.5">
                {stats.masteredFlashcards}/{FORMULA_SHEET.length}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
              <div className="text-slate-500 dark:text-slate-400">Saved Formulas</div>
              <div className="font-mono font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {favoriteFormulaIds.length + savedEquations.length}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
              <div className="text-slate-500 dark:text-slate-400">Classroom</div>
              <div className="font-mono font-bold text-[#2F7CF6] tabular-nums mt-0.5">
                {stats.classroomCompletedCount}/{CLASSROOM_LESSONS.length} done
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <PenTool className="w-4 h-4 text-[#2F7CF6]" />
              Recent Whiteboards ({whiteboards.length})
            </h3>
            <button
              type="button"
              onClick={() => onOpenTool('math-whiteboard')}
              className="text-xs font-semibold text-[#2F7CF6] hover:underline"
            >
              Open Board
            </button>
          </div>
          {whiteboards.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
              No saved whiteboard boards yet. Sketch derivations or diagrams in Math Whiteboard.
            </p>
          ) : (
            <div className="space-y-2">
              {whiteboards.slice(0, 3).map((wb) => (
                <button
                  key={wb.id}
                  type="button"
                  onClick={() => onOpenTool('math-whiteboard')}
                  className="w-full text-left rounded-xl bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6] border border-transparent p-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-medium text-slate-900 dark:text-white truncate">{wb.title}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                    {new Date(wb.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-emerald-500" />
              Research &amp; Recent Graphs
            </h3>
            <button
              type="button"
              onClick={() => onOpenTool('research-workspace')}
              className="text-xs font-semibold text-[#2F7CF6] hover:underline"
            >
              Workspace
            </button>
          </div>
          {researchProjects.length === 0 && recentGraphs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
              No research studies or plotted visualizations logged yet. Open Graphing Calculator or Research Workspace.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {researchProjects.slice(0, 2).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenTool('research-workspace')}
                  className="w-full text-left rounded-xl bg-slate-50 dark:bg-[#22252E] p-2.5 flex items-center justify-between gap-2"
                >
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                    Project: {p.title}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0">{p.formulas.length} eq</span>
                </button>
              ))}
              {recentGraphs.slice(0, 2).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onOpenTool(g.sourceTool as ToolId)}
                  className="w-full text-left rounded-xl bg-slate-50 dark:bg-[#22252E] p-2.5 flex items-center justify-between gap-2"
                >
                  <span className="font-mono text-slate-800 dark:text-slate-200 truncate">
                    Graph: {g.expression}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#2F7CF6] shrink-0" />
                </button>
              ))}
            </div>
          )}
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
            <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 tabular-nums">
              <Calendar className="w-3.5 h-3.5" />
              {stats.activeDaysCount} active
            </span>
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
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#2F7CF6]" />
              Recommended Next Topics
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
                          `RIVIFY Achievement Unlocked: ${badge.title}`,
                          `I unlocked "${badge.title}" on RIVIFY (${badge.description}) · Level ${gamification.level} (${gamification.xp} XP)`
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
