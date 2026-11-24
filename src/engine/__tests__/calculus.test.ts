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
  solveSurfaceIntegral,
  solveTripleIntegral,
} from '../integrals';
import {
  ASSESSMENT_TOPICS,
  generateMockTest,
  generatePracticeProblem,
  generateSeededChallenge,
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

test('Seeded challenge generator creates identical question sets for friends', () => {
  const roomA = generateSeededChallenge('Gradient', 123456, 5);
  const roomB = generateSeededChallenge('Gradient', 123456, 5);
  assert.equal(roomA.length, 5);
  assert.deepEqual(
    roomA.map((q) => q.expressionLatex),
    roomB.map((q) => q.expressionLatex)
  );
});

