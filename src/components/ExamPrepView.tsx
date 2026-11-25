import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  FileDown,
  GraduationCap,
  Play,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { buildExamPaper, EXAM_TOPICS, gradeExamAnswer } from '../data/examBank';
import type { ExamAttempt, ExamQuestion } from '../types';
import { downloadCustomPdfReport } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface ExamPrepViewProps {
  examAttempts: ExamAttempt[];
  onRecordExamAttempt: (attempt: ExamAttempt) => void;
}

type ExamMode = 'topic' | 'mock' | 'aktu';

export function ExamPrepView({ examAttempts, onRecordExamAttempt }: ExamPrepViewProps) {
  const [mode, setMode] = useState<ExamMode>('aktu');
  const [selectedTopic, setSelectedTopic] = useState<string>(EXAM_TOPICS[0]);

  const [sessionPaper, setSessionPaper] = useState<{
    title: string;
    durationMinutes: number;
    questions: ExamQuestion[];
  } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selectedIndex?: number; numericText?: string }>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [submittedAttempt, setSubmittedAttempt] = useState<ExamAttempt | null>(null);

  const startExam = () => {
    const paper = buildExamPaper({ mode, topic: selectedTopic });
    setSessionPaper(paper);
    setCurrentIndex(0);
    setAnswers({});
    setSecondsLeft(paper.durationMinutes * 60);
    setStartedAt(Date.now());
    setSubmittedAttempt(null);
  };

  const handleSubmitExam = () => {
    if (!sessionPaper || submittedAttempt) return;
    let correctCount = 0;
    let scoreMarks = 0;
    let maxMarks = 0;
    const topicBreakdown: Record<string, { total: number; correct: number }> = {};

    for (const q of sessionPaper.questions) {
      maxMarks += q.marks;
      const resp = answers[q.id] ?? {};
      const ok = gradeExamAnswer(q, resp);
      if (ok) {
        correctCount += 1;
        scoreMarks += q.marks;
      }
      const cur = topicBreakdown[q.topic] ?? { total: 0, correct: 0 };
      cur.total += 1;
      if (ok) cur.correct += 1;
      topicBreakdown[q.topic] = cur;
    }

    const attempt: ExamAttempt = {
      id: `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode,
      title: sessionPaper.title,
      topic: mode === 'topic' ? selectedTopic : 'Comprehensive',
      totalQuestions: sessionPaper.questions.length,
      correctCount,
      scoreMarks,
      maxMarks,
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      timestamp: Date.now(),
      topicBreakdown,
    };
    setSubmittedAttempt(attempt);
    onRecordExamAttempt(attempt);
  };

  useEffect(() => {
    if (!sessionPaper || submittedAttempt) return;
    if (secondsLeft <= 0) {
      handleSubmitExam();
      return;
    }
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPaper, submittedAttempt, secondsLeft]);

  const analytics = useMemo(() => {
    if (examAttempts.length === 0) return null;
    const totalPct =
      examAttempts.reduce((acc, a) => acc + (a.scoreMarks / Math.max(1, a.maxMarks)) * 100, 0) /
      examAttempts.length;
    const topicTotals = new Map<string, { total: number; correct: number }>();
    for (const att of examAttempts) {
      for (const [topic, stats] of Object.entries(att.topicBreakdown)) {
        const cur = topicTotals.get(topic) ?? { total: 0, correct: 0 };
        cur.total += stats.total;
        cur.correct += stats.correct;
        topicTotals.set(topic, cur);
      }
    }
    return {
      avgPct: Math.round(totalPct),
      totalAttempts: examAttempts.length,
      topics: Array.from(topicTotals.entries()).map(([topic, s]) => ({
        topic,
        pct: Math.round((s.correct / Math.max(1, s.total)) * 100),
        correct: s.correct,
        total: s.total,
      })),
    };
  }, [examAttempts]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const activeQuestion = sessionPaper?.questions[currentIndex];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#2F7CF6]" />
              Exam Preparation Center
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Timed Engineering Mathematics assessments across Topic-Wise Exams, Comprehensive Mock Tests, and AKTU-Pattern Sample Sections (Sections A, B &amp; C).
            </p>
          </div>

          <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 shrink-0">
            Sample &amp; AKTU-Pattern Practice Questions (curated study problems, not official PYQs)
          </div>
        </div>

        {!sessionPaper && (
          <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  {
                    id: 'aktu',
                    title: 'AKTU-Style Exam Mode',
                    desc: 'Structured into Section A (2M), Section B (7M), and Section C (10M) sample problems.',
                  },
                  {
                    id: 'mock',
                    title: 'Engineering Math Mock Test',
                    desc: 'Balanced 12-question timed mock across all 6 university math subjects.',
                  },
                  {
                    id: 'topic',
                    title: 'Topic-Wise Practice Exam',
                    desc: 'Focused assessment targeting one selected subject area.',
                  },
                ] as const
              ).map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setMode(card.id)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    mode === card.id
                      ? 'border-[#2F7CF6] bg-[#2F7CF6]/10'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E]'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {card.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{card.desc}</div>
                </button>
              ))}
            </div>

            {mode === 'topic' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Select Topic:
                </span>
                {EXAM_TOPICS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTopic(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                      selectedTopic === t
                        ? 'bg-[#2F7CF6] text-white'
                        : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={startExam}
              className="h-11 px-5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>Start Timed Exam</span>
            </button>
          </div>
        )}
      </div>

      {/* Active Exam Runner */}
      {sessionPaper && !submittedAttempt && activeQuestion && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
            <div>
              <div className="text-xs font-semibold text-[#2F7CF6]">
                {activeQuestion.sectionLabel} · {activeQuestion.topic}
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {sessionPaper.title}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#22252E] font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                <Clock className="w-4 h-4 text-[#2F7CF6]" />
                {formatTimer(secondsLeft)}
              </span>
              <button
                type="button"
                onClick={handleSubmitExam}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Submit Exam
              </button>
            </div>
          </div>

          {/* Navigator pills */}
          <div className="flex flex-wrap gap-1.5">
            {sessionPaper.questions.map((q, idx) => {
              const answered =
                q.questionType === 'mcq'
                  ? answers[q.id]?.selectedIndex !== undefined
                  : Boolean(answers[q.id]?.numericText?.trim());
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-mono font-semibold ${
                    idx === currentIndex
                      ? 'bg-[#2F7CF6] text-white'
                      : answered
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Question Body */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Question {currentIndex + 1} of {sessionPaper.questions.length}
              </span>
              <span>{activeQuestion.sourceLabel} · {activeQuestion.marks} Marks</span>
            </div>
            <p className="text-base font-medium text-slate-900 dark:text-white">
              {activeQuestion.prompt}
            </p>
            <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
              <MathTex tex={activeQuestion.expressionLatex} display />
            </div>

            {activeQuestion.questionType === 'mcq' && activeQuestion.optionsLatex ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeQuestion.optionsLatex.map((opt, oIdx) => {
                  const selected = answers[activeQuestion.id]?.selectedIndex === oIdx;
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [activeQuestion.id]: { selectedIndex: oIdx },
                        }))
                      }
                      className={`p-3.5 rounded-xl border text-left transition-colors ${
                        selected
                          ? 'border-[#2F7CF6] bg-[#2F7CF6]/15'
                          : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6]/60'
                      }`}
                    >
                      <div className="text-sm text-slate-900 dark:text-white overflow-x-auto">
                        <MathTex tex={opt} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Enter Numerical Answer (tolerance ±{activeQuestion.tolerance ?? 0.05})
                </label>
                <input
                  type="text"
                  value={answers[activeQuestion.id]?.numericText ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [activeQuestion.id]: { numericText: e.target.value },
                    }))
                  }
                  placeholder="e.g. 12.8"
                  className="mt-1 w-full max-w-xs h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-3">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium disabled:opacity-40"
              >
                Previous
              </button>
              {currentIndex < sessionPaper.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  className="h-9 px-4 rounded-xl bg-[#2F7CF6] text-white text-xs font-semibold"
                >
                  Next Question
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitExam}
                  className="h-9 px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                >
                  Finish &amp; Grade
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Graded Exam Review */}
      {sessionPaper && submittedAttempt && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-500" />
                Exam Graded: {submittedAttempt.scoreMarks} / {submittedAttempt.maxMarks} Marks (
                {Math.round((submittedAttempt.scoreMarks / Math.max(1, submittedAttempt.maxMarks)) * 100)}
                %)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {submittedAttempt.correctCount}/{submittedAttempt.totalQuestions} questions correct ·
                Completed in {submittedAttempt.durationSeconds}s
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadCustomPdfReport({
                    title: submittedAttempt.title,
                    items: sessionPaper.questions.map((q, idx) => {
                      const ok = gradeExamAnswer(q, answers[q.id] ?? {});
                      return {
                        heading: `Q${idx + 1} (${q.topic}, ${q.marks}M) — ${ok ? 'Correct' : 'Incorrect'}`,
                        plainText: q.prompt,
                        latex: q.explanationLatex,
                      };
                    }),
                  })
                }
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium inline-flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download Report PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSessionPaper(null);
                  setSubmittedAttempt(null);
                }}
                className="h-9 px-4 rounded-xl bg-[#2F7CF6] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Exam</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {sessionPaper.questions.map((q, idx) => {
              const ok = gradeExamAnswer(q, answers[q.id] ?? {});
              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-4 space-y-2 ${
                    ok
                      ? 'border-emerald-500/35 bg-emerald-500/5'
                      : 'border-rose-500/35 bg-rose-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Q{idx + 1} · {q.sectionLabel} · {q.topic}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        ok ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {ok ? `+${q.marks} Marks` : '0 Marks'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-900 dark:text-white">{q.prompt}</div>
                  <div className="rounded-lg bg-white/70 dark:bg-[#12141B] p-2.5 overflow-x-auto">
                    <MathTex tex={q.explanationLatex} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance Analytics & Attempt History */}
      {!sessionPaper && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Topic Performance Analytics ({analytics.totalAttempts} Exams, Avg {analytics.avgPct}%)
            </h3>
            <div className="space-y-2.5">
              {analytics.topics.map((t) => (
                <div key={t.topic} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-700 dark:text-slate-200">{t.topic}</span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {t.pct}% ({t.correct}/{t.total})
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div
                      style={{ width: `${t.pct}%` }}
                      className={`h-full rounded-full ${t.pct >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent Exam Attempts
            </h3>
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {examAttempts.map((att) => (
                <div
                  key={att.id}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {att.title}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                      {new Date(att.timestamp).toLocaleString()} · {att.correctCount}/{att.totalQuestions} correct
                    </div>
                  </div>
                  <div className="font-mono font-bold text-[#2F7CF6] shrink-0 tabular-nums">
                    {att.scoreMarks}/{att.maxMarks}
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
