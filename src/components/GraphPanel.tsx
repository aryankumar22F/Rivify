import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Move,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Scissors,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { AngleUnit, ToolId } from '../types';
import { differentiate, evaluateAST, parseExpression, simplify, type ExprNode } from '../engine/symbolic';

interface GraphPanelProps {
  tool: ToolId;
  expression: string;
  secondaryExpr?: string;
  derivativeExpr?: string;
  anchorPoint?: { x: number; y: number };
  tangentPlane?: { f0: number; fx0: number; fy0: number; x0: number; y0: number };
  gradientAtAnchor?: { gx: number; gy: number };
  angleUnit: AngleUnit;
  theme: 'dark' | 'light';
}

type ViewMode = '3d' | 'contour' | 'slice';

export function GraphPanel({
  tool,
  expression,
  secondaryExpr,
  derivativeExpr,
  anchorPoint,
  tangentPlane,
  gradientAtAnchor,
  angleUnit,
  theme,
}: GraphPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isVectorField = tool === 'vector-field';

  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [range, setRange] = useState<number>(3);
  const [yaw, setYaw] = useState<number>(0.65);
  const [pitch, setPitch] = useState<number>(0.48);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<'orbit' | 'pan'>('orbit');
  const [showSlices, setShowSlices] = useState<boolean>(true);
  const [showGradOverlay, setShowGradOverlay] = useState<boolean>(true);
  const [animateFlow, setAnimateFlow] = useState<boolean>(true);
  const [probe, setProbe] = useState<{ x: number; y: number; valA: number; valB?: number } | null>(
    null
  );

  const draggingRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const parsed = useMemo(() => {
    try {
      const fAst = parseExpression(expression);
      const qAst = isVectorField && secondaryExpr ? parseExpression(secondaryExpr) : null;
      const dAst = !isVectorField && derivativeExpr ? parseExpression(derivativeExpr) : null;
      const fxAst = !isVectorField ? simplify(differentiate(fAst, 'x')) : null;
      const fyAst = !isVectorField ? simplify(differentiate(fAst, 'y')) : null;
      return { fAst, qAst, dAst, fxAst, fyAst, error: null as string | null };
    } catch (e) {
      return {
        fAst: null as ExprNode | null,
        qAst: null as ExprNode | null,
        dAst: null as ExprNode | null,
        fxAst: null as ExprNode | null,
        fyAst: null as ExprNode | null,
        error: e instanceof Error ? e.message : 'Unable to parse expression',
      };
    }
  }, [expression, secondaryExpr, derivativeExpr, isVectorField]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimateFlow(false);
    }
  }, []);

  // Vector Field animation loop
  useEffect(() => {
    if (!isVectorField || !parsed.fAst || !parsed.qAst) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pAst = parsed.fAst;
    const qAst = parsed.qAst;
    const particles = Array.from({ length: 75 }, () => ({
      x: (Math.random() * 2 - 1) * range,
      y: (Math.random() * 2 - 1) * range,
      life: Math.random() * 60,
    }));

    let rafId = 0;

    const renderFrame = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }
      ctx.save();
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const pad = 32;
      const size = Math.min(w - pad * 2, h - pad * 2);
      const ox = w / 2 + pan.x;
      const oy = h / 2 + pan.y;
      const scale = size / (range * 2);

      const toScreenX = (x: number) => ox + x * scale;
      const toScreenY = (y: number) => oy - y * scale;

      ctx.fillStyle = theme === 'dark' ? '#13161D' : '#F8FAFC';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = theme === 'dark' ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
      ctx.lineWidth = 1;
      const step = range <= 3 ? 1 : range <= 6 ? 2 : 3;
      for (let g = -Math.floor(range); g <= Math.floor(range); g += step) {
        const sx = toScreenX(g);
        const sy = toScreenY(g);
        ctx.beginPath();
        ctx.moveTo(sx, toScreenY(-range));
        ctx.lineTo(sx, toScreenY(range));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(toScreenX(-range), sy);
        ctx.lineTo(toScreenX(range), sy);
        ctx.stroke();
      }

      ctx.strokeStyle = theme === 'dark' ? 'rgba(203,213,225,0.35)' : 'rgba(15,23,42,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(toScreenX(-range), oy);
      ctx.lineTo(toScreenX(range), oy);
      ctx.moveTo(ox, toScreenY(-range));
      ctx.lineTo(ox, toScreenY(range));
      ctx.stroke();

      const gridN = 13;
      const cellSpacing = (range * 2) / gridN;
      const maxArrowPx = (size / gridN) * 0.72;

      for (let i = 0; i <= gridN; i++) {
        for (let j = 0; j <= gridN; j++) {
          const vx = -range + i * cellSpacing;
          const vy = -range + j * cellSpacing;
          let p = 0;
          let q = 0;
          try {
            p = evaluateAST(pAst, { x: vx, y: vy }, angleUnit);
            q = evaluateAST(qAst, { x: vx, y: vy }, angleUnit);
          } catch {
            continue;
          }
          if (!Number.isFinite(p) || !Number.isFinite(q)) continue;
          const mag = Math.hypot(p, q);
          if (mag < 1e-6) continue;

          const normLen = Math.min(1, Math.log1p(mag) / 2.6) * maxArrowPx;
          const dx = (p / mag) * normLen;
          const dy = -(q / mag) * normLen;

          const t = Math.min(1, mag / 5);
          const hue = 215 - t * 175;
          ctx.strokeStyle = `hsla(${hue}, 85%, ${theme === 'dark' ? '64%' : '48%'}, 0.85)`;
          ctx.fillStyle = ctx.strokeStyle;
          ctx.lineWidth = 1.4;

          const sx = toScreenX(vx);
          const sy = toScreenY(vy);
          const ex = sx + dx;
          const ey = sy + dy;

          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          const angle = Math.atan2(dy, dx);
          const head = 4.5;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - head * Math.cos(angle - 0.5), ey - head * Math.sin(angle - 0.5));
          ctx.lineTo(ex - head * Math.cos(angle + 0.5), ey - head * Math.sin(angle + 0.5));
          ctx.closePath();
          ctx.fill();
        }
      }

      if (animateFlow) {
        ctx.fillStyle = theme === 'dark' ? 'rgba(96, 165, 250, 0.85)' : 'rgba(37, 99, 235, 0.85)';
        for (const pt of particles) {
          let p = 0;
          let q = 0;
          try {
            p = evaluateAST(pAst, { x: pt.x, y: pt.y }, angleUnit);
            q = evaluateAST(qAst, { x: pt.x, y: pt.y }, angleUnit);
          } catch {
            pt.life = 100;
          }
          const mag = Math.hypot(p, q);
          if (!Number.isFinite(mag) || mag < 1e-5 || pt.life > 75 || Math.abs(pt.x) > range || Math.abs(pt.y) > range) {
            pt.x = (Math.random() * 2 - 1) * range;
            pt.y = (Math.random() * 2 - 1) * range;
            pt.life = 0;
          } else {
            const dt = (0.028 * range) / Math.max(0.8, mag);
            pt.x += p * dt;
            pt.y += q * dt;
            pt.life += 1;
            ctx.beginPath();
            ctx.arc(toScreenX(pt.x), toScreenY(pt.y), 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (anchorPoint) {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(toScreenX(anchorPoint.x), toScreenY(anchorPoint.y), 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      if (animateFlow) rafId = requestAnimationFrame(renderFrame);
    };

    renderFrame();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isVectorField, parsed, range, pan, animateFlow, theme, angleUnit, anchorPoint]);

  // Scalar 3D / Contour / 1D Slice rendering
  useEffect(() => {
    if (isVectorField || !parsed.fAst) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fAst = parsed.fAst;
    const dAst = parsed.dAst;
    const fxAst = parsed.fxAst;
    const fyAst = parsed.fyAst;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.fillStyle = theme === 'dark' ? '#13161D' : '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    if (viewMode === 'slice') {
      const yFixed = anchorPoint?.y ?? 0;
      const samples = 220;
      const xs: number[] = [];
      const ys: number[] = [];
      const dys: number[] = [];
      let minVal = Infinity;
      let maxVal = -Infinity;

      for (let i = 0; i <= samples; i++) {
        const x = -range + (i / samples) * range * 2;
        xs.push(x);
        let fv = NaN;
        let dv = NaN;
        try {
          fv = evaluateAST(fAst, { x, y: yFixed, z: 0, t: x }, angleUnit);
          if (Number.isFinite(fv) && Math.abs(fv) < 50) {
            minVal = Math.min(minVal, fv);
            maxVal = Math.max(maxVal, fv);
          } else fv = NaN;
        } catch {
          fv = NaN;
        }
        if (dAst) {
          try {
            dv = evaluateAST(dAst, { x, y: yFixed, z: 0, t: x }, angleUnit);
            if (Number.isFinite(dv) && Math.abs(dv) < 50) {
              minVal = Math.min(minVal, dv);
              maxVal = Math.max(maxVal, dv);
            } else dv = NaN;
          } catch {
            dv = NaN;
          }
        }
        ys.push(fv);
        dys.push(dv);
      }

      if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
        minVal = -5;
        maxVal = 5;
      }
      if (Math.abs(maxVal - minVal) < 1) {
        minVal -= 2;
        maxVal += 2;
      }
      const pad = 36;
      const toSX = (x: number) => pad + ((x + range) / (range * 2)) * (w - pad * 2);
      const toSY = (y: number) => h - pad - ((y - minVal) / (maxVal - minVal)) * (h - pad * 2);

      ctx.strokeStyle = theme === 'dark' ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 6; i++) {
        const gx = pad + (i / 6) * (w - pad * 2);
        const gy = pad + (i / 6) * (h - pad * 2);
        ctx.beginPath();
        ctx.moveTo(gx, pad);
        ctx.lineTo(gx, h - pad);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad, gy);
        ctx.lineTo(w - pad, gy);
        ctx.stroke();
      }

      ctx.strokeStyle = theme === 'dark' ? 'rgba(203,213,225,0.35)' : 'rgba(15,23,42,0.35)';
      ctx.lineWidth = 1.5;
      if (minVal <= 0 && maxVal >= 0) {
        const y0 = toSY(0);
        ctx.beginPath();
        ctx.moveTo(pad, y0);
        ctx.lineTo(w - pad, y0);
        ctx.stroke();
      }
      const x0 = toSX(0);
      ctx.beginPath();
      ctx.moveTo(x0, pad);
      ctx.lineTo(x0, h - pad);
      ctx.stroke();

      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < xs.length; i++) {
        if (!Number.isFinite(ys[i])) {
          started = false;
          continue;
        }
        const sx = toSX(xs[i]);
        const sy = toSY(ys[i]);
        if (!started) {
          ctx.moveTo(sx, sy);
          started = true;
        } else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      if (dAst) {
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        started = false;
        for (let i = 0; i < xs.length; i++) {
          if (!Number.isFinite(dys[i])) {
            started = false;
            continue;
          }
          const sx = toSX(xs[i]);
          const sy = toSY(dys[i]);
          if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
          } else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.font = '12px JetBrains Mono, monospace';
      ctx.fillStyle = '#3B82F6';
      ctx.fillText(`f(x, ${yFixed})`, pad + 8, pad + 16);
      if (dAst) {
        ctx.fillStyle = '#10B981';
        ctx.fillText('Derivative curve', pad + 110, pad + 16);
      }

      ctx.restore();
      return;
    }

    if (viewMode === 'contour') {
      const pad = 28;
      const size = Math.min(w, h) - pad * 2;
      const ox = (w - size) / 2;
      const oy = (h - size) / 2;
      const cells = 52;
      const cellPx = size / cells;

      const vals: number[][] = [];
      let minZ = Infinity;
      let maxZ = -Infinity;

      for (let r = 0; r <= cells; r++) {
        vals[r] = [];
        for (let c = 0; c <= cells; c++) {
          const x = -range + (c / cells) * range * 2;
          const y = range - (r / cells) * range * 2;
          let z = NaN;
          try {
            z = evaluateAST(fAst, { x, y, z: 0, t: 0 }, angleUnit);
            if (!Number.isFinite(z)) z = NaN;
          } catch {
            z = NaN;
          }
          vals[r][c] = z;
          if (Number.isFinite(z)) {
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
          }
        }
      }

      const spanZ = Math.max(1e-5, maxZ - minZ);
      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          const z = vals[r][c];
          if (!Number.isFinite(z)) continue;
          const t = (z - minZ) / spanZ;
          const hue = 225 - t * 185;
          ctx.fillStyle = `hsla(${hue}, 76%, ${theme === 'dark' ? '42%' : '54%'}, 0.85)`;
          ctx.fillRect(ox + c * cellPx, oy + r * cellPx, cellPx + 0.6, cellPx + 0.6);
        }
      }

      // Smooth Marching-Squares level curves across 10 levels
      ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.5)';
      ctx.lineWidth = 1;
      const levels = 10;
      for (let lvl = 1; lvl < levels; lvl++) {
        const iso = minZ + (lvl / levels) * spanZ;
        ctx.beginPath();
        for (let r = 0; r < cells; r++) {
          for (let c = 0; c < cells; c++) {
            const z00 = vals[r][c];
            const z10 = vals[r][c + 1];
            const z11 = vals[r + 1][c + 1];
            const z01 = vals[r + 1][c];
            if (!Number.isFinite(z00) || !Number.isFinite(z10) || !Number.isFinite(z11) || !Number.isFinite(z01)) continue;

            const pts: { x: number; y: number }[] = [];
            const interp = (v1: number, v2: number) => (iso - v1) / (v2 - v1);

            if ((z00 < iso) !== (z10 < iso)) pts.push({ x: c + interp(z00, z10), y: r });
            if ((z10 < iso) !== (z11 < iso)) pts.push({ x: c + 1, y: r + interp(z10, z11) });
            if ((z11 < iso) !== (z01 < iso)) pts.push({ x: c + interp(z01, z11), y: r + 1 });
            if ((z01 < iso) !== (z00 < iso)) pts.push({ x: c, y: r + interp(z00, z01) });

            if (pts.length >= 2) {
              ctx.moveTo(ox + pts[0].x * cellPx, oy + pts[0].y * cellPx);
              ctx.lineTo(ox + pts[1].x * cellPx, oy + pts[1].y * cellPx);
            }
          }
        }
        ctx.stroke();
      }

      // Gradient direction field overlay orthogonal to level curves
      if (showGradOverlay && fxAst && fyAst) {
        const gN = 9;
        const gStep = (range * 2) / gN;
        for (let i = 1; i < gN; i++) {
          for (let j = 1; j < gN; j++) {
            const gxPos = -range + i * gStep;
            const gyPos = -range + j * gStep;
            try {
              const gx = evaluateAST(fxAst, { x: gxPos, y: gyPos, z: 0 }, angleUnit);
              const gy = evaluateAST(fyAst, { x: gxPos, y: gyPos, z: 0 }, angleUnit);
              const mag = Math.hypot(gx, gy);
              if (!Number.isFinite(mag) || mag < 1e-5) continue;
              const len = Math.min(18, Math.max(7, Math.log1p(mag) * 7));
              const sx = ox + (i / gN) * size;
              const sy = oy + ((gN - j) / gN) * size;
              const ex = sx + (gx / mag) * len;
              const ey = sy - (gy / mag) * len;
              ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
              ctx.lineWidth = 1.3;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(ex, ey);
              ctx.stroke();
            } catch {
              // ignore
            }
          }
        }
      }

      const cx = ox + size / 2;
      const cy = oy + size / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox, cy);
      ctx.lineTo(ox + size, cy);
      ctx.moveTo(cx, oy);
      ctx.lineTo(cx, oy + size);
      ctx.stroke();

      if (anchorPoint) {
        const ax = ox + ((anchorPoint.x + range) / (range * 2)) * size;
        const ay = oy + ((range - anchorPoint.y) / (range * 2)) * size;
        if (gradientAtAnchor) {
          const gMag = Math.hypot(gradientAtAnchor.gx, gradientAtAnchor.gy);
          if (gMag > 1e-6) {
            const len = Math.min(52, Math.max(20, gMag * 10));
            const ex = ax + (gradientAtAnchor.gx / gMag) * len;
            const ey = ay - (gradientAtAnchor.gy / gMag) * len;
            ctx.strokeStyle = '#FBBF24';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(ax, ay, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      return;
    }

    // 3D Surface Projection with Pan, Partial Slices & Gradient Direction Vector
    const N = 24;
    const grid: { x: number; y: number; z: number }[][] = [];
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i <= N; i++) {
      grid[i] = [];
      for (let j = 0; j <= N; j++) {
        const x = -range + (i / N) * range * 2;
        const y = -range + (j / N) * range * 2;
        let z = 0;
        try {
          z = evaluateAST(fAst, { x, y, z: 0, t: 0 }, angleUnit);
          if (!Number.isFinite(z)) z = 0;
        } catch {
          z = 0;
        }
        const clamped = Math.max(-range * 2.5, Math.min(range * 2.5, z));
        minZ = Math.min(minZ, clamped);
        maxZ = Math.max(maxZ, clamped);
        grid[i][j] = { x, y, z: clamped };
      }
    }

    const zMid = (minZ + maxZ) / 2;
    const zSpan = Math.max(1e-3, maxZ - minZ);
    const zScale = (range * 1.4) / zSpan;

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const camScale = (Math.min(w, h) * 0.36) / range;

    const project = (px: number, py: number, pz: number) => {
      const sz = (pz - zMid) * zScale;
      const rx = px * cosY - py * sinY;
      const ry = px * sinY + py * cosY;
      const rz = sz * cosP - ry * sinP;
      const depth = ry * cosP + sz * sinP;
      const persp = 1 / (1 + depth * 0.055);
      return {
        sx: w / 2 + pan.x + rx * camScale * persp,
        sy: h / 2 + pan.y - rz * camScale * persp,
        depth,
      };
    };

    const origin = project(0, 0, zMid);
    const xEnd = project(range * 1.15, 0, zMid);
    const yEnd = project(0, range * 1.15, zMid);
    const zEnd = project(0, 0, maxZ + zSpan * 0.15);

    ctx.lineWidth = 1.25;
    ctx.font = '11px JetBrains Mono, monospace';
    const drawAxis = (end: { sx: number; sy: number }, label: string, color: string) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(origin.sx, origin.sy);
      ctx.lineTo(end.sx, end.sy);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(label, end.sx + 4, end.sy + 4);
    };
    drawAxis(xEnd, 'x', '#EF4444');
    drawAxis(yEnd, 'y', '#10B981');
    drawAxis(zEnd, 'z', '#3B82F6');

    interface Quad {
      pts: { sx: number; sy: number }[];
      depth: number;
      tColor: number;
    }
    const quads: Quad[] = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const p00 = grid[i][j];
        const p10 = grid[i + 1][j];
        const p11 = grid[i + 1][j + 1];
        const p01 = grid[i][j + 1];
        const s00 = project(p00.x, p00.y, p00.z);
        const s10 = project(p10.x, p10.y, p10.z);
        const s11 = project(p11.x, p11.y, p11.z);
        const s01 = project(p01.x, p01.y, p01.z);
        const avgDepth = (s00.depth + s10.depth + s11.depth + s01.depth) / 4;
        const avgZ = (p00.z + p10.z + p11.z + p01.z) / 4;
        quads.push({
          pts: [s00, s10, s11, s01],
          depth: avgDepth,
          tColor: (avgZ - minZ) / zSpan,
        });
      }
    }
    quads.sort((a, b) => b.depth - a.depth);

    for (const q of quads) {
      const hue = 222 - q.tColor * 185;
      ctx.fillStyle = `hsla(${hue}, 78%, ${theme === 'dark' ? '48%' : '56%'}, 0.72)`;
      ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.18)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(q.pts[0].sx, q.pts[0].sy);
      ctx.lineTo(q.pts[1].sx, q.pts[1].sy);
      ctx.lineTo(q.pts[2].sx, q.pts[2].sy);
      ctx.lineTo(q.pts[3].sx, q.pts[3].sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Visual Partial Derivative Slice Curves through anchor (x0, y0)
    if (showSlices && anchorPoint) {
      const ax = Math.max(-range, Math.min(range, anchorPoint.x));
      const ay = Math.max(-range, Math.min(range, anchorPoint.y));

      // Slice along x (y = ay fixed -> shows ∂f/∂x slope)
      ctx.strokeStyle = '#FB7185';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = -range + (i / N) * range * 2;
        let z = 0;
        try {
          z = Math.max(-range * 2.5, Math.min(range * 2.5, evaluateAST(fAst, { x, y: ay, z: 0 }, angleUnit)));
        } catch {
          z = 0;
        }
        const pt = project(x, ay, z);
        if (i === 0) ctx.moveTo(pt.sx, pt.sy);
        else ctx.lineTo(pt.sx, pt.sy);
      }
      ctx.stroke();

      // Slice along y (x = ax fixed -> shows ∂f/∂y slope)
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let j = 0; j <= N; j++) {
        const y = -range + (j / N) * range * 2;
        let z = 0;
        try {
          z = Math.max(-range * 2.5, Math.min(range * 2.5, evaluateAST(fAst, { x: ax, y, z: 0 }, angleUnit)));
        } catch {
          z = 0;
        }
        const pt = project(ax, y, z);
        if (j === 0) ctx.moveTo(pt.sx, pt.sy);
        else ctx.lineTo(pt.sx, pt.sy);
      }
      ctx.stroke();
    }

    // Tangent Plane overlay
    if (tangentPlane) {
      const { f0, fx0, fy0, x0, y0 } = tangentPlane;
      const span = range * 0.48;
      const corners = [
        [x0 - span, y0 - span],
        [x0 + span, y0 - span],
        [x0 + span, y0 + span],
        [x0 - span, y0 + span],
      ].map(([tx, ty]) => {
        const tz = f0 + fx0 * (tx - x0) + fy0 * (ty - y0);
        return project(tx, ty, tz);
      });
      ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(corners[0].sx, corners[0].sy);
      ctx.lineTo(corners[1].sx, corners[1].sy);
      ctx.lineTo(corners[2].sx, corners[2].sy);
      ctx.lineTo(corners[3].sx, corners[3].sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Anchor Point + 3D Gradient Direction Vector
    if (anchorPoint) {
      try {
        const az = evaluateAST(fAst, { x: anchorPoint.x, y: anchorPoint.y, z: 0, t: 0 }, angleUnit);
        if (Number.isFinite(az)) {
          const ap = project(anchorPoint.x, anchorPoint.y, az);

          if (showGradOverlay && fxAst && fyAst) {
            const gx = gradientAtAnchor?.gx ?? evaluateAST(fxAst, { x: anchorPoint.x, y: anchorPoint.y, z: 0 }, angleUnit);
            const gy = gradientAtAnchor?.gy ?? evaluateAST(fyAst, { x: anchorPoint.x, y: anchorPoint.y, z: 0 }, angleUnit);
            const gMag = Math.hypot(gx, gy);
            if (Number.isFinite(gMag) && gMag > 1e-6) {
              const stepLen = range * 0.35;
              const ux = (gx / gMag) * stepLen;
              const uy = (gy / gMag) * stepLen;
              const tipZ = az + (gx * ux + gy * uy);
              const tip = project(anchorPoint.x + ux, anchorPoint.y + uy, Math.max(-range * 2.5, Math.min(range * 2.5, tipZ)));
              ctx.strokeStyle = '#FBBF24';
              ctx.fillStyle = '#FBBF24';
              ctx.lineWidth = 2.8;
              ctx.beginPath();
              ctx.moveTo(ap.sx, ap.sy);
              ctx.lineTo(tip.sx, tip.sy);
              ctx.stroke();

              const ang = Math.atan2(tip.sy - ap.sy, tip.sx - ap.sx);
              ctx.beginPath();
              ctx.moveTo(tip.sx, tip.sy);
              ctx.lineTo(tip.sx - 8 * Math.cos(ang - 0.45), tip.sy - 8 * Math.sin(ang - 0.45));
              ctx.lineTo(tip.sx - 8 * Math.cos(ang + 0.45), tip.sy - 8 * Math.sin(ang + 0.45));
              ctx.closePath();
              ctx.fill();
            }
          }

          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(ap.sx, ap.sy, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } catch {
        // ignore
      }
    }

    ctx.restore();
  }, [
    isVectorField,
    parsed,
    viewMode,
    range,
    yaw,
    pitch,
    pan,
    showSlices,
    showGradOverlay,
    theme,
    angleUnit,
    anchorPoint,
    tangentPlane,
    gradientAtAnchor,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (draggingRef.current.active) {
      const dx = e.clientX - draggingRef.current.lastX;
      const dy = e.clientY - draggingRef.current.lastY;
      draggingRef.current.lastX = e.clientX;
      draggingRef.current.lastY = e.clientY;

      if (dragMode === 'pan' || e.shiftKey || isVectorField) {
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      } else if (viewMode === '3d') {
        setYaw((prev) => prev + dx * 0.01);
        setPitch((prev) => Math.max(-1.35, Math.min(1.35, prev + dy * 0.01)));
      }
      return;
    }

    if (isVectorField || viewMode === 'contour') {
      const pad = isVectorField ? 32 : 28;
      const size = Math.min(rect.width, rect.height) - pad * 2;
      const ox = (rect.width - size) / 2 + (isVectorField ? pan.x : 0);
      const oy = (rect.height - size) / 2 + (isVectorField ? pan.y : 0);
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      if (lx >= ox && lx <= ox + size && ly >= oy && ly <= oy + size && parsed.fAst) {
        const x = -range + ((lx - ox) / size) * range * 2;
        const y = range - ((ly - oy) / size) * range * 2;
        try {
          const valA = evaluateAST(parsed.fAst, { x, y, z: 0, t: 0 }, angleUnit);
          const valB =
            isVectorField && parsed.qAst
              ? evaluateAST(parsed.qAst, { x, y, z: 0, t: 0 }, angleUnit)
              : undefined;
          setProbe({ x, y, valA, valB });
        } catch {
          setProbe(null);
        }
      } else {
        setProbe(null);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setRange((r) => {
      const next = e.deltaY > 0 ? Math.min(10, r + 0.5) : Math.max(1, r - 0.5);
      return Number(next.toFixed(1));
    });
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] overflow-hidden">
      {/* Graph Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 border-b border-slate-200 dark:border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isVectorField ? 'Vector Field Plot' : 'Interactive Surface & Contour Plot'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isVectorField
              ? 'Drag to pan · Hover to inspect F(x, y)'
              : viewMode === '3d'
              ? 'Drag to rotate · Shift+drag or Pan mode to pan · Scroll to zoom'
              : viewMode === 'contour'
              ? 'Marching-squares level curves + ∇f vectors'
              : 'Cross-section f(x) vs partial derivative curve'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!isVectorField ? (
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#111319] border border-slate-200 dark:border-white/5">
              {(['3d', 'contour', 'slice'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    viewMode === m
                      ? 'bg-[#2F7CF6] text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {m === '3d' ? '3D Surface' : m === 'contour' ? 'Level Curves' : '1D Slice'}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAnimateFlow((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
            >
              {animateFlow ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {animateFlow ? 'Pause' : 'Play'}
            </button>
          )}

          {!isVectorField && viewMode === '3d' && (
            <>
              <button
                type="button"
                onClick={() => setDragMode((d) => (d === 'orbit' ? 'pan' : 'orbit'))}
                title="Switch between Rotate and Pan drag modes"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  dragMode === 'pan'
                    ? 'border-[#2F7CF6] bg-[#2F7CF6]/15 text-[#2F7CF6]'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                {dragMode === 'pan' ? <Move className="w-3.5 h-3.5" /> : <RotateCw className="w-3.5 h-3.5" />}
                {dragMode === 'pan' ? 'Pan' : 'Orbit'}
              </button>

              <button
                type="button"
                onClick={() => setShowSlices((s) => !s)}
                title="Toggle ∂f/∂x and ∂f/∂y partial slice curves"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  showSlices
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                Slices
              </button>
            </>
          )}

          {!isVectorField && (viewMode === '3d' || viewMode === 'contour') && (
            <button
              type="button"
              onClick={() => setShowGradOverlay((g) => !g)}
              title="Toggle gradient direction vector overlay"
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                showGradOverlay
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              ∇f
            </button>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setRange((r) => Math.max(1, Number((r - 0.5).toFixed(1))))}
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setRange((r) => Math.min(10, Number((r + 0.5).toFixed(1))))}
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Reset view"
              onClick={() => {
                setRange(3);
                setYaw(0.65);
                setPitch(0.48);
                setPan({ x: 0, y: 0 });
              }}
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative w-full h-[350px] sm:h-[420px]">
        {parsed.error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Enter a valid mathematical expression to render the visualization.
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => {
              draggingRef.current.active = false;
            }}
            onPointerLeave={() => {
              draggingRef.current.active = false;
              setProbe(null);
            }}
            onWheel={handleWheel}
            className={`w-full h-full block touch-none ${
              dragMode === 'pan' || isVectorField
                ? 'cursor-move'
                : viewMode === '3d'
                ? 'cursor-grab active:cursor-grabbing'
                : 'cursor-crosshair'
            }`}
          />
        )}

        {/* Legend for 3D overlays */}
        {!isVectorField && viewMode === '3d' && !parsed.error && (
          <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-3 px-2.5 py-1.5 rounded-xl bg-slate-900/75 text-[11px] text-slate-200 backdrop-blur-sm">
            {showSlices && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> ∂f/∂x slice
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> ∂f/∂y slice
                </span>
              </>
            )}
            {showGradOverlay && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> ∇f direction
              </span>
            )}
          </div>
        )}

        {probe && (
          <div className="pointer-events-none absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-slate-900/85 text-white text-xs font-mono tabular-nums backdrop-blur-sm border border-white/10">
            {isVectorField ? (
              <span>
                ({probe.x.toFixed(2)}, {probe.y.toFixed(2)}) · F = ⟨{probe.valA.toFixed(2)},{' '}
                {(probe.valB ?? 0).toFixed(2)}⟩
              </span>
            ) : (
              <span>
                ({probe.x.toFixed(2)}, {probe.y.toFixed(2)}) · f = {probe.valA.toFixed(3)}
              </span>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/70 text-slate-200 text-[11px] font-mono tabular-nums">
          Domain: [−{range}, {range}]²
        </div>
      </div>
    </div>
  );
}
