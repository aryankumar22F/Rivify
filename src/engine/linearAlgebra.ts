import type { DerivationStep } from '../types';

export type Matrix = number[][];

export interface LinearAlgebraResult {
  operation: string;
  resultMatrix?: Matrix;
  scalarResult?: number;
  rank?: number;
  eigenvalues?: { real: number; imag: number }[];
  eigenvectors?: number[][];
  lu?: { P: Matrix; L: Matrix; U: Matrix };
  systemSolution?: { status: 'unique' | 'infinite' | 'inconsistent'; x?: number[] };
  resultLatex: string;
  steps: DerivationStep[];
}

export function matrixToLatex(M: Matrix, digits = 4): string {
  const rows = M.map((row) =>
    row
      .map((v) => {
        const clean = Math.abs(v) < 1e-10 ? 0 : Number(v.toFixed(digits));
        return String(clean);
      })
      .join(' & ')
  );
  return `\\begin{bmatrix} ${rows.join(' \\\\ ')} \\end{bmatrix}`;
}

export function addMatrices(A: Matrix, B: Matrix): LinearAlgebraResult {
  if (A.length !== B.length || A[0].length !== B[0].length) {
    throw new Error(`Dimension mismatch: A is ${A.length}×${A[0].length}, B is ${B.length}×${B[0].length}.`);
  }
  const res = A.map((row, i) => row.map((v, j) => v + B[i][j]));
  return {
    operation: 'Matrix Addition (A + B)',
    resultMatrix: res,
    resultLatex: `A + B = ${matrixToLatex(res)}`,
    steps: [
      {
        id: 'la-add',
        rule: 'Entrywise Sum',
        description: 'Add corresponding entries (A + B)ᵢⱼ = Aᵢⱼ + Bᵢⱼ.',
        latex: `${matrixToLatex(A)} + ${matrixToLatex(B)} = ${matrixToLatex(res)}`,
      },
    ],
  };
}

export function subtractMatrices(A: Matrix, B: Matrix): LinearAlgebraResult {
  if (A.length !== B.length || A[0].length !== B[0].length) {
    throw new Error(`Dimension mismatch: A is ${A.length}×${A[0].length}, B is ${B.length}×${B[0].length}.`);
  }
  const res = A.map((row, i) => row.map((v, j) => v - B[i][j]));
  return {
    operation: 'Matrix Subtraction (A − B)',
    resultMatrix: res,
    resultLatex: `A - B = ${matrixToLatex(res)}`,
    steps: [
      {
        id: 'la-sub',
        rule: 'Entrywise Difference',
        description: 'Subtract corresponding entries (A − B)ᵢⱼ = Aᵢⱼ − Bᵢⱼ.',
        latex: `${matrixToLatex(A)} - ${matrixToLatex(B)} = ${matrixToLatex(res)}`,
      },
    ],
  };
}

export function multiplyMatrices(A: Matrix, B: Matrix): LinearAlgebraResult {
  if (A[0].length !== B.length) {
    throw new Error(
      `Incompatible inner dimensions: A is ${A.length}×${A[0].length}, B is ${B.length}×${B[0].length}.`
    );
  }
  const m = A.length;
  const kLen = A[0].length;
  const p = B[0].length;
  const res: Matrix = Array.from({ length: m }, () => Array(p).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < kLen; k++) sum += A[i][k] * B[k][j];
      res[i][j] = sum;
    }
  }
  return {
    operation: 'Matrix Multiplication (A · B)',
    resultMatrix: res,
    resultLatex: `AB = ${matrixToLatex(res)}`,
    steps: [
      {
        id: 'la-mul',
        rule: 'Row-by-Column Dot Product',
        description: `Multiply ${m}×${kLen} matrix A by ${kLen}×${p} matrix B to obtain a ${m}×${p} matrix.`,
        latex: `${matrixToLatex(A)}${matrixToLatex(B)} = ${matrixToLatex(res)}`,
      },
    ],
  };
}

export function transposeMatrix(A: Matrix): LinearAlgebraResult {
  const m = A.length;
  const n = A[0].length;
  const res: Matrix = Array.from({ length: n }, (_, j) =>
    Array.from({ length: m }, (__, i) => A[i][j])
  );
  return {
    operation: 'Matrix Transpose (Aᵀ)',
    resultMatrix: res,
    resultLatex: `A^T = ${matrixToLatex(res)}`,
    steps: [
      {
        id: 'la-tr',
        rule: 'Swap Rows and Columns',
        description: 'Set (Aᵀ)ᵢⱼ = Aⱼᵢ.',
        latex: `A^T = ${matrixToLatex(res)}`,
      },
    ],
  };
}

export function gaussianEliminationRREF(A: Matrix): {
  rref: Matrix;
  rank: number;
  detIfSquare: number | null;
  steps: DerivationStep[];
} {
  const m = A.length;
  const n = A[0].length;
  const M = A.map((r) => [...r]);
  const steps: DerivationStep[] = [];
  let pivotRow = 0;
  let detSign = 1;
  let detProd = 1;

  for (let col = 0; col < n && pivotRow < m; col++) {
    let best = pivotRow;
    for (let r = pivotRow + 1; r < m; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[best][col])) best = r;
    }
    if (Math.abs(M[best][col]) < 1e-10) {
      if (m === n) detProd = 0;
      continue;
    }
    if (best !== pivotRow) {
      [M[pivotRow], M[best]] = [M[best], M[pivotRow]];
      detSign *= -1;
      steps.push({
        id: `rref-swap-${steps.length + 1}`,
        rule: `Swap R${pivotRow + 1} ↔ R${best + 1}`,
        description: 'Partial pivoting for numerical stability.',
        latex: matrixToLatex(M, 3),
      });
    }

    const piv = M[pivotRow][col];
    detProd *= piv;
    for (let j = col; j < n; j++) M[pivotRow][j] /= piv;

    for (let r = 0; r < m; r++) {
      if (r === pivotRow) continue;
      const factor = M[r][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j < n; j++) {
        M[r][j] -= factor * M[pivotRow][j];
      }
    }
    steps.push({
      id: `rref-elim-${steps.length + 1}`,
      rule: `Pivot Column ${col + 1}`,
      description: `Normalize pivot R${pivotRow + 1} (÷ ${Number(piv.toFixed(4))}) and eliminate column ${col + 1}.`,
      latex: matrixToLatex(M, 3),
    });
    pivotRow++;
  }

  const detIfSquare =
    m === n ? (pivotRow < n ? 0 : detSign * detProd) : null;

  return { rref: M, rank: pivotRow, detIfSquare, steps };
}

export function determinantAndRank(A: Matrix): LinearAlgebraResult {
  const { rref, rank, detIfSquare, steps } = gaussianEliminationRREF(A);
  const isSquare = A.length === A[0].length;
  return {
    operation: isSquare ? 'Determinant, Rank & RREF' : 'Rank & RREF',
    resultMatrix: rref,
    rank,
    scalarResult: detIfSquare ?? undefined,
    resultLatex: isSquare
      ? `\\det(A) = ${Number((detIfSquare ?? 0).toFixed(5))}, \\quad \\operatorname{rank}(A) = ${rank}`
      : `\\operatorname{rank}(A) = ${rank}`,
    steps: [
      ...steps,
      {
        id: 'la-dr-final',
        rule: 'Summary',
        description: isSquare
          ? `Counted ${rank} non-zero pivots in RREF; determinant equals product of elimination pivots.`
          : `Counted ${rank} leading pivots in RREF.`,
        latex: `\\operatorname{rank}(A) = ${rank}${
          isSquare ? `, \\quad \\det(A) = ${Number((detIfSquare ?? 0).toFixed(5))}` : ''
        }`,
      },
    ],
  };
}

export function inverseMatrix(A: Matrix): LinearAlgebraResult {
  const n = A.length;
  if (n !== A[0].length) {
    throw new Error('Matrix inverse is only defined for square (n×n) matrices.');
  }
  const aug: Matrix = A.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  const { rref, rank, steps } = gaussianEliminationRREF(aug);
  if (rank < n) {
    throw new Error('Matrix is singular (det = 0); inverse does not exist.');
  }
  // Check left half is I
  for (let i = 0; i < n; i++) {
    if (Math.abs(rref[i][i] - 1) > 1e-6) {
      throw new Error('Matrix is singular or ill-conditioned; inverse does not exist.');
    }
  }
  const inv = rref.map((row) => row.slice(n));
  return {
    operation: 'Matrix Inverse (Gauss-Jordan)',
    resultMatrix: inv,
    resultLatex: `A^{-1} = ${matrixToLatex(inv)}`,
    steps: [
      {
        id: 'inv-start',
        rule: 'Form Augmented Matrix [A | I]',
        description: 'Apply Gauss-Jordan elimination to transform [A | I] → [I | A⁻¹].',
        latex: matrixToLatex(aug, 3),
      },
      ...steps.slice(0, 5),
      {
        id: 'inv-end',
        rule: 'Inverse Extracted',
        description: 'Right block yields A⁻¹.',
        latex: `A^{-1} = ${matrixToLatex(inv)}`,
      },
    ],
  };
}

export function luDecomposition(A: Matrix): LinearAlgebraResult {
  const n = A.length;
  if (n !== A[0].length) {
    throw new Error('LU Decomposition here requires a square (n×n) matrix.');
  }
  const U: Matrix = A.map((r) => [...r]);
  const L: Matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))
  );
  const P: Matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))
  );
  const steps: DerivationStep[] = [];

  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let r = k + 1; r < n; r++) {
      if (Math.abs(U[r][k]) > Math.abs(U[piv][k])) piv = r;
    }
    if (piv !== k) {
      [U[k], U[piv]] = [U[piv], U[k]];
      [P[k], P[piv]] = [P[piv], P[k]];
      for (let j = 0; j < k; j++) {
        [L[k][j], L[piv][j]] = [L[piv][j], L[k][j]];
      }
      steps.push({
        id: `lu-swap-${k}`,
        rule: `Pivot Row Swap R${k + 1} ↔ R${piv + 1}`,
        description: 'Update permutation matrix P and already-computed L multipliers.',
        latex: `P = ${matrixToLatex(P, 2)}`,
      });
    }
    if (Math.abs(U[k][k]) < 1e-11) {
      continue;
    }
    for (let i = k + 1; i < n; i++) {
      const mult = U[i][k] / U[k][k];
      L[i][k] = mult;
      for (let j = k; j < n; j++) {
        U[i][j] -= mult * U[k][j];
      }
    }
    steps.push({
      id: `lu-step-${k}`,
      rule: `Eliminate Below Pivot (${k + 1}, ${k + 1})`,
      description: `Store multipliers L[i, ${k + 1}] and reduce rows below diagonal.`,
      latex: `L = ${matrixToLatex(L, 3)}, \\quad U = ${matrixToLatex(U, 3)}`,
    });
  }

  return {
    operation: 'PA = LU Decomposition',
    lu: { P, L, U },
    resultLatex: `L = ${matrixToLatex(L)}, \\quad U = ${matrixToLatex(U)}`,
    steps,
  };
}

export function solveLinearSystemMatrix(A: Matrix, b: number[]): LinearAlgebraResult {
  const m = A.length;
  const n = A[0].length;
  if (b.length !== m) {
    throw new Error(`Vector b length (${b.length}) must match rows of A (${m}).`);
  }
  const aug = A.map((row, i) => [...row, b[i]]);
  const { rref: rrefA, rank: rankA } = gaussianEliminationRREF(A);
  const { rref, rank: rankAug, steps } = gaussianEliminationRREF(aug);
  void rrefA;

  if (rankAug > rankA) {
    return {
      operation: 'Linear System Ax = b',
      resultMatrix: rref,
      systemSolution: { status: 'inconsistent' },
      resultLatex: '\\text{Inconsistent System (No Solution: } \\operatorname{rank}(A) < \\operatorname{rank}([A|b])\\text{)}',
      steps: [
        ...steps,
        {
          id: 'sys-inc',
          rule: 'Rouché–Capelli Rank Test',
          description: `rank(A) = ${rankA} < rank([A|b]) = ${rankAug}.`,
          latex: '\\text{No solution exists.}',
        },
      ],
    };
  }

  if (rankA < n) {
    return {
      operation: 'Linear System Ax = b',
      resultMatrix: rref,
      systemSolution: { status: 'infinite' },
      resultLatex: `\\text{Infinitely Many Solutions (}${n - rankA}\\text{ free parameter${
        n - rankA === 1 ? '' : 's'
      })}`,
      steps: [
        ...steps,
        {
          id: 'sys-inf',
          rule: 'Rank-Nullity Analysis',
          description: `rank(A) = rank([A|b]) = ${rankA} < ${n} unknowns.`,
          latex: `\\operatorname{nullity}(A) = ${n - rankA}`,
        },
      ],
    };
  }

  const x = rref.slice(0, n).map((row) => row[n]);
  return {
    operation: 'Linear System Ax = b',
    resultMatrix: rref,
    systemSolution: { status: 'unique', x },
    resultLatex: x.map((v, i) => `x_${i + 1} = ${Number(v.toFixed(5))}`).join(', \\quad '),
    steps: [
      ...steps,
      {
        id: 'sys-uni',
        rule: 'Unique Solution Vector',
        description: `Full column rank (${rankA} = ${n}).`,
        latex: `\\mathbf{x} = ${matrixToLatex(x.map((v) => [v]))}`,
      },
    ],
  };
}

function qrStep(M: Matrix): { Q: Matrix; R: Matrix } {
  const n = M.length;
  const Q: Matrix = Array.from({ length: n }, () => Array(n).fill(0));
  const R: Matrix = Array.from({ length: n }, () => Array(n).fill(0));
  const cols = Array.from({ length: n }, (_, j) => M.map((row) => row[j]));

  for (let j = 0; j < n; j++) {
    const v = [...cols[j]];
    for (let i = 0; i < j; i++) {
      const qCol = Q.map((row) => row[i]);
      const dot = qCol.reduce((s, val, k) => s + val * v[k], 0);
      R[i][j] = dot;
      for (let k = 0; k < n; k++) v[k] -= dot * qCol[k];
    }
    const norm = Math.hypot(...v);
    R[j][j] = norm;
    if (norm > 1e-12) {
      for (let k = 0; k < n; k++) Q[k][j] = v[k] / norm;
    }
  }
  return { Q, R };
}

function findNullVector(M: Matrix): number[] {
  const n = M.length;
  const { rref } = gaussianEliminationRREF(M);
  // Find first non-pivot column
  const pivotCols = new Set<number>();
  for (let r = 0; r < n; r++) {
    const c = rref[r].findIndex((v) => Math.abs(v) > 1e-5);
    if (c !== -1) pivotCols.add(c);
  }
  let freeCol = -1;
  for (let c = 0; c < n; c++) {
    if (!pivotCols.has(c)) {
      freeCol = c;
      break;
    }
  }
  if (freeCol === -1) freeCol = n - 1;

  const vec = Array(n).fill(0);
  vec[freeCol] = 1;
  for (let r = 0; r < n; r++) {
    const pCol = rref[r].findIndex((v) => Math.abs(v) > 1e-5);
    if (pCol !== -1 && pCol !== freeCol) {
      vec[pCol] = -rref[r][freeCol];
    }
  }
  const norm = Math.hypot(...vec) || 1;
  return vec.map((v) => v / norm);
}

export function computeEigen(A: Matrix): LinearAlgebraResult {
  const n = A.length;
  if (n !== A[0].length) {
    throw new Error('Eigenvalues are only defined for square (n×n) matrices.');
  }

  if (n === 2) {
    const tr = A[0][0] + A[1][1];
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    const disc = tr * tr - 4 * det;
    const eigenvalues: { real: number; imag: number }[] = [];
    const eigenvectors: number[][] = [];

    if (disc >= -1e-9) {
      const s = Math.sqrt(Math.max(0, disc));
      const l1 = (tr + s) / 2;
      const l2 = (tr - s) / 2;
      eigenvalues.push({ real: l1, imag: 0 }, { real: l2, imag: 0 });
      for (const lam of [l1, l2]) {
        const shifted = [
          [A[0][0] - lam, A[0][1]],
          [A[1][0], A[1][1] - lam],
        ];
        eigenvectors.push(findNullVector(shifted));
      }
    } else {
      const re = tr / 2;
      const im = Math.sqrt(-disc) / 2;
      eigenvalues.push({ real: re, imag: im }, { real: re, imag: -im });
    }

    return {
      operation: 'Eigenvalues & Eigenvectors (2×2)',
      eigenvalues,
      eigenvectors,
      resultLatex: eigenvalues
        .map((ev, i) =>
          Math.abs(ev.imag) < 1e-7
            ? `\\lambda_${i + 1} = ${Number(ev.real.toFixed(4))}`
            : `\\lambda_${i + 1} = ${Number(ev.real.toFixed(4))} ${
                ev.imag >= 0 ? '+' : '-'
              } ${Number(Math.abs(ev.imag).toFixed(4))}i`
        )
        .join(', \\quad '),
      steps: [
        {
          id: 'eig-2-1',
          rule: 'Characteristic Polynomial det(A − λI) = 0',
          description: `Trace = ${Number(tr.toFixed(4))}, Determinant = ${Number(det.toFixed(4))}.`,
          latex: `\\lambda^2 - (${Number(tr.toFixed(4))})\\lambda + (${Number(det.toFixed(4))}) = 0`,
        },
        ...(eigenvectors.length > 0
          ? [
              {
                id: 'eig-2-2',
                rule: 'Unit Eigenvectors from Nullspace (A − λI)v = 0',
                description: 'Solved homogeneous system for each real eigenvalue.',
                latex: eigenvectors
                  .map(
                    (v, i) =>
                      `\\mathbf{v}_${i + 1} = \\langle ${v
                        .map((c) => Number(c.toFixed(4)))
                        .join(',\\; ')} \\rangle`
                  )
                  .join(', \\quad '),
              },
            ]
          : []),
      ],
    };
  }

  // General n x n via shifted QR iteration
  let T = A.map((r) => [...r]);
  for (let iter = 0; iter < 80; iter++) {
    const { Q, R } = qrStep(T);
    // T = R * Q
    const next: Matrix = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += R[i][k] * Q[k][j];
        next[i][j] = s;
      }
    }
    T = next;
  }

  const eigenvalues: { real: number; imag: number }[] = [];
  const eigenvectors: number[][] = [];
  let i = 0;
  while (i < n) {
    if (i < n - 1 && Math.abs(T[i + 1][i]) > 1e-4) {
      // 2x2 Schur block -> complex conjugate pair
      const a = T[i][i];
      const b = T[i][i + 1];
      const c = T[i + 1][i];
      const d = T[i + 1][i + 1];
      const tr = a + d;
      const det = a * d - b * c;
      const disc = tr * tr - 4 * det;
      if (disc < 0) {
        const re = tr / 2;
        const im = Math.sqrt(-disc) / 2;
        eigenvalues.push({ real: re, imag: im }, { real: re, imag: -im });
      } else {
        eigenvalues.push(
          { real: (tr + Math.sqrt(disc)) / 2, imag: 0 },
          { real: (tr - Math.sqrt(disc)) / 2, imag: 0 }
        );
      }
      i += 2;
    } else {
      const lam = T[i][i];
      eigenvalues.push({ real: lam, imag: 0 });
      const shifted = A.map((row, r) =>
        row.map((val, c) => (r === c ? val - lam : val))
      );
      eigenvectors.push(findNullVector(shifted));
      i += 1;
    }
  }

  return {
    operation: `Eigenvalues & Eigenvectors (${n}×${n})`,
    eigenvalues,
    eigenvectors,
    resultLatex: eigenvalues
      .map((ev, idx) =>
        Math.abs(ev.imag) < 1e-6
          ? `\\lambda_${idx + 1} \\approx ${Number(ev.real.toFixed(4))}`
          : `\\lambda_${idx + 1} \\approx ${Number(ev.real.toFixed(4))} ${
              ev.imag >= 0 ? '+' : '-'
            } ${Number(Math.abs(ev.imag).toFixed(4))}i`
      )
      .join(', \\quad '),
    steps: [
      {
        id: 'eig-qr-1',
        rule: 'QR Eigenvalue Algorithm',
        description: `Iterated Aₖ = QₖRₖ, Aₖ₊₁ = RₖQₖ across ${n}×${n} Schur blocks.`,
        latex: `\\text{Spectrum: } \\{${eigenvalues
          .map((ev) =>
            Math.abs(ev.imag) < 1e-6
              ? Number(ev.real.toFixed(4))
              : `${Number(ev.real.toFixed(3))}${ev.imag >= 0 ? '+' : '-'}${Number(
                  Math.abs(ev.imag).toFixed(3)
                )}i`
          )
          .join(',\\; ')}\\}`,
      },
    ],
  };
}
