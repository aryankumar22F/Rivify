import { BookOpen, Compass, Cpu, FunctionSquare, Layers, TrendingUp } from 'lucide-react';

const CAPABILITIES = [
  {
    icon: Cpu,
    title: 'Symbolic Differentiation Engine',
    detail:
      'Recursive-descent expression parser and AST simplifier applying Sum, Product, Quotient, Power, Chain, Trigonometric, Exponential, and Logarithmic rules up to 5th-order derivatives.',
  },
  {
    icon: FunctionSquare,
    title: 'Partial & Higher-Order Calculus',
    detail:
      'Compute analytical partial derivatives ∂f/∂x, ∂f/∂y, ∂f/∂z with rule-by-rule step explanations and point evaluations.',
  },
  {
    icon: Compass,
    title: 'Gradients & Directional Rates',
    detail:
      'Constructs symbolic gradient vectors ∇f, normalizes arbitrary direction vectors u, and evaluates directional derivatives D_u f(P) = ∇f(P) · u.',
  },
  {
    icon: TrendingUp,
    title: 'Hessian Extrema & Tangent Planes',
    detail:
      'Runs the Second Derivative Test D = f_xx·f_yy − (f_xy)² to classify minima, maxima, and saddle points alongside tangent plane linearizations L(x, y).',
  },
  {
    icon: Layers,
    title: '3D Surfaces & Vector Fields',
    detail:
      'Interactive 3D surface mesh orbit plots, 2D contour elevation maps, 1D derivative cross-sections, and animated 2D vector field trajectories with divergence and curl.',
  },
  {
    icon: BookOpen,
    title: 'Four-Tier Practice Quizzes',
    detail:
      '40 curated multivariable calculus problems organized across four difficulty levels with KaTeX notation and worked derivations.',
  },
];

export function AboutView() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-6 sm:p-8 space-y-4">
        <div className="text-xs font-medium text-[#2F7CF6]">
          Second-Semester University Project · Multi-Variable Calculus Companion
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-balance">
          About Derivify
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
          Derivify was designed as a practical learning companion for Multi-Variable Calculus,
          originally built in Kotlin and Jetpack Compose with Material 3 and MVVM architecture, and
          brought to the web with a full TypeScript symbolic differentiation engine and interactive
          HTML5 Canvas mathematical visualizations.
        </p>

        <div className="pt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-white/10">
          <span>Architecture: Symbolic AST + MVVM Separation</span>
          <span aria-hidden="true">·</span>
          <span>Typesetting: KaTeX Math Rendering</span>
          <span aria-hidden="true">·</span>
          <span>Design Language: Material 3 Dark Slate</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.title}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-2.5"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2F7CF6]/12 text-[#2F7CF6] flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {cap.title}
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {cap.detail}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
