import type { AngleUnit, DerivationStep } from '../types';
import { integrate1DComposite } from './integrals';
import { solveLinearSystemMatrix, type Matrix } from './linearAlgebra';
import { differentiate, evaluateAST, parseExpression, simplify, toLatex } from './symbolic';

export interface RootIterationRow {
  iter: number;
  a?: number;
  b?: number;
  x: number;
  fx: number;
  error: number;
}

export interface RootMethodResult {
  method: 'bisection' | 'newton' | 'regula-falsi' | 'secant';
  root: number;
  iterations: RootIterationRow[];
  converged: boolean;
  steps: DerivationStep[];
}

export interface GaussSeidelRow {
  iter: number;
  x: number[];
  maxError: number;
}

export interface GaussSeidelResult {
  solution: number[];
  diagonallyDominant: boolean;
  converged: boolean;
  rows: GaussSeidelRow[];
  steps: DerivationStep[];
}

export interface NumericalIntegrationResult {
  rule: 'trapezoidal' | 'simpson-1-3' | 'simpson-3-8';
  approxValue: number;
  referenceValue: number;
  absoluteError: number;
  relativeErrorPct: number;
  stepSizeH: number;
  samples: { x: number; y: number }[];
  steps: DerivationStep[];
}

export function solveRootMethod(params: {
  method: 'bisection' | 'newton' | 'regula-falsi' | 'secant';
  expr: string;
  a: number;
  b: number;
  x0: number;
  x1: number;
  tol?: number;
  maxIter?: number;
  angleUnit?: AngleUnit;
}): RootMethodResult {
  const { method, expr, a: initA, b: initB, x0: initX0, x1: initX1, tol = 1e-6, maxIter = 30, angleUnit = 'rad' } = params;
  const ast = parseExpression(expr);
  const f = (x: number) => evaluateAST(ast, { x }, angleUnit);
  const rows: RootIterationRow[] = [];

  if (method === 'bisection' || method === 'regula-falsi') {
    let a = initA;
    let b = initB;
    let fa = f(a);
    let fb = f(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) {
      throw new Error(
        `Bracketing failure: f(${a}) = ${Number(fa.toFixed(4))} and f(${b}) = ${Number(
          fb.toFixed(4)
        )} must have opposite signs.`
      );
    }

    let prevX = a;
    let x = a;
    let converged = false;

    for (let iter = 1; iter <= maxIter; iter++) {
      x =
        method === 'bisection'
          ? (a + b) / 2
          : (a * fb - b * fa) / (fb - fa);
      const fx = f(x);
      const error = iter === 1 ? Math.abs(b - a) / 2 : Math.abs(x - prevX);
      rows.push({ iter, a, b, x, fx, error });
      if (Math.abs(fx) < tol || error < tol) {
        converged = true;
        break;
      }
      if (fa * fx < 0) {
        b = x;
        fb = fx;
      } else {
        a = x;
        fa = fx;
      }
      prevX = x;
    }

    return {
      method,
      root: x,
      iterations: rows,
      converged,
      steps: [
        {
          id: 'nm-root-1',
          rule: method === 'bisection' ? 'Bisection Bracket Refinement' : 'Regula Falsi Chord Update',
          description: `Initial opposite-sign bracket [${initA}, ${initB}] for f(x) = ${expr}.`,
          latex:
            method === 'bisection'
              ? `x_{n+1} = \\frac{a_n + b_n}{2}`
              : `x_{n+1} = \\frac{a_n f(b_n) - b_n f(a_n)}{f(b_n) - f(a_n)}`,
        },
        {
          id: 'nm-root-2',
          rule: 'Convergence Result',
          description: `Reached x ≈ ${Number(x.toFixed(7))} in ${rows.length} iterations.`,
          latex: `x^* \\approx ${Number(x.toFixed(7))}, \\quad |f(x^*)| \\approx ${Math.abs(
            rows[rows.length - 1]?.fx ?? 0
          ).toExponential(2)}`,
        },
      ],
    };
  }

  if (method === 'newton') {
    const dfAst = simplify(differentiate(ast, 'x'));
    const df = (x: number) => evaluateAST(dfAst, { x }, angleUnit);
    let x = initX0;
    let converged = false;

    for (let iter = 1; iter <= maxIter; iter++) {
      const fx = f(x);
      const dfx = df(x);
      if (!Number.isFinite(dfx) || Math.abs(dfx) < 1e-12) {
        throw new Error(`Zero derivative encountered at x = ${Number(x.toFixed(5))}; choose another initial guess.`);
      }
      const nextX = x - fx / dfx;
      const error = Math.abs(nextX - x);
      rows.push({ iter, x: nextX, fx: f(nextX), error });
      x = nextX;
      if (Math.abs(rows[rows.length - 1].fx) < tol || error < tol) {
        converged = true;
        break;
      }
    }

    return {
      method: 'newton',
      root: x,
      iterations: rows,
      converged,
      steps: [
        {
          id: 'nm-nr-1',
          rule: 'Symbolic Derivative f′(x)',
          description: 'Differentiate f(x) analytically for quadratic Newton-Raphson updates.',
          latex: `f'(x) = ${toLatex(dfAst)}, \\qquad x_{n+1} = x_n - \\frac{f(x_n)}{f'(x_n)}`,
        },
        {
          id: 'nm-nr-2',
          rule: 'Convergence Summary',
          description: `Converged to x ≈ ${Number(x.toFixed(7))} in ${rows.length} iterations.`,
          latex: `x^* \\approx ${Number(x.toFixed(7))}`,
        },
      ],
    };
  }

  // Secant method
  let xPrev = initX0;
  let xCurr = initX1;
  let converged = false;

  for (let iter = 1; iter <= maxIter; iter++) {
    const f0 = f(xPrev);
    const f1 = f(xCurr);
    if (Math.abs(f1 - f0) < 1e-13) {
      throw new Error('Secant denominator f(xₙ) − f(xₙ₋₁) ≈ 0; choose distinct starting guesses.');
    }
    const nextX = xCurr - (f1 * (xCurr - xPrev)) / (f1 - f0);
    const error = Math.abs(nextX - xCurr);
    rows.push({ iter, a: xPrev, b: xCurr, x: nextX, fx: f(nextX), error });
    xPrev = xCurr;
    xCurr = nextX;
    if (Math.abs(rows[rows.length - 1].fx) < tol || error < tol) {
      converged = true;
      break;
    }
  }

  return {
    method: 'secant',
    root: xCurr,
    iterations: rows,
    converged,
    steps: [
      {
        id: 'nm-sec-1',
        rule: 'Secant Finite-Difference Update',
        description: `Started from x₀ = ${initX0}, x₁ = ${initX1}.`,
        latex: `x_{n+1} = x_n - f(x_n)\\frac{x_n - x_{n-1}}{f(x_n) - f(x_{n-1})}`,
      },
      {
        id: 'nm-sec-2',
        rule: 'Convergence Summary',
        description: `Reached x ≈ ${Number(xCurr.toFixed(7))} in ${rows.length} iterations.`,
        latex: `x^* \\approx ${Number(xCurr.toFixed(7))}`,
      },
    ],
  };
}

export function solveGaussSeidel(
  A: Matrix,
  b: number[],
  tol = 1e-6,
  maxIter = 35
): GaussSeidelResult {
  const n = A.length;
  if (n !== A[0].length || b.length !== n) {
    throw new Error('Gauss-Seidel requires a square n×n matrix A and matching vector b.');
  }
  for (let i = 0; i < n; i++) {
    if (Math.abs(A[i][i]) < 1e-12) {
      throw new Error(`Zero diagonal entry A[${i + 1},${i + 1}] = 0; reorder equations first.`);
    }
  }

  const diagonallyDominant = A.every((row, i) => {
    const offDiag = row.reduce((sum, v, j) => (j === i ? sum : sum + Math.abs(v)), 0);
    return Math.abs(row[i]) >= offDiag;
  });

  const x = Array(n).fill(0);
  const rows: GaussSeidelRow[] = [];
  let converged = false;

  for (let iter = 1; iter <= maxIter; iter++) {
    let maxError = 0;
    for (let i = 0; i < n; i++) {
      let sum = b[i];
      for (let j = 0; j < n; j++) {
        if (j !== i) sum -= A[i][j] * x[j];
      }
      const nextVal = sum / A[i][i];
      maxError = Math.max(maxError, Math.abs(nextVal - x[i]));
      x[i] = nextVal;
    }
    rows.push({ iter, x: [...x], maxError });
    if (!Number.isFinite(maxError) || maxError > 1e8) break;
    if (maxError < tol) {
      converged = true;
      break;
    }
  }

  return {
    solution: x,
    diagonallyDominant,
    converged,
    rows,
    steps: [
      {
        id: 'gs-1',
        rule: 'Diagonal Dominance Check',
        description: diagonallyDominant
          ? 'Coefficient matrix is diagonally dominant — convergence guaranteed.'
          : 'Matrix is NOT strictly diagonally dominant — verify convergence in iteration table.',
        latex: `x_i^{(k+1)} = \\frac{1}{a_{ii}}\\left(b_i - \\sum_{j<i}a_{ij}x_j^{(k+1)} - \\sum_{j>i}a_{ij}x_j^{(k)}\\right)`,
      },
      {
        id: 'gs-2',
        rule: 'Final Iterate',
        description: `Stopped after ${rows.length} iterations (max step error ${rows[
          rows.length - 1
        ]?.maxError.toExponential(2)}).`,
        latex: x.map((v, i) => `x_${i + 1} \\approx ${Number(v.toFixed(5))}`).join(', \\quad '),
      },
    ],
  };
}

export function solveGaussEliminationNumerical(A: Matrix, b: number[]) {
  return solveLinearSystemMatrix(A, b);
}

export function solveNumericalIntegration(params: {
  rule: 'trapezoidal' | 'simpson-1-3' | 'simpson-3-8';
  expr: string;
  a: number;
  b: number;
  n: number;
  angleUnit?: AngleUnit;
}): NumericalIntegrationResult {
  const { rule, expr, a, b, angleUnit = 'rad' } = params;
  let n = Math.max(1, Math.round(params.n));
  if (a >= b) {
    throw new Error('Lower limit "a" must be strictly less than upper limit "b".');
  }
  if (rule === 'simpson-1-3' && n % 2 !== 0) {
    n += 1; // Ensure even subintervals for Simpson's 1/3
  }
  if (rule === 'simpson-3-8' && n % 3 !== 0) {
    n += 3 - (n % 3); // Ensure multiple of 3 for Simpson's 3/8
  }

  const ast = parseExpression(expr);
  const f = (x: number) => evaluateAST(ast, { x }, angleUnit);
  const h = (b - a) / n;
  const samples = Array.from({ length: n + 1 }, (_, i) => {
    const x = a + i * h;
    return { x, y: f(x) };
  });

  let approxValue = 0;
  let formulaLatex = '';
  if (rule === 'trapezoidal') {
    let sum = samples[0].y + samples[n].y;
    for (let i = 1; i < n; i++) sum += 2 * samples[i].y;
    approxValue = (h / 2) * sum;
    formulaLatex = `\\int_{${a}}^{${b}} f(x)\\,dx \\approx \\frac{h}{2}\\left[y_0 + 2\\sum_{i=1}^{n-1} y_i + y_n\\right]`;
  } else if (rule === 'simpson-1-3') {
    let sum = samples[0].y + samples[n].y;
    for (let i = 1; i < n; i++) {
      sum += (i % 2 === 1 ? 4 : 2) * samples[i].y;
    }
    approxValue = (h / 3) * sum;
    formulaLatex = `\\int_{${a}}^{${b}} f(x)\\,dx \\approx \\frac{h}{3}\\left[y_0 + 4\\sum_{\\text{odd}}y_i + 2\\sum_{\\text{even}}y_i + y_n\\right]`;
  } else {
    let sum = samples[0].y + samples[n].y;
    for (let i = 1; i < n; i++) {
      sum += (i % 3 === 0 ? 2 : 3) * samples[i].y;
    }
    approxValue = ((3 * h) / 8) * sum;
    formulaLatex = `\\int_{${a}}^{${b}} f(x)\\,dx \\approx \\frac{3h}{8}\\left[y_0 + 3y_1 + 3y_2 + 2y_3 + \\dots + y_n\\right]`;
  }

  const referenceValue = integrate1DComposite(f, a, b, 12);
  const absoluteError = Math.abs(approxValue - referenceValue);
  const relativeErrorPct =
    Math.abs(referenceValue) > 1e-12 ? (absoluteError / Math.abs(referenceValue)) * 100 : 0;

  return {
    rule,
    approxValue,
    referenceValue,
    absoluteError,
    relativeErrorPct,
    stepSizeH: h,
    samples,
    steps: [
      {
        id: 'ni-1',
        rule: `Partition [a, b] into n = ${n} subintervals`,
        description: `Step size h = (${b} − ${a}) / ${n} = ${Number(h.toFixed(6))}.`,
        latex: formulaLatex,
      },
      {
        id: 'ni-2',
        rule: 'Quadrature & Error Comparison',
        description: `Compared against high-precision Gauss-Legendre benchmark (${Number(
          referenceValue.toFixed(7)
        )}).`,
        latex: `I_{\\text{approx}} = ${Number(approxValue.toFixed(7))}, \\quad |E| = ${absoluteError.toExponential(
          3
        )}`,
      },
    ],
  };
}
