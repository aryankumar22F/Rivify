import type { HistoryItem } from '../types';

export interface FormulaEntry {
  id: string;
  category: string;
  title: string;
  formulaLatex: string;
  note: string;
  tryExample?: {
    tool: HistoryItem['tool'];
    expr: string;
    secondary?: string;
  };
}

export const FORMULA_CATEGORIES = [
  'All',
  'Favorites',
  'Differentiation Rules',
  'Partial & Higher Order',
  'Chain Rule & Implicit',
  'Gradient & Directional',
  'Extrema & Linearization',
  'Vector Calculus',
] as const;

export const FORMULA_SHEET: FormulaEntry[] = [
  {
    id: 'f-power',
    category: 'Differentiation Rules',
    title: 'Power Rule',
    formulaLatex: '\\frac{d}{dx}\\left(x^n\\right) = n x^{n-1}',
    note: 'Applies for any real exponent n, treating other variables as constants in partial differentiation.',
    tryExample: { tool: 'partial-derivative', expr: '2*x^2*y^3', secondary: 'x' },
  },
  {
    id: 'f-product',
    category: 'Differentiation Rules',
    title: 'Product Rule',
    formulaLatex: '\\frac{d}{dx}\\left[u(x)v(x)\\right] = u\'(x)v(x) + u(x)v\'(x)',
    note: 'Used when two factors both depend on the differentiation variable.',
    tryExample: { tool: 'partial-derivative', expr: 'x*sin(x*y)', secondary: 'x' },
  },
  {
    id: 'f-quotient',
    category: 'Differentiation Rules',
    title: 'Quotient Rule',
    formulaLatex: '\\frac{d}{dx}\\left[\\frac{u(x)}{v(x)}\\right] = \\frac{u\'(x)v(x) - u(x)v\'(x)}{\\left[v(x)\\right]^2}',
    note: 'Valid wherever v(x) ≠ 0.',
    tryExample: { tool: 'partial-derivative', expr: 'x/(x+y)', secondary: 'x' },
  },
  {
    id: 'f-chain',
    category: 'Chain Rule & Implicit',
    title: 'Single-Variable Chain Rule',
    formulaLatex: '\\frac{d}{dx}\\left[f(g(x))\\right] = f\'(g(x)) \\cdot g\'(x)',
    note: 'Outer derivative evaluated at inner expression, multiplied by inner derivative.',
    tryExample: { tool: 'partial-derivative', expr: 'e^(x^2 + y^2)', secondary: 'x' },
  },
  {
    id: 'f-chain-multi',
    category: 'Chain Rule & Implicit',
    title: 'Multivariable Chain Rule',
    formulaLatex: '\\frac{dz}{dt} = \\frac{\\partial z}{\\partial x}\\frac{dx}{dt} + \\frac{\\partial z}{\\partial y}\\frac{dy}{dt}',
    note: 'Tracks total rate of change when z = f(x, y) and both x(t), y(t) depend on parameter t.',
  },
  {
    id: 'f-implicit',
    category: 'Chain Rule & Implicit',
    title: 'Implicit Partial Differentiation',
    formulaLatex: '\\frac{\\partial z}{\\partial x} = -\\frac{F_x}{F_z}, \\qquad \\frac{\\partial z}{\\partial y} = -\\frac{F_y}{F_z}',
    note: 'For an implicit surface F(x, y, z) = 0 where F_z ≠ 0.',
  },
  {
    id: 'f-trig',
    category: 'Differentiation Rules',
    title: 'Trigonometric Derivatives',
    formulaLatex: '\\frac{d}{dx}\\sin u = \\cos u \\cdot u\',\\quad \\frac{d}{dx}\\cos u = -\\sin u \\cdot u\',\\quad \\frac{d}{dx}\\tan u = \\sec^2 u \\cdot u\'',
    note: 'Standard circular functions in radians.',
    tryExample: { tool: 'partial-derivative', expr: 'cos(2*x)*sin(3*y)', secondary: 'y' },
  },
  {
    id: 'f-explog',
    category: 'Differentiation Rules',
    title: 'Exponential & Logarithmic',
    formulaLatex: '\\frac{d}{dx}e^u = e^u \\cdot u\',\\quad \\frac{d}{dx}\\ln(u) = \\frac{u\'}{u},\\quad \\frac{d}{dx}a^u = a^u \\ln(a)\\cdot u\'',
    note: 'Natural logarithm ln(u) requires u > 0.',
    tryExample: { tool: 'partial-derivative', expr: 'ln(x^2 + y^2)', secondary: 'x' },
  },
  {
    id: 'f-partial-def',
    category: 'Partial & Higher Order',
    title: 'Partial Derivative Limit Definition',
    formulaLatex: '\\frac{\\partial f}{\\partial x}(x,y) = \\lim_{h \\to 0} \\frac{f(x+h, y) - f(x, y)}{h}',
    note: 'Measures instantaneous rate of change along the x-direction while holding y fixed.',
  },
  {
    id: 'f-clairaut',
    category: 'Partial & Higher Order',
    title: 'Clairaut’s Theorem (Mixed Partials)',
    formulaLatex: '\\frac{\\partial^2 f}{\\partial y \\partial x} = \\frac{\\partial^2 f}{\\partial x \\partial y}',
    note: 'Holds whenever f_xy and f_yx are both continuous on an open disk around (a, b).',
  },
  {
    id: 'f-grad',
    category: 'Gradient & Directional',
    title: 'Gradient Vector',
    formulaLatex: '\\nabla f(x, y, z) = \\left\\langle \\frac{\\partial f}{\\partial x},\\; \\frac{\\partial f}{\\partial y},\\; \\frac{\\partial f}{\\partial z} \\right\\rangle',
    note: 'Points in the direction of steepest ascent; orthogonal to level surfaces.',
    tryExample: { tool: 'gradient', expr: 'x^2*y + sin(y)' },
  },
  {
    id: 'f-dir',
    category: 'Gradient & Directional',
    title: 'Directional Derivative',
    formulaLatex: 'D_{\\mathbf{u}}f(P) = \\nabla f(P) \\cdot \\mathbf{u},\\quad \\mathbf{u} = \\frac{\\mathbf{v}}{\\|\\mathbf{v}\\|}',
    note: 'Always normalize direction vector v to unit vector u before taking the dot product.',
    tryExample: { tool: 'directional-derivative', expr: 'x^2 + y^2' },
  },
  {
    id: 'f-hessian',
    category: 'Extrema & Linearization',
    title: 'Second Derivative Test (Hessian Discriminant)',
    formulaLatex: 'D(a,b) = f_{xx}(a,b)f_{yy}(a,b) - \\left[f_{xy}(a,b)\\right]^2',
    note: 'At a critical point: D > 0 & f_xx > 0 → Local Min; D > 0 & f_xx < 0 → Local Max; D < 0 → Saddle Point.',
    tryExample: { tool: 'maxima-minima', expr: 'x^2 - y^2' },
  },
  {
    id: 'f-tangent',
    category: 'Extrema & Linearization',
    title: 'Tangent Plane & Linear Approximation',
    formulaLatex: 'L(x, y) = f(x_0, y_0) + f_x(x_0, y_0)(x - x_0) + f_y(x_0, y_0)(y - y_0)',
    note: 'Best linear approximation to f near (x₀, y₀) for differentiable functions.',
    tryExample: { tool: 'linear-approximation', expr: 'x^2 + 2*y^2' },
  },
  {
    id: 'f-div',
    category: 'Vector Calculus',
    title: 'Divergence (2D & 3D)',
    formulaLatex: '\\operatorname{div}\\mathbf{F} = \\nabla \\cdot \\mathbf{F} = \\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} \\left(+ \\frac{\\partial R}{\\partial z}\\right)',
    note: 'Measures outward flux density per unit volume at a point.',
    tryExample: { tool: 'vector-field', expr: '-y', secondary: 'x' },
  },
  {
    id: 'f-curl',
    category: 'Vector Calculus',
    title: '2D Scalar Curl & Conservative Test',
    formulaLatex: '\\operatorname{curl}_{2D}(\\mathbf{F}) = \\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}',
    note: 'If ∂Q/∂x − ∂P/∂y = 0 on a simply connected domain, F is conservative (path-independent).',
    tryExample: { tool: 'vector-field', expr: '2*x*y', secondary: 'x^2 + 1' },
  },
  {
    id: 'f-greens',
    category: 'Vector Calculus',
    title: 'Green’s Theorem (Circulation Form)',
    formulaLatex: '\\oint_C \\left(P\\,dx + Q\\,dy\\right) = \\iint_D \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dA',
    note: 'Relates a counterclockwise line integral around simple closed curve C to the double integral of 2D curl over region D.',
  },
];
