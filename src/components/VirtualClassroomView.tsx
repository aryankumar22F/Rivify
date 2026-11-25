import { useEffect, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, GraduationCap, Play } from 'lucide-react';
import { CLASSROOM_LESSONS, type ClassroomLesson } from '../data/classroomAndPapers';
import type { AppSettings, ClassroomLessonProgress } from '../types';
import { MathTex } from './MathTex';

interface VirtualClassroomViewProps {
  settings: AppSettings;
  progressMap: Record<string, ClassroomLessonProgress>;
  onUpdateProgress: (lessonId: string, progress: ClassroomLessonProgress) => void;
}

export function VirtualClassroomView({
  settings,
  progressMap,
  onUpdateProgress,
}: VirtualClassroomViewProps) {
  const [selectedId, setSelectedId] = useState<string>(CLASSROOM_LESSONS[0].id);
  const lesson: ClassroomLesson =
    CLASSROOM_LESSONS.find((l) => l.id === selectedId) ?? CLASSROOM_LESSONS[0];

  const [demoParam, setDemoParam] = useState<number>(lesson.interactiveDemo.defaultVal);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setDemoParam(lesson.interactiveDemo.defaultVal);
    setAnswers({});
  }, [lesson]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const dark = settings.theme === 'dark';
    ctx.fillStyle = dark ? '#11151E' : '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    // Axes
    ctx.strokeStyle = dark ? 'rgba(148,163,184,0.3)' : 'rgba(15,23,42,0.25)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(28, h / 2);
    ctx.lineTo(w - 28, h / 2);
    ctx.moveTo(w / 2, 20);
    ctx.lineTo(w / 2, h - 20);
    ctx.stroke();

    const kind = lesson.interactiveDemo.kind;
    if (kind === 'sine-fourier') {
      const N = Math.max(1, Math.round(demoParam));
      ctx.strokeStyle = '#2F7CF6';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let px = 28; px <= w - 28; px++) {
        const t = ((px - 28) / (w - 56)) * Math.PI * 2 - Math.PI;
        let sum = 0;
        for (let k = 0; k < N; k++) {
          const odd = 2 * k + 1;
          sum += Math.sin(odd * t) / odd;
        }
        const yVal = (4 / Math.PI) * sum;
        const py = h / 2 - yVal * (h * 0.28);
        if (px === 28) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (kind === 'damped-ode') {
      const zeta = demoParam;
      const w0 = 3;
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let px = 28; px <= w - 28; px++) {
        const t = ((px - 28) / (w - 56)) * 5;
        let y = 0;
        if (zeta < 1) {
          const wd = w0 * Math.sqrt(1 - zeta * zeta);
          y = Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
        } else if (Math.abs(zeta - 1) < 1e-3) {
          y = Math.exp(-w0 * t) * (1 + w0 * t);
        } else {
          const s = Math.sqrt(zeta * zeta - 1);
          const r1 = w0 * (-zeta + s);
          const r2 = w0 * (-zeta - s);
          const c1 = -r2 / (r1 - r2);
          const c2 = r1 / (r1 - r2);
          y = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
        }
        const py = h / 2 - y * (h * 0.32);
        if (px === 28) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (kind === 'conic-eccentricity') {
      const k = Math.max(0.2, demoParam);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.4;
      for (const c of [1.5, 3.0, 5.0]) {
        const rx = Math.sqrt(c) * 48;
        const ry = Math.sqrt(c / k) * 48;
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Draw steepest gradient vector at 45 deg point
      const gx = 1;
      const gy = k;
      const mag = Math.hypot(gx, gy);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(w / 2 + 40, h / 2 - 40);
      ctx.lineTo(w / 2 + 40 + (gx / mag) * 42, h / 2 - 40 - (gy / mag) * 42);
      ctx.stroke();
    } else {
      // eigen-scale: unit square under [[2, k], [0, 1.4]]
      const k = demoParam;
      const scale = 36;
      const pts = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ].map(([x, y]) => ({
        sx: w / 2 + (2 * x + k * y) * scale,
        sy: h / 2 - 1.4 * y * scale,
      }));
      ctx.fillStyle = 'rgba(47, 124, 246, 0.25)';
      ctx.strokeStyle = '#2F7CF6';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }, [lesson, demoParam, settings.theme]);

  const completedCount = Object.values(progressMap).filter((p) => p.completed).length;

  const handleCompleteCheck = () => {
    const total = lesson.knowledgeCheck.length;
    const correct = lesson.knowledgeCheck.filter((q, idx) => answers[idx] === q.correctIndex).length;
    onUpdateProgress(lesson.id, {
      completed: true,
      quizScore: Math.round((correct / Math.max(1, total)) * 100),
      lastViewedAt: Date.now(),
    });
  };

  const curProg = progressMap[lesson.id];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#2F7CF6]" />
            Virtual Mathematics Classroom
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Structured engineering modules combining formal theory, worked examples, live parameter simulations, and mastery checks.
          </p>
        </div>
        <div className="text-xs font-semibold text-[#2F7CF6] tabular-nums shrink-0">
          {completedCount} / {CLASSROOM_LESSONS.length} Lessons Completed
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Curriculum Sidebar */}
        <div className="lg:col-span-4 space-y-2.5">
          {CLASSROOM_LESSONS.map((item, idx) => {
            const prog = progressMap[item.id];
            const active = item.id === lesson.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left rounded-2xl border p-4 space-y-1.5 transition-colors ${
                  active
                    ? 'border-[#2F7CF6] bg-[#2F7CF6]/10'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] hover:border-[#2F7CF6]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-[#2F7CF6]">
                    Module {idx + 1} · {item.track}
                  </span>
                  {prog?.completed ? (
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Done
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      {item.durationMinutes}m
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {item.title}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Lesson Body */}
        <div className="lg:col-span-8 space-y-5">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#2F7CF6]">{lesson.track}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Est. {lesson.durationMinutes} mins
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{lesson.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {lesson.summary}
            </p>

            {/* Core Concepts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {lesson.conceptsLatex.map((c) => (
                <div
                  key={c.heading}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-2"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#2F7CF6]" />
                    {c.heading}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{c.explanation}</p>
                  <div className="overflow-x-auto text-slate-900 dark:text-white">
                    <MathTex tex={c.latex} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Simulation */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-[#2F7CF6]" />
                Interactive Demo: {lesson.interactiveDemo.title}
              </span>
              <span className="text-xs font-mono text-[#2F7CF6] tabular-nums">
                {lesson.interactiveDemo.paramLabel} = {demoParam}
              </span>
            </div>
            <input
              type="range"
              min={lesson.interactiveDemo.min}
              max={lesson.interactiveDemo.max}
              step={lesson.interactiveDemo.step}
              value={demoParam}
              onChange={(e) => setDemoParam(Number(e.target.value))}
              className="w-full accent-[#2F7CF6]"
            />
            <canvas ref={canvasRef} width={720} height={240} className="w-full h-56 rounded-xl" />
          </div>

          {/* Worked Example */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#2F7CF6]">
              Worked Example
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {lesson.workedExample.problem}
            </div>
            <div className="space-y-2">
              {lesson.workedExample.steps.map((st, idx) => (
                <div
                  key={st.label}
                  className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3 space-y-1 text-xs"
                >
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {idx + 1}. {st.label}
                  </div>
                  <div className="overflow-x-auto text-slate-900 dark:text-white">
                    <MathTex tex={st.latex} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3 text-slate-900 dark:text-white overflow-x-auto">
              <MathTex tex={lesson.workedExample.answerLatex} />
            </div>
          </div>

          {/* Knowledge Check */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Knowledge Check
              </h4>
              {curProg?.completed && (
                <span className="text-xs font-semibold text-emerald-500 tabular-nums">
                  Recorded Score: {curProg.quizScore ?? 100}%
                </span>
              )}
            </div>

            {lesson.knowledgeCheck.map((q, qIdx) => {
              const picked = answers[qIdx];
              const answered = picked !== undefined;
              return (
                <div
                  key={qIdx}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 space-y-2.5"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    {qIdx + 1}. {q.prompt}
                  </div>
                  <div className="overflow-x-auto text-slate-900 dark:text-white">
                    <MathTex tex={q.expressionLatex} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oIdx) => {
                      const isSel = picked === oIdx;
                      const isCorr = q.correctIndex === oIdx;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                          className={`text-left px-3 py-2 rounded-xl border text-xs transition-colors ${
                            answered
                              ? isCorr
                                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 font-semibold'
                                : isSel
                                ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-200'
                                : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                              : 'border-slate-200 dark:border-white/15 bg-white dark:bg-[#191C24] text-slate-800 dark:text-slate-200 hover:border-[#2F7CF6]'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {answered && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">{q.explanation}</p>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleCompleteCheck}
              className="px-4 py-2.5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold"
            >
              Mark Lesson Complete &amp; Save Score
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
