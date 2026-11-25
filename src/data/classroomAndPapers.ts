export interface ClassroomLesson {
  id: string;
  track: string;
  title: string;
  durationMinutes: number;
  summary: string;
  conceptsLatex: { heading: string; explanation: string; latex: string }[];
  workedExample: {
    problem: string;
    steps: { label: string; latex: string }[];
    answerLatex: string;
  };
  interactiveDemo: {
    kind: 'sine-fourier' | 'damped-ode' | 'eigen-scale' | 'conic-eccentricity';
    title: string;
    paramLabel: string;
    min: number;
    max: number;
    step: number;
    defaultVal: number;
  };
  knowledgeCheck: {
    prompt: string;
    expressionLatex: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

export const CLASSROOM_LESSONS: ClassroomLesson[] = [
  {
    id: 'lesson-grad-tangent',
    track: 'Multivariable Calculus',
    title: 'Gradients, Directional Derivatives & Tangent Planes',
    durationMinutes: 15,
    summary:
      'Connect partial derivatives into the gradient vector field and understand why ∇f points in the direction of steepest ascent orthogonal to level curves.',
    conceptsLatex: [
      {
        heading: 'Gradient Vector',
        explanation: 'Collects all first-order partial derivatives into a Euclidean vector.',
        latex: '\\nabla f(x, y) = \\left\\langle \\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y} \\right\\rangle',
      },
      {
        heading: 'Directional Derivative',
        explanation: 'Rate of change along unit vector û equals the projection of ∇f onto û.',
        latex: 'D_{\\hat{u}} f(x_0, y_0) = \\nabla f(x_0, y_0) \\cdot \\hat{u},\\quad \\|\\hat{u}\\| = 1',
      },
    ],
    workedExample: {
      problem: 'Find the maximum rate of increase of f(x, y) = x²y + 3y at (2, 1).',
      steps: [
        { label: 'Compute partials', latex: 'f_x = 2xy,\\quad f_y = x^2 + 3' },
        { label: 'Evaluate at (2,1)', latex: '\\nabla f(2,1) = \\langle 4, 7 \\rangle' },
        { label: 'Take magnitude', latex: '\\|\\nabla f(2,1)\\| = \\sqrt{4^2 + 7^2} = \\sqrt{65}' },
      ],
      answerLatex: '\\text{Max slope} = \\sqrt{65} \\approx 8.062',
    },
    interactiveDemo: {
      kind: 'conic-eccentricity',
      title: 'Level Curves of x² + k·y² = 4',
      paramLabel: 'Anisotropy k',
      min: 0.4,
      max: 4,
      step: 0.2,
      defaultVal: 1.6,
    },
    knowledgeCheck: [
      {
        prompt: 'At any regular point, the gradient vector ∇f(x₀, y₀) is always:',
        expressionLatex: '\\nabla f(x_0, y_0) \\cdot \\mathbf{r}\'(t_0) = 0',
        options: [
          'Perpendicular to the level curve f(x, y) = c',
          'Tangent to the level curve f(x, y) = c',
          'Equal to zero whenever f is increasing',
          'Parallel to the x-axis',
        ],
        correctIndex: 0,
        explanation: 'Differentiating f(r(t)) = c yields ∇f · r′(t) = 0, proving orthogonality.',
      },
      {
        prompt: 'What is D_û f(1, 0) for f(x, y) = x³ - y² along û = ⟨0, 1⟩?',
        expressionLatex: '\\nabla f = \\langle 3x^2, -2y \\rangle',
        options: ['0', '3', '-2', '1'],
        correctIndex: 0,
        explanation: 'At (1, 0), ∇f = ⟨3, 0⟩, and ⟨3, 0⟩ · ⟨0, 1⟩ = 0.',
      },
    ],
  },
  {
    id: 'lesson-ode-damping',
    track: 'Differential Equations',
    title: 'Second-Order Linear ODEs & Damped Oscillations',
    durationMinutes: 18,
    summary:
      'Analyze characteristic roots of my′′ + cy′ + ky = 0 across underdamped, critically damped, and overdamped regimes.',
    conceptsLatex: [
      {
        heading: 'Characteristic Polynomial',
        explanation: 'Substitute y = e^{rt} to convert differential equations into algebraic roots.',
        latex: 'r^2 + 2\\zeta\\omega_0 r + \\omega_0^2 = 0',
      },
      {
        heading: 'Damping Regimes',
        explanation: 'Discriminant ζ² − 1 separates oscillatory decay from monotonic decay.',
        latex: '\\zeta < 1 \\;(\\text{Underdamped}),\\quad \\zeta = 1 \\;(\\text{Critical}),\\quad \\zeta > 1 \\;(\\text{Overdamped})',
      },
    ],
    workedExample: {
      problem: 'Solve y′′ + 4y′ + 13y = 0 with y(0) = 2, y′(0) = 0.',
      steps: [
        { label: 'Characteristic roots', latex: 'r^2 + 4r + 13 = 0 \\implies r = -2 \\pm 3i' },
        { label: 'General solution', latex: 'y(t) = e^{-2t}(C_1 \\cos 3t + C_2 \\sin 3t)' },
        { label: 'Apply initial values', latex: 'C_1 = 2,\\quad -2(2) + 3C_2 = 0 \\implies C_2 = \\frac{4}{3}' },
      ],
      answerLatex: 'y(t) = e^{-2t}\\left(2\\cos 3t + \\frac{4}{3}\\sin 3t\\right)',
    },
    interactiveDemo: {
      kind: 'damped-ode',
      title: 'Damped Harmonic Response y′′ + 2ζω₀y′ + ω₀²y = 0 (ω₀ = 3)',
      paramLabel: 'Damping Ratio ζ',
      min: 0.05,
      max: 1.8,
      step: 0.05,
      defaultVal: 0.25,
    },
    knowledgeCheck: [
      {
        prompt: 'Which root pair produces sustained simple harmonic motion with zero decay?',
        expressionLatex: 'y\'\' + \\omega_0^2 y = 0',
        options: ['Pure imaginary ±iω₀', 'Distinct negative real roots', 'Repeated positive roots', 'Complex −α ± iω with α > 0'],
        correctIndex: 0,
        explanation: 'Pure imaginary roots ±iω₀ produce cos(ω₀t) and sin(ω₀t) without exponential decay.',
      },
    ],
  },
  {
    id: 'lesson-fourier-harmonics',
    track: 'Transforms & Signals',
    title: 'Fourier Series & Spectral Reconstruction',
    durationMinutes: 16,
    summary:
      'Decompose periodic waveforms into orthogonal sine/cosine harmonics and observe Gibbs phenomenon as partial sums increase.',
    conceptsLatex: [
      {
        heading: 'Fourier Expansion',
        explanation: 'Any piecewise-smooth 2L-periodic signal decomposes into orthogonal harmonics.',
        latex: 'f(t) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty} \\left(a_n \\cos\\frac{n\\pi t}{L} + b_n \\sin\\frac{n\\pi t}{L}\\right)',
      },
      {
        heading: 'Square Wave Odd Harmonics',
        explanation: 'Odd symmetry eliminates cosine terms and retains only odd sine harmonics.',
        latex: 'f(t) = \\frac{4}{\\pi}\\sum_{k=0}^{\\infty} \\frac{\\sin((2k+1)t)}{2k+1}',
      },
    ],
    workedExample: {
      problem: 'Explain why a_n = 0 for every odd periodic function f(−t) = −f(t).',
      steps: [
        { label: 'Integrand parity', latex: 'f(t)\\cos\\left(\\frac{n\\pi t}{L}\\right) = (\\text{odd})\\cdot(\\text{even}) = \\text{odd}' },
        { label: 'Symmetric integral', latex: 'a_n = \\frac{1}{L}\\int_{-L}^{L} (\\text{odd})\\,dt = 0' },
      ],
      answerLatex: 'a_n = 0 \\;\\forall\\, n \\ge 0',
    },
    interactiveDemo: {
      kind: 'sine-fourier',
      title: 'Square-Wave Partial Sum Approximation',
      paramLabel: 'Number of Harmonics N',
      min: 1,
      max: 15,
      step: 1,
      defaultVal: 5,
    },
    knowledgeCheck: [
      {
        prompt: 'Near a jump discontinuity of height Δ, what happens to the Fourier partial sum overshoot as N → ∞?',
        expressionLatex: '\\text{Gibbs Overshoot}',
        options: [
          'Approaches ~9% of the jump height Δ',
          'Grows unboundedly toward infinity',
          'Vanishes completely at N = 10',
          'Turns into a strictly monotone ramp',
        ],
        correctIndex: 0,
        explanation: 'By the Gibbs phenomenon, overshoot narrows in width but converges to ≈ 8.95% of Δ.',
      },
    ],
  },
  {
    id: 'lesson-linear-eigen',
    track: 'Linear Algebra',
    title: 'Eigenvalues, Eigenvectors & Matrix Geometry',
    durationMinutes: 14,
    summary:
      'Interpret Av = λv geometrically as invariant directions scaled by λ, and connect det(A) to area scaling.',
    conceptsLatex: [
      {
        heading: 'Eigenvalue Equation',
        explanation: 'Non-zero vectors v remain on their span under linear map A.',
        latex: 'A\\mathbf{v} = \\lambda\\mathbf{v} \\iff \\det(A - \\lambda I) = 0',
      },
      {
        heading: 'Trace & Determinant Identities',
        explanation: 'Eigenvalue sum and product always match trace and determinant.',
        latex: '\\sum \\lambda_i = \\operatorname{tr}(A),\\quad \\prod \\lambda_i = \\det(A)',
      },
    ],
    workedExample: {
      problem: 'Find eigenvalues of A = [[3, 1], [0, 2]].',
      steps: [
        { label: 'Characteristic polynomial', latex: '\\det(A - \\lambda I) = (3 - \\lambda)(2 - \\lambda) = 0' },
        { label: 'Solve roots', latex: '\\lambda_1 = 3,\\quad \\lambda_2 = 2' },
      ],
      answerLatex: '\\lambda \\in \\{3, 2\\}',
    },
    interactiveDemo: {
      kind: 'eigen-scale',
      title: 'Shear-Scale Matrix [[2, k], [0, 1.4]] Unit Square Deformation',
      paramLabel: 'Shear Factor k',
      min: -2,
      max: 2,
      step: 0.2,
      defaultVal: 0.8,
    },
    knowledgeCheck: [
      {
        prompt: 'If a 2×2 matrix has eigenvalues λ₁ = 4 and λ₂ = −2, what is det(A)?',
        expressionLatex: '\\det(A) = \\lambda_1 \\lambda_2',
        options: ['-8', '2', '8', '-2'],
        correctIndex: 0,
        explanation: 'The determinant equals the product of eigenvalues: 4 × (−2) = −8.',
      },
    ],
  },
];

// ---------------- Custom Question Paper Generator ----------------

export type PaperQuestionType = 'mcq' | 'numerical' | 'descriptive';
export type PaperDifficulty = 'easy' | 'medium' | 'hard';

export interface PaperQuestionItem {
  id: string;
  topic: string;
  difficulty: PaperDifficulty;
  qType: PaperQuestionType;
  marks: number;
  prompt: string;
  expressionLatex: string;
  optionsLatex?: string[];
  answerText: string;
  solutionLatex: string;
  sourceNote: string;
}

export const PAPER_TOPICS = [
  'Multivariable Calculus',
  'Differential Equations',
  'Linear Algebra',
  'Discrete Mathematics',
  'Fourier & Laplace Transforms',
  'Operations Research',
  'Numerical Methods',
  'Probability & Statistics',
  'Complex Analysis',
  'Advanced Geometry',
] as const;

export const PAPER_QUESTION_POOL: PaperQuestionItem[] = [
  {
    id: 'qp-1',
    topic: 'Multivariable Calculus',
    difficulty: 'easy',
    qType: 'mcq',
    marks: 2,
    prompt: 'Evaluate ∂f/∂x at (1, 2) for f(x, y) = 3x²y + cos(y).',
    expressionLatex: 'f(x, y) = 3x^2y + \\cos(y)',
    optionsLatex: ['12', '6', '3', '12 - \\sin(2)'],
    answerText: '12',
    solutionLatex: 'f_x = 6xy \\implies f_x(1,2) = 6(1)(2) = 12',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-2',
    topic: 'Multivariable Calculus',
    difficulty: 'medium',
    qType: 'numerical',
    marks: 5,
    prompt: 'Compute the Laplacian ∇²f at (1, 1) for f(x, y) = x³ + 2xy².',
    expressionLatex: '\\nabla^2 f = f_{xx} + f_{yy}',
    answerText: '10',
    solutionLatex: 'f_{xx} = 6x,\\; f_{yy} = 4x \\implies \\nabla^2 f = 10x \\implies \\nabla^2 f(1,1) = 10',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-3',
    topic: 'Multivariable Calculus',
    difficulty: 'hard',
    qType: 'descriptive',
    marks: 10,
    prompt: 'Use Lagrange Multipliers to extremize f(x, y) = xy subject to x² + 4y² = 8.',
    expressionLatex: '\\nabla f = \\lambda \\nabla g,\\quad g(x, y) = x^2 + 4y^2 - 8 = 0',
    answerText: 'Maximum = 2 at (±2, ±1); Minimum = -2 at (±2, ∓1).',
    solutionLatex: 'y = 2\\lambda x,\\; x = 8\\lambda y \\implies x^2 = 4y^2 \\implies x=\\pm 2, y=\\pm 1,\\; f_{\\max}=2',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-4',
    topic: 'Differential Equations',
    difficulty: 'easy',
    qType: 'mcq',
    marks: 2,
    prompt: 'Identify the order and degree of (y′′)² + 3y′ − y = sin(x).',
    expressionLatex: "(y'')^2 + 3y' - y = \\sin(x)",
    optionsLatex: ['Order 2, Degree 2', 'Order 2, Degree 1', 'Order 1, Degree 2', 'Order 3, Degree 2'],
    answerText: 'Order 2, Degree 2',
    solutionLatex: '\\text{Highest derivative is } y\'\' \\text{ (order 2) raised to power 2 (degree 2).}',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-5',
    topic: 'Differential Equations',
    difficulty: 'medium',
    qType: 'numerical',
    marks: 5,
    prompt: 'Solve dy/dx = 2y with y(0) = 3. Compute y(1) to two decimals.',
    expressionLatex: "y' = 2y,\\quad y(0) = 3",
    answerText: '22.17',
    solutionLatex: 'y(x) = 3e^{2x} \\implies y(1) = 3e^2 \\approx 22.1672',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-6',
    topic: 'Differential Equations',
    difficulty: 'hard',
    qType: 'descriptive',
    marks: 10,
    prompt: 'Derive the general solution to y′′ − 5y′ + 6y = e^{4x} using undetermined coefficients.',
    expressionLatex: "y'' - 5y' + 6y = e^{4x}",
    answerText: 'y(x) = C₁e^{2x} + C₂e^{3x} + (1/2)e^{4x}',
    solutionLatex: 'r^2-5r+6=0 \\implies r=2,3;\\; y_p = Ae^{4x} \\implies (16-20+6)A=1 \\implies A=\\frac{1}{2}',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-7',
    topic: 'Linear Algebra',
    difficulty: 'easy',
    qType: 'mcq',
    marks: 2,
    prompt: 'What is the rank of the 3×3 matrix [[1, 2, 3], [2, 4, 6], [0, 0, 1]]?',
    expressionLatex: 'A = \\begin{bmatrix} 1 & 2 & 3 \\\\ 2 & 4 & 6 \\\\ 0 & 0 & 1 \\end{bmatrix}',
    optionsLatex: ['2', '3', '1', '0'],
    answerText: '2',
    solutionLatex: 'R_2 = 2R_1 \\text{ reduces to zero; two non-zero pivot rows remain, so } \\operatorname{rank}(A)=2.',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-8',
    topic: 'Linear Algebra',
    difficulty: 'medium',
    qType: 'numerical',
    marks: 5,
    prompt: 'For A = [[5, 2], [2, 2]], find the largest eigenvalue λ_max.',
    expressionLatex: '\\det(A - \\lambda I) = \\lambda^2 - 7\\lambda + 6 = 0',
    answerText: '6',
    solutionLatex: '(\\lambda - 6)(\\lambda - 1) = 0 \\implies \\lambda_{\\max} = 6',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-9',
    topic: 'Linear Algebra',
    difficulty: 'hard',
    qType: 'descriptive',
    marks: 10,
    prompt: 'Factor A = [[2, 1], [4, 5]] into PA = LU and solve Ax = [4, 14]ᵀ.',
    expressionLatex: 'A = \\begin{bmatrix}2 & 1\\\\ 4 & 5\\end{bmatrix},\\quad b = \\begin{bmatrix}4\\\\ 14\\end{bmatrix}',
    answerText: 'L = [[1,0],[2,1]], U = [[2,1],[0,3]], x = [1, 2]ᵀ',
    solutionLatex: 'Ly = b \\implies y=[4, 6]^T;\\; Ux = y \\implies x_2=2, x_1=1',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-10',
    topic: 'Discrete Mathematics',
    difficulty: 'easy',
    qType: 'mcq',
    marks: 2,
    prompt: 'If |A| = 5, how many subsets are in the power set P(A)?',
    expressionLatex: '|\\mathcal{P}(A)| = 2^{|A|}',
    optionsLatex: ['32', '25', '16', '64'],
    answerText: '32',
    solutionLatex: '2^5 = 32',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-11',
    topic: 'Discrete Mathematics',
    difficulty: 'medium',
    qType: 'numerical',
    marks: 5,
    prompt: 'Find a₄ for the Fibonacci-type recurrence aₙ = 2aₙ₋₁ + aₙ₋₂ with a₀ = 1, a₁ = 1.',
    expressionLatex: 'a_n = 2a_{n-1} + a_{n-2}',
    answerText: '17',
    solutionLatex: 'a_2 = 3,\\; a_3 = 7,\\; a_4 = 2(7)+3 = 17',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-12',
    topic: 'Discrete Mathematics',
    difficulty: 'hard',
    qType: 'descriptive',
    marks: 10,
    prompt: 'Prove by mathematical induction that ∑_{k=1}^n (2k − 1) = n² for all integers n ≥ 1.',
    expressionLatex: '\\sum_{k=1}^{n} (2k - 1) = n^2',
    answerText: 'Base case 1 = 1² holds; inductive step adds (2(k+1)−1) = 2k+1 to k² yielding (k+1)².',
    solutionLatex: 'k^2 + (2k+1) = (k+1)^2',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-13',
    topic: 'Fourier & Laplace Transforms',
    difficulty: 'easy',
    qType: 'mcq',
    marks: 2,
    prompt: 'Compute the Laplace transform L{e^{-4t} cos(2t)}.',
    expressionLatex: '\\mathcal{L}\\{e^{-4t}\\cos(2t)\\}',
    optionsLatex: [
      '\\frac{s+4}{(s+4)^2 + 4}',
      '\\frac{2}{(s+4)^2 + 4}',
      '\\frac{s-4}{(s-4)^2 + 4}',
      '\\frac{1}{s+4}',
    ],
    answerText: '(s+4) / ((s+4)² + 4)',
    solutionLatex: '\\text{Shift } s \\to s+4 \\text{ in } \\mathcal{L}\\{\\cos(2t)\\} = \\frac{s}{s^2+4}',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-14',
    topic: 'Fourier & Laplace Transforms',
    difficulty: 'medium',
    qType: 'numerical',
    marks: 5,
    prompt: 'For f(t) = 3 + 2cos(t) on [-π, π], determine the Fourier constant a₀.',
    expressionLatex: 'a_0 = \\frac{1}{\\pi}\\int_{-\\pi}^{\\pi} (3 + 2\\cos t)\\,dt',
    answerText: '6',
    solutionLatex: '\\frac{1}{\\pi}\\left[3t + 2\\sin t\\right]_{-\\pi}^{\\pi} = \\frac{6\\pi}{\\pi} = 6',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-15',
    topic: 'Fourier & Laplace Transforms',
    difficulty: 'hard',
    qType: 'descriptive',
    marks: 10,
    prompt: 'Find the inverse Laplace transform of F(s) = (3s + 7) / (s² + 2s − 3) using partial fractions.',
    expressionLatex: 'F(s) = \\frac{3s + 7}{(s-1)(s+3)}',
    answerText: 'f(t) = 2.5e^t + 0.5e^{-3t}',
    solutionLatex: 'F(s) = \\frac{2.5}{s-1} + \\frac{0.5}{s+3} \\implies f(t) = 2.5e^t + 0.5e^{-3t}',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-16',
    topic: 'Operations Research',
    difficulty: 'easy',
    qType: 'mcq',
    marks: 2,
    prompt: 'In the Simplex method for maximization, optimality is reached when all objective-row reduced costs (Zⱼ − Cⱼ) are:',
    expressionLatex: 'Z_j - C_j \\ge 0',
    optionsLatex: ['Non-negative (≥ 0)', 'Strictly negative (< 0)', 'Equal to RHS values', 'Imaginary'],
    answerText: 'Non-negative (≥ 0)',
    solutionLatex: 'When Z_j - C_j \\ge 0 \\text{ for all non-basic variables, no entering variable can increase Z.}',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-17',
    topic: 'Operations Research',
    difficulty: 'medium',
    qType: 'numerical',
    marks: 5,
    prompt: 'Maximize Z = 5x + 4y subject to x + y ≤ 6, x ≤ 4, x, y ≥ 0. Find Z*.',
    expressionLatex: '\\max Z = 5x + 4y',
    answerText: '28',
    solutionLatex: '\\text{At vertex } (4, 2):\\; Z = 5(4) + 4(2) = 28',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-18',
    topic: 'Operations Research',
    difficulty: 'hard',
    qType: 'descriptive',
    marks: 10,
    prompt: 'Apply Vogel’s Approximation Method (VAM) and explain how opportunity penalties select allocations in a balanced transportation matrix.',
    expressionLatex: '\\min \\sum_{i,j} c_{ij} x_{ij}',
    answerText: 'Select highest penalty row/column each step and allocate maximally to lowest-cost cell.',
    solutionLatex: 'p_i = c_{i,(2)} - c_{i,(1)}',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-19',
    topic: 'Numerical Methods',
    difficulty: 'easy',
    qType: 'mcq',
    marks: 2,
    prompt: 'What is the order of convergence of the Newton-Raphson method for a simple root?',
    expressionLatex: 'x_{n+1} = x_n - \\frac{f(x_n)}{f\'(x_n)}',
    optionsLatex: ['Quadratic (order 2)', 'Linear (order 1)', 'Order 1.618', 'Cubic (order 3)'],
    answerText: 'Quadratic (order 2)',
    solutionLatex: '|e_{n+1}| \\approx C |e_n|^2',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-20',
    topic: 'Numerical Methods',
    difficulty: 'medium',
    qType: 'numerical',
    marks: 5,
    prompt: "Approximate ∫₀² x³ dx using Trapezoidal Rule with n = 2 subintervals.",
    expressionLatex: 'T_2 = \\frac{h}{2}[f(0) + 2f(1) + f(2)],\\; h = 1',
    answerText: '5',
    solutionLatex: 'T_2 = \\frac{1}{2}[0 + 2(1) + 8] = 5',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-21',
    topic: 'Probability & Statistics',
    difficulty: 'easy',
    qType: 'mcq',
    marks: 2,
    prompt: 'If X ~ Poisson(λ = 4), what is Var(X)?',
    expressionLatex: 'X \\sim \\text{Poisson}(4)',
    optionsLatex: ['4', '2', '16', '1'],
    answerText: '4',
    solutionLatex: '\\text{For Poisson}(\\lambda),\\; \\mathbb{E}[X] = \\operatorname{Var}(X) = \\lambda = 4',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-22',
    topic: 'Probability & Statistics',
    difficulty: 'medium',
    qType: 'numerical',
    marks: 5,
    prompt: 'Compute sample variance s² for data {2, 4, 6, 8}.',
    expressionLatex: 's^2 = \\frac{1}{n-1}\\sum (x_i - \\bar{x})^2',
    answerText: '6.667',
    solutionLatex: '\\bar{x}=5,\\; \\sum(x_i-5)^2 = 9+1+1+9 = 20,\\; s^2 = 20/3 \\approx 6.6667',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-23',
    topic: 'Complex Analysis',
    difficulty: 'easy',
    qType: 'mcq',
    marks: 2,
    prompt: 'Express z = −1 + i√3 in polar form r·e^{iθ} with θ ∈ (−π, π].',
    expressionLatex: 'z = -1 + i\\sqrt{3}',
    optionsLatex: ['2 e^{i 2\\pi/3}', '2 e^{i \\pi/3}', '2 e^{-i 2\\pi/3}', '\\sqrt{2} e^{i 2\\pi/3}'],
    answerText: '2 e^{i 2π/3}',
    solutionLatex: 'r = \\sqrt{1 + 3} = 2,\\; \\theta = \\pi - \\frac{\\pi}{3} = \\frac{2\\pi}{3}',
    sourceNote: 'Custom Generated Sample Item',
  },
  {
    id: 'qp-24',
    topic: 'Advanced Geometry',
    difficulty: 'medium',
    qType: 'numerical',
    marks: 5,
    prompt: 'Find the perpendicular distance from point (1, 2, 2) to the plane 2x + 2y + z = 12.',
    expressionLatex: 'd = \\frac{|ax_0 + by_0 + cz_0 - d|}{\\sqrt{a^2+b^2+c^2}}',
    answerText: '1.333',
    solutionLatex: 'd = \\frac{|2(1) + 2(2) + 2 - 12|}{\\sqrt{4+4+1}} = \\frac{4}{3} \\approx 1.333',
    sourceNote: 'Custom Generated Sample Item',
  },
];

export function generateCustomQuestionPaper(opts: {
  title: string;
  topics: string[];
  difficultyMix: 'balanced' | PaperDifficulty;
  targetMarks: number;
  durationMinutes: number;
  includeMcq: boolean;
  includeNumerical: boolean;
  includeDescriptive: boolean;
  seed?: number;
}) {
  const allowedTypes: PaperQuestionType[] = [];
  if (opts.includeMcq) allowedTypes.push('mcq');
  if (opts.includeNumerical) allowedTypes.push('numerical');
  if (opts.includeDescriptive) allowedTypes.push('descriptive');
  if (allowedTypes.length === 0) allowedTypes.push('mcq', 'numerical');

  const pool = PAPER_QUESTION_POOL.filter((q) => {
    const topicOk = opts.topics.length === 0 || opts.topics.includes(q.topic);
    const typeOk = allowedTypes.includes(q.qType);
    const diffOk = opts.difficultyMix === 'balanced' || q.difficulty === opts.difficultyMix;
    return topicOk && typeOk && diffOk;
  });

  // Fallback gracefully if strict filter yields too few
  const effectivePool =
    pool.length >= 3
      ? pool
      : PAPER_QUESTION_POOL.filter(
          (q) =>
            (opts.topics.length === 0 || opts.topics.includes(q.topic)) &&
            allowedTypes.includes(q.qType)
        );

  const sourcePool = effectivePool.length > 0 ? [...effectivePool] : [...PAPER_QUESTION_POOL];
  const s = opts.seed ?? 1;
  sourcePool.sort((a, b) => {
    const ha = (a.id.charCodeAt(a.id.length - 1) * 31 + s * 17) % 97;
    const hb = (b.id.charCodeAt(b.id.length - 1) * 31 + s * 17) % 97;
    return ha - hb;
  });

  const selected: PaperQuestionItem[] = [];
  let accumulated = 0;
  for (const item of sourcePool) {
    if (accumulated >= opts.targetMarks) break;
    if (accumulated + item.marks <= opts.targetMarks + 3 || selected.length < 3) {
      selected.push(item);
      accumulated += item.marks;
    }
  }

  return {
    title: opts.title.trim() || 'Engineering Mathematics Custom Practice Paper',
    durationMinutes: Math.max(10, opts.durationMinutes),
    totalMarks: selected.reduce((sum, q) => sum + q.marks, 0),
    questions: selected,
    generatedAt: Date.now(),
  };
}
