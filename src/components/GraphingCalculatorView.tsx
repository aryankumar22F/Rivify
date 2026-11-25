import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { differentiate, evaluateAST, parseExpression, simplify, type ExprNode } from '../engine/symbolic';
import type { AppSettings, RecentGraphSession } from '../types';

type PlotMode = '2d-multi' | '3d-surface' | 'parametric' | 'contour' | 'vector-field';

interface GraphingCalculatorViewProps {
  settings: AppSettings;
  externalGraph?: { expr: string; nonce: number } | null;
  onRecordGraphSession?: (session: RecentGraphSession) => void;
}

const CURVE_COLORS = ['#3B82F6', '#10B981', '#F59E0B'];

export function GraphingCalculatorView({
  settings,
  externalGraph,
  onRecordGraphSession,
}: GraphingCalculatorViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [plotMode, setPlotMode] = useState<PlotMode>('2d-multi');

  // 2D Multi-function expressions
  const [fn1, setFn1] = useState('sin(x) + 0.3*x');
  const [fn2, setFn2] = useState('cos(x)');
  const [fn3, setFn3] = useState('0.2*x^2 - 1');
  const [showDeriv, setShowDeriv] = useState(true);

  // 3D & Contour surface expression
  const [surfExpr, setSurfExpr] = useState('sin(x) * cos(y)');

  useEffect(() => {
    if (externalGraph && externalGraph.expr.trim()) {
      const cleaned = externalGraph.expr.replace(/^y\s*=\s*/i, '').replace(/^z\s*=\s*/i, '').trim();
      if (/\by\b/i.test(cleaned)) {
        setSurfExpr(cleaned);
        setPlotMode('3d-surface');
      } else {
        setFn1(cleaned);
        setPlotMode('2d-multi');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalGraph?.nonce]);

  // Parametric expressions
  const [paramX, setParamX] = useState('2*cos(t) + cos(3*t)');
  const [paramY, setParamY] = useState('2*sin(t) - sin(3*t)');
  const [paramZ, setParamZ] = useState('0.5*t');
  const [param3D, setParam3D] = useState(false);
  const [tMin, setTMin] = useState('0');
  const [tMax, setTMax] = useState('6.283185');

  // Vector Field expressions
  const [vecP, setVecP] = useState('-y');
  const [vecQ, setVecQ] = useState('x');
  const [animateFlow, setAnimateFlow] = useState(true);

  // Independent ranges
  const [xMin, setXMin] = useState(-5);
  const [xMax, setXMax] = useState(5);
  const [yMin, setYMin] = useState(-4);
  const [yMax, setYMax] = useState(4);
  const [zMin, setZMin] = useState(-3);
  const [zMax, setZMax] = useState(3);

  // 3D Orbit & Pan
  const [yaw, setYaw] = useState(0.65);
  const [pitch, setPitch] = useState(0.45);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGradOverlay, setShowGradOverlay] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);

  const draggingRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const parsed = useMemo(() => {
    const safeParse = (s: string): ExprNode | null => {
      if (!s.trim()) return null;
      return parseExpression(s);
    };
    try {
      const f1 = safeParse(fn1);
      const f2 = safeParse(fn2);
      const f3 = safeParse(fn3);
      const f1d = f1 && showDeriv ? simplify(differentiate(f1, 'x')) : null;
      const sAst = safeParse(surfExpr);
      const fxAst = sAst ? simplify(differentiate(sAst, 'x')) : null;
      const fyAst = sAst ? simplify(differentiate(sAst, 'y')) : null;
      const pxAst = safeParse(paramX);
      const pyAst = safeParse(paramY);
      const pzAst = param3D ? safeParse(paramZ) : null;
      const vpAst = safeParse(vecP);
      const vqAst = safeParse(vecQ);
      return {
        f1,
        f2,
        f3,
        f1d,
        sAst,
        fxAst,
        fyAst,
        pxAst,
        pyAst,
        pzAst,
        vpAst,
        vqAst,
        error: null as string | null,
      };
    } catch (e) {
      return {
        f1: null,
        f2: null,
        f3: null,
        f1d: null,
        sAst: null,
        fxAst: null,
        fyAst: null,
        pxAst: null,
        pyAst: null,
        pzAst: null,
        vpAst: null,
        vqAst: null,
        error: e instanceof Error ? e.message : 'Invalid expression syntax.',
      };
    }
  }, [fn1, fn2, fn3, showDeriv, surfExpr, paramX, paramY, paramZ, param3D, vecP, vecQ]);

  useEffect(() => {
    if (!onRecordGraphSession || parsed.error) return;
    const exprLabel =
      plotMode === '2d-multi'
        ? fn1
        : plotMode === '3d-surface' || plotMode === 'contour'
        ? surfExpr
        : plotMode === 'parametric'
        ? `(${paramX}, ${paramY})`
        : `<${vecP}, ${vecQ}>`;
    const timer = setTimeout(() => {
      onRecordGraphSession({
        id: `gc-${plotMode}-${exprLabel}`,
        title: `${plotMode.replace('-', ' ')} plot`,
        sourceTool: 'graphing-calculator',
        expression: exprLabel,
        timestamp: Date.now(),
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [plotMode, fn1, surfExpr, paramX, paramY, vecP, vecQ, parsed.error, onRecordGraphSession]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const xSpan = Math.max(0.2, xMax - xMin);
    const ySpan = Math.max(0.2, yMax - yMin);
    const zSpanUser = Math.max(0.2, zMax - zMin);

    let rafId = 0;
    const particles = Array.from({ length: 70 }, () => ({
      x: xMin + Math.random() * xSpan,
      y: yMin + Math.random() * ySpan,
      life: Math.random() * 60,
    }));

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        if (plotMode === 'vector-field' && animateFlow) rafId = requestAnimationFrame(draw);
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
      const dark = settings.theme === 'dark';

      ctx.fillStyle = dark ? '#13161D' : '#F8FAFC';
      ctx.fillRect(0, 0, w, h);

      const pad = 36;
      const toSX = (x: number) => pad + ((x - xMin) / xSpan) * (w - pad * 2) + pan.x;
      const toSY = (y: number) => h - pad - ((y - yMin) / ySpan) * (h - pad * 2) + pan.y;

      const drawAxes2D = () => {
        ctx.strokeStyle = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 8; i++) {
          const gx = pad + (i / 8) * (w - pad * 2);
          const gy = pad + (i / 8) * (h - pad * 2);
          ctx.beginPath();
          ctx.moveTo(gx, pad);
          ctx.lineTo(gx, h - pad);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(pad, gy);
          ctx.lineTo(w - pad, gy);
          ctx.stroke();
        }

        ctx.strokeStyle = dark ? 'rgba(203,213,225,0.4)' : 'rgba(15,23,42,0.4)';
        ctx.lineWidth = 1.5;
        if (yMin <= 0 && yMax >= 0) {
          const y0 = toSY(0);
          ctx.beginPath();
          ctx.moveTo(pad, y0);
          ctx.lineTo(w - pad, y0);
          ctx.stroke();
        }
        if (xMin <= 0 && xMax >= 0) {
          const x0 = toSX(0);
          ctx.beginPath();
          ctx.moveTo(x0, pad);
          ctx.lineTo(x0, h - pad);
          ctx.stroke();
        }
      };

      if (plotMode === '2d-multi') {
        drawAxes2D();
        const curves = [
          { ast: parsed.f1, color: CURVE_COLORS[0], dashed: false },
          { ast: parsed.f2, color: CURVE_COLORS[1], dashed: false },
          { ast: parsed.f3, color: CURVE_COLORS[2], dashed: false },
          { ast: parsed.f1d, color: '#EC4899', dashed: true },
        ];
        const steps = 320;
        for (const curve of curves) {
          if (!curve.ast) continue;
          ctx.strokeStyle = curve.color;
          ctx.lineWidth = curve.dashed ? 1.8 : 2.5;
          ctx.setLineDash(curve.dashed ? [6, 4] : []);
          ctx.beginPath();
          let started = false;
          for (let i = 0; i <= steps; i++) {
            const x = xMin + (i / steps) * xSpan;
            try {
              const y = evaluateAST(curve.ast, { x, y: 0, z: 0, t: x }, settings.angleUnit);
              if (!Number.isFinite(y) || Math.abs(y) > Math.max(Math.abs(yMin), Math.abs(yMax)) * 8) {
                started = false;
                continue;
              }
              const sx = toSX(x);
              const sy = toSY(y);
              if (!started) {
                ctx.moveTo(sx, sy);
                started = true;
              } else {
                ctx.lineTo(sx, sy);
              }
            } catch {
              started = false;
            }
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (plotMode === 'parametric') {
        const t0 = Number(tMin) || 0;
        const t1 = Number(tMax) || Math.PI * 2;
        if (!param3D) {
          drawAxes2D();
          if (parsed.pxAst && parsed.pyAst) {
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            let started = false;
            const steps = 360;
            for (let i = 0; i <= steps; i++) {
              const t = t0 + (i / steps) * (t1 - t0);
              try {
                const x = evaluateAST(parsed.pxAst, { t }, settings.angleUnit);
                const y = evaluateAST(parsed.pyAst, { t }, settings.angleUnit);
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                  started = false;
                  continue;
                }
                const sx = toSX(x);
                const sy = toSY(y);
                if (!started) {
                  ctx.moveTo(sx, sy);
                  started = true;
                } else ctx.lineTo(sx, sy);
              } catch {
                started = false;
              }
            }
            ctx.stroke();
          }
        } else if (parsed.pxAst && parsed.pyAst && parsed.pzAst) {
          const cosY = Math.cos(yaw);
          const sinY = Math.sin(yaw);
          const cosP = Math.cos(pitch);
          const sinP = Math.sin(pitch);
          const scale = Math.min(w, h) * 0.34 / Math.max(1, Math.max(xSpan, ySpan, zSpanUser) * 0.5);
          const proj = (px: number, py: number, pz: number) => {
            const rx = px * cosY - py * sinY;
            const ry = px * sinY + py * cosY;
            const rz = pz * cosP - ry * sinP;
            const depth = ry * cosP + pz * sinP;
            const persp = 1 / (1 + depth * 0.05);
            return { sx: w / 2 + pan.x + rx * scale * persp, sy: h / 2 + pan.y - rz * scale * persp };
          };
          const o = proj(0, 0, 0);
          const ax = proj(2.5, 0, 0);
          const ay = proj(0, 2.5, 0);
          const az = proj(0, 0, 2.5);
          for (const [end, lbl, col] of [
            [ax, 'x', '#EF4444'],
            [ay, 'y', '#10B981'],
            [az, 'z', '#3B82F6'],
          ] as const) {
            ctx.strokeStyle = col;
            ctx.beginPath();
            ctx.moveTo(o.sx, o.sy);
            ctx.lineTo(end.sx, end.sy);
            ctx.stroke();
            ctx.fillStyle = col;
            ctx.fillText(lbl, end.sx + 4, end.sy + 4);
          }

          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          let started = false;
          const steps = 360;
          for (let i = 0; i <= steps; i++) {
            const t = t0 + (i / steps) * (t1 - t0);
            try {
              const x = evaluateAST(parsed.pxAst, { t }, settings.angleUnit);
              const y = evaluateAST(parsed.pyAst, { t }, settings.angleUnit);
              const z = evaluateAST(parsed.pzAst, { t }, settings.angleUnit);
              if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                started = false;
                continue;
              }
              const s = proj(x, y, z);
              if (!started) {
                ctx.moveTo(s.sx, s.sy);
                started = true;
              } else ctx.lineTo(s.sx, s.sy);
            } catch {
              started = false;
            }
          }
          ctx.stroke();
        }
      } else if (plotMode === 'contour' && parsed.sAst) {
        const size = Math.min(w, h) - pad * 2;
        const ox = (w - size) / 2;
        const oy = (h - size) / 2;
        const cells = 52;
        const cellPx = size / cells;
        const vals: number[][] = [];
        let minVal = Infinity;
        let maxVal = -Infinity;
        for (let r = 0; r <= cells; r++) {
          vals[r] = [];
          for (let c = 0; c <= cells; c++) {
            const x = xMin + (c / cells) * xSpan;
            const y = yMax - (r / cells) * ySpan;
            let z = NaN;
            try {
              z = evaluateAST(parsed.sAst, { x, y }, settings.angleUnit);
              if (!Number.isFinite(z)) z = NaN;
            } catch {
              z = NaN;
            }
            vals[r][c] = z;
            if (Number.isFinite(z)) {
              minVal = Math.min(minVal, z);
              maxVal = Math.max(maxVal, z);
            }
          }
        }
        const spanZ = Math.max(1e-5, maxVal - minVal);
        for (let r = 0; r < cells; r++) {
          for (let c = 0; c < cells; c++) {
            const z = vals[r][c];
            if (!Number.isFinite(z)) continue;
            const t = (z - minVal) / spanZ;
            const hue = 225 - t * 185;
            ctx.fillStyle = `hsla(${hue}, 76%, ${dark ? '42%' : '54%'}, 0.85)`;
            ctx.fillRect(ox + c * cellPx, oy + r * cellPx, cellPx + 0.6, cellPx + 0.6);
          }
        }
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.5)';
        ctx.lineWidth = 1;
        for (let lvl = 1; lvl < 10; lvl++) {
          const iso = minVal + (lvl / 10) * spanZ;
          ctx.beginPath();
          for (let r = 0; r < cells; r++) {
            for (let c = 0; c < cells; c++) {
              const z00 = vals[r][c];
              const z10 = vals[r][c + 1];
              const z11 = vals[r + 1][c + 1];
              const z01 = vals[r + 1][c];
              if (![z00, z10, z11, z01].every(Number.isFinite)) continue;
              const pts: { x: number; y: number }[] = [];
              const interp = (a: number, b: number) => (iso - a) / (b - a);
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
        if (showGradOverlay && parsed.fxAst && parsed.fyAst) {
          const gN = 9;
          for (let i = 1; i < gN; i++) {
            for (let j = 1; j < gN; j++) {
              const x = xMin + (i / gN) * xSpan;
              const y = yMin + (j / gN) * ySpan;
              try {
                const gx = evaluateAST(parsed.fxAst, { x, y }, settings.angleUnit);
                const gy = evaluateAST(parsed.fyAst, { x, y }, settings.angleUnit);
                const mag = Math.hypot(gx, gy);
                if (!Number.isFinite(mag) || mag < 1e-5) continue;
                const len = Math.min(18, Math.max(7, Math.log1p(mag) * 7));
                const sx = ox + (i / gN) * size;
                const sy = oy + ((gN - j) / gN) * size;
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + (gx / mag) * len, sy - (gy / mag) * len);
                ctx.stroke();
              } catch {
                // ignore
              }
            }
          }
        }
      } else if (plotMode === '3d-surface' && parsed.sAst) {
        const N = 26;
        const xMid = (xMin + xMax) / 2;
        const yMid = (yMin + yMax) / 2;
        const zMid = (zMin + zMax) / 2;
        const grid: { x: number; y: number; z: number }[][] = [];
        for (let i = 0; i <= N; i++) {
          grid[i] = [];
          for (let j = 0; j <= N; j++) {
            const x = xMin + (i / N) * xSpan;
            const y = yMin + (j / N) * ySpan;
            let z = zMid;
            try {
              const rawZ = evaluateAST(parsed.sAst, { x, y }, settings.angleUnit);
              z = Number.isFinite(rawZ) ? Math.max(zMin, Math.min(zMax, rawZ)) : zMid;
            } catch {
              z = zMid;
            }
            grid[i][j] = { x, y, z };
          }
        }

        const normScale = Math.min(w, h) * 0.32;
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const cosP = Math.cos(pitch);
        const sinP = Math.sin(pitch);

        const project = (px: number, py: number, pz: number) => {
          const nx = ((px - xMid) / xSpan) * 2;
          const ny = ((py - yMid) / ySpan) * 2;
          const nz = ((pz - zMid) / zSpanUser) * 1.5;
          const rx = nx * cosY - ny * sinY;
          const ry = nx * sinY + ny * cosY;
          const rz = nz * cosP - ry * sinP;
          const depth = ry * cosP + nz * sinP;
          const persp = 1 / (1 + depth * 0.12);
          return { sx: w / 2 + pan.x + rx * normScale * persp, sy: h / 2 + pan.y - rz * normScale * persp, depth };
        };

        const o = project(xMid, yMid, zMid);
        const ax = project(xMax, yMid, zMid);
        const ay = project(xMid, yMax, zMid);
        const az = project(xMid, yMid, zMax);
        ctx.lineWidth = 1.25;
        ctx.font = '11px JetBrains Mono, monospace';
        for (const [end, lbl, col] of [
          [ax, 'x', '#EF4444'],
          [ay, 'y', '#10B981'],
          [az, 'z', '#3B82F6'],
        ] as const) {
          ctx.strokeStyle = col;
          ctx.beginPath();
          ctx.moveTo(o.sx, o.sy);
          ctx.lineTo(end.sx, end.sy);
          ctx.stroke();
          ctx.fillStyle = col;
          ctx.fillText(lbl, end.sx + 4, end.sy + 4);
        }

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
            const avgZ = (p00.z + p10.z + p11.z + p01.z) / 4;
            quads.push({
              pts: [s00, s10, s11, s01],
              depth: (s00.depth + s10.depth + s11.depth + s01.depth) / 4,
              tColor: (avgZ - zMin) / zSpanUser,
            });
          }
        }
        quads.sort((a, b) => b.depth - a.depth);

        for (const q of quads) {
          const hue = 222 - q.tColor * 185;
          ctx.fillStyle = `hsla(${hue}, 78%, ${dark ? '48%' : '56%'}, 0.74)`;
          ctx.strokeStyle = dark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.16)';
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
      } else if (plotMode === 'vector-field' && parsed.vpAst && parsed.vqAst) {
        drawAxes2D();
        const gridN = 13;
        const maxArrowPx = (Math.min(w, h) / gridN) * 0.65;
        for (let i = 0; i <= gridN; i++) {
          for (let j = 0; j <= gridN; j++) {
            const vx = xMin + (i / gridN) * xSpan;
            const vy = yMin + (j / gridN) * ySpan;
            try {
              const p = evaluateAST(parsed.vpAst, { x: vx, y: vy }, settings.angleUnit);
              const q = evaluateAST(parsed.vqAst, { x: vx, y: vy }, settings.angleUnit);
              const mag = Math.hypot(p, q);
              if (!Number.isFinite(mag) || mag < 1e-6) continue;
              const len = Math.min(1, Math.log1p(mag) / 2.6) * maxArrowPx;
              const dx = (p / mag) * len;
              const dy = -(q / mag) * len;
              const hue = 215 - Math.min(1, mag / 5) * 175;
              ctx.strokeStyle = `hsla(${hue}, 85%, ${dark ? '64%' : '48%'}, 0.85)`;
              ctx.fillStyle = ctx.strokeStyle;
              ctx.lineWidth = 1.4;
              const sx = toSX(vx);
              const sy = toSY(vy);
              const ex = sx + dx;
              const ey = sy + dy;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(ex, ey);
              ctx.stroke();
              const ang = Math.atan2(dy, dx);
              ctx.beginPath();
              ctx.moveTo(ex, ey);
              ctx.lineTo(ex - 4.5 * Math.cos(ang - 0.5), ey - 4.5 * Math.sin(ang - 0.5));
              ctx.lineTo(ex - 4.5 * Math.cos(ang + 0.5), ey - 4.5 * Math.sin(ang + 0.5));
              ctx.closePath();
              ctx.fill();
            } catch {
              // ignore
            }
          }
        }
        if (animateFlow) {
          ctx.fillStyle = dark ? 'rgba(96,165,250,0.85)' : 'rgba(37,99,235,0.85)';
          for (const pt of particles) {
            try {
              const p = evaluateAST(parsed.vpAst, { x: pt.x, y: pt.y }, settings.angleUnit);
              const q = evaluateAST(parsed.vqAst, { x: pt.x, y: pt.y }, settings.angleUnit);
              const mag = Math.hypot(p, q);
              if (!Number.isFinite(mag) || mag < 1e-5 || pt.life > 75 || pt.x < xMin || pt.x > xMax || pt.y < yMin || pt.y > yMax) {
                pt.x = xMin + Math.random() * xSpan;
                pt.y = yMin + Math.random() * ySpan;
                pt.life = 0;
              } else {
                const dt = (0.025 * Math.max(xSpan, ySpan) * 0.5) / Math.max(0.8, mag);
                pt.x += p * dt;
                pt.y += q * dt;
                pt.life += 1;
                ctx.beginPath();
                ctx.arc(toSX(pt.x), toSY(pt.y), 2, 0, Math.PI * 2);
                ctx.fill();
              }
            } catch {
              pt.life = 100;
            }
          }
        }
      }

      ctx.restore();
      if (plotMode === 'vector-field' && animateFlow) {
        rafId = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [
    plotMode,
    parsed,
    xMin,
    xMax,
    yMin,
    yMax,
    zMin,
    zMax,
    tMin,
    tMax,
    param3D,
    yaw,
    pitch,
    pan,
    showGradOverlay,
    animateFlow,
    settings.angleUnit,
    settings.theme,
  ]);

  const zoomAll = (factor: number) => {
    const cx = (xMin + xMax) / 2;
    const cy = (yMin + yMax) / 2;
    const halfX = ((xMax - xMin) / 2) * factor;
    const halfY = ((yMax - yMin) / 2) * factor;
    setXMin(Number((cx - halfX).toFixed(2)));
    setXMax(Number((cx + halfX).toFixed(2)));
    setYMin(Number((cy - halfY).toFixed(2)));
    setYMax(Number((cy + halfY).toFixed(2)));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <LineChart className="w-5 h-5 text-[#2F7CF6]" />
              Interactive Graphing Calculator
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Plot multiple 2D functions, rotatable 3D surfaces with independent x/y/z bounds, parametric curves, contour maps, and vector fields.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: '2d-multi', label: '2D Multi-Plot' },
                { id: '3d-surface', label: '3D Surface' },
                { id: 'parametric', label: 'Parametric 2D/3D' },
                { id: 'contour', label: 'Contour Map' },
                { id: 'vector-field', label: 'Vector Field' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setPlotMode(m.id);
                  setPan({ x: 0, y: 0 });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  plotMode === m.id
                    ? 'bg-[#2F7CF6] text-white'
                    : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          {plotMode === '2d-multi' && (
            <>
              <div>
                <label className="text-xs font-medium text-[#3B82F6]">f₁(x) — Blue</label>
                <input
                  type="text"
                  value={fn1}
                  onChange={(e) => setFn1(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-500">f₂(x) — Emerald (optional)</label>
                <input
                  type="text"
                  value={fn2}
                  onChange={(e) => setFn2(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-amber-500">f₃(x) — Amber (optional)</label>
                <input
                  type="text"
                  value={fn3}
                  onChange={(e) => setFn3(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={showDeriv}
                  onChange={(e) => setShowDeriv(e.target.checked)}
                  className="accent-[#2F7CF6]"
                />
                Overlay f₁′(x) derivative (dashed pink)
              </label>
            </>
          )}

          {(plotMode === '3d-surface' || plotMode === 'contour') && (
            <>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Surface z = f(x, y)</label>
                <input
                  type="text"
                  value={surfExpr}
                  onChange={(e) => setSurfExpr(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              {plotMode === 'contour' && (
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showGradOverlay}
                    onChange={(e) => setShowGradOverlay(e.target.checked)}
                    className="accent-[#2F7CF6]"
                  />
                  Show gradient vector field ∇f
                </label>
              )}
            </>
          )}

          {plotMode === 'parametric' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Curve Space</span>
                <button
                  type="button"
                  onClick={() => setParam3D((p) => !p)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#22252E] text-[#2F7CF6]"
                >
                  {param3D ? '3D Curve r(t)' : '2D Curve r(t)'}
                </button>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">x(t)</label>
                <input
                  type="text"
                  value={paramX}
                  onChange={(e) => setParamX(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">y(t)</label>
                <input
                  type="text"
                  value={paramY}
                  onChange={(e) => setParamY(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              {param3D && (
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">z(t)</label>
                  <input
                    type="text"
                    value={paramZ}
                    onChange={(e) => setParamZ(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">t min</label>
                  <input
                    type="number"
                    step="any"
                    value={tMin}
                    onChange={(e) => setTMin(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">t max</label>
                  <input
                    type="number"
                    step="any"
                    value={tMax}
                    onChange={(e) => setTMax(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </>
          )}

          {plotMode === 'vector-field' && (
            <>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">P(x, y)</label>
                <input
                  type="text"
                  value={vecP}
                  onChange={(e) => setVecP(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Q(x, y)</label>
                <input
                  type="text"
                  value={vecQ}
                  onChange={(e) => setVecQ(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
            </>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Viewport Ranges
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">x min</label>
                <input
                  type="number"
                  step="any"
                  value={xMin}
                  onChange={(e) => setXMin(Number(e.target.value))}
                  className="mt-0.5 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">x max</label>
                <input
                  type="number"
                  step="any"
                  value={xMax}
                  onChange={(e) => setXMax(Number(e.target.value))}
                  className="mt-0.5 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">y min</label>
                <input
                  type="number"
                  step="any"
                  value={yMin}
                  onChange={(e) => setYMin(Number(e.target.value))}
                  className="mt-0.5 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">y max</label>
                <input
                  type="number"
                  step="any"
                  value={yMax}
                  onChange={(e) => setYMax(Number(e.target.value))}
                  className="mt-0.5 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              {(plotMode === '3d-surface' || (plotMode === 'parametric' && param3D)) && (
                <>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">z min</label>
                    <input
                      type="number"
                      step="any"
                      value={zMin}
                      onChange={(e) => setZMin(Number(e.target.value))}
                      className="mt-0.5 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">z max</label>
                    <input
                      type="number"
                      step="any"
                      value={zMax}
                      onChange={(e) => setZMax(Number(e.target.value))}
                      className="mt-0.5 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {parsed.error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300"
            >
              {parsed.error}
            </div>
          )}
        </div>

        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-white/10">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {plotMode === '3d-surface' || (plotMode === 'parametric' && param3D)
                ? 'Drag to orbit · Shift+drag to pan · Scroll to zoom'
                : 'Drag to pan · Hover to inspect coordinates · Scroll to zoom'}
            </span>
            <div className="flex items-center gap-1.5">
              {plotMode === 'vector-field' && (
                <button
                  type="button"
                  onClick={() => setAnimateFlow((a) => !a)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                >
                  {animateFlow ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {animateFlow ? 'Pause' : 'Flow'}
                </button>
              )}
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => zoomAll(0.8)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => zoomAll(1.25)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Reset viewport"
                onClick={() => {
                  setXMin(-5);
                  setXMax(5);
                  setYMin(-4);
                  setYMax(4);
                  setZMin(-3);
                  setZMax(3);
                  setYaw(0.65);
                  setPitch(0.45);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative w-full h-[420px] sm:h-[480px]">
            <canvas
              ref={canvasRef}
              onPointerDown={(e) => {
                draggingRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                if (draggingRef.current.active) {
                  const dx = e.clientX - draggingRef.current.lastX;
                  const dy = e.clientY - draggingRef.current.lastY;
                  draggingRef.current.lastX = e.clientX;
                  draggingRef.current.lastY = e.clientY;
                  const is3DCanvas =
                    plotMode === '3d-surface' || (plotMode === 'parametric' && param3D);
                  if (is3DCanvas && !e.shiftKey) {
                    setYaw((y) => y + dx * 0.01);
                    setPitch((p) => Math.max(-1.35, Math.min(1.35, p + dy * 0.01)));
                  } else {
                    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
                  }
                  return;
                }
                const pad = 36;
                const lx = e.clientX - rect.left;
                const ly = e.clientY - rect.top;
                const wx = xMin + ((lx - pad - pan.x) / (rect.width - pad * 2)) * (xMax - xMin);
                const wy =
                  yMin + ((rect.height - pad - (ly - pan.y)) / (rect.height - pad * 2)) * (yMax - yMin);
                if (plotMode === '2d-multi' && parsed.f1) {
                  try {
                    const yv = evaluateAST(parsed.f1, { x: wx, t: wx }, settings.angleUnit);
                    setHoverInfo(`x = ${wx.toFixed(2)}, f₁(x) = ${yv.toFixed(3)}`);
                  } catch {
                    setHoverInfo(`x = ${wx.toFixed(2)}, y = ${wy.toFixed(2)}`);
                  }
                } else {
                  setHoverInfo(`x = ${wx.toFixed(2)}, y = ${wy.toFixed(2)}`);
                }
              }}
              onPointerUp={() => {
                draggingRef.current.active = false;
              }}
              onPointerLeave={() => {
                draggingRef.current.active = false;
                setHoverInfo(null);
              }}
              onWheel={(e) => {
                e.preventDefault();
                zoomAll(e.deltaY > 0 ? 1.12 : 0.9);
              }}
              className="w-full h-full block touch-none cursor-crosshair"
            />
            {hoverInfo && (
              <div className="pointer-events-none absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-slate-900/85 text-white text-xs font-mono tabular-nums">
                {hoverInfo}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
