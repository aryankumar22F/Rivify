import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Eraser, Loader2, PenTool, Undo2, X } from 'lucide-react';
import { parseExpression, toLatex, validateExpression } from '../engine/symbolic';
import { MathTex } from './MathTex';

interface HandwritingPadModalProps {
  open: boolean;
  onClose: () => void;
  onInsertExpression: (expr: string) => void;
}

interface StrokePoint {
  x: number;
  y: number;
}

export function HandwritingPadModal({
  open,
  onClose,
  onInsertExpression,
}: HandwritingPadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<StrokePoint[][]>([]);
  const activeStrokeRef = useRef<StrokePoint[]>([]);
  const drawingRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [recognized, setRecognized] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.scale(dpr, dpr);

    // Crisp white inkpad background so OCR contrast is consistently high
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Subtle ruled baseline
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, rect.height / 2);
    ctx.lineTo(rect.width - 16, rect.height / 2);
    ctx.stroke();

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawStroke = (pts: StrokePoint[]) => {
      if (pts.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    };

    for (const s of strokes) {
      drawStroke(s);
    }
  }, [open, strokes]);

  if (!open) return null;

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const pt = getPos(e);
    activeStrokeRef.current = [pt];
    setErrorMsg(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const pt = getPos(e);
    const prev = activeStrokeRef.current[activeStrokeRef.current.length - 1];
    activeStrokeRef.current.push(pt);
    if (ctx && prev) {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (activeStrokeRef.current.length > 0) {
      const completed = [...activeStrokeRef.current];
      setStrokes((prev) => [...prev, completed]);
      activeStrokeRef.current = [];
    }
  };

  const handleRecognize = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0 || loading) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const imageBase64 = canvas.toDataURL('image/png');
      const res = await fetch('/api/assistant/recognize-handwriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = (await res.json()) as { expression?: string; error?: string };
      if (!res.ok || !data.expression) {
        throw new Error(data.error || 'Could not recognize handwritten equation.');
      }
      setRecognized(data.expression);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Handwriting recognition failed.');
    } finally {
      setLoading(false);
    }
  };

  const validation = recognized ? validateExpression(recognized) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="handwriting-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PenTool className="w-5 h-5 text-[#2F7CF6]" />
            <h2 id="handwriting-title" className="text-lg font-semibold text-slate-900 dark:text-white">
              Handwritten Equation Input
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close handwriting pad"
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Write a mathematical expression (for example, <span className="font-mono">2x²y³</span> or{' '}
          <span className="font-mono">sin(xy)</span>) with mouse, touch, or stylus.
        </p>

        <div className="rounded-2xl overflow-hidden border border-slate-300 dark:border-white/20 bg-white">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full h-56 block touch-none cursor-crosshair"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStrokes((prev) => prev.slice(0, -1))}
              disabled={strokes.length === 0}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => {
                setStrokes([]);
                setRecognized('');
                setErrorMsg(null);
              }}
              disabled={strokes.length === 0}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>

          <button
            type="button"
            onClick={handleRecognize}
            disabled={strokes.length === 0 || loading}
            className="h-10 px-4 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
            <span>{loading ? 'Recognizing...' : 'Recognize Equation'}</span>
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {recognized && (
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#12141B] p-4 space-y-3">
            <div className="space-y-1">
              <label htmlFor="ocr-preview" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Recognized Expression (editable before inserting)
              </label>
              <input
                id="ocr-preview"
                type="text"
                value={recognized}
                onChange={(e) => setRecognized(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#191C24] font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
              />
            </div>

            {validation?.valid ? (
              <div className="flex items-center justify-between gap-3">
                <div className="overflow-x-auto text-slate-900 dark:text-white">
                  <MathTex tex={toLatex(parseExpression(recognized))} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onInsertExpression(recognized);
                    onClose();
                  }}
                  className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                >
                  <Check className="w-4 h-4" />
                  Use Expression
                </button>
              </div>
            ) : (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                Syntax check: {validation?.error} — adjust above and insert.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
