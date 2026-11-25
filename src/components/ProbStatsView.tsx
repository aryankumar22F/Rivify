import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart2, Check, FileDown, Save } from 'lucide-react';
import {
  computeCombinatoricsAndBayes,
  computeDescriptiveStats,
  computeDistribution,
  computeLinearRegression,
  type DistributionType,
} from '../engine/probabilityStats';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface ProbStatsViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

type PsTab = 'descriptive' | 'bayes' | 'distribution' | 'regression';

export function ProbStatsView({ settings, onSaveToNotebook }: ProbStatsViewProps) {
  const [tab, setTab] = useState<PsTab>('descriptive');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  // Descriptive
  const [datasetText, setDatasetText] = useState('12, 15, 18, 18, 21, 24, 27, 30, 32, 35');

  // Combinatorics & Bayes
  const [nVal, setNVal] = useState('8');
  const [rVal, setRVal] = useState('3');
  const [pA, setPA] = useState('0.02');
  const [pBGivenA, setPBGivenA] = useState('0.95');
  const [pBGivenNotA, setPBGivenNotA] = useState('0.05');

  // Distributions
  const [distType, setDistType] = useState<DistributionType>('binomial');
  const [distN, setDistN] = useState('12');
  const [distP, setDistP] = useState('0.4');
  const [distLambda, setDistLambda] = useState('4');
  const [distMean, setDistMean] = useState('100');
  const [distStd, setDistStd] = useState('15');
  const [distK, setDistK] = useState('5');
  const [normLow, setNormLow] = useState('85');
  const [normHigh, setNormHigh] = useState('115');

  // Regression
  const [pointsText, setPointsText] = useState('1, 2.1\n2, 3.9\n3, 6.2\n4, 7.8\n5, 10.3\n6, 11.9');
  const [predictX, setPredictX] = useState('7');

  const computed = useMemo(() => {
    try {
      if (tab === 'descriptive') {
        const nums = datasetText
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map(Number);
        const res = computeDescriptiveStats(nums);
        return { tab: 'descriptive' as const, res, error: null as string | null };
      }
      if (tab === 'bayes') {
        const res = computeCombinatoricsAndBayes({
          n: Number(nVal),
          r: Number(rVal),
          pA: Number(pA),
          pBGivenA: Number(pBGivenA),
          pBGivenNotA: Number(pBGivenNotA),
        });
        return { tab: 'bayes' as const, res, error: null as string | null };
      }
      if (tab === 'distribution') {
        const res = computeDistribution({
          type: distType,
          n: Number(distN),
          p: Number(distP),
          lambda: Number(distLambda),
          mean: Number(distMean),
          stdDev: Number(distStd),
          k: Number(distK),
          xLow: Number(normLow),
          xHigh: Number(normHigh),
        });
        return { tab: 'distribution' as const, res, error: null as string | null };
      }
      const pts = pointsText
        .split(/\n|;/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(/[,\s]+/).map(Number);
          return { x: parts[0], y: parts[1] };
        });
      const res = computeLinearRegression(pts, predictX.trim() ? Number(predictX) : undefined);
      return { tab: 'regression' as const, res, error: null as string | null };
    } catch (e) {
      return {
        tab,
        res: null,
        error: e instanceof Error ? e.message : 'Unable to compute statistics.',
      };
    }
  }, [
    tab,
    datasetText,
    nVal,
    rVal,
    pA,
    pBGivenA,
    pBGivenNotA,
    distType,
    distN,
    distP,
    distLambda,
    distMean,
    distStd,
    distK,
    normLow,
    normHigh,
    pointsText,
    predictX,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !computed.res) return;
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
    const pad = 36;

    if (computed.tab === 'descriptive' && computed.res) {
      const bins = computed.res.histogramBins;
      const maxCount = Math.max(1, ...bins.map((b) => b.count));
      const bw = (w - pad * 2) / bins.length;
      bins.forEach((bin, i) => {
        const barH = (bin.count / maxCount) * (h - pad * 2);
        ctx.fillStyle = '#2F7CF6';
        ctx.fillRect(pad + i * bw + 4, h - pad - barH, Math.max(8, bw - 8), barH);
        ctx.fillStyle = dark ? '#CBD5E1' : '#334155';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(String(bin.count), pad + i * bw + bw / 2 - 4, h - pad - barH - 5);
        ctx.fillText(bin.label.split('–')[0], pad + i * bw + 4, h - 14);
      });
    } else if (computed.tab === 'distribution' && computed.res) {
      const series = computed.res.series;
      const maxD = Math.max(1e-6, ...series.map((s) => s.density));
      if (computed.res.type === 'normal') {
        const minX = series[0].x;
        const maxX = series[series.length - 1].x;
        const toX = (x: number) => pad + ((x - minX) / Math.max(1e-6, maxX - minX)) * (w - pad * 2);
        const toY = (d: number) => h - pad - (d / maxD) * (h - pad * 2);

        // Shaded interval
        const hi = series.filter((s) => s.highlighted);
        if (hi.length > 1) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
          ctx.beginPath();
          ctx.moveTo(toX(hi[0].x), h - pad);
          hi.forEach((pt) => ctx.lineTo(toX(pt.x), toY(pt.density)));
          ctx.lineTo(toX(hi[hi.length - 1].x), h - pad);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = '#2F7CF6';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        series.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(toX(pt.x), toY(pt.density));
          else ctx.lineTo(toX(pt.x), toY(pt.density));
        });
        ctx.stroke();
      } else {
        const bw = (w - pad * 2) / Math.max(1, series.length);
        series.forEach((pt, i) => {
          const barH = (pt.density / maxD) * (h - pad * 2);
          ctx.fillStyle = pt.highlighted ? '#10B981' : '#2F7CF6';
          ctx.fillRect(pad + i * bw + 2, h - pad - barH, Math.max(4, bw - 4), barH);
        });
      }
    } else if (computed.tab === 'regression' && computed.res) {
      const { points, slope, intercept } = computed.res;
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const minX = Math.min(...xs) - 0.5;
      const maxX = Math.max(...xs) + 0.5;
      const minY = Math.min(...ys, intercept + slope * minX) - 0.5;
      const maxY = Math.max(...ys, intercept + slope * maxX) + 0.5;
      const toX = (x: number) => pad + ((x - minX) / Math.max(1e-6, maxX - minX)) * (w - pad * 2);
      const toY = (y: number) => h - pad - ((y - minY) / Math.max(1e-6, maxY - minY)) * (h - pad * 2);

      // Regression line
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(toX(minX), toY(intercept + slope * minX));
      ctx.lineTo(toX(maxX), toY(intercept + slope * maxX));
      ctx.stroke();

      // Scatter points
      ctx.fillStyle = '#2F7CF6';
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(toX(p.x), toY(p.y), 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (computed.tab === 'bayes' && computed.res) {
      const bars = [
        { lbl: 'P(A)', val: computed.res.pA, col: '#64748B' },
        { lbl: 'P(B)', val: computed.res.pB, col: '#F59E0B' },
        { lbl: 'P(A|B)', val: computed.res.pAGivenB, col: '#10B981' },
      ];
      const bw = (w - pad * 2) / 3;
      bars.forEach((b, i) => {
        const bh = b.val * (h - pad * 2);
        ctx.fillStyle = b.col;
        ctx.fillRect(pad + i * bw + 18, h - pad - bh, Math.max(20, bw - 36), bh);
        ctx.fillStyle = dark ? '#E2E8F0' : '#0F172A';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillText(`${b.lbl}=${(b.val * 100).toFixed(1)}%`, pad + i * bw + 16, h - pad - bh - 6);
      });
    }

    ctx.restore();
  }, [computed, settings.theme]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#2F7CF6]" />
              Probability &amp; Statistics Lab
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Descriptive statistics, combinatorics &amp; Bayes theorem, Binomial/Poisson/Normal distributions, and correlation with least-squares linear regression.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'descriptive', label: 'Descriptive Stats' },
                { id: 'bayes', label: 'Combinatorics & Bayes' },
                { id: 'distribution', label: 'Distributions' },
                { id: 'regression', label: 'Correlation & Regression' },
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
        {/* Inputs */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          {tab === 'descriptive' && (
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Dataset (comma or space separated numbers)
              </label>
              <textarea
                rows={4}
                value={datasetText}
                onChange={(e) => setDatasetText(e.target.value)}
                className="mt-1 w-full p-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm"
              />
            </div>
          )}

          {tab === 'bayes' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">n (Total)</label>
                  <input
                    type="number"
                    value={nVal}
                    onChange={(e) => setNVal(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">r (Choose)</label>
                  <input
                    type="number"
                    value={rVal}
                    onChange={(e) => setRVal(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">P(A)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pA}
                    onChange={(e) => setPA(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">P(B | A)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pBGivenA}
                    onChange={(e) => setPBGivenA(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">P(B | Aᶜ)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pBGivenNotA}
                    onChange={(e) => setPBGivenNotA(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums"
                  />
                </div>
              </div>
            </>
          )}

          {tab === 'distribution' && (
            <>
              <div className="flex gap-1.5">
                {(['binomial', 'poisson', 'normal'] as const).map((dt) => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => setDistType(dt)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-medium capitalize ${
                      distType === dt
                        ? 'bg-[#2F7CF6] text-white'
                        : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {dt}
                  </button>
                ))}
              </div>

              {distType === 'binomial' && (
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Trials n</label>
                    <input type="number" value={distN} onChange={(e) => setDistN(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Prob p</label>
                    <input type="number" step="0.05" value={distP} onChange={(e) => setDistP(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Target k</label>
                    <input type="number" value={distK} onChange={(e) => setDistK(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs" />
                  </div>
                </div>
              )}

              {distType === 'poisson' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Rate λ</label>
                    <input type="number" step="0.2" value={distLambda} onChange={(e) => setDistLambda(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Target k</label>
                    <input type="number" value={distK} onChange={(e) => setDistK(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs" />
                  </div>
                </div>
              )}

              {distType === 'normal' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Mean μ</label>
                    <input type="number" step="any" value={distMean} onChange={(e) => setDistMean(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Std Dev σ</label>
                    <input type="number" step="any" value={distStd} onChange={(e) => setDistStd(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Lower a</label>
                    <input type="number" step="any" value={normLow} onChange={(e) => setNormLow(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Upper b</label>
                    <input type="number" step="any" value={normHigh} onChange={(e) => setNormHigh(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs" />
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'regression' && (
            <>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Data Pairs (one "x, y" per line)
                </label>
                <textarea
                  rows={5}
                  value={pointsText}
                  onChange={(e) => setPointsText(e.target.value)}
                  className="mt-1 w-full p-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Predict ŷ at x =</label>
                <input
                  type="number"
                  step="any"
                  value={predictX}
                  onChange={(e) => setPredictX(e.target.value)}
                  className="mt-1 w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm"
                />
              </div>
            </>
          )}

          {computed.error && (
            <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
              {computed.error}
            </div>
          )}

          {computed.res && (
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
              {computed.res.steps.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-3 text-xs space-y-1"
                >
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

        {/* Summary Cards + Chart */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Statistical Metrics &amp; Chart
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!computed.res}
                onClick={() => {
                  if (!computed.res) return;
                  triggerHaptic(settings.hapticsEnabled, 12);
                  onSaveToNotebook({
                    title: `Prob & Stats (${tab})`,
                    topic: 'Probability & Statistics',
                    content: computed.res.steps.map((s) => `${s.rule}: $$${s.latex}$$`).join('\n'),
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
                disabled={!computed.res}
                onClick={() => {
                  if (!computed.res) return;
                  downloadSingleSolutionPdf({
                    title: `Probability & Statistics (${tab})`,
                    expression: tab,
                    resultPlain: computed.res.steps[computed.res.steps.length - 1]?.description ?? 'Analyzed',
                    steps: computed.res.steps,
                  });
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          {computed.tab === 'descriptive' && computed.res && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {[
                { lbl: 'Mean', val: computed.res.mean.toFixed(4) },
                { lbl: 'Median', val: computed.res.median.toFixed(4) },
                { lbl: 'Sample SD', val: computed.res.sampleStdDev.toFixed(4) },
                { lbl: 'IQR', val: computed.res.iqr.toFixed(4) },
              ].map((m) => (
                <div key={m.lbl} className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                  <div className="text-slate-500 dark:text-slate-400">{m.lbl}</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">{m.val}</div>
                </div>
              ))}
            </div>
          )}

          {computed.tab === 'bayes' && computed.res && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {[
                { lbl: 'ⁿPᵣ', val: computed.res.nPr },
                { lbl: 'ⁿCᵣ', val: computed.res.nCr },
                { lbl: 'P(B)', val: computed.res.pB.toFixed(5) },
                { lbl: 'P(A | B)', val: computed.res.pAGivenB.toFixed(5) },
              ].map((m) => (
                <div key={m.lbl} className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                  <div className="text-slate-500 dark:text-slate-400">{m.lbl}</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">{m.val}</div>
                </div>
              ))}
            </div>
          )}

          {computed.tab === 'distribution' && computed.res && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {[
                { lbl: computed.res.pointValueLabel, val: computed.res.pointProb.toFixed(5) },
                { lbl: 'CDF F(x)', val: computed.res.cdfProb.toFixed(5) },
                {
                  lbl: computed.res.type === 'normal' ? 'P(a ≤ X ≤ b)' : 'P(X ≥ k)',
                  val: computed.res.intervalProb.toFixed(5),
                },
                { lbl: 'Mean μ', val: computed.res.mean.toFixed(3) },
              ].map((m) => (
                <div key={m.lbl} className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                  <div className="text-slate-500 dark:text-slate-400">{m.lbl}</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">{m.val}</div>
                </div>
              ))}
            </div>
          )}

          {computed.tab === 'regression' && computed.res && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {[
                { lbl: 'Slope b₁', val: computed.res.slope.toFixed(4) },
                { lbl: 'Intercept b₀', val: computed.res.intercept.toFixed(4) },
                { lbl: 'Pearson r / R²', val: `${computed.res.r.toFixed(3)} / ${computed.res.rSquared.toFixed(3)}` },
                {
                  lbl: `ŷ(${computed.res.predictedX ?? '—'})`,
                  val: computed.res.predictedY !== undefined ? computed.res.predictedY.toFixed(4) : '—',
                },
              ].map((m) => (
                <div key={m.lbl} className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                  <div className="text-slate-500 dark:text-slate-400">{m.lbl}</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">{m.val}</div>
                </div>
              ))}
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
