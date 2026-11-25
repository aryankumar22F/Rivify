import type { CoreCalcToolId } from '../types';

export interface FormulaEntry {
  id: string;
  category:
    | 'Limits and Continuity'
    | 'Differentiation'
    | 'Partial Derivatives'
    | 'Vector Calculus'
    | 'Integration'
    | 'Multiple Integrals'
    | 'Coordinate Transformations'
    | 'Optimization'
    | 'Vector Calculus Theorems'
    | 'Linear Algebra';
  subtopic: string;
  title: string;
  formulaLatex: string;
  note: string;
  symbols: string;
  conditions: string;
  example: {
    problemLatex: string;
    solutionLatex: string;
  };
  tryExample?: {
    tool: CoreCalcToolId;
    expr: string;
    secondary?: string;
  };
}

export const FORMULA_CATEGORIES = [
  'All',
  'Favorites',
  'Limits and Continuity',
  'Differentiation',
  'Partial Derivatives',
  'Vector Calculus',
  'Integration',
  'Multiple Integrals',
  'Coordinate Transformations',
  'Optimization',
  'Vector Calculus Theorems',
  'Linear Algebra',
] as const;

export const FORMULA_SHEET: FormulaEntry[] = [
  // 1. Limits and Continuity
  {
    id: 'f-lim-multi',
    category: 'Limits and Continuity',
    subtopic: 'Epsilon-Delta & Path Independence',
    title: 'Multivariable Limit Definition',
    formulaLatex:
      '\\lim_{(x,y)\\to(a,b)} f(x,y) = L \\iff \\forall\\varepsilon>0,\\; \\exists\\delta>0:\\; 0<\\sqrt{(x-a)^2+(y-b)^2}<\\delta \\implies |f(x,y)-L|<\\varepsilon',
    note: 'A limit exists only if f(x, y) approaches the exact same number L along every conceivable path to (a, b).',
    symbols: 'L = limit value; (a, b) = target point; δ = neighborhood radius; ε = tolerance.',
    conditions: 'f must be defined in a punctured disk around (a, b).',
    example: {
      problemLatex: '\\lim_{(x,y)\\to(0,0)} \\frac{x^2 y}{x^2 + y^2}',
      solutionLatex: '\\left|\\frac{x^2 y}{x^2+y^2}\\right| \\le |y| \\to 0 \\implies L = 0',
    },
  },
  {
    id: 'f-cont-multi',
    category: 'Limits and Continuity',
    subtopic: 'Pointwise Continuity',
    title: 'Multivariable Continuity Criterion',
    formulaLatex: '\\lim_{(x,y)\\to(a,b)} f(x,y) = f(a,b)',
    note: 'Requires f(a, b) to exist, the limit to exist independently of approach path, and both values to match.',
    symbols: 'f(a, b) = function value evaluated at (a, b).',
    conditions: 'Sums, products, compositions, and non-zero quotients of continuous functions remain continuous.',
    example: {
      problemLatex: '\\text{Check } f(x,y) = \\frac{x^2-y^2}{x^2+y^2} \\text{ at } (0,0)',
      solutionLatex: 'y=0 \\to 1,\\; x=0 \\to -1 \\implies \\text{Limit DNE (Discontinuous)}',
    },
  },

  // 2. Differentiation
  {
    id: 'f-power',
    category: 'Differentiation',
    subtopic: 'Basic Derivative Rules',
    title: 'Power, Product & Quotient Rules',
    formulaLatex:
      '\\frac{d}{dx}(x^n)=n x^{n-1},\\quad (uv)\'=u\'v+uv\',\\quad \\left(\\frac{u}{v}\\right)\'=\\frac{u\'v-uv\'}{v^2}',
    note: 'Core algebraic differentiation rules applied recursively over expression trees.',
    symbols: 'n ∈ ℝ = exponent; u, v = differentiable functions of x.',
    conditions: 'Quotient rule requires v(x) ≠ 0.',
    example: {
      problemLatex: '\\frac{d}{dx}\\left(x\\sin(2x)\\right)',
      solutionLatex: '\\sin(2x) + 2x\\cos(2x)',
    },
    tryExample: { tool: 'partial-derivative', expr: 'x*sin(x*y)', secondary: 'x' },
  },
  {
    id: 'f-chain-implicit',
    category: 'Differentiation',
    subtopic: 'Chain Rule & Implicit Differentiation',
    title: 'Implicit Differentiation (2D Curve)',
    formulaLatex: 'F(x, y) = 0 \\implies \\frac{dy}{dx} = -\\frac{F_x}{F_y}',
    note: 'Directly differentiates level curves without isolating y explicitly.',
    symbols: 'F_x = ∂F/∂x; F_y = ∂F/∂y.',
    conditions: 'Requires F ∈ C¹ and F_y(x, y) ≠ 0 near the point.',
    example: {
      problemLatex: 'x^2 + y^2 = 25 \\text{ at } (3, 4)',
      solutionLatex: '\\frac{dy}{dx} = -\\frac{2x}{2y} = -\\frac{x}{y} = -\\frac{3}{4}',
    },
  },

  // 3. Partial Derivatives
  {
    id: 'f-clairaut',
    category: 'Partial Derivatives',
    subtopic: 'Mixed Partials & Symmetry',
    title: 'Clairaut’s Theorem',
    formulaLatex: '\\frac{\\partial^2 f}{\\partial y \\partial x} = \\frac{\\partial^2 f}{\\partial x \\partial y}',
    note: 'Order of mixed partial differentiation does not affect the result for smooth surfaces.',
    symbols: 'f_{xy} = ∂/∂y(∂f/∂x); f_{yx} = ∂/∂x(∂f/∂y).',
    conditions: 'Both f_xy and f_yx must be continuous on an open disk containing (a, b).',
    example: {
      problemLatex: 'f(x,y) = e^x\\sin(y)',
      solutionLatex: 'f_{xy} = f_{yx} = e^x\\cos(y)',
    },
    tryExample: { tool: 'partial-derivative', expr: '2*x^2*y^3', secondary: 'x' },
  },
  {
    id: 'f-chain-multi',
    category: 'Partial Derivatives',
    subtopic: 'Multivariable Chain Rule & Total Differential',
    title: 'Chain Rule & Total Derivative',
    formulaLatex:
      '\\frac{df}{dt} = \\frac{\\partial f}{\\partial x}\\frac{dx}{dt} + \\frac{\\partial f}{\\partial y}\\frac{dy}{dt}, \\qquad df = f_x\\,dx + f_y\\,dy',
    note: 'Combines partial rates of change along parameterized curves or infinitesimal displacements.',
    symbols: 'df = total differential; dx, dy = coordinate increments; t = curve parameter.',
    conditions: 'f must be differentiable and x(t), y(t) differentiable at t.',
    example: {
      problemLatex: 'f(x,y)=x^2 y,\\; x=t^2,\\; y=t^3',
      solutionLatex: '\\frac{df}{dt} = (2xy)(2t) + x^2(3t^2) = 7t^6',
    },
  },
  {
    id: 'f-tangent',
    category: 'Partial Derivatives',
    subtopic: 'Tangent Planes & Linearization',
    title: 'Tangent Plane Approximation',
    formulaLatex: 'L(x, y) = f(x_0, y_0) + f_x(x_0, y_0)(x - x_0) + f_y(x_0, y_0)(y - y_0)',
    note: 'Provides the first-order affine approximation to surface z = f(x, y) near (x₀, y₀).',
    symbols: '(x₀, y₀) = base point; f_x, f_y = first partial derivatives.',
    conditions: 'Requires f to be differentiable at (x₀, y₀).',
    example: {
      problemLatex: 'f(x,y)=x^2+2y^2 \\text{ at } (1,1)',
      solutionLatex: 'L(x,y) = 3 + 2(x-1) + 4(y-1)',
    },
    tryExample: { tool: 'linear-approximation', expr: 'x^2 + 2*y^2' },
  },

  // 4. Vector Calculus
  {
    id: 'f-grad',
    category: 'Vector Calculus',
    subtopic: 'Gradient & Directional Derivatives',
    title: 'Gradient Vector & Directional Derivative',
    formulaLatex:
      '\\nabla f = \\left\\langle \\frac{\\partial f}{\\partial x},\\; \\frac{\\partial f}{\\partial y},\\; \\frac{\\partial f}{\\partial z} \\right\\rangle, \\qquad D_{\\mathbf{u}}f = \\nabla f \\cdot \\mathbf{u}',
    note: '∇f points in the direction of steepest ascent and is perpendicular to level curves/surfaces.',
    symbols: 'u = v / ||v|| unit direction vector; D_u f = directional rate of change.',
    conditions: 'u must be normalized (||u|| = 1) and f differentiable.',
    example: {
      problemLatex: 'f(x,y)=x^2+y^2 \\text{ at } (1,2),\\; \\mathbf{v}=\\langle 3,4\\rangle',
      solutionLatex: 'D_{\\mathbf{u}}f = \\langle 2,4\\rangle \\cdot \\langle \\tfrac{3}{5}, \\tfrac{4}{5}\\rangle = \\frac{22}{5}',
    },
    tryExample: { tool: 'gradient', expr: 'x^2*y + sin(y)' },
  },
  {
    id: 'f-div-curl',
    category: 'Vector Calculus',
    subtopic: 'Differential Operators on Vector Fields',
    title: 'Divergence, Curl & Surface Normal',
    formulaLatex:
      '\\nabla\\cdot\\mathbf{F} = P_x+Q_y+R_z,\\quad \\nabla\\times\\mathbf{F}=\\langle R_y-Q_z,\\; P_z-R_x,\\; Q_x-P_y\\rangle',
    note: 'Divergence measures local outward expansion; curl measures infinitesimal circulation/rotation.',
    symbols: 'F = ⟨P, Q, R⟩ vector field; N = ⟨-f_x, -f_y, 1⟩ surface normal for z = f(x,y).',
    conditions: 'P, Q, R ∈ C¹ on the domain.',
    example: {
      problemLatex: '\\mathbf{F}(x,y,z)=\\langle -y, x, z^2 \\rangle',
      solutionLatex: '\\nabla\\cdot\\mathbf{F} = 2z, \\qquad \\nabla\\times\\mathbf{F} = \\langle 0, 0, 2 \\rangle',
    },
    tryExample: { tool: 'vector-field', expr: '-y', secondary: 'x' },
  },

  // 5. Integration
  {
    id: 'f-ftc',
    category: 'Integration',
    subtopic: 'Fundamental Theorem & Antiderivatives',
    title: 'Fundamental Theorem of Calculus',
    formulaLatex: '\\int_a^b f(x)\\,dx = F(b) - F(a), \\qquad F\'(x) = f(x)',
    note: 'Connects net signed area under f(x) to evaluating any antiderivative F at the endpoints.',
    symbols: 'a, b = integration limits; F = antiderivative of f.',
    conditions: 'f is continuous on [a, b].',
    example: {
      problemLatex: '\\int_0^2 (3x^2 + 1)\\,dx',
      solutionLatex: '\\left[x^3 + x\\right]_0^2 = (8+2) - 0 = 10',
    },
  },
  {
    id: 'f-line-int',
    category: 'Integration',
    subtopic: 'Vector Work & Line Integrals',
    title: 'Line Integral of a Vector Field',
    formulaLatex: '\\int_C \\mathbf{F}\\cdot d\\mathbf{r} = \\int_a^b \\mathbf{F}(\\mathbf{r}(t))\\cdot \\mathbf{r}\'(t)\\,dt',
    note: 'Computes work done by field F along smooth oriented curve r(t).',
    symbols: 'r(t) = curve parameterization; r′(t) = tangent velocity vector.',
    conditions: 'r(t) must be piecewise C¹ over [a, b].',
    example: {
      problemLatex: '\\mathbf{F}=\\langle -y, x\\rangle,\\; \\mathbf{r}(t)=\\langle \\cos t, \\sin t\\rangle,\\; t\\in[0,2\\pi]',
      solutionLatex: '\\int_0^{2\\pi} (\\sin^2 t + \\cos^2 t)\\,dt = 2\\pi',
    },
  },

  // 6. Multiple Integrals
  {
    id: 'f-fubini',
    category: 'Multiple Integrals',
    subtopic: 'Iterated Double & Triple Integrals',
    title: 'Fubini’s Theorem on Rectangles & Boxes',
    formulaLatex: '\\iint_R f(x,y)\\,dA = \\int_c^d\\int_a^b f(x,y)\\,dx\\,dy = \\int_a^b\\int_c^d f(x,y)\\,dy\\,dx',
    note: 'Allows iterated evaluation and swapping of integration order over rectangular regions.',
    symbols: 'R = [a, b] × [c, d]; dA = dx dy.',
    conditions: 'f(x, y) is continuous (or bounded with finitely many discontinuities) on R.',
    example: {
      problemLatex: '\\int_0^1 \\int_0^2 (x^2 + y^2)\\,dy\\,dx',
      solutionLatex: '\\int_0^1 \\left(2x^2 + \\tfrac{8}{3}\\right)dx = \\frac{2}{3} + \\frac{8}{3} = \\frac{10}{3}',
    },
  },
  {
    id: 'f-surface-int',
    category: 'Multiple Integrals',
    subtopic: 'Scalar Surface Area & Integrals',
    title: 'Explicit Surface Integral (z = g(x, y))',
    formulaLatex: '\\iint_S f(x,y,z)\\,dS = \\iint_D f(x,y,g(x,y))\\sqrt{1 + g_x^2 + g_y^2}\\,dA',
    note: 'Scales planar area dA by the local slant factor √(1 + ||∇g||²).',
    symbols: 'D = shadow projection in xy-plane; dS = surface area element.',
    conditions: 'g(x, y) has continuous first partial derivatives on D.',
    example: {
      problemLatex: '\\text{Area of } z = x + 2y \\text{ over } [0,2]\\times[0,3]',
      solutionLatex: '\\int_0^3\\int_0^2 \\sqrt{1 + 1 + 4}\\,dx\\,dy = 6\\sqrt{6}',
    },
  },

  // 7. Coordinate Transformations
  {
    id: 'f-jacobian-cov',
    category: 'Coordinate Transformations',
    subtopic: 'General Change of Variables',
    title: 'Jacobian Determinant & Pullback',
    formulaLatex:
      '\\iint_R f(x,y)\\,dx\\,dy = \\iint_S f(x(u,v), y(u,v))\\left|\\frac{\\partial(x,y)}{\\partial(u,v)}\\right|\\,du\\,dv',
    note: 'The absolute Jacobian determinant |x_u y_v − x_v y_u| measures local area distortion under T(u, v).',
    symbols: '∂(x,y)/∂(u,v) = det [[x_u, x_v], [y_u, y_v]].',
    conditions: 'Transformation T must be C¹ and one-to-one on the interior of S.',
    example: {
      problemLatex: 'x = r\\cos\\theta,\\; y = r\\sin\\theta',
      solutionLatex: '|J| = \\left|\\cos^2\\theta\\cdot r + r\\sin^2\\theta\\right| = r',
    },
  },
  {
    id: 'f-cyl-sph',
    category: 'Coordinate Transformations',
    subtopic: 'Polar, Cylindrical & Spherical Jacobians',
    title: 'Cylindrical & Spherical Volume Elements',
    formulaLatex: 'dV_{\\text{cyl}} = r\\,dz\\,dr\\,d\\theta, \\qquad dV_{\\text{sph}} = \\rho^2\\sin\\phi\\,d\\rho\\,d\\phi\\,d\\theta',
    note: 'Simplifies triple integrals over cones, cylinders, and spheres.',
    symbols: 'r = radial planar distance; ρ = 3D radius; θ ∈ [0,2π] azimuth; φ ∈ [0,π] polar angle.',
    conditions: 'r ≥ 0, ρ ≥ 0, sin φ ≥ 0 on [0, π].',
    example: {
      problemLatex: '\\text{Volume of sphere of radius } R',
      solutionLatex: '\\int_0^{2\\pi}\\int_0^\\pi\\int_0^R \\rho^2\\sin\\phi\\,d\\rho\\,d\\phi\\,d\\theta = \\frac{4}{3}\\pi R^3',
    },
  },

  // 8. Optimization
  {
    id: 'f-hessian',
    category: 'Optimization',
    subtopic: 'Unconstrained Local Extrema',
    title: 'Second Derivative Test (Hessian)',
    formulaLatex: 'D(a,b) = f_{xx}(a,b)f_{yy}(a,b) - \\left[f_{xy}(a,b)\\right]^2',
    note: 'At ∇f = 0: D > 0 & f_xx > 0 → Local Min; D > 0 & f_xx < 0 → Local Max; D < 0 → Saddle Point.',
    symbols: 'D = determinant of 2×2 Hessian matrix; (a, b) = stationary point.',
    conditions: 'Second partials must be continuous; test is inconclusive if D = 0.',
    example: {
      problemLatex: 'f(x,y) = x^2 - y^2 \\text{ at } (0,0)',
      solutionLatex: 'D = (2)(-2) - 0 = -4 < 0 \\implies \\text{Saddle Point}',
    },
    tryExample: { tool: 'maxima-minima', expr: 'x^2 - y^2' },
  },
  {
    id: 'f-lagrange',
    category: 'Optimization',
    subtopic: 'Constrained Optimization',
    title: 'Method of Lagrange Multipliers',
    formulaLatex: '\\nabla f(x, y) = \\lambda \\nabla g(x, y), \\qquad g(x, y) = c',
    note: 'At constrained extrema along g(x, y) = c, level curves of f and g share parallel normals.',
    symbols: 'λ = Lagrange multiplier; g(x,y) = c is the constraint curve/surface.',
    conditions: 'f, g ∈ C¹ and ∇g ≠ 0 at optimal points.',
    example: {
      problemLatex: '\\max xy \\text{ subject to } x^2+y^2=8',
      solutionLatex: '\\langle y, x\\rangle = \\lambda\\langle 2x, 2y\\rangle \\implies x=\\pm y=\\pm 2,\\; f_{\\max}=4',
    },
  },

  // 9. Vector Calculus Theorems
  {
    id: 'f-greens',
    category: 'Vector Calculus Theorems',
    subtopic: 'Planar Circulation vs Curl',
    title: 'Green’s Theorem',
    formulaLatex: '\\oint_{\\partial D} (P\\,dx + Q\\,dy) = \\iint_D \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dA',
    note: 'Converts counterclockwise boundary circulation into an area integral of 2D curl.',
    symbols: '∂D = positively oriented boundary curve of planar region D.',
    conditions: 'D is bounded, piecewise smooth, and P, Q ∈ C¹ on an open set containing D.',
    example: {
      problemLatex: '\\mathbf{F}=\\langle -y, x\\rangle \\text{ around unit disk } D',
      solutionLatex: '\\iint_D (1 - (-1))\\,dA = 2\\pi(1)^2 = 2\\pi',
    },
  },
  {
    id: 'f-stokes',
    category: 'Vector Calculus Theorems',
    subtopic: '3D Surface Curl Flux',
    title: 'Stokes’ Theorem',
    formulaLatex: '\\oint_{\\partial S} \\mathbf{F}\\cdot d\\mathbf{r} = \\iint_S (\\nabla \\times \\mathbf{F})\\cdot d\\mathbf{S}',
    note: 'Generalizes Green’s Theorem to oriented 3D surfaces S with boundary ∂S.',
    symbols: '∂S = boundary oriented via right-hand rule matching surface normal n̂.',
    conditions: 'S is piecewise smooth, orientable; F ∈ C¹ in 3D.',
    example: {
      problemLatex: '\\text{Circulation of } \\langle -y, x, z^2 \\rangle \\text{ on } z=4-x^2-y^2,\\; r=2',
      solutionLatex: '\\nabla\\times\\mathbf{F}=\\langle 0,0,2\\rangle \\implies \\iint 2\\,dA = 2\\pi(2)^2 = 8\\pi',
    },
  },
  {
    id: 'f-gauss-div',
    category: 'Vector Calculus Theorems',
    subtopic: 'Closed Flux & Volume Divergence',
    title: 'Divergence Theorem (Gauss)',
    formulaLatex: '\\oiint_{\\partial W} \\mathbf{F}\\cdot d\\mathbf{S} = \\iiint_W (\\nabla \\cdot \\mathbf{F})\\,dV',
    note: 'Total outward flux across a closed 3D boundary equals the triple integral of divergence inside W.',
    symbols: 'W = closed solid region; ∂W = outward-oriented boundary surface.',
    conditions: 'W is a simple solid region; F ∈ C¹ on an open region containing W.',
    example: {
      problemLatex: '\\mathbf{F}=\\langle x, y, z\\rangle \\text{ on unit cube } [0,1]^3',
      solutionLatex: '\\nabla\\cdot\\mathbf{F}=3 \\implies \\iiint_{[0,1]^3} 3\\,dV = 3',
    },
  },

  // 10. Linear Algebra
  {
    id: 'f-hessian-mat',
    category: 'Linear Algebra',
    subtopic: 'Jacobian & Hessian Matrices',
    title: 'Jacobian & Hessian Matrix Formulations',
    formulaLatex:
      'J_{\\mathbf{f}} = \\begin{bmatrix} \\nabla f_1^T \\\\ \\vdots \\\\ \\nabla f_m^T \\end{bmatrix}, \\qquad H_f = \\begin{bmatrix} f_{xx} & f_{xy} \\\\ f_{yx} & f_{yy} \\end{bmatrix}',
    note: 'J_f represents the best linear derivative map of vector functions; H_f encodes second-order curvature.',
    symbols: 'J_f = m × n Jacobian matrix; H_f = symmetric n × n Hessian matrix.',
    conditions: 'All component partial derivatives must exist; H_f is symmetric when f ∈ C².',
    example: {
      problemLatex: 'f(x,y) = 2x^2 + 3y^2',
      solutionLatex: 'H_f = \\begin{bmatrix} 4 & 0 \\\\ 0 & 6 \\end{bmatrix},\\; \\operatorname{tr}(H_f) = \\Delta f = 10',
    },
  },
  {
    id: 'f-gauss-elim',
    category: 'Linear Algebra',
    subtopic: 'Systems of Linear Equations',
    title: 'Gaussian Elimination & Invertibility',
    formulaLatex: 'A\\mathbf{x} = \\mathbf{b} \\iff \\mathbf{x} = A^{-1}\\mathbf{b} \\;\\text{ when } \\det(A) \\neq 0',
    note: 'Row reduction transforms augmented matrix [A | b] to reduced row echelon form.',
    symbols: 'A = n×n coefficient matrix; x = unknown vector; b = right-hand side.',
    conditions: 'Unique solution exists if and only if det(A) ≠ 0 (full rank n).',
    example: {
      problemLatex: '2x + 3y = 8,\\; x - y = 1',
      solutionLatex: '\\det(A) = -5 \\neq 0 \\implies x = 2.2,\\; y = 1.2',
    },
  },
];
