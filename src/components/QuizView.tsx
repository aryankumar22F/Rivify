import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Dices,
  History,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { QUIZ_BANK, QUIZ_LEVELS } from '../data/quizBank';
import {
  ASSESSMENT_TOPICS,
  generateMockTest,
  generatePracticeProblem,
  generatePracticeSession,
  generateTopicSession,
  getDailyChallengeQuestion,
  type AssessmentTopic,
} from '../engine/problemGenerator';
import { evaluateAST, parseExpression } from '../engine/symbolic';
import type { QuizAttempt, QuizQuestion } from '../types';
import { triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

type DifficultySelection =
  | 1
  | 2
  | 3
  | 4
  | 'mixed'
  | 'daily'
  | 'mock'
  | 'adaptive'
  | `topic:${AssessmentTopic}`;

interface QuizViewProps {
  quizAttempts: QuizAttempt[];
  dailyCompletedDate: string | null;
  initialLevel?: 1 | 2 | 3 | 4 | null;
  hapticsEnabled?: boolean;
  onRecordAttempt: (attempt: QuizAttempt) => void;
  onCompleteDaily: (dateKey: string) => void;
  onCompleteMock?: () => void;
}

const MOCK_DURATION_SECONDS = 10 * 60;

function shuffleQuestions(list: QuizQuestion[]): QuizQuestion[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function checkShortAnswer(q: QuizQuestion, rawInput: string): boolean {
  const trimmed = rawInput.trim();
  if (!trimmed) return false;
  const normalized = trimmed.replace(/\s+/g, '').toLowerCase();

  if (q.acceptedAnswers?.some((a) => a.replace(/\s+/g, '').toLowerCase() === normalized)) {
    return true;
  }

  // Evaluate user expression/fraction numerically
  try {
    const ast = parseExpression(trimmed);
    const val = evaluateAST(ast, { x: 1.5, y: 0.7 }, 'rad');
    if (q.numericAnswer !== undefined && Number.isFinite(val)) {
      return Math.abs(val - q.numericAnswer) <= (q.tolerance ?? 1e-2);
    }
  } catch {
    // ignore parse failure
  }

  const num = Number(trimmed);
  if (q.numericAnswer !== undefined && Number.isFinite(num)) {
    return Math.abs(num - q.numericAnswer) <= (q.tolerance ?? 1e-2);
  }
  return false;
}

export function QuizView({
  quizAttempts,
  dailyCompletedDate,
  initialLevel,
  hapticsEnabled = true,
  onRecordAttempt,
  onCompleteDaily,
  onCompleteMock,
}: QuizViewProps) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const dailyQuestion = useMemo(() => getDailyChallengeQuestion(todayKey), [todayKey]);
  const isDailyDone = dailyCompletedDate === todayKey;

  const [practiceSource, setPracticeSource] = useState<'curated' | 'generated'>('curated');
  const [selectedLevel, setSelectedLevel] = useState<DifficultySelection | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [shortInput, setShortInput] = useState('');
  const [shortSubmitted, setShortSubmitted] = useState(false);
  const [resultsMap, setResultsMap] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(MOCK_DURATION_SECONDS);
  const [timedOut, setTimedOut] = useState(false);
  const [adaptiveLevel, setAdaptiveLevel] = useState<1 | 2 | 3 | 4>(2);
  const [adaptiveStreak, setAdaptiveStreak] = useState(0);

  const startQuiz = (lvl: DifficultySelection, sourceOverride?: 'curated' | 'generated') => {
    const src = sourceOverride ?? practiceSource;
    let pool: QuizQuestion[];

    if (lvl === 'daily') {
      pool = [dailyQuestion];
    } else if (lvl === 'mock') {
      pool = generateMockTest(12);
    } else if (lvl === 'adaptive') {
      setAdaptiveLevel(2);
      setAdaptiveStreak(0);
      pool = [generatePracticeProblem(2, Date.now())];
    } else if (typeof lvl === 'string' && lvl.startsWith('topic:')) {
      const topic = lvl.slice(6) as AssessmentTopic;
      pool = generateTopicSession(topic, 8);
    } else if (src === 'generated') {
      pool = generatePracticeSession(lvl as 1 | 2 | 3 | 4 | 'mixed', 10);
    } else if (lvl === 'mixed') {
      pool = shuffleQuestions(QUIZ_BANK).slice(0, 10);
    } else {
      pool = QUIZ_BANK.filter((q) => q.level === lvl);
    }

    setSelectedLevel(lvl);
    setSessionQuestions(pool);
    setCurrentIdx(0);
    setSelectedOption(null);
    setShortInput('');
    setShortSubmitted(false);
    setResultsMap({});
    setFinished(false);
    setTimedOut(false);
    setSecondsLeft(MOCK_DURATION_SECONDS);
    triggerHaptic(hapticsEnabled, 10);
  };

  useEffect(() => {
    if (initialLevel) {
      startQuiz(initialLevel, 'generated');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLevel]);

  useEffect(() => {
    if (selectedLevel !== 'mock' || finished) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setTimedOut(true);
          setFinished(true);
          onCompleteMock?.();
          triggerHaptic(hapticsEnabled, [30, 40, 30]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel, finished]);

  const currentQuestion = sessionQuestions[currentIdx];

  const score = useMemo(() => {
    return sessionQuestions.reduce((acc, q) => acc + (resultsMap[q.id] ? 1 : 0), 0);
  }, [sessionQuestions, resultsMap]);

  const finalizeQuestionOutcome = (isRight: boolean, userResponse?: string) => {
    if (!currentQuestion) return;
    setResultsMap((prev) => ({ ...prev, [currentQuestion.id]: isRight }));
    triggerHaptic(hapticsEnabled, isRight ? 14 : [18, 30, 18]);

    onRecordAttempt({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      questionId: currentQuestion.id,
      category: currentQuestion.category,
      level: currentQuestion.level,
      correct: isRight,
      isDailyChallenge: selectedLevel === 'daily',
      isMockTest: selectedLevel === 'mock',
      userResponse,
      timestamp: Date.now(),
    });

    if (selectedLevel === 'daily') onCompleteDaily(todayKey);

    if (selectedLevel === 'adaptive') {
      if (isRight) {
        const nextStreak = adaptiveStreak + 1;
        if (nextStreak >= 2 && adaptiveLevel < 4) {
          setAdaptiveLevel((lv) => Math.min(4, lv + 1) as 1 | 2 | 3 | 4);
          setAdaptiveStreak(0);
        } else {
          setAdaptiveStreak(nextStreak);
        }
      } else {
        setAdaptiveStreak(0);
        setAdaptiveLevel((lv) => Math.max(1, lv - 1) as 1 | 2 | 3 | 4);
      }
    }
  };

  const handleSelectOption = (idx: number) => {
    if (!currentQuestion || selectedOption !== null) return;
    setSelectedOption(idx);
    finalizeQuestionOutcome(idx === currentQuestion.correctIndex, currentQuestion.optionsLatex[idx]);
  };

  const handleSubmitShortAnswer = () => {
    if (!currentQuestion || shortSubmitted || !shortInput.trim()) return;
    setShortSubmitted(true);
    const isRight = checkShortAnswer(currentQuestion, shortInput);
    finalizeQuestionOutcome(isRight, shortInput.trim());
  };

  const totalTargetCount = selectedLevel === 'adaptive' ? 10 : sessionQuestions.length;

  const handleNextOrFinish = () => {
    triggerHaptic(hapticsEnabled, 10);
    if (selectedLevel === 'adaptive') {
      if (sessionQuestions.length < 10) {
        const nextQ = generatePracticeProblem(adaptiveLevel, Date.now() + (currentIdx + 1) * 7919);
        setSessionQuestions((prev) => [...prev, nextQ]);
        setCurrentIdx((i) => i + 1);
        setSelectedOption(null);
        setShortInput('');
        setShortSubmitted(false);
      } else {
        setFinished(true);
      }
      return;
    }

    if (currentIdx + 1 < sessionQuestions.length) {
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      setShortInput('');
      setShortSubmitted(false);
    } else {
      if (selectedLevel === 'mock') onCompleteMock?.();
      setFinished(true);
    }
  };

  const sessionLabel = useMemo(() => {
    if (!selectedLevel) return '';
    if (selectedLevel === 'daily') return 'Daily Challenge';
    if (selectedLevel === 'mixed') return 'Mixed Challenge';
    if (selectedLevel === 'mock') return 'Timed Mock Test (10 min)';
    if (selectedLevel === 'adaptive') return `Adaptive Practice (Level ${adaptiveLevel})`;
    if (typeof selectedLevel === 'string' && selectedLevel.startsWith('topic:')) {
      return `Topic Assessment · ${selectedLevel.slice(6)}`;
    }
    return QUIZ_LEVELS[(selectedLevel as number) - 1].name;
  }, [selectedLevel, adaptiveLevel]);

  if (!selectedLevel) {
    const totalAttempts = quizAttempts.length;
    const totalCorrect = quizAttempts.filter((a) => a.correct).length;
    const overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#2F7CF6]/30 bg-white dark:bg-[#191C24] p-5 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#2F7CF6]">
                <Calendar className="w-4 h-4" />
                <span>Daily Challenge · {todayKey}</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {dailyQuestion.category} ({dailyQuestion.difficultyTier ?? `Level ${dailyQuestion.level}`})
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isDailyDone
                  ? 'Today’s challenge is complete. Review or retry anytime.'
                  : 'Solve today’s deterministic problem to extend your daily streak.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => startQuiz('daily')}
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 ${
                isDailyDone
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#2F7CF6] hover:bg-[#256AE0] text-white'
              }`}
            >
              {isDailyDone ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              <span>{isDailyDone ? 'Completed Today' : 'Solve Daily Challenge'}</span>
            </button>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-white dark:bg-[#191C24] p-5 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                <span>Timed Mock Exam · 10:00</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                12-Question University Mock Test
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Mixed MCQ and short-answer problems covering limits, calculus, optimization, theorems, and linear algebra.
              </p>
            </div>
            <button
              type="button"
              onClick={() => startQuiz('mock')}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              <span>Start Timed Mock Test</span>
            </button>
          </div>
        </div>

        {/* Adaptive Banner */}
        <div className="rounded-2xl border border-emerald-500/30 bg-white dark:bg-[#191C24] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>Adaptive Difficulty Engine · 10 Questions</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Smart Adaptive Practice
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Dynamically scales from Beginner through Advanced as you build accuracy streaks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => startQuiz('adaptive')}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start Adaptive Mode</span>
          </button>
        </div>

        {/* Topic-Wise Assessments */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-[#2F7CF6]" />
              Topic-Wise Practice & Assessments (8 Questions)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select any topic below to practice MCQ and short-answer problems with immediate derivations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {ASSESSMENT_TOPICS.map((topic) => {
              const tAttempts = quizAttempts.filter((a) => a.category === topic);
              const tAcc =
                tAttempts.length > 0
                  ? Math.round((tAttempts.filter((a) => a.correct).length / tAttempts.length) * 100)
                  : null;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => startQuiz(`topic:${topic}`)}
                  className="text-left rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6] p-3.5 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {topic}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                      {tAcc !== null ? `${tAcc}% accuracy (${tAttempts.length})` : 'Not assessed yet'}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#2F7CF6] shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Practice by Difficulty Level */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Practice by Difficulty Tier
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Choose curated curriculum questions (including short-answer) or procedurally generated sets.
              </p>
            </div>

            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#111319] border border-slate-200 dark:border-white/10 self-start">
              <button
                type="button"
                onClick={() => setPracticeSource('curated')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  practiceSource === 'curated' ? 'bg-[#2F7CF6] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Curated Bank
              </button>
              <button
                type="button"
                onClick={() => setPracticeSource('generated')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  practiceSource === 'generated' ? 'bg-[#2F7CF6] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Dices className="w-3.5 h-3.5" />
                Generated
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUIZ_LEVELS.map((lvl) => {
              const lvlAttempts = quizAttempts.filter((a) => a.level === lvl.level);
              const lvlAcc =
                lvlAttempts.length > 0
                  ? Math.round((lvlAttempts.filter((a) => a.correct).length / lvlAttempts.length) * 100)
                  : null;
              return (
                <button
                  key={lvl.level}
                  type="button"
                  onClick={() => startQuiz(lvl.level)}
                  className="group text-left rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6] p-5 transition-colors flex flex-col justify-between min-h-[136px]"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>{lvl.tier} · Level {lvl.level}</span>
                      <span className="tabular-nums">
                        {lvlAcc !== null ? `${lvlAcc}% accuracy` : 'Practice'}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-white group-hover:text-[#2F7CF6] transition-colors">
                      {lvl.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{lvl.subtitle}</p>
                  </div>
                  <div className="mt-4 flex items-center text-xs font-medium text-[#2F7CF6]">
                    <span>{practiceSource === 'generated' ? 'Generate 10 Problems' : 'Start Session'}</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => startQuiz('mixed')}
            className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6] p-4 flex items-center justify-between transition-colors"
          >
            <div className="text-left">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Mixed Mastery Practice ({practiceSource === 'generated' ? 'Dynamic' : 'Curated'})
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                10 problems spanning Beginner, Intermediate, and Advanced topics
              </div>
            </div>
            <span className="px-4 py-2 rounded-xl bg-[#2F7CF6] text-white text-xs font-semibold whitespace-nowrap shrink-0">
              Start Mixed
            </span>
          </button>

          {totalAttempts > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>
                  Practice History: {totalCorrect} / {totalAttempts} correct ({overallAccuracy}%)
                </span>
                <button
                  type="button"
                  onClick={() => setShowHistory((s) => !s)}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#2F7CF6] hover:underline"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>{showHistory ? 'Hide Recent Attempts' : 'View Practice History'}</span>
                </button>
              </div>

              {showHistory && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#12141B] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                      <tr>
                        <th className="py-2 px-3 font-medium">Topic</th>
                        <th className="py-2 px-3 font-medium">Level</th>
                        <th className="py-2 px-3 font-medium">Result</th>
                        <th className="py-2 px-3 font-medium text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                      {quizAttempts.slice(0, 15).map((att) => (
                        <tr key={att.id} className="text-slate-700 dark:text-slate-300">
                          <td className="py-2 px-3 font-medium">{att.category}</td>
                          <td className="py-2 px-3 tabular-nums">L{att.level}</td>
                          <td
                            className={`py-2 px-3 font-semibold ${
                              att.correct
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {att.correct ? 'Correct' : 'Incorrect'}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-500">
                            {new Date(att.timestamp).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((score / sessionQuestions.length) * 100);
    const timeUsed = MOCK_DURATION_SECONDS - secondsLeft;
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#2F7CF6]/15 text-[#2F7CF6] flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {sessionLabel}
              {selectedLevel === 'mock' &&
                ` · ${timedOut ? 'Time Expired' : `Completed in ${formatTimer(timeUsed)}`}`}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {score} / {sessionQuestions.length} Correct ({pct}%)
            </h2>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-200 dark:border-white/10 pt-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Question Review
          </h3>
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {sessionQuestions.map((q, idx) => {
              const isRight = resultsMap[q.id];
              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-3.5 text-sm ${
                    isRight ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Q{idx + 1} · {q.category}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isRight ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isRight ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      {isRight === undefined ? 'Unanswered' : isRight ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 overflow-x-auto">
                    <MathTex tex={q.expressionLatex || q.prompt} />
                  </div>
                  <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 overflow-x-auto">
                    <MathTex tex={`\\text{Solution: } ${q.optionsLatex[q.correctIndex]}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => startQuiz(selectedLevel)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            New Problem Set
          </button>
          <button
            type="button"
            onClick={() => setSelectedLevel(null)}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            Back to Practice Home
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const isShortAnswer = currentQuestion.questionType === 'short-answer';
  const isAnswered = isShortAnswer ? shortSubmitted : selectedOption !== null;
  const isCorrect = !!resultsMap[currentQuestion.id];

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111319] p-5 sm:p-7 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setSelectedLevel(null)}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              ← Practice Home
            </button>
            <span className="tabular-nums font-medium">
              Question {currentIdx + 1} / {totalTargetCount}
            </span>
            {selectedLevel === 'mock' ? (
              <span
                className={`inline-flex items-center gap-1 font-mono font-semibold tabular-nums ${
                  secondsLeft < 60 ? 'text-rose-500' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {formatTimer(secondsLeft)}
              </span>
            ) : (
              <span className="tabular-nums">Score: {score}</span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-medium text-slate-900 dark:text-white text-balance pt-2">
            {currentQuestion.prompt}
          </h2>

          {currentQuestion.expressionLatex && (
            <div className="py-3 text-slate-900 dark:text-white overflow-x-auto">
              <MathTex tex={currentQuestion.expressionLatex} display />
            </div>
          )}

          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {currentQuestion.category} · {currentQuestion.difficultyTier ?? currentQuestion.levelName}
            {isShortAnswer ? ' · Short Answer' : ''}
          </div>
        </div>

        {isShortAnswer ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                disabled={isAnswered}
                value={shortInput}
                onChange={(e) => setShortInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitShortAnswer();
                }}
                placeholder={currentQuestion.answerHint || 'Enter numeric or symbolic answer'}
                className="flex-1 h-12 px-4 rounded-xl border border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-[#191C24] font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
              />
              {!isAnswered && (
                <button
                  type="button"
                  onClick={handleSubmitShortAnswer}
                  disabled={!shortInput.trim()}
                  className="h-12 px-5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] disabled:opacity-40 text-white text-sm font-semibold whitespace-nowrap shrink-0"
                >
                  Check
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {currentQuestion.optionsLatex.map((optLatex, idx) => {
              const isThisSelected = selectedOption === idx;
              const isThisCorrect = idx === currentQuestion.correctIndex;

              let cardClasses =
                'border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#3A3A44]/55 hover:border-[#2F7CF6]';
              let railClasses = 'border-slate-200 dark:border-white/15';

              if (isAnswered) {
                if (isThisCorrect) {
                  cardClasses = 'border-emerald-500 bg-emerald-500/12 dark:bg-[#0D2E14]';
                  railClasses = 'border-emerald-500/40';
                } else if (isThisSelected && !isThisCorrect) {
                  cardClasses = 'border-rose-500 bg-rose-500/12 dark:bg-[#360E10]';
                  railClasses = 'border-rose-500/40';
                } else {
                  cardClasses =
                    'border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#3A3A44]/40 opacity-75';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full min-h-[72px] rounded-xl border transition-colors flex items-stretch text-left overflow-hidden ${cardClasses}`}
                >
                  <div
                    className={`w-14 sm:w-16 shrink-0 border-r flex items-center justify-center ${railClasses}`}
                  >
                    {isThisSelected ? (
                      <span className="w-6 h-6 rounded-full bg-[#3B82F6] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                      </span>
                    ) : isAnswered && isThisCorrect ? (
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                      </span>
                    ) : null}
                  </div>

                  <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 overflow-x-auto">
                    <div className="mx-auto text-slate-900 dark:text-slate-100">
                      <MathTex tex={optLatex} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {isAnswered && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              isCorrect
                ? 'border-emerald-500/40 bg-emerald-500/5 text-slate-800 dark:text-slate-100'
                : 'border-rose-500/40 bg-rose-500/5 text-slate-800 dark:text-slate-100'
            }`}
          >
            <div className="flex items-center justify-between gap-2 font-semibold text-xs mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                {isCorrect ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Correct Answer</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 text-rose-500" />
                    <span className="text-rose-600 dark:text-rose-400">
                      Incorrect — Solution: {currentQuestion.optionsLatex[currentQuestion.correctIndex]}
                    </span>
                  </>
                )}
              </span>
            </div>
            <div className="overflow-x-auto text-xs sm:text-sm">
              <MathTex tex={currentQuestion.explanationLatex} />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleNextOrFinish}
          disabled={!isAnswered}
          className="w-full h-12 rounded-full bg-[#2F7CF6] hover:bg-[#256AE0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
        >
          {currentIdx + 1 < totalTargetCount ? 'Next Question' : 'Finish'}
        </button>
      </div>
    </div>
  );
}
