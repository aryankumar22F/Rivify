import { QUIZ_BANK } from '../data/quizBank';
import type { QuizQuestion } from '../types';
import {
  solveDirectionalDerivative,
  solveGradient,
  solveLinearApproximation,
  solveMaximaMinima,
  solvePartialDerivative,
  solveVectorField,
} from './calculus';
import { solveDoubleIntegral } from './integrals';
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
    if (d && !unique.includes(d)) unique.push(d);
  }
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
      difficultyTier: 'Beginner',
      questionType: 'mcq',
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
    const a = pick([2, 3, 4], rng);
    const b = pick([2, 3], rng);
    const v = pick(['x', 'y'], rng);
    const other = v === 'x' ? 'y' : 'x';
    const templates = [
      {
        expr: `sin(${a}*x*y)`,
        wrong1: `\\cos(${a}xy)`,
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
      [`f_${v} = ${tpl.wrong1}`, `f_${v} = ${tpl.wrong2}`, `f_${v} = ${tpl.wrong3}`],
      rng
    );

    return {
      id,
      level: 2,
      levelName: 'Intermediate',
      difficultyTier: 'Intermediate',
      questionType: 'mcq',
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
        difficultyTier: 'Intermediate',
        questionType: 'mcq',
        category: 'Gradient',
        prompt: 'Compute the symbolic gradient vector ∇f(x, y) of:',
        expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
        optionsLatex,
        correctIndex,
        explanationLatex: `\\nabla f = \\langle ${fxTex},\\; ${fyTex} \\rangle`,
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
      [`${numVal}`, `\\frac{${Math.abs(numVal - 4)}}{${norm}}`, `\\frac{${numVal + 2}}{${norm}}`],
      rng
    );

    return {
      id,
      level: 3,
      levelName: 'Applied Multivariable',
      difficultyTier: 'Intermediate',
      questionType: 'mcq',
      category: 'Directional Derivative',
      prompt: `Find D_u f(${px}, ${py}) in direction v = ⟨${dirChoice[0]}, ${dirChoice[1]}⟩ for:`,
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `D_{\\mathbf{u}}f = ${correctLatex}`,
      isGenerated: true,
    };
  }

  // Level 4: Hessian or Vector Field
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
      difficultyTier: 'Advanced',
      questionType: 'mcq',
      category: 'Maxima & Minima',
      prompt: 'Classify the critical point (0, 0) using the Second Derivative Test for:',
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `D = ${mm.discriminant} \\implies \\text{${mm.classification}}`,
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
    difficultyTier: 'Advanced',
    questionType: 'mcq',
    category: 'Vector Field',
    prompt: 'Compute the divergence ∇ · F of the 2D vector field:',
    expressionLatex: `\\mathbf{F}(x, y) = \\left\\langle ${toLatex(parseExpression(pExpr))},\\; ${toLatex(
      parseExpression(qExpr)
    )} \\right\\rangle`,
    optionsLatex,
    correctIndex,
    explanationLatex: `\\nabla \\cdot \\mathbf{F} = ${vf.divLatex}`,
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
  return { ...q, id: `daily-${dateKey}` };
}

export const ASSESSMENT_TOPICS = [
  'Partial Derivative',
  'Limits & Continuity',
  'Gradient',
  'Directional Derivative',
  'Linear Approximation',
  'Integration',
  'Maxima & Minima',
  'Optimization',
  'Vector Field',
  'Vector Theorems',
  'Linear Algebra',
] as const;

export type AssessmentTopic = (typeof ASSESSMENT_TOPICS)[number];

export function generateTopicProblem(topic: AssessmentTopic, seedInput: number): QuizQuestion {
  const rng = mulberry32(seedInput);
  const id = `topic-${topic.toLowerCase().replace(/[^a-z]/g, '')}-${Math.floor(rng() * 1e7)}`;

  if (topic === 'Partial Derivative') {
    return generatePracticeProblem(rng() > 0.5 ? 2 : 1, seedInput);
  }

  if (topic === 'Limits & Continuity') {
    const c = pick([2, 3, 4], rng);
    const val = c * 2;
    const isDNE = rng() > 0.5;
    if (isDNE) {
      return {
        id,
        level: 2,
        levelName: 'Intermediate',
        difficultyTier: 'Intermediate',
        questionType: 'mcq',
        category: 'Limits & Continuity',
        prompt: 'Evaluate the multivariable limit as (x, y) → (0, 0):',
        expressionLatex: `f(x, y) = \\frac{${c}x^2 - y^2}{x^2 + y^2}`,
        optionsLatex: ['\\text{Does Not Exist}', `${c}`, '-1', '0'],
        correctIndex: 0,
        explanationLatex: `\\text{Along } y=0, f\\to ${c}; \\text{ along } x=0, f\\to -1. \\text{ Different path limits } \\implies \\text{DNE}.`,
        isGenerated: true,
      };
    }
    return {
      id,
      level: 1,
      levelName: 'Foundations',
      difficultyTier: 'Beginner',
      questionType: 'short-answer',
      category: 'Limits & Continuity',
      prompt: `Find the numeric limit of f(x, y) = ${c}x + y^2 as (x, y) → (2, 0):`,
      expressionLatex: `\\lim_{(x, y) \\to (2, 0)} (${c}x + y^2)`,
      optionsLatex: [`${val}`, `${val + 2}`, `${c}`, '0'],
      correctIndex: 0,
      numericAnswer: val,
      tolerance: 0.05,
      answerHint: 'Enter a number',
      explanationLatex: `\\text{Direct substitution gives } ${c}(2) + 0^2 = ${val}.`,
      isGenerated: true,
    };
  }

  if (topic === 'Integration') {
    const a = pick([1, 2, 3], rng);
    const b = pick([1, 2], rng);
    const expr = `${a}*x + ${b}*y`;
    const dbl = solveDoubleIntegral(expr, 0, 2, 0, 2);
    const ans = Number(dbl.value.toFixed(2));
    return {
      id,
      level: 2,
      levelName: 'Intermediate',
      difficultyTier: 'Intermediate',
      questionType: 'short-answer',
      category: 'Integration',
      prompt: 'Compute the double integral over [0, 2] × [0, 2]:',
      expressionLatex: `\\int_0^2 \\int_0^2 (${a}x + ${b}y)\\,dx\\,dy`,
      optionsLatex: [`${ans}`, `${ans + 2}`, `${ans - 2}`, `${ans * 2}`],
      correctIndex: 0,
      numericAnswer: ans,
      tolerance: 0.05,
      answerHint: 'Enter exact integer value',
      explanationLatex: `\\iint_{[0,2]^2} (${a}x+${b}y)\\,dA = ${ans}.`,
      isGenerated: true,
    };
  }

  if (topic === 'Optimization') {
    const r2 = pick([8, 18, 32], rng);
    const maxVal = r2 / 2;
    return {
      id,
      level: 4,
      levelName: 'Mastery & Vector Calculus',
      difficultyTier: 'Advanced',
      questionType: 'short-answer',
      category: 'Optimization',
      prompt: `Find the maximum value of f(x, y) = x·y subject to x² + y² = ${r2}:`,
      expressionLatex: `\\max\\; xy \\quad \\text{s.t. } x^2 + y^2 = ${r2}`,
      optionsLatex: [`${maxVal}`, `${r2}`, `${maxVal * 2}`, '0'],
      correctIndex: 0,
      numericAnswer: maxVal,
      tolerance: 0.05,
      answerHint: 'Enter numeric maximum',
      explanationLatex: `\\text{By Lagrange Multipliers, } x^2=y^2=${r2 / 2} \\implies \\max(xy) = ${maxVal}.`,
      isGenerated: true,
    };
  }

  if (topic === 'Vector Theorems') {
    const a = pick([2, 3, 4], rng);
    const b = pick([1, 2, 3], rng);
    const divSum = a + b + 1;
    return {
      id,
      level: 4,
      levelName: 'Mastery & Vector Calculus',
      difficultyTier: 'Advanced',
      questionType: 'short-answer',
      category: 'Vector Theorems',
      prompt: `Using the Divergence Theorem, find the outward flux of F = ⟨${a}x, ${b}y, z⟩ across [0, 1]³:`,
      expressionLatex: `\\oiint_{\\partial [0,1]^3} \\langle ${a}x, ${b}y, z \\rangle\\cdot d\\mathbf{S}`,
      optionsLatex: [`${divSum}`, `${divSum + 1}`, `${a * b}`, '0'],
      correctIndex: 0,
      numericAnswer: divSum,
      tolerance: 0.05,
      answerHint: 'Enter outward flux value',
      explanationLatex: `\\nabla\\cdot\\mathbf{F} = ${a} + ${b} + 1 = ${divSum} \\implies \\text{Flux} = ${divSum}.`,
      isGenerated: true,
    };
  }

  if (topic === 'Linear Algebra') {
    const k = pick([2, 3, 4], rng);
    const det = 2 * k - 1;
    return {
      id,
      level: 3,
      levelName: 'Applied Multivariable',
      difficultyTier: 'Intermediate',
      questionType: 'short-answer',
      category: 'Linear Algebra',
      prompt: 'Compute the determinant of the 2×2 matrix:',
      expressionLatex: `\\det\\begin{bmatrix} 2 & 1 \\\\ 1 & ${k} \\end{bmatrix}`,
      optionsLatex: [`${det}`, `${2 * k + 1}`, `${k}`, '1'],
      correctIndex: 0,
      numericAnswer: det,
      tolerance: 0.05,
      answerHint: 'Enter integer determinant',
      explanationLatex: `2(${k}) - (1)(1) = ${det}.`,
      isGenerated: true,
    };
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
      difficultyTier: 'Intermediate',
      questionType: 'mcq',
      category: 'Gradient',
      prompt: 'Compute the gradient vector ∇f(x, y) of:',
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `\\nabla f = \\langle ${fxTex},\\; ${fyTex} \\rangle`,
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
      [`${numVal}`, `\\frac{${Math.abs(numVal - 4)}}{${norm}}`, `\\frac{${numVal + 3}}{${norm}}`],
      rng
    );
    return {
      id,
      level: 3,
      levelName: 'Applied Multivariable',
      difficultyTier: 'Intermediate',
      questionType: 'mcq',
      category: 'Directional Derivative',
      prompt: `Find D_u f(${px}, ${py}) in direction v = ⟨${dirChoice[0]}, ${dirChoice[1]}⟩ for:`,
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: `\\nabla f(${px}, ${py}) \\cdot \\mathbf{u} = ${correctLatex}`,
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
      difficultyTier: 'Intermediate',
      questionType: 'mcq',
      category: 'Linear Approximation',
      prompt: `Find the tangent plane approximation L(x, y) at (${x0}, ${y0}) for:`,
      expressionLatex: `f(x, y) = ${toLatex(parseExpression(expr))}`,
      optionsLatex,
      correctIndex,
      explanationLatex: lin.tangentPlaneLatex,
      isGenerated: true,
    };
  }

  if (topic === 'Maxima & Minima') {
    return generatePracticeProblem(4, seedInput);
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
    difficultyTier: 'Advanced',
    questionType: 'mcq',
    category: 'Vector Field',
    prompt: 'Compute the divergence ∇ · F of the 2D vector field:',
    expressionLatex: `\\mathbf{F}(x, y) = \\left\\langle ${toLatex(parseExpression(pExpr))},\\; ${toLatex(
      parseExpression(qExpr)
    )} \\right\\rangle`,
    optionsLatex,
    correctIndex,
    explanationLatex: `\\nabla \\cdot \\mathbf{F} = ${vf.divLatex}`,
    isGenerated: true,
  };
}

export function generateTopicSession(topic: AssessmentTopic, count = 8): QuizQuestion[] {
  const curatedMatches = QUIZ_BANK.filter((q) => q.category === topic);
  const questions: QuizQuestion[] = [...curatedMatches].slice(0, Math.min(3, count));
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
