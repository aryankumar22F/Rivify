import type { DerivationStep } from '../types';

export interface LPConstraint {
  coeffs: number[];
  sign: '<=' | '>=' | '=';
  rhs: number;
}

export interface SimplexTableauSnapshot {
  iteration: number;
  headers: string[];
  basicVars: string[];
  rows: number[][]; // last column is RHS, last row is Z - C
  pivotRow?: number;
  pivotCol?: number;
  note: string;
}

export interface LPSolutionResult {
  objectiveType: 'max' | 'min';
  optimalValue: number;
  solution: number[];
  status: 'optimal' | 'unbounded' | 'infeasible';
  tableaus: SimplexTableauSnapshot[];
  feasibleVertices2D?: { x: number; y: number; z: number }[];
  steps: DerivationStep[];
}

export function solveLinearProgramSimplex(
  objectiveType: 'max' | 'min',
  c: number[],
  constraints: LPConstraint[]
): LPSolutionResult {
  const nVars = c.length;
  if (nVars < 2 || nVars > 4) {
    throw new Error('Linear programming supports 2 to 4 decision variables.');
  }
  if (constraints.length === 0) {
    throw new Error('Add at least one constraint.');
  }

  // Standardize <= with non-negative RHS where possible (Big-M for >= / =)
  const normConstraints = constraints.map((con) => {
    if (con.rhs < 0) {
      return {
        coeffs: con.coeffs.map((v) => -v),
        sign: (con.sign === '<=' ? '>=' : con.sign === '>=' ? '<=' : '=') as LPConstraint['sign'],
        rhs: -con.rhs,
      };
    }
    return con;
  });

  const BIG_M = 1e5;
  const colNames: string[] = Array.from({ length: nVars }, (_, i) => `x${i + 1}`);
  const basicVars: string[] = [];
  let slackCount = 0;
  let artCount = 0;

  // Build structural columns first, then add slacks/surplus/artificials
  const extraColsMeta: { name: string; isArt: boolean }[] = [];
  const rowExtras: number[][] = normConstraints.map(() => []);

  normConstraints.forEach((con, rIdx) => {
    if (con.sign === '<=') {
      slackCount++;
      const name = `s${slackCount}`;
      extraColsMeta.push({ name, isArt: false });
      normConstraints.forEach((_, rr) => rowExtras[rr].push(rr === rIdx ? 1 : 0));
      basicVars.push(name);
    } else if (con.sign === '>=') {
      slackCount++;
      const surpName = `s${slackCount}`;
      extraColsMeta.push({ name: surpName, isArt: false });
      normConstraints.forEach((_, rr) => rowExtras[rr].push(rr === rIdx ? -1 : 0));

      artCount++;
      const artName = `a${artCount}`;
      extraColsMeta.push({ name: artName, isArt: true });
      normConstraints.forEach((_, rr) => rowExtras[rr].push(rr === rIdx ? 1 : 0));
      basicVars.push(artName);
    } else {
      artCount++;
      const artName = `a${artCount}`;
      extraColsMeta.push({ name: artName, isArt: true });
      normConstraints.forEach((_, rr) => rowExtras[rr].push(rr === rIdx ? 1 : 0));
      basicVars.push(artName);
    }
  });

  const headers = [...colNames, ...extraColsMeta.map((m) => m.name), 'RHS'];
  const totalCols = headers.length; // includes RHS
  const m = normConstraints.length;

  // Maximization objective Z_eff = sum (objectiveType === 'max' ? c_j : -c_j) x_j - M * sum artificial
  const objCoeffs = [
    ...c.map((v) => (objectiveType === 'max' ? v : -v)),
    ...extraColsMeta.map((meta) => (meta.isArt ? -BIG_M : 0)),
  ];

  const tableau: number[][] = normConstraints.map((con, rIdx) => [
    ...con.coeffs,
    ...rowExtras[rIdx],
    con.rhs,
  ]);

  // Objective row: Z - sum c_j x_j = 0 -> row starts as -objCoeffs and RHS 0
  const objRow = [...objCoeffs.map((v) => -v), 0];
  // Eliminate basic artificial variables from objective row
  for (let r = 0; r < m; r++) {
    const bName = basicVars[r];
    const colIdx = headers.indexOf(bName);
    if (colIdx >= 0 && Math.abs(objRow[colIdx]) > 1e-9) {
      const mult = objRow[colIdx];
      for (let j = 0; j < totalCols; j++) {
        objRow[j] -= mult * tableau[r][j];
      }
    }
  }
  tableau.push(objRow);

  const tableaus: SimplexTableauSnapshot[] = [];
  const cloneRows = (rows: number[][]) => rows.map((r) => r.map((v) => Number(v.toFixed(4))));

  let status: LPSolutionResult['status'] = 'optimal';
  const maxIter = 25;
  for (let iter = 0; iter < maxIter; iter++) {
    const zRow = tableau[m];
    let enterCol = -1;
    let minVal = -1e-7;
    for (let j = 0; j < totalCols - 1; j++) {
      if (zRow[j] < minVal) {
        minVal = zRow[j];
        enterCol = j;
      }
    }

    if (enterCol === -1) {
      tableaus.push({
        iteration: iter,
        headers,
        basicVars: [...basicVars],
        rows: cloneRows(tableau),
        note: 'All objective row coefficients ≥ 0. Optimal tableau reached.',
      });
      break;
    }

    // Ratio test
    let leaveRow = -1;
    let bestRatio = Infinity;
    for (let r = 0; r < m; r++) {
      const coeff = tableau[r][enterCol];
      if (coeff > 1e-8) {
        const ratio = tableau[r][totalCols - 1] / coeff;
        if (ratio >= -1e-9 && ratio < bestRatio - 1e-9) {
          bestRatio = ratio;
          leaveRow = r;
        }
      }
    }

    if (leaveRow === -1) {
      status = 'unbounded';
      tableaus.push({
        iteration: iter,
        headers,
        basicVars: [...basicVars],
        rows: cloneRows(tableau),
        pivotCol: enterCol,
        note: `Entering variable ${headers[enterCol]} has no positive pivot row — problem is unbounded.`,
      });
      break;
    }

    tableaus.push({
      iteration: iter,
      headers,
      basicVars: [...basicVars],
      rows: cloneRows(tableau),
      pivotRow: leaveRow,
      pivotCol: enterCol,
      note: `Pivot on ${headers[enterCol]} (entering) replacing ${basicVars[leaveRow]} (leaving, min ratio = ${bestRatio.toFixed(3)}).`,
    });

    // Pivot operation
    basicVars[leaveRow] = headers[enterCol];
    const piv = tableau[leaveRow][enterCol];
    for (let j = 0; j < totalCols; j++) tableau[leaveRow][j] /= piv;
    for (let r = 0; r <= m; r++) {
      if (r === leaveRow) continue;
      const factor = tableau[r][enterCol];
      if (Math.abs(factor) > 1e-12) {
        for (let j = 0; j < totalCols; j++) {
          tableau[r][j] -= factor * tableau[leaveRow][j];
        }
      }
    }
  }

  // Check if any artificial variable remains non-zero
  for (let r = 0; r < m; r++) {
    if (basicVars[r].startsWith('a') && tableau[r][totalCols - 1] > 1e-5) {
      status = 'infeasible';
    }
  }

  const solution = Array.from({ length: nVars }, (_, i) => {
    const idx = basicVars.indexOf(`x${i + 1}`);
    return idx >= 0 ? Number(Math.max(0, tableau[idx][totalCols - 1]).toFixed(5)) : 0;
  });
  const optimalValue = Number(
    solution.reduce((s, val, idx) => s + val * c[idx], 0).toFixed(5)
  );

  // Compute 2D graphical feasible polygon vertices if nVars === 2
  let feasibleVertices2D: { x: number; y: number; z: number }[] | undefined;
  if (nVars === 2) {
    const lines: { a: number; b: number; c: number }[] = [
      { a: 1, b: 0, c: 0 },
      { a: 0, b: 1, c: 0 },
      ...normConstraints.map((con) => ({ a: con.coeffs[0], b: con.coeffs[1], c: con.rhs })),
    ];
    const candidates: { x: number; y: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const l1 = lines[i];
        const l2 = lines[j];
        const det = l1.a * l2.b - l2.a * l1.b;
        if (Math.abs(det) > 1e-9) {
          const x = (l1.c * l2.b - l2.c * l1.b) / det;
          const y = (l1.a * l2.c - l2.a * l1.c) / det;
          if (x >= -1e-6 && y >= -1e-6) {
            const ok = normConstraints.every((con) => {
              const lhs = con.coeffs[0] * x + con.coeffs[1] * y;
              if (con.sign === '<=') return lhs <= con.rhs + 1e-5;
              if (con.sign === '>=') return lhs >= con.rhs - 1e-5;
              return Math.abs(lhs - con.rhs) <= 1e-5;
            });
            if (ok) candidates.push({ x: Math.max(0, x), y: Math.max(0, y) });
          }
        }
      }
    }
    const unique: { x: number; y: number; z: number }[] = [];
    for (const pt of candidates) {
      if (!unique.some((u) => Math.hypot(u.x - pt.x, u.y - pt.y) < 1e-4)) {
        unique.push({
          x: Number(pt.x.toFixed(4)),
          y: Number(pt.y.toFixed(4)),
          z: Number((c[0] * pt.x + c[1] * pt.y).toFixed(4)),
        });
      }
    }
    if (unique.length >= 3) {
      const cx = unique.reduce((s, p) => s + p.x, 0) / unique.length;
      const cy = unique.reduce((s, p) => s + p.y, 0) / unique.length;
      unique.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    }
    feasibleVertices2D = unique;
  }

  return {
    objectiveType,
    optimalValue,
    solution,
    status,
    tableaus,
    feasibleVertices2D,
    steps: [
      {
        id: 'lp-1',
        rule: 'Standard Form & Tableau Initialization',
        description: `Added ${slackCount} slack/surplus variable(s) and ${artCount} artificial variable(s).`,
        latex: `\\text{${objectiveType === 'max' ? 'Maximize' : 'Minimize'}} \\; Z = ${c.map((v, i) => `${v}x_${i + 1}`).join(' + ')}`,
      },
      {
        id: 'lp-2',
        rule: 'Simplex Method Convergence',
        description:
          status === 'optimal'
            ? `Converged in ${tableaus.length - 1} pivot iteration(s).`
            : `Solver terminated with status: ${status}.`,
        latex:
          status === 'optimal'
            ? `Z^* = ${optimalValue},\\quad (${solution.map((v, i) => `x_${i + 1}=${v}`).join(', ')})`
            : `\\text{Status: ${status}}`,
      },
    ],
  };
}

// ---------------- Transportation Problem (VAM / Least Cost / NW) ----------------

export interface TransportationResult {
  allocations: number[][];
  totalCost: number;
  balancedSupply: number[];
  balancedDemand: number[];
  balancedCosts: number[][];
  steps: DerivationStep[];
}

export function solveTransportation(
  costs: number[][],
  supply: number[],
  demand: number[],
  method: 'vam' | 'least-cost' | 'nw-corner' = 'vam'
): TransportationResult {
  const m = supply.length;
  const n = demand.length;
  const sumS = supply.reduce((a, b) => a + b, 0);
  const sumD = demand.reduce((a, b) => a + b, 0);

  const balancedCosts = costs.map((r) => [...r]);
  const balancedSupply = [...supply];
  const balancedDemand = [...demand];

  if (Math.abs(sumS - sumD) > 1e-6) {
    if (sumS > sumD) {
      balancedDemand.push(sumS - sumD);
      balancedCosts.forEach((r) => r.push(0));
    } else {
      balancedSupply.push(sumD - sumS);
      balancedCosts.push(Array(balancedDemand.length).fill(0));
    }
  }

  const R = balancedSupply.length;
  const C = balancedDemand.length;
  const remS = [...balancedSupply];
  const remD = [...balancedDemand];
  const allocations = Array.from({ length: R }, () => Array(C).fill(0));
  const rowActive = Array(R).fill(true);
  const colActive = Array(C).fill(true);

  if (method === 'nw-corner') {
    let i = 0;
    let j = 0;
    while (i < R && j < C) {
      const qty = Math.min(remS[i], remD[j]);
      allocations[i][j] = qty;
      remS[i] -= qty;
      remD[j] -= qty;
      if (remS[i] <= 1e-9) i++;
      else j++;
    }
  } else {
    while (rowActive.some(Boolean) && colActive.some(Boolean)) {
      let bestI = -1;
      let bestJ = -1;

      if (method === 'least-cost') {
        let minC = Infinity;
        for (let i = 0; i < R; i++) {
          if (!rowActive[i]) continue;
          for (let j = 0; j < C; j++) {
            if (!colActive[j]) continue;
            if (balancedCosts[i][j] < minC) {
              minC = balancedCosts[i][j];
              bestI = i;
              bestJ = j;
            }
          }
        }
      } else {
        // Vogel's Approximation Method (VAM)
        let maxPenalty = -1;
        let pickRow = true;
        let pickIdx = -1;

        for (let i = 0; i < R; i++) {
          if (!rowActive[i]) continue;
          const vals = balancedCosts[i].filter((_, j) => colActive[j]).sort((a, b) => a - b);
          const pen = vals.length >= 2 ? vals[1] - vals[0] : vals[0] ?? 0;
          if (pen > maxPenalty) {
            maxPenalty = pen;
            pickRow = true;
            pickIdx = i;
          }
        }
        for (let j = 0; j < C; j++) {
          if (!colActive[j]) continue;
          const vals = balancedCosts.map((r) => r[j]).filter((_, i) => rowActive[i]).sort((a, b) => a - b);
          const pen = vals.length >= 2 ? vals[1] - vals[0] : vals[0] ?? 0;
          if (pen > maxPenalty) {
            maxPenalty = pen;
            pickRow = false;
            pickIdx = j;
          }
        }

        let minCell = Infinity;
        if (pickRow) {
          bestI = pickIdx;
          for (let j = 0; j < C; j++) {
            if (colActive[j] && balancedCosts[bestI][j] < minCell) {
              minCell = balancedCosts[bestI][j];
              bestJ = j;
            }
          }
        } else {
          bestJ = pickIdx;
          for (let i = 0; i < R; i++) {
            if (rowActive[i] && balancedCosts[i][bestJ] < minCell) {
              minCell = balancedCosts[i][bestJ];
              bestI = i;
            }
          }
        }
      }

      if (bestI < 0 || bestJ < 0) break;
      const qty = Math.min(remS[bestI], remD[bestJ]);
      allocations[bestI][bestJ] = qty;
      remS[bestI] -= qty;
      remD[bestJ] -= qty;
      if (remS[bestI] <= 1e-9 && remD[bestJ] <= 1e-9) {
        if (rowActive.filter(Boolean).length > 1) rowActive[bestI] = false;
        else colActive[bestJ] = false;
      } else if (remS[bestI] <= 1e-9) {
        rowActive[bestI] = false;
      } else if (remD[bestJ] <= 1e-9) {
        colActive[bestJ] = false;
      }
    }
  }

  let totalCost = 0;
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      totalCost += allocations[i][j] * balancedCosts[i][j];
    }
  }

  return {
    allocations,
    totalCost: Number(totalCost.toFixed(4)),
    balancedSupply,
    balancedDemand,
    balancedCosts,
    steps: [
      {
        id: 'tr-1',
        rule: 'Supply vs Demand Balance',
        description:
          Math.abs(sumS - sumD) < 1e-6
            ? `Balanced problem: ∑Supply = ∑Demand = ${sumS}.`
            : `Unbalanced (${sumS} vs ${sumD}) — added dummy ${sumS > sumD ? 'destination' : 'source'} with 0 cost.`,
        latex: `\\sum S_i = ${sumS},\\quad \\sum D_j = ${sumD}`,
      },
      {
        id: 'tr-2',
        rule:
          method === 'vam'
            ? "Vogel's Approximation Method (VAM)"
            : method === 'least-cost'
            ? 'Least-Cost Cell Method'
            : 'North-West Corner Rule',
        description: `Computed basic feasible schedule on ${m}×${n} cost matrix.`,
        latex: `\\text{Total Cost } Z = ${Number(totalCost.toFixed(4))}`,
      },
    ],
  };
}

// ---------------- Hungarian Assignment Algorithm ----------------

export interface AssignmentResult {
  assignments: { worker: number; task: number; cost: number }[];
  totalCost: number;
  rowReduced: number[][];
  colReduced: number[][];
  steps: DerivationStep[];
}

export function solveAssignmentHungarian(costMatrix: number[][]): AssignmentResult {
  const n = costMatrix.length;
  if (n === 0 || costMatrix.some((r) => r.length !== n)) {
    throw new Error('Assignment matrix must be square (n × n).');
  }

  const rowReduced = costMatrix.map((row) => {
    const minVal = Math.min(...row);
    return row.map((v) => v - minVal);
  });

  const colReduced = rowReduced.map((r) => [...r]);
  for (let j = 0; j < n; j++) {
    const colMin = Math.min(...colReduced.map((r) => r[j]));
    for (let i = 0; i < n; i++) colReduced[i][j] -= colMin;
  }

  // Exact Jonker-Volgenant / Hungarian O(n^3) solver
  const u = Array(n + 1).fill(0);
  const v = Array(n + 1).fill(0);
  const p = Array(n + 1).fill(0);
  const way = Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(n + 1).fill(Infinity);
    const used = Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const workerToTask = Array(n).fill(0);
  for (let j = 1; j <= n; j++) {
    if (p[j] >= 1 && p[j] <= n) {
      workerToTask[p[j] - 1] = j - 1;
    }
  }

  const assignments = workerToTask.map((task, worker) => ({
    worker,
    task,
    cost: costMatrix[worker][task],
  }));
  const totalCost = assignments.reduce((s, a) => s + a.cost, 0);

  return {
    assignments,
    totalCost,
    rowReduced,
    colReduced,
    steps: [
      {
        id: 'asg-1',
        rule: 'Row & Column Reductions',
        description: `Subtracted row minima then column minima across ${n}×${n} cost matrix.`,
        latex: `\\text{Min Cost} = ${assignments.map((a) => `C_{${a.worker + 1},${a.task + 1}}`).join(' + ')} = ${totalCost}`,
      },
    ],
  };
}

// ---------------- Network Max Flow (Edmonds-Karp) ----------------

export interface NetworkFlowResult {
  nodes: string[];
  edges: { u: string; v: string; capacity: number; flow: number }[];
  maxFlow: number;
  augmentingPaths: { path: string[]; bottleneck: number }[];
  steps: DerivationStep[];
}

export function solveMaxFlow(
  edgesInput: { u: string; v: string; capacity: number }[],
  source: string,
  sink: string
): NetworkFlowResult {
  const nodeSet = new Set<string>([source, sink]);
  for (const e of edgesInput) {
    nodeSet.add(e.u);
    nodeSet.add(e.v);
  }
  const nodes = Array.from(nodeSet).sort();
  const cap = new Map<string, Map<string, number>>();
  const flow = new Map<string, Map<string, number>>();
  for (const u of nodes) {
    cap.set(u, new Map());
    flow.set(u, new Map());
  }
  for (const e of edgesInput) {
    cap.get(e.u)!.set(e.v, (cap.get(e.u)!.get(e.v) ?? 0) + Math.max(0, e.capacity));
  }

  let maxFlow = 0;
  const augmentingPaths: { path: string[]; bottleneck: number }[] = [];

  for (let guard = 0; guard < 100; guard++) {
    const parent = new Map<string, string | null>();
    parent.set(source, null);
    const q = [source];
    while (q.length > 0 && !parent.has(sink)) {
      const u = q.shift()!;
      for (const v of nodes) {
        if (!parent.has(v)) {
          const resCap = (cap.get(u)!.get(v) ?? 0) - (flow.get(u)!.get(v) ?? 0);
          if (resCap > 1e-9) {
            parent.set(v, u);
            q.push(v);
          }
        }
      }
    }
    if (!parent.has(sink)) break;

    let bottleneck = Infinity;
    const path: string[] = [];
    let cur: string | null = sink;
    while (cur && cur !== source) {
      const prevNode: string | null = parent.get(cur) ?? null;
      if (!prevNode) break;
      const resCap = (cap.get(prevNode)!.get(cur) ?? 0) - (flow.get(prevNode)!.get(cur) ?? 0);
      bottleneck = Math.min(bottleneck, resCap);
      path.unshift(cur);
      cur = prevNode;
    }
    path.unshift(source);

    cur = sink;
    while (cur && cur !== source) {
      const prevNode: string | null = parent.get(cur) ?? null;
      if (!prevNode) break;
      flow.get(prevNode)!.set(cur, (flow.get(prevNode)!.get(cur) ?? 0) + bottleneck);
      flow.get(cur)!.set(prevNode, (flow.get(cur)!.get(prevNode) ?? 0) - bottleneck);
      cur = prevNode;
    }
    maxFlow += bottleneck;
    augmentingPaths.push({ path, bottleneck });
  }

  const edges = edgesInput.map((e) => ({
    ...e,
    flow: Math.max(0, flow.get(e.u)!.get(e.v) ?? 0),
  }));

  return {
    nodes,
    edges,
    maxFlow,
    augmentingPaths,
    steps: [
      {
        id: 'nf-1',
        rule: 'Edmonds-Karp Augmenting Paths',
        description: `Found ${augmentingPaths.length} shortest augmenting path(s) from ${source} to ${sink}.`,
        latex: `F_{\\max}(${source} \\to ${sink}) = ${maxFlow}`,
      },
    ],
  };
}

// ---------------- Decision Theory ----------------

export interface DecisionTheoryResult {
  alternatives: {
    name: string;
    maximax: number;
    maximin: number;
    hurwicz: number;
    laplace: number;
    maxRegret: number;
    emv: number;
  }[];
  bestMaximax: string;
  bestMaximin: string;
  bestHurwicz: string;
  bestLaplace: string;
  bestMinimaxRegret: string;
  bestEMV: string;
  evpi: number;
  steps: DerivationStep[];
}

export function solveDecisionTheory(
  altNames: string[],
  payoffs: number[][],
  probabilities: number[],
  alpha = 0.6
): DecisionTheoryResult {
  const m = payoffs.length;
  const n = payoffs[0]?.length ?? 0;
  const probSum = probabilities.reduce((a, b) => a + b, 0);
  const normProbs =
    probSum > 1e-9 ? probabilities.map((p) => p / probSum) : Array(n).fill(1 / Math.max(1, n));

  const colMax = Array.from({ length: n }, (_, j) => Math.max(...payoffs.map((r) => r[j])));
  const regretMatrix = payoffs.map((row) => row.map((val, j) => colMax[j] - val));

  const alternatives = payoffs.map((row, i) => {
    const maxP = Math.max(...row);
    const minP = Math.min(...row);
    const hurwicz = alpha * maxP + (1 - alpha) * minP;
    const laplace = row.reduce((a, b) => a + b, 0) / n;
    const maxRegret = Math.max(...regretMatrix[i]);
    const emv = row.reduce((s, val, j) => s + val * normProbs[j], 0);
    return {
      name: altNames[i] || `A${i + 1}`,
      maximax: maxP,
      maximin: minP,
      hurwicz: Number(hurwicz.toFixed(4)),
      laplace: Number(laplace.toFixed(4)),
      maxRegret: Number(maxRegret.toFixed(4)),
      emv: Number(emv.toFixed(4)),
    };
  });

  const pickMax = (fn: (a: DecisionTheoryResult['alternatives'][number]) => number) =>
    alternatives.reduce((best, cur) => (fn(cur) > fn(best) ? cur : best), alternatives[0]).name;
  const pickMin = (fn: (a: DecisionTheoryResult['alternatives'][number]) => number) =>
    alternatives.reduce((best, cur) => (fn(cur) < fn(best) ? cur : best), alternatives[0]).name;

  const epwpi = colMax.reduce((s, val, j) => s + val * normProbs[j], 0);
  const maxEmv = Math.max(...alternatives.map((a) => a.emv));
  const evpi = Number(Math.max(0, epwpi - maxEmv).toFixed(4));

  const bestEMV = pickMax((a) => a.emv);

  return {
    alternatives,
    bestMaximax: pickMax((a) => a.maximax),
    bestMaximin: pickMax((a) => a.maximin),
    bestHurwicz: pickMax((a) => a.hurwicz),
    bestLaplace: pickMax((a) => a.laplace),
    bestMinimaxRegret: pickMin((a) => a.maxRegret),
    bestEMV,
    evpi,
    steps: [
      {
        id: 'dt-1',
        rule: 'Uncertainty & Risk Criteria',
        description: `Evaluated ${m} alternatives across ${n} states of nature (α = ${alpha}).`,
        latex: `\\text{EMV}^* = \\textbf{${bestEMV}}\\; (${maxEmv.toFixed(2)}),\\quad \\text{EVPI} = ${evpi}`,
      },
    ],
  };
}
