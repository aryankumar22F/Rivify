import assert from 'node:assert/strict';
import test from 'node:test';
import {
  solveDirectionalDerivative,
  solveGradient,
  solveHessianAndLaplacian,
  solveJacobian,
  solveLinearApproximation,
  solveMaximaMinima,
  solvePartialDerivative,
  solveTaylorSeries,
  solveVectorField,
} from '../calculus';
import {
  solveDoubleIntegral,
  solveLineIntegral,
  solvePolarIntegral,
  solveCylindricalIntegral,
  solveSphericalIntegral,
  solveChangeOfVariablesIntegral,
  solveSurfaceIntegral,
  solveTripleIntegral,
} from '../integrals';
import {
  solveChainRuleComposition,
  solveGlobalOptimization,
  solveImplicitDifferentiation,
  solveLagrangeMultipliers,
  solveMultivariableLimit,
  solveSurfaceNormal,
  solveTotalDerivative,
  solveVectorPotential,
  verifyDivergenceTheorem,
  verifyGreensTheorem,
  verifyStokesTheorem,
} from '../advancedMath';
import { solveMathProblem } from '../solver';
import { FORMULA_CATEGORIES, FORMULA_SHEET } from '../../data/formulaSheet';
import {
  ASSESSMENT_TOPICS,
  generateMockTest,
  generatePracticeProblem,
  generateTopicSession,
  getDailyChallengeQuestion,
} from '../problemGenerator';
import { computeGamification } from '../gamification';
import { evaluateAST, parseExpression, validateExpression } from '../symbolic';

test('Symbolic Parser & Validator handles implicit multiplication and syntax errors', () => {
  const valid = validateExpression('2x^2y^3 + sin(xy)');
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.variables, ['x', 'y']);

  const invalidParen = validateExpression('sin(x + 2');
  assert.equal(invalidParen.valid, false);
  assert.ok(invalidParen.error?.includes(')'));

  const empty = validateExpression('   ');
  assert.equal(empty.valid, false);
});

test('Power & Constant Multiple Rule: ∂/∂x (2*x^2*y^3) = 4*x*y^3', () => {
  const res = solvePartialDerivative('2*x^2*y^3', 'x', 1);
  assert.equal(res.plain, '4*x*y^3');
  assert.ok(res.steps.length > 0);
});

test('Higher-Order Partial Derivative: ∂²/∂x² (x^4 + x^2*y^3) = 12*x^2 + 2*y^3', () => {
  const res = solvePartialDerivative('x^4 + x^2*y^3', 'x', 2);
  const val = evaluateAST(res.ast, { x: 2, y: 1 });
  assert.equal(val, 12 * 4 + 2 * 1);
});

test('Quotient Rule: ∂/∂y (x/y) = -x/y^2', () => {
  const res = solvePartialDerivative('x/y', 'y', 1);
  const val = evaluateAST(res.ast, { x: 6, y: 2 });
  assert.equal(val, -6 / 4);
});

test('Product & Chain Rule: ∂/∂x (x * sin(x*y))', () => {
  const res = solvePartialDerivative('x*sin(x*y)', 'x', 1);
  const x = 1.2;
  const y = 0.7;
  const expected = Math.sin(x * y) + x * y * Math.cos(x * y);
  const actual = evaluateAST(res.ast, { x, y });
  assert.ok(Math.abs(actual - expected) < 1e-9);
});

test('Logarithmic & Exponential Chain Rule: ∂/∂x ln(x^2 + y^2) and e^(x^2 + 3*y)', () => {
  const lnRes = solvePartialDerivative('ln(x^2 + y^2)', 'x', 1);
  assert.equal(lnRes.plain, '2*x/(x^2 + y^2)');

  const expRes = solvePartialDerivative('e^(x^2 + 3*y)', 'y', 1);
  const val = evaluateAST(expRes.ast, { x: 0, y: 1 });
  assert.ok(Math.abs(val - 3 * Math.exp(3)) < 1e-9);
});

test('Gradient & Directional Derivative computation', () => {
  const grad = solveGradient('x^2*y + 3*y', { x: 2, y: 5 });
  assert.deepEqual(grad.evaluatedVector, [20, 7]);

  const dir = solveDirectionalDerivative('x^2 + y^2', { x: 1, y: 2 }, [3, 4]);
  assert.ok(Math.abs(dir.directionalValue - 22 / 5) < 1e-9);
});

test('Maxima & Minima Second Derivative (Hessian) Test', () => {
  const saddle = solveMaximaMinima('x^2 - y^2', 0, 0);
  assert.equal(saddle.classification, 'Saddle Point');
  assert.equal(saddle.discriminant, -4);

  const min = solveMaximaMinima('x^2 + y^2 - 4*x + 6*y + 10', 2, -3);
  assert.equal(min.classification, 'Local Minimum');
  assert.equal(min.discriminant, 4);

  const max = solveMaximaMinima('-x^2 - 2*y^2', 0, 0);
  assert.equal(max.classification, 'Local Maximum');
});

test('Linear Approximation (Tangent Plane) error & value', () => {
  const lin = solveLinearApproximation('x^2 + 2*y^2', 1, 1, 1.1, 0.9);
  // f(1,1)=3, fx(1,1)=2, fy(1,1)=4 -> L(1.1, 0.9) = 3 + 0.2 - 0.4 = 2.8
  assert.ok(Math.abs((lin.approxAtTarget ?? 0) - 2.8) < 1e-9);
  assert.ok(Math.abs((lin.exactAtTarget ?? 0) - (1.21 + 2 * 0.81)) < 1e-9);
});

test('Vector Field Divergence, Curl, and Conservative Check', () => {
  const vortex = solveVectorField('-y', 'x', 1, 2);
  assert.equal(vortex.evalDiv, 0);
  assert.equal(vortex.evalCurl, 2);
  assert.equal(vortex.isConservative, false);

  const conservative = solveVectorField('2*x*y', 'x^2 + 1');
  assert.equal(conservative.isConservative, true);
});

test('Dynamic Practice Generator & Daily Challenge produce valid 4-option questions', () => {
  for (const level of [1, 2, 3, 4] as const) {
    const q = generatePracticeProblem(level, 42 + level);
    assert.equal(q.optionsLatex.length, 4);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
    assert.ok(parseExpression('x^2')); // smoke check
  }
  const dailyA = getDailyChallengeQuestion('2026-11-24');
  const dailyB = getDailyChallengeQuestion('2026-11-24');
  assert.equal(dailyA.id, dailyB.id);
  assert.equal(dailyA.expressionLatex, dailyB.expressionLatex);
});

test('Topic-Wise Assessment & Timed Mock Test generators produce complete valid sets', () => {
  for (const topic of ASSESSMENT_TOPICS) {
    const qs = generateTopicSession(topic, 8);
    assert.equal(qs.length, 8);
    for (const q of qs) {
      assert.equal(q.optionsLatex.length, 4);
      assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
    }
  }
  const mock = generateMockTest(12);
  assert.equal(mock.length, 12);
});

test('Gamification computes real XP, streaks, badges, and learning path from state', () => {
  const today = new Date().toISOString().slice(0, 10);
  const summary = computeGamification(
    [],
    [
      {
        id: 'a1',
        questionId: 'q1',
        category: 'Gradient',
        level: 3,
        correct: false,
        timestamp: Date.now(),
      },
    ],
    [
      {
        id: 'e1',
        dateKey: today,
        kind: 'quiz',
        topic: 'Gradient',
        timestamp: Date.now(),
      },
    ],
    {}
  );
  assert.equal(summary.xp, 5);
  assert.equal(summary.currentStreak, 1);
  assert.equal(summary.learningPath[0]?.topic, 'Gradient');
  assert.equal(summary.learningPath[0]?.priority, 'Focus Area');
});

test('Mixed Partial Derivatives satisfy Clairaut symmetry', () => {
  const fxy = solvePartialDerivative('x^2*y^3 + sin(x*y)', 'x, y', 1);
  const fyx = solvePartialDerivative('x^2*y^3 + sin(x*y)', 'y, x', 1);
  const valXY = evaluateAST(fxy.ast, { x: 1.3, y: 0.9 });
  const valYX = evaluateAST(fyx.ast, { x: 1.3, y: 0.9 });
  assert.ok(Math.abs(valXY - valYX) < 1e-9);
});

test('Jacobian matrix determinant matches analytical polar transformation r', () => {
  // x = u*cos(v), y = u*sin(v) using x=u, y=v -> [cos(y), -x*sin(y); sin(y), x*cos(y)], det = x
  const jac = solveJacobian(['x*cos(y)', 'x*sin(y)'], ['x', 'y'], { x: 3.5, y: 0.7 });
  assert.ok(Math.abs((jac.evaluatedDet ?? 0) - 3.5) < 1e-9);
});

test('Hessian matrix & Laplacian operator evaluate curvature and harmonic functions', () => {
  const harmonic = solveHessianAndLaplacian('x^2 - y^2', ['x', 'y'], { x: 2, y: 5 });
  assert.equal(harmonic.evaluatedLaplacian, 0);
  assert.ok(harmonic.definiteness?.includes('Indefinite'));

  const convex = solveHessianAndLaplacian('2*x^2 + 3*y^2', ['x', 'y'], { x: 1, y: 1 });
  assert.equal(convex.evaluatedLaplacian, 10);
  assert.ok(convex.definiteness?.includes('Positive Definite'));
});

test('Taylor & Maclaurin Series approximate 1D and 2D functions accurately', () => {
  const sinSeries = solveTaylorSeries('sin(x)', 5, { x: 0 }, false, { x: 0.2 });
  assert.equal(sinSeries.isMaclaurin, true);
  assert.ok((sinSeries.error ?? 1) < 1e-6);

  const tay2D = solveTaylorSeries('e^x * cos(y)', 2, { x: 0, y: 0 }, true, { x: 0.1, y: 0.1 });
  assert.ok((tay2D.error ?? 1) < 5e-3);
});

test('Double, Triple, Line, and Surface Integrals match exact analytical benchmarks', () => {
  // ∫_0^1 ∫_0^2 (x^2 + y^2) dy dx = 2/3 + 8/3 = 10/3
  const dbl = solveDoubleIntegral('x^2 + y^2', 0, 1, 0, 2);
  assert.ok(Math.abs(dbl.value - 10 / 3) < 1e-8);

  // ∫_0^1 ∫_0^1 ∫_0^1 (x*y*z) dV = 1/8
  const tri = solveTripleIntegral('x*y*z', 0, 1, 0, 1, 0, 1);
  assert.ok(Math.abs(tri.value - 0.125) < 1e-8);

  // Circulation of <-y, x> around unit circle t in [0, 2*pi] = 2*pi
  const line = solveLineIntegral('-y', 'x', 'cos(t)', 'sin(t)', 0, 2 * Math.PI);
  assert.ok(Math.abs(line.value - 2 * Math.PI) < 1e-6);

  // Surface area of z = x + 2*y over [0,2]x[0,3]: 6 * sqrt(1 + 1 + 4) = 6*sqrt(6)
  const surf = solveSurfaceIntegral('1', 'x + 2*y', 0, 2, 0, 3);
  assert.ok(Math.abs(surf.value - 6 * Math.sqrt(6)) < 1e-8);
});

test('Multivariable Limits detect Path-Dependent DNE, Removable Discontinuity, and 3D convergence', () => {
  const dne = solveMultivariableLimit('(x^2 - y^2)/(x^2 + y^2)', { x0: 0, y0: 0 }, false);
  assert.equal(dne.status, 'Path-Dependent (Limit DNE)');
  assert.equal(dne.isContinuous, false);

  const rem = solveMultivariableLimit('(x^2 * y)/(x^2 + y^2)', { x0: 0, y0: 0 }, false);
  assert.equal(rem.status, 'Removable Discontinuity');
  assert.ok(Math.abs(rem.estimatedLimit ?? 1) < 1e-4);

  const lim3D = solveMultivariableLimit('x*y + z^2', { x0: 2, y0: 3, z0: 4 }, true);
  assert.equal(lim3D.status, 'Convergent & Continuous');
  assert.equal(lim3D.valueAtPoint, 22);
  assert.ok(Math.abs((lim3D.estimatedLimit ?? 0) - 22) < 1e-3);
});

test('Implicit Differentiation, Chain Rule Composition, and Total Derivative match exact calculus identities', () => {
  // Circle x^2 + y^2 - 25 = 0 at (3, 4) -> dy/dx = -3/4
  const imp2 = solveImplicitDifferentiation('x^2 + y^2 - 25', '2d', { x: 3, y: 4 });
  assert.ok(Math.abs((imp2.evaluatedSlope ?? 0) + 0.75) < 1e-9);

  // Sphere x^2 + y^2 + z^2 - 14 = 0 at (1, 2, 3) -> dz/dx = -1/3, dz/dy = -2/3
  const imp3 = solveImplicitDifferentiation('x^2 + y^2 + z^2 - 14', '3d', { x: 1, y: 2, z: 3 });
  assert.ok(Math.abs((imp3.evaluatedDzDx ?? 0) + 1 / 3) < 1e-9);
  assert.ok(Math.abs((imp3.evaluatedDzDy ?? 0) + 2 / 3) < 1e-9);

  // Chain rule: f(x,y) = x^2 + y^2, x = cos(t), y = sin(t) -> df/dt = 0
  const ch = solveChainRuleComposition('x^2 + y^2', 'cos(t)', 'sin(t)', 0.9);
  assert.ok(Math.abs(ch.evaluatedDfDt ?? 1) < 1e-9);

  // Total differential df for f(x,y) = x*y at (2, 3) with dx=0.1, dy=-0.2 -> 3(0.1) + 2(-0.2) = -0.1
  const td = solveTotalDerivative('x*y', { x: 2, y: 3 }, { dx: 0.1, dy: -0.2 }, false);
  assert.ok(Math.abs((td.evaluatedDf ?? 0) + 0.1) < 1e-9);
});

test('Surface Normals & Conservative Potential Function verification', () => {
  // z = x^2 + y^2 at (1, 2) -> N = <-2, -4, 1>
  const surf = solveSurfaceNormal('x^2 + y^2', 'explicit', { x: 1, y: 2 });
  assert.deepEqual(surf.normalVector, [-2, -4, 1]);

  const cons2D = solveVectorPotential('2*x*y', 'x^2 + 3*y^2', undefined, false, { x: 2, y: 1 });
  assert.equal(cons2D.isConservative, true);
  // phi(x,y) = x^2*y + y^3 -> at (2,1) = 4 + 1 = 5
  assert.ok(Math.abs((cons2D.potentialValueAtPoint ?? 0) - 5) < 1e-6);

  const nonCons = solveVectorPotential('-y', 'x', undefined, false);
  assert.equal(nonCons.isConservative, false);
});

test('Polar, Cylindrical, Spherical, and Change-of-Variables Multiple Integrals', () => {
  // Area of unit disk: ∫_0^{2π} ∫_0^1 1 * r dr dθ = π
  const pol = solvePolarIntegral('1', 0, 1, 0, 2 * Math.PI);
  assert.ok(Math.abs(pol.value - Math.PI) < 1e-6);

  // Cylinder of radius 2, height 3: volume = 12π
  const cyl = solveCylindricalIntegral('1', 0, 2, 0, 2 * Math.PI, 0, 3);
  assert.ok(Math.abs(cyl.value - 12 * Math.PI) < 1e-4);

  // Unit sphere volume = 4π/3
  const sph = solveSphericalIntegral('1', 0, 1, 0, 2 * Math.PI, 0, Math.PI);
  assert.ok(Math.abs(sph.value - (4 * Math.PI) / 3) < 1e-3);

  // Change of variables: x = 2u, y = 3v over [0,1]x[0,1], f=1 -> |J|=6, integral = 6
  const cov = solveChangeOfVariablesIntegral('1', '2*u', '3*v', 0, 1, 0, 1);
  assert.ok(Math.abs(cov.value - 6) < 1e-7);
});

test('Green, Stokes, and Divergence Theorems verify boundary-vs-interior equality', () => {
  const green = verifyGreensTheorem('-y^2', 'x^2', 0, 2, 0, 3);
  assert.equal(green.verified, true);
  assert.ok(green.difference < 1e-5);

  const stokes = verifyStokesTheorem('-y', 'x', 'z', 'x^2 + y^2', 1.5);
  assert.equal(stokes.verified, true);
  assert.ok(stokes.difference < 1e-3);

  const div = verifyDivergenceTheorem('x^2', 'y^2', 'z^2', 0, 1, 0, 2, 0, 1);
  assert.equal(div.verified, true);
  assert.ok(div.difference < 1e-5);
});

test('Global Optimization & Lagrange Multipliers find exact constrained/bounded extrema', () => {
  // f(x,y) = x^2 + y^2 - 2*x on [-2, 3] x [-2, 2]: min at (1,0) -> -1
  const gOpt = solveGlobalOptimization('x^2 + y^2 - 2*x', -2, 3, -2, 2);
  assert.ok(Math.abs(gOpt.globalMin.value + 1) < 1e-4);

  // Maximize xy subject to x^2 + y^2 = 8 -> max = 4, min = -4
  const lag = solveLagrangeMultipliers('x*y', 'x^2 + y^2', 8, [-4, 4], [-4, 4]);
  assert.ok(Math.abs(lag.candidates[0].value - 4) < 1e-4);
  assert.ok(Math.abs(lag.candidates[lag.candidates.length - 1].value + 4) < 1e-4);
});

test('Unified Math Solver handles equations, 3x3 linear systems, symbolic derivatives, and integrals', () => {
  const eq = solveMathProblem({ input: 'x^2 - 5*x + 6 = 0', mode: 'equation', variable: 'x' });
  assert.deepEqual(eq.roots, [2, 3]);

  const sys = solveMathProblem({
    input: '2*x + y = 5; x - y = 1',
    mode: 'linear-system',
  });
  assert.deepEqual(sys.systemSolution?.values, [2, 1]);

  const drv = solveMathProblem({ input: 'x^3 + sin(x)', mode: 'derivative', variable: 'x' });
  assert.ok(drv.resultPlain.includes('3*x^2'));

  const integ = solveMathProblem({
    input: '3*x^2',
    mode: 'integral',
    variable: 'x',
    bounds: { lower: 0, upper: 2 },
  });
  assert.ok(integ.resultPlain.includes('8'));
});

import { evaluateScientificExpression } from '../scientific';
import {
  solveFirstOrderOde,
  solveIntroPde,
  solveSecondOrderOde,
} from '../differentialEquations';
import {
  computeEigen,
  determinantAndRank,
  inverseMatrix,
  luDecomposition,
  multiplyMatrices,
  solveLinearSystemMatrix,
} from '../linearAlgebra';
import {
  solveGaussSeidel,
  solveNumericalIntegration,
  solveRootMethod,
} from '../numericalMethods';
import {
  computeCombinatoricsAndBayes,
  computeDescriptiveStats,
  computeDistribution,
  computeLinearRegression,
} from '../probabilityStats';
import { solveComplexArithmetic, solveDeMoivreAndRoots } from '../complexNumbers';
import { buildExamPaper, EXAM_QUESTION_BANK, gradeExamAnswer } from '../../data/examBank';

test('Expanded Formula Library & Practice Topics include all required university categories', () => {
  assert.equal(ASSESSMENT_TOPICS.length, 11);
  const categories = new Set(FORMULA_SHEET.map((f) => f.category));
  for (const cat of FORMULA_CATEGORIES) {
    if (cat === 'All' || cat === 'Favorites') continue;
    assert.ok(categories.has(cat), `Missing formula category: ${cat}`);
  }
  for (const f of FORMULA_SHEET) {
    assert.ok(f.subtopic.length > 0);
    assert.ok(f.symbols.length > 0);
    assert.ok(f.conditions.length > 0);
    assert.ok(f.example.problemLatex.length > 0);
    assert.ok(f.example.solutionLatex.length > 0);
  }
});

test('Scientific Calculator evaluates trig (DEG/RAD), hyperbolics, logs, factorials, fractions, and rejects domain errors', () => {
  const deg = evaluateScientificExpression('sin(30) + cos(60)', { angleUnit: 'deg' });
  assert.ok(Math.abs(deg.value - 1) < 1e-10);

  const frac = evaluateScientificExpression('3/4 + 1/8', { angleUnit: 'rad' });
  assert.equal(frac.fractionFormatted, '7/8');

  const factMod = evaluateScientificExpression('5! + 17 mod 5 + ncr(6, 2) + root(3, 27)');
  assert.equal(factMod.value, 120 + 2 + 15 + 3);

  const hyp = evaluateScientificExpression('cosh(0) + ln(e^2) + log(1000) + 50%');
  assert.ok(Math.abs(hyp.value - 6.5) < 1e-10);

  assert.throws(() => evaluateScientificExpression('1/0'), /Division by zero/);
  assert.throws(() => evaluateScientificExpression('ln(-2)'), /x > 0/);
  assert.throws(() => evaluateScientificExpression('asin(2)'), /-1/);
});

test('Differential Equations Lab solves 1st-order ODEs, 2nd-order IVP/BVP shooting, and Intro PDEs', () => {
  const ode1 = solveFirstOrderOde({ rhsExpr: '2*y', x0: 0, y0: 1, xEnd: 1 });
  const finalY = ode1.points[ode1.points.length - 1].y;
  assert.ok(Math.abs(finalY - Math.exp(2)) < 1e-4);

  // y'' + 4y = 0, y(0)=2, y'(0)=0 -> y(pi/2) = 2*cos(pi) = -2
  const ode2 = solveSecondOrderOde({
    a: 1,
    b: 0,
    c: 4,
    forcingExpr: '0',
    problemMode: 'ivp',
    x0: 0,
    y0: 2,
    yp0: 0,
    xEnd: Math.PI / 2,
    yEnd: 0,
  });
  assert.ok(Math.abs(ode2.points[ode2.points.length - 1].y + 2) < 1e-4);

  // BVP shooting: y'' = 0, y(0)=1, y(2)=5 -> y(1)=3
  const bvp = solveSecondOrderOde({
    a: 1,
    b: 0,
    c: 0,
    forcingExpr: '0',
    problemMode: 'bvp',
    x0: 0,
    y0: 1,
    yp0: 0,
    xEnd: 2,
    yEnd: 5,
  });
  assert.ok(Math.abs(bvp.points[bvp.points.length - 1].y - 5) < 1e-5);

  const heat = solveIntroPde({ pdeType: 'heat', length: 1, coeff: 0.1, duration: 1 });
  assert.equal(heat.profiles.length, 30);
});

test('Linear Algebra Lab computes multiplication, determinant, rank, inverse, LU, Ax=b, and eigenvalues', () => {
  const A = [
    [4, 1],
    [2, 3],
  ];
  const B = [
    [1, 0],
    [2, -1],
  ];
  const prod = multiplyMatrices(A, B);
  assert.deepEqual(prod.resultMatrix, [
    [6, -1],
    [8, -3],
  ]);

  const dr = determinantAndRank(A);
  assert.equal(dr.scalarResult, 10);
  assert.equal(dr.rank, 2);

  const inv = inverseMatrix(A);
  assert.ok(Math.abs((inv.resultMatrix?.[0][0] ?? 0) - 0.3) < 1e-9);

  const lu = luDecomposition(A);
  assert.ok(lu.lu && lu.lu.U[0][0] === 4);

  const sys = solveLinearSystemMatrix(A, [5, 5]);
  assert.equal(sys.systemSolution?.status, 'unique');
  assert.ok(Math.abs((sys.systemSolution?.x?.[0] ?? 0) - 1) < 1e-9);
  assert.ok(Math.abs((sys.systemSolution?.x?.[1] ?? 0) - 1) < 1e-9);

  const eig = computeEigen(A);
  const reals = (eig.eigenvalues ?? []).map((e) => Math.round(e.real)).sort((x, y) => x - y);
  assert.deepEqual(reals, [2, 5]);
});

test('Numerical Methods Lab solves Bisection, Newton-Raphson, Regula Falsi, Secant, Gauss-Seidel, and Simpson rules', () => {
  const bis = solveRootMethod({ method: 'bisection', expr: 'x^2 - 2', a: 1, b: 2, x0: 1, x1: 2, tol: 1e-6 });
  assert.ok(Math.abs(bis.root - Math.SQRT2) < 1e-5);

  const nr = solveRootMethod({ method: 'newton', expr: 'x^3 - x - 2', a: 1, b: 2, x0: 1.5, x1: 2, tol: 1e-7 });
  assert.ok(Math.abs(nr.root - 1.5213797) < 1e-5);

  const rf = solveRootMethod({ method: 'regula-falsi', expr: 'x^2 - 9', a: 1, b: 5, x0: 1, x1: 5, tol: 1e-6 });
  assert.ok(Math.abs(rf.root - 3) < 1e-4);

  const sec = solveRootMethod({ method: 'secant', expr: 'cos(x) - x', a: 0, b: 1, x0: 0, x1: 1, tol: 1e-6 });
  assert.ok(Math.abs(sec.root - 0.739085) < 1e-5);

  const gs = solveGaussSeidel(
    [
      [10, -1, 2],
      [-1, 11, -1],
      [2, -1, 10],
    ],
    [6, 25, -11],
    1e-6,
    30
  );
  assert.equal(gs.converged, true);
  assert.ok(Math.abs(gs.solution[0] - 1.04327) < 1e-3);

  // ∫_0^1 x^2 dx = 1/3 exact under Simpson's 1/3 and 3/8
  const simp = solveNumericalIntegration({ rule: 'simpson-1-3', expr: 'x^2', a: 0, b: 1, n: 4 });
  assert.ok(Math.abs(simp.approxValue - 1 / 3) < 1e-9);
});

test('Probability & Statistics Lab computes descriptive stats, Bayes, Binomial/Poisson/Normal, and linear regression', () => {
  const desc = computeDescriptiveStats([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(desc.mean, 5);
  assert.equal(desc.populationStdDev, 2);

  const bayes = computeCombinatoricsAndBayes({
    n: 5,
    r: 2,
    pA: 0.5,
    pBGivenA: 0.8,
    pBGivenNotA: 0.2,
  });
  assert.equal(bayes.nCr, '10');
  assert.equal(bayes.nPr, '20');
  assert.ok(Math.abs(bayes.pAGivenB - 0.8) < 1e-9);

  const norm = computeDistribution({
    type: 'normal',
    n: 10,
    p: 0.5,
    lambda: 3,
    mean: 0,
    stdDev: 1,
    k: 0,
    xLow: -1,
    xHigh: 1,
  });
  assert.ok(Math.abs(norm.intervalProb - 0.682689) < 1e-4);

  const reg = computeLinearRegression([
    { x: 1, y: 3 },
    { x: 2, y: 5 },
    { x: 3, y: 7 },
  ], 4);
  assert.ok(Math.abs(reg.slope - 2) < 1e-9);
  assert.ok(Math.abs(reg.intercept - 1) < 1e-9);
  assert.ok(Math.abs((reg.predictedY ?? 0) - 9) < 1e-9);
});

test('Complex Numbers Lab computes arithmetic, polar/exponential, De Moivre, and nth roots', () => {
  const arith = solveComplexArithmetic({ re: 3, im: 4 }, { re: 1, im: -2 });
  assert.equal(arith.z1.modulus, 5);
  assert.equal(arith.product.re, 11);
  assert.equal(arith.product.im, -2);

  const dm = solveDeMoivreAndRoots({ re: 1, im: 0 }, 4, 4);
  assert.equal(dm.roots.length, 4);
  assert.ok(Math.abs(dm.roots[1].im - 1) < 1e-9);
});

test('Exam Preparation Center papers and grading handle MCQ and numerical items accurately', () => {
  const aktuPaper = buildExamPaper({ mode: 'aktu' });
  assert.ok(aktuPaper.questions.length >= 6);
  const numQ = EXAM_QUESTION_BANK.find((q) => q.questionType === 'numerical')!;
  assert.equal(gradeExamAnswer(numQ, { numericText: String(numQ.numericAnswer) }), true);
  assert.equal(gradeExamAnswer(numQ, { numericText: '99999' }), false);
});
import {
  analyzeGraph,
  analyzeRelation,
  computeCombinatoricsAndInduction,
  computeSetOperations,
  evaluatePropositionalLogic,
  solveSecondOrderRecurrence,
} from '../discreteMath';
import {
  computeConvolution,
  computeFourierSeries,
  computeFourierTransform,
  solveInverseLaplaceQuadratic,
} from '../fourierLaplace';
import {
  analyzeConicSection,
  apply2DTransform,
  compute2DCoordinateGeometry,
  compute3DGeometry,
} from '../geometryLab';
import {
  solveAssignmentHungarian,
  solveDecisionTheory,
  solveLinearProgramSimplex,
  solveMaxFlow,
  solveTransportation,
} from '../operationsResearch';
import { convertUnits, formatUnitNumber, UNIT_CATEGORIES } from '../unitConverter';
import { deriveAndCompare } from '../formulaDerivation';
import { CLASSROOM_LESSONS, generateCustomQuestionPaper, PAPER_TOPICS } from '../../data/classroomAndPapers';

test('Discrete Mathematics Lab computes set algebra, relations, tautologies, Dijkstra/MST, combinatorics, and recurrences', () => {
  const sets = computeSetOperations('1, 2, 3', '2, 3, 4', '1, 2, 3, 4, 5');
  assert.deepEqual(sets.union, ['1', '2', '3', '4']);
  assert.deepEqual(sets.intersection, ['2', '3']);
  assert.deepEqual(sets.diffAB, ['1']);
  assert.deepEqual(sets.complementA, ['4', '5']);
  assert.equal(sets.cartesianSize, 9);
  assert.equal(sets.powerSetASize, '8');

  const rel = analyzeRelation('1, 2', '(1,1), (2,2), (1,2), (2,1)');
  assert.equal(rel.reflexive, true);
  assert.equal(rel.symmetric, true);
  assert.equal(rel.transitive, true);
  assert.equal(rel.isEquivalence, true);
  assert.equal(rel.isPartialOrder, false);

  const tautology = evaluatePropositionalLogic('(P & (P -> Q)) -> Q');
  assert.equal(tautology.classification, 'Tautology');
  assert.equal(tautology.minterms.length, 4);

  const xorLogic = evaluatePropositionalLogic('P ^ Q');
  assert.equal(xorLogic.classification, 'Contingency');
  assert.deepEqual(xorLogic.minterms, [1, 2]);

  const graph = analyzeGraph('A B 4\nB C 3\nA C 10\nC D 2', 'A', 'D', false);
  assert.deepEqual(graph.shortestPath.path, ['A', 'B', 'C', 'D']);
  assert.equal(graph.shortestPath.distance, 9);
  assert.equal(graph.mstWeight, 9);
  assert.equal(graph.connectedComponents, 1);

  const comb = computeCombinatoricsAndInduction(5, 2, 'sum-k2');
  assert.equal(comb.permutations, '20');
  assert.equal(comb.combinations, '10');
  assert.equal(comb.derangements, '44');
  assert.equal(comb.inductionProof.holds, true);

  // Fibonacci: a_n = a_{n-1} + a_{n-2}, a_0 = 0, a_1 = 1 -> a_6 = 8
  const rec = solveSecondOrderRecurrence(1, 1, 0, 1, 8);
  assert.equal(rec.terms[6].value, 8);
});

test('Fourier & Laplace Lab computes Fourier series harmonics, continuous FT, quadratic inverse Laplace, and convolution', () => {
  const fs = computeFourierSeries('3 + 2*cos(t)', Math.PI, 4);
  assert.ok(Math.abs(fs.a0 - 6) < 1e-4);
  assert.ok(Math.abs(fs.an[0] - 2) < 1e-4);
  assert.ok(Math.abs(fs.bn[0]) < 1e-4);
  assert.ok(fs.rmse < 1e-4);

  // FT of e^(-t^2) at omega=0 equals sqrt(pi)
  const ft = computeFourierTransform('e^(-t^2)', 5, 6);
  const dcBin = ft.spectrum.reduce((best, s) => (Math.abs(s.omega) < Math.abs(best.omega) ? s : best));
  assert.ok(Math.abs(dcBin.magnitude - Math.sqrt(Math.PI)) < 1e-3);

  // Inverse Laplace of 1/(s^2 + 5s + 6) = 1/((s+2)(s+3)) = e^(-2t) - e^(-3t)
  const ilap = solveInverseLaplaceQuadratic(0, 1, 5, 6);
  assert.ok(ilap.polesDescription.includes('distinct real poles'));
  const sampleAt1 = ilap.samples.reduce((best, p) => (Math.abs(p.t - 1) < Math.abs(best.t - 1) ? p : best));
  const expectedAt1 = Math.exp(-2 * sampleAt1.t) - Math.exp(-3 * sampleAt1.t);
  assert.ok(Math.abs(sampleAt1.y - expectedAt1) < 1e-4);

  // Convolution of 1 * 1 from 0 to t equals t
  const conv = computeConvolution('1', '1', 4);
  const last = conv.samples[conv.samples.length - 1];
  assert.ok(Math.abs(last.conv - last.t) < 1e-4);
});

test('Advanced Geometry Lab computes 2D coordinates, conics, homogeneous transforms, and 3D lines/planes', () => {
  const g2 = compute2DCoordinateGeometry(
    [0, 0],
    [3, 4],
    [3, 0],
    { a: 1, b: -1, c: 0 },
    { a: 1, b: 1, c: -4 }
  );
  assert.equal(g2.distance, 5);
  assert.deepEqual(g2.midpoint, [1.5, 2]);
  assert.deepEqual(g2.intersection, [2, 2]);
  assert.ok(Math.abs(g2.angleDeg - 90) < 1e-6);
  assert.equal(g2.triangleArea, 6);

  // Ellipse x^2/25 + y^2/9 = 1 -> 9x^2 + 25y^2 - 225 = 0 -> e = 4/5 = 0.8
  const conic = analyzeConicSection(9, 0, 25, 0, 0, -225);
  assert.equal(conic.kind, 'Ellipse');
  assert.ok(Math.abs(conic.eccentricity - 0.8) < 1e-6);
  assert.equal(conic.foci.length, 2);

  // Rotate (1, 0) by 90 deg and translate by (2, 3) -> (2, 4)
  const tr = apply2DTransform([[1, 0]], 2, 3, 90, 1, 1, 'none');
  assert.ok(Math.abs(tr.transformed[0][0] - 2) < 1e-6);
  assert.ok(Math.abs(tr.transformed[0][1] - 4) < 1e-6);

  // Distance from (1, 2, 2) to 2x + 2y + z = 12 -> |2+4+2-12|/3 = 4/3
  const g3 = compute3DGeometry(
    [1, 2, 2],
    [2, 2, 1],
    [0, 0, 0],
    [1, 0, 0],
    { a: 2, b: 2, c: 1, d: 12 },
    { a: 0, b: 0, c: 1, d: 0 }
  );
  assert.ok(Math.abs(g3.pointToPlaneDist - 4 / 3) < 1e-6);
  assert.ok(g3.linePlaneIntersection !== null);
});

test('Operations Research Lab solves Simplex LP, Transportation (VAM), Hungarian Assignment, Max-Flow, and Decision Theory', () => {
  // Max Z = 5x1 + 4x2 s.t. x1 + x2 <= 6, x1 <= 4 -> x=(4,2), Z*=28
  const lp = solveLinearProgramSimplex('max', [5, 4], [
    { coeffs: [1, 1], sign: '<=', rhs: 6 },
    { coeffs: [1, 0], sign: '<=', rhs: 4 },
  ]);
  assert.equal(lp.status, 'optimal');
  assert.equal(lp.optimalValue, 28);
  assert.deepEqual(lp.solution, [4, 2]);

  const trans = solveTransportation(
    [
      [19, 30, 50, 10],
      [70, 30, 40, 60],
      [40, 8, 70, 20],
    ],
    [7, 9, 18],
    [5, 8, 7, 14],
    'vam'
  );
  assert.ok(trans.totalCost <= 800);

  const assign = solveAssignmentHungarian([
    [9, 2, 7, 8],
    [6, 4, 3, 7],
    [5, 8, 1, 8],
    [7, 6, 9, 4],
  ]);
  // Optimal assignment: (0->1:2) + (1->0:6) + (2->2:1) + (3->3:4) = 13
  assert.equal(assign.totalCost, 13);

  const mf = solveMaxFlow(
    [
      { u: 'S', v: 'A', capacity: 10 },
      { u: 'S', v: 'B', capacity: 5 },
      { u: 'A', v: 'B', capacity: 15 },
      { u: 'A', v: 'T', capacity: 5 },
      { u: 'B', v: 'T', capacity: 10 },
    ],
    'S',
    'T'
  );
  assert.equal(mf.maxFlow, 15);

  const dec = solveDecisionTheory(
    ['Expand', 'Maintain'],
    [
      [120, 40],
      [70, 60],
    ],
    [0.6, 0.4],
    0.5
  );
  assert.equal(dec.bestEMV, 'Expand');
  assert.equal(dec.bestMaximin, 'Maintain');
});

test('Unit Converter, Formula Derivation & Custom Question Paper tools operate accurately', () => {
  assert.equal(UNIT_CATEGORIES.length, 11);
  const kmToMi = convertUnits('length', 10, 'km', 'm');
  assert.equal(kmToMi.value, 10000);
  const tempCF = convertUnits('temperature', 100, 'C', 'F');
  assert.ok(Math.abs(tempCF.value - 212) < 1e-9);
  const tempCK = convertUnits('temperature', 0, 'C', 'K');
  assert.ok(Math.abs(tempCK.value - 273.15) < 1e-9);
  assert.equal(formatUnitNumber(1234.5678, 5), '1234.6');

  const diffCheck = deriveAndCompare({
    mode: 'differentiation',
    expr: 'x^3 + sin(x)',
    variable: 'x',
    pointX: 1,
  });
  assert.ok((diffCheck.comparison?.delta ?? 1) < 1e-5);

  const idTrue = deriveAndCompare({
    mode: 'identity-verify',
    expr: 'sin(x)^2 + cos(x)^2',
    rhsExpr: '1',
    variable: 'x',
  });
  assert.equal(idTrue.verified, true);

  const idFalse = deriveAndCompare({
    mode: 'identity-verify',
    expr: 'sin(x)',
    rhsExpr: 'cos(x)',
    variable: 'x',
  });
  assert.equal(idFalse.verified, false);

  assert.ok(CLASSROOM_LESSONS.length >= 4);
  const paper = generateCustomQuestionPaper({
    title: 'Sample Midterm',
    topics: [PAPER_TOPICS[0], PAPER_TOPICS[1]],
    difficultyMix: 'balanced',
    targetMarks: 15,
    durationMinutes: 60,
    includeMcq: true,
    includeNumerical: true,
    includeDescriptive: true,
    seed: 3,
  });
  assert.ok(paper.questions.length >= 3);
  assert.ok(paper.totalMarks > 0);
});

test('Universal Multi-Format Input (Normal Text, Unicode, LaTeX, Explicit ASCII) works across Solver, Symbolic, Calculus, and Scientific engines', () => {
  // 1. All 4 forms for 2*x*y + 3*y^2
  const forms = [
    '2*x*y + 3*y^2',
    '2xy + 3y^2',
    '\\frac{\\partial f}{\\partial x} = 2xy + 3y^2',
    '∂f/∂x = 2xy + 3y²',
    'f(x, y) = 2xy + 3y²',
    '2 times x times y plus 3 y squared',
  ];
  for (const expr of forms) {
    const val = validateExpression(expr);
    assert.equal(val.valid, true, `Expected valid for "${expr}", got error: ${val.error}`);
    const ast = parseExpression(expr);
    const num = evaluateAST(ast, { x: 2, y: 3 });
    assert.equal(num, 2 * 2 * 3 + 3 * 9, `Evaluation mismatch for "${expr}"`);
  }

  // 2. Partial derivative tool accepts LaTeX assignment cleanly
  const pdFromLatex = solvePartialDerivative('\\frac{\\partial f}{\\partial x} = 2xy + 3y^2', 'x', 1);
  assert.equal(pdFromLatex.plain, '2*y');

  // 3. Math Solver handles LaTeX & Unicode partial differential relations in auto mode
  const diffAssignLatex = solveMathProblem({
    input: '\\frac{\\partial f}{\\partial x} = 2xy + 3y^2',
    mode: 'auto',
    point: { x: 2, y: 1, z: 1 },
  });
  assert.equal(diffAssignLatex.detectedMode, 'integral');
  assert.ok(diffAssignLatex.resultPlain.includes('x^2*y'));
  assert.ok(diffAssignLatex.resultPlain.includes('C(y)'));

  const diffAssignUnicode = solveMathProblem({
    input: '∂f/∂x = 2xy + 3y²',
    mode: 'auto',
  });
  assert.equal(diffAssignUnicode.detectedMode, 'integral');
  assert.ok(diffAssignUnicode.resultPlain.includes('3*x*y^2'));

  // 4. Natural-language and LaTeX calculus commands in Solver
  const textDeriv = solveMathProblem({
    input: 'derivative of 2xy + 3y^2 with respect to x',
    mode: 'auto',
  });
  assert.equal(textDeriv.detectedMode, 'derivative');
  assert.equal(textDeriv.resultPlain, '2*y');

  const latexDeriv = solveMathProblem({
    input: '\\frac{d}{dx}(x^3 + \\sin x)',
    mode: 'auto',
  });
  assert.equal(latexDeriv.detectedMode, 'derivative');
  assert.ok(latexDeriv.resultPlain.includes('3*x^2'));

  const latexInt = solveMathProblem({
    input: '\\int_{0}^{2} 3x^2 \\, dx',
    mode: 'auto',
  });
  assert.equal(latexInt.detectedMode, 'integral');
  assert.ok(latexInt.resultPlain.includes('8'));

  const textInt = solveMathProblem({
    input: 'integrate 3x^2 from 0 to 2',
    mode: 'auto',
  });
  assert.equal(textInt.detectedMode, 'integral');
  assert.ok(textInt.resultPlain.includes('8'));

  // 5. LaTeX fractions, roots, powers on trig, abs, and space-separated trig
  const trigPow = evaluateAST(parseExpression('\\sin^2(x) + \\cos^2(x)'), { x: 0.7 });
  assert.ok(Math.abs(trigPow - 1) < 1e-9);

  const absVal = evaluateAST(parseExpression('\\left|x - 5\\right|'), { x: 2 });
  assert.equal(absVal, 3);

  const spaceTrig = evaluateAST(parseExpression('sin x + sqrt 16'), { x: 0 });
  assert.equal(spaceTrig, 4);

  // 6. LaTeX cases system and implicit polynomial equation
  const sysLatex = solveMathProblem({
    input: '\\begin{cases} 2x + 3y = 8 \\\\ x - y = 1 \\end{cases}',
    mode: 'auto',
  });
  assert.equal(sysLatex.detectedMode, 'linear-system');
  assert.deepEqual(sysLatex.systemSolution?.values, [2.2, 1.2]);

  const eqText = solveMathProblem({
    input: 'solve x^2 - 5x + 6 = 0',
    mode: 'auto',
  });
  assert.deepEqual(eqText.roots, [2, 3]);

  // 7. Scientific calculator accepts LaTeX, Unicode, and normal text
  const sciLatex = evaluateScientificExpression('\\frac{3}{4} + \\sqrt{16} \\cdot 2^{3}');
  assert.ok(Math.abs(sciLatex.value - 32.75) < 1e-9);

  const sciUnicode = evaluateScientificExpression('2×3 + 4²');
  assert.equal(sciUnicode.value, 22);

  const sciText = evaluateScientificExpression('square root of 16 plus 2 times 3 squared');
  assert.equal(sciText.value, 22);
});
