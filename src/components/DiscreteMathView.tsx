import { useMemo, useState } from 'react';
import { Check, FileDown, GitBranch, Network, Save } from 'lucide-react';
import {
  analyzeGraph,
  analyzeRelation,
  computeCombinatoricsAndInduction,
  computeSetOperations,
  evaluatePropositionalLogic,
  solveSecondOrderRecurrence,
} from '../engine/discreteMath';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface DiscreteMathViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

type DiscreteTab = 'sets' | 'relations' | 'logic' | 'graphs' | 'recurrence';

export function DiscreteMathView({ settings, onSaveToNotebook }: DiscreteMathViewProps) {
  const [tab, setTab] = useState<DiscreteTab>('sets');
  const [saved, setSaved] = useState(false);

  // Sets state
  const [setAStr, setSetAStr] = useState('1, 2, 3, 4');
  const [setBStr, setSetBStr] = useState('3, 4, 5, 6');
  const [setUStr, setSetUStr] = useState('1, 2, 3, 4, 5, 6, 7, 8');

  // Relations state
  const [relElements, setRelElements] = useState('1, 2, 3');
  const [relPairs, setRelPairs] = useState('(1,1), (2,2), (3,3), (1,2), (2,1)');
  const [relCodomain, setRelCodomain] = useState('1, 2, 3');

  // Logic state
  const [logicExpr, setLogicExpr] = useState('(P & Q) -> (P | R)');

  // Graphs state
  const [edgesRaw, setEdgesRaw] = useState('A B 4\nA C 2\nB C 1\nB D 5\nC D 8\nC E 10\nD E 2');
  const [startNode, setStartNode] = useState('A');
  const [targetNode, setTargetNode] = useState('E');
  const [directedGraph, setDirectedGraph] = useState(false);
  const [highlightMode, setHighlightMode] = useState<'shortest' | 'mst'>('shortest');

  // Combinatorics, Recurrence & Induction state
  const [combN, setCombN] = useState('6');
  const [combR, setCombR] = useState('2');
  const [recC1, setRecC1] = useState('1');
  const [recC2, setRecC2] = useState('1');
  const [recA0, setRecA0] = useState('0');
  const [recA1, setRecA1] = useState('1');
  const [inductionId, setInductionId] = useState<'sum-k' | 'sum-k2' | 'sum-k3' | 'pow2-gt-n'>('sum-k2');

  const computed = useMemo(() => {
    try {
      if (tab === 'sets') {
        return { sets: computeSetOperations(setAStr, setBStr, setUStr), error: null as string | null };
      }
      if (tab === 'relations') {
        return {
          rel: analyzeRelation(relElements, relPairs, relCodomain),
          error: null as string | null,
        };
      }
      if (tab === 'logic') {
        return { logic: evaluatePropositionalLogic(logicExpr), error: null as string | null };
      }
      if (tab === 'graphs') {
        return {
          graph: analyzeGraph(edgesRaw, startNode, targetNode, directedGraph),
          error: null as string | null,
        };
      }
      return {
        comb: computeCombinatoricsAndInduction(
          Number(combN) || 0,
          Number(combR) || 0,
          inductionId
        ),
        rec: solveSecondOrderRecurrence(
          Number(recC1) || 0,
          Number(recC2) || 0,
          Number(recA0) || 0,
          Number(recA1) || 0
        ),
        error: null as string | null,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Unable to evaluate expression.' };
    }
  }, [
    tab,
    setAStr,
    setBStr,
    setUStr,
    relElements,
    relPairs,
    relCodomain,
    logicExpr,
    edgesRaw,
    startNode,
    targetNode,
    directedGraph,
    combN,
    combR,
    recC1,
    recC2,
    recA0,
    recA1,
    inductionId,
  ]);

  const handleSave = () => {
    triggerHaptic(settings.hapticsEnabled, 10);
    let content = '';
    if (computed.sets) {
      content = `Set A = {${computed.sets.setA.join(', ')}}\nSet B = {${computed.sets.setB.join(', ')}}\n$$A \\cup B = \\{${computed.sets.union.join(', ')}\\},\\quad A \\cap B = \\{${computed.sets.intersection.join(', ')}\\}$$`;
    } else if (computed.rel) {
      content = `Elements: ${computed.rel.elements.join(', ')}\nEquivalence: ${computed.rel.isEquivalence}, Partial Order: ${computed.rel.isPartialOrder}`;
    } else if (computed.logic) {
      content = `Expression: ${logicExpr}\nClassification: ${computed.logic.classification}\nDNF: ${computed.logic.dnf}`;
    } else if (computed.graph) {
      content = `BFS: ${computed.graph.bfsOrder.join(' -> ')}\nDFS: ${computed.graph.dfsOrder.join(' -> ')}\nShortest Distance: ${computed.graph.shortestPath.distance ?? 'Unreachable'}\nMST Weight: ${computed.graph.mstWeight}`;
    } else if (computed.rec && computed.comb) {
      content = `P(${computed.comb.n},${computed.comb.r}) = ${computed.comb.permutations}, C(${computed.comb.n},${computed.comb.r}) = ${computed.comb.combinations}\n$$${computed.rec.closedFormLatex}$$`;
    }
    onSaveToNotebook({
      title: `Discrete Math · ${tab.toUpperCase()}`,
      topic: 'Discrete Mathematics',
      content,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const handlePdf = () => {
    triggerHaptic(settings.hapticsEnabled, 10);
    const steps =
      computed.sets?.steps ??
      computed.rel?.steps ??
      computed.logic?.steps ??
      computed.graph?.steps ??
      computed.rec?.steps ??
      [];
    downloadSingleSolutionPdf({
      title: `Discrete Mathematics (${tab})`,
      expression:
        tab === 'logic'
          ? logicExpr
          : tab === 'graphs'
          ? `${startNode} -> ${targetNode}`
          : tab === 'sets'
          ? `A={${setAStr}}, B={${setBStr}}`
          : tab === 'relations'
          ? relPairs
          : `a_n = ${recC1}a_{n-1} + ${recC2}a_{n-2}`,
      resultPlain: steps.map((s) => `${s.rule}: ${s.description}`).join(' | ') || 'Evaluated',
      steps,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-[#2F7CF6]" />
              Discrete Mathematics Lab
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Set operations &amp; Venn diagrams, relations/functions, propositional truth tables &amp; Boolean forms, graph traversals (BFS/DFS/Dijkstra/MST), recurrence relations, and induction proofs.
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
              { id: 'sets', label: 'Sets & Venn' },
              { id: 'relations', label: 'Relations & Functions' },
              { id: 'logic', label: 'Propositional Logic & Boolean' },
              { id: 'graphs', label: 'Graphs, Trees & Traversals' },
              { id: 'recurrence', label: 'Combinatorics, Recurrence & Induction' },
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

      {/* TAB 1: SETS */}
      {tab === 'sets' && computed.sets && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Set A (comma/space separated)</label>
              <input
                type="text"
                value={setAStr}
                onChange={(e) => setSetAStr(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Set B</label>
              <input
                type="text"
                value={setBStr}
                onChange={(e) => setSetBStr(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Universal Set U</label>
              <input
                type="text"
                value={setUStr}
                onChange={(e) => setSetUStr(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* Interactive SVG Venn Diagram */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#12151C] p-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
                Venn Diagram Distribution
              </div>
              <svg viewBox="0 0 360 190" className="w-full h-44">
                <rect x="8" y="8" width="344" height="174" rx="14" fill="none" stroke="rgba(148,163,184,0.3)" />
                <circle cx="135" cy="98" r="64" fill="rgba(47,124,246,0.18)" stroke="#2F7CF6" strokeWidth="2" />
                <circle cx="225" cy="98" r="64" fill="rgba(16,185,129,0.18)" stroke="#10B981" strokeWidth="2" />
                <text x="86" y="42" fontSize="12" fontWeight="600" fill="#2F7CF6">A</text>
                <text x="266" y="42" fontSize="12" fontWeight="600" fill="#10B981">B</text>
                <text x="102" y="102" textAnchor="middle" fontSize="11" fill="currentColor" className="text-slate-700 dark:text-slate-200 font-mono">
                  {computed.sets.diffAB.slice(0, 4).join(', ') || '∅'}
                </text>
                <text x="180" y="102" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" className="text-slate-900 dark:text-white font-mono">
                  {computed.sets.intersection.slice(0, 4).join(', ') || '∅'}
                </text>
                <text x="256" y="102" textAnchor="middle" fontSize="11" fill="currentColor" className="text-slate-700 dark:text-slate-200 font-mono">
                  {computed.sets.diffBA.slice(0, 4).join(', ') || '∅'}
                </text>
              </svg>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Union (A ∪ B)', val: `{${computed.sets.union.join(', ')}}` },
                { label: 'Intersection (A ∩ B)', val: `{${computed.sets.intersection.join(', ') || '∅'}}` },
                { label: 'Difference (A − B)', val: `{${computed.sets.diffAB.join(', ') || '∅'}}` },
                { label: 'Difference (B − A)', val: `{${computed.sets.diffBA.join(', ') || '∅'}}` },
                { label: 'Symmetric Diff (A △ B)', val: `{${computed.sets.symDiff.join(', ') || '∅'}}` },
                { label: "Complement (A′ in U)", val: `{${computed.sets.complementA.join(', ') || '∅'}}` },
                { label: 'Subset Relations', val: `A ⊆ B: ${computed.sets.isASubsetB ? 'Yes' : 'No'} · B ⊆ A: ${computed.sets.isBSubsetA ? 'Yes' : 'No'}` },
                { label: '|P(A)| & |A × B|', val: `|P(A)| = ${computed.sets.powerSetASize} · |A × B| = ${computed.sets.cartesianSize}` },
              ].map((row) => (
                <div key={row.label} className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                  <div className="text-slate-500 dark:text-slate-400">{row.label}</div>
                  <div className="mt-1 font-mono font-semibold text-slate-900 dark:text-white break-words">
                    {row.val}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Cartesian Product Preview (A × B) &amp; Power Set Subsets
              </div>
              <div className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#12151C] p-3 rounded-xl">
                A × B = {`{${computed.sets.cartesianPreview.join(', ')}${computed.sets.cartesianSize > 18 ? ', …' : ''}}`}
              </div>
              <div className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#12151C] p-3 rounded-xl">
                P(A) sample = {`{${computed.sets.powerSetAPreview.join(', ')}${computed.sets.setA.length > 4 ? ', …' : ''}}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RELATIONS & FUNCTIONS */}
      {tab === 'relations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Domain Set S</label>
              <input
                type="text"
                value={relElements}
                onChange={(e) => setRelElements(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Codomain Set T (for function onto check)</label>
              <input
                type="text"
                value={relCodomain}
                onChange={(e) => setRelCodomain(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Ordered Pairs R</label>
              <textarea
                rows={3}
                value={relPairs}
                onChange={(e) => setRelPairs(e.target.value)}
                className="mt-1 w-full p-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {computed.rel && (
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {[
                  { label: 'Reflexive', ok: computed.rel.reflexive },
                  { label: 'Symmetric', ok: computed.rel.symmetric },
                  { label: 'Antisymmetric', ok: computed.rel.antisymmetric },
                  { label: 'Transitive', ok: computed.rel.transitive },
                  { label: 'Equivalence Relation', ok: computed.rel.isEquivalence },
                  { label: 'Partial Order (Poset)', ok: computed.rel.isPartialOrder },
                  { label: 'Total Function', ok: computed.rel.isFunction },
                  { label: 'Injective (1-to-1)', ok: computed.rel.isInjective },
                  { label: 'Bijective', ok: computed.rel.isBijective },
                ].map((prop) => (
                  <div
                    key={prop.label}
                    className={`rounded-xl border p-3 ${
                      prop.ok
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="text-[11px]">{prop.label}</div>
                    <div className="font-semibold mt-0.5">{prop.ok ? 'True' : 'False'}</div>
                  </div>
                ))}
              </div>

              {computed.rel.counterexamples.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-900 dark:text-white">Property Counterexamples</div>
                  {computed.rel.counterexamples.map((c, idx) => (
                    <div key={idx} className="font-mono text-slate-600 dark:text-slate-300">
                      · {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROPOSITIONAL LOGIC & BOOLEAN ALGEBRA */}
      {tab === 'logic' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Logical / Boolean Formula (use <span className="font-mono">!, &amp;, |, ^, -&gt;, &lt;-&gt;, AND, OR, NOT</span>)
            </label>
            <input
              type="text"
              value={logicExpr}
              onChange={(e) => setLogicExpr(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
            />
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: 'Implication Distribution', expr: '(P & Q) -> (P | R)' },
                { label: "De Morgan's Law", expr: '!(P & Q) <-> (!P | !Q)' },
                { label: 'Contradiction', expr: 'P & !P' },
                { label: 'XOR Equivalence', expr: '(P ^ Q) <-> ((P | Q) & !(P & Q))' },
              ].map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => setLogicExpr(ex.expr)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#22252E] text-slate-700 dark:text-slate-200 font-mono"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {computed.logic && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3 text-xs">
                <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                  <div className="text-slate-500 dark:text-slate-400">Semantic Classification</div>
                  <div className="text-base font-bold text-[#2F7CF6] mt-0.5">
                    {computed.logic.classification}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                  <div className="text-slate-500 dark:text-slate-400">Sum of Minterms (Canonical DNF)</div>
                  <div className="font-mono text-slate-900 dark:text-white mt-1 break-words">
                    {computed.logic.dnf}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                  <div className="text-slate-500 dark:text-slate-400">Product of Maxterms (Canonical CNF)</div>
                  <div className="font-mono text-slate-900 dark:text-white mt-1 break-words">
                    {computed.logic.cnf}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 overflow-x-auto">
                <table className="w-full text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-2 text-left">m</th>
                      {computed.logic.variables.map((v) => (
                        <th key={v} className="py-2 px-2 text-center">{v}</th>
                      ))}
                      <th className="py-2 px-2 text-center text-[#2F7CF6]">Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computed.logic.rows.map((row) => (
                      <tr key={row.mintermIndex} className="border-b border-slate-100 dark:border-white/5">
                        <td className="py-1.5 px-2 text-slate-400">{row.mintermIndex}</td>
                        {computed.logic!.variables.map((v) => (
                          <td key={v} className="py-1.5 px-2 text-center text-slate-700 dark:text-slate-200">
                            {row.assignment[v] ? 'T' : 'F'}
                          </td>
                        ))}
                        <td
                          className={`py-1.5 px-2 text-center font-bold ${
                            row.result ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {row.result ? 'T' : 'F'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: GRAPHS, TREES & TRAVERSALS */}
      {tab === 'graphs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Edge List (one per line: <span className="font-mono">u v weight</span>)
              </label>
              <textarea
                rows={7}
                value={edgesRaw}
                onChange={(e) => setEdgesRaw(e.target.value)}
                className="mt-1 w-full p-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Source</label>
                <input
                  type="text"
                  value={startNode}
                  onChange={(e) => setStartNode(e.target.value)}
                  className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Target</label>
                <input
                  type="text"
                  value={targetNode}
                  onChange={(e) => setTargetNode(e.target.value)}
                  className="mt-1 w-full h-9 px-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setDirectedGraph((d) => !d)}
                  className={`w-full h-9 rounded-xl border text-xs font-semibold transition-colors ${
                    directedGraph
                      ? 'border-[#2F7CF6] bg-[#2F7CF6]/15 text-[#2F7CF6]'
                      : 'border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {directedGraph ? 'Directed' : 'Undirected'}
                </button>
              </div>
            </div>
          </div>

          {computed.graph && (
            <div className="lg:col-span-7 space-y-4">
              {/* Interactive Circular Graph & Spanning Tree Visualizer */}
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 text-[#2F7CF6]" />
                    Interactive Graph &amp; Tree Canvas
                  </span>
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-[#12151C]">
                    {(
                      [
                        { id: 'shortest', label: 'Shortest Path' },
                        { id: 'mst', label: 'Kruskal MST' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setHighlightMode(m.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
                          highlightMode === m.id
                            ? 'bg-[#2F7CF6] text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <svg viewBox="0 0 420 250" className="w-full h-60 rounded-xl bg-slate-50 dark:bg-[#12151C]">
                  {(() => {
                    const g = computed.graph!;
                    const n = g.nodes.length;
                    const coords = new Map<string, { x: number; y: number }>();
                    g.nodes.forEach((node, idx) => {
                      const angle = -Math.PI / 2 + (2 * Math.PI * idx) / Math.max(1, n);
                      coords.set(node, {
                        x: 210 + 130 * Math.cos(angle),
                        y: 125 + 88 * Math.sin(angle),
                      });
                    });

                    const pathPairs = new Set<string>();
                    const sp = g.shortestPath.path;
                    for (let i = 0; i < sp.length - 1; i++) {
                      pathPairs.add(`${sp[i]}->${sp[i + 1]}`);
                      if (!g.directed) pathPairs.add(`${sp[i + 1]}->${sp[i]}`);
                    }
                    const mstSet = new Set(g.mstEdges.map((e) => `${e.u}-${e.v}-${e.w}`));

                    return (
                      <>
                        {g.edges.map((e, idx) => {
                          const p1 = coords.get(e.u)!;
                          const p2 = coords.get(e.v)!;
                          const isHigh =
                            highlightMode === 'shortest'
                              ? pathPairs.has(`${e.u}->${e.v}`)
                              : mstSet.has(`${e.u}-${e.v}-${e.w}`);
                          const mx = (p1.x + p2.x) / 2;
                          const my = (p1.y + p2.y) / 2;
                          return (
                            <g key={idx}>
                              <line
                                x1={p1.x}
                                y1={p1.y}
                                x2={p2.x}
                                y2={p2.y}
                                stroke={isHigh ? '#10B981' : 'rgba(148,163,184,0.45)'}
                                strokeWidth={isHigh ? 3 : 1.5}
                              />
                              <circle cx={mx} cy={my} r="9" fill={settings.theme === 'dark' ? '#191C24' : '#FFFFFF'} />
                              <text
                                x={mx}
                                y={my + 3.5}
                                textAnchor="middle"
                                fontSize="10"
                                fill={isHigh ? '#10B981' : '#94A3B8'}
                                className="font-mono font-bold"
                              >
                                {e.w}
                              </text>
                            </g>
                          );
                        })}
                        {g.nodes.map((node) => {
                          const pt = coords.get(node)!;
                          const isEnd = node === startNode || node === targetNode;
                          return (
                            <g key={node}>
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r="16"
                                fill={isEnd ? '#2F7CF6' : settings.theme === 'dark' ? '#22252E' : '#FFFFFF'}
                                stroke="#2F7CF6"
                                strokeWidth="2"
                              />
                              <text
                                x={pt.x}
                                y={pt.y + 4}
                                textAnchor="middle"
                                fontSize="12"
                                fontWeight="700"
                                fill={isEnd || settings.theme === 'dark' ? '#FFFFFF' : '#0F172A'}
                              >
                                {node}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                    <div className="text-slate-500 dark:text-slate-400">BFS / DFS Order</div>
                    <div className="font-mono text-slate-900 dark:text-white mt-1">
                      BFS: {computed.graph.bfsOrder.join(' → ')}
                    </div>
                    <div className="font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                      DFS: {computed.graph.dfsOrder.join(' → ')}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                    <div className="text-slate-500 dark:text-slate-400">Structural Diagnostics</div>
                    <div className="text-slate-900 dark:text-white mt-1 tabular-nums">
                      Components: {computed.graph.connectedComponents} · Tree: {computed.graph.isTree ? 'Yes' : 'No'} · Bipartite: {computed.graph.isBipartite ? 'Yes' : 'No'}
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      Shortest ({startNode}→{targetNode}): {computed.graph.shortestPath.distance ?? '∞'} · MST: {computed.graph.mstWeight}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {computed.graph.eulerNote}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: COMBINATORICS, RECURRENCE & INDUCTION */}
      {tab === 'recurrence' && computed.rec && computed.comb && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              Combinatorics &amp; Induction Bound
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">n (0–25)</label>
                <input
                  type="number"
                  value={combN}
                  onChange={(e) => setCombN(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">r (0–n)</label>
                <input
                  type="number"
                  value={combR}
                  onChange={(e) => setCombR(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-white/10 pt-3 space-y-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Linear Recurrence aₙ = c₁·aₙ₋₁ + c₂·aₙ₋₂
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'c₁', val: recC1, set: setRecC1 },
                  { label: 'c₂', val: recC2, set: setRecC2 },
                  { label: 'a₀', val: recA0, set: setRecA0 },
                  { label: 'a₁', val: recA1, set: setRecA1 },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">{f.label}</label>
                    <input
                      type="number"
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      className="mt-1 w-full h-9 px-2 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-white/10 pt-3">
              <label className="text-xs text-slate-500 dark:text-slate-400">Induction Theorem</label>
              <select
                value={inductionId}
                onChange={(e) => setInductionId(e.target.value as typeof inductionId)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-xs text-slate-900 dark:text-white"
              >
                <option value="sum-k">∑ i = n(n+1)/2</option>
                <option value="sum-k2">∑ i² = n(n+1)(2n+1)/6</option>
                <option value="sum-k3">∑ i³ = [n(n+1)/2]²</option>
                <option value="pow2-gt-n">2ⁿ &gt; n for all n ≥ 1</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 grid grid-cols-3 gap-3 text-xs tabular-nums">
              <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                <div className="text-slate-500 dark:text-slate-400">P({computed.comb.n}, {computed.comb.r})</div>
                <div className="font-mono font-bold text-slate-900 dark:text-white mt-1">{computed.comb.permutations}</div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                <div className="text-slate-500 dark:text-slate-400">C({computed.comb.n}, {computed.comb.r})</div>
                <div className="font-mono font-bold text-[#2F7CF6] mt-1">{computed.comb.combinations}</div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
                <div className="text-slate-500 dark:text-slate-400">Derangements D_{computed.comb.n}</div>
                <div className="font-mono font-bold text-emerald-500 mt-1">{computed.comb.derangements}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Recurrence Closed Form &amp; Sequence Terms
              </div>
              <div className="overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={computed.rec.closedFormLatex} display />
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                {computed.rec.terms.map((tm) => (
                  <span key={tm.n} className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#22252E] text-slate-700 dark:text-slate-200 tabular-nums">
                    a_{tm.n}={tm.value}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-2.5 text-xs">
              <div className="font-semibold text-slate-900 dark:text-white">
                Mathematical Induction Proof (Verified at n = {computed.comb.inductionProof.verifiedUpTo})
              </div>
              <div className="overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={computed.comb.inductionProof.statementLatex} display />
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Base Case:</strong> {computed.comb.inductionProof.baseCase}
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Inductive Hypothesis:</strong> {computed.comb.inductionProof.inductiveHypothesis}
              </p>
              <div className="overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={computed.comb.inductionProof.inductiveStepLatex} display />
              </div>
              <div className="font-mono text-emerald-600 dark:text-emerald-400">
                Check at n = {computed.comb.inductionProof.verifiedUpTo}: LHS = {computed.comb.inductionProof.lhsValue}, RHS = {computed.comb.inductionProof.rhsValue} ({computed.comb.inductionProof.holds ? 'Verified' : 'Mismatch'})
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
