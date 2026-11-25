import type { DerivationStep } from '../types';
import { integrate1DComposite } from './integrals';
import { evaluateAST, parseExpression, toLatex } from './symbolic';

export interface FourierSeriesResult {
  halfPeriod: number;
  harmonics: number;
  a0: number;
  an: number[];
  bn: number[];
  seriesLatex: string;
  samples: { t: number; exact: number; approx: number }[];
  rmse: number;
  steps: DerivationStep[];
}

export function computeFourierSeries(
  exprStr: string,
  halfPeriod: number,
  harmonics: number
): FourierSeriesResult {
  const L = Math.max(0.25, Math.min(20, halfPeriod));
  const N = Math.max(1, Math.min(20, Math.round(harmonics)));
  const ast = parseExpression(exprStr);

  const fn = (t: number) => evaluateAST(ast, { t, x: t }, 'rad');
  const panels = 8;

  const a0 = (1 / L) * integrate1DComposite(fn, -L, L, panels);
  const an: number[] = [];
  const bn: number[] = [];

  for (let n = 1; n <= N; n++) {
    const w = (n * Math.PI) / L;
    const aVal = (1 / L) * integrate1DComposite((t) => fn(t) * Math.cos(w * t), -L, L, panels);
    const bVal = (1 / L) * integrate1DComposite((t) => fn(t) * Math.sin(w * t), -L, L, panels);
    an.push(Math.abs(aVal) < 1e-7 ? 0 : Number(aVal.toFixed(5)));
    bn.push(Math.abs(bVal) < 1e-7 ? 0 : Number(bVal.toFixed(5)));
  }

  const cleanA0 = Math.abs(a0) < 1e-7 ? 0 : Number(a0.toFixed(5));
  const termsLatex: string[] = [];
  if (Math.abs(cleanA0 / 2) > 1e-5) {
    termsLatex.push(Number((cleanA0 / 2).toFixed(4)).toString());
  }
  for (let i = 0; i < Math.min(N, 5); i++) {
    const n = i + 1;
    const arg = Math.abs(L - Math.PI) < 1e-3 ? `${n === 1 ? '' : n}t` : `\\frac{${n}\\pi t}{${L}}`;
    if (Math.abs(an[i]) > 1e-4) {
      termsLatex.push(`${an[i] >= 0 && termsLatex.length ? '+' : ''}${Number(an[i].toFixed(3))}\\cos(${arg})`);
    }
    if (Math.abs(bn[i]) > 1e-4) {
      termsLatex.push(`${bn[i] >= 0 && termsLatex.length ? '+' : ''}${Number(bn[i].toFixed(3))}\\sin(${arg})`);
    }
  }
  if (N > 5) termsLatex.push('+ \\cdots');

  const samples: { t: number; exact: number; approx: number }[] = [];
  let sqErr = 0;
  const pts = 160;
  for (let i = 0; i <= pts; i++) {
    const t = -L + (2 * L * i) / pts;
    const exact = fn(t);
    let approx = cleanA0 / 2;
    for (let n = 1; n <= N; n++) {
      const w = (n * Math.PI) / L;
      approx += an[n - 1] * Math.cos(w * t) + bn[n - 1] * Math.sin(w * t);
    }
    if (Number.isFinite(exact) && Number.isFinite(approx)) {
      sqErr += (exact - approx) ** 2;
    }
    samples.push({
      t,
      exact: Number.isFinite(exact) ? exact : 0,
      approx: Number.isFinite(approx) ? approx : 0,
    });
  }
  const rmse = Math.sqrt(sqErr / (pts + 1));

  return {
    halfPeriod: L,
    harmonics: N,
    a0: cleanA0,
    an,
    bn,
    seriesLatex: `f(t) \\approx ${termsLatex.join(' ') || '0'}`,
    samples,
    rmse,
    steps: [
      {
        id: 'fs-1',
        rule: 'DC Component (a₀)',
        description: `Average over period [-${L}, ${L}] using Gauss-Legendre integration.`,
        latex: `a_0 = \\frac{1}{${L}}\\int_{-${L}}^{${L}} ${toLatex(ast)}\\,dt = ${cleanA0}`,
      },
      {
        id: 'fs-2',
        rule: 'Cosine & Sine Harmonics (aₙ, bₙ)',
        description: `Evaluated ${N} harmonic pairs up to n = ${N}.`,
        latex: `a_1 = ${an[0] ?? 0},\\; b_1 = ${bn[0] ?? 0},\\; a_2 = ${an[1] ?? 0},\\; b_2 = ${bn[1] ?? 0}`,
      },
      {
        id: 'fs-3',
        rule: `Partial Sum S_${N}(t) Approximation`,
        description: `RMS error across [-${L}, ${L}] is ${rmse.toFixed(5)}.`,
        latex: `S_{${N}}(t) = ${termsLatex.join(' ') || '0'}`,
      },
    ],
  };
}

export interface FourierTransformResult {
  timeSamples: { t: number; f: number; reconstructed: number }[];
  spectrum: { omega: number; real: number; imag: number; magnitude: number; phase: number }[];
  canonicalLatex: string;
  steps: DerivationStep[];
}

export function computeFourierTransform(
  exprStr: string,
  tBound: number,
  omegaMax: number
): FourierTransformResult {
  const T = Math.max(1, Math.min(20, tBound));
  const wMax = Math.max(2, Math.min(30, omegaMax));
  const ast = parseExpression(exprStr);
  const f = (t: number) => evaluateAST(ast, { t, x: t }, 'rad');

  // Detect known canonical pairs for exact symbolic derivation readout
  const norm = exprStr.replace(/\s+/g, '').toLowerCase();
  let canonicalLatex = `\\mathcal{F}\\{${toLatex(ast)}\\}(\\omega) = \\int_{-\\infty}^{\\infty} ${toLatex(ast)}\\,e^{-i\\omega t}\\,dt`;
  if (norm === 'e^(-abs(t))' || norm === 'exp(-abs(t))') {
    canonicalLatex = '\\mathcal{F}\\{e^{-|t|}\\}(\\omega) = \\frac{2}{1 + \\omega^2}';
  } else if (norm === 'e^(-t^2)' || norm === 'exp(-t^2)') {
    canonicalLatex = '\\mathcal{F}\\{e^{-t^2}\\}(\\omega) = \\sqrt{\\pi}\\,e^{-\\omega^2/4}';
  }

  const spectrum: FourierTransformResult['spectrum'] = [];
  const freqSteps = 80;
  for (let i = 0; i <= freqSteps; i++) {
    const omega = -wMax + (2 * wMax * i) / freqSteps;
    const real = integrate1DComposite((t) => f(t) * Math.cos(omega * t), -T, T, 6);
    const imag = integrate1DComposite((t) => -f(t) * Math.sin(omega * t), -T, T, 6);
    const mag = Math.hypot(real, imag);
    const phase = Math.atan2(imag, real);
    spectrum.push({ omega, real, imag, magnitude: mag, phase });
  }

  // Inverse Fourier Transform reconstruction over [-wMax, wMax]
  const dw = (2 * wMax) / freqSteps;
  const timeSamples: FourierTransformResult['timeSamples'] = [];
  const tPts = 80;
  for (let i = 0; i <= tPts; i++) {
    const t = -T + (2 * T * i) / tPts;
    let sum = 0;
    for (let k = 0; k < spectrum.length; k++) {
      const s = spectrum[k];
      const weight = k === 0 || k === spectrum.length - 1 ? 0.5 : 1;
      sum += weight * (s.real * Math.cos(s.omega * t) - s.imag * Math.sin(s.omega * t));
    }
    const reconstructed = (sum * dw) / (2 * Math.PI);
    const exact = f(t);
    timeSamples.push({
      t,
      f: Number.isFinite(exact) ? exact : 0,
      reconstructed: Number.isFinite(reconstructed) ? reconstructed : 0,
    });
  }

  const dcMag = spectrum[Math.floor(spectrum.length / 2)]?.magnitude ?? 0;

  return {
    timeSamples,
    spectrum,
    canonicalLatex,
    steps: [
      {
        id: 'ft-1',
        rule: 'Continuous Fourier Transform Integral',
        description: `Windowed numerical integral over t ∈ [-${T}, ${T}] and ω ∈ [-${wMax}, ${wMax}].`,
        latex: canonicalLatex,
      },
      {
        id: 'ft-2',
        rule: 'Inverse Fourier Reconstruction',
        description: `Evaluated F(0) magnitude ≈ ${dcMag.toFixed(4)} and reconstructed f(t) via 1/(2π)∫ F(ω)e^{iωt} dω.`,
        latex: `f(t) = \\frac{1}{2\\pi}\\int_{-\\infty}^{\\infty} F(\\omega)e^{i\\omega t}\\,d\\omega,\\quad |F(0)| \\approx ${dcMag.toFixed(4)}`,
      },
    ],
  };
}

// ---------------- Laplace & Inverse Laplace Transform ----------------

export interface LaplacePreset {
  id: string;
  label: string;
  fLatex: string;
  transformLatex: string;
  roc: string;
  expr: string;
  steps: DerivationStep[];
}

export const LAPLACE_PRESETS: LaplacePreset[] = [
  {
    id: 'unit-step',
    label: '1 (Unit Step)',
    fLatex: '1',
    transformLatex: '\\frac{1}{s}',
    roc: 's > 0',
    expr: '1',
    steps: [
      {
        id: 'lap-u1',
        rule: 'Definition of Laplace Transform',
        description: 'Integrate e^{-st} from 0 to ∞ for s > 0.',
        latex: '\\mathcal{L}\\{1\\} = \\int_0^{\\infty} e^{-st}\\,dt = \\left[-\\frac{e^{-st}}{s}\\right]_0^{\\infty} = \\frac{1}{s}',
      },
    ],
  },
  {
    id: 'power-n',
    label: 't² (Power)',
    fLatex: 't^2',
    transformLatex: '\\frac{2}{s^3}',
    roc: 's > 0',
    expr: 't^2',
    steps: [
      {
        id: 'lap-p1',
        rule: 'Power Rule L{tⁿ} = n!/sⁿ⁺¹',
        description: 'Apply integration by parts twice for n = 2.',
        latex: '\\mathcal{L}\\{t^2\\} = \\frac{2!}{s^{2+1}} = \\frac{2}{s^3}',
      },
    ],
  },
  {
    id: 'exp-at',
    label: 'e^(-3t)',
    fLatex: 'e^{-3t}',
    transformLatex: '\\frac{1}{s + 3}',
    roc: 's > -3',
    expr: 'e^(-3*t)',
    steps: [
      {
        id: 'lap-e1',
        rule: 'First Shifting / Exponential Kernel',
        description: 'Combine kernels e^{-3t} and e^{-st} into e^{-(s+3)t}.',
        latex: '\\mathcal{L}\\{e^{-3t}\\} = \\int_0^{\\infty} e^{-(s+3)t}\\,dt = \\frac{1}{s+3}',
      },
    ],
  },
  {
    id: 'damped-sin',
    label: 'e^(-2t) sin(4t)',
    fLatex: 'e^{-2t}\\sin(4t)',
    transformLatex: '\\frac{4}{(s+2)^2 + 16}',
    roc: 's > -2',
    expr: 'e^(-2*t)*sin(4*t)',
    steps: [
      {
        id: 'lap-ds1',
        rule: 'Standard Sine Transform',
        description: 'Start with L{sin(4t)} = 4 / (s² + 16).',
        latex: '\\mathcal{L}\\{\\sin(4t)\\} = \\frac{4}{s^2 + 4^2}',
      },
      {
        id: 'lap-ds2',
        rule: 'First Shifting Theorem (s → s + 2)',
        description: 'Multiplying by e^{-2t} shifts s to s + 2 in the transform.',
        latex: '\\mathcal{L}\\{e^{-2t}\\sin(4t)\\} = \\frac{4}{(s+2)^2 + 16}',
      },
    ],
  },
  {
    id: 'damped-cos',
    label: 'e^(-t) cos(3t)',
    fLatex: 'e^{-t}\\cos(3t)',
    transformLatex: '\\frac{s+1}{(s+1)^2 + 9}',
    roc: 's > -1',
    expr: 'e^(-t)*cos(3*t)',
    steps: [
      {
        id: 'lap-dc1',
        rule: 'Cosine + First Shifting Theorem',
        description: 'Shift s → s + 1 in s/(s² + 9).',
        latex: '\\mathcal{L}\\{e^{-t}\\cos(3t)\\} = \\frac{s+1}{(s+1)^2 + 9}',
      },
    ],
  },
  {
    id: 't-exp',
    label: 't·e^(-2t)',
    fLatex: 't e^{-2t}',
    transformLatex: '\\frac{1}{(s+2)^2}',
    roc: 's > -2',
    expr: 't*e^(-2*t)',
    steps: [
      {
        id: 'lap-te1',
        rule: 'Frequency Differentiation Property',
        description: 'L{t f(t)} = -d/ds F(s) applied to F(s) = 1/(s+2).',
        latex: '\\mathcal{L}\\{t e^{-2t}\\} = -\\frac{d}{ds}\\left(\\frac{1}{s+2}\\right) = \\frac{1}{(s+2)^2}',
      },
    ],
  },
];

export interface InverseLaplaceResult {
  inputLatex: string;
  timeLatex: string;
  polesDescription: string;
  samples: { t: number; y: number }[];
  steps: DerivationStep[];
}

/**
 * Exact symbolic Inverse Laplace Transform of F(s) = (a*s + b) / (s^2 + p*s + q)
 */
export function solveInverseLaplaceQuadratic(
  a: number,
  b: number,
  p: number,
  q: number
): InverseLaplaceResult {
  const inputLatex = `F(s) = \\frac{${a}s ${b >= 0 ? '+' : '-'} ${Math.abs(b)}}{s^2 ${p >= 0 ? '+' : '-'} ${Math.abs(p)}s ${q >= 0 ? '+' : '-'} ${Math.abs(q)}}`;
  const disc = p * p - 4 * q;
  let timeLatex = '';
  let polesDescription = '';
  let fn: (t: number) => number;
  const steps: DerivationStep[] = [];

  if (disc > 1e-8) {
    // Two distinct real roots r1, r2 of s^2 + p s + q = 0
    const r1 = (-p + Math.sqrt(disc)) / 2;
    const r2 = (-p - Math.sqrt(disc)) / 2;
    const c1 = (a * r1 + b) / (r1 - r2);
    const c2 = (a * r2 + b) / (r2 - r1);
    fn = (t) => c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
    timeLatex = `f(t) = ${Number(c1.toFixed(4))}e^{${Number(r1.toFixed(4))}t} ${c2 >= 0 ? '+' : '-'} ${Math.abs(Number(c2.toFixed(4)))}e^{${Number(r2.toFixed(4))}t}`;
    polesDescription = `Two distinct real poles: s₁ = ${r1.toFixed(4)}, s₂ = ${r2.toFixed(4)}.`;
    steps.push(
      {
        id: 'il-1',
        rule: 'Partial Fraction Decomposition',
        description: polesDescription,
        latex: `F(s) = \\frac{${Number(c1.toFixed(4))}}{s - (${Number(r1.toFixed(3))})} + \\frac{${Number(c2.toFixed(4))}}{s - (${Number(r2.toFixed(3))})}`,
      },
      {
        id: 'il-2',
        rule: 'Inverse Exponential Transform',
        description: 'Apply L⁻¹{1/(s - r)} = e^{rt}.',
        latex: timeLatex,
      }
    );
  } else if (Math.abs(disc) <= 1e-8) {
    const r = -p / 2;
    const k1 = a;
    const k2 = b + a * r;
    fn = (t) => (k1 + k2 * t) * Math.exp(r * t);
    timeLatex = `f(t) = (${Number(k1.toFixed(4))} ${k2 >= 0 ? '+' : '-'} ${Math.abs(Number(k2.toFixed(4)))}t)e^{${Number(r.toFixed(4))}t}`;
    polesDescription = `Repeated real pole of multiplicity 2 at s = ${r.toFixed(4)}.`;
    steps.push(
      {
        id: 'il-1',
        rule: 'Repeated Pole Partial Fractions',
        description: polesDescription,
        latex: `F(s) = \\frac{${Number(k1.toFixed(4))}}{s - (${Number(r.toFixed(3))})} + \\frac{${Number(k2.toFixed(4))}}{(s - (${Number(r.toFixed(3))}))^2}`,
      },
      {
        id: 'il-2',
        rule: 'Inverse Shifted Power Transform',
        description: 'Apply L⁻¹{1/(s - r)²} = t e^{rt}.',
        latex: timeLatex,
      }
    );
  } else {
    // Complete the square: (s + alpha)^2 + omega^2
    const alpha = p / 2;
    const omega = Math.sqrt(q - alpha * alpha);
    const cosCoeff = a;
    const sinCoeff = (b - a * alpha) / omega;
    fn = (t) =>
      Math.exp(-alpha * t) * (cosCoeff * Math.cos(omega * t) + sinCoeff * Math.sin(omega * t));
    timeLatex = `f(t) = e^{${Number((-alpha).toFixed(4))}t}\\left(${Number(cosCoeff.toFixed(4))}\\cos(${Number(omega.toFixed(4))}t) ${sinCoeff >= 0 ? '+' : '-'} ${Math.abs(Number(sinCoeff.toFixed(4)))}\\sin(${Number(omega.toFixed(4))}t)\\right)`;
    polesDescription = `Complex conjugate poles at s = ${(-alpha).toFixed(3)} ± ${omega.toFixed(3)}i.`;
    steps.push(
      {
        id: 'il-1',
        rule: 'Completing the Square',
        description: polesDescription,
        latex: `F(s) = \\frac{${a}(s + ${Number(alpha.toFixed(3))}) + (${Number((b - a * alpha).toFixed(3))})}{(s + ${Number(alpha.toFixed(3))})^2 + ${Number(omega.toFixed(3))}^2}`,
      },
      {
        id: 'il-2',
        rule: 'Inverse Damped Sinusoid Formula',
        description: 'Invert cos(ωt) and sin(ωt) terms with first shifting factor e^{-αt}.',
        latex: timeLatex,
      }
    );
  }

  const samples: { t: number; y: number }[] = [];
  for (let i = 0; i <= 100; i++) {
    const t = (i / 100) * 6;
    const y = fn(t);
    samples.push({ t, y: Number.isFinite(y) ? Math.max(-50, Math.min(50, y)) : 0 });
  }

  return { inputLatex, timeLatex, polesDescription, samples, steps };
}

export interface ConvolutionResult {
  samples: { t: number; f: number; g: number; conv: number }[];
  steps: DerivationStep[];
}

export function computeConvolution(
  fExpr: string,
  gExpr: string,
  tMax = 6
): ConvolutionResult {
  const fAst = parseExpression(fExpr);
  const gAst = parseExpression(gExpr);
  const f = (t: number) => evaluateAST(fAst, { t, x: t }, 'rad');
  const g = (t: number) => evaluateAST(gAst, { t, x: t }, 'rad');

  const T = Math.max(1, Math.min(15, tMax));
  const pts = 72;
  const samples: ConvolutionResult['samples'] = [];
  for (let i = 0; i <= pts; i++) {
    const t = (T * i) / pts;
    const conv =
      t <= 1e-6
        ? 0
        : integrate1DComposite((tau) => f(tau) * g(t - tau), 0, t, 4);
    samples.push({
      t,
      f: Number.isFinite(f(t)) ? f(t) : 0,
      g: Number.isFinite(g(t)) ? g(t) : 0,
      conv: Number.isFinite(conv) ? conv : 0,
    });
  }

  return {
    samples,
    steps: [
      {
        id: 'conv-1',
        rule: 'Causal Convolution Integral',
        description: `Evaluated (f * g)(t) across t ∈ [0, ${T}] using Gauss-Legendre quadrature.`,
        latex: `(f * g)(t) = \\int_0^t \\left(${toLatex(fAst)}\\right)_{t=\\tau}\\left(${toLatex(gAst)}\\right)_{t=t-\\tau} d\\tau`,
      },
      {
        id: 'conv-2',
        rule: 'Convolution Theorem',
        description: 'Time-domain convolution corresponds to pointwise multiplication in Laplace/Fourier domains.',
        latex: '\\mathcal{L}\\{f * g\\}(s) = F(s)\\cdot G(s)',
      },
    ],
  };
}

export const TRANSFORM_PROPERTIES = [
  {
    name: 'Linearity',
    laplace: '\\mathcal{L}\\{a f(t) + b g(t)\\} = aF(s) + bG(s)',
    fourier: '\\mathcal{F}\\{a f(t) + b g(t)\\} = aF(\\omega) + bG(\\omega)',
  },
  {
    name: 'Time Shifting',
    laplace: '\\mathcal{L}\\{f(t-a)u(t-a)\\} = e^{-as}F(s)',
    fourier: '\\mathcal{F}\\{f(t-t_0)\\} = e^{-i\\omega t_0}F(\\omega)',
  },
  {
    name: 'Frequency Shifting',
    laplace: '\\mathcal{L}\\{e^{at}f(t)\\} = F(s-a)',
    fourier: '\\mathcal{F}\\{e^{i\\omega_0 t}f(t)\\} = F(\\omega - \\omega_0)',
  },
  {
    name: 'Differentiation',
    laplace: "\\mathcal{L}\\{f'(t)\\} = sF(s) - f(0)",
    fourier: "\\mathcal{F}\\{f'(t)\\} = i\\omega F(\\omega)",
  },
  {
    name: 'Convolution',
    laplace: '\\mathcal{L}\\{(f * g)(t)\\} = F(s)G(s)',
    fourier: '\\mathcal{F}\\{(f * g)(t)\\} = F(\\omega)G(\\omega)',
  },
];
