import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Compass, FileDown, Save } from 'lucide-react';
import {
  polarToRectangular,
  solveComplexArithmetic,
  solveDeMoivreAndRoots,
} from '../engine/complexNumbers';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface ComplexNumbersViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

type ComplexTab = 'arithmetic' | 'polar' | 'demoivre';

export function ComplexNumbersView({ settings, onSaveToNotebook }: ComplexNumbersViewProps) {
  const [tab, setTab] = useState<ComplexTab>('arithmetic');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  // z1, z2 rectangular
  const [re1, setRe1] = useState('3');
  const [im1, setIm1] = useState('4');
  const [re2, setRe2] = useState('1');
  const [im2, setIm2] = useState('-2');

  // Polar input
  const [polarR, setPolarR] = useState('5');
  const [polarTheta, setPolarTheta] = useState('53.13');
  const [polarUnit, setPolarUnit] = useState<'deg' | 'rad'>('deg');

  // De Moivre & Roots
  const [powerN, setPowerN] = useState('3');
  const [rootN, setRootN] = useState('5');

  const activeZ1 = useMemo(() => {
    if (tab === 'polar') {
      return polarToRectangular(Number(polarR) || 0, Number(polarTheta) || 0, polarUnit);
    }
    return { re: Number(re1) || 0, im: Number(im1) || 0 };
  }, [tab, re1, im1, polarR, polarTheta, polarUnit]);

  const computed = useMemo(() => {
    try {
      const arith = solveComplexArithmetic(activeZ1, {
        re: Number(re2) || 0,
        im: Number(im2) || 0,
      });
      const demoivre = solveDeMoivreAndRoots(
        activeZ1,
        Math.round(Number(powerN) || 2),
        Math.max(2, Math.round(Number(rootN) || 4))
      );
      return { arith, demoivre, error: null as string | null };
    } catch (e) {
      return {
        arith: null,
        demoivre: null,
        error: e instanceof Error ? e.message : 'Unable to evaluate complex numbers.',
      };
    }
  }, [activeZ1, re2, im2, powerN, rootN]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !computed.arith || !computed.demoivre) return;
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

    const ptsToFit =
      tab === 'demoivre'
        ? [computed.demoivre.base, ...computed.demoivre.roots]
        : [computed.arith.z1, computed.arith.z2, computed.arith.sum];
    const maxR = Math.max(
      2,
      ...ptsToFit.map((p) => Math.max(Math.abs(p.re), Math.abs(p.im), p.modulus))
    );
    const span = maxR * 1.3;
    const scale = Math.min(w, h) / (span * 2);
    const cx = w / 2;
    const cy = h / 2;
    const sx = (x: number) => cx + x * scale;
    const sy = (y: number) => cy - y * scale;

    // Axes
    ctx.strokeStyle = dark ? 'rgba(203,213,225,0.35)' : 'rgba(15,23,42,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();
    ctx.fillStyle = dark ? '#94A3B8' : '#475569';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText('Re', w - 22, cy - 6);
    ctx.fillText('Im', cx + 6, 14);

    const drawVector = (re: number, im: number, color: string, label: string) => {
      const ex = sx(re);
      const ey = sy(im);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(label, ex + 6, ey - 5);
    };

    if (tab === 'demoivre') {
      const { roots, base } = computed.demoivre;
      const rootR = roots[0]?.modulus ?? 0;
      if (rootR > 0) {
        ctx.strokeStyle = dark ? 'rgba(148,163,184,0.28)' : 'rgba(15,23,42,0.2)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, rootR * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Polygon connecting roots
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        roots.forEach((rt, idx) => {
          if (idx === 0) ctx.moveTo(sx(rt.re), sy(rt.im));
          else ctx.lineTo(sx(rt.re), sy(rt.im));
        });
        ctx.closePath();
        ctx.stroke();
      }
      roots.forEach((rt) => drawVector(rt.re, rt.im, '#10B981', `w${rt.k}`));
      drawVector(base.re, base.im, '#2F7CF6', 'z');
    } else {
      const { z1, z2, sum } = computed.arith;
      ctx.strokeStyle = dark ? 'rgba(148,163,184,0.28)' : 'rgba(15,23,42,0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, z1.modulus * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      drawVector(z1.re, z1.im, '#2F7CF6', 'z₁');
      if (tab === 'arithmetic') {
        drawVector(z2.re, z2.im, '#10B981', 'z₂');
        drawVector(sum.re, sum.im, '#F59E0B', 'z₁+z₂');
      }
    }

    ctx.restore();
  }, [computed, tab, settings.theme]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#2F7CF6]" />
              Complex Numbers Lab
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Complex arithmetic, modulus &amp; argument, Rectangular ↔ Polar ↔ Exponential conversions, De Moivre&apos;s theorem, nth roots, and interactive Argand plane plotting.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'arithmetic', label: 'Arithmetic & Argand' },
                { id: 'polar', label: 'Polar / Exponential' },
                { id: 'demoivre', label: "De Moivre & nth Roots" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-[#2F7CF6] text-white'
                    : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          {tab === 'polar' ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Polar Input: z₁ = r ∠ θ
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Modulus r</label>
                  <input type="number" step="any" value={polarR} onChange={(e) => setPolarR(e.target.value)} className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Angle θ</label>
                  <input type="number" step="any" value={polarTheta} onChange={(e) => setPolarTheta(e.target.value)} className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Unit</label>
                  <select value={polarUnit} onChange={(e) => setPolarUnit(e.target.value as 'deg' | 'rad')} className="mt-1 w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] font-mono text-sm">
                    <option value="deg">deg (°)</option>
                    <option value="rad">rad</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Re(z₁)</label>
                <input type="number" step="any" value={re1} onChange={(e) => setRe1(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Im(z₁)</label>
                <input type="number" step="any" value={im1} onChange={(e) => setIm1(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm" />
              </div>
            </div>
          )}

          {tab === 'arithmetic' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Re(z₂)</label>
                <input type="number" step="any" value={re2} onChange={(e) => setRe2(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Im(z₂)</label>
                <input type="number" step="any" value={im2} onChange={(e) => setIm2(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm" />
              </div>
            </div>
          )}

          {tab === 'demoivre' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Power n (z₁ⁿ)</label>
                <input type="number" min="-12" max="12" value={powerN} onChange={(e) => setPowerN(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Root order k (z₁^(1/k))</label>
                <input type="number" min="2" max="12" value={rootN} onChange={(e) => setRootN(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm" />
              </div>
            </div>
          )}

          {computed.error && (
            <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
              {computed.error}
            </div>
          )}

          {computed.arith && computed.demoivre && (
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
              {(tab === 'demoivre' ? computed.demoivre.steps : computed.arith.steps).map((s) => (
                <div key={s.id} className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-3 text-xs space-y-1">
                  <div className="font-semibold text-[#2F7CF6]">{s.rule}</div>
                  <div className="text-slate-600 dark:text-slate-400">{s.description}</div>
                  <div className="overflow-x-auto text-slate-900 dark:text-slate-100">
                    <MathTex tex={s.latex} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Argand Plane & Forms */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Argand Plane &amp; Complex Forms
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!computed.arith}
                onClick={() => {
                  if (!computed.arith) return;
                  triggerHaptic(settings.hapticsEnabled, 12);
                  onSaveToNotebook({
                    title: `Complex Lab: z₁ = ${computed.arith.z1.rectangularLatex}`,
                    topic: 'Complex Numbers',
                    content: `Rectangular: ${computed.arith.z1.rectangularLatex}\nExponential: $$${computed.arith.z1.exponentialLatex}$$`,
                  });
                  setSavedNote(true);
                  setTimeout(() => setSavedNote(false), 1600);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
              >
                {savedNote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savedNote ? 'Saved' : 'Note'}</span>
              </button>
              <button
                type="button"
                disabled={!computed.arith || !computed.demoivre}
                onClick={() => {
                  if (!computed.arith || !computed.demoivre) return;
                  downloadSingleSolutionPdf({
                    title: `Complex Numbers (${tab})`,
                    expression: `z1 = ${computed.arith.z1.rectangularLatex}`,
                    resultPlain: `|z1| = ${computed.arith.z1.modulus.toFixed(4)}, arg = ${computed.arith.z1.argDeg.toFixed(2)} deg`,
                    steps: tab === 'demoivre' ? computed.demoivre.steps : computed.arith.steps,
                  });
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          {computed.arith && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                <div className="text-slate-500 dark:text-slate-400">Modulus &amp; Arg</div>
                <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  r = {computed.arith.z1.modulus.toFixed(4)} · {computed.arith.z1.argDeg.toFixed(2)}°
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3 overflow-x-auto">
                <div className="text-slate-500 dark:text-slate-400">Polar Form</div>
                <div className="mt-0.5 text-slate-900 dark:text-white">
                  <MathTex tex={computed.arith.z1.polarLatex} />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3 overflow-x-auto">
                <div className="text-slate-500 dark:text-slate-400">Exponential Form</div>
                <div className="mt-0.5 text-slate-900 dark:text-white">
                  <MathTex tex={computed.arith.z1.exponentialLatex} />
                </div>
              </div>
            </div>
          )}

          {tab === 'demoivre' && computed.demoivre && (
            <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                All {computed.demoivre.rootN} Distinct Roots on Circle r = {computed.demoivre.roots[0]?.modulus.toFixed(4)}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono">
                {computed.demoivre.roots.map((rt) => (
                  <div key={rt.k} className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1D212B] border border-slate-200 dark:border-white/10">
                    w_{rt.k} = {rt.rectangularLatex} ({rt.argDeg.toFixed(1)}°)
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 h-[310px]">
            <canvas ref={canvasRef} className="w-full h-full block" />
          </div>
        </div>
      </div>
    </div>
  );
}
