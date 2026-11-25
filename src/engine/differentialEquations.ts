import type { AngleUnit, DerivationStep } from '../types';
import { evaluateAST, parseExpression, simplify, toLatex, toPlain } from './symbolic';

export interface OdePoint {
  x: number;
  y: number;
  yp?: number;
}

export interface FirstOrderOdeResult {
  classification: string;
  generalSolutionLatex: string;
  particularSolutionLatex: string;
  points: OdePoint[];
  slopeField: { x: number; y: number; slope: number }[];
  steps: DerivationStep[];
}

export interface SecondOrderOdeResult {
  classification: string;
  characteristicRootsLatex: string;
  homogeneousLatex: string;
  particularLatex: string;
  solutionLatex: string;
  points: OdePoint[];
  steps: DerivationStep[];
}

export interface PdeSimulationResult {
  pdeType: 'heat' | 'wave' | 'laplace';
  equationLatex: string;
  fourierSolutionLatex: string;
  gridX: number[];
  gridT: number[];
  // For heat/wave: profiles[tIdx][xIdx]; for laplace: profiles[yIdx][xIdx]
  profiles: number[][];
  steps: DerivationStep[];
}

function rk4FirstOrder(
  rhs: (x: number, y: number) => number,
  x0: number,
  y0: number,
  xEnd: number,
  stepsCount = 120
): OdePoint[] {
  const h = (xEnd - x0) / stepsCount;
  const pts: OdePoint[] = [{ x: x0, y: y0 }];
  let x = x0;
  let y = y0;
  for (let i = 0; i < stepsCount; i++) {
    const k1 = rhs(x, y);
    const k2 = rhs(x + h / 2, y + (h * k1) / 2);
    const k3 = rhs(x + h / 2, y + (h * k2) / 2);
    const k4 = rhs(x + h, y + h * k3);
    const nextY = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    if (!Number.isFinite(nextY) || Math.abs(nextY) > 1e6) break;
    x += h;
    y = nextY;
    pts.push({ x: Number(x.toFixed(5)), y: Number(y.toFixed(6)) });
  }
  return pts;
}

export function solveFirstOrderOde(params: {
  rhsExpr: string; // dy/dx = f(x, y)
  x0: number;
  y0: number;
  xEnd: number;
  angleUnit?: AngleUnit;
}): FirstOrderOdeResult {
  const { rhsExpr, x0, y0, xEnd, angleUnit = 'rad' } = params;
  const ast = parseExpression(rhsExpr);
  const plain = toPlain(ast);
  const rhsFn = (x: number, y: number) => evaluateAST(ast, { x, y }, angleUnit);

  // Detect common exact analytical templates (linear / separable) for crisp symbolic steps
  let classification = 'General 1st-Order ODE (dy/dx = f(x, y))';
  let generalSolutionLatex = `\\frac{dy}{dx} = ${toLatex(ast)} \\quad \\text{(solved via RK4)}`;
  let particularSolutionLatex = `y(${x0}) = ${y0}`;
  const steps: DerivationStep[] = [
    {
      id: 'ode1-1',
      rule: 'Standard Differential Form',
      description: `Identify first-order ordinary differential equation with initial condition y(${x0}) = ${y0}.`,
      latex: `\\frac{dy}{dx} = ${toLatex(ast)}, \\qquad y(${x0}) = ${y0}`,
    },
  ];

  // Check if rhs depends only on y -> separable dy/f(y) = dx
  const testLinearY = (() => {
    try {
      const f00 = rhsFn(0, 0);
      const f01 = rhsFn(0, 1);
      const f10 = rhsFn(1, 0);
      const f11 = rhsFn(1, 1);
      // Pure proportional y' = k*y
      const k = f01 - f00;
      if (
        Math.abs(f00) < 1e-9 &&
        Math.abs(f10) < 1e-9 &&
        Math.abs(f11 - k) < 1e-9 &&
        Math.abs(rhsFn(2.3, 2.5) - 2.5 * k) < 1e-8
      ) {
        return { kind: 'exp' as const, k };
      }
      // Constant slope y' = ax + b (independent of y)
      if (Math.abs(f01 - f00) < 1e-9 && Math.abs(f11 - f10) < 1e-9) {
        return { kind: 'quadrature' as const };
      }
    } catch {
      // fallback
    }
    return null;
  })();

  if (testLinearY?.kind === 'exp') {
    const k = Number(testLinearY.k.toFixed(4));
    const cVal = Number((y0 * Math.exp(-k * x0)).toFixed(4));
    classification = 'Separable / Homogeneous Linear ODE';
    generalSolutionLatex = `y(x) = C e^{${k === 1 ? '' : k === -1 ? '-' : k}x}`;
    particularSolutionLatex = `y(x) = ${cVal} e^{${k === 1 ? '' : k === -1 ? '-' : k}x}`;
    steps.push(
      {
        id: 'ode1-2',
        rule: 'Separation of Variables',
        description: `Separate variables as (1/y) dy = ${k} dx and integrate both sides.`,
        latex: `\\int \\frac{dy}{y} = \\int ${k}\\,dx \\implies \\ln|y| = ${k}x + C_0`,
      },
      {
        id: 'ode1-3',
        rule: 'Apply Initial Condition',
        description: `Substitute y(${x0}) = ${y0} to solve for C = ${cVal}.`,
        latex: particularSolutionLatex,
      }
    );
  } else if (testLinearY?.kind === 'quadrature') {
    classification = 'Directly Integrable ODE (dy/dx = g(x))';
    generalSolutionLatex = `y(x) = y(${x0}) + \\int_{${x0}}^{x} \\left(${toLatex(ast)}\\right) dt`;
    particularSolutionLatex = `y(x) = ${y0} + \\int_{${x0}}^{x} \\left(${toLatex(ast)}\\right) dt`;
    steps.push({
      id: 'ode1-2',
      rule: 'Direct Antidifferentiation',
      description: 'Right-hand side depends only on x; integrate directly from x₀.',
      latex: particularSolutionLatex,
    });
  } else {
    // Check linear form y' + P(x)y = Q(x) via linear probe in y at fixed x
    let isLinearInY = true;
    for (const tx of [x0, (x0 + xEnd) / 2, xEnd]) {
      try {
        const yA = rhsFn(tx, 0);
        const yB = rhsFn(tx, 1);
        const yC = rhsFn(tx, 2);
        if (Math.abs((yC - yB) - (yB - yA)) > 1e-6) {
          isLinearInY = false;
          break;
        }
      } catch {
        isLinearInY = false;
        break;
      }
    }
    if (isLinearInY) {
      classification = '1st-Order Linear ODE: y′ + P(x)y = Q(x)';
      steps.push({
        id: 'ode1-2',
        rule: 'Integrating Factor Method',
        description: `Linear in y; integrating factor μ(x) = exp(∫P(x)dx) converts LHS into d/dx[μ(x)y].`,
        latex: `\\mu(x) = e^{\\int P(x)\\,dx}, \\qquad y(x) = \\frac{1}{\\mu(x)}\\left(\\int \\mu(x)Q(x)\\,dx + C\\right)`,
      });
    } else {
      steps.push({
        id: 'ode1-2',
        rule: '4th-Order Runge-Kutta (RK4) Integration',
        description: `Non-elementary or nonlinear RHS "${plain}"; compute O(h⁴) trajectory from (${x0}, ${y0}) to x = ${xEnd}.`,
        latex: `y_{n+1} = y_n + \\frac{h}{6}(k_1 + 2k_2 + 2k_3 + k_4)`,
      });
    }
  }

  const points = rk4FirstOrder(rhsFn, x0, y0, xEnd, 120);
  if (points.length > 0) {
    const last = points[points.length - 1];
    particularSolutionLatex =
      testLinearY?.kind === 'exp'
        ? particularSolutionLatex
        : `y(${last.x}) \\approx ${Number(last.y.toFixed(4))}`;
  }

  // Generate slope field grid
  const xMin = Math.min(x0, xEnd);
  const xMax = Math.max(x0, xEnd);
  const ys = points.map((p) => p.y);
  const yMinRaw = ys.length > 0 ? Math.min(...ys) : y0 - 2;
  const yMaxRaw = ys.length > 0 ? Math.max(...ys) : y0 + 2;
  const yPad = Math.max(1.5, (yMaxRaw - yMinRaw) * 0.25);
  const yMin = yMinRaw - yPad;
  const yMax = yMaxRaw + yPad;

  const slopeField: { x: number; y: number; slope: number }[] = [];
  const nx = 14;
  const ny = 10;
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const sx = xMin + (i / nx) * (xMax - xMin);
      const sy = yMin + (j / ny) * (yMax - yMin);
      try {
        const s = rhsFn(sx, sy);
        if (Number.isFinite(s)) slopeField.push({ x: sx, y: sy, slope: s });
      } catch {
        // skip singular point
      }
    }
  }

  return {
    classification,
    generalSolutionLatex,
    particularSolutionLatex,
    points,
    slopeField,
    steps,
  };
}

export function solveSecondOrderOde(params: {
  a: number;
  b: number;
  c: number;
  forcingExpr: string; // g(x), "0" for homogeneous
  problemMode: 'ivp' | 'bvp';
  x0: number;
  y0: number;
  yp0: number; // used in IVP
  xEnd: number;
  yEnd: number; // used in BVP y(xEnd) = yEnd
  angleUnit?: AngleUnit;
}): SecondOrderOdeResult {
  const { a, b, c, forcingExpr, problemMode, x0, y0, yp0, xEnd, yEnd, angleUnit = 'rad' } = params;
  if (Math.abs(a) < 1e-10) {
    throw new Error('Leading coefficient "a" must be non-zero for a second-order ODE.');
  }
  const gAst = parseExpression(forcingExpr.trim() || '0');
  const gFn = (x: number) => evaluateAST(gAst, { x }, angleUnit);
  const isHomogeneous = toPlain(simplify(gAst)) === '0';

  const disc = b * b - 4 * a * c;
  let characteristicRootsLatex = '';
  let homogeneousLatex = '';
  let classification = '';

  if (disc > 1e-9) {
    const r1 = (-b + Math.sqrt(disc)) / (2 * a);
    const r2 = (-b - Math.sqrt(disc)) / (2 * a);
    classification = isHomogeneous
      ? '2nd-Order Homogeneous (Overdamped / Distinct Real Roots)'
      : '2nd-Order Non-Homogeneous (Distinct Real Roots)';
    characteristicRootsLatex = `r_1 = ${Number(r1.toFixed(4))}, \\quad r_2 = ${Number(r2.toFixed(4))}`;
    homogeneousLatex = `y_h(x) = C_1 e^{${Number(r1.toFixed(4))}x} + C_2 e^{${Number(r2.toFixed(4))}x}`;
  } else if (Math.abs(disc) <= 1e-9) {
    const r = -b / (2 * a);
    classification = isHomogeneous
      ? '2nd-Order Homogeneous (Critically Damped / Repeated Root)'
      : '2nd-Order Non-Homogeneous (Repeated Root)';
    characteristicRootsLatex = `r_1 = r_2 = ${Number(r.toFixed(4))}`;
    homogeneousLatex = `y_h(x) = (C_1 + C_2 x)e^{${Number(r.toFixed(4))}x}`;
  } else {
    const alpha = -b / (2 * a);
    const beta = Math.sqrt(-disc) / (2 * a);
    classification = isHomogeneous
      ? '2nd-Order Homogeneous (Underdamped / Complex Conjugate Roots)'
      : '2nd-Order Non-Homogeneous (Complex Conjugate Roots)';
    characteristicRootsLatex = `r = ${Number(alpha.toFixed(4))} \\pm ${Number(beta.toFixed(4))}i`;
    homogeneousLatex =
      Math.abs(alpha) < 1e-9
        ? `y_h(x) = C_1\\cos(${Number(beta.toFixed(4))}x) + C_2\\sin(${Number(beta.toFixed(4))}x)`
        : `y_h(x) = e^{${Number(alpha.toFixed(4))}x}\\left(C_1\\cos(${Number(
            beta.toFixed(4)
          )}x) + C_2\\sin(${Number(beta.toFixed(4))}x)\\right)`;
  }

  const rk4SecondOrder = (initYp: number): OdePoint[] => {
    const N = 140;
    const h = (xEnd - x0) / N;
    let x = x0;
    let y = y0;
    let v = initYp;
    const pts: OdePoint[] = [{ x, y, yp: v }];
    const acc = (xx: number, yy: number, vv: number) => (gFn(xx) - b * vv - c * yy) / a;

    for (let i = 0; i < N; i++) {
      const k1y = v;
      const k1v = acc(x, y, v);

      const k2y = v + (h * k1v) / 2;
      const k2v = acc(x + h / 2, y + (h * k1y) / 2, v + (h * k1v) / 2);

      const k3y = v + (h * k2v) / 2;
      const k3v = acc(x + h / 2, y + (h * k2y) / 2, v + (h * k2v) / 2);

      const k4y = v + h * k3v;
      const k4v = acc(x + h, y + h * k3y, v + h * k3v);

      const nextY = y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
      const nextV = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      if (!Number.isFinite(nextY) || !Number.isFinite(nextV) || Math.abs(nextY) > 1e7) break;
      x += h;
      y = nextY;
      v = nextV;
      pts.push({ x: Number(x.toFixed(5)), y: Number(y.toFixed(6)), yp: Number(v.toFixed(6)) });
    }
    return pts;
  };

  let effectiveYp0 = yp0;
  let points: OdePoint[];
  if (problemMode === 'bvp') {
    // Linear shooting method: y(xEnd; s) is affine in initial slope s = y'(x0)
    const pts0 = rk4SecondOrder(0);
    const pts1 = rk4SecondOrder(1);
    const yEnd0 = pts0[pts0.length - 1]?.y ?? y0;
    const yEnd1 = pts1[pts1.length - 1]?.y ?? y0;
    const denom = yEnd1 - yEnd0;
    if (Math.abs(denom) < 1e-9) {
      throw new Error('Boundary value problem may be singular or resonance-degenerate on this interval.');
    }
    effectiveYp0 = (yEnd - yEnd0) / denom;
    points = rk4SecondOrder(effectiveYp0);
  } else {
    points = rk4SecondOrder(yp0);
  }

  const particularLatex = isHomogeneous
    ? 'y_p(x) = 0'
    : `\\text{Forced by } g(x) = ${toLatex(gAst)} \\;(\\text{integrated numerically via RK4})`;

  const steps: DerivationStep[] = [
    {
      id: 'ode2-1',
      rule: 'Characteristic Equation',
      description: `Solve auxiliary polynomial ${a}r² + ${b}r + ${c} = 0 (Δ = ${Number(disc.toFixed(4))}).`,
      latex: `${a}r^2 + ${b}r + ${c} = 0 \\implies ${characteristicRootsLatex}`,
    },
    {
      id: 'ode2-2',
      rule: 'Complementary Function y_h(x)',
      description: 'Construct general homogeneous solution from characteristic roots.',
      latex: homogeneousLatex,
    },
  ];

  if (problemMode === 'ivp') {
    steps.push({
      id: 'ode2-3',
      rule: 'Initial Value Integration (RK4)',
      description: `Convert to coupled 1st-order system with y(${x0}) = ${y0}, y'(${x0}) = ${yp0}.`,
      latex: `y(${xEnd}) \\approx ${Number((points[points.length - 1]?.y ?? 0).toFixed(5))}`,
    });
  } else {
    steps.push({
      id: 'ode2-3',
      rule: 'Linear Shooting for Boundary Value Problem',
      description: `Matched y(${x0}) = ${y0} and y(${xEnd}) = ${yEnd}; deduced initial slope y'(${x0}) ≈ ${Number(
        effectiveYp0.toFixed(5)
      )}.`,
      latex: `y'(${x0}) \\approx ${Number(effectiveYp0.toFixed(5))}`,
    });
  }

  return {
    classification,
    characteristicRootsLatex,
    homogeneousLatex,
    particularLatex,
    solutionLatex: isHomogeneous ? homogeneousLatex : `y(x) = ${homogeneousLatex.replace('y_h(x) = ', '')} + y_p(x)`,
    points,
    steps,
  };
}

export function solveIntroPde(params: {
  pdeType: 'heat' | 'wave' | 'laplace';
  length: number;
  coeff: number; // alpha for heat, c for wave, top boundary value for laplace
  duration: number;
}): PdeSimulationResult {
  const L = Math.max(0.5, params.length);
  const coeff = Math.max(0.05, params.coeff);
  const T = Math.max(0.2, params.duration);
  const nx = 36;
  const dx = L / (nx - 1);
  const gridX = Array.from({ length: nx }, (_, i) => Number((i * dx).toFixed(4)));

  if (params.pdeType === 'heat') {
    // 1D Heat Equation: u_t = alpha * u_xx, u(0,t)=0, u(L,t)=0, u(x,0) = sin(pi*x/L) + 0.5*sin(2*pi*x/L)
    const nt = 30;
    const gridT = Array.from({ length: nt }, (_, k) => Number(((k / (nt - 1)) * T).toFixed(4)));
    const profiles: number[][] = gridT.map((t) =>
      gridX.map(
        (x) =>
          Math.sin((Math.PI * x) / L) * Math.exp(-coeff * Math.pow(Math.PI / L, 2) * t) +
          0.5 * Math.sin((2 * Math.PI * x) / L) * Math.exp(-coeff * Math.pow((2 * Math.PI) / L, 2) * t)
      )
    );
    return {
      pdeType: 'heat',
      equationLatex: `\\frac{\\partial u}{\\partial t} = ${coeff} \\frac{\\partial^2 u}{\\partial x^2}, \\quad u(0,t)=u(${L},t)=0`,
      fourierSolutionLatex: `u(x,t) = \\sin\\!\\left(\\frac{\\pi x}{${L}}\\right)e^{-${coeff}(\\pi/${L})^2 t} + \\frac{1}{2}\\sin\\!\\left(\\frac{2\\pi x}{${L}}\\right)e^{-${coeff}(2\\pi/${L})^2 t}`,
      gridX,
      gridT,
      profiles,
      steps: [
        {
          id: 'pde-h1',
          rule: 'Separation of Variables u(x,t) = X(x)T(t)',
          description: 'Separating gives X\'\' + λX = 0 and T\' + αλT = 0 with Dirichlet eigenvalues λₙ = (nπ/L)².',
          latex: `\\lambda_n = \\left(\\frac{n\\pi}{${L}}\\right)^2, \\qquad X_n(x) = \\sin\\!\\left(\\frac{n\\pi x}{${L}}\\right)`,
        },
        {
          id: 'pde-h2',
          rule: 'Exponential Thermal Decay',
          description: 'Higher frequency modes decay quadratically faster as t advances.',
          latex: `T_n(t) = B_n e^{-${coeff}(n\\pi/${L})^2 t}`,
        },
      ],
    };
  }

  if (params.pdeType === 'wave') {
    // 1D Wave Equation: u_tt = c^2 * u_xx, plucked string u(x,0) = sin(pi*x/L), u_t(x,0) = 0
    const nt = 30;
    const gridT = Array.from({ length: nt }, (_, k) => Number(((k / (nt - 1)) * T).toFixed(4)));
    const profiles: number[][] = gridT.map((t) =>
      gridX.map(
        (x) =>
          Math.sin((Math.PI * x) / L) * Math.cos((coeff * Math.PI * t) / L) +
          0.3 * Math.sin((3 * Math.PI * x) / L) * Math.cos((3 * coeff * Math.PI * t) / L)
      )
    );
    return {
      pdeType: 'wave',
      equationLatex: `\\frac{\\partial^2 u}{\\partial t^2} = ${coeff}^2 \\frac{\\partial^2 u}{\\partial x^2}, \\quad u(0,t)=u(${L},t)=0`,
      fourierSolutionLatex: `u(x,t) = \\sin\\!\\left(\\frac{\\pi x}{${L}}\\right)\\cos\\!\\left(\\frac{${coeff}\\pi t}{${L}}\\right) + 0.3\\sin\\!\\left(\\frac{3\\pi x}{${L}}\\right)\\cos\\!\\left(\\frac{3\\cdot ${coeff}\\pi t}{${L}}\\right)`,
      gridX,
      gridT,
      profiles,
      steps: [
        {
          id: 'pde-w1',
          rule: 'Standing Wave Modes',
          description: 'With fixed endpoints and zero initial velocity, time factor is cos(nπct/L).',
          latex: `u_n(x,t) = A_n\\sin\\!\\left(\\frac{n\\pi x}{${L}}\\right)\\cos\\!\\left(\\frac{n\\pi c t}{${L}}\\right)`,
        },
      ],
    };
  }

  // 2D Laplace Equation on [0, L] x [0, L]: u_xx + u_yy = 0, top edge u(x, L) = coeff * sin(pi*x/L)
  const ny = 24;
  const gridY = Array.from({ length: ny }, (_, j) => Number(((j / (ny - 1)) * L).toFixed(4)));
  const profiles: number[][] = gridY.map((y) =>
    gridX.map(
      (x) =>
        (coeff * Math.sin((Math.PI * x) / L) * Math.sinh((Math.PI * y) / L)) / Math.sinh(Math.PI)
    )
  );
  return {
    pdeType: 'laplace',
    equationLatex: `\\frac{\\partial^2 u}{\\partial x^2} + \\frac{\\partial^2 u}{\\partial y^2} = 0, \\quad u(x, ${L}) = ${coeff}\\sin\\!\\left(\\frac{\\pi x}{${L}}\\right)`,
    fourierSolutionLatex: `u(x,y) = ${coeff}\\,\\frac{\\sinh(\\pi y/${L})}{\\sinh(\\pi)}\\sin\\!\\left(\\frac{\\pi x}{${L}}\\right)`,
    gridX,
    gridT: gridY,
    profiles,
    steps: [
      {
        id: 'pde-l1',
        rule: 'Steady-State Harmonic Modes',
        description: 'Zero boundary on x=0, x=L, y=0 selects sin(nπx/L) sinh(nπy/L) eigenfunctions.',
        latex: `u(x,y) = \\sum_{n=1}^{\\infty} C_n \\sin\\!\\left(\\frac{n\\pi x}{${L}}\\right)\\sinh\\!\\left(\\frac{n\\pi y}{${L}}\\right)`,
      },
    ],
  };
}
