import type { AngleUnit, DerivationStep } from '../types';
import { integrate1DComposite } from './integrals';
import {
  dependsOn,
  differentiate,
  evaluateAST,
  parseExpression,
  simplify,
  toLatex,
  toPlain,
  type ExprNode,
} from './symbolic';

// ============================================================
// A. MULTIVARIABLE LIMITS & CONTINUITY
// ============================================================
export interface PathProbeResult {
  pathName: string;
  pathLatex: string;
  samples: { t: number; value: number }[];
  estimatedLimit: number | null;
  diverges: boolean;
}

export interface MultivariableLimitResult {
  status:
    | 'Convergent & Continuous'
    | 'Removable Discontinuity'
    | 'Path-Dependent (Limit DNE)'
    | 'Unbounded / Divergent';
  estimatedLimit: number | null;
  valueAtPoint: number | null;
  isContinuous: boolean;
  paths: PathProbeResult[];
  polarSpread?: number;
  summaryLatex: string;
  steps: DerivationStep[];
}

export function solveMultivariableLimit(
  exprStr: string,
  point: { x0: number; y0: number; z0?: number },
  is3D = false,
  angleUnit: AngleUnit = 'rad'
): MultivariableLimitResult {
  const ast = parseExpression(exprStr);
  const { x0, y0, z0 = 0 } = point;

  let directVal: number | null = null;
  try {
    const v = evaluateAST(ast, is3D ? { x: x0, y: y0, z: z0 } : { x: x0, y: y0, z: 0 }, angleUnit);
    if (Number.isFinite(v)) directVal = v;
  } catch {
    directVal = null;
  }

  const ts = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5];

  const probePath = (
    pathName: string,
    pathLatex: string,
    coordFn: (t: number) => { x: number; y: number; z: number }
  ): PathProbeResult => {
    const samples: { t: number; value: number }[] = [];
    for (const t of ts) {
      try {
        const coords = coordFn(t);
        const val = evaluateAST(ast, coords, angleUnit);
        if (Number.isFinite(val)) {
          samples.push({ t, value: val });
        }
      } catch {
        // undefined sample
      }
    }

    if (samples.length < 2) {
      return { pathName, pathLatex, samples, estimatedLimit: null, diverges: true };
    }

    const last = samples[samples.length - 1].value;
    const prev = samples[samples.length - 2].value;
    const prev2 = samples.length >= 3 ? samples[samples.length - 3].value : prev;

    const growingFast =
      Math.abs(last) > 1e5 || (Math.abs(last - prev) > Math.abs(prev - prev2) * 1.8 && Math.abs(last) > 50);

    if (growingFast) {
      return { pathName, pathLatex, samples, estimatedLimit: null, diverges: true };
    }

    const cleanLim = Math.abs(last) < 1e-9 ? 0 : Number(last.toFixed(6));
    return { pathName, pathLatex, samples, estimatedLimit: cleanLim, diverges: false };
  };

  const paths: PathProbeResult[] = is3D
    ? [
        probePath('x-axis approach (y=y₀, z=z₀)', `x = ${x0}+t,\\; y=${y0},\\; z=${z0}`, (t) => ({
          x: x0 + t,
          y: y0,
          z: z0,
        })),
        probePath('y-axis approach (x=x₀, z=z₀)', `x = ${x0},\\; y=${y0}+t,\\; z=${z0}`, (t) => ({
          x: x0,
          y: y0 + t,
          z: z0,
        })),
        probePath('z-axis approach (x=x₀, y=y₀)', `x = ${x0},\\; y=${y0},\\; z=${z0}+t`, (t) => ({
          x: x0,
          y: y0,
          z: z0 + t,
        })),
        probePath('Space diagonal (t, t, t)', `x=${x0}+t,\\; y=${y0}+t,\\; z=${z0}+t`, (t) => ({
          x: x0 + t,
          y: y0 + t,
          z: z0 + t,
        })),
        probePath('Parabolic path (t, t², t)', `x=${x0}+t,\\; y=${y0}+t^2,\\; z=${z0}+t`, (t) => ({
          x: x0 + t,
          y: y0 + t * t,
          z: z0 + t,
        })),
      ]
    : [
        probePath('Horizontal (y = y₀)', `y = ${y0}`, (t) => ({ x: x0 + t, y: y0, z: 0 })),
        probePath('Vertical (x = x₀)', `x = ${x0}`, (t) => ({ x: x0, y: y0 + t, z: 0 })),
        probePath('Diagonal (m = 1)', `y - ${y0} = x - ${x0}`, (t) => ({
          x: x0 + t,
          y: y0 + t,
          z: 0,
        })),
        probePath('Anti-diagonal (m = -1)', `y - ${y0} = -(x - ${x0})`, (t) => ({
          x: x0 + t,
          y: y0 - t,
          z: 0,
        })),
        probePath('Parabolic curve (y = x²)', `y - ${y0} = (x - ${x0})^2`, (t) => ({
          x: x0 + t,
          y: y0 + t * t,
          z: 0,
        })),
        probePath('Negative branch (x → x₀⁻)', `x = ${x0} - t,\\; y = ${y0} - t`, (t) => ({
          x: x0 - t,
          y: y0 - t,
          z: 0,
        })),
      ];

  // Radial polar/spherical check at r = 1e-4 to catch hidden non-linear angle dependence
  let polarSpread = 0;
  const rProbe = 1e-4;
  const radialVals: number[] = [];
  for (let k = 0; k < 12; k++) {
    const theta = (k / 12) * 2 * Math.PI + 0.17;
    try {
      const val = is3D
        ? evaluateAST(
            ast,
            {
              x: x0 + rProbe * Math.sin(theta) * Math.cos(theta),
              y: y0 + rProbe * Math.sin(theta) * Math.sin(theta),
              z: z0 + rProbe * Math.cos(theta),
            },
            angleUnit
          )
        : evaluateAST(
            ast,
            { x: x0 + rProbe * Math.cos(theta), y: y0 + rProbe * Math.sin(theta), z: 0 },
            angleUnit
          );
      if (Number.isFinite(val)) radialVals.push(val);
    } catch {
      // ignore
    }
  }
  if (radialVals.length >= 4) {
    polarSpread = Math.max(...radialVals) - Math.min(...radialVals);
  }

  const anyDiverges = paths.some((p) => p.diverges);
  const finiteLimits = paths
    .map((p) => p.estimatedLimit)
    .filter((v): v is number => v !== null);

  let status: MultivariableLimitResult['status'];
  let estimatedLimit: number | null = null;
  let isContinuous = false;

  if (anyDiverges && finiteLimits.length === 0) {
    status = 'Unbounded / Divergent';
  } else if (finiteLimits.length === 0) {
    status = 'Unbounded / Divergent';
  } else {
    const spread = Math.max(...finiteLimits) - Math.min(...finiteLimits);
    if (anyDiverges || spread > 1e-3 || polarSpread > 5e-3) {
      status = 'Path-Dependent (Limit DNE)';
    } else {
      const avg = finiteLimits.reduce((s, v) => s + v, 0) / finiteLimits.length;
      estimatedLimit = Math.abs(avg) < 1e-8 ? 0 : Number(avg.toFixed(6));
      if (directVal !== null && Math.abs(directVal - estimatedLimit) < 1e-4) {
        status = 'Convergent & Continuous';
        isContinuous = true;
      } else {
        status = 'Removable Discontinuity';
      }
    }
  }

  const ptTex = is3D ? `(${x0}, ${y0}, ${z0})` : `(${x0}, ${y0})`;
  const varList = is3D ? '(x, y, z)' : '(x, y)';
  const limTex =
    estimatedLimit !== null ? `${estimatedLimit}` : '\\text{Does Not Exist}';
  const summaryLatex = `\\lim_{${varList} \\to ${ptTex}} \\left(${toLatex(ast)}\\right) = ${limTex}`;

  const steps: DerivationStep[] = [
    {
      id: 'lim-1',
      rule: 'Direct Substitution Check',
      description: `Evaluate f${ptTex} directly to test for indeterminacy (0/0) or defined continuity.`,
      latex:
        directVal !== null
          ? `f${ptTex} = ${Number(directVal.toFixed(6))}`
          : `f${ptTex} \\text{ is undefined (indeterminate or singular)}`,
    },
    {
      id: 'lim-2',
      rule: 'Multi-Path & Polar Neighborhood Probe',
      description: `Evaluated ${paths.length} algebraic trajectories plus 12 radial angles at radius r = 10⁻⁴.`,
      latex:
        status === 'Path-Dependent (Limit DNE)'
          ? `\\text{Distinct path limits found (spread } \\Delta \\approx ${Number(
              Math.max(
                polarSpread,
                finiteLimits.length > 1 ? Math.max(...finiteLimits) - Math.min(...finiteLimits) : 0
              ).toFixed(4)
            )}) \\implies \\text{Limit DNE}`
          : `\\text{All paths agree on } L \\approx ${limTex}`,
    },
    {
      id: 'lim-3',
      rule: 'Continuity Classification',
      description: isContinuous
        ? `Limit equals f${ptTex}, so f is continuous at ${ptTex}.`
        : status === 'Removable Discontinuity'
        ? `Limit exists (${limTex}), but f${ptTex} is undefined or differs — removable discontinuity.`
        : `Function is discontinuous at ${ptTex} because the limit does not exist finitely.`,
      latex: summaryLatex,
    },
  ];

  return {
    status,
    estimatedLimit,
    valueAtPoint: directVal !== null ? Number(directVal.toFixed(6)) : null,
    isContinuous,
    paths,
    polarSpread,
    summaryLatex,
    steps,
  };
}

// ============================================================
// B. IMPLICIT DIFFERENTIATION, MULTIVARIABLE CHAIN RULE & TOTAL DERIVATIVE
// ============================================================
export interface ImplicitDiffResult {
  mode: '2d' | '3d';
  fxLatex: string;
  fyLatex: string;
  fzLatex?: string;
  dydxLatex?: string;
  dydxPlain?: string;
  dzdxLatex?: string;
  dzdyLatex?: string;
  evaluatedSlope?: number;
  evaluatedDzDx?: number;
  evaluatedDzDy?: number;
  steps: DerivationStep[];
}

export function solveImplicitDifferentiation(
  FExpr: string,
  mode: '2d' | '3d',
  point?: { x?: number; y?: number; z?: number },
  angleUnit: AngleUnit = 'rad'
): ImplicitDiffResult {
  const fAst = parseExpression(FExpr);
  const fx = simplify(differentiate(fAst, 'x'));
  const fy = simplify(differentiate(fAst, 'y'));

  if (mode === '2d') {
    const dydxAst = simplify({
      type: 'unary',
      op: '-',
      arg: { type: 'binary', op: '/', left: fx, right: fy },
    });
    const dydxLatex = toLatex(dydxAst);
    const dydxPlain = toPlain(dydxAst);

    let evaluatedSlope: number | undefined;
    if (point?.x !== undefined && point?.y !== undefined) {
      const den = evaluateAST(fy, { x: point.x, y: point.y }, angleUnit);
      if (Math.abs(den) > 1e-9) {
        evaluatedSlope = evaluateAST(dydxAst, { x: point.x, y: point.y }, angleUnit);
      }
    }

    return {
      mode,
      fxLatex: toLatex(fx),
      fyLatex: toLatex(fy),
      dydxLatex,
      dydxPlain,
      evaluatedSlope,
      steps: [
        {
          id: 'imp-1',
          rule: 'Partial Derivatives of F(x, y) = 0',
          description: 'Compute partial derivatives F_x and F_y treating the other variable constant.',
          latex: `F_x = ${toLatex(fx)}, \\qquad F_y = ${toLatex(fy)}`,
        },
        {
          id: 'imp-2',
          rule: 'Implicit Function Theorem (2D)',
          description: 'Apply dy/dx = -F_x / F_y where F_y ≠ 0.',
          latex: `\\frac{dy}{dx} = -\\frac{F_x}{F_y} = ${dydxLatex}`,
        },
      ],
    };
  }

  const fz = simplify(differentiate(fAst, 'z'));
  const dzdxAst = simplify({
    type: 'unary',
    op: '-',
    arg: { type: 'binary', op: '/', left: fx, right: fz },
  });
  const dzdyAst = simplify({
    type: 'unary',
    op: '-',
    arg: { type: 'binary', op: '/', left: fy, right: fz },
  });

  let evaluatedDzDx: number | undefined;
  let evaluatedDzDy: number | undefined;
  if (point?.x !== undefined && point?.y !== undefined && point?.z !== undefined) {
    const den = evaluateAST(fz, { x: point.x, y: point.y, z: point.z }, angleUnit);
    if (Math.abs(den) > 1e-9) {
      evaluatedDzDx = evaluateAST(dzdxAst, { x: point.x, y: point.y, z: point.z }, angleUnit);
      evaluatedDzDy = evaluateAST(dzdyAst, { x: point.x, y: point.y, z: point.z }, angleUnit);
    }
  }

  return {
    mode,
    fxLatex: toLatex(fx),
    fyLatex: toLatex(fy),
    fzLatex: toLatex(fz),
    dzdxLatex: toLatex(dzdxAst),
    dzdyLatex: toLatex(dzdyAst),
    evaluatedDzDx,
    evaluatedDzDy,
    steps: [
      {
        id: 'imp3-1',
        rule: 'Partial Derivatives of F(x, y, z) = 0',
        description: 'Compute F_x, F_y, and F_z.',
        latex: `F_x = ${toLatex(fx)}, \\quad F_y = ${toLatex(fy)}, \\quad F_z = ${toLatex(fz)}`,
      },
      {
        id: 'imp3-2',
        rule: 'Implicit Surface Partials (3D)',
        description: 'Apply ∂z/∂x = -F_x/F_z and ∂z/∂y = -F_y/F_z for F_z ≠ 0.',
        latex: `\\frac{\\partial z}{\\partial x} = ${toLatex(dzdxAst)}, \\qquad \\frac{\\partial z}{\\partial y} = ${toLatex(
          dzdyAst
        )}`,
      },
    ],
  };
}

function substituteVars(node: ExprNode, map: Record<string, ExprNode>): ExprNode {
  switch (node.type) {
    case 'number':
    case 'constant':
      return node;
    case 'variable':
      return map[node.name] ?? node;
    case 'unary':
      return { type: 'unary', op: '-', arg: substituteVars(node.arg, map) };
    case 'binary':
      return {
        type: 'binary',
        op: node.op,
        left: substituteVars(node.left, map),
        right: substituteVars(node.right, map),
      };
    case 'func':
      return { type: 'func', name: node.name, arg: substituteVars(node.arg, map) };
  }
}

export interface ChainRuleResult {
  dfdxLatex: string;
  dfdyLatex: string;
  dxdtLatex: string;
  dydtLatex: string;
  dfdtSymbolicLatex: string;
  dfdtSymbolicPlain: string;
  evaluatedDfDt?: number;
  steps: DerivationStep[];
}

export function solveChainRuleComposition(
  fExpr: string,
  xTExpr: string,
  yTExpr: string,
  tVal?: number,
  angleUnit: AngleUnit = 'rad'
): ChainRuleResult {
  const fAst = parseExpression(fExpr);
  const xAst = parseExpression(xTExpr);
  const yAst = parseExpression(yTExpr);

  const fx = simplify(differentiate(fAst, 'x'));
  const fy = simplify(differentiate(fAst, 'y'));
  const dxdt = simplify(differentiate(xAst, 't'));
  const dydt = simplify(differentiate(yAst, 't'));

  const fxSub = simplify(substituteVars(fx, { x: xAst, y: yAst }));
  const fySub = simplify(substituteVars(fy, { x: xAst, y: yAst }));

  const dfdtAst = simplify({
    type: 'binary',
    op: '+',
    left: { type: 'binary', op: '*', left: fxSub, right: dxdt },
    right: { type: 'binary', op: '*', left: fySub, right: dydt },
  });

  const evaluatedDfDt =
    tVal !== undefined && Number.isFinite(tVal)
      ? evaluateAST(dfdtAst, { t: tVal }, angleUnit)
      : undefined;

  return {
    dfdxLatex: toLatex(fx),
    dfdyLatex: toLatex(fy),
    dxdtLatex: toLatex(dxdt),
    dydtLatex: toLatex(dydt),
    dfdtSymbolicLatex: toLatex(dfdtAst),
    dfdtSymbolicPlain: toPlain(dfdtAst),
    evaluatedDfDt,
    steps: [
      {
        id: 'ch-1',
        rule: 'Outer Function Partials',
        description: 'Differentiate f(x, y) with respect to x and y.',
        latex: `\\frac{\\partial f}{\\partial x} = ${toLatex(fx)}, \\qquad \\frac{\\partial f}{\\partial y} = ${toLatex(
          fy
        )}`,
      },
      {
        id: 'ch-2',
        rule: 'Parameter Derivatives',
        description: 'Differentiate x(t) and y(t) with respect to t.',
        latex: `\\frac{dx}{dt} = ${toLatex(dxdt)}, \\qquad \\frac{dy}{dt} = ${toLatex(dydt)}`,
      },
      {
        id: 'ch-3',
        rule: 'Multivariable Chain Rule',
        description: 'Substitute x(t), y(t) and combine df/dt = (∂f/∂x)(dx/dt) + (∂f/∂y)(dy/dt).',
        latex: `\\frac{df}{dt} = ${toLatex(dfdtAst)}`,
      },
    ],
  };
}

export interface TotalDerivativeResult {
  dfLatex: string;
  evaluatedDf?: number;
  steps: DerivationStep[];
}

export function solveTotalDerivative(
  fExpr: string,
  point: { x: number; y: number; z?: number },
  diffs: { dx: number; dy: number; dz?: number },
  is3D = false,
  angleUnit: AngleUnit = 'rad'
): TotalDerivativeResult {
  const fAst = parseExpression(fExpr);
  const fx = simplify(differentiate(fAst, 'x'));
  const fy = simplify(differentiate(fAst, 'y'));
  const fz = is3D ? simplify(differentiate(fAst, 'z')) : null;

  const scope = is3D
    ? { x: point.x, y: point.y, z: point.z ?? 0 }
    : { x: point.x, y: point.y, z: 0 };

  const fxVal = evaluateAST(fx, scope, angleUnit);
  const fyVal = evaluateAST(fy, scope, angleUnit);
  const fzVal = fz ? evaluateAST(fz, scope, angleUnit) : 0;

  const evaluatedDf = fxVal * diffs.dx + fyVal * diffs.dy + (is3D ? fzVal * (diffs.dz ?? 0) : 0);

  const dfLatex = is3D
    ? `df = \\left(${toLatex(fx)}\\right)dx + \\left(${toLatex(fy)}\\right)dy + \\left(${toLatex(
        fz!
      )}\\right)dz`
    : `df = \\left(${toLatex(fx)}\\right)dx + \\left(${toLatex(fy)}\\right)dy`;

  return {
    dfLatex,
    evaluatedDf,
    steps: [
      {
        id: 'td-1',
        rule: 'Total Differential Formula',
        description: 'Express df as the linear combination of partial derivatives and coordinate differentials.',
        latex: dfLatex,
      },
      {
        id: 'td-2',
        rule: 'Numerical Evaluation',
        description: `Evaluate partials at point and multiply by (dx, dy${is3D ? ', dz' : ''}).`,
        latex: `df \\approx ${Number(evaluatedDf.toFixed(6))}`,
      },
    ],
  };
}

// ============================================================
// C. SURFACE NORMAL VECTORS & POTENTIAL FUNCTIONS
// ============================================================
export interface SurfaceNormalResult {
  normalSymbolicLatex: string;
  normalVector: [number, number, number];
  unitNormal: [number, number, number];
  tangentPlaneLatex: string;
  steps: DerivationStep[];
}

export function solveSurfaceNormal(
  exprStr: string,
  mode: 'explicit' | 'implicit',
  point: { x: number; y: number; z?: number },
  angleUnit: AngleUnit = 'rad'
): SurfaceNormalResult {
  const ast = parseExpression(exprStr);
  const fx = simplify(differentiate(ast, 'x'));
  const fy = simplify(differentiate(ast, 'y'));
  const fz = simplify(differentiate(ast, 'z'));

  if (mode === 'explicit') {
    const z0 = evaluateAST(ast, { x: point.x, y: point.y }, angleUnit);
    const fxVal = evaluateAST(fx, { x: point.x, y: point.y }, angleUnit);
    const fyVal = evaluateAST(fy, { x: point.x, y: point.y }, angleUnit);
    const nx = -fxVal;
    const ny = -fyVal;
    const nz = 1;
    const norm = Math.hypot(nx, ny, nz);
    const unitNormal: [number, number, number] = [nx / norm, ny / norm, nz / norm];
    const normalSymbolicLatex = `\\mathbf{N} = \\left\\langle -\\left(${toLatex(
      fx
    )}\\right),\\; -\\left(${toLatex(fy)}\\right),\\; 1 \\right\\rangle`;

    const tangentPlaneLatex = `${Number(nx.toFixed(4))}(x - ${point.x}) + ${Number(
      ny.toFixed(4)
    )}(y - ${point.y}) + (z - ${Number(z0.toFixed(4))}) = 0`;

    return {
      normalSymbolicLatex,
      normalVector: [nx, ny, nz],
      unitNormal,
      tangentPlaneLatex,
      steps: [
        {
          id: 'sn-1',
          rule: 'Rewrite z = f(x, y) as F(x, y, z) = z − f(x, y) = 0',
          description: 'Surface normal is N = ⟨-f_x, -f_y, 1⟩.',
          latex: normalSymbolicLatex,
        },
        {
          id: 'sn-2',
          rule: 'Evaluate Normal & Unit Normal n̂ = N / ||N||',
          description: `Evaluated at (${point.x}, ${point.y}, ${Number(z0.toFixed(4))}).`,
          latex: `\\mathbf{N} = \\langle ${Number(nx.toFixed(4))},\\; ${Number(
            ny.toFixed(4)
          )},\\; 1 \\rangle, \\quad \\hat{\\mathbf{n}} = \\langle ${unitNormal
            .map((v) => Number(v.toFixed(4)))
            .join(',\\; ')} \\rangle`,
        },
      ],
    };
  }

  const z0 = point.z ?? 0;
  const scope = { x: point.x, y: point.y, z: z0 };
  const nx = evaluateAST(fx, scope, angleUnit);
  const ny = evaluateAST(fy, scope, angleUnit);
  const nz = evaluateAST(fz, scope, angleUnit);
  const norm = Math.hypot(nx, ny, nz) || 1;
  const unitNormal: [number, number, number] = [nx / norm, ny / norm, nz / norm];
  const normalSymbolicLatex = `\\mathbf{N} = \\nabla F = \\left\\langle ${toLatex(fx)},\\; ${toLatex(
    fy
  )},\\; ${toLatex(fz)} \\right\\rangle`;
  const tangentPlaneLatex = `${Number(nx.toFixed(4))}(x - ${point.x}) + ${Number(
    ny.toFixed(4)
  )}(y - ${point.y}) + ${Number(nz.toFixed(4))}(z - ${z0}) = 0`;

  return {
    normalSymbolicLatex,
    normalVector: [nx, ny, nz],
    unitNormal,
    tangentPlaneLatex,
    steps: [
      {
        id: 'sni-1',
        rule: 'Level Surface Gradient Normal N = ∇F',
        description: 'For F(x, y, z) = c, the gradient vector ∇F is orthogonal to the surface.',
        latex: normalSymbolicLatex,
      },
      {
        id: 'sni-2',
        rule: 'Evaluate Normal & Unit Normal',
        description: `Evaluated at (${point.x}, ${point.y}, ${z0}).`,
        latex: `\\mathbf{N} = \\langle ${Number(nx.toFixed(4))},\\; ${Number(
          ny.toFixed(4)
        )},\\; ${Number(nz.toFixed(4))} \\rangle, \\quad \\hat{\\mathbf{n}} = \\langle ${unitNormal
          .map((v) => Number(v.toFixed(4)))
          .join(',\\; ')} \\rangle`,
      },
    ],
  };
}

export interface VectorPotentialResult {
  isConservative: boolean;
  curlTestLatex: string;
  potentialValueAtPoint?: number;
  gradientCheck?: number[];
  steps: DerivationStep[];
}

export function solveVectorPotential(
  pExpr: string,
  qExpr: string,
  rExpr: string | undefined,
  is3D: boolean,
  testPoint: { x: number; y: number; z?: number } = { x: 1, y: 1, z: 1 },
  angleUnit: AngleUnit = 'rad'
): VectorPotentialResult {
  const pAst = parseExpression(pExpr);
  const qAst = parseExpression(qExpr);
  const rAst = is3D && rExpr ? parseExpression(rExpr) : null;

  const py = simplify(differentiate(pAst, 'y'));
  const qx = simplify(differentiate(qAst, 'x'));
  const curlZ = simplify({ type: 'binary', op: '-', left: qx, right: py });

  const samplePts = [
    { x: 0.4, y: 0.7, z: 0.5 },
    { x: -0.6, y: 1.1, z: -0.3 },
    { x: 1.3, y: -0.8, z: 0.9 },
  ];

  let isConservative = true;
  let curlTestLatex = '';

  if (!is3D) {
    for (const pt of samplePts) {
      const diff = evaluateAST(curlZ, pt, angleUnit);
      if (!Number.isFinite(diff) || Math.abs(diff) > 1e-6) {
        isConservative = false;
        break;
      }
    }
    curlTestLatex = `\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y} = ${toLatex(
      curlZ
    )}`;
  } else if (rAst) {
    const pz = simplify(differentiate(pAst, 'z'));
    const qz = simplify(differentiate(qAst, 'z'));
    const rx = simplify(differentiate(rAst, 'x'));
    const ry = simplify(differentiate(rAst, 'y'));

    const curlX = simplify({ type: 'binary', op: '-', left: ry, right: qz });
    const curlY = simplify({ type: 'binary', op: '-', left: pz, right: rx });

    for (const pt of samplePts) {
      const cx = evaluateAST(curlX, pt, angleUnit);
      const cy = evaluateAST(curlY, pt, angleUnit);
      const cz = evaluateAST(curlZ, pt, angleUnit);
      if (Math.hypot(cx, cy, cz) > 1e-6) {
        isConservative = false;
        break;
      }
    }
    curlTestLatex = `\\nabla \\times \\mathbf{F} = \\left\\langle ${toLatex(curlX)},\\; ${toLatex(
      curlY
    )},\\; ${toLatex(curlZ)} \\right\\rangle`;
  }

  if (!isConservative) {
    return {
      isConservative: false,
      curlTestLatex,
      steps: [
        {
          id: 'pot-1',
          rule: 'Curl Test for Conservativeness',
          description: 'A vector field is conservative only if curl(F) = 0 everywhere on a simply connected domain.',
          latex: `${curlTestLatex} \\neq \\mathbf{0}`,
        },
        {
          id: 'pot-2',
          rule: 'Conclusion',
          description: 'Non-zero curl detected — no scalar potential φ satisfies ∇φ = F.',
          latex: '\\text{No potential function } \\varphi \\text{ exists.}',
        },
      ],
    };
  }

  // Reconstruct scalar potential difference φ(P) - φ(0) via piecewise path integration
  const px = testPoint.x;
  const pyVal = testPoint.y;
  const pzVal = testPoint.z ?? 0;

  let phiVal = integrate1DComposite(
    (t) => evaluateAST(pAst, { x: t, y: 0, z: 0 }, angleUnit),
    0,
    px,
    6
  );
  phiVal += integrate1DComposite(
    (t) => evaluateAST(qAst, { x: px, y: t, z: 0 }, angleUnit),
    0,
    pyVal,
    6
  );
  if (is3D && rAst) {
    phiVal += integrate1DComposite(
      (t) => evaluateAST(rAst, { x: px, y: pyVal, z: t }, angleUnit),
      0,
      pzVal,
      6
    );
  }

  const gradCheck = [
    evaluateAST(pAst, { x: px, y: pyVal, z: pzVal }, angleUnit),
    evaluateAST(qAst, { x: px, y: pyVal, z: pzVal }, angleUnit),
  ];
  if (is3D && rAst) {
    gradCheck.push(evaluateAST(rAst, { x: px, y: pyVal, z: pzVal }, angleUnit));
  }

  return {
    isConservative: true,
    curlTestLatex,
    potentialValueAtPoint: phiVal,
    gradientCheck: gradCheck,
    steps: [
      {
        id: 'pot-1',
        rule: 'Conservative Field Verification',
        description: 'Partial derivatives match (curl(F) = 0), so F = ∇φ for a scalar potential φ.',
        latex: `${curlTestLatex} = 0`,
      },
      {
        id: 'pot-2',
        rule: 'Path-Independent Potential Reconstruction',
        description:
          'Integrate along coordinate segments from the origin: φ(x,y) = ∫₀ˣ P(t,0)dt + ∫₀ʸ Q(x,t)dt (+ ∫₀ᶻ R(x,y,t)dt).',
        latex: `\\varphi${
          is3D ? `(${px},${pyVal},${pzVal})` : `(${px},${pyVal})`
        } - \\varphi(\\mathbf{0}) = ${Number(phiVal.toFixed(6))}`,
      },
    ],
  };
}

// ============================================================
// D. VECTOR CALCULUS THEOREMS (GREEN'S, STOKES', DIVERGENCE)
// ============================================================
export interface TheoremVerificationResult {
  theorem: 'greens' | 'stokes' | 'divergence';
  lhsValue: number;
  rhsValue: number;
  difference: number;
  verified: boolean;
  lhsLatex: string;
  rhsLatex: string;
  steps: DerivationStep[];
}

export function verifyGreensTheorem(
  pExpr: string,
  qExpr: string,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  angleUnit: AngleUnit = 'rad'
): TheoremVerificationResult {
  const pAst = parseExpression(pExpr);
  const qAst = parseExpression(qExpr);
  const qxAst = simplify(differentiate(qAst, 'x'));
  const pyAst = simplify(differentiate(pAst, 'y'));
  const curlAst = simplify({ type: 'binary', op: '-', left: qxAst, right: pyAst });

  // LHS: Counterclockwise line integral around rectangle [xMin,xMax] x [yMin,yMax]
  const bottom = integrate1DComposite((x) => evaluateAST(pAst, { x, y: yMin }, angleUnit), xMin, xMax, 6);
  const right = integrate1DComposite((y) => evaluateAST(qAst, { x: xMax, y }, angleUnit), yMin, yMax, 6);
  const top = -integrate1DComposite((x) => evaluateAST(pAst, { x, y: yMax }, angleUnit), xMin, xMax, 6);
  const left = -integrate1DComposite((y) => evaluateAST(qAst, { x: xMin, y }, angleUnit), yMin, yMax, 6);
  const lhsValue = bottom + right + top + left;

  // RHS: Double integral of (∂Q/∂x - ∂P/∂y) dA
  const rhsValue = integrate1DComposite(
    (x) =>
      integrate1DComposite((y) => evaluateAST(curlAst, { x, y }, angleUnit), yMin, yMax, 4),
    xMin,
    xMax,
    4
  );

  const difference = Math.abs(lhsValue - rhsValue);
  const verified = difference < 1e-4;

  return {
    theorem: 'greens',
    lhsValue,
    rhsValue,
    difference,
    verified,
    lhsLatex: `\\oint_{\\partial R} \\left(${toLatex(pAst)}\\,dx + ${toLatex(
      qAst
    )}\\,dy\\right) \\approx ${Number(lhsValue.toFixed(6))}`,
    rhsLatex: `\\iint_R \\left(${toLatex(curlAst)}\\right) dA \\approx ${Number(rhsValue.toFixed(6))}`,
    steps: [
      {
        id: 'gr-1',
        rule: 'Scalar 2D Curl (∂Q/∂x − ∂P/∂y)',
        description: 'Compute partial derivatives for the interior double integrand.',
        latex: `\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y} = ${toLatex(
          qxAst
        )} - \\left(${toLatex(pyAst)}\\right) = ${toLatex(curlAst)}`,
      },
      {
        id: 'gr-2',
        rule: 'Boundary Circulation (LHS)',
        description: `Sum counterclockwise line integrals along all 4 edges of [${xMin}, ${xMax}] × [${yMin}, ${yMax}].`,
        latex: `\\oint_{\\partial R} \\mathbf{F}\\cdot d\\mathbf{r} = ${Number(lhsValue.toFixed(6))}`,
      },
      {
        id: 'gr-3',
        rule: 'Interior Area Flux of Curl (RHS)',
        description: 'Compare interior double integral with boundary circulation.',
        latex: `\\iint_R (Q_x - P_y)\\,dA = ${Number(rhsValue.toFixed(6))} \\quad (|\\Delta| = ${difference.toExponential(2)})`,
      },
    ],
  };
}

export function verifyStokesTheorem(
  pExpr: string,
  qExpr: string,
  rExpr: string,
  surfGExpr: string,
  radius: number,
  angleUnit: AngleUnit = 'rad'
): TheoremVerificationResult {
  const pAst = parseExpression(pExpr);
  const qAst = parseExpression(qExpr);
  const rAst = parseExpression(rExpr);
  const gAst = parseExpression(surfGExpr);

  const gxAst = simplify(differentiate(gAst, 'x'));
  const gyAst = simplify(differentiate(gAst, 'y'));

  const curlXAst = simplify({
    type: 'binary',
    op: '-',
    left: differentiate(rAst, 'y'),
    right: differentiate(qAst, 'z'),
  });
  const curlYAst = simplify({
    type: 'binary',
    op: '-',
    left: differentiate(pAst, 'z'),
    right: differentiate(rAst, 'x'),
  });
  const curlZAst = simplify({
    type: 'binary',
    op: '-',
    left: differentiate(qAst, 'x'),
    right: differentiate(pAst, 'y'),
  });

  // Boundary curve C: x = R cos t, y = R sin t, z = g(x, y), t ∈ [0, 2π]
  const tMax = angleUnit === 'deg' ? 360 : 2 * Math.PI;
  const toRad = (t: number) => (angleUnit === 'deg' ? (t * Math.PI) / 180 : t);
  const lhsValue = integrate1DComposite(
    (t) => {
      const th = toRad(t);
      const x = radius * Math.cos(th);
      const y = radius * Math.sin(th);
      const z = evaluateAST(gAst, { x, y }, angleUnit);
      const dx = -radius * Math.sin(th) * (angleUnit === 'deg' ? Math.PI / 180 : 1);
      const dy = radius * Math.cos(th) * (angleUnit === 'deg' ? Math.PI / 180 : 1);
      const gx = evaluateAST(gxAst, { x, y }, angleUnit);
      const gy = evaluateAST(gyAst, { x, y }, angleUnit);
      const dz = gx * dx + gy * dy;
      const P = evaluateAST(pAst, { x, y, z }, angleUnit);
      const Q = evaluateAST(qAst, { x, y, z }, angleUnit);
      const R = evaluateAST(rAst, { x, y, z }, angleUnit);
      return P * dx + Q * dy + R * dz;
    },
    0,
    tMax,
    8
  );

  // Surface integral over disk x^2 + y^2 <= R^2 using polar (r, theta)
  const rhsValue = integrate1DComposite(
    (t) =>
      integrate1DComposite(
        (rad) => {
          const th = toRad(t);
          const x = rad * Math.cos(th);
          const y = rad * Math.sin(th);
          const z = evaluateAST(gAst, { x, y }, angleUnit);
          const gx = evaluateAST(gxAst, { x, y }, angleUnit);
          const gy = evaluateAST(gyAst, { x, y }, angleUnit);
          const cx = evaluateAST(curlXAst, { x, y, z }, angleUnit);
          const cy = evaluateAST(curlYAst, { x, y, z }, angleUnit);
          const cz = evaluateAST(curlZAst, { x, y, z }, angleUnit);
          return (cx * -gx + cy * -gy + cz) * rad * (angleUnit === 'deg' ? Math.PI / 180 : 1);
        },
        0,
        radius,
        4
      ),
    0,
    tMax,
    6
  );

  const difference = Math.abs(lhsValue - rhsValue);
  const verified = difference < 1e-3;

  return {
    theorem: 'stokes',
    lhsValue,
    rhsValue,
    difference,
    verified,
    lhsLatex: `\\oint_{\\partial S} \\mathbf{F}\\cdot d\\mathbf{r} \\approx ${Number(lhsValue.toFixed(6))}`,
    rhsLatex: `\\iint_S (\\nabla\\times\\mathbf{F})\\cdot d\\mathbf{S} \\approx ${Number(
      rhsValue.toFixed(6)
    )}`,
    steps: [
      {
        id: 'st-1',
        rule: '3D Curl ∇ × F',
        description: 'Compute all three curl components symbolically.',
        latex: `\\nabla \\times \\mathbf{F} = \\left\\langle ${toLatex(curlXAst)},\\; ${toLatex(
          curlYAst
        )},\\; ${toLatex(curlZAst)} \\right\\rangle`,
      },
      {
        id: 'st-2',
        rule: 'Boundary Loop Circulation (LHS)',
        description: `Integrate F·dr along circular boundary r = ${radius} lifted onto z = ${toPlain(gAst)}.`,
        latex: `\\oint_{\\partial S} \\mathbf{F}\\cdot d\\mathbf{r} = ${Number(lhsValue.toFixed(6))}`,
      },
      {
        id: 'st-3',
        rule: 'Surface Curl Flux (RHS)',
        description: 'Evaluate ∬ (∇ × F) · ⟨-g_x, -g_y, 1⟩ dA over the disk.',
        latex: `\\iint_S (\\nabla\\times\\mathbf{F})\\cdot d\\mathbf{S} = ${Number(
          rhsValue.toFixed(6)
        )} \\quad (|\\Delta| = ${difference.toExponential(2)})`,
      },
    ],
  };
}

export function verifyDivergenceTheorem(
  pExpr: string,
  qExpr: string,
  rExpr: string,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  zMin: number,
  zMax: number,
  angleUnit: AngleUnit = 'rad'
): TheoremVerificationResult {
  const pAst = parseExpression(pExpr);
  const qAst = parseExpression(qExpr);
  const rAst = parseExpression(rExpr);

  const pxAst = simplify(differentiate(pAst, 'x'));
  const qyAst = simplify(differentiate(qAst, 'y'));
  const rzAst = simplify(differentiate(rAst, 'z'));
  const divAst = simplify({
    type: 'binary',
    op: '+',
    left: { type: 'binary', op: '+', left: pxAst, right: qyAst },
    right: rzAst,
  });

  // LHS: Outward flux across 6 rectangular faces of the box
  const fluxX = integrate1DComposite(
    (y) =>
      integrate1DComposite(
        (z) =>
          evaluateAST(pAst, { x: xMax, y, z }, angleUnit) -
          evaluateAST(pAst, { x: xMin, y, z }, angleUnit),
        zMin,
        zMax,
        3
      ),
    yMin,
    yMax,
    3
  );
  const fluxY = integrate1DComposite(
    (x) =>
      integrate1DComposite(
        (z) =>
          evaluateAST(qAst, { x, y: yMax, z }, angleUnit) -
          evaluateAST(qAst, { x, y: yMin, z }, angleUnit),
        zMin,
        zMax,
        3
      ),
    xMin,
    xMax,
    3
  );
  const fluxZ = integrate1DComposite(
    (x) =>
      integrate1DComposite(
        (y) =>
          evaluateAST(rAst, { x, y, z: zMax }, angleUnit) -
          evaluateAST(rAst, { x, y, z: zMin }, angleUnit),
        yMin,
        yMax,
        3
      ),
    xMin,
    xMax,
    3
  );
  const lhsValue = fluxX + fluxY + fluxZ;

  // RHS: Triple integral of div(F) over [xMin,xMax] x [yMin,yMax] x [zMin,zMax]
  const rhsValue = integrate1DComposite(
    (x) =>
      integrate1DComposite(
        (y) =>
          integrate1DComposite(
            (z) => evaluateAST(divAst, { x, y, z }, angleUnit),
            zMin,
            zMax,
            2
          ),
        yMin,
        yMax,
        2
      ),
    xMin,
    xMax,
    2
  );

  const difference = Math.abs(lhsValue - rhsValue);
  const verified = difference < 1e-4;

  return {
    theorem: 'divergence',
    lhsValue,
    rhsValue,
    difference,
    verified,
    lhsLatex: `\\oiint_{\\partial B} \\mathbf{F}\\cdot d\\mathbf{S} \\approx ${Number(
      lhsValue.toFixed(6)
    )}`,
    rhsLatex: `\\iiint_B \\left(${toLatex(divAst)}\\right) dV \\approx ${Number(rhsValue.toFixed(6))}`,
    steps: [
      {
        id: 'div-1',
        rule: 'Divergence ∇ · F',
        description: 'Compute P_x + Q_y + R_z symbolically.',
        latex: `\\nabla \\cdot \\mathbf{F} = ${toLatex(divAst)}`,
      },
      {
        id: 'div-2',
        rule: 'Closed Box Outward Flux (LHS)',
        description: `Sum outward flux across all 6 faces of [${xMin},${xMax}]×[${yMin},${yMax}]×[${zMin},${zMax}].`,
        latex: `\\Phi_x + \\Phi_y + \\Phi_z = ${Number(fluxX.toFixed(4))} + ${Number(
          fluxY.toFixed(4)
        )} + ${Number(fluxZ.toFixed(4))} = ${Number(lhsValue.toFixed(6))}`,
      },
      {
        id: 'div-3',
        rule: 'Volume Integral Verification (RHS)',
        description: 'Compare ∭ (∇ · F) dV with closed surface flux.',
        latex: `\\iiint_B (\\nabla\\cdot\\mathbf{F})\\,dV = ${Number(
          rhsValue.toFixed(6)
        )} \\quad (|\\Delta| = ${difference.toExponential(2)})`,
      },
    ],
  };
}

// ============================================================
// E. GLOBAL OPTIMIZATION & LAGRANGE MULTIPLIERS
// ============================================================
export interface GlobalCandidate {
  x: number;
  y: number;
  value: number;
  location: 'Interior' | 'Boundary' | 'Corner';
}

export interface GlobalOptimizationResult {
  globalMax: GlobalCandidate;
  globalMin: GlobalCandidate;
  candidates: GlobalCandidate[];
  steps: DerivationStep[];
}

export function solveGlobalOptimization(
  exprStr: string,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  angleUnit: AngleUnit = 'rad'
): GlobalOptimizationResult {
  const ast = parseExpression(exprStr);
  const fxAst = simplify(differentiate(ast, 'x'));
  const fyAst = simplify(differentiate(ast, 'y'));
  const fxxAst = simplify(differentiate(fxAst, 'x'));
  const fxyAst = simplify(differentiate(fxAst, 'y'));
  const fyyAst = simplify(differentiate(fyAst, 'y'));

  const candidates: GlobalCandidate[] = [];
  const addUnique = (x: number, y: number, location: GlobalCandidate['location']) => {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < xMin - 1e-6 ||
      x > xMax + 1e-6 ||
      y < yMin - 1e-6 ||
      y > yMax + 1e-6
    ) {
      return;
    }
    const cx = Math.max(xMin, Math.min(xMax, Number(x.toFixed(5))));
    const cy = Math.max(yMin, Math.min(yMax, Number(y.toFixed(5))));
    if (candidates.some((c) => Math.hypot(c.x - cx, c.y - cy) < 1e-3)) return;
    try {
      const value = evaluateAST(ast, { x: cx, y: cy, z: 0 }, angleUnit);
      if (Number.isFinite(value)) {
        candidates.push({ x: cx, y: cy, value, location });
      }
    } catch {
      // ignore
    }
  };

  // 1. Corners
  addUnique(xMin, yMin, 'Corner');
  addUnique(xMin, yMax, 'Corner');
  addUnique(xMax, yMin, 'Corner');
  addUnique(xMax, yMax, 'Corner');

  // 2. Interior critical points via multi-start 2D Newton
  const seeds = 5;
  for (let i = 0; i <= seeds; i++) {
    for (let j = 0; j <= seeds; j++) {
      let x = xMin + (i / seeds) * (xMax - xMin);
      let y = yMin + (j / seeds) * (yMax - yMin);
      for (let it = 0; it < 20; it++) {
        try {
          const gx = evaluateAST(fxAst, { x, y }, angleUnit);
          const gy = evaluateAST(fyAst, { x, y }, angleUnit);
          if (Math.hypot(gx, gy) < 1e-8) {
            addUnique(x, y, 'Interior');
            break;
          }
          const h11 = evaluateAST(fxxAst, { x, y }, angleUnit);
          const h12 = evaluateAST(fxyAst, { x, y }, angleUnit);
          const h22 = evaluateAST(fyyAst, { x, y }, angleUnit);
          const det = h11 * h22 - h12 * h12;
          if (Math.abs(det) < 1e-10) break;
          const dx = (h22 * gx - h12 * gy) / det;
          const dy = (-h12 * gx + h11 * gy) / det;
          x -= Math.max(-0.5, Math.min(0.5, dx));
          y -= Math.max(-0.5, Math.min(0.5, dy));
        } catch {
          break;
        }
      }
    }
  }

  // 3. 1D Critical points & dense scan along all 4 boundaries
  const scanEdge = (isXFixed: boolean, fixedVal: number, start: number, end: number) => {
    const N = 40;
    for (let k = 0; k <= N; k++) {
      const t = start + (k / N) * (end - start);
      let cur = t;
      for (let it = 0; it < 12; it++) {
        const pt = isXFixed ? { x: fixedVal, y: cur } : { x: cur, y: fixedVal };
        const grad = evaluateAST(isXFixed ? fyAst : fxAst, pt, angleUnit);
        const hess = evaluateAST(isXFixed ? fyyAst : fxxAst, pt, angleUnit);
        if (Math.abs(grad) < 1e-7) {
          addUnique(pt.x, pt.y, 'Boundary');
          break;
        }
        if (Math.abs(hess) < 1e-9) break;
        cur -= Math.max(-0.4, Math.min(0.4, grad / hess));
      }
    }
  };

  scanEdge(true, xMin, yMin, yMax);
  scanEdge(true, xMax, yMin, yMax);
  scanEdge(false, yMin, xMin, xMax);
  scanEdge(false, yMax, xMin, xMax);

  // Also sample grid fallback in case objective is non-smooth
  for (let i = 0; i <= 12; i++) {
    for (let j = 0; j <= 12; j++) {
      const gx = xMin + (i / 12) * (xMax - xMin);
      const gy = yMin + (j / 12) * (yMax - yMin);
      try {
        const val = evaluateAST(ast, { x: gx, y: gy, z: 0 }, angleUnit);
        if (Number.isFinite(val)) {
          if (
            candidates.length === 0 ||
            val > Math.max(...candidates.map((c) => c.value)) ||
            val < Math.min(...candidates.map((c) => c.value))
          ) {
            addUnique(gx, gy, i === 0 || i === 12 || j === 0 || j === 12 ? 'Boundary' : 'Interior');
          }
        }
      } catch {
        // ignore
      }
    }
  }

  candidates.sort((a, b) => b.value - a.value);
  const globalMax = candidates[0];
  const globalMin = candidates[candidates.length - 1];

  return {
    globalMax,
    globalMin,
    candidates,
    steps: [
      {
        id: 'opt-1',
        rule: 'Interior Critical Points (∇f = 0)',
        description: `Solved f_x = ${toPlain(fxAst)} = 0 and f_y = ${toPlain(fyAst)} = 0 on [${xMin},${xMax}]×[${yMin},${yMax}].`,
        latex: `\\nabla f = \\left\\langle ${toLatex(fxAst)},\\; ${toLatex(fyAst)} \\right\\rangle = \\mathbf{0}`,
      },
      {
        id: 'opt-2',
        rule: 'Boundary & Corner Extrema Scan',
        description: `Evaluated 1D critical points along all 4 edges and 4 vertices (${candidates.length} candidates).`,
        latex: `f_{\\max}(${globalMax.x}, ${globalMax.y}) = ${Number(
          globalMax.value.toFixed(5)
        )}, \\quad f_{\\min}(${globalMin.x}, ${globalMin.y}) = ${Number(globalMin.value.toFixed(5))}`,
      },
    ],
  };
}

export interface LagrangeCandidate {
  x: number;
  y: number;
  lambda: number;
  value: number;
  kind: 'Constrained Maximum' | 'Constrained Minimum' | 'Stationary Point';
}

export function solveLagrangeMultipliers(
  fExpr: string,
  gExpr: string,
  constraintC: number,
  rangeX: [number, number] = [-5, 5],
  rangeY: [number, number] = [-5, 5],
  angleUnit: AngleUnit = 'rad'
): { candidates: LagrangeCandidate[]; steps: DerivationStep[] } {
  const fAst = parseExpression(fExpr);
  const gAst = parseExpression(gExpr);
  const fxAst = simplify(differentiate(fAst, 'x'));
  const fyAst = simplify(differentiate(fAst, 'y'));
  const gxAst = simplify(differentiate(gAst, 'x'));
  const gyAst = simplify(differentiate(gAst, 'y'));
  const fxxAst = simplify(differentiate(fxAst, 'x'));
  const fxyAst = simplify(differentiate(fxAst, 'y'));
  const fyyAst = simplify(differentiate(fyAst, 'y'));
  const gxxAst = simplify(differentiate(gxAst, 'x'));
  const gxyAst = simplify(differentiate(gxAst, 'y'));
  const gyyAst = simplify(differentiate(gyAst, 'y'));

  // Search grid for contour cells where g(x,y) - c changes sign, then run 3D Newton on [fx-λgx, fy-λgy, g-c]
  const [xMin, xMax] = rangeX;
  const [yMin, yMax] = rangeY;
  const N = 26;
  const seeds: { x: number; y: number }[] = [];

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x0 = xMin + (i / N) * (xMax - xMin);
      const x1 = xMin + ((i + 1) / N) * (xMax - xMin);
      const y0 = yMin + (j / N) * (yMax - yMin);
      const y1 = yMin + ((j + 1) / N) * (yMax - yMin);
      try {
        const g00 = evaluateAST(gAst, { x: x0, y: y0 }, angleUnit) - constraintC;
        const g10 = evaluateAST(gAst, { x: x1, y: y0 }, angleUnit) - constraintC;
        const g01 = evaluateAST(gAst, { x: x0, y: y1 }, angleUnit) - constraintC;
        const g11 = evaluateAST(gAst, { x: x1, y: y1 }, angleUnit) - constraintC;
        const minG = Math.min(g00, g10, g01, g11);
        const maxG = Math.max(g00, g10, g01, g11);
        if (minG <= 0 && maxG >= 0) {
          seeds.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
        }
      } catch {
        // ignore
      }
    }
  }

  const found: { x: number; y: number; lambda: number; value: number }[] = [];

  for (const seed of seeds) {
    let x = seed.x;
    let y = seed.y;
    // Initial lambda estimate from (∇f · ∇g) / ||∇g||^2
    let lam = 0;
    try {
      const fx0 = evaluateAST(fxAst, { x, y }, angleUnit);
      const fy0 = evaluateAST(fyAst, { x, y }, angleUnit);
      const gx0 = evaluateAST(gxAst, { x, y }, angleUnit);
      const gy0 = evaluateAST(gyAst, { x, y }, angleUnit);
      const n2 = gx0 * gx0 + gy0 * gy0;
      if (n2 > 1e-8) lam = (fx0 * gx0 + fy0 * gy0) / n2;
    } catch {
      continue;
    }

    for (let it = 0; it < 25; it++) {
      try {
        const fx = evaluateAST(fxAst, { x, y }, angleUnit);
        const fy = evaluateAST(fyAst, { x, y }, angleUnit);
        const gx = evaluateAST(gxAst, { x, y }, angleUnit);
        const gy = evaluateAST(gyAst, { x, y }, angleUnit);
        const gc = evaluateAST(gAst, { x, y }, angleUnit) - constraintC;

        const r1 = fx - lam * gx;
        const r2 = fy - lam * gy;
        const r3 = gc;
        if (Math.hypot(r1, r2, r3) < 1e-8) {
          if (x >= xMin - 0.1 && x <= xMax + 0.1 && y >= yMin - 0.1 && y <= yMax + 0.1) {
            const cx = Math.abs(x) < 1e-6 ? 0 : Number(x.toFixed(5));
            const cy = Math.abs(y) < 1e-6 ? 0 : Number(y.toFixed(5));
            const cl = Math.abs(lam) < 1e-6 ? 0 : Number(lam.toFixed(5));
            if (!found.some((pt) => Math.hypot(pt.x - cx, pt.y - cy) < 1e-3)) {
              const val = evaluateAST(fAst, { x: cx, y: cy }, angleUnit);
              if (Number.isFinite(val)) {
                found.push({ x: cx, y: cy, lambda: cl, value: val });
              }
            }
          }
          break;
        }

        const fxx = evaluateAST(fxxAst, { x, y }, angleUnit);
        const fxy = evaluateAST(fxyAst, { x, y }, angleUnit);
        const fyy = evaluateAST(fyyAst, { x, y }, angleUnit);
        const gxx = evaluateAST(gxxAst, { x, y }, angleUnit);
        const gxy = evaluateAST(gxyAst, { x, y }, angleUnit);
        const gyy = evaluateAST(gyyAst, { x, y }, angleUnit);

        // 3x3 Jacobian matrix M for [x, y, lam]
        const M = [
          [fxx - lam * gxx, fxy - lam * gxy, -gx],
          [fxy - lam * gxy, fyy - lam * gyy, -gy],
          [gx, gy, 0],
        ];
        const rhs = [-r1, -r2, -r3];
        const delta = solve3x3(M, rhs);
        if (!delta) break;
        const stepNorm = Math.hypot(delta[0], delta[1], delta[2]);
        const scale = stepNorm > 0.6 ? 0.6 / stepNorm : 1;
        x += delta[0] * scale;
        y += delta[1] * scale;
        lam += delta[2] * scale;
      } catch {
        break;
      }
    }
  }

  if (found.length === 0) {
    throw new Error(
      `No Lagrange stationary points found on [${xMin},${xMax}]×[${yMin},${yMax}] for constraint ${gExpr} = ${constraintC}.`
    );
  }

  const maxVal = Math.max(...found.map((p) => p.value));
  const minVal = Math.min(...found.map((p) => p.value));

  const candidates: LagrangeCandidate[] = found
    .sort((a, b) => b.value - a.value)
    .map((pt) => ({
      ...pt,
      kind:
        Math.abs(pt.value - maxVal) < 1e-4 && Math.abs(maxVal - minVal) > 1e-4
          ? 'Constrained Maximum'
          : Math.abs(pt.value - minVal) < 1e-4 && Math.abs(maxVal - minVal) > 1e-4
          ? 'Constrained Minimum'
          : 'Stationary Point',
    }));

  return {
    candidates,
    steps: [
      {
        id: 'lag-1',
        rule: 'Lagrange Multiplier System ∇f = λ∇g',
        description: `Set up ∇f(x, y) = λ∇g(x, y) subject to g(x, y) = ${constraintC}.`,
        latex: `\\left\\langle ${toLatex(fxAst)},\\; ${toLatex(
          fyAst
        )} \\right\\rangle = \\lambda\\left\\langle ${toLatex(gxAst)},\\; ${toLatex(
          gyAst
        )} \\right\\rangle, \\quad ${toLatex(gAst)} = ${constraintC}`,
      },
      {
        id: 'lag-2',
        rule: 'Constrained Critical Points Found',
        description: `Solved the nonlinear system via contour seeding and Newton-Raphson (${candidates.length} point${
          candidates.length === 1 ? '' : 's'
        }).`,
        latex: candidates
          .map(
            (c) =>
              `(${c.x}, ${c.y}),\\; \\lambda=${c.lambda} \\implies f = ${Number(c.value.toFixed(5))}`
          )
          .join('; \\quad '),
      },
    ],
  };
}

function solve3x3(A: number[][], b: number[]): [number, number, number] | null {
  const m = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-11) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const div = m[col][col];
    for (let j = col; j <= 3; j++) m[col][j] /= div;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const factor = m[r][col];
      for (let j = col; j <= 3; j++) m[r][j] -= factor * m[col][j];
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}
