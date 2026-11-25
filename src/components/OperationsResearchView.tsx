import { useMemo, useState } from 'react';
import { Check, FileDown, Save, Sliders } from 'lucide-react';
import {
  solveAssignmentHungarian,
  solveDecisionTheory,
  solveLinearProgramSimplex,
  solveMaxFlow,
  solveTransportation,
  type LPConstraint,
} from '../engine/operationsResearch';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface OperationsResearchViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

type OrTab = 'lp' | 'transportation' | 'assignment' | 'network' | 'decision';

export function OperationsResearchView({ settings, onSaveToNotebook }: OperationsResearchViewProps) {
  const [tab, setTab] = useState<OrTab>('lp');
  const [saved, setSaved] = useState(false);

  // LP Simplex & Graphical state
  const [objType, setObjType] = useState<'max' | 'min'>('max');
  const [c1, setC1] = useState('40');
  const [c2, setC2] = useState('30');
  const [conRows, setConRows] = useState<LPConstraint[]>([
    { coeffs: [1, 2], sign: '<=', rhs: 40 },
    { coeffs: [4, 3], sign: '<=', rhs: 120 },
  ]);

  // Transportation state (3x3)
  const [transMethod, setTransMethod] = useState<'vam' | 'least-cost' | 'nw-corner'>('vam');
  const [transCosts, setTransCosts] = useState([
    [19, 30, 50],
    [70, 30, 40],
    [40, 8, 70],
  ]);
  const [supplyStr, setSupplyStr] = useState('7, 9, 18');
  const [demandStr, setDemandStr] = useState('5, 8, 21');

  // Assignment 3x3
  const [assignCosts, setAssignCosts] = useState([
    [9, 2, 7],
    [6, 4, 3],
    [5, 8, 1],
  ]);

  // Network Max Flow
  const [flowEdgesRaw, setFlowEdgesRaw] = useState('S A 10\nS B 8\nA B 5\nA T 7\nB T 10');
  const [flowSource, setFlowSource] = useState('S');
  const [flowSink, setFlowSink] = useState('T');

  // Decision Theory
  const [payoffs, setPayoffs] = useState([
    [120, 80, -20],
    [70, 75, 45],
    [40, 50, 60],
  ]);
  const [probsStr, setProbsStr] = useState('0.3, 0.5, 0.2');
  const [hurwiczAlpha, setHurwiczAlpha] = useState(0.6);

  const computed = useMemo(() => {
    try {
      if (tab === 'lp') {
        return {
          lp: solveLinearProgramSimplex(objType, [Number(c1) || 0, Number(c2) || 0], conRows),
          error: null as string | null,
        };
      }
      if (tab === 'transportation') {
        const sup = supplyStr.split(/[\s,;]+/).map(Number).filter(Number.isFinite);
        const dem = demandStr.split(/[\s,;]+/).map(Number).filter(Number.isFinite);
        return {
          tr: solveTransportation(transCosts, sup, dem, transMethod),
          error: null as string | null,
        };
      }
      if (tab === 'assignment') {
        return {
          asg: solveAssignmentHungarian(assignCosts),
          error: null as string | null,
        };
      }
      if (tab === 'network') {
        const edges = flowEdgesRaw
          .split(/[\n;]+/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const p = l.split(/[\s,:-]+/);
            return { u: p[0], v: p[1], capacity: Number(p[2]) || 0 };
          });
        return {
          flow: solveMaxFlow(edges, flowSource.trim() || 'S', flowSink.trim() || 'T'),
          error: null as string | null,
        };
      }
      const probs = probsStr.split(/[\s,;]+/).map(Number).filter(Number.isFinite);
      return {
        dt: solveDecisionTheory(['Option A', 'Option B', 'Option C'], payoffs, probs, hurwiczAlpha),
        error: null as string | null,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Unable to solve Operations Research model.' };
    }
  }, [tab, objType, c1, c2, conRows, transCosts, supplyStr, demandStr, transMethod, assignCosts, flowEdgesRaw, flowSource, flowSink, payoffs, probsStr, hurwiczAlpha]);

  const handleSave = () => {
    triggerHaptic(settings.hapticsEnabled, 10);
    const steps =
      computed.lp?.steps ??
      computed.tr?.steps ??
      computed.asg?.steps ??
      computed.flow?.steps ??
      computed.dt?.steps ??
      [];
    onSaveToNotebook({
      title: `Operations Research · ${tab.toUpperCase()}`,
      topic: 'Operations Research',
      content: steps.map((s) => `**${s.rule}**: ${s.description}\n$$${s.latex}$$`).join('\n\n'),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const handlePdf = () => {
    triggerHaptic(settings.hapticsEnabled, 10);
    const steps =
      computed.lp?.steps ??
      computed.tr?.steps ??
      computed.asg?.steps ??
      computed.flow?.steps ??
      computed.dt?.steps ??
      [];
    downloadSingleSolutionPdf({
      title: `Operations Research Lab (${tab})`,
      expression: tab.toUpperCase(),
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
              <Sliders className="w-5 h-5 text-[#2F7CF6]" />
              Operations Research Lab
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Linear programming (Graphical &amp; Simplex tableau), Transportation (VAM / Least-Cost / NW Corner), Hungarian Assignment, Max-Flow Network Optimization, and Decision Theory.
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
              { id: 'lp', label: 'Linear Programming (Graphical + Simplex)' },
              { id: 'transportation', label: 'Transportation Problem' },
              { id: 'assignment', label: 'Assignment (Hungarian)' },
              { id: 'network', label: 'Network Max Flow' },
              { id: 'decision', label: 'Decision Theory' },
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

      {computed.error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-300">
          {computed.error}
        </div>
      )}

      {/* LP: GRAPHICAL + SIMPLEX */}
      {tab === 'lp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900 dark:text-white">Objective Function Z</span>
              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-[#12151C]">
                {(['max', 'min'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setObjType(m)}
                    className={`px-2.5 py-1 rounded-md uppercase font-semibold ${
                      objType === m ? 'bg-[#2F7CF6] text-white' : 'text-slate-500'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-500 dark:text-slate-400">Coeff c₁ (x₁)</label>
                <input type="number" value={c1} onChange={(e) => setC1(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400">Coeff c₂ (x₂)</label>
                <input type="number" value={c2} onChange={(e) => setC2(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-white">Constraints (x₁, x₂ ≥ 0)</span>
                <button
                  type="button"
                  onClick={() =>
                    setConRows((prev) => [...prev, { coeffs: [1, 1], sign: '<=', rhs: 25 }])
                  }
                  className="text-[#2F7CF6] font-semibold hover:underline"
                >
                  + Add Row
                </button>
              </div>
              {conRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-1.5 items-center">
                  <input
                    type="number"
                    value={row.coeffs[0]}
                    onChange={(e) => {
                      const next = [...conRows];
                      next[idx] = { ...row, coeffs: [Number(e.target.value) || 0, row.coeffs[1]] };
                      setConRows(next);
                    }}
                    className="h-9 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono"
                  />
                  <input
                    type="number"
                    value={row.coeffs[1]}
                    onChange={(e) => {
                      const next = [...conRows];
                      next[idx] = { ...row, coeffs: [row.coeffs[0], Number(e.target.value) || 0] };
                      setConRows(next);
                    }}
                    className="h-9 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono"
                  />
                  <select
                    value={row.sign}
                    onChange={(e) => {
                      const next = [...conRows];
                      next[idx] = { ...row, sign: e.target.value as LPConstraint['sign'] };
                      setConRows(next);
                    }}
                    className="h-9 px-1.5 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] font-mono"
                  >
                    <option value="<=">&le;</option>
                    <option value=">=">&ge;</option>
                    <option value="=">=</option>
                  </select>
                  <input
                    type="number"
                    value={row.rhs}
                    onChange={(e) => {
                      const next = [...conRows];
                      next[idx] = { ...row, rhs: Number(e.target.value) || 0 };
                      setConRows(next);
                    }}
                    className="h-9 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          {computed.lp && (
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Optimal Result &amp; Graphical Feasible Region
                  </span>
                  <span className="font-mono font-bold text-emerald-500 tabular-nums">
                    Z* = {computed.lp.optimalValue} at ({computed.lp.solution.join(', ')})
                  </span>
                </div>
                {computed.lp.feasibleVertices2D && computed.lp.feasibleVertices2D.length >= 2 && (
                  <svg viewBox="0 0 360 220" className="w-full h-52 rounded-xl bg-slate-50 dark:bg-[#12151C]">
                    {(() => {
                      const verts = computed.lp!.feasibleVertices2D!;
                      const maxC = Math.max(10, ...verts.flatMap((v) => [v.x, v.y])) * 1.15;
                      const sx = (x: number) => 34 + (x / maxC) * 290;
                      const sy = (y: number) => 190 - (y / maxC) * 160;
                      return (
                        <>
                          <line x1="34" y1="190" x2="340" y2="190" stroke="rgba(148,163,184,0.45)" />
                          <line x1="34" y1="20" x2="34" y2="190" stroke="rgba(148,163,184,0.45)" />
                          <polygon
                            points={verts.map((v) => `${sx(v.x)},${sy(v.y)}`).join(' ')}
                            fill="rgba(47,124,246,0.22)"
                            stroke="#2F7CF6"
                            strokeWidth="2"
                          />
                          {verts.map((v, i) => (
                            <circle key={i} cx={sx(v.x)} cy={sy(v.y)} r="4" fill="#10B981" />
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3 overflow-x-auto">
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Simplex Tableaus ({computed.lp.tableaus.length} snapshot(s))
                </div>
                {computed.lp.tableaus.map((tb) => (
                  <div key={tb.iteration} className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-white/5 last:border-b-0">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tableau #{tb.iteration}: {tb.note}
                    </div>
                    <table className="w-full text-[11px] font-mono tabular-nums">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200 dark:border-white/10">
                          <th className="py-1 px-2 text-left">Basis</th>
                          {tb.headers.map((h) => (
                            <th key={h} className="py-1 px-2 text-right">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tb.rows.map((r, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-100 dark:border-white/5">
                            <td className="py-1 px-2 font-semibold text-[#2F7CF6]">
                              {rIdx < tb.basicVars.length ? tb.basicVars[rIdx] : 'Z − C'}
                            </td>
                            {r.map((val, cIdx) => (
                              <td
                                key={cIdx}
                                className={`py-1 px-2 text-right ${
                                  tb.pivotRow === rIdx && tb.pivotCol === cIdx
                                    ? 'bg-amber-500/20 font-bold text-amber-500'
                                    : ''
                                }`}
                              >
                                {Math.abs(val) > 1e4 ? 'M' : val}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRANSPORTATION */}
      {tab === 'transportation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4 text-xs">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'vam', label: "Vogel's (VAM)" },
                  { id: 'least-cost', label: 'Least-Cost' },
                  { id: 'nw-corner', label: 'NW Corner' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTransMethod(m.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium ${
                    transMethod === m.id ? 'bg-[#2F7CF6] text-white' : 'bg-slate-100 dark:bg-[#22252E]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {transCosts.map((row, i) =>
                row.map((val, j) => (
                  <input
                    key={`${i}-${j}`}
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const next = transCosts.map((r) => [...r]);
                      next[i][j] = Number(e.target.value) || 0;
                      setTransCosts(next);
                    }}
                    aria-label={`Cost S${i + 1} to D${j + 1}`}
                    className="h-9 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-center"
                  />
                ))
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-500 dark:text-slate-400">Supply</label>
                <input type="text" value={supplyStr} onChange={(e) => setSupplyStr(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400">Demand</label>
                <input type="text" value={demandStr} onChange={(e) => setDemandStr(e.target.value)} className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              </div>
            </div>
          </div>

          {computed.tr && (
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">Optimal Initial Allocation Matrix</span>
                <span className="font-mono font-bold text-emerald-500 tabular-nums">
                  Total Cost Z = {computed.tr.totalCost}
                </span>
              </div>
              <table className="w-full text-xs font-mono tabular-nums">
                <tbody>
                  {computed.tr.allocations.map((row, i) => (
                    <tr key={i} className="border-b border-slate-200 dark:border-white/10">
                      {row.map((qty, j) => (
                        <td key={j} className="p-2.5 text-center border border-slate-200 dark:border-white/10">
                          <div className="text-[10px] text-slate-400">c={computed.tr!.balancedCosts[i][j]}</div>
                          <div className={`text-sm font-bold ${qty > 0 ? 'text-[#2F7CF6]' : 'text-slate-400'}`}>
                            {qty > 0 ? `[${qty}]` : '—'}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ASSIGNMENT */}
      {tab === 'assignment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3 text-xs">
            <div className="font-semibold text-slate-900 dark:text-white">3×3 Worker-Task Cost Matrix</div>
            <div className="grid grid-cols-3 gap-2">
              {assignCosts.map((row, i) =>
                row.map((val, j) => (
                  <input
                    key={`${i}-${j}`}
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const next = assignCosts.map((r) => [...r]);
                      next[i][j] = Number(e.target.value) || 0;
                      setAssignCosts(next);
                    }}
                    className="h-10 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-center"
                  />
                ))
              )}
            </div>
          </div>

          {computed.asg && (
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">Hungarian Optimal Matching</span>
                <span className="font-mono font-bold text-emerald-500 tabular-nums">
                  Min Cost = {computed.asg.totalCost}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {computed.asg.assignments.map((a) => (
                  <div key={a.worker} className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3 font-mono">
                    Worker {a.worker + 1} → Task {a.task + 1} (cost {a.cost})
                  </div>
                ))}
              </div>
              <MathTex tex={computed.asg.steps[0].latex} display />
            </div>
          )}
        </div>
      )}

      {/* NETWORK MAX FLOW */}
      {tab === 'network' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3 text-xs">
            <label className="text-slate-500 dark:text-slate-400">Directed Capacities (u v capacity)</label>
            <textarea
              rows={6}
              value={flowEdgesRaw}
              onChange={(e) => setFlowEdgesRaw(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono"
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={flowSource} onChange={(e) => setFlowSource(e.target.value)} placeholder="Source" className="h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
              <input type="text" value={flowSink} onChange={(e) => setFlowSink(e.target.value)} placeholder="Sink" className="h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
            </div>
          </div>

          {computed.flow && (
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-white">Edmonds-Karp Flow Saturation</span>
                <span className="font-mono font-bold text-emerald-500">Max Flow = {computed.flow.maxFlow}</span>
              </div>
              <div className="space-y-1.5">
                {computed.flow.edges.map((e, idx) => (
                  <div key={idx} className="rounded-lg bg-slate-50 dark:bg-[#22252E] px-3 py-2 flex justify-between font-mono">
                    <span>{e.u} → {e.v}</span>
                    <span className="text-[#2F7CF6]">flow {e.flow} / cap {e.capacity}</span>
                  </div>
                ))}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Augmenting paths: {computed.flow.augmentingPaths.map((p) => `${p.path.join('→')} (+${p.bottleneck})`).join(' · ')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DECISION THEORY */}
      {tab === 'decision' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3 text-xs">
            <div className="font-semibold text-slate-900 dark:text-white">Payoff Matrix (3 Alternatives × 3 States)</div>
            <div className="grid grid-cols-3 gap-2">
              {payoffs.map((row, i) =>
                row.map((val, j) => (
                  <input
                    key={`${i}-${j}`}
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const next = payoffs.map((r) => [...r]);
                      next[i][j] = Number(e.target.value) || 0;
                      setPayoffs(next);
                    }}
                    className="h-9 px-2 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-center"
                  />
                ))
              )}
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400">State Probabilities</label>
              <input type="text" value={probsStr} onChange={(e) => setProbsStr(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono" />
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400">Hurwicz Optimism α = {hurwiczAlpha.toFixed(2)}</label>
              <input type="range" min={0} max={1} step={0.05} value={hurwiczAlpha} onChange={(e) => setHurwiczAlpha(Number(e.target.value))} className="w-full accent-[#2F7CF6]" />
            </div>
          </div>

          {computed.dt && (
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3 overflow-x-auto">
              <table className="w-full text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500">
                    <th className="py-2 text-left">Alternative</th>
                    <th className="py-2 text-right">Maximax</th>
                    <th className="py-2 text-right">Maximin</th>
                    <th className="py-2 text-right">Hurwicz</th>
                    <th className="py-2 text-right">Laplace</th>
                    <th className="py-2 text-right">Max Regret</th>
                    <th className="py-2 text-right text-[#2F7CF6]">EMV</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.dt.alternatives.map((a) => (
                    <tr key={a.name} className="border-b border-slate-100 dark:border-white/5">
                      <td className="py-2 font-semibold">{a.name}</td>
                      <td className="py-2 text-right">{a.maximax}</td>
                      <td className="py-2 text-right">{a.maximin}</td>
                      <td className="py-2 text-right">{a.hurwicz}</td>
                      <td className="py-2 text-right">{a.laplace}</td>
                      <td className="py-2 text-right">{a.maxRegret}</td>
                      <td className="py-2 text-right font-bold text-[#2F7CF6]">{a.emv}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Best EMV: {computed.dt.bestEMV} · Best Minimax Regret: {computed.dt.bestMinimaxRegret} · EVPI = {computed.dt.evpi}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
