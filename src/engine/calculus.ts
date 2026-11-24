import type { AngleUnit, DerivationStep } from '../types';
import {
  differentiate,
  evaluateAST,
  extractVariables,
  parseExpression,
  simplify,
  toLatex,
  toPlain,
  type ExprNode,
} from './symbolic';

export interface PartialDerivativeResult {
  ast: ExprNode;
  resultLatex: string;
  fullEquationLatex: string;
  plain: string;
  steps: DerivationStep[];
  variables: string[];
  evaluatedValue?: number;
}

export function solvePartialDerivative(
  exprStr: string,
  variable: string,
  order: number,
  point?: Record<string, number>,
  angleUnit: AngleUnit = 'rad'
): PartialDerivativeResult {
  const rawTokens = variable
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^a-z]/g, ''))
    .filter(Boolean);

  // Support either mixed partial list like "x, y" (or "xy" when 2+ letters) or repeated single variable with order
  const seq: string[] =
    rawTokens.length > 1
      ? rawTokens.slice(0, 5)
      : rawTokens.length === 1 && rawTokens[0].length > 1
      ? rawTokens[0].split('').slice(0, 5)
      : Array.from(
          { length: Math.max(1, Math.min(5, Math.floor(order))) },
          () => rawTokens[0] || 'x'
        );

  const cleanVar = seq[0] || 'x';
  let current = parseExpression(exprStr);
  const allVars = extractVariables(current);
  for (const v of seq) {
    if (!allVars.includes(v)) {
      allVars.push(v);
    }
  }
  allVars.sort();

  const allSteps: DerivationStep[] = [];
  const safeOrder = seq.length;
  const isMixed = new Set(seq).size > 1;

  for (let i = 1; i <= safeOrder; i++) {
    const activeVar = seq[i - 1];
    const orderSteps: DerivationStep[] = [];
    const next = simplify(differentiate(current, activeVar, orderSteps));
    if (safeOrder > 1) {
      allSteps.push({
        id: `order-${i}-header`,
        rule: isMixed ? `Mixed Step ${i} (∂/∂${activeVar})` : `Order ${i} Differentiation`,
        description: `Differentiate ${
          i === 1 ? 'f' : `step-${i - 1} result`
        } with respect to ${activeVar}.`,
        latex: `\\frac{\\partial}{\\partial ${activeVar}}\\left(${toLatex(current)}\\right) = ${toLatex(next)}`,
      });
    }
    for (const st of orderSteps) {
      allSteps.push({ ...st, id: `o${i}-${st.id}` });
    }
    if (orderSteps.length === 0 && safeOrder === 1) {
      allSteps.push({
        id: `o1-const`,
        rule: 'Constant Partial Rule',
        description: `Expression does not depend on ${activeVar}, so its partial derivative is 0.`,
        latex: `\\frac{\\partial}{\\partial ${activeVar}}\\left(${toLatex(current)}\\right) = 0`,
      });
    }
    current = next;
  }

  const rhsLatex = toLatex(current);
  let lhsLatex: string;
  if (safeOrder === 1) {
    lhsLatex = `\\frac{\\partial f}{\\partial ${cleanVar}}`;
  } else if (!isMixed) {
    lhsLatex = `\\frac{\\partial^{${safeOrder}} f}{\\partial ${cleanVar}^{${safeOrder}}}`;
  } else {
    const denom = [...seq]
      .reverse()
      .map((v) => `\\partial ${v}`)
      .join('\\,');
    lhsLatex = `\\frac{\\partial^{${safeOrder}} f}{${denom}}`;
  }

  let evaluatedValue: number | undefined;
  if (point) {
    const activeVars = extractVariables(current);
    const hasAll = activeVars.every((v) => typeof point[v] === 'number' && !Number.isNaN(point[v]));
    if (hasAll) {
      evaluatedValue = evaluateAST(current, point, angleUnit);
    }
  }

  return {
    ast: current,
    resultLatex: rhsLatex,
    fullEquationLatex: `${lhsLatex} = ${rhsLatex}`,
    plain: toPlain(current),
    steps: allSteps,
    variables: allVars,
    evaluatedValue,
  };
}

export interface GradientComponent {
  variable: string;
  ast: ExprNode;
  latex: string;
  plain: string;
  steps: DerivationStep[];
  evaluated?: number;
}

export interface GradientResult {
  components: GradientComponent[];
  vectorLatex: string;
  evaluatedVector?: number[];
  magnitude?: number;
  variables: string[];
}

export function solveGradient(
  exprStr: string,
  point?: Record<string, number>,
  angleUnit: AngleUnit = 'rad',
  explicitVars?: string[]
): GradientResult {
  const ast = parseExpression(exprStr);
  let vars = explicitVars && explicitVars.length > 0 ? explicitVars : extractVariables(ast);
  if (vars.length === 0) vars = ['x', 'y'];
  if (vars.length === 1 && vars[0] === 'x') vars = ['x', 'y'];

  const components: GradientComponent[] = vars.map((v) => {
    const steps: DerivationStep[] = [];
    const deriv = simplify(differentiate(ast, v, steps));
    if (steps.length === 0) {
      steps.push({
        id: `grad-${v}-0`,
        rule: 'Constant Partial Rule',
        description: `Term is independent of ${v}, so ∂f/∂${v} = 0.`,
        latex: `\\frac{\\partial f}{\\partial ${v}} = 0`,
      });
    }
    let evaluated: number | undefined;
    if (point) {
      const needed = extractVariables(deriv);
      if (needed.every((n) => typeof point[n] === 'number' && !Number.isNaN(point[n]))) {
        evaluated = evaluateAST(deriv, point, angleUnit);
      }
    }
    return {
      variable: v,
      ast: deriv,
      latex: toLatex(deriv),
      plain: toPlain(deriv),
      steps,
      evaluated,
    };
  });

  const vectorLatex = `\\nabla f(${vars.join(', ')}) = \\left\\langle ${components
    .map((c) => c.latex)
    .join(',\\; ')} \\right\\rangle`;

  const allEvaluated = components.every((c) => typeof c.evaluated === 'number' && Number.isFinite(c.evaluated));
  const evaluatedVector = allEvaluated ? components.map((c) => c.evaluated as number) : undefined;
  const magnitude = evaluatedVector
    ? Math.sqrt(evaluatedVector.reduce((sum, val) => sum + val * val, 0))
    : undefined;

  return {
    components,
    vectorLatex,
    evaluatedVector,
    magnitude,
    variables: vars,
  };
}

export interface DirectionalDerivativeResult {
  gradient: GradientResult;
  unitVector: number[];
  vectorNorm: number;
  directionalValue: number;
  symbolicDotLatex: string;
  steps: DerivationStep[];
}

export function solveDirectionalDerivative(
  exprStr: string,
  point: Record<string, number>,
  direction: number[],
  angleUnit: AngleUnit = 'rad'
): DirectionalDerivativeResult {
  const ast = parseExpression(exprStr);
  let vars = extractVariables(ast);
  if (vars.length === 0) vars = ['x', 'y'];
  if (vars.length === 1 && vars[0] === 'x') vars = ['x', 'y'];

  const paddedDir = vars.map((_, idx) => direction[idx] ?? 0);
  const norm = Math.sqrt(paddedDir.reduce((acc, v) => acc + v * v, 0));
  if (norm < 1e-12) {
    throw new Error('Direction vector cannot be the zero vector');
  }
  const unitVector = paddedDir.map((v) => v / norm);

  const grad = solveGradient(exprStr, point, angleUnit, vars);
  if (!grad.evaluatedVector) {
    throw new Error('Please provide valid numeric coordinates for the evaluation point');
  }

  const directionalValue = grad.evaluatedVector.reduce(
    (sum, gVal, i) => sum + gVal * unitVector[i],
    0
  );

  const uLatex = `\\left\\langle ${unitVector.map((u) => Number(u.toFixed(4))).join(',\\; ')} \\right\\rangle`;
  const gradAtPLatex = `\\left\\langle ${grad.evaluatedVector
    .map((g) => Number(g.toFixed(4)))
    .join(',\\; ')} \\right\\rangle`;

  const steps: DerivationStep[] = [
    {
      id: 'dir-1',
      rule: 'Compute Gradient',
      description: 'Find the partial derivatives with respect to each variable.',
      latex: grad.vectorLatex,
    },
    {
      id: 'dir-2',
      rule: 'Normalize Direction Vector',
      description: `Divide v = ⟨${paddedDir.join(', ')}⟩ by its magnitude ||v|| = ${Number(
        norm.toFixed(4)
      )}.`,
      latex: `\\mathbf{u} = \\frac{\\mathbf{v}}{\\|\\mathbf{v}\\|} = ${uLatex}`,
    },
    {
      id: 'dir-3',
      rule: 'Evaluate Gradient at Point',
      description: `Substitute P(${vars.map((v) => `${v}=${point[v] ?? 0}`).join(', ')}) into ∇f.`,
      latex: `\\nabla f(P) = ${gradAtPLatex}`,
    },
    {
      id: 'dir-4',
      rule: 'Dot Product',
      description: 'Compute D_u f(P) = ∇f(P) · u.',
      latex: `D_{\\mathbf{u}} f(P) = ${gradAtPLatex} \\cdot ${uLatex} = ${Number(
        directionalValue.toFixed(6)
      )}`,
    },
  ];

  return {
    gradient: grad,
    unitVector,
    vectorNorm: norm,
    directionalValue,
    symbolicDotLatex: `D_{\\mathbf{u}} f = ${grad.components
      .map((c, idx) => `\\left(${c.latex}\\right)\\left(${Number(unitVector[idx].toFixed(3))}\\right)`)
      .join(' + ')}`,
    steps,
  };
}

export type ExtremaClassification =
  | 'Local Minimum'
  | 'Local Maximum'
  | 'Saddle Point'
  | 'Inconclusive (D = 0)'
  | 'Not a Critical Point';

export interface MaximaMinimaResult {
  fxLatex: string;
  fyLatex: string;
  fxxLatex: string;
  fyyLatex: string;
  fxyLatex: string;
  fxVal: number;
  fyVal: number;
  fxxVal: number;
  fyyVal: number;
  fxyVal: number;
  discriminant: number;
  fVal: number;
  classification: ExtremaClassification;
  steps: DerivationStep[];
  detectedCriticalPoints: { x: number; y: number; classification: ExtremaClassification }[];
}

export function solveMaximaMinima(
  exprStr: string,
  x0: number,
  y0: number,
  angleUnit: AngleUnit = 'rad'
): MaximaMinimaResult {
  const f = parseExpression(exprStr);
  const fx = simplify(differentiate(f, 'x'));
  const fy = simplify(differentiate(f, 'y'));
  const fxx = simplify(differentiate(fx, 'x'));
  const fyy = simplify(differentiate(fy, 'y'));
  const fxy = simplify(differentiate(fx, 'y'));

  const evalAt = (px: number, py: number) => {
    const scope = { x: px, y: py };
    const fVal = evaluateAST(f, scope, angleUnit);
    const fxVal = evaluateAST(fx, scope, angleUnit);
    const fyVal = evaluateAST(fy, scope, angleUnit);
    const fxxVal = evaluateAST(fxx, scope, angleUnit);
    const fyyVal = evaluateAST(fyy, scope, angleUnit);
    const fxyVal = evaluateAST(fxy, scope, angleUnit);
    const D = fxxVal * fyyVal - fxyVal * fxyVal;
    const isCrit = Math.abs(fxVal) < 1e-4 && Math.abs(fyVal) < 1e-4;

    let classification: ExtremaClassification;
    if (!isCrit) {
      classification = 'Not a Critical Point';
    } else if (Math.abs(D) < 1e-6) {
      classification = 'Inconclusive (D = 0)';
    } else if (D > 0 && fxxVal > 0) {
      classification = 'Local Minimum';
    } else if (D > 0 && fxxVal < 0) {
      classification = 'Local Maximum';
    } else {
      classification = 'Saddle Point';
    }

    return { fVal, fxVal, fyVal, fxxVal, fyyVal, fxyVal, D, classification };
  };

  const atPoint = evalAt(x0, y0);

  // Quick Newton-Raphson critical point scan on a small 5x5 seed grid in [-3, 3]
  const found: { x: number; y: number; classification: ExtremaClassification }[] = [];
  const seeds = [-2, -1, 0, 1, 2];
  for (const sx of seeds) {
    for (const sy of seeds) {
      let cx = sx;
      let cy = sy;
      for (let iter = 0; iter < 18; iter++) {
        try {
          const cur = evalAt(cx, cy);
          if (Math.abs(cur.fxVal) < 1e-7 && Math.abs(cur.fyVal) < 1e-7) break;
          const det = cur.fxxVal * cur.fyyVal - cur.fxyVal * cur.fxyVal;
          if (!Number.isFinite(det) || Math.abs(det) < 1e-9) break;
          const dx = (cur.fyyVal * cur.fxVal - cur.fxyVal * cur.fyVal) / det;
          const dy = (-cur.fxyVal * cur.fxVal + cur.fxxVal * cur.fyVal) / det;
          cx -= dx;
          cy -= dy;
          if (!Number.isFinite(cx) || !Number.isFinite(cy) || Math.abs(cx) > 20 || Math.abs(cy) > 20) {
            cx = NaN;
            break;
          }
        } catch {
          cx = NaN;
          break;
        }
      }
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        try {
          const check = evalAt(cx, cy);
          if (check.classification !== 'Not a Critical Point') {
            const rx = Number(cx.toFixed(3));
            const ry = Number(cy.toFixed(3));
            const dup = found.some((p) => Math.hypot(p.x - rx, p.y - ry) < 0.02);
            if (!dup) {
              found.push({ x: rx, y: ry, classification: check.classification });
            }
          }
        } catch {
          // ignore invalid domain
        }
      }
    }
  }

  const steps: DerivationStep[] = [
    {
      id: 'mm-1',
      rule: 'First-Order Partials',
      description: 'Compute f_x and f_y to test whether the gradient vanishes at the point.',
      latex: `f_x = ${toLatex(fx)}, \\quad f_y = ${toLatex(fy)}`,
    },
    {
      id: 'mm-2',
      rule: 'Second-Order Partials',
      description: 'Compute f_xx, f_yy, and mixed partial f_xy for the Hessian matrix.',
      latex: `f_{xx} = ${toLatex(fxx)}, \\quad f_{yy} = ${toLatex(fyy)}, \\quad f_{xy} = ${toLatex(fxy)}`,
    },
    {
      id: 'mm-3',
      rule: 'Hessian Determinant',
      description: `Evaluate D = f_xx·f_yy - (f_xy)² at (${x0}, ${y0}).`,
      latex: `D(${x0}, ${y0}) = (${Number(atPoint.fxxVal.toFixed(4))})(${Number(
        atPoint.fyyVal.toFixed(4)
      )}) - (${Number(atPoint.fxyVal.toFixed(4))})^2 = ${Number(atPoint.D.toFixed(4))}`,
    },
  ];

  return {
    fxLatex: toLatex(fx),
    fyLatex: toLatex(fy),
    fxxLatex: toLatex(fxx),
    fyyLatex: toLatex(fyy),
    fxyLatex: toLatex(fxy),
    fxVal: atPoint.fxVal,
    fyVal: atPoint.fyVal,
    fxxVal: atPoint.fxxVal,
    fyyVal: atPoint.fyyVal,
    fxyVal: atPoint.fxyVal,
    discriminant: atPoint.D,
    fVal: atPoint.fVal,
    classification: atPoint.classification,
    steps,
    detectedCriticalPoints: found.slice(0, 6),
  };
}

export interface LinearApproxResult {
  tangentPlaneLatex: string;
  tangentPlanePlain: string;
  f0: number;
  fx0: number;
  fy0: number;
  approxAtTarget?: number;
  exactAtTarget?: number;
  error?: number;
  steps: DerivationStep[];
}

export function solveLinearApproximation(
  exprStr: string,
  x0: number,
  y0: number,
  targetX?: number,
  targetY?: number,
  angleUnit: AngleUnit = 'rad'
): LinearApproxResult {
  const f = parseExpression(exprStr);
  const fx = simplify(differentiate(f, 'x'));
  const fy = simplify(differentiate(f, 'y'));

  const f0 = evaluateAST(f, { x: x0, y: y0 }, angleUnit);
  const fx0 = evaluateAST(fx, { x: x0, y: y0 }, angleUnit);
  const fy0 = evaluateAST(fy, { x: x0, y: y0 }, angleUnit);

  const fmt = (n: number) => Number(n.toFixed(4));
  const dxTerm = x0 === 0 ? 'x' : x0 > 0 ? `(x - ${fmt(x0)})` : `(x + ${fmt(-x0)})`;
  const dyTerm = y0 === 0 ? 'y' : y0 > 0 ? `(y - ${fmt(y0)})` : `(y + ${fmt(-y0)})`;

  const fxSign = fx0 >= 0 ? `+ ${fmt(fx0)}` : `- ${fmt(Math.abs(fx0))}`;
  const fySign = fy0 >= 0 ? `+ ${fmt(fy0)}` : `- ${fmt(Math.abs(fy0))}`;

  const tangentPlaneLatex = `L(x, y) = ${fmt(f0)} ${fxSign}${dxTerm} ${fySign}${dyTerm}`;
  const tangentPlanePlain = `${fmt(f0)} + ${fmt(fx0)}*(x - ${fmt(x0)}) + ${fmt(fy0)}*(y - ${fmt(y0)})`;

  let approxAtTarget: number | undefined;
  let exactAtTarget: number | undefined;
  let error: number | undefined;

  if (
    typeof targetX === 'number' &&
    typeof targetY === 'number' &&
    Number.isFinite(targetX) &&
    Number.isFinite(targetY)
  ) {
    approxAtTarget = f0 + fx0 * (targetX - x0) + fy0 * (targetY - y0);
    exactAtTarget = evaluateAST(f, { x: targetX, y: targetY }, angleUnit);
    error = Math.abs(exactAtTarget - approxAtTarget);
  }

  const steps: DerivationStep[] = [
    {
      id: 'lin-1',
      rule: 'Evaluate Base Point',
      description: `Compute f(${x0}, ${y0}) on the surface.`,
      latex: `f(${x0}, ${y0}) = ${fmt(f0)}`,
    },
    {
      id: 'lin-2',
      rule: 'Partial Derivatives',
      description: 'Find f_x and f_y and evaluate both at the anchor point.',
      latex: `f_x(${x0}, ${y0}) = ${fmt(fx0)}, \\quad f_y(${x0}, ${y0}) = ${fmt(fy0)}`,
    },
    {
      id: 'lin-3',
      rule: 'Tangent Plane Equation',
      description: 'Assemble L(x, y) = f(x₀, y₀) + f_x(x₀, y₀)(x - x₀) + f_y(x₀, y₀)(y - y₀).',
      latex: tangentPlaneLatex,
    },
  ];

  return {
    tangentPlaneLatex,
    tangentPlanePlain,
    f0,
    fx0,
    fy0,
    approxAtTarget,
    exactAtTarget,
    error,
    steps,
  };
}

export interface VectorFieldResult {
  pAst: ExprNode;
  qAst: ExprNode;
  divAst: ExprNode;
  curlAst: ExprNode;
  divLatex: string;
  curlLatex: string;
  isConservative: boolean;
  evalP?: number;
  evalQ?: number;
  evalDiv?: number;
  evalCurl?: number;
  steps: DerivationStep[];
}

export function solveVectorField(
  pStr: string,
  qStr: string,
  x0?: number,
  y0?: number,
  angleUnit: AngleUnit = 'rad'
): VectorFieldResult {
  const pAst = parseExpression(pStr);
  const qAst = parseExpression(qStr);

  const px = simplify(differentiate(pAst, 'x'));
  const py = simplify(differentiate(pAst, 'y'));
  const qx = simplify(differentiate(qAst, 'x'));
  const qy = simplify(differentiate(qAst, 'y'));

  const divAst = simplify({ type: 'binary', op: '+', left: px, right: qy });
  const curlAst = simplify({ type: 'binary', op: '-', left: qx, right: py });

  const isConservative = curlAst.type === 'number' && Math.abs(curlAst.value) < 1e-12;

  let evalP: number | undefined;
  let evalQ: number | undefined;
  let evalDiv: number | undefined;
  let evalCurl: number | undefined;

  if (typeof x0 === 'number' && typeof y0 === 'number' && Number.isFinite(x0) && Number.isFinite(y0)) {
    const scope = { x: x0, y: y0 };
    evalP = evaluateAST(pAst, scope, angleUnit);
    evalQ = evaluateAST(qAst, scope, angleUnit);
    evalDiv = evaluateAST(divAst, scope, angleUnit);
    evalCurl = evaluateAST(curlAst, scope, angleUnit);
  }

  const steps: DerivationStep[] = [
    {
      id: 'vf-1',
      rule: 'Divergence (∇ · F)',
      description: 'Sum the partial derivative of P with respect to x and Q with respect to y.',
      latex: `\\nabla \\cdot \\mathbf{F} = \\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} = ${toLatex(
        px
      )} + ${toLatex(qy)} = ${toLatex(divAst)}`,
    },
    {
      id: 'vf-2',
      rule: '2D Scalar Curl (∇ × F)',
      description: 'Compute ∂Q/∂x − ∂P/∂y to measure rotational tendency.',
      latex: `\\operatorname{curl}(\\mathbf{F}) = \\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y} = ${toLatex(
        qx
      )} - \\left(${toLatex(py)}\\right) = ${toLatex(curlAst)}`,
    },
  ];

  return {
    pAst,
    qAst,
    divAst,
    curlAst,
    divLatex: toLatex(divAst),
    curlLatex: toLatex(curlAst),
    isConservative,
    evalP,
    evalQ,
    evalDiv,
    evalCurl,
    steps,
  };
}

export interface JacobianResult {
  variables: string[];
  symbolicMatrixLatex: string;
  entriesLatex: string[][];
  evaluatedMatrix?: number[][];
  detLatex?: string;
  evaluatedDet?: number;
  steps: DerivationStep[];
}

function matrixDet2or3(m: number[][]): number | undefined {
  if (m.length === 2 && m[0].length === 2) {
    return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  }
  if (m.length === 3 && m[0].length === 3) {
    return (
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    );
  }
  return undefined;
}

export function solveJacobian(
  componentExprs: string[],
  explicitVars: string[],
  point?: Record<string, number>,
  angleUnit: AngleUnit = 'rad'
): JacobianResult {
  const vars = explicitVars.length > 0 ? explicitVars : ['x', 'y'];
  const asts = componentExprs.map((e) => parseExpression(e));
  const derivAsts: ExprNode[][] = asts.map((fnAst) =>
    vars.map((v) => simplify(differentiate(fnAst, v)))
  );
  const entriesLatex = derivAsts.map((row) => row.map((node) => toLatex(node)));

  const rowsTex = entriesLatex.map((r) => r.join(' & ')).join(' \\\\ ');
  const symbolicMatrixLatex = `J_{\\mathbf{F}} = \\begin{bmatrix} ${rowsTex} \\end{bmatrix}`;

  let evaluatedMatrix: number[][] | undefined;
  let evaluatedDet: number | undefined;
  if (point && vars.every((v) => typeof point[v] === 'number' && Number.isFinite(point[v]))) {
    evaluatedMatrix = derivAsts.map((row) =>
      row.map((node) => evaluateAST(node, point, angleUnit))
    );
    evaluatedDet = matrixDet2or3(evaluatedMatrix);
  }

  let detLatex: string | undefined;
  if (derivAsts.length === 2 && vars.length === 2) {
    const detAst = simplify({
      type: 'binary',
      op: '-',
      left: { type: 'binary', op: '*', left: derivAsts[0][0], right: derivAsts[1][1] },
      right: { type: 'binary', op: '*', left: derivAsts[0][1], right: derivAsts[1][0] },
    });
    detLatex = toLatex(detAst);
  }

  const steps: DerivationStep[] = derivAsts.map((row, rIdx) => ({
    id: `jac-row-${rIdx}`,
    rule: `Component f_${rIdx + 1} Gradient`,
    description: `Row ${rIdx + 1} contains partial derivatives of f_${rIdx + 1} with respect to (${vars.join(', ')}).`,
    latex: `\\nabla f_${rIdx + 1} = \\left\\langle ${row.map((n) => toLatex(n)).join(',\\; ')} \\right\\rangle`,
  }));

  if (detLatex) {
    steps.push({
      id: 'jac-det',
      rule: 'Jacobian Determinant',
      description: 'Compute det(J) = (∂f₁/∂x)(∂f₂/∂y) − (∂f₁/∂y)(∂f₂/∂x).',
      latex: `\\det(J_{\\mathbf{F}}) = ${detLatex}`,
    });
  }

  return {
    variables: vars,
    symbolicMatrixLatex,
    entriesLatex,
    evaluatedMatrix,
    detLatex,
    evaluatedDet,
    steps,
  };
}

export interface HessianLaplacianResult {
  variables: string[];
  hessianLatex: string;
  laplacianLatex: string;
  laplacianPlain: string;
  evaluatedHessian?: number[][];
  evaluatedLaplacian?: number;
  determinant?: number;
  definiteness?: string;
  steps: DerivationStep[];
}

export function solveHessianAndLaplacian(
  exprStr: string,
  explicitVars: string[],
  point?: Record<string, number>,
  angleUnit: AngleUnit = 'rad'
): HessianLaplacianResult {
  const ast = parseExpression(exprStr);
  const detected = extractVariables(ast);
  const vars =
    explicitVars.length > 0
      ? explicitVars
      : detected.length >= 2
      ? detected
      : ['x', 'y'];

  const firstPartials = vars.map((v) => simplify(differentiate(ast, v)));
  const secondMatrixAsts: ExprNode[][] = vars.map((_, i) =>
    vars.map((vj) => simplify(differentiate(firstPartials[i], vj)))
  );

  const hessianRows = secondMatrixAsts
    .map((row) => row.map((node) => toLatex(node)).join(' & '))
    .join(' \\\\ ');
  const hessianLatex = `H_f = \\begin{bmatrix} ${hessianRows} \\end{bmatrix}`;

  // Laplacian = trace(H_f) = sum of pure second partials
  let lapAst: ExprNode = secondMatrixAsts[0][0];
  for (let i = 1; i < vars.length; i++) {
    lapAst = simplify({ type: 'binary', op: '+', left: lapAst, right: secondMatrixAsts[i][i] });
  }

  let evaluatedHessian: number[][] | undefined;
  let evaluatedLaplacian: number | undefined;
  let determinant: number | undefined;
  let definiteness: string | undefined;

  if (point && vars.every((v) => typeof point[v] === 'number' && Number.isFinite(point[v]))) {
    evaluatedHessian = secondMatrixAsts.map((row) =>
      row.map((node) => evaluateAST(node, point, angleUnit))
    );
    evaluatedLaplacian = evaluatedHessian.reduce((sum, row, idx) => sum + row[idx], 0);
    determinant = matrixDet2or3(evaluatedHessian);

    // Sylvester's criterion on 2x2 or 3x3 symmetric matrix
    if (evaluatedHessian.length === 2) {
      const d1 = evaluatedHessian[0][0];
      const d2 = determinant ?? 0;
      if (d2 > 1e-8 && d1 > 0) definiteness = 'Positive Definite (Local Minimum curvature)';
      else if (d2 > 1e-8 && d1 < 0) definiteness = 'Negative Definite (Local Maximum curvature)';
      else if (d2 < -1e-8) definiteness = 'Indefinite (Saddle curvature)';
      else definiteness = 'Semidefinite / Degenerate';
    } else if (evaluatedHessian.length === 3) {
      const m = evaluatedHessian;
      const d1 = m[0][0];
      const d2 = m[0][0] * m[1][1] - m[0][1] * m[1][0];
      const d3 = determinant ?? 0;
      if (d1 > 1e-8 && d2 > 1e-8 && d3 > 1e-8) {
        definiteness = 'Positive Definite (Strict convex bowl)';
      } else if (d1 < -1e-8 && d2 > 1e-8 && d3 < -1e-8) {
        definiteness = 'Negative Definite (Strict concave peak)';
      } else if (Math.abs(d3) > 1e-8) {
        definiteness = 'Indefinite (Multivariable saddle)';
      } else {
        definiteness = 'Semidefinite / Degenerate';
      }
    }
  }

  const steps: DerivationStep[] = [
    {
      id: 'hl-1',
      rule: 'First-Order Partials',
      description: `Differentiate f with respect to ${vars.join(', ')}.`,
      latex: vars.map((v, i) => `f_${v} = ${toLatex(firstPartials[i])}`).join(', \\quad '),
    },
    {
      id: 'hl-2',
      rule: 'Hessian Matrix H(f)',
      description: 'Assemble second-order partial derivatives [∂²f / ∂xᵢ∂xⱼ].',
      latex: hessianLatex,
    },
    {
      id: 'hl-3',
      rule: 'Laplacian Operator (∇²f)',
      description: 'Sum the diagonal second partial derivatives (trace of Hessian).',
      latex: `\\nabla^2 f = ${vars.map((v) => `f_{${v}${v}}`).join(' + ')} = ${toLatex(lapAst)}`,
    },
  ];

  return {
    variables: vars,
    hessianLatex,
    laplacianLatex: toLatex(lapAst),
    laplacianPlain: toPlain(lapAst),
    evaluatedHessian,
    evaluatedLaplacian,
    determinant,
    definiteness,
    steps,
  };
}

export interface TaylorSeriesResult {
  seriesLatex: string;
  isMaclaurin: boolean;
  isMultivariable: boolean;
  approxValue?: number;
  exactValue?: number;
  error?: number;
  steps: DerivationStep[];
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function fmtCoeff(val: number): string {
  if (Math.abs(val - Math.round(val)) < 1e-8) return String(Math.round(val));
  return String(Number(val.toFixed(4)));
}

export function solveTaylorSeries(
  exprStr: string,
  degree: number,
  center: { x: number; y?: number },
  isMultivariable: boolean,
  evalPt?: { x: number; y?: number },
  angleUnit: AngleUnit = 'rad'
): TaylorSeriesResult {
  const ast = parseExpression(exprStr);
  const safeDeg = Math.max(1, Math.min(isMultivariable ? 3 : 5, Math.floor(degree)));
  const a = center.x;
  const b = center.y ?? 0;
  const isMaclaurin = Math.abs(a) < 1e-12 && (!isMultivariable || Math.abs(b) < 1e-12);
  const steps: DerivationStep[] = [];

  if (!isMultivariable) {
    let deriv = ast;
    const termsTex: string[] = [];
    let approxVal = 0;

    for (let k = 0; k <= safeDeg; k++) {
      if (k > 0) deriv = simplify(differentiate(deriv, 'x'));
      const valAtCenter = evaluateAST(deriv, { x: a, y: 0 }, angleUnit);
      const coeff = valAtCenter / factorial(k);

      steps.push({
        id: `tay-1d-${k}`,
        rule: `Degree ${k} Term`,
        description: `f^(${k})(${a}) = ${fmtCoeff(valAtCenter)} → coefficient = ${fmtCoeff(valAtCenter)}/${k}!`,
        latex: `c_${k} = \\frac{${fmtCoeff(valAtCenter)}}{${factorial(k)}} = ${fmtCoeff(coeff)}`,
      });

      if (evalPt !== undefined) {
        approxVal += coeff * Math.pow(evalPt.x - a, k);
      }

      if (Math.abs(coeff) < 1e-9) continue;
      const dxTex = a === 0 ? 'x' : a > 0 ? `(x - ${fmtCoeff(a)})` : `(x + ${fmtCoeff(-a)})`;
      const powTex = k === 0 ? '' : k === 1 ? dxTex : `${dxTex}^{${k}}`;
      const absC = Math.abs(coeff);
      const cStr = k > 0 && Math.abs(absC - 1) < 1e-8 ? '' : fmtCoeff(absC);
      const termCore = `${cStr}${powTex}` || '1';
      if (termsTex.length === 0) {
        termsTex.push(coeff < 0 ? `-${termCore}` : termCore);
      } else {
        termsTex.push(coeff < 0 ? `- ${termCore}` : `+ ${termCore}`);
      }
    }

    const seriesBody = termsTex.length > 0 ? termsTex.join(' ') : '0';
    const seriesLatex = `T_{${safeDeg}}(x) = ${seriesBody}`;
    let exactValue: number | undefined;
    let error: number | undefined;
    if (evalPt !== undefined) {
      exactValue = evaluateAST(ast, { x: evalPt.x, y: 0 }, angleUnit);
      error = Math.abs(exactValue - approxVal);
    }

    return {
      seriesLatex,
      isMaclaurin,
      isMultivariable: false,
      approxValue: evalPt !== undefined ? approxVal : undefined,
      exactValue,
      error,
      steps,
    };
  }

  // 2D Bivariate Taylor Series up to degree 3
  const dxTex = a === 0 ? 'x' : a > 0 ? `(x - ${fmtCoeff(a)})` : `(x + ${fmtCoeff(-a)})`;
  const dyTex = b === 0 ? 'y' : b > 0 ? `(y - ${fmtCoeff(b)})` : `(y + ${fmtCoeff(-b)})`;
  const termsTex: string[] = [];
  let approxVal = 0;

  for (let total = 0; total <= safeDeg; total++) {
    for (let i = total; i >= 0; i--) {
      const j = total - i;
      let dNode = ast;
      for (let ix = 0; ix < i; ix++) dNode = simplify(differentiate(dNode, 'x'));
      for (let iy = 0; iy < j; iy++) dNode = simplify(differentiate(dNode, 'y'));
      const derivAtCenter = evaluateAST(dNode, { x: a, y: b }, angleUnit);
      const coeff = derivAtCenter / (factorial(i) * factorial(j));

      if (evalPt !== undefined) {
        approxVal +=
          coeff * Math.pow(evalPt.x - a, i) * Math.pow((evalPt.y ?? 0) - b, j);
      }

      if (Math.abs(coeff) < 1e-9) continue;
      const xPart = i === 0 ? '' : i === 1 ? dxTex : `${dxTex}^{${i}}`;
      const yPart = j === 0 ? '' : j === 1 ? dyTex : `${dyTex}^{${j}}`;
      const absC = Math.abs(coeff);
      const cStr = (i > 0 || j > 0) && Math.abs(absC - 1) < 1e-8 ? '' : fmtCoeff(absC);
      const core = `${cStr}${xPart}${yPart}` || '1';
      if (termsTex.length === 0) {
        termsTex.push(coeff < 0 ? `-${core}` : core);
      } else {
        termsTex.push(coeff < 0 ? `- ${core}` : `+ ${core}`);
      }
    }
    steps.push({
      id: `tay-2d-${total}`,
      rule: `Order ${total} Terms`,
      description: `Computed all partial derivatives ∂^${total}f / ∂x^i ∂y^j at (${a}, ${b}).`,
      latex: `\\sum_{i+j=${total}} \\frac{f_{x^i y^j}(${a}, ${b})}{i!\\,j!} (x-${a})^i (y-${b})^j`,
    });
  }

  let exactValue: number | undefined;
  let error: number | undefined;
  if (evalPt !== undefined) {
    exactValue = evaluateAST(ast, { x: evalPt.x, y: evalPt.y ?? 0 }, angleUnit);
    error = Math.abs(exactValue - approxVal);
  }

  return {
    seriesLatex: `T_{${safeDeg}}(x, y) = ${termsTex.length > 0 ? termsTex.join(' ') : '0'}`,
    isMaclaurin,
    isMultivariable: true,
    approxValue: evalPt !== undefined ? approxVal : undefined,
    exactValue,
    error,
    steps,
  };
}
