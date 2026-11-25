import type { ExamQuestion } from '../types';

export const EXAM_TOPICS = [
  'Multivariable Calculus',
  'Differential Equations',
  'Linear Algebra',
  'Numerical Methods',
  'Probability & Statistics',
  'Complex Analysis',
] as const;

export const EXAM_QUESTION_BANK: ExamQuestion[] = [
  // Multivariable Calculus
  {
    id: 'ex-mvc-1',
    topic: 'Multivariable Calculus',
    examStyle: 'aktu',
    sectionLabel: 'Section A · 2 Marks (Sample)',
    marks: 2,
    questionType: 'mcq',
    prompt: 'If u = log(x² + y²), evaluate ∂u/∂x at (1, 1).',
    expressionLatex: 'u(x, y) = \\ln(x^2 + y^2)',
    optionsLatex: ['1', '2', '0.5', '0'],
    correctIndex: 0,
    explanationLatex: '\\frac{\\partial u}{\\partial x} = \\frac{2x}{x^2+y^2} \\implies \\frac{2(1)}{1+1} = 1',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-mvc-2',
    topic: 'Multivariable Calculus',
    examStyle: 'aktu',
    sectionLabel: 'Section B · 7 Marks (Sample)',
    marks: 7,
    questionType: 'numerical',
    prompt: 'Compute the directional derivative of f(x, y) = x²y + y³ at (1, 2) in the direction of v = 3i + 4j.',
    expressionLatex: 'D_{\\hat{u}} f(1, 2) = \\nabla f(1,2) \\cdot \\frac{\\langle 3, 4\\rangle}{5}',
    numericAnswer: 12.8,
    tolerance: 0.05,
    answerHint: '∇f(1,2) = ⟨4, 13⟩, dot with ⟨3/5, 4/5⟩ = (12 + 52)/5 = 12.8',
    explanationLatex: '\\nabla f = \\langle 2xy, x^2 + 3y^2\\rangle = \\langle 4, 13\\rangle,\\quad D_{\\hat{u}}f = \\frac{4(3) + 13(4)}{5} = \\frac{64}{5} = 12.8',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-mvc-3',
    topic: 'Multivariable Calculus',
    examStyle: 'topic',
    sectionLabel: 'Concept Check · 4 Marks',
    marks: 4,
    questionType: 'mcq',
    prompt: 'Which vector theorem converts a closed 2D line integral ∮(P dx + Q dy) into a double integral over the enclosed region D?',
    expressionLatex: '\\oint_{\\partial D} (P\\,dx + Q\\,dy) = \\iint_D \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right)dA',
    optionsLatex: [
      "Green's Theorem",
      "Gauss's Divergence Theorem",
      'Euler Homogeneous Theorem',
      "Simpson's 1/3 Rule",
    ],
    correctIndex: 0,
    explanationLatex: "\\text{Green's Theorem relates circulation around } \\partial D \\text{ to the scalar curl } Q_x - P_y \\text{ over } D.",
    sourceLabel: 'Sample Engineering Practice',
  },
  // Differential Equations
  {
    id: 'ex-de-1',
    topic: 'Differential Equations',
    examStyle: 'aktu',
    sectionLabel: 'Section A · 2 Marks (Sample)',
    marks: 2,
    questionType: 'mcq',
    prompt: 'Find the integrating factor for the linear ODE dy/dx + (2/x)y = x³.',
    expressionLatex: "\\frac{dy}{dx} + \\frac{2}{x}y = x^3",
    optionsLatex: ['x^2', 'e^{2x}', '2\\ln x', '1/x^2'],
    correctIndex: 0,
    explanationLatex: '\\mu(x) = e^{\\int (2/x)\\,dx} = e^{2\\ln x} = x^2',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-de-2',
    topic: 'Differential Equations',
    examStyle: 'aktu',
    sectionLabel: 'Section C · 10 Marks (Sample)',
    marks: 10,
    questionType: 'numerical',
    prompt: 'Solve y′′ + 4y = 0 with y(0) = 2 and y′(0) = 0. Evaluate y(π/4).',
    expressionLatex: "y'' + 4y = 0,\\quad y(0)=2,\\; y'(0)=0",
    numericAnswer: 0,
    tolerance: 0.02,
    answerHint: 'y(x) = 2 cos(2x), so y(π/4) = 2 cos(π/2) = 0.',
    explanationLatex: 'r^2 + 4 = 0 \\implies y(x) = 2\\cos(2x) \\implies y(\\pi/4) = 2\\cos(\\pi/2) = 0',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-de-3',
    topic: 'Differential Equations',
    examStyle: 'mock',
    sectionLabel: 'Core PDE · 5 Marks',
    marks: 5,
    questionType: 'mcq',
    prompt: 'Classify the partial differential equation ∂²u/∂x² + ∂²u/∂y² = 0.',
    expressionLatex: '\\frac{\\partial^2 u}{\\partial x^2} + \\frac{\\partial^2 u}{\\partial y^2} = 0',
    optionsLatex: ['Elliptic (Laplace)', 'Parabolic (Heat)', 'Hyperbolic (Wave)', 'First-Order Separable'],
    correctIndex: 0,
    explanationLatex: 'A=1, B=0, C=1 \\implies B^2 - 4AC = -4 < 0,\\text{ which is Elliptic.}',
    sourceLabel: 'Sample Engineering Practice',
  },
  // Linear Algebra
  {
    id: 'ex-la-1',
    topic: 'Linear Algebra',
    examStyle: 'aktu',
    sectionLabel: 'Section A · 2 Marks (Sample)',
    marks: 2,
    questionType: 'numerical',
    prompt: 'For A = [[4, 1], [2, 3]], compute the sum of the eigenvalues (trace of A).',
    expressionLatex: 'A = \\begin{bmatrix} 4 & 1 \\\\ 2 & 3 \\end{bmatrix},\\quad \\lambda_1 + \\lambda_2 = \\text{tr}(A)',
    numericAnswer: 7,
    tolerance: 0.01,
    answerHint: 'The sum of eigenvalues equals the trace 4 + 3 = 7.',
    explanationLatex: '\\lambda_1 + \\lambda_2 = a_{11} + a_{22} = 4 + 3 = 7',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-la-2',
    topic: 'Linear Algebra',
    examStyle: 'aktu',
    sectionLabel: 'Section B · 7 Marks (Sample)',
    marks: 7,
    questionType: 'mcq',
    prompt: 'What is the rank of the 3×3 matrix [[1, 2, 3], [2, 4, 6], [0, 1, 1]]?',
    expressionLatex: '\\text{rank}\\begin{bmatrix} 1 & 2 & 3 \\\\ 2 & 4 & 6 \\\\ 0 & 1 & 1 \\end{bmatrix}',
    optionsLatex: ['2', '3', '1', '0'],
    correctIndex: 0,
    explanationLatex: 'R_2 = 2R_1 \\text{ so } \\det(A)=0,\\text{ while } \\det\\begin{bmatrix}1&2\\\\0&1\\end{bmatrix}=1\\neq 0 \\implies \\text{rank}=2.',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-la-3',
    topic: 'Linear Algebra',
    examStyle: 'mock',
    sectionLabel: 'Matrix Factorizations · 5 Marks',
    marks: 5,
    questionType: 'numerical',
    prompt: 'Compute det(A) for A = [[5, 3], [2, 4]].',
    expressionLatex: '\\det\\begin{bmatrix} 5 & 3 \\\\ 2 & 4 \\end{bmatrix}',
    numericAnswer: 14,
    tolerance: 0.01,
    answerHint: 'ad - bc = 5*4 - 3*2 = 14',
    explanationLatex: '\\det(A) = 5(4) - 3(2) = 20 - 6 = 14',
    sourceLabel: 'Sample Engineering Practice',
  },
  // Numerical Methods
  {
    id: 'ex-nm-1',
    topic: 'Numerical Methods',
    examStyle: 'aktu',
    sectionLabel: 'Section A · 2 Marks (Sample)',
    marks: 2,
    questionType: 'mcq',
    prompt: 'What is the order of convergence of the standard Newton-Raphson method for a simple root?',
    expressionLatex: 'x_{n+1} = x_n - \\frac{f(x_n)}{f\'(x_n)}',
    optionsLatex: ['Quadratic (2)', 'Linear (1)', 'Golden Ratio (1.618)', 'Cubic (3)'],
    correctIndex: 0,
    explanationLatex: '\\text{For } f\'(r) \\neq 0, |e_{n+1}| \\approx C|e_n|^2 \\text{ (quadratic convergence).}',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-nm-2',
    topic: 'Numerical Methods',
    examStyle: 'aktu',
    sectionLabel: 'Section C · 10 Marks (Sample)',
    marks: 10,
    questionType: 'numerical',
    prompt: 'Using Trapezoidal rule with n = 2 subintervals, approximate ∫₀² x² dx.',
    expressionLatex: '\\int_0^2 x^2\\,dx,\\quad n = 2,\\; h = 1',
    numericAnswer: 3,
    tolerance: 0.02,
    answerHint: '(h/2)[f(0) + 2f(1) + f(2)] = 0.5*(0 + 2 + 4) = 3',
    explanationLatex: 'T_2 = \\frac{1}{2}\\left[0^2 + 2(1^2) + 2^2\\right] = 0.5(0 + 2 + 4) = 3',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-nm-3',
    topic: 'Numerical Methods',
    examStyle: 'mock',
    sectionLabel: 'Quadrature · 5 Marks',
    marks: 5,
    questionType: 'mcq',
    prompt: "Simpson's 1/3 rule requires the number of subintervals n to be:",
    expressionLatex: '\\int_a^b f(x)\\,dx \\approx \\frac{h}{3}\\left[y_0 + 4y_1 + 2y_2 + \\dots + y_n\\right]',
    optionsLatex: ['A multiple of 2 (even)', 'A multiple of 3', 'A prime number', 'Any positive integer'],
    correctIndex: 0,
    explanationLatex: "Simpson's 1/3 fits parabolas over pairs of subintervals, so n must be even.",
    sourceLabel: 'Sample Engineering Practice',
  },
  // Probability & Statistics
  {
    id: 'ex-ps-1',
    topic: 'Probability & Statistics',
    examStyle: 'aktu',
    sectionLabel: 'Section A · 2 Marks (Sample)',
    marks: 2,
    questionType: 'numerical',
    prompt: 'For a Poisson distribution with mean λ = 3, what is its variance σ²?',
    expressionLatex: 'X \\sim \\text{Poisson}(\\lambda = 3),\\quad \\text{Var}(X) = ?',
    numericAnswer: 3,
    tolerance: 0.01,
    answerHint: 'For Poisson(λ), mean = variance = λ.',
    explanationLatex: 'E[X] = \\text{Var}(X) = \\lambda = 3',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-ps-2',
    topic: 'Probability & Statistics',
    examStyle: 'aktu',
    sectionLabel: 'Section B · 7 Marks (Sample)',
    marks: 7,
    questionType: 'numerical',
    prompt: 'A coin is tossed 4 times (p = 0.5). Compute P(X = 2) heads.',
    expressionLatex: 'P(X=2) = \\binom{4}{2}(0.5)^2(0.5)^2',
    numericAnswer: 0.375,
    tolerance: 0.01,
    answerHint: '6 * (1/16) = 0.375',
    explanationLatex: 'P(X=2) = 6 \\times \\frac{1}{16} = \\frac{3}{8} = 0.375',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-ps-3',
    topic: 'Probability & Statistics',
    examStyle: 'mock',
    sectionLabel: 'Regression · 5 Marks',
    marks: 5,
    questionType: 'mcq',
    prompt: 'If the two regression coefficients are b_yx = 0.8 and b_xy = 0.45, what is the correlation coefficient r?',
    expressionLatex: 'r = \\pm\\sqrt{b_{yx}\\cdot b_{xy}}',
    optionsLatex: ['0.6', '0.36', '0.625', '0.8'],
    correctIndex: 0,
    explanationLatex: 'r = +\\sqrt{0.8 \\times 0.45} = \\sqrt{0.36} = 0.6',
    sourceLabel: 'Sample Engineering Practice',
  },
  // Complex Analysis
  {
    id: 'ex-cx-1',
    topic: 'Complex Analysis',
    examStyle: 'aktu',
    sectionLabel: 'Section A · 2 Marks (Sample)',
    marks: 2,
    questionType: 'numerical',
    prompt: 'Find the modulus |z| of z = 3 - 4i.',
    expressionLatex: '|3 - 4i| = \\sqrt{3^2 + (-4)^2}',
    numericAnswer: 5,
    tolerance: 0.01,
    answerHint: '3-4-5 right triangle -> 5',
    explanationLatex: '|z| = \\sqrt{9 + 16} = \\sqrt{25} = 5',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-cx-2',
    topic: 'Complex Analysis',
    examStyle: 'aktu',
    sectionLabel: 'Section C · 10 Marks (Sample)',
    marks: 10,
    questionType: 'mcq',
    prompt: "By De Moivre's Theorem, evaluate (cos θ + i sin θ)⁴.",
    expressionLatex: '(\\cos\\theta + i\\sin\\theta)^4',
    optionsLatex: [
      '\\cos(4\\theta) + i\\sin(4\\theta)',
      '\\cos^4\\theta + i\\sin^4\\theta',
      '4(\\cos\\theta + i\\sin\\theta)',
      '\\cos(\\theta/4) + i\\sin(\\theta/4)',
    ],
    correctIndex: 0,
    explanationLatex: '(\\cos\\theta + i\\sin\\theta)^n = \\cos(n\\theta) + i\\sin(n\\theta)\\text{ for integer }n.',
    sourceLabel: 'AKTU-Pattern Sample Question',
  },
  {
    id: 'ex-cx-3',
    topic: 'Complex Analysis',
    examStyle: 'topic',
    sectionLabel: 'Roots of Unity · 4 Marks',
    marks: 4,
    questionType: 'mcq',
    prompt: 'What is the angle separation (in degrees) between consecutive 6th roots of a nonzero complex number?',
    expressionLatex: '\\Delta \\theta = \\frac{360^\\circ}{n},\\quad n=6',
    optionsLatex: ['60^\\circ', '45^\\circ', '90^\\circ', '72^\\circ'],
    correctIndex: 0,
    explanationLatex: '\\text{The } n \\text{ roots divide the circle equally: } \\frac{360^\\circ}{6} = 60^\\circ.',
    sourceLabel: 'Sample Engineering Practice',
  },
];

export function buildExamPaper(opts: {
  mode: 'topic' | 'mock' | 'aktu';
  topic?: string;
}): { title: string; durationMinutes: number; questions: ExamQuestion[] } {
  if (opts.mode === 'topic') {
    const selectedTopic = opts.topic || EXAM_TOPICS[0];
    const filtered = EXAM_QUESTION_BANK.filter((q) => q.topic === selectedTopic);
    return {
      title: `${selectedTopic} — Topic Practice Exam`,
      durationMinutes: 15,
      questions: filtered,
    };
  }
  if (opts.mode === 'aktu') {
    const aktuOrder = ['Section A', 'Section B', 'Section C'];
    const aktuPool = EXAM_QUESTION_BANK.filter((q) => q.examStyle === 'aktu').sort((a, b) => {
      const idxA = aktuOrder.findIndex((s) => a.sectionLabel.startsWith(s));
      const idxB = aktuOrder.findIndex((s) => b.sectionLabel.startsWith(s));
      return idxA - idxB;
    });
    return {
      title: 'AKTU-Style Engineering Math Sample Paper (Sections A, B & C)',
      durationMinutes: 35,
      questions: aktuPool,
    };
  }

  // Comprehensive Engineering Mock Test (balanced across all 6 topics)
  const picks: ExamQuestion[] = [];
  for (const t of EXAM_TOPICS) {
    const matches = EXAM_QUESTION_BANK.filter((q) => q.topic === t);
    picks.push(...matches.slice(0, 2));
  }
  return {
    title: 'Engineering Mathematics Comprehensive Mock Test',
    durationMinutes: 25,
    questions: picks,
  };
}

export function gradeExamAnswer(
  question: ExamQuestion,
  userResponse: { selectedIndex?: number; numericText?: string }
): boolean {
  if (question.questionType === 'mcq') {
    return userResponse.selectedIndex === question.correctIndex;
  }
  const parsed = Number(userResponse.numericText?.trim());
  if (!Number.isFinite(parsed) || question.numericAnswer === undefined) return false;
  return Math.abs(parsed - question.numericAnswer) <= (question.tolerance ?? 0.05);
}
