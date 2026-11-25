import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Circle,
  Eraser,
  FileDown,
  Grid,
  Highlighter,
  ImageDown,
  Minus,
  PenTool,
  Plus,
  Redo2,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import type { AppSettings, WhiteboardAnnotation, WhiteboardSession } from '../types';
import { downloadImagePdf, triggerHaptic } from '../utils/pdfReport';
import { ClearAllActionButton } from './ActionButtons';
import { MathTex } from './MathTex';

interface MathWhiteboardViewProps {
  settings: AppSettings;
  sessions: WhiteboardSession[];
  onSaveSession: (session: WhiteboardSession) => void;
  onDeleteSession: (id: string) => void;
}

type ToolKind = 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle' | 'label';
type BgKind = WhiteboardSession['background'];

interface DrawAction {
  kind: 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle' | 'axes';
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

const COLORS = ['#2F7CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#FFFFFF', '#0F172A'];

function getBgPalette(bg: BgKind) {
  if (bg === 'white') {
    return { fill: '#FFFFFF', grid: 'rgba(15, 23, 42, 0.08)', axis: 'rgba(15, 23, 42, 0.35)', text: '#0F172A' };
  }
  if (bg === 'blueprint') {
    return { fill: '#0B1E3D', grid: 'rgba(56, 189, 248, 0.16)', axis: 'rgba(56, 189, 248, 0.5)', text: '#E0F2FE' };
  }
  if (bg === 'grid') {
    return { fill: '#141821', grid: 'rgba(148, 163, 184, 0.14)', axis: 'rgba(148, 163, 184, 0.45)', text: '#F8FAFC' };
  }
  return { fill: '#12151C', grid: 'transparent', axis: 'rgba(148, 163, 184, 0.35)', text: '#F8FAFC' };
}

function drawActionOnContext(ctx: CanvasRenderingContext2D, act: DrawAction, bgFill: string) {
  if (act.points.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (act.kind === 'axes') {
    const p = act.points[0];
    const span = 120;
    ctx.strokeStyle = act.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - span, p.y);
    ctx.lineTo(p.x + span, p.y);
    ctx.moveTo(p.x, p.y - span);
    ctx.lineTo(p.x, p.y + span);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (act.kind === 'highlighter') {
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = act.color;
    ctx.lineWidth = act.width * 3;
  } else if (act.kind === 'eraser') {
    ctx.strokeStyle = bgFill;
    ctx.lineWidth = act.width * 3.5;
  } else {
    ctx.strokeStyle = act.color;
    ctx.lineWidth = act.width;
  }

  const p0 = act.points[0];
  const pLast = act.points[act.points.length - 1];

  if (act.kind === 'pen' || act.kind === 'highlighter' || act.kind === 'eraser') {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    if (act.points.length === 1) {
      ctx.lineTo(p0.x + 0.1, p0.y + 0.1);
    } else {
      for (let i = 1; i < act.points.length; i++) {
        ctx.lineTo(act.points[i].x, act.points[i].y);
      }
    }
    ctx.stroke();
  } else if (act.kind === 'line' || act.kind === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(pLast.x, pLast.y);
    ctx.stroke();
    if (act.kind === 'arrow') {
      const ang = Math.atan2(pLast.y - p0.y, pLast.x - p0.x);
      const head = 10 + act.width;
      ctx.fillStyle = act.color;
      ctx.beginPath();
      ctx.moveTo(pLast.x, pLast.y);
      ctx.lineTo(pLast.x - head * Math.cos(ang - 0.45), pLast.y - head * Math.sin(ang - 0.45));
      ctx.lineTo(pLast.x - head * Math.cos(ang + 0.45), pLast.y - head * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
    }
  } else if (act.kind === 'rect') {
    ctx.strokeRect(p0.x, p0.y, pLast.x - p0.x, pLast.y - p0.y);
  } else if (act.kind === 'circle') {
    const r = Math.hypot(pLast.x - p0.x, pLast.y - p0.y);
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function MathWhiteboardView({
  settings,
  sessions,
  onSaveSession,
  onDeleteSession,
}: MathWhiteboardViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled Derivation Board');
  const [background, setBackground] = useState<BgKind>('grid');
  const [tool, setTool] = useState<ToolKind>('pen');
  const [color, setColor] = useState('#2F7CF6');
  const [strokeWidth, setStrokeWidth] = useState(3);

  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
  const [annotations, setAnnotations] = useState<WhiteboardAnnotation[]>([]);

  const [labelText, setLabelText] = useState('\\nabla f = \\langle f_x, f_y \\rangle');
  const [labelIsLatex, setLabelIsLatex] = useState(true);
  const [savedNotice, setSavedNotice] = useState(false);
  const [clearedBoardNotice, setClearedBoardNotice] = useState(false);
  const clearTimerRef = useRef<number | null>(null);

  const draftRef = useRef<DrawAction | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const renderCanvas = (previewAction?: DrawAction | null, includeAnnotations = false, targetCanvas?: HTMLCanvasElement) => {
    const canvas = targetCanvas ?? canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const pal = getBgPalette(background);

    ctx.fillStyle = pal.fill;
    ctx.fillRect(0, 0, w, h);

    if (background === 'grid' || background === 'blueprint' || background === 'white') {
      ctx.strokeStyle = pal.grid;
      ctx.lineWidth = 1;
      const step = 28;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    for (const act of actions) {
      drawActionOnContext(ctx, act, pal.fill);
    }
    if (previewAction) {
      drawActionOnContext(ctx, previewAction, pal.fill);
    }

    if (includeAnnotations) {
      ctx.font = '600 14px JetBrains Mono, monospace';
      for (const ann of annotations) {
        ctx.fillStyle = ann.color;
        ctx.fillText(ann.text, ann.x, ann.y);
      }
    }
  };

  useEffect(() => {
    renderCanvas(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, background]);

  const getRelativeCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      normX: ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100,
      normY: ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getRelativeCoords(e);
    if (tool === 'label') {
      if (!labelText.trim()) return;
      const nextAnn: WhiteboardAnnotation = {
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        x: pt.normX,
        y: pt.normY,
        text: labelText.trim(),
        isLatex: labelIsLatex,
        color,
      };
      setAnnotations((prev) => [...prev, nextAnn]);
      triggerHaptic(settings.hapticsEnabled, 8);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    draftRef.current = {
      kind: tool,
      color,
      width: strokeWidth,
      points: [{ x: pt.x, y: pt.y }],
    };
    renderCanvas(draftRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draftRef.current) return;
    const pt = getRelativeCoords(e);
    if (
      draftRef.current.kind === 'pen' ||
      draftRef.current.kind === 'highlighter' ||
      draftRef.current.kind === 'eraser'
    ) {
      draftRef.current.points.push({ x: pt.x, y: pt.y });
    } else {
      draftRef.current.points = [draftRef.current.points[0], { x: pt.x, y: pt.y }];
    }
    renderCanvas(draftRef.current);
  };

  const handlePointerUp = () => {
    if (!draftRef.current) return;
    const finished = draftRef.current;
    draftRef.current = null;
    setActions((prev) => [...prev, finished]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (actions.length === 0) return;
    const last = actions[actions.length - 1];
    setActions((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setActions((prev) => [...prev, next]);
  };

  const handleClear = () => {
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    triggerHaptic(settings.hapticsEnabled, 8);
    setActions([]);
    setRedoStack([]);
    setAnnotations([]);
    setClearedBoardNotice(true);
    clearTimerRef.current = window.setTimeout(() => setClearedBoardNotice(false), 2000);
  };

  const handleAddAxesStamp = () => {
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / 2 : 480;
    const cy = canvas ? canvas.height / 2 : 260;
    setActions((prev) => [
      ...prev,
      {
        kind: 'axes',
        color: background === 'white' ? '#334155' : '#94A3B8',
        width: 2,
        points: [{ x: cx, y: cy }],
      },
    ]);
    setRedoStack([]);
  };

  const buildSnapshotCanvas = (format: 'image/png' | 'image/jpeg') => {
    const src = canvasRef.current;
    if (!src) return '';
    const off = document.createElement('canvas');
    off.width = src.width;
    off.height = src.height;
    const ctx = off.getContext('2d');
    if (ctx) {
      const pal = getBgPalette(background);
      ctx.fillStyle = pal.fill;
      ctx.fillRect(0, 0, off.width, off.height);
      renderCanvas(null, false, off);
      // Draw annotations in pixel coords on offscreen export canvas
      ctx.font = '600 15px JetBrains Mono, monospace';
      for (const ann of annotations) {
        const px = (ann.x / 100) * off.width;
        const py = (ann.y / 100) * off.height;
        ctx.fillStyle = ann.color;
        ctx.fillText(ann.text, px, py);
      }
    }
    return off.toDataURL(format, 0.92);
  };

  const handleSave = () => {
    triggerHaptic(settings.hapticsEnabled, 10);
    const now = Date.now();
    const id = activeId ?? `wb-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = sessions.find((s) => s.id === id);
    const dataUrl = buildSnapshotCanvas('image/png');
    const session: WhiteboardSession = {
      id,
      title: title.trim() || 'Untitled Derivation Board',
      background,
      dataUrl,
      actionsJson: JSON.stringify(actions),
      annotations,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    setActiveId(id);
    onSaveSession(session);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1600);
  };

  const handleLoadSession = (s: WhiteboardSession) => {
    setActiveId(s.id);
    setTitle(s.title);
    setBackground(s.background);
    setAnnotations(s.annotations ?? []);
    try {
      const parsed = JSON.parse(s.actionsJson) as DrawAction[];
      setActions(Array.isArray(parsed) ? parsed : []);
    } catch {
      setActions([]);
    }
    setRedoStack([]);
  };

  const handleNewBoard = () => {
    setActiveId(null);
    setTitle('New Derivation Board');
    setActions([]);
    setRedoStack([]);
    setAnnotations([]);
  };

  const handleExportPng = () => {
    const url = buildSnapshotCanvas('image/png');
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(title || 'whiteboard').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const jpg = buildSnapshotCanvas('image/jpeg');
    if (!jpg) return;
    downloadImagePdf(
      jpg,
      title || 'RIVIFY Math Whiteboard',
      canvas.width,
      canvas.height,
      `rivify-whiteboard-${Date.now()}.pdf`
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <PenTool className="w-5 h-5 text-[#2F7CF6]" />
              Interactive Math Whiteboard
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Sketch derivations, geometric diagrams, coordinate axes, and KaTeX equation pins on touch or desktop, then export PNG or PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleNewBoard}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              {savedNotice ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savedNotice ? 'Saved' : 'Save Board'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportPng}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              <ImageDown className="w-3.5 h-3.5" />
              PNG
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="h-9 px-3.5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>

        {/* Title & Background controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-6">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Whiteboard session title"
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="md:col-span-6 flex flex-wrap items-center gap-1.5 justify-start md:justify-end">
            {(
              [
                { id: 'grid', label: 'Dark Grid' },
                { id: 'slate', label: 'Dark Slate' },
                { id: 'blueprint', label: 'Blueprint' },
                { id: 'white', label: 'Paper White' },
              ] as const
            ).map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setBackground(bg.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  background === bg.id
                    ? 'bg-[#2F7CF6] text-white'
                    : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                }`}
              >
                {bg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drawing Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'pen', label: 'Pen', icon: PenTool },
                { id: 'highlighter', label: 'Highlight', icon: Highlighter },
                { id: 'eraser', label: 'Eraser', icon: Eraser },
                { id: 'line', label: 'Line', icon: Minus },
                { id: 'arrow', label: 'Vector', icon: ArrowUpRight },
                { id: 'rect', label: 'Box', icon: Square },
                { id: 'circle', label: 'Circle', icon: Circle },
                { id: 'label', label: 'Math Pin', icon: Type },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTool(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                    tool === item.id
                      ? 'bg-[#2F7CF6] text-white'
                      : 'bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleAddAxesStamp}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:border-[#2F7CF6]"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Axes Stamp</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color === c ? 'border-[#2F7CF6] scale-110' : 'border-slate-300 dark:border-white/20'
                  }`}
                />
              ))}
            </div>
            <select
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              aria-label="Stroke width"
              className="h-8 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-xs text-slate-900 dark:text-white"
            >
              <option value={2}>Thin (2px)</option>
              <option value={3}>Medium (3px)</option>
              <option value={6}>Thick (6px)</option>
            </select>
            <button
              type="button"
              onClick={handleUndo}
              disabled={actions.length === 0}
              aria-label="Undo"
              className="p-2 rounded-lg border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300 disabled:opacity-40"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              aria-label="Redo"
              className="p-2 rounded-lg border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300 disabled:opacity-40"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <ClearAllActionButton
              label="Clear"
              clearedLabel="Cleared successfully"
              cleared={clearedBoardNotice}
              variant="danger"
              size="sm"
              ariaLabel="Clear board"
              onClick={handleClear}
            />
          </div>
        </div>

        {tool === 'label' && (
          <div className="rounded-xl border border-[#2F7CF6]/30 bg-[#2F7CF6]/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="text"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="Enter text or LaTeX, then click anywhere on the canvas to place"
              className="flex-1 h-9 px-3 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#191C24] font-mono text-xs text-slate-900 dark:text-white"
            />
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 shrink-0">
              <input
                type="checkbox"
                checked={labelIsLatex}
                onChange={(e) => setLabelIsLatex(e.target.checked)}
                className="accent-[#2F7CF6]"
              />
              Render KaTeX
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
              Click canvas to stamp
            </span>
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] overflow-hidden">
        <div className="relative w-full aspect-[16/9] min-h-[360px]">
          <canvas
            ref={canvasRef}
            width={1120}
            height={630}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full block touch-none cursor-crosshair"
          />
          {annotations.map((ann) => (
            <div
              key={ann.id}
              style={{ left: `${ann.x}%`, top: `${ann.y}%`, color: ann.color }}
              className="absolute -translate-x-1/2 -translate-y-1/2 group px-2 py-1 rounded-lg bg-slate-900/65 backdrop-blur-xs text-xs shadow-sm flex items-center gap-1.5"
            >
              {ann.isLatex ? <MathTex tex={ann.text} /> : <span>{ann.text}</span>}
              <button
                type="button"
                aria-label="Remove annotation"
                onClick={() => setAnnotations((prev) => prev.filter((a) => a.id !== ann.id))}
                className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Saved Whiteboards List */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Saved Whiteboard Sessions ({sessions.length})
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Stored offline in IndexedDB
          </span>
        </div>

        {sessions.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
            No saved whiteboard boards yet. Click &ldquo;Save Board&rdquo; to keep a session for reopening or editing later.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`rounded-xl border p-3 space-y-2 transition-colors ${
                  activeId === s.id
                    ? 'border-[#2F7CF6] bg-[#2F7CF6]/8'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E]'
                }`}
              >
                {s.dataUrl && (
                  <img
                    src={s.dataUrl}
                    alt={s.title}
                    className="w-full h-28 object-cover rounded-lg border border-slate-200 dark:border-white/10"
                  />
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {s.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {new Date(s.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadSession(s)}
                      className="px-2.5 py-1 rounded-lg bg-[#2F7CF6] text-white text-[11px] font-semibold"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${s.title}`}
                      onClick={() => {
                        if (activeId === s.id) setActiveId(null);
                        onDeleteSession(s.id);
                      }}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
