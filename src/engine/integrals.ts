import type { AngleUnit, DerivationStep } from '../types';
import {
  differentiate,
  evaluateAST,
  parseExpression,
  simplify,
  toLatex,
} from './symbolic';

// 8-point Gauss-Legendre nodes and weights on [-1, 1]
const GL_NODES = [
  -0.9602898564975363,
  -0.7966664774136267,
  -0.525532409916329,
  -0.1834346424956498,
  0.1834346424956498,
  0.525532409916329,
  0.7966664774136267,
  0.9602898564975363,
];

const GL_WEIGHTS = [
  0.1012285362903763,
  0.2223810344533745,
  0.3137066458778873,
  0.362683783378362,
  0.362683783378362,
  0.3137066458778873,
  0.2223810344533745,
  0.1012285362903763,
];

function integrate1DComposite(
  fn: (t: number) => number,
  a: number,
  b: number,
  panels = 4
): number {
  const h = (b - a) / panels;
  let total = 0;
  for (let p = 0; p < panels; p++) {
    const x0 = a + p * h;
    const x1 = x0 + h;
    const mid = 0.5 * (x0 + x1);
    const half = 0.5 * h;
    let sum = 0;
    for (let k = 0; k < GL_NODES.length; k++) {
      const val = fn(mid + half * GL_NODES[k]);
      if (Number.isFinite(val)) sum += GL_WEIGHTS[k] * val;
    }
    total += half * sum;
  }
  return total;
}

export interface IntegralResult {
  value: number;
  errorEstimate: number;
  equationLatex: string;
  steps: DerivationStep[];
}

export function solveDoubleIntegral(
  exprStr: string,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  angleUnit: AngleUnit = 'rad'
): IntegralResult {
  const ast = parseExpression(exprStr);

  const runGrid = (panels: number) =>
    integrate1DComposite(
      (x) =>
        integrate1DComposite(
          (y) => evaluateAST(ast, { x, y, z: 0 }, angleUnit),
          yMin,
          yMax,
          panels
        ),
      xMin,
      xMax,
      panels
    );

  const coarse = runGrid(2);
  const fine = runGrid(4);
  const errorEstimate = Math.abs(fine - coarse);

  const equationLatex = `\\int_{${yMin}}^{${yMax}} \\int_{${xMin}}^{${xMax}} \\left(${toLatex(
    ast
  )}\\right)\\,dx\\,dy \\approx ${Number(fine.toFixed(6))}`;

  return {
    value: fine,
    errorEstimate,
    equationLatex,
    steps: [
      {
        id: 'dbl-1',
        rule: 'Iterated Rectangular Bounds',
        description: `Integrate over x ∈ [${xMin}, ${xMax}] and y ∈ [${yMin}, ${yMax}].`,
        latex: `\\iint_R ${toLatex(ast)}\\,dA = \\int_{${yMin}}^{${yMax}}\\left(\\int_{${xMin}}^{${xMax}} ${toLatex(
          ast
        )}\\,dx\\right)dy`,
      },
      {
        id: 'dbl-2',
        rule: 'Gauss-Legendre Cubature (8×8 composite)',
        description: 'Evaluated composite 8-point Gauss-Legendre tensor grid.',
        latex: equationLatex,
      },
    ],
  };
}

export function solveTripleIntegral(
  exprStr: string,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  zMin: number,
  zMax: number,
  angleUnit: AngleUnit = 'rad'
): IntegralResult {
  const ast = parseExpression(exprStr);

  const runBox = (panels: number) =>
    integrate1DComposite(
      (x) =>
        integrate1DComposite(
          (y) =>
            integrate1DComposite(
              (z) => evaluateAST(ast, { x, y, z }, angleUnit),
              zMin,
              zMax,
              panels
            ),
          yMin,
          yMax,
          panels
        ),
      xMin,
      xMax,
      panels
    );

  const coarse = runBox(1);
  const fine = runBox(2);
  const errorEstimate = Math.abs(fine - coarse);

  const equationLatex = `\\int_{${zMin}}^{${zMax}} \\int_{${yMin}}^{${yMax}} \\int_{${xMin}}^{${xMax}} \\left(${toLatex(
    ast
  )}\\right)\\,dx\\,dy\\,dz \\approx ${Number(fine.toFixed(6))}`;

  return {
    value: fine,
    errorEstimate,
    equationLatex,
    steps: [
      {
        id: 'tri-1',
        rule: '3D Box Domain Setup',
        description: `Integrate over [${xMin}, ${xMax}] × [${yMin}, ${yMax}] × [${zMin}, ${zMax}].`,
        latex: `\\iiint_B ${toLatex(ast)}\\,dV`,
      },
      {
        id: 'tri-2',
        rule: 'Gauss-Legendre 3D Cubature',
        description: 'Computed tensor-product quadrature across all three coordinate axes.',
        latex: equationLatex,
      },
    ],
  };
}

export function solveLineIntegral(
  pStr: string,
  qStr: string,
  xTStr: string,
  yTStr: string,
  tMin: number,
  tMax: number,
  angleUnit: AngleUnit = 'rad'
): IntegralResult {
  const pAst = parseExpression(pStr);
  const qAst = parseExpression(qStr);
  const xAst = parseExpression(xTStr);
  const yAst = parseExpression(yTStr);
  const dxAst = simplify(differentiate(xAst, 't'));
  const dyAst = simplify(differentiate(yAst, 't'));

  const integrand = (t: number) => {
    const x = evaluateAST(xAst, { t }, angleUnit);
    const y = evaluateAST(yAst, { t }, angleUnit);
    const dx = evaluateAST(dxAst, { t }, angleUnit);
    const dy = evaluateAST(dyAst, { t }, angleUnit);
    const P = evaluateAST(pAst, { x, y, t }, angleUnit);
    const Q = evaluateAST(qAst, { x, y, t }, angleUnit);
    return P * dx + Q * dy;
  };

  const coarse = integrate1DComposite(integrand, tMin, tMax, 4);
  const fine = integrate1DComposite(integrand, tMin, tMax, 8);
  const errorEstimate = Math.abs(fine - coarse);

  const equationLatex = `\\int_C \\mathbf{F}\\cdot d\\mathbf{r} = \\int_{${tMin}}^{${tMax}} \\left(P\\frac{dx}{dt} + Q\\frac{dy}{dt}\\right)dt \\approx ${Number(
    fine.toFixed(6)
  )}`;

  return {
    value: fine,
    errorEstimate,
    equationLatex,
    steps: [
      {
        id: 'line-1',
        rule: 'Curve Tangent r′(t)',
        description: 'Differentiate curve parameterization r(t) = ⟨x(t), y(t)⟩ with respect to t.',
        latex: `\\mathbf{r}'(t) = \\left\\langle ${toLatex(dxAst)},\\; ${toLatex(dyAst)} \\right\\rangle`,
      },
      {
        id: 'line-2',
        rule: 'Pullback Dot Product',
        description: `Evaluate ∫ F(r(t)) · r'(t) dt over [${tMin}, ${tMax}].`,
        latex: equationLatex,
      },
    ],
  };
}

export function solveSurfaceIntegral(
  fStr: string,
  gStr: string,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  angleUnit: AngleUnit = 'rad'
): IntegralResult {
  const fAst = parseExpression(fStr);
  const gAst = parseExpression(gStr);
  const gxAst = simplify(differentiate(gAst, 'x'));
  const gyAst = simplify(differentiate(gAst, 'y'));

  const runSurface = (panels: number) =>
    integrate1DComposite(
      (x) =>
        integrate1DComposite(
          (y) => {
            const z = evaluateAST(gAst, { x, y }, angleUnit);
            const gx = evaluateAST(gxAst, { x, y }, angleUnit);
            const gy = evaluateAST(gyAst, { x, y }, angleUnit);
            const fVal = evaluateAST(fAst, { x, y, z }, angleUnit);
            const dS = Math.sqrt(1 + gx * gx + gy * gy);
            return fVal * dS;
          },
          yMin,
          yMax,
          panels
        ),
      xMin,
      xMax,
      panels
    );

  const coarse = runSurface(2);
  const fine = runSurface(4);
  const errorEstimate = Math.abs(fine - coarse);

  const equationLatex = `\\iint_S f(x,y,z)\\,dS = \\int_{${yMin}}^{${yMax}}\\int_{${xMin}}^{${xMax}} f\\big(x,y,${toLatex(
    gAst
  )}\\big)\\sqrt{1 + g_x^2 + g_y^2}\\,dx\\,dy \\approx ${Number(fine.toFixed(6))}`;

  return {
    value: fine,
    errorEstimate,
    equationLatex,
    steps: [
      {
        id: 'surf-1',
        rule: 'Surface Area Element dS',
        description: 'Compute partial derivatives of z = g(x, y) for dS = √(1 + g_x² + g_y²) dA.',
        latex: `g_x = ${toLatex(gxAst)}, \\quad g_y = ${toLatex(gyAst)}`,
      },
      {
        id: 'surf-2',
        rule: 'Surface Integral Evaluation',
        description: `Integrate over x ∈ [${xMin}, ${xMax}], y ∈ [${yMin}, ${yMax}].`,
        latex: equationLatex,
      },
    ],
  };
}
