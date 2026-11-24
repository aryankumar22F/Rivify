import type { QuizQuestion } from '../types';
import {
  solveDirectionalDerivative,
  solveGradient,
  solveLinearApproximation,
  solveMaximaMinima,
  solvePartialDerivative,
  solveVectorField,
} from './calculus';
import { QUIZ_BANK } from '../data/quizBank';
import { parseExpression, toLatex } from './symbolic';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashDateKey(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffleWithCorrectIndex(
  correct: string,
  distractors: string[],
  rng: () => number
): { optionsLatex: string[]; correctIndex: number } {
  const unique: string[] = [correct];
  for (const d of distractors) {
    if (d && !unique.includes(d)) {
      unique.push(d);
    }
  }
  // Ensure 4 distinct options
  let padIdx = 1;
  while (unique.length < 4) {
    const candidate = `${correct} + ${padIdx}`;
    if (!unique.includes(candidate)) unique.push(candidate);
    padIdx++;
  }
  const four = unique.slice(0, 4);
  const indexed = four.map((tex, idx) => ({ tex, isCorrect: idx === 0 }));
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  return {
    optionsLatex: indexed.map((item) => item.tex),
    correctIndex: indexed.findIndex((item) => item.isCorrect),
  };
}

export function generatePracticeProblem(
  level: 1 | 2 | 3 | 4,
  seedInput?: number
): QuizQuestion {
  const rng = mulberry32(seedInput ?? Math.floor(Math.random() * 1e9));
  const id = `gen-${level}-${Math.floor(rng() * 1e7)}`;

  if (level === 1) {
    // Polynomial partial derivatives
    const c1 = pick([2, 3, 4, 5], rng);
    const c2 = pick([2, 3, 4], rng);
    const px = pick([2, 3, 4], rng);
    const py = pick([2, 3], rng);
    const targetVar = pick(['x', 'y'], rng);
    const otherVar = targetVar === 'x' ? 'y' : 'x';
    const expr = `${c1}*x^${px}*y^${py} + ${c2}*${otherVar}^2`;
    const solved = solvePartialDerivative(expr, targetVar, 1);
    const wrongOther = solvePartialDerivative(expr, otherVar, 1);
    const wrongNoCoeff = solvePartialDerivative(`x^${px}*y^${py}`, targetVar, 1);

    const correctOpt = `f_${targetVar} = ${solved.resultLatex}`;
    const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(
      correctOpt,
      [
        `f_${targetVar} = ${wrongOther.resultLatex}`,
        `f_${targetVar} = ${wrongNoCoeff.resultLatex}`,
        `f_${targetVar} = ${solved.resultLatex} + ${2 * c2}${otherVar}`,
      ],
      rng
    );

    return {
      id,
      level: 1,
      levelName: 'Foundations',
      category: 'Partial Derivative',
      prompt: `Find the partial derivative ∂f/∂${targetVar} of:`,
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `\\text{Hold } ${otherVar} \\text{ constant and apply the Power Rule: } \\frac{\\partial f}{\\partial ${targetVar}} = ${solved.resultLatex}`,
      isGenerated: true,
    };
  }

  if (level === 2) {
    // Chain / Trig / Exp / Log partial derivatives
    const a = pick([2, 3, 4], rng);
    const b = pick([2, 3], rng);
    const v = pick(['x', 'y'], rng);
    const other = v === 'x' ? 'y' : 'x';
    const templates = [
      {
        expr: `sin(${a}*x*y)`,
        wrong1: v === 'x' ? `\\cos(${a}xy)` : `\\cos(${a}xy)`,
        wrong2: `-${a}${other}\\cos(${a}xy)`,
        wrong3: `${a}${v}\\cos(${a}xy)`,
      },
      {
        expr: `e^(${a}*x + ${b}*y)`,
        wrong1: `e^{${a}x + ${b}y}`,
        wrong2: `${v === 'x' ? b : a}e^{${a}x + ${b}y}`,
        wrong3: `(${a} + ${b})e^{${a}x + ${b}y}`,
      },
      {
        expr: `ln(${a}*x^2 + ${b}*y^2)`,
        wrong1: `\\frac{1}{${a}x^2 + ${b}y^2}`,
        wrong2: `\\frac{${v === 'x' ? 2 * b : 2 * a}${other}}{${a}x^2 + ${b}y^2}`,
        wrong3: `\\frac{2x + 2y}{${a}x^2 + ${b}y^2}`,
      },
    ];
    const tpl = pick(templates, rng);
    const solved = solvePartialDerivative(tpl.expr, v, 1);
    const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(
      `f_${v} = ${solved.resultLatex}`,
      [
        `f_${v} = ${tpl.wrong1}`,
        `f_${v} = ${tpl.wrong2}`,
        `f_${v} = ${tpl.wrong3}`,
      ],
      rng
    );

    return {
      id,
      level: 2,
      levelName: 'Intermediate',
      category: 'Partial Derivative',
      prompt: `Apply the Chain Rule to compute ∂f/∂${v} for:`,
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(tpl.expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `\\frac{\\partial f}{\\partial ${v}} = ${solved.resultLatex}`,
      isGenerated: true,
    };
  }

  if (level === 3) {
    // Gradient or Directional Derivative
    const useDir = rng() > 0.5;
    const a = pick([1, 2, 3], rng);
    const b = pick([1, 2, 3], rng);
    if (!useDir) {
      const expr = `${a}*x^2*y + ${b}*y^2`;
      const grad = solveGradient(expr);
      const fxTex = grad.components[0].latex;
      const fyTex = grad.components[1].latex;
      const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(
        `\\langle ${fxTex},\\; ${fyTex} \\rangle`,
        [
          `\\langle ${fyTex},\\; ${fxTex} \\rangle`,
          `\\langle ${2 * a}x,\\; ${2 * b}y \\rangle`,
          `\\langle ${fxTex},\\; ${a}x^2 \\rangle`,
        ],
        rng
      );
      return {
        id,
        level: 3,
        levelName: 'Applied Multivariable',
        category: 'Gradient',
        prompt: 'Compute the symbolic gradient vector ∇f(x, y) of:',
        expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
        optionsLatex,
        correctIndex,
        explanationLatex: `\\nabla f = \\left\\langle \\frac{\\partial f}{\\partial x},\\; \\frac{\\partial f}{\\partial y} \\right\\rangle = \\langle ${fxTex},\\; ${fyTex} \\rangle`,
        isGenerated: true,
      };
    }

    const expr = `${a}*x^2 + ${b}*y^2`;
    const px = pick([1, 2], rng);
    const py = pick([1, 2], rng);
    const dirChoice = pick(
      [
        [3, 4],
        [4, 3],
        [5, 12],
      ],
      rng
    );
    const norm = Math.hypot(dirChoice[0], dirChoice[1]);
    const dir = solveDirectionalDerivative(expr, { x: px, y: py }, dirChoice);
    const numVal = Math.round(dir.directionalValue * norm);
    const correctLatex = `\\frac{${numVal}}{${norm}}`;
    const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(
      correctLatex,
      [
        `${numVal}`,
        `\\frac{${Math.abs(numVal - 4)}}{${norm}}`,
        `\\frac{${numVal + 2}}{${norm}}`,
      ],
      rng
    );

    return {
      id,
      level: 3,
      levelName: 'Applied Multivariable',
      category: 'Directional Derivative',
      prompt: `Find D_u f(${px}, ${py}) in the direction v = ⟨${dirChoice[0]}, ${dirChoice[1]}⟩ for:`,
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `\\nabla f(${px}, ${py}) = \\langle ${2 * a * px},\\; ${2 * b * py} \\rangle,\\; \\mathbf{u} = \\left\\langle \\frac{${dirChoice[0]}}{${norm}},\\; \\frac{${dirChoice[1]}}{${norm}} \\right\\rangle \\implies D_{\\mathbf{u}}f = ${correctLatex}`,
      isGenerated: true,
    };
  }

  // Level 4: Hessian classification or Vector Field Divergence/Curl
  const useHessian = rng() > 0.5;
  if (useHessian) {
    const a = pick([1, 2, 3], rng);
    const b = pick([1, 2, 3], rng);
    const variant = pick(['min', 'max', 'saddle'], rng);
    const expr =
      variant === 'min'
        ? `${a}*x^2 + ${b}*y^2`
        : variant === 'max'
        ? `-${a}*x^2 - ${b}*y^2`
        : `${a}*x^2 - ${b}*y^2`;
    const mm = solveMaximaMinima(expr, 0, 0);
    const correctTex = `\\text{${mm.classification}} \\; (D = ${mm.discriminant})`;
    const candidates = [
      `\\text{Local Minimum} \\; (D = ${4 * a * b})`,
      `\\text{Local Maximum} \\; (D = ${4 * a * b})`,
      `\\text{Saddle Point} \\; (D = ${-4 * a * b})`,
      `\\text{Inconclusive} \\; (D = 0)`,
    ].filter((c) => c !== correctTex);

    const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(correctTex, candidates, rng);
    return {
      id,
      level: 4,
      levelName: 'Mastery & Vector Calculus',
      category: 'Maxima & Minima',
      prompt: 'Classify the critical point (0, 0) using the Second Derivative Test for:',
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `f_{xx} = ${mm.fxxVal},\\; f_{yy} = ${mm.fyyVal},\\; f_{xy} = 0 \\implies D = ${mm.discriminant} \\; (\\text{${mm.classification}})`,
      isGenerated: true,
    };
  }

  const k1 = pick([2, 3, 4], rng);
  const k2 = pick([2, 3, 5], rng);
  const pExpr = `${k1}*x^2*y`;
  const qExpr = `${k2}*x*y^2`;
  const vf = solveVectorField(pExpr, qExpr);
  const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(
    `\\nabla \\cdot \\mathbf{F} = ${vf.divLatex}`,
    [
      `\\nabla \\cdot \\mathbf{F} = ${vf.curlLatex}`,
      `\\nabla \\cdot \\mathbf{F} = ${2 * k1}x + ${2 * k2}y`,
      `\\nabla \\cdot \\mathbf{F} = ${k1}x^2 + ${k2}y^2`,
    ],
    rng
  );
  return {
    id,
    level: 4,
    levelName: 'Mastery & Vector Calculus',
    category: 'Vector Field',
    prompt: 'Compute the divergence ∇ · F of the 2D vector field:',
    expressionLatex: `\\mathbf{F}(x, y) = \\left\\langle ${toLatex(parseExpression(pExpr))},\\; ${toLatex(
      parseExpression(qExpr)
    )} \\right\\rangle`,
    optionsLatex,
    correctIndex,
    explanationLatex: `\\nabla \\cdot \\mathbf{F} = \\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} = ${vf.divLatex}`,
    isGenerated: true,
  };
}

export function generatePracticeSession(level: 1 | 2 | 3 | 4 | 'mixed', count = 10): QuizQuestion[] {
  const baseSeed = Date.now();
  const list: QuizQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const lvl = level === 'mixed' ? (((i % 4) + 1) as 1 | 2 | 3 | 4) : level;
    list.push(generatePracticeProblem(lvl, baseSeed + i * 7919));
  }
  return list;
}

export function getDailyChallengeQuestion(dateKey: string): QuizQuestion {
  const seed = hashDateKey(dateKey);
  const level = ((seed % 4) + 1) as 1 | 2 | 3 | 4;
  const q = generatePracticeProblem(level, seed);
  return {
    ...q,
    id: `daily-${dateKey}`,
  };
}

export const ASSESSMENT_TOPICS = [
  'Partial Derivative',
  'Gradient',
  'Directional Derivative',
  'Linear Approximation',
  'Maxima & Minima',
  'Vector Field',
] as const;

export type AssessmentTopic = (typeof ASSESSMENT_TOPICS)[number];

function generateTopicProblem(topic: AssessmentTopic, seedInput: number): QuizQuestion {
  const rng = mulberry32(seedInput);
  const id = `topic-${topic.toLowerCase().replace(/[^a-z]/g, '')}-${Math.floor(rng() * 1e7)}`;

  if (topic === 'Partial Derivative') {
    return generatePracticeProblem(rng() > 0.5 ? 2 : 1, seedInput);
  }

  if (topic === 'Gradient') {
    const a = pick([1, 2, 3, 4], rng);
    const b = pick([1, 2, 3], rng);
    const expr = `${a}*x^2*y + ${b}*y^3`;
    const grad = solveGradient(expr);
    const fxTex = grad.components[0].latex;
    const fyTex = grad.components[1].latex;
    const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(
      `\\langle ${fxTex},\\; ${fyTex} \\rangle`,
      [
        `\\langle ${fyTex},\\; ${fxTex} \\rangle`,
        `\\langle ${2 * a}xy,\\; ${3 * b}y \\rangle`,
        `\\langle ${a}x^2,\\; ${3 * b}y^2 \\rangle`,
      ],
      rng
    );
    return {
      id,
      level: 3,
      levelName: 'Applied Multivariable',
      category: 'Gradient',
      prompt: 'Compute the gradient vector ∇f(x, y) of:',
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `\\nabla f = \\langle f_x, f_y \\rangle = \\langle ${fxTex},\\; ${fyTex} \\rangle`,
      isGenerated: true,
    };
  }

  if (topic === 'Directional Derivative') {
    const a = pick([1, 2, 3], rng);
    const b = pick([1, 2, 3], rng);
    const px = pick([1, 2], rng);
    const py = pick([1, 2], rng);
    const dirChoice = pick(
      [
        [3, 4],
        [4, 3],
        [5, 12],
      ],
      rng
    );
    const expr = `${a}*x^2 + ${b}*y^2`;
    const norm = Math.hypot(dirChoice[0], dirChoice[1]);
    const dir = solveDirectionalDerivative(expr, { x: px, y: py }, dirChoice);
    const numVal = Math.round(dir.directionalValue * norm);
    const correctLatex = `\\frac{${numVal}}{${norm}}`;
    const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(
      correctLatex,
      [
        `${numVal}`,
        `\\frac{${Math.abs(numVal - 4)}}{${norm}}`,
        `\\frac{${numVal + 3}}{${norm}}`,
      ],
      rng
    );
    return {
      id,
      level: 3,
      levelName: 'Applied Multivariable',
      category: 'Directional Derivative',
      prompt: `Find D_u f(${px}, ${py}) in the direction v = ⟨${dirChoice[0]}, ${dirChoice[1]}⟩ for:`,
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `\\nabla f(${px}, ${py}) \\cdot \\frac{\\mathbf{v}}{\\|\\mathbf{v}\\|} = ${correctLatex}`,
      isGenerated: true,
    };
  }

  if (topic === 'Linear Approximation') {
    const a = pick([1, 2], rng);
    const b = pick([1, 2], rng);
    const x0 = pick([1, 2], rng);
    const y0 = pick([1, 2], rng);
    const expr = `${a}*x^2 + ${b}*y^2`;
    const lin = solveLinearApproximation(expr, x0, y0);
    const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(
      lin.tangentPlaneLatex,
      [
        `L(x, y) = ${lin.f0} + ${lin.fy0}(x - ${x0}) + ${lin.fx0}(y - ${y0})`,
        `L(x, y) = ${lin.fx0}(x - ${x0}) + ${lin.fy0}(y - ${y0})`,
        `L(x, y) = ${lin.f0} - ${lin.fx0}(x - ${x0}) - ${lin.fy0}(y - ${y0})`,
      ],
      rng
    );
    return {
      id,
      level: 3,
      levelName: 'Applied Multivariable',
      category: 'Linear Approximation',
      prompt: `Find the tangent plane approximation L(x, y) at (${x0}, ${y0}) for:`,
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `f(${x0},${y0})=${lin.f0},\\; f_x=${lin.fx0},\\; f_y=${lin.fy0} \\implies ${lin.tangentPlaneLatex}`,
      isGenerated: true,
    };
  }

  if (topic === 'Maxima & Minima') {
    const a = pick([1, 2, 3], rng);
    const b = pick([1, 2, 3], rng);
    const variant = pick(['min', 'max', 'saddle'], rng);
    const expr =
      variant === 'min'
        ? `${a}*x^2 + ${b}*y^2`
        : variant === 'max'
        ? `-${a}*x^2 - ${b}*y^2`
        : `${a}*x^2 - ${b}*y^2`;
    const mm = solveMaximaMinima(expr, 0, 0);
    const correctTex = `\\text{${mm.classification}} \\; (D = ${mm.discriminant})`;
    const candidates = [
      `\\text{Local Minimum} \\; (D = ${4 * a * b})`,
      `\\text{Local Maximum} \\; (D = ${4 * a * b})`,
      `\\text{Saddle Point} \\; (D = ${-4 * a * b})`,
      `\\text{Inconclusive} \\; (D = 0)`,
    ].filter((c) => c !== correctTex);
    const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(correctTex, candidates, rng);
    return {
      id,
      level: 4,
      levelName: 'Mastery & Vector Calculus',
      category: 'Maxima & Minima',
      prompt: 'Classify the critical point (0, 0) using the Second Derivative Test for:',
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `f_{xx}=${mm.fxxVal},\\; f_{yy}=${mm.fyyVal},\\; f_{xy}=0 \\implies D = ${mm.discriminant}`,
      isGenerated: true,
    };
  }

  // Vector Field
  const k1 = pick([2, 3, 4], rng);
  const k2 = pick([2, 3, 5], rng);
  const pExpr = `${k1}*x^2*y`;
  const qExpr = `${k2}*x*y^2`;
  const vf = solveVectorField(pExpr, qExpr);
  const { optionsLatex, correctIndex } = shuffleWithCorrectIndex(
    `\\nabla \\cdot \\mathbf{F} = ${vf.divLatex}`,
    [
      `\\nabla \\cdot \\mathbf{F} = ${vf.curlLatex}`,
      `\\nabla \\cdot \\mathbf{F} = ${2 * k1}x + ${2 * k2}y`,
      `\\nabla \\cdot \\mathbf{F} = ${k1}x^2 + ${k2}y^2`,
    ],
    rng
  );
  return {
    id,
    level: 4,
    levelName: 'Mastery & Vector Calculus',
    category: 'Vector Field',
    prompt: 'Compute the divergence ∇ · F of the 2D vector field:',
    expressionLatex: `\\mathbf{F}(x, y) = \\left\\langle ${toLatex(parseExpression(pExpr))},\\; ${toLatex(
      parseExpression(qExpr)
    )} \\right\\rangle`,
    optionsLatex,
    correctIndex,
    explanationLatex: `\\nabla \\cdot \\mathbf{F} = P_x + Q_y = ${vf.divLatex}`,
    isGenerated: true,
  };
}

export function generateTopicSession(topic: AssessmentTopic, count = 8): QuizQuestion[] {
  const curatedMatches = QUIZ_BANK.filter((q) => q.category === topic);
  const questions: QuizQuestion[] = [...curatedMatches].slice(0, Math.min(4, count));
  const baseSeed = Date.now();
  let i = 0;
  while (questions.length < count) {
    questions.push(generateTopicProblem(topic, baseSeed + i * 6133));
    i++;
  }
  return questions;
}

export function generateMockTest(count = 12): QuizQuestion[] {
  const baseSeed = Date.now();
  const list: QuizQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const topic = ASSESSMENT_TOPICS[i % ASSESSMENT_TOPICS.length];
    list.push(generateTopicProblem(topic, baseSeed + i * 9173));
  }
  return list;
}

export function generateSeededChallenge(
  topic: string,
  seed: number,
  count = 5
): QuizQuestion[] {
  const matchedTopic = ASSESSMENT_TOPICS.find(
    (t) => t.toLowerCase() === topic.toLowerCase()
  );
  const list: QuizQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const activeTopic =
      matchedTopic ?? ASSESSMENT_TOPICS[(seed + i) % ASSESSMENT_TOPICS.length];
    list.push(generateTopicProblem(activeTopic, seed + i * 7919));
  }
  return list;
}
