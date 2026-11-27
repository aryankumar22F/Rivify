import type { AngleUnit, DerivationStep } from '../types';
import { solveMultivariableLimit } from './advancedMath';
import { integrate1DComposite } from './integrals';
import { analyzeMathInput, normalizeExpressionOnly, preprocessMathSyntax } from './mathInput';
import {
  dependsOn,
  differentiate,
  evaluateAST,
  extractVariables,
  parseExpression,
  simplify,
  toLatex,
  toPlain,
  type ExprNode,
} from './symbolic';

export type SolverMode =
  | 'auto'
  | 'simplify'
  | 'evaluate'
  | 'derivative'
  | 'integral'
  | 'limit'
  | 'equation'
  | 'linear-system';

export interface SolverOutput {
  detectedMode: Exclude<SolverMode, 'auto'>;
  headline: string;
  resultLatex: string;
  resultPlain: string;
  roots?: number[];
  systemSolution?: { vars: string[]; values: number[] };
  steps: DerivationStep[];
}

function tryPolynomialAntiderivative(node: ExprNode, variable: string): ExprNode | null {
  // Recursively integrate polynomials in `variable`
  const terms: { sign: 1 | -1; node: ExprNode }[] = [];
  const collect = (n: ExprNode, sign: 1 | -1) => {
    if (n.type === 'binary' && n.op === '+') {
      collect(n.left, sign);
      collect(n.right, sign);
    } else if (n.type === 'binary' && n.op === '-') {
      collect(n.left, sign);
      collect(n.right, (sign * -1) as 1 | -1);
    } else if (n.type === 'unary' && n.op === '-') {
      collect(n.arg, (sign * -1) as 1 | -1);
    } else {
      terms.push({ sign, node: n });
    }
  };
  collect(simplify(node), 1);

  const integratedTerms: { sign: 1 | -1; node: ExprNode }[] = [];

  for (const t of terms) {
    // Factor term into constant-in-variable factor and power of variable
    const factors: ExprNode[] = [];
    const splitMul = (n: ExprNode) => {
      if (n.type === 'binary' && n.op === '*') {
        splitMul(n.left);
        splitMul(n.right);
      } else {
        factors.push(n);
      }
    };
    splitMul(t.node);

    let power = 0;
    const constFactors: ExprNode[] = [];
    let supported = true;

    for (const f of factors) {
      if (f.type === 'variable' && f.name === variable) {
        power += 1;
      } else if (
        f.type === 'binary' &&
        f.op === '^' &&
        f.left.type === 'variable' &&
        f.left.name === variable &&
        f.right.type === 'number' &&
        f.right.value !== -1
      ) {
        power += f.right.value;
      } else if (!dependsOn(f, variable)) {
        constFactors.push(f);
      } else {
        supported = false;
        break;
      }
    }

    if (!supported) return null;

    const newPow = power + 1;
    let coeffNode: ExprNode =
      constFactors.length === 0
        ? { type: 'number', value: 1 }
        : constFactors.reduce((a, b) => ({ type: 'binary', op: '*', left: a, right: b }));

    coeffNode = simplify({
      type: 'binary',
      op: '/',
      left: coeffNode,
      right: { type: 'number', value: newPow },
    });

    const varPow: ExprNode =
      newPow === 1
        ? { type: 'variable', name: variable }
        : {
            type: 'binary',
            op: '^',
            left: { type: 'variable', name: variable },
            right: { type: 'number', value: newPow },
          };

    integratedTerms.push({
      sign: t.sign,
      node: simplify({ type: 'binary', op: '*', left: coeffNode, right: varPow }),
    });
  }

  let acc: ExprNode =
    integratedTerms[0].sign === -1
      ? simplify({ type: 'unary', op: '-', arg: integratedTerms[0].node })
      : integratedTerms[0].node;
  for (let i = 1; i < integratedTerms.length; i++) {
    acc = simplify({
      type: 'binary',
      op: integratedTerms[i].sign === 1 ? '+' : '-',
      left: acc,
      right: integratedTerms[i].node,
    });
  }
  return acc;
}

function solveLinearEquations(
  rawInput: string,
  angleUnit: AngleUnit
): { vars: string[]; values: number[]; steps: DerivationStep[] } {
  const analyzed = analyzeMathInput(rawInput);
  const lines = analyzed.expr
    .split(/[;\n]+/)
    .map((s) => preprocessMathSyntax(s.trim()))
    .filter(Boolean);

  if (lines.length < 2 || lines.length > 3) {
    throw new Error('Enter 2 or 3 linear equations separated by semicolons (;) or newlines.');
  }

  const parsedExprs: ExprNode[] = [];
  const varSet = new Set<string>();

  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length !== 2) {
      throw new Error(`Each equation must contain exactly one "=" sign (error near "${line}").`);
    }
    const lhs = parseExpression(parts[0]);
    const rhs = parseExpression(parts[1]);
    const diff = simplify({ type: 'binary', op: '-', left: lhs, right: rhs });
    parsedExprs.push(diff);
    for (const v of extractVariables(diff)) varSet.add(v);
  }

  const vars = Array.from(varSet).sort();
  if (vars.length !== lines.length) {
    throw new Error(
      `Expected ${lines.length} unknowns matching ${lines.length} equations, found: ${
        vars.join(', ') || 'none'
      }.`
    );
  }

  const n = vars.length;
  const zeroScope: Record<string, number> = {};
  for (const v of vars) zeroScope[v] = 0;

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < n; i++) {
    const f0 = evaluateAST(parsedExprs[i], zeroScope, angleUnit);
    b.push(-f0);
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      const unitScope = { ...zeroScope, [vars[j]]: 1 };
      const f1 = evaluateAST(parsedExprs[i], unitScope, angleUnit);
      const test2 = evaluateAST(parsedExprs[i], { ...zeroScope, [vars[j]]: 2 }, angleUnit);
      const coeff = f1 - f0;
      if (Math.abs(test2 - f0 - 2 * coeff) > 1e-6) {
        throw new Error(`Equation ${i + 1} is nonlinear in ${vars[j]}. Use Equation Solver for nonlinear equations.`);
      }
      row.push(coeff);
    }
    A.push(row);
  }

  // Gaussian elimination with partial pivoting
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
    }
    if (Math.abs(aug[pivot][col]) < 1e-10) {
      throw new Error('The linear system is singular (no unique solution — dependent or inconsistent equations).');
    }
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const div = aug[col][col];
    for (let j = col; j <= n; j++) aug[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let j = col; j <= n; j++) aug[r][j] -= factor * aug[col][j];
    }
  }

  const values = aug.map((row) => {
    const val = row[n];
    return Math.abs(val) < 1e-9 ? 0 : Number(val.toFixed(6));
  });

  const matrixLatex = `\\left[\\begin{array}{${'c'.repeat(n)}|c}${A.map(
    (r, idx) => `${r.map((c) => Number(c.toFixed(4))).join(' & ')} & ${Number(b[idx].toFixed(4))}`
  ).join(' \\\\ ')}\\end{array}\\right]`;

  return {
    vars,
    values,
    steps: [
      {
        id: 'sys-1',
        rule: 'Augmented Linear System Matrix',
        description: `Extracted coefficients for variables (${vars.join(', ')}).`,
        latex: matrixLatex,
      },
      {
        id: 'sys-2',
        rule: 'Gaussian Elimination (RREF)',
        description: 'Reduced augmented matrix using partial pivoting to solve uniquely.',
        latex: vars.map((v, i) => `${v} = ${values[i]}`).join(', \\quad '),
      },
    ],
  };
}

function solveOneVariableEquation(
  rawInput: string,
  variable: string,
  fixedScope: Record<string, number>,
  angleUnit: AngleUnit
): { roots: number[]; diffLatex: string; steps: DerivationStep[] } {
  const cleanedInput = preprocessMathSyntax(rawInput.replace(/^solve\s+/i, '').trim());
  const parts = cleanedInput.split('=');
  if (parts.length !== 2) {
    throw new Error('Equations must have one "=" sign, e.g. x^2 - 5*x + 6 = 0');
  }
  const lhs = parseExpression(parts[0]);
  const rhs = parseExpression(parts[1]);
  const diffAst = simplify({ type: 'binary', op: '-', left: lhs, right: rhs });
  const derivAst = simplify(differentiate(diffAst, variable));

  const evalF = (v: number) => evaluateAST(diffAst, { ...fixedScope, [variable]: v }, angleUnit);
  const evalDf = (v: number) => evaluateAST(derivAst, { ...fixedScope, [variable]: v }, angleUnit);

  const roots: number[] = [];
  const addRoot = (r: number) => {
    if (!Number.isFinite(r)) return;
    try {
      if (Math.abs(evalF(r)) > 1e-4) return;
    } catch {
      return;
    }
    const clean = Math.abs(r) < 1e-7 ? 0 : Number(r.toFixed(6));
    if (!roots.some((existing) => Math.abs(existing - clean) < 1e-4)) {
      roots.push(clean);
    }
  };

  // Dense scan across [-25, 25] to bracket sign changes + Newton polish for double roots
  const scanMin = -25;
  const scanMax = 25;
  const stepsN = 500;
  const h = (scanMax - scanMin) / stepsN;

  let prevX = scanMin;
  let prevY = NaN;
  try {
    prevY = evalF(prevX);
  } catch {
    prevY = NaN;
  }

  for (let i = 1; i <= stepsN; i++) {
    const x = scanMin + i * h;
    let y = NaN;
    try {
      y = evalF(x);
    } catch {
      prevX = x;
      prevY = NaN;
      continue;
    }

    if (Number.isFinite(y) && Math.abs(y) < 1e-8) {
      addRoot(x);
    }

    if (Number.isFinite(prevY) && Number.isFinite(y) && prevY * y < 0) {
      let a = prevX;
      let b = x;
      let fa = prevY;
      for (let it = 0; it < 40; it++) {
        const mid = 0.5 * (a + b);
        const fm = evalF(mid);
        if (Math.abs(fm) < 1e-10 || Math.abs(b - a) < 1e-10) {
          addRoot(mid);
          break;
        }
        if (fa * fm <= 0) {
          b = mid;
        } else {
          a = mid;
          fa = fm;
        }
      }
      addRoot(0.5 * (a + b));
    }
    prevX = x;
    prevY = y;
  }

  // Also seed Newton-Raphson at small integers to catch even-multiplicity roots like (x-2)^2 = 0
  for (let seed = -10; seed <= 10; seed += 0.5) {
    let x = seed;
    for (let it = 0; it < 20; it++) {
      try {
        const fx = evalF(x);
        if (Math.abs(fx) < 1e-9) {
          addRoot(x);
          break;
        }
        const dfx = evalDf(x);
        if (Math.abs(dfx) < 1e-10) break;
        x -= Math.max(-2, Math.min(2, fx / dfx));
      } catch {
        break;
      }
    }
  }

  roots.sort((a, b) => a - b);

  const diffLatex = toLatex(diffAst);
  return {
    roots,
    diffLatex,
    steps: [
      {
        id: 'eq-1',
        rule: 'Normalize Equation to f(v) = 0',
        description: `Rearrange LHS − RHS = 0 in variable ${variable}.`,
        latex: `${diffLatex} = 0`,
      },
      {
        id: 'eq-2',
        rule: 'Bracketed Bisection & Newton-Raphson',
        description: 'Scanned domain [-25, 25] for sign changes and refined stationary zeros.',
        latex:
          roots.length > 0
            ? `${variable} \\in \\{ ${roots.join(',\\; ')} \\}`
            : `\\text{No real roots detected in } [-25, 25].`,
      },
    ],
  };
}

export function solveMathProblem(params: {
  input: string;
  mode: SolverMode;
  variable?: string;
  point?: { x: number; y: number; z: number };
  bounds?: { lower: number; upper: number };
  angleUnit?: AngleUnit;
}): SolverOutput {
  const raw = params.input.trim();
  if (!raw) {
    throw new Error('Enter a mathematical expression or equation to solve.');
  }
  const angleUnit = params.angleUnit ?? 'rad';
  const analyzed = analyzeMathInput(raw);
  let variable = params.variable?.trim() || 'x';
  let pt = params.point ?? { x: 1, y: 1, z: 1 };
  let bounds = params.bounds ?? { lower: 0, upper: 1 };

  let effectiveMode: Exclude<SolverMode, 'auto'>;
  let effectiveInput = raw;

  if (params.mode === 'auto') {
    if (analyzed.kind === 'linear-system') {
      effectiveMode = 'linear-system';
      effectiveInput = analyzed.expr;
    } else if (analyzed.kind === 'differential-assignment') {
      const diffVar = analyzed.variable || variable;
      const rhsAst = parseExpression(analyzed.expr);
      const rhsLatex = toLatex(rhsAst);
      const allVars = extractVariables(rhsAst);
      const otherVars = allVars.filter((v) => v !== diffVar);
      const constLabel =
        analyzed.isPartial && otherVars.length > 0 ? `C(${otherVars.join(', ')})` : 'C';
      const anti = tryPolynomialAntiderivative(rhsAst, diffVar);
      const defVal = integrate1DComposite(
        (v) => evaluateAST(rhsAst, { ...pt, [diffVar]: v }, angleUnit),
        bounds.lower,
        bounds.upper,
        8
      );
      const cleanDefVal = Number(defVal.toFixed(6));

      let rateAtPt: number | null = null;
      try {
        const v = evaluateAST(rhsAst, pt, angleUnit);
        if (Number.isFinite(v)) rateAtPt = Number(v.toFixed(6));
      } catch {
        rateAtPt = null;
      }

      const lhsTex = analyzed.isPartial
        ? `\\frac{\\partial f}{\\partial ${diffVar}}`
        : `\\frac{df}{d${diffVar}}`;

      const steps: DerivationStep[] = [
        {
          id: 'diff-rel-1',
          rule: analyzed.isPartial
            ? 'Identified Partial Differential Relation'
            : 'Identified Ordinary Differential Relation',
          description: `Parsed normalized rate expression in variables (${
            allVars.join(', ') || 'constant'
          }).`,
          latex: `${lhsTex} = ${rhsLatex}`,
        },
      ];

      if (anti) {
        steps.push({
          id: 'diff-rel-2',
          rule: analyzed.isPartial
            ? `Integrate Partially w.r.t. ${diffVar}`
            : `Antiderivative w.r.t. ${diffVar}`,
          description: analyzed.isPartial
            ? `Hold ${otherVars.join(', ') || 'other variables'} constant and integrate term-by-term.`
            : `Integrate term-by-term with respect to ${diffVar}.`,
          latex: `f(${allVars.join(', ') || diffVar}) = \\int \\left(${rhsLatex}\\right) d${diffVar} = ${toLatex(
            anti
          )} + ${constLabel}`,
        });
      }

      steps.push({
        id: 'diff-rel-3',
        rule: 'Definite Integral & Point Rate',
        description: `Accumulated change over [${bounds.lower}, ${bounds.upper}]${
          rateAtPt !== null ? ` and rate at P(${pt.x}, ${pt.y}, ${pt.z})` : ''
        }.`,
        latex: `\\int_{${bounds.lower}}^{${bounds.upper}} \\left(${rhsLatex}\\right) d${diffVar} \\approx ${cleanDefVal}${
          rateAtPt !== null ? `, \\quad \\left.${lhsTex}\\right|_P = ${rateAtPt}` : ''
        }`,
      });

      return {
        detectedMode: 'integral',
        headline: analyzed.isPartial
          ? `Partial Differential Integration (${lhsTex.includes('partial') ? `∂f/∂${diffVar}` : diffVar})`
          : `Differential Equation Antiderivative (df/d${diffVar})`,
        resultLatex: anti
          ? `f = ${toLatex(anti)} + ${constLabel} \\quad \\left(${lhsTex} = ${rhsLatex}\\right)`
          : `${lhsTex} = ${rhsLatex}, \\quad \\int_{${bounds.lower}}^{${bounds.upper}} = ${cleanDefVal}`,
        resultPlain: anti ? `${toPlain(anti)} + ${constLabel}` : `${toPlain(rhsAst)} (def=${cleanDefVal})`,
        steps,
      };
    } else if (analyzed.kind === 'function-assignment') {
      effectiveMode = 'simplify';
      effectiveInput = preprocessMathSyntax(analyzed.expr);
    } else if (analyzed.kind === 'derivative') {
      effectiveMode = 'derivative';
      if (analyzed.variable) variable = analyzed.variable;
      effectiveInput = preprocessMathSyntax(analyzed.expr);
    } else if (analyzed.kind === 'integral') {
      effectiveMode = 'integral';
      if (analyzed.variable) variable = analyzed.variable;
      if (analyzed.lower !== undefined || analyzed.upper !== undefined) {
        bounds = {
          lower: analyzed.lower ?? bounds.lower,
          upper: analyzed.upper ?? bounds.upper,
        };
      }
      effectiveInput = preprocessMathSyntax(analyzed.expr);
    } else if (analyzed.kind === 'limit') {
      effectiveMode = 'limit';
      if (analyzed.variable) variable = analyzed.variable;
      if (analyzed.limitTarget !== undefined) {
        pt = { ...pt, [variable]: analyzed.limitTarget };
      }
      effectiveInput = preprocessMathSyntax(analyzed.expr);
    } else if (analyzed.kind === 'equation') {
      effectiveMode = 'equation';
      effectiveInput = analyzed.expr;
    } else {
      effectiveMode = 'simplify';
      effectiveInput = preprocessMathSyntax(analyzed.expr);
    }
  } else {
    effectiveMode = params.mode;
    if (effectiveMode !== 'equation' && effectiveMode !== 'linear-system') {
      effectiveInput = normalizeExpressionOnly(raw);
    }
  }

  if (effectiveMode === 'linear-system') {
    const sys = solveLinearEquations(effectiveInput, angleUnit);
    return {
      detectedMode: 'linear-system',
      headline: `${sys.vars.length}×${sys.vars.length} Linear System Solution`,
      resultLatex: sys.vars.map((v, i) => `${v} = ${sys.values[i]}`).join(', \\quad '),
      resultPlain: sys.vars.map((v, i) => `${v} = ${sys.values[i]}`).join(', '),
      systemSolution: { vars: sys.vars, values: sys.values },
      steps: sys.steps,
    };
  }

  if (effectiveMode === 'equation') {
    const eq = solveOneVariableEquation(effectiveInput, variable, pt, angleUnit);
    return {
      detectedMode: 'equation',
      headline: `Real Roots in ${variable}`,
      resultLatex:
        eq.roots.length > 0
          ? `${variable} = ${eq.roots.join(',\\; ')}`
          : '\\text{No real roots found in } [-25, 25]',
      resultPlain:
        eq.roots.length > 0 ? `${variable} = ${eq.roots.join(', ')}` : 'No real roots in [-25, 25]',
      roots: eq.roots,
      steps: eq.steps,
    };
  }

  const ast = parseExpression(effectiveInput);

  if (effectiveMode === 'simplify') {
    const simpLatex = toLatex(ast);
    const simpPlain = toPlain(ast);
    let evalAtPt: number | null = null;
    try {
      const v = evaluateAST(ast, pt, angleUnit);
      if (Number.isFinite(v)) evalAtPt = Number(v.toFixed(6));
    } catch {
      evalAtPt = null;
    }
    return {
      detectedMode: 'simplify',
      headline: 'Simplified Symbolic Form',
      resultLatex:
        evalAtPt !== null ? `${simpLatex} \\quad (=${evalAtPt} \\text{ at } P)` : simpLatex,
      resultPlain: simpPlain,
      steps: [
        {
          id: 'simp-1',
          rule: 'Algebraic AST Normalization',
          description: 'Combined like terms, cancelled common factors, and canonicalized powers.',
          latex: simpLatex,
        },
      ],
    };
  }

  if (effectiveMode === 'evaluate') {
    const val = evaluateAST(ast, pt, angleUnit);
    if (!Number.isFinite(val)) {
      throw new Error('Expression evaluates to an undefined or infinite value at this point.');
    }
    const clean = Number(val.toFixed(6));
    return {
      detectedMode: 'evaluate',
      headline: 'Point Evaluation',
      resultLatex: `f(${pt.x}, ${pt.y}, ${pt.z}) = ${clean}`,
      resultPlain: String(clean),
      steps: [
        {
          id: 'ev-1',
          rule: 'Variable Substitution',
          description: `Substitute x=${pt.x}, y=${pt.y}, z=${pt.z} (${angleUnit}).`,
          latex: `\\left.${toLatex(ast)}\\right|_{(${pt.x},${pt.y},${pt.z})} = ${clean}`,
        },
      ],
    };
  }

  if (effectiveMode === 'derivative') {
    const steps: DerivationStep[] = [];
    const dAst = simplify(differentiate(ast, variable, steps));
    return {
      detectedMode: 'derivative',
      headline: `Symbolic Derivative ∂/∂${variable}`,
      resultLatex: `\\frac{\\partial}{\\partial ${variable}}\\left(${toLatex(ast)}\\right) = ${toLatex(
        dAst
      )}`,
      resultPlain: toPlain(dAst),
      steps:
        steps.length > 0
          ? steps
          : [
              {
                id: 'drv-0',
                rule: 'Constant Rule',
                description: `Expression is independent of ${variable}.`,
                latex: `\\frac{\\partial}{\\partial ${variable}}\\left(${toLatex(ast)}\\right) = 0`,
              },
            ],
    };
  }

  if (effectiveMode === 'integral') {
    const anti = tryPolynomialAntiderivative(ast, variable);
    const val = integrate1DComposite(
      (v) => evaluateAST(ast, { ...pt, [variable]: v }, angleUnit),
      bounds.lower,
      bounds.upper,
      8
    );
    const cleanVal = Number(val.toFixed(6));

    const steps: DerivationStep[] = [];
    if (anti) {
      steps.push({
        id: 'int-sym',
        rule: 'Symbolic Antiderivative',
        description: `Apply Power Rule term-by-term with respect to ${variable}.`,
        latex: `\\int \\left(${toLatex(ast)}\\right) d${variable} = ${toLatex(anti)} + C`,
      });
    }
    steps.push({
      id: 'int-num',
      rule: 'Definite Integral (Gauss-Legendre)',
      description: `Evaluate over [${bounds.lower}, ${bounds.upper}].`,
      latex: `\\int_{${bounds.lower}}^{${bounds.upper}} \\left(${toLatex(
        ast
      )}\\right) d${variable} \\approx ${cleanVal}`,
    });

    return {
      detectedMode: 'integral',
      headline: anti ? 'Symbolic & Definite Integral' : 'Definite Integral',
      resultLatex: anti
        ? `\\int \\left(${toLatex(ast)}\\right)d${variable} = ${toLatex(
            anti
          )} + C, \\quad \\int_{${bounds.lower}}^{${bounds.upper}} = ${cleanVal}`
        : `\\int_{${bounds.lower}}^{${bounds.upper}} \\left(${toLatex(ast)}\\right)d${variable} \\approx ${cleanVal}`,
      resultPlain: anti ? `${toPlain(anti)} + C (def=${cleanVal})` : String(cleanVal),
      steps,
    };
  }

  // Limit
  const vars = extractVariables(ast);
  const isMulti = vars.includes('y') || vars.includes('z');
  if (isMulti) {
    const lim = solveMultivariableLimit(
      effectiveInput,
      { x0: pt.x, y0: pt.y, z0: pt.z },
      vars.includes('z'),
      angleUnit
    );
    return {
      detectedMode: 'limit',
      headline: `Multivariable Limit (${lim.status})`,
      resultLatex: lim.summaryLatex,
      resultPlain: lim.estimatedLimit !== null ? String(lim.estimatedLimit) : lim.status,
      steps: lim.steps,
    };
  }

  // 1D limit at x0
  const x0 = pt.x;
  const eps = [1e-2, 1e-4, 1e-6];
  const rightVals = eps.map((e) => evaluateAST(ast, { [variable]: x0 + e }, angleUnit));
  const leftVals = eps.map((e) => evaluateAST(ast, { [variable]: x0 - e }, angleUnit));
  const rLim = rightVals[rightVals.length - 1];
  const lLim = leftVals[leftVals.length - 1];
  const exists =
    Number.isFinite(rLim) && Number.isFinite(lLim) && Math.abs(rLim - lLim) < 1e-3;
  const cleanLim = exists ? Number(((rLim + lLim) / 2).toFixed(6)) : null;

  return {
    detectedMode: 'limit',
    headline: exists ? '1D Two-Sided Limit Exists' : 'One-Sided Limits Differ / Diverge',
    resultLatex: `\\lim_{${variable} \\to ${x0}} ${toLatex(ast)} = ${
      cleanLim !== null ? cleanLim : '\\text{DNE}'
    }`,
    resultPlain: cleanLim !== null ? String(cleanLim) : 'DNE',
    steps: [
      {
        id: 'l1d-1',
        rule: 'Two-Sided Approach Probe',
        description: `Compare left and right limits as ${variable} → ${x0}.`,
        latex: `\\lim_{${variable}\\to ${x0}^-} = ${
          Number.isFinite(lLim) ? Number(lLim.toFixed(6)) : '\\text{div}'
        }, \\quad \\lim_{${variable}\\to ${x0}^+} = ${
          Number.isFinite(rLim) ? Number(rLim.toFixed(6)) : '\\text{div}'
        }`,
      },
    ],
  };
}
