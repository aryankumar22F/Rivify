import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Compass, FileDown, Save } from 'lucide-react';
import {
  analyzeConicSection,
  apply2DTransform,
  compute2DCoordinateGeometry,
  compute3DGeometry,
} from '../engine/geometryLab';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface AdvancedGeometryViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

type GeoTab = 'coord2d' | 'conics' | 'transform2d' | 'geo3d';

export function AdvancedGeometryView({ settings, onSaveToNotebook }: AdvancedGeometryViewProps) {
  const [tab, setTab] = useState<GeoTab>('conics');
  const [saved, setSaved] = useState(false);

  // 2D coordinate state
  const [p1x, setP1x] = useState('1');
  const [p1y, setP1y] = useState('2');
  const [p2x, setP2x] = useState('5');
  const [p2y, setP2y] = useState('5');
  const [p3x, setP3x] = useState('4');
  const [p3y, setP3y] = useState('1');
  const [l1a, setL1a] = useState('2');
  const [l1b, setL1b] = useState('1');
  const [l1c, setL1c] = useState('-6');
  const [l2a, setL2a] = useState('1');
  const [l2b, setL2b] = useState('-1');
  const [l2c, setL2c] = useState('0');

  // Conics Ax^2 + Bxy + Cy^2 + Dx + Ey + F = 0
  const [cA, setCA] = useState('4');
  const [cB, setCB] = useState('0');
  const [cC, setCC] = useState('9');
  const [cD, setCD] = useState('0');
  const [cE, setCE] = useState('0');
  const [cF, setCF] = useState('-36');

  // 2D Transform
  const [tx, setTx] = useState('1');
  const [ty, setTy] = useState('0.5');
  const [angleDeg, setAngleDeg] = useState('35');
  const [sx, setSx] = useState('1.4');
  const [sy, setSy] = useState('0.8');
  const [reflect, setReflect] = useState<'none' | 'x-axis' | 'y-axis' | 'y=x'>('none');

  // 3D Geometry + Interactive Orbit Rotation
  const [p0Str, setP0Str] = useState('1, 2, 2');
  const [d1Str, setD1Str] = useState('1, -1, 2');
  const [p1Str, setP1Str] = useState('0, 1, 0');
  const [d2Str, setD2Str] = useState('2, 1, 1');
  const [pl1Str, setPl1Str] = useState('2, 2, 1, 12');
  const [pl2Str, setPl2Str] = useState('1, -1, 1, 3');
  const [yaw, setYaw] = useState(0.65);
  const [pitch, setPitch] = useState(0.45);
  const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const parseTuple = (s: string, len: number, fallback: number[]) => {
    const arr = s
      .split(/[\s,;]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    return arr.length >= len ? arr.slice(0, len) : fallback;
  };

  const computed = useMemo(() => {
    try {
      if (tab === 'coord2d') {
        return {
          c2d: compute2DCoordinateGeometry(
            [Number(p1x) || 0, Number(p1y) || 0],
            [Number(p2x) || 0, Number(p2y) || 0],
            [Number(p3x) || 0, Number(p3y) || 0],
            { a: Number(l1a) || 0, b: Number(l1b) || 0, c: Number(l1c) || 0 },
            { a: Number(l2a) || 0, b: Number(l2b) || 0, c: Number(l2c) || 0 }
          ),
          error: null as string | null,
        };
      }
      if (tab === 'conics') {
        return {
          conic: analyzeConicSection(
            Number(cA) || 0,
            Number(cB) || 0,
            Number(cC) || 0,
            Number(cD) || 0,
            Number(cE) || 0,
            Number(cF) || 0
          ),
          error: null as string | null,
        };
      }
      if (tab === 'transform2d') {
        return {
          tr2d: apply2DTransform(
            [
              [0, 0],
              [2, 0],
              [2, 1.5],
              [0.6, 1.5],
            ],
            Number(tx) || 0,
            Number(ty) || 0,
            Number(angleDeg) || 0,
            Number(sx) || 1,
            Number(sy) || 1,
            reflect
          ),
          error: null as string | null,
        };
      }
      const pt0 = parseTuple(p0Str, 3, [1, 2, 2]) as [number, number, number];
      const dv1 = parseTuple(d1Str, 3, [1, -1, 2]) as [number, number, number];
      const pt1 = parseTuple(p1Str, 3, [0, 1, 0]) as [number, number, number];
      const dv2 = parseTuple(d2Str, 3, [2, 1, 1]) as [number, number, number];
      const pl1 = parseTuple(pl1Str, 4, [2, 2, 1, 12]);
      const pl2 = parseTuple(pl2Str, 4, [1, -1, 1, 3]);
      return {
        g3d: compute3DGeometry(
          pt0,
          dv1,
          pt1,
          dv2,
          { a: pl1[0], b: pl1[1], c: pl1[2], d: pl1[3] },
          { a: pl2[0], b: pl2[1], c: pl2[2], d: pl2[3] }
        ),
        pt0,
        dv1,
        pl1,
        error: null as string | null,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Geometry calculation error.' };
    }
  }, [
    tab,
    p1x,
    p1y,
    p2x,
    p2y,
    p3x,
    p3y,
    l1a,
    l1b,
    l1c,
    l2a,
    l2b,
    l2c,
    cA,
    cB,
    cC,
    cD,
    cE,
    cF,
    tx,
    ty,
    angleDeg,
    sx,
    sy,
    reflect,
    p0Str,
    d1Str,
    p1Str,
    d2Str,
    pl1Str,
    pl2Str,
  ]);

  // Render interactive 3D plane + line + intersection canvas
  useEffect(() => {
    if (tab !== 'geo3d' || !computed.g3d) return;
    const canvas = canvas3dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const dark = settings.theme === 'dark';
    ctx.fillStyle = dark ? '#12151C' : '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const proj = (x: number, y: number, z: number): [number, number] => {
      const cy = Math.cos(yaw);
      const syw = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const x1 = x * cy - y * syw;
      const y1 = x * syw + y * cy;
      const y2 = y1 * cp - z * sp;
      const scale = Math.min(w, h) / 14;
      return [w / 2 + x1 * scale, h / 2 - y2 * scale];
    };

    // Coordinate Axes
    const axes: { pt: [number, number, number]; color: string; label: string }[] = [
      { pt: [4.5, 0, 0], color: '#EF4444', label: 'X' },
      { pt: [0, 4.5, 0], color: '#10B981', label: 'Y' },
      { pt: [0, 0, 4.5], color: '#3B82F6', label: 'Z' },
    ];
    const origin = proj(0, 0, 0);
    axes.forEach((ax) => {
      const end = proj(...ax.pt);
      ctx.strokeStyle = ax.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      ctx.fillStyle = ax.color;
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText(ax.label, end[0] + 4, end[1] - 4);
    });

    // Plane 1 wireframe patch (solve z from ax + by + cz = d if |c| > 0.1 else y/x)
    const [pa, pb, pc, pd] = computed.pl1!;
    const gridPts: [number, number, number][][] = [];
    const rng = [-3, -1.5, 0, 1.5, 3];
    if (Math.abs(pc) > 0.1) {
      for (const gx of rng) {
        const row: [number, number, number][] = [];
        for (const gy of rng) {
          const gz = Math.max(-5, Math.min(5, (pd - pa * gx - pb * gy) / pc));
          row.push([gx, gy, gz]);
        }
        gridPts.push(row);
      }
      ctx.strokeStyle = 'rgba(47, 124, 246, 0.42)';
      ctx.lineWidth = 1;
      for (let i = 0; i < gridPts.length; i++) {
        for (let j = 0; j < gridPts[i].length; j++) {
          const p = proj(...gridPts[i][j]);
          if (i + 1 < gridPts.length) {
            const pN = proj(...gridPts[i + 1][j]);
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(pN[0], pN[1]);
            ctx.stroke();
          }
          if (j + 1 < gridPts[i].length) {
            const pE = proj(...gridPts[i][j + 1]);
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(pE[0], pE[1]);
            ctx.stroke();
          }
        }
      }
    }

    // 3D Line L1
    const p0 = computed.pt0!;
    const d1 = computed.dv1!;
    const lStart = proj(p0[0] - 2 * d1[0], p0[1] - 2 * d1[1], p0[2] - 2 * d1[2]);
    const lEnd = proj(p0[0] + 2 * d1[0], p0[1] + 2 * d1[1], p0[2] + 2 * d1[2]);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(lStart[0], lStart[1]);
    ctx.lineTo(lEnd[0], lEnd[1]);
    ctx.stroke();

    // Intersection marker
    if (computed.g3d.linePlaneIntersection) {
      const ip = proj(...computed.g3d.linePlaneIntersection);
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(ip[0], ip[1], 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [tab, computed, yaw, pitch, settings.theme]);

  const handleSave = () => {
    triggerHaptic(settings.hapticsEnabled, 10);
    const steps =
      computed.c2d?.steps ??
      computed.conic?.steps ??
      computed.tr2d?.steps ??
      computed.g3d?.steps ??
      [];
    onSaveToNotebook({
      title: `Advanced Geometry · ${tab}`,
      topic: 'Geometry',
      content: steps.map((s) => `**${s.rule}**: ${s.description}\n$$${s.latex}$$`).join('\n\n'),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const handlePdf = () => {
    triggerHaptic(settings.hapticsEnabled, 10);
    const steps =
      computed.c2d?.steps ??
      computed.conic?.steps ??
      computed.tr2d?.steps ??
      computed.g3d?.steps ??
      [];
    downloadSingleSolutionPdf({
      title: `Advanced Geometry Lab (${tab})`,
      expression: tab,
      resultPlain: steps.map((s) => `${s.rule}: ${s.description}`).join(' | '),
      steps,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#2F7CF6]" />
              Advanced Geometry Lab
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              2D coordinate distances &amp; intersections, general conic section classification &amp; plotting, homogeneous geometric transformations, and interactive 3D lines &amp; planes.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSave}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              {saved ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saved ? 'Saved' : 'Save Note'}</span>
            </button>
            <button
              type="button"
              onClick={handlePdf}
              className="h-9 px-3.5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'conics', label: 'Conic Sections' },
              { id: 'coord2d', label: '2D Coordinate & Lines' },
              { id: 'transform2d', label: 'Geometric Transformations' },
              { id: 'geo3d', label: '3D Lines & Planes' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONICS */}
      {tab === 'conics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              General Conic: Ax² + Bxy + Cy² + Dx + Ey + F = 0
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'A (x²)', val: cA, set: setCA },
                { label: 'B (xy)', val: cB, set: setCB },
                { label: 'C (y²)', val: cC, set: setCC },
                { label: 'D (x)', val: cD, set: setCD },
                { label: 'E (y)', val: cE, set: setCE },
                { label: 'F (const)', val: cF, set: setCF },
              ].map((item) => (
                <div key={item.label}>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">{item.label}</label>
                  <input
                    type="number"
                    value={item.val}
                    onChange={(e) => item.set(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: 'Circle', v: ['1', '0', '1', '-2', '-4', '-4'] },
                { label: 'Ellipse', v: ['4', '0', '9', '0', '0', '-36'] },
                { label: 'Parabola', v: ['1', '0', '0', '-2', '-4', '5'] },
                { label: 'Hyperbola', v: ['4', '0', '-9', '0', '0', '-36'] },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setCA(p.v[0]);
                    setCB(p.v[1]);
                    setCC(p.v[2]);
                    setCD(p.v[3]);
                    setCE(p.v[4]);
                    setCF(p.v[5]);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200 font-medium"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {computed.conic && (
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Classified Conic: <span className="text-[#2F7CF6]">{computed.conic.kind}</span>
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    e = {computed.conic.eccentricity.toFixed(4)}
                  </span>
                </div>
                <svg viewBox="0 0 360 260" className="w-full h-64 rounded-xl bg-slate-50 dark:bg-[#12151C]">
                  <line x1="0" y1="130" x2="360" y2="130" stroke="rgba(148,163,184,0.3)" />
                  <line x1="180" y1="0" x2="180" y2="260" stroke="rgba(148,163,184,0.3)" />
                  {computed.conic.samples.map((seg, idx) => (
                    <line
                      key={idx}
                      x1={180 + seg[0].x * 16}
                      y1={130 - seg[0].y * 12}
                      x2={180 + seg[1].x * 16}
                      y2={130 - seg[1].y * 12}
                      stroke="#2F7CF6"
                      strokeWidth="2.2"
                    />
                  ))}
                  {computed.conic.center && (
                    <circle
                      cx={180 + computed.conic.center[0] * 16}
                      cy={130 - computed.conic.center[1] * 12}
                      r="4"
                      fill="#F59E0B"
                    />
                  )}
                  {computed.conic.foci.map((f, i) => (
                    <circle key={i} cx={180 + f[0] * 16} cy={130 - f[1] * 12} r="4" fill="#10B981" />
                  ))}
                </svg>
                <div className="overflow-x-auto text-slate-900 dark:text-white">
                  <MathTex tex={computed.conic.standardLatex} display />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2D COORDINATE GEOMETRY */}
      {tab === 'coord2d' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3 text-xs">
            <div className="font-semibold text-slate-900 dark:text-white">Vertices P₁, P₂, P₃</div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={p1x} onChange={(e) => setP1x(e.target.value)} aria-label="P1 x" className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="number" value={p1y} onChange={(e) => setP1y(e.target.value)} aria-label="P1 y" className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="number" value={p2x} onChange={(e) => setP2x(e.target.value)} aria-label="P2 x" className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="number" value={p2y} onChange={(e) => setP2y(e.target.value)} aria-label="P2 y" className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="number" value={p3x} onChange={(e) => setP3x(e.target.value)} aria-label="P3 x" className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="number" value={p3y} onChange={(e) => setP3y(e.target.value)} aria-label="P3 y" className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
            </div>
            <div className="font-semibold text-slate-900 dark:text-white pt-2">Lines ax + by + c = 0</div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={l1a} onChange={(e) => setL1a(e.target.value)} aria-label="L1 a" className="h-9 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="number" value={l1b} onChange={(e) => setL1b(e.target.value)} aria-label="L1 b" className="h-9 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="number" value={l1c} onChange={(e) => setL1c(e.target.value)} aria-label="L1 c" className="h-9 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="number" value={l2a} onChange={(e) => setL2a(e.target.value)} aria-label="L2 a" className="h-9 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="number" value={l2b} onChange={(e) => setL2b(e.target.value)} aria-label="L2 b" className="h-9 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="number" value={l2c} onChange={(e) => setL2c(e.target.value)} aria-label="L2 c" className="h-9 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
            </div>
          </div>
          {computed.c2d && (
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
              {computed.c2d.steps.map((st) => (
                <div key={st.id} className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3 text-xs space-y-1">
                  <div className="font-semibold text-[#2F7CF6]">{st.rule}</div>
                  <div className="text-slate-600 dark:text-slate-300">{st.description}</div>
                  <MathTex tex={st.latex} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2D TRANSFORMATIONS */}
      {tab === 'transform2d' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-500 dark:text-slate-400">Translate X</label>
                <input type="number" step="0.5" value={tx} onChange={(e) => setTx(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400">Translate Y</label>
                <input type="number" step="0.5" value={ty} onChange={(e) => setTy(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400">Scale s_x</label>
                <input type="number" step="0.1" value={sx} onChange={(e) => setSx(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400">Scale s_y</label>
                <input type="number" step="0.1" value={sy} onChange={(e) => setSy(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              </div>
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400">Rotation θ: {angleDeg}°</label>
              <input type="range" min={-180} max={180} value={Number(angleDeg) || 0} onChange={(e) => setAngleDeg(e.target.value)} className="w-full accent-[#2F7CF6]" />
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400">Reflection</label>
              <select
                value={reflect}
                onChange={(e) => setReflect(e.target.value as typeof reflect)}
                className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E]"
              >
                <option value="none">None</option>
                <option value="x-axis">Reflect across x-axis</option>
                <option value="y-axis">Reflect across y-axis</option>
                <option value="y=x">Reflect across y = x</option>
              </select>
            </div>
          </div>

          {computed.tr2d && (
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
              <svg viewBox="0 0 360 250" className="w-full h-64 rounded-xl bg-slate-50 dark:bg-[#12151C]">
                <line x1="0" y1="125" x2="360" y2="125" stroke="rgba(148,163,184,0.3)" />
                <line x1="180" y1="0" x2="180" y2="250" stroke="rgba(148,163,184,0.3)" />
                <polygon
                  points={computed.tr2d.original.map(([x, y]) => `${180 + x * 28},${125 - y * 28}`).join(' ')}
                  fill="rgba(148,163,184,0.18)"
                  stroke="#94A3B8"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
                <polygon
                  points={computed.tr2d.transformed.map(([x, y]) => `${180 + x * 28},${125 - y * 28}`).join(' ')}
                  fill="rgba(47,124,246,0.22)"
                  stroke="#2F7CF6"
                  strokeWidth="2.2"
                />
              </svg>
              <div className="overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={computed.tr2d.steps[0].latex} display />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3D GEOMETRY */}
      {tab === 'geo3d' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3 text-xs">
            <div>
              <label className="text-slate-500 dark:text-slate-400">Line L₁ Point P₀ (x, y, z)</label>
              <input type="text" value={p0Str} onChange={(e) => setP0Str(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400">Line L₁ Direction d₁</label>
              <input type="text" value={d1Str} onChange={(e) => setD1Str(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400">Line L₂ Point P₁ &amp; Direction d₂</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input type="text" value={p1Str} onChange={(e) => setP1Str(e.target.value)} className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
                <input type="text" value={d2Str} onChange={(e) => setD2Str(e.target.value)} className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              </div>
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400">Plane Π₁ (a, b, c, d for ax+by+cz=d)</label>
              <input type="text" value={pl1Str} onChange={(e) => setPl1Str(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400">Plane Π₂ (a, b, c, d)</label>
              <input type="text" value={pl2Str} onChange={(e) => setPl2Str(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
            </div>
          </div>

          {computed.g3d && (
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Interactive 3D Line-Plane Viewport (Drag to Rotate)
                  </span>
                  <span>Green dot = L₁ ∩ Π₁</span>
                </div>
                <canvas
                  ref={canvas3dRef}
                  onPointerDown={(e) => {
                    dragRef.current = { x: e.clientX, y: e.clientY };
                  }}
                  onPointerMove={(e) => {
                    if (!dragRef.current) return;
                    const dx = e.clientX - dragRef.current.x;
                    const dy = e.clientY - dragRef.current.y;
                    dragRef.current = { x: e.clientX, y: e.clientY };
                    setYaw((v) => v + dx * 0.01);
                    setPitch((v) => Math.max(-1.4, Math.min(1.4, v + dy * 0.01)));
                  }}
                  onPointerUp={() => {
                    dragRef.current = null;
                  }}
                  onPointerLeave={() => {
                    dragRef.current = null;
                  }}
                  className="w-full h-64 rounded-xl cursor-grab active:cursor-grabbing touch-none"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-2.5">
                {computed.g3d.steps.map((st) => (
                  <div key={st.id} className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3 text-xs space-y-1">
                    <div className="font-semibold text-[#2F7CF6]">{st.rule}</div>
                    <div className="text-slate-600 dark:text-slate-300">{st.description}</div>
                    <MathTex tex={st.latex} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
