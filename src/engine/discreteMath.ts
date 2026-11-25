import type { DerivationStep } from '../types';

export interface SetOperationsResult {
  setA: string[];
  setB: string[];
  universe: string[];
  union: string[];
  intersection: string[];
  diffAB: string[];
  diffBA: string[];
  symDiff: string[];
  complementA: string[];
  complementB: string[];
  isASubsetB: boolean;
  isBSubsetA: boolean;
  cartesianSize: number;
  cartesianPreview: string[];
  powerSetASize: string;
  powerSetAPreview: string[];
  steps: DerivationStep[];
}

export function parseSetInput(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const clean = part.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

export function computeSetOperations(
  rawA: string,
  rawB: string,
  rawU?: string
): SetOperationsResult {
  const setA = parseSetInput(rawA);
  const setB = parseSetInput(rawB);
  const parsedU = rawU ? parseSetInput(rawU) : [];
  const uSet = new Set<string>([...parsedU, ...setA, ...setB]);
  const universe = Array.from(uSet);

  const bSet = new Set(setB);
  const aSet = new Set(setA);

  const union = Array.from(new Set([...setA, ...setB]));
  const intersection = setA.filter((x) => bSet.has(x));
  const diffAB = setA.filter((x) => !bSet.has(x));
  const diffBA = setB.filter((x) => !aSet.has(x));
  const symDiff = [...diffAB, ...diffBA];
  const complementA = universe.filter((x) => !aSet.has(x));
  const complementB = universe.filter((x) => !bSet.has(x));
  const isASubsetB = setA.every((x) => bSet.has(x));
  const isBSubsetA = setB.every((x) => aSet.has(x));

  const cartesianSize = setA.length * setB.length;
  const cartesianPreview: string[] = [];
  for (const a of setA.slice(0, 6)) {
    for (const b of setB.slice(0, 6)) {
      if (cartesianPreview.length < 18) cartesianPreview.push(`(${a}, ${b})`);
    }
  }

  const powerSetASize = setA.length <= 30 ? String(2 ** setA.length) : `2^{${setA.length}}`;
  const powerSetAPreview: string[] = [];
  const capN = Math.min(setA.length, 4);
  const subsetCount = 1 << capN;
  for (let mask = 0; mask < subsetCount; mask++) {
    const elems: string[] = [];
    for (let i = 0; i < capN; i++) {
      if ((mask >> i) & 1) elems.push(setA[i]);
    }
    powerSetAPreview.push(elems.length === 0 ? '∅' : `{${elems.join(', ')}}`);
  }

  const fmt = (arr: string[]) => (arr.length ? `\\{${arr.join(', ')}\\}` : '\\emptyset');

  return {
    setA,
    setB,
    universe,
    union,
    intersection,
    diffAB,
    diffBA,
    symDiff,
    complementA,
    complementB,
    isASubsetB,
    isBSubsetA,
    cartesianSize,
    cartesianPreview,
    powerSetASize,
    powerSetAPreview,
    steps: [
      {
        id: 'set-1',
        rule: 'Union & Intersection',
        description: `|A| = ${setA.length}, |B| = ${setB.length}, |A ∪ B| = |A| + |B| - |A ∩ B| = ${union.length}.`,
        latex: `A \\cup B = ${fmt(union)},\\quad A \\cap B = ${fmt(intersection)}`,
      },
      {
        id: 'set-2',
        rule: 'Differences & Symmetric Difference',
        description: 'Elements strictly in A, strictly in B, or in exactly one set.',
        latex: `A \\setminus B = ${fmt(diffAB)},\\quad A \\triangle B = ${fmt(symDiff)}`,
      },
      {
        id: 'set-3',
        rule: 'Cartesian Product & Power Set',
        description: `|A × B| = ${cartesianSize} ordered pairs; |P(A)| = 2^{${setA.length}}.`,
        latex: `|A \\times B| = ${cartesianSize},\\quad |\\mathcal{P}(A)| = ${powerSetASize}`,
      },
    ],
  };
}

// ---------------- Relations & Functions ----------------

export interface RelationAnalysisResult {
  elements: string[];
  pairs: [string, string][];
  reflexive: boolean;
  irreflexive: boolean;
  symmetric: boolean;
  antisymmetric: boolean;
  transitive: boolean;
  isEquivalence: boolean;
  isPartialOrder: boolean;
  isFunction: boolean;
  isInjective: boolean;
  isSurjective: boolean;
  isBijective: boolean;
  counterexamples: string[];
  matrix: number[][];
  steps: DerivationStep[];
}

export function analyzeRelation(
  elementsRaw: string,
  pairsRaw: string,
  codomainRaw?: string
): RelationAnalysisResult {
  const elements = parseSetInput(elementsRaw);
  if (elements.length === 0) {
    throw new Error('Provide at least one element in set S.');
  }
  const codomain = codomainRaw?.trim() ? parseSetInput(codomainRaw) : elements;

  const pairMatches = Array.from(pairsRaw.matchAll(/\(\s*([^,()\s]+)\s*,\s*([^,()\s]+)\s*\)/g));
  if (pairMatches.length === 0 && pairsRaw.trim() !== '') {
    throw new Error('Write ordered pairs like (1,1), (1,2), (2,2).');
  }

  const elemSet = new Set(elements);
  const codSet = new Set(codomain);
  const pairSet = new Set<string>();
  const pairs: [string, string][] = [];
  for (const m of pairMatches) {
    const a = m[1].trim();
    const b = m[2].trim();
    if (!elemSet.has(a) || (!elemSet.has(b) && !codSet.has(b))) {
      throw new Error(`Pair (${a}, ${b}) references an element outside S/codomain.`);
    }
    const key = `${a}|||${b}`;
    if (!pairSet.has(key)) {
      pairSet.add(key);
      pairs.push([a, b]);
    }
  }

  const has = (a: string, b: string) => pairSet.has(`${a}|||${b}`);
  const counterexamples: string[] = [];

  let reflexive = true;
  let irreflexive = true;
  for (const x of elements) {
    if (!has(x, x)) {
      reflexive = false;
      counterexamples.push(`Not reflexive: missing (${x}, ${x})`);
    } else {
      irreflexive = false;
    }
  }

  let symmetric = true;
  let antisymmetric = true;
  for (const [a, b] of pairs) {
    if (!has(b, a)) {
      symmetric = false;
      if (counterexamples.length < 6) {
        counterexamples.push(`Not symmetric: (${a}, ${b}) ∈ R but (${b}, ${a}) ∉ R`);
      }
    }
    if (a !== b && has(b, a)) {
      antisymmetric = false;
      if (counterexamples.length < 6) {
        counterexamples.push(`Not antisymmetric: both (${a}, ${b}) and (${b}, ${a}) ∈ R with ${a} ≠ ${b}`);
      }
    }
  }

  let transitive = true;
  for (const [a, b] of pairs) {
    for (const [b2, c] of pairs) {
      if (b === b2 && !has(a, c)) {
        transitive = false;
        if (counterexamples.length < 8) {
          counterexamples.push(`Not transitive: (${a}, ${b}), (${b}, ${c}) ∈ R but (${a}, ${c}) ∉ R`);
        }
      }
    }
  }

  // Function checks (S -> codomain)
  const domainCounts = new Map<string, string[]>();
  const imageCounts = new Map<string, number>();
  for (const [a, b] of pairs) {
    const arr = domainCounts.get(a) ?? [];
    arr.push(b);
    domainCounts.set(a, arr);
    imageCounts.set(b, (imageCounts.get(b) ?? 0) + 1);
  }
  const isFunction = elements.every((x) => (domainCounts.get(x)?.length ?? 0) === 1);
  const isInjective =
    isFunction && Array.from(imageCounts.values()).every((cnt) => cnt <= 1);
  const isSurjective =
    isFunction && codomain.every((y) => (imageCounts.get(y) ?? 0) >= 1);
  const isBijective = isInjective && isSurjective;

  const matrix = elements.map((r) => elements.map((c) => (has(r, c) ? 1 : 0)));
  const isEquivalence = reflexive && symmetric && transitive;
  const isPartialOrder = reflexive && antisymmetric && transitive;

  return {
    elements,
    pairs,
    reflexive,
    irreflexive,
    symmetric,
    antisymmetric,
    transitive,
    isEquivalence,
    isPartialOrder,
    isFunction,
    isInjective,
    isSurjective,
    isBijective,
    counterexamples,
    matrix,
    steps: [
      {
        id: 'rel-1',
        rule: 'Relation Matrix & Endorelation Properties',
        description: `Checked ${pairs.length} pair(s) over |S| = ${elements.length}.`,
        latex: `\\text{Refl}=${reflexive},\\; \\text{Sym}=${symmetric},\\; \\text{Antisym}=${antisymmetric},\\; \\text{Trans}=${transitive}`,
      },
      {
        id: 'rel-2',
        rule: 'Algebraic Classification',
        description: isEquivalence
          ? 'R is an Equivalence Relation (partitions S into equivalence classes).'
          : isPartialOrder
          ? 'R is a Partial Order (poset).'
          : 'R is neither an equivalence relation nor a partial order.',
        latex: `\\text{Equivalence}: ${isEquivalence ? '\\text{Yes}' : '\\text{No}'},\\quad \\text{Partial Order}: ${isPartialOrder ? '\\text{Yes}' : '\\text{No}'}`,
      },
      {
        id: 'rel-3',
        rule: 'Mapping Classification',
        description: isFunction
          ? `Valid function S → Codomain: ${isBijective ? 'Bijective' : isInjective ? 'Injective' : isSurjective ? 'Surjective' : 'General function'}.`
          : 'Not a single-valued total function on S (some element has 0 or >1 images).',
        latex: `\\text{Function}: ${isFunction},\\; \\text{1-to-1}: ${isInjective},\\; \\text{Onto}: ${isSurjective}`,
      },
    ],
  };
}

// ---------------- Propositional Logic & Boolean Algebra ----------------

type LogicToken =
  | { kind: 'var'; name: string }
  | { kind: 'const'; value: boolean }
  | { kind: 'op'; op: 'NOT' | 'AND' | 'OR' | 'XOR' | 'IMP' | 'IFF' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

type LogicNode =
  | { type: 'var'; name: string }
  | { type: 'const'; value: boolean }
  | { type: 'not'; arg: LogicNode }
  | { type: 'bin'; op: 'AND' | 'OR' | 'XOR' | 'IMP' | 'IFF'; left: LogicNode; right: LogicNode };

function tokenizeLogic(raw: string): LogicToken[] {
  const s = raw
    .replace(/∧/g, '&')
    .replace(/∨/g, '|')
    .replace(/¬|~/g, '!')
    .replace(/→|⇒/g, '->')
    .replace(/↔|⇔/g, '<->')
    .replace(/⊕/g, '^')
    .trim();
  if (!s) throw new Error('Enter a logical expression (e.g. (P & Q) -> (P | R)).');

  const tokens: LogicToken[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (s.startsWith('<->', i) || s.startsWith('<=>', i)) {
      tokens.push({ kind: 'op', op: 'IFF' });
      i += 3;
      continue;
    }
    if (s.startsWith('->', i) || s.startsWith('=>', i)) {
      tokens.push({ kind: 'op', op: 'IMP' });
      i += 2;
      continue;
    }
    if (s.startsWith('&&', i) || s.startsWith('||', i)) {
      tokens.push({ kind: 'op', op: ch === '&' ? 'AND' : 'OR' });
      i += 2;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i++;
      continue;
    }
    if (ch === '!' ) {
      tokens.push({ kind: 'op', op: 'NOT' });
      i++;
      continue;
    }
    if (ch === '&' || ch === '*') {
      tokens.push({ kind: 'op', op: 'AND' });
      i++;
      continue;
    }
    if (ch === '|' || ch === '+') {
      tokens.push({ kind: 'op', op: 'OR' });
      i++;
      continue;
    }
    if (ch === '^') {
      tokens.push({ kind: 'op', op: 'XOR' });
      i++;
      continue;
    }
    if (ch === '0' || ch === '1') {
      tokens.push({ kind: 'const', value: ch === '1' });
      i++;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let id = '';
      while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) {
        id += s[i];
        i++;
      }
      const upper = id.toUpperCase();
      if (upper === 'NOT') tokens.push({ kind: 'op', op: 'NOT' });
      else if (upper === 'AND') tokens.push({ kind: 'op', op: 'AND' });
      else if (upper === 'OR') tokens.push({ kind: 'op', op: 'OR' });
      else if (upper === 'XOR') tokens.push({ kind: 'op', op: 'XOR' });
      else if (upper === 'IMP' || upper === 'IMPLIES') tokens.push({ kind: 'op', op: 'IMP' });
      else if (upper === 'IFF') tokens.push({ kind: 'op', op: 'IFF' });
      else if (upper === 'TRUE' || upper === 'T') tokens.push({ kind: 'const', value: true });
      else if (upper === 'FALSE' || upper === 'F') tokens.push({ kind: 'const', value: false });
      else tokens.push({ kind: 'var', name: id });
      continue;
    }
    throw new Error(`Unexpected symbol "${ch}" in logic expression.`);
  }
  return tokens;
}

function parseLogicTokens(tokens: LogicToken[]): { ast: LogicNode; variables: string[] } {
  let pos = 0;
  const varSet = new Set<string>();
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  const parseIff = (): LogicNode => {
    let left = parseImp();
    while (peek()?.kind === 'op' && (peek() as { op: string }).op === 'IFF') {
      next();
      left = { type: 'bin', op: 'IFF', left, right: parseImp() };
    }
    return left;
  };
  const parseImp = (): LogicNode => {
    const left = parseOr();
    if (peek()?.kind === 'op' && (peek() as { op: string }).op === 'IMP') {
      next();
      return { type: 'bin', op: 'IMP', left, right: parseImp() };
    }
    return left;
  };
  const parseOr = (): LogicNode => {
    let left = parseXor();
    while (peek()?.kind === 'op' && (peek() as { op: string }).op === 'OR') {
      next();
      left = { type: 'bin', op: 'OR', left, right: parseXor() };
    }
    return left;
  };
  const parseXor = (): LogicNode => {
    let left = parseAnd();
    while (peek()?.kind === 'op' && (peek() as { op: string }).op === 'XOR') {
      next();
      left = { type: 'bin', op: 'XOR', left, right: parseAnd() };
    }
    return left;
  };
  const parseAnd = (): LogicNode => {
    let left = parseNot();
    while (peek()?.kind === 'op' && (peek() as { op: string }).op === 'AND') {
      next();
      left = { type: 'bin', op: 'AND', left, right: parseNot() };
    }
    return left;
  };
  const parseNot = (): LogicNode => {
    if (peek()?.kind === 'op' && (peek() as { op: string }).op === 'NOT') {
      next();
      return { type: 'not', arg: parseNot() };
    }
    return parseAtom();
  };
  const parseAtom = (): LogicNode => {
    const t = peek();
    if (!t) throw new Error('Unexpected end of logic expression.');
    if (t.kind === 'const') {
      next();
      return { type: 'const', value: t.value };
    }
    if (t.kind === 'var') {
      next();
      varSet.add(t.name);
      return { type: 'var', name: t.name };
    }
    if (t.kind === 'lparen') {
      next();
      const inner = parseIff();
      if (peek()?.kind !== 'rparen') throw new Error('Missing closing parenthesis ")".');
      next();
      return inner;
    }
    throw new Error('Invalid syntax in logic expression.');
  };

  const ast = parseIff();
  if (pos < tokens.length) throw new Error('Unexpected trailing tokens in expression.');
  return { ast, variables: Array.from(varSet).sort() };
}

function evalLogicAst(node: LogicNode, env: Record<string, boolean>): boolean {
  switch (node.type) {
    case 'const':
      return node.value;
    case 'var':
      return Boolean(env[node.name]);
    case 'not':
      return !evalLogicAst(node.arg, env);
    case 'bin': {
      const l = evalLogicAst(node.left, env);
      const r = evalLogicAst(node.right, env);
      switch (node.op) {
        case 'AND':
          return l && r;
        case 'OR':
          return l || r;
        case 'XOR':
          return l !== r;
        case 'IMP':
          return !l || r;
        case 'IFF':
          return l === r;
      }
    }
  }
}

export interface TruthTableResult {
  variables: string[];
  rows: { assignment: Record<string, boolean>; result: boolean; mintermIndex: number }[];
  classification: 'Tautology' | 'Contradiction' | 'Contingency';
  minterms: number[];
  maxterms: number[];
  dnf: string;
  cnf: string;
  steps: DerivationStep[];
}

export function evaluatePropositionalLogic(expr: string): TruthTableResult {
  const tokens = tokenizeLogic(expr);
  const { ast, variables } = parseLogicTokens(tokens);
  if (variables.length > 5) {
    throw new Error('Limit propositional expressions to at most 5 distinct variables for truth tables.');
  }

  const vars = variables.length > 0 ? variables : [];
  const totalRows = 1 << vars.length;
  const rows: TruthTableResult['rows'] = [];
  const minterms: number[] = [];
  const maxterms: number[] = [];
  const dnfClauses: string[] = [];
  const cnfClauses: string[] = [];

  for (let mask = 0; mask < totalRows; mask++) {
    const assignment: Record<string, boolean> = {};
    vars.forEach((v, idx) => {
      assignment[v] = Boolean((mask >> (vars.length - 1 - idx)) & 1);
    });
    const result = evalLogicAst(ast, assignment);
    rows.push({ assignment, result, mintermIndex: mask });
    if (result) {
      minterms.push(mask);
      if (vars.length > 0) {
        dnfClauses.push(
          `(${vars.map((v) => (assignment[v] ? v : `¬${v}`)).join(' ∧ ')})`
        );
      }
    } else {
      maxterms.push(mask);
      if (vars.length > 0) {
        cnfClauses.push(
          `(${vars.map((v) => (assignment[v] ? `¬${v}` : v)).join(' ∨ ')})`
        );
      }
    }
  }

  const classification: TruthTableResult['classification'] =
    minterms.length === totalRows
      ? 'Tautology'
      : minterms.length === 0
      ? 'Contradiction'
      : 'Contingency';

  const dnf =
    vars.length === 0
      ? String(rows[0]?.result ?? false)
      : dnfClauses.length === 0
      ? 'False (0)'
      : dnfClauses.join(' ∨ ');
  const cnf =
    vars.length === 0
      ? String(rows[0]?.result ?? false)
      : cnfClauses.length === 0
      ? 'True (1)'
      : cnfClauses.join(' ∧ ');

  return {
    variables: vars,
    rows,
    classification,
    minterms,
    maxterms,
    dnf,
    cnf,
    steps: [
      {
        id: 'log-1',
        rule: 'Truth Table Evaluation',
        description: `Evaluated ${totalRows} truth assignments across ${vars.length || 0} variable(s).`,
        latex: `\\text{Classification: } \\textbf{${classification}}`,
      },
      {
        id: 'log-2',
        rule: 'Canonical Minterms & Maxterms (Boolean Algebra)',
        description: 'Sum-of-Products (DNF) from true rows and Product-of-Sums (CNF) from false rows.',
        latex: `\\Sigma m(${minterms.join(', ') || '-'}),\\quad \\Pi M(${maxterms.join(', ') || '-'})`,
      },
    ],
  };
}

// ---------------- Graph Theory & Trees ----------------

export interface GraphEdge {
  u: string;
  v: string;
  w: number;
}

export interface GraphAnalysisResult {
  nodes: string[];
  edges: GraphEdge[];
  directed: boolean;
  degrees: { node: string; inDegree: number; outDegree: number; degree: number }[];
  bfsOrder: string[];
  dfsOrder: string[];
  shortestPath: { path: string[]; distance: number | null };
  mstEdges: GraphEdge[];
  mstWeight: number;
  connectedComponents: number;
  isTree: boolean;
  isBipartite: boolean;
  eulerNote: string;
  steps: DerivationStep[];
}

export function parseEdgesInput(raw: string): GraphEdge[] {
  const lines = raw
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const edges: GraphEdge[] = [];
  for (const line of lines) {
    const parts = line.split(/[\s,:-]+/).filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Invalid edge specification near "${line}". Use "A B 4" or "A-B:4".`);
    }
    const u = parts[0];
    const v = parts[1];
    const w = parts[2] !== undefined ? Number(parts[2]) : 1;
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`Edge weight must be a non-negative finite number (near "${line}").`);
    }
    edges.push({ u, v, w });
  }
  if (edges.length === 0) {
    throw new Error('Enter at least one edge (e.g. A B 4).');
  }
  return edges;
}

export function analyzeGraph(
  edgesRaw: string,
  startNodeInput: string,
  targetNodeInput: string,
  directed = false
): GraphAnalysisResult {
  const edges = parseEdgesInput(edgesRaw);
  const nodeSet = new Set<string>();
  for (const e of edges) {
    nodeSet.add(e.u);
    nodeSet.add(e.v);
  }
  const nodes = Array.from(nodeSet).sort();
  const startNode = nodes.includes(startNodeInput.trim()) ? startNodeInput.trim() : nodes[0];
  const targetNode = nodes.includes(targetNodeInput.trim())
    ? targetNodeInput.trim()
    : nodes[nodes.length - 1];

  const adj = new Map<string, { to: string; w: number }[]>();
  const undirAdj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n, []);
    undirAdj.set(n, []);
    inDeg.set(n, 0);
    outDeg.set(n, 0);
  }

  for (const e of edges) {
    adj.get(e.u)!.push({ to: e.v, w: e.w });
    outDeg.set(e.u, (outDeg.get(e.u) ?? 0) + 1);
    inDeg.set(e.v, (inDeg.get(e.v) ?? 0) + 1);
    undirAdj.get(e.u)!.push(e.v);
    undirAdj.get(e.v)!.push(e.u);
    if (!directed) {
      adj.get(e.v)!.push({ to: e.u, w: e.w });
    }
  }
  for (const list of adj.values()) list.sort((a, b) => a.to.localeCompare(b.to));

  // BFS
  const bfsOrder: string[] = [];
  const bfsVisited = new Set<string>([startNode]);
  const q: string[] = [startNode];
  while (q.length > 0) {
    const cur = q.shift()!;
    bfsOrder.push(cur);
    for (const nb of adj.get(cur) ?? []) {
      if (!bfsVisited.has(nb.to)) {
        bfsVisited.add(nb.to);
        q.push(nb.to);
      }
    }
  }

  // DFS
  const dfsOrder: string[] = [];
  const dfsVisited = new Set<string>();
  const dfsWalk = (u: string) => {
    dfsVisited.add(u);
    dfsOrder.push(u);
    for (const nb of adj.get(u) ?? []) {
      if (!dfsVisited.has(nb.to)) dfsWalk(nb.to);
    }
  };
  dfsWalk(startNode);

  // Dijkstra shortest path
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const unvisited = new Set(nodes);
  for (const n of nodes) {
    dist.set(n, n === startNode ? 0 : Infinity);
    prev.set(n, null);
  }
  while (unvisited.size > 0) {
    let bestNode: string | null = null;
    let bestDist = Infinity;
    for (const n of unvisited) {
      const d = dist.get(n)!;
      if (d < bestDist) {
        bestDist = d;
        bestNode = n;
      }
    }
    if (!bestNode || !Number.isFinite(bestDist)) break;
    unvisited.delete(bestNode);
    if (bestNode === targetNode) break;
    for (const nb of adj.get(bestNode) ?? []) {
      if (!unvisited.has(nb.to)) continue;
      const alt = bestDist + nb.w;
      if (alt < dist.get(nb.to)!) {
        dist.set(nb.to, alt);
        prev.set(nb.to, bestNode);
      }
    }
  }
  const path: string[] = [];
  const targetDist = dist.get(targetNode)!;
  if (Number.isFinite(targetDist)) {
    let cur: string | null = targetNode;
    while (cur) {
      path.unshift(cur);
      cur = prev.get(cur) ?? null;
    }
  }

  // Connected components & bipartite check (on underlying undirected graph)
  const compVisited = new Set<string>();
  const color = new Map<string, number>();
  let connectedComponents = 0;
  let isBipartite = true;
  for (const n of nodes) {
    if (compVisited.has(n)) continue;
    connectedComponents++;
    compVisited.add(n);
    color.set(n, 0);
    const cq = [n];
    while (cq.length > 0) {
      const cur = cq.shift()!;
      for (const nb of undirAdj.get(cur) ?? []) {
        if (!compVisited.has(nb)) {
          compVisited.add(nb);
          color.set(nb, 1 - color.get(cur)!);
          cq.push(nb);
        } else if (color.get(nb) === color.get(cur)) {
          isBipartite = false;
        }
      }
    }
  }

  // Kruskal MST on undirected edges
  const parent = new Map<string, string>(nodes.map((n) => [n, n]));
  const find = (x: string): string => {
    const p = parent.get(x)!;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const sortedEdges = [...edges].sort((a, b) => a.w - b.w);
  const mstEdges: GraphEdge[] = [];
  let mstWeight = 0;
  for (const e of sortedEdges) {
    const ru = find(e.u);
    const rv = find(e.v);
    if (ru !== rv) {
      parent.set(ru, rv);
      mstEdges.push(e);
      mstWeight += e.w;
    }
  }

  const degrees = nodes.map((node) => {
    const inD = inDeg.get(node) ?? 0;
    const outD = outDeg.get(node) ?? 0;
    const degree = directed ? inD + outD : (undirAdj.get(node)?.length ?? 0);
    return { node, inDegree: inD, outDegree: outD, degree };
  });

  const oddCount = degrees.filter((d) => d.degree % 2 === 1).length;
  const isTree = !directed && connectedComponents === 1 && edges.length === nodes.length - 1;
  const eulerNote = directed
    ? 'Switch to undirected mode for Eulerian circuit/path parity check.'
    : connectedComponents > 1
    ? 'Disconnected graph — no single Eulerian trail covers all vertices.'
    : oddCount === 0
    ? 'Eulerian Circuit exists (all vertices have even degree).'
    : oddCount === 2
    ? 'Eulerian Trail exists (exactly 2 vertices have odd degree).'
    : `Not Eulerian (${oddCount} odd-degree vertices).`;

  return {
    nodes,
    edges,
    directed,
    degrees,
    bfsOrder,
    dfsOrder,
    shortestPath: {
      path,
      distance: Number.isFinite(targetDist) ? Number(targetDist.toFixed(4)) : null,
    },
    mstEdges,
    mstWeight: Number(mstWeight.toFixed(4)),
    connectedComponents,
    isTree,
    isBipartite,
    eulerNote,
    steps: [
      {
        id: 'gr-1',
        rule: 'Graph Traversals (BFS & DFS)',
        description: `Starting from ${startNode} across |V|=${nodes.length}, |E|=${edges.length}.`,
        latex: `\\text{BFS}: ${bfsOrder.join(' \\to ')},\\quad \\text{DFS}: ${dfsOrder.join(' \\to ')}`,
      },
      {
        id: 'gr-2',
        rule: "Dijkstra's Shortest Path & Kruskal MST",
        description:
          path.length > 0
            ? `Shortest path ${startNode} → ${targetNode} has weight ${Number(targetDist.toFixed(4))}.`
            : `No path from ${startNode} to ${targetNode}.`,
        latex: `d(${startNode}, ${targetNode}) = ${Number.isFinite(targetDist) ? Number(targetDist.toFixed(4)) : '\\infty'},\\quad w(\\text{MST}) = ${Number(mstWeight.toFixed(4))}`,
      },
    ],
  };
}

// ---------------- Combinatorics, Recurrence & Induction ----------------

function bigFactorial(n: number): bigint {
  let acc = 1n;
  for (let i = 2n; i <= BigInt(n); i++) acc *= i;
  return acc;
}

export interface RecurrenceResult {
  characteristicLatex: string;
  closedFormLatex: string;
  terms: { n: number; value: number }[];
  steps: DerivationStep[];
}

export function solveSecondOrderRecurrence(
  c1: number,
  c2: number,
  a0: number,
  a1: number,
  count = 10
): RecurrenceResult {
  const nTerms = Math.min(18, Math.max(4, Math.round(count)));
  const terms: { n: number; value: number }[] = [
    { n: 0, value: a0 },
    { n: 1, value: a1 },
  ];
  for (let n = 2; n < nTerms; n++) {
    terms.push({
      n,
      value: Number((c1 * terms[n - 1].value + c2 * terms[n - 2].value).toFixed(6)),
    });
  }

  // r^2 - c1*r - c2 = 0
  const disc = c1 * c1 + 4 * c2;
  let closedFormLatex = '';
  let rootsDesc = '';

  if (disc > 1e-9) {
    const r1 = (c1 + Math.sqrt(disc)) / 2;
    const r2 = (c1 - Math.sqrt(disc)) / 2;
    const A = (a1 - a0 * r2) / (r1 - r2);
    const B = a0 - A;
    closedFormLatex = `a_n = ${Number(A.toFixed(4))}(${Number(r1.toFixed(4))})^n ${B >= 0 ? '+' : '-'} ${Math.abs(Number(B.toFixed(4)))}(${Number(r2.toFixed(4))})^n`;
    rootsDesc = `Distinct real roots r₁ = ${r1.toFixed(4)}, r₂ = ${r2.toFixed(4)}.`;
  } else if (Math.abs(disc) <= 1e-9) {
    const r = c1 / 2;
    const A = a0;
    const B = Math.abs(r) > 1e-9 ? (a1 - a0 * r) / r : a1;
    closedFormLatex = `a_n = (${Number(A.toFixed(4))} ${B >= 0 ? '+' : '-'} ${Math.abs(Number(B.toFixed(4)))}n)(${Number(r.toFixed(4))})^n`;
    rootsDesc = `Repeated real root r = ${r.toFixed(4)}.`;
  } else {
    const real = c1 / 2;
    const imag = Math.sqrt(-disc) / 2;
    const modulus = Math.hypot(real, imag);
    const theta = Math.atan2(imag, real);
    const A = a0;
    const B = (a1 - a0 * real) / imag;
    closedFormLatex = `a_n = (${Number(modulus.toFixed(4))})^n\\left(${Number(A.toFixed(4))}\\cos(${Number(theta.toFixed(4))}n) ${B >= 0 ? '+' : '-'} ${Math.abs(Number(B.toFixed(4)))}\\sin(${Number(theta.toFixed(4))}n)\\right)`;
    rootsDesc = `Complex conjugate roots r = ${real.toFixed(3)} ± ${imag.toFixed(3)}i.`;
  }

  return {
    characteristicLatex: `r^2 ${-c1 >= 0 ? '+' : '-'} ${Math.abs(c1)}r ${-c2 >= 0 ? '+' : '-'} ${Math.abs(c2)} = 0`,
    closedFormLatex,
    terms,
    steps: [
      {
        id: 'rec-1',
        rule: 'Characteristic Equation',
        description: rootsDesc,
        latex: `r^2 - (${c1})r - (${c2}) = 0`,
      },
      {
        id: 'rec-2',
        rule: 'Closed-Form Solution via Initial Conditions',
        description: `Solved constants using a₀ = ${a0} and a₁ = ${a1}.`,
        latex: closedFormLatex,
      },
    ],
  };
}

export function computeCombinatoricsAndInduction(
  n: number,
  r: number,
  inductionId: 'sum-k' | 'sum-k2' | 'sum-k3' | 'pow2-gt-n'
) {
  const ni = Math.max(0, Math.min(25, Math.round(n)));
  const ri = Math.max(0, Math.min(ni, Math.round(r)));
  const perm = bigFactorial(ni) / bigFactorial(ni - ri);
  const comb = perm / bigFactorial(ri);

  // Derangements D_n via subfactorial recurrence
  let dPrev2 = 1n;
  let dPrev1 = 0n;
  let derange = ni === 0 ? 1n : ni === 1 ? 0n : 0n;
  for (let k = 2; k <= ni; k++) {
    derange = BigInt(k - 1) * (dPrev1 + dPrev2);
    dPrev2 = dPrev1;
    dPrev1 = derange;
  }

  let inductionProof: {
    statementLatex: string;
    baseCase: string;
    inductiveHypothesis: string;
    inductiveStepLatex: string;
    verifiedUpTo: number;
    lhsValue: number;
    rhsValue: number;
    holds: boolean;
  };

  const testN = Math.max(1, ni);
  if (inductionId === 'sum-k') {
    const lhs = (testN * (testN + 1)) / 2;
    inductionProof = {
      statementLatex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
      baseCase: 'For n = 1: LHS = 1 and RHS = 1(2)/2 = 1. Base case holds.',
      inductiveHypothesis: 'Assume P(k): 1 + 2 + … + k = k(k+1)/2 holds for arbitrary integer k ≥ 1.',
      inductiveStepLatex:
        '\\sum_{i=1}^{k+1} i = \\frac{k(k+1)}{2} + (k+1) = (k+1)\\left(\\frac{k}{2}+1\\right) = \\frac{(k+1)(k+2)}{2}',
      verifiedUpTo: testN,
      lhsValue: lhs,
      rhsValue: lhs,
      holds: true,
    };
  } else if (inductionId === 'sum-k2') {
    let lhs = 0;
    for (let i = 1; i <= testN; i++) lhs += i * i;
    const rhs = (testN * (testN + 1) * (2 * testN + 1)) / 6;
    inductionProof = {
      statementLatex: '\\sum_{i=1}^{n} i^2 = \\frac{n(n+1)(2n+1)}{6}',
      baseCase: 'For n = 1: LHS = 1² = 1 and RHS = 1·2·3/6 = 1. Base case holds.',
      inductiveHypothesis: 'Assume ∑_{i=1}^k i² = k(k+1)(2k+1)/6 holds for integer k ≥ 1.',
      inductiveStepLatex:
        '\\frac{k(k+1)(2k+1)}{6} + (k+1)^2 = \\frac{(k+1)(2k^2+7k+6)}{6} = \\frac{(k+1)(k+2)(2k+3)}{6}',
      verifiedUpTo: testN,
      lhsValue: lhs,
      rhsValue: rhs,
      holds: lhs === rhs,
    };
  } else if (inductionId === 'sum-k3') {
    let lhs = 0;
    for (let i = 1; i <= testN; i++) lhs += i ** 3;
    const rhs = ((testN * (testN + 1)) / 2) ** 2;
    inductionProof = {
      statementLatex: '\\sum_{i=1}^{n} i^3 = \\left(\\frac{n(n+1)}{2}\\right)^2',
      baseCase: 'For n = 1: LHS = 1³ = 1 and RHS = (1·2/2)² = 1. Base case holds.',
      inductiveHypothesis: 'Assume ∑_{i=1}^k i³ = [k(k+1)/2]² holds for integer k ≥ 1.',
      inductiveStepLatex:
        '\\frac{k^2(k+1)^2}{4} + (k+1)^3 = \\frac{(k+1)^2(k^2+4k+4)}{4} = \\left(\\frac{(k+1)(k+2)}{2}\\right)^2',
      verifiedUpTo: testN,
      lhsValue: lhs,
      rhsValue: rhs,
      holds: lhs === rhs,
    };
  } else {
    const lhs = 2 ** testN;
    const rhs = testN;
    inductionProof = {
      statementLatex: '2^n > n \\quad \\forall\\, n \\ge 1',
      baseCase: 'For n = 1: 2¹ = 2 > 1. Base case holds.',
      inductiveHypothesis: 'Assume 2^k > k holds for some integer k ≥ 1.',
      inductiveStepLatex: '2^{k+1} = 2 \\cdot 2^k > 2k = k + k \\ge k + 1',
      verifiedUpTo: testN,
      lhsValue: lhs,
      rhsValue: rhs,
      holds: lhs > rhs,
    };
  }

  return {
    n: ni,
    r: ri,
    permutations: perm.toString(),
    combinations: comb.toString(),
    derangements: derange.toString(),
    factorialN: bigFactorial(ni).toString(),
    inductionProof,
  };
}
