import type { AngleUnit, DerivationStep } from '../types';
import { solvePartialDerivative } from './calculus';
import { integrate1DComposite } from './integrals';
import { solveMathProblem } from './solver';
import {
  differentiate,
  evaluateAST,
  parseExpression,
  simplify,
  toLatex,
  toPlain,
} from './symbolic';

export type DerivationMode =
  | 'differentiation'
  | 'integration'
  | 'identity-verify'
  | 'taylor-expansion';

export interface DerivationComparison {
  methodA: { title: string; resultLatex: string; numericValue?: number; summary: string };
  methodB: { title: string; resultLatex: string; numericValue?: number; summary: string };
  delta?: number;
}

export interface FormulaDerivationResult {
  mode: DerivationMode;
  headline: string;
  primaryLatex: string;
  verified?: boolean;
  steps: DerivationStep[];
  comparison?: DerivationComparison;
}

export function deriveAndCompare(opts: {
  mode: DerivationMode;
  expr: string;
  rhsExpr?: string;
  variable?: string;
  pointX?: number;
  lower?: number;
  upper?: number;
  taylorOrder?: number;
  angleUnit?: AngleUnit;
}): FormulaDerivationResult {
  const angleUnit = opts.angleUnit ?? 'rad';
  const variable = opts.variable?.trim() || 'x';
  const x0 = Number.isFinite(opts.pointX) ? (opts.pointX as number) : 1;

  if (opts.mode === 'differentiation') {
    const partialRes = solvePartialDerivative(opts.expr, variable, 1, { [variable]: x0, y: 1, z: 1 }, angleUnit);
    const ast = parseExpression(opts.expr);
    const h = 1e-5;
    const fPlus = evaluateAST(ast, { [variable]: x0 + h, y: 1, z: 1 }, angleUnit);
    const fMinus = evaluateAST(ast, { [variable]: x0 - h, y: 1, z: 1 }, angleUnit);
    const centralDiff = (fPlus - fMinus) / (2 * h);
    const symVal = partialRes.evaluatedValue ?? 0;

    return {
      mode: 'differentiation',
      headline: `Symbolic Differentiation wrt ${variable}`,
      primaryLatex: partialRes.resultLatex,
      steps: partialRes.steps,
      comparison: {
        methodA: {
          title: 'Method 1: Symbolic Differentiation Rules',
          resultLatex: partialRes.resultLatex,
          numericValue: symVal,
          summary: `Exact AST rule application evaluated at ${variable} = ${x0}.`,
        },
        methodB: {
          title: 'Method 2: Symmetric Difference Quotient (Limit Approx)',
          resultLatex: `\\frac{f(${x0}+h) - f(${x0}-h)}{2h} \\approx ${centralDiff.toFixed(6)}`,
          numericValue: centralDiff,
          summary: `Numerical limit verification using step h = 10⁻⁵.`,
        },
        delta: Math.abs(symVal - centralDiff),
      },
    };
  }

  if (opts.mode === 'integration') {
    const a = Number.isFinite(opts.lower) ? (opts.lower as number) : 0;
    const b = Number.isFinite(opts.upper) ? (opts.upper as number) : 2;
    const ast = parseExpression(opts.expr);
    const solverRes = solveMathProblem({
      input: opts.expr,
      mode: 'integral',
      variable,
      point: { x: x0, y: 1, z: 1 },
      bounds: { lower: a, upper: b },
      angleUnit,
    });
    const glVal = integrate1DComposite(
      (t) => evaluateAST(ast, { [variable]: t, y: 1, z: 1 }, angleUnit),
      a,
      b,
      6
    );
    // Composite Simpson 1/3 with 20 subintervals for method comparison
    const N = 20;
    const h = (b - a) / N;
    let simp =
      evaluateAST(ast, { [variable]: a, y: 1, z: 1 }, angleUnit) +
      evaluateAST(ast, { [variable]: b, y: 1, z: 1 }, angleUnit);
    for (let k = 1; k < N; k++) {
      const xk = a + k * h;
      simp += (k % 2 === 1 ? 4 : 2) * evaluateAST(ast, { [variable]: xk, y: 1, z: 1 }, angleUnit);
    }
    const simpVal = (h / 3) * simp;

    return {
      mode: 'integration',
      headline: `Definite & Antiderivative Derivation on [${a}, ${b}]`,
      primaryLatex: solverRes.resultLatex,
      steps: solverRes.steps,
      comparison: {
        methodA: {
          title: 'Method 1: Symbolic Antiderivative / Gauss-Legendre',
          resultLatex: solverRes.resultLatex,
          numericValue: glVal,
          summary: 'Exact symbolic antiderivative when polynomial, paired with 8-point Gauss-Legendre.',
        },
        methodB: {
          title: "Method 2: Composite Simpson's 1/3 Rule (n = 20)",
          resultLatex: `S_{20} = ${simpVal.toFixed(6)}`,
          numericValue: simpVal,
          summary: 'Parabolic quadrature comparison across 20 equal subintervals.',
        },
        delta: Math.abs(glVal - simpVal),
      },
    };
  }

  if (opts.mode === 'taylor-expansion') {
    const order = Math.max(1, Math.min(7, Math.round(opts.taylorOrder ?? 4)));
    const ast = parseExpression(opts.expr);
    const steps: DerivationStep[] = [];
    let currentAst = simplify(ast);
    const terms: string[] = [];
    let fact = 1;

    for (let k = 0; k <= order; k++) {
      if (k > 0) {
        fact *= k;
        currentAst = simplify(differentiate(currentAst, variable));
      }
      const val = evaluateAST(currentAst, { [variable]: x0, y: 0, z: 0 }, angleUnit);
      const coeff = val / fact;
      steps.push({
        id: `tay-${k}`,
        rule: k === 0 ? 'Zeroth-Order Value f(a)' : `Order ${k} Derivative f^(${k})(a) / ${k}!`,
        description: `f^(${k})(${variable}) = ${toPlain(currentAst)} ⇒ c_${k} = ${Number(coeff.toFixed(5))}`,
        latex: `f^{(${k})}(${x0}) = ${Number(val.toFixed(4))},\\quad c_${k} = \\frac{${Number(val.toFixed(4))}}{${fact}} = ${Number(coeff.toFixed(5))}`,
      });
      if (Math.abs(coeff) > 1e-8) {
        const cStr = Number(coeff.toFixed(4));
        const shift = x0 === 0 ? variable : `(${variable} ${x0 > 0 ? '-' : '+'} ${Math.abs(x0)})`;
        const term =
          k === 0
            ? `${cStr}`
            : k === 1
            ? `${cStr >= 0 && terms.length ? '+' : ''}${cStr}${shift}`
            : `${cStr >= 0 && terms.length ? '+' : ''}${cStr}${shift}^{${k}}`;
        terms.push(term);
      }
    }

    const polyLatex = `P_{${order}}(${variable}) = ${terms.join(' ') || '0'}`;
    const testPt = x0 + 0.25;
    const exactAtTest = evaluateAST(ast, { [variable]: testPt, y: 0, z: 0 }, angleUnit);
    // Evaluate Taylor sum directly
    let curD = simplify(ast);
    let fAcc = 1;
    let taylorVal = 0;
    for (let k = 0; k <= order; k++) {
      if (k > 0) {
        fAcc *= k;
        curD = simplify(differentiate(curD, variable));
      }
      const v = evaluateAST(curD, { [variable]: x0, y: 0, z: 0 }, angleUnit);
      taylorVal += (v / fAcc) * (testPt - x0) ** k;
    }

    return {
      mode: 'taylor-expansion',
      headline: `Taylor Series Derivation Around ${variable} = ${x0}`,
      primaryLatex: polyLatex,
      steps,
      comparison: {
        methodA: {
          title: `Exact f(${testPt.toFixed(2)})`,
          resultLatex: `f(${testPt.toFixed(2)}) = ${exactAtTest.toFixed(6)}`,
          numericValue: exactAtTest,
          summary: 'Original expression evaluated near expansion center.',
        },
        methodB: {
          title: `Degree-${order} Taylor P_${order}(${testPt.toFixed(2)})`,
          resultLatex: `P_{${order}}(${testPt.toFixed(2)}) = ${taylorVal.toFixed(6)}`,
          numericValue: taylorVal,
          summary: `Polynomial truncation error at Δ${variable} = 0.25.`,
        },
        delta: Math.abs(exactAtTest - taylorVal),
      },
    };
  }

  // Identity Verification: compare LHS and RHS symbolically (via simplified difference + derivative check) and numerically
  const lhsRaw = opts.expr.trim();
  const rhsRaw = (opts.rhsExpr ?? '').trim();
  if (!lhsRaw || !rhsRaw) {
    throw new Error('Provide both Left-Hand Side (LHS) and Right-Hand Side (RHS) expressions.');
  }
  const lhsAst = simplify(parseExpression(lhsRaw));
  const rhsAst = simplify(parseExpression(rhsRaw));
  const diffAst = simplify({ type: 'binary', op: '-', left: lhsAst, right: rhsAst });
  const dDiffAst = simplify(differentiate(diffAst, variable));

  const sampleXs = [-2.1, -1.35, -0.7, -0.25, 0.25, 0.7, 1.35, 2.1];
  let maxErr = 0;
  let validSamples = 0;
  let counterexample: string | null = null;
  for (const sx of sampleXs) {
    try {
      const lv = evaluateAST(lhsAst, { [variable]: sx, y: 1.2, z: 0.8 }, angleUnit);
      const rv = evaluateAST(rhsAst, { [variable]: sx, y: 1.2, z: 0.8 }, angleUnit);
      if (Number.isFinite(lv) && Number.isFinite(rv)) {
        validSamples++;
        const err = Math.abs(lv - rv);
        if (err > maxErr) maxErr = err;
        if (err > 1e-5 && !counterexample) {
          counterexample = `${variable} = ${sx}: LHS = ${lv.toFixed(5)} ≠ RHS = ${rv.toFixed(5)}`;
        }
      }
    } catch {
      // skip points outside domain (e.g. ln(x) for x <= 0)
    }
  }

  if (validSamples === 0) {
    throw new Error('Could not find valid domain points to evaluate both expressions.');
  }

  const symEqual = toPlain(diffAst) === '0';
  const verified = symEqual || (maxErr < 1e-6 && validSamples >= 3);

  return {
    mode: 'identity-verify',
    headline: verified ? 'Identity Verified Across Domain' : 'Expressions Are Not Identical',
    primaryLatex: `${toLatex(lhsAst)} ${verified ? '=' : '\\neq'} ${toLatex(rhsAst)}`,
    verified,
    steps: [
      {
        id: 'id-1',
        rule: 'Symbolic Difference Normalization',
        description: symEqual
          ? 'LHS − RHS simplifies identically to 0.'
          : `Simplified difference: ${toPlain(diffAst)}`,
        latex: `\\Delta(${variable}) = \\left(${toLatex(lhsAst)}\\right) - \\left(${toLatex(rhsAst)}\\right) = ${toLatex(diffAst)}`,
      },
      {
        id: 'id-2',
        rule: 'Derivative Invariance Check',
        description: `Differentiated LHS − RHS wrt ${variable} to inspect constant-offset agreement.`,
        latex: `\\frac{d\\Delta}{d${variable}} = ${toLatex(dDiffAst)}`,
      },
      {
        id: 'id-3',
        rule: 'Multi-Point Domain Residual Check',
        description: verified
          ? `Max absolute difference across ${validSamples} domain test points is ${maxErr.toExponential(2)}.`
          : counterexample ?? `Counterexample detected (max difference = ${maxErr.toFixed(5)}).`,
        latex: `\\max |\\text{LHS} - \\text{RHS}| = ${maxErr.toExponential(3)}`,
      },
    ],
  };
}
