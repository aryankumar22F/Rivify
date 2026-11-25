import type { DerivationStep } from '../types';

export interface ComplexNumber {
  re: number;
  im: number;
}

export interface ComplexForms {
  re: number;
  im: number;
  modulus: number;
  argRad: number;
  argDeg: number;
  conjugate: ComplexNumber;
  rectangularLatex: string;
  polarLatex: string;
  exponentialLatex: string;
}

export interface ComplexArithmeticResult {
  z1: ComplexForms;
  z2: ComplexForms;
  sum: ComplexForms;
  difference: ComplexForms;
  product: ComplexForms;
  quotient: ComplexForms | null;
  steps: DerivationStep[];
}

export interface DeMoivreAndRootsResult {
  base: ComplexForms;
  powerN: number;
  powered: ComplexForms;
  rootN: number;
  roots: (ComplexForms & { k: number })[];
  steps: DerivationStep[];
}

function fmt(n: number): string {
  const clean = Math.abs(n) < 1e-10 ? 0 : n;
  return Number(clean.toFixed(4)).toString();
}

export function formatComplexRect(z: ComplexNumber): string {
  const a = Math.abs(z.re) < 1e-10 ? 0 : z.re;
  const b = Math.abs(z.im) < 1e-10 ? 0 : z.im;
  if (b === 0) return fmt(a);
  if (a === 0) return `${fmt(b)}i`;
  return `${fmt(a)} ${b >= 0 ? '+' : '-'} ${fmt(Math.abs(b))}i`;
}

export function describeComplex(z: ComplexNumber): ComplexForms {
  const re = Math.abs(z.re) < 1e-12 ? 0 : z.re;
  const im = Math.abs(z.im) < 1e-12 ? 0 : z.im;
  const modulus = Math.hypot(re, im);
  const argRad = modulus < 1e-12 ? 0 : Math.atan2(im, re);
  const argDeg = (argRad * 180) / Math.PI;
  const conjugate = { re, im: im === 0 ? 0 : -im };

  return {
    re,
    im,
    modulus,
    argRad,
    argDeg,
    conjugate,
    rectangularLatex: formatComplexRect({ re, im }),
    polarLatex: `${fmt(modulus)}\\left(\\cos(${fmt(argRad)}) + i\\sin(${fmt(argRad)})\\right)`,
    exponentialLatex: `${fmt(modulus)} e^{i(${fmt(argRad)})}`,
  };
}

export function polarToRectangular(r: number, thetaValue: number, unit: 'rad' | 'deg'): ComplexNumber {
  const rad = unit === 'deg' ? (thetaValue * Math.PI) / 180 : thetaValue;
  return {
    re: r * Math.cos(rad),
    im: r * Math.sin(rad),
  };
}

export function solveComplexArithmetic(z1In: ComplexNumber, z2In: ComplexNumber): ComplexArithmeticResult {
  const z1 = describeComplex(z1In);
  const z2 = describeComplex(z2In);

  const sum = describeComplex({ re: z1.re + z2.re, im: z1.im + z2.im });
  const difference = describeComplex({ re: z1.re - z2.re, im: z1.im - z2.im });
  const product = describeComplex({
    re: z1.re * z2.re - z1.im * z2.im,
    im: z1.re * z2.im + z1.im * z2.re,
  });

  const denom = z2.re * z2.re + z2.im * z2.im;
  const quotient =
    denom > 1e-12
      ? describeComplex({
          re: (z1.re * z2.re + z1.im * z2.im) / denom,
          im: (z1.im * z2.re - z1.re * z2.im) / denom,
        })
      : null;

  const steps: DerivationStep[] = [
    {
      id: 'cx-forms',
      rule: 'Polar & Exponential Conversion',
      description: 'Compute r = √(x² + y²) and principal argument θ = atan2(y, x).',
      latex: `z_1 = ${z1.rectangularLatex} = ${z1.exponentialLatex},\\quad |z_1| = ${fmt(z1.modulus)},\\; \\theta_1 = ${fmt(z1.argDeg)}^\\circ`,
    },
    {
      id: 'cx-mul',
      rule: 'Multiplication & Conjugates',
      description: 'Expand (a + bi)(c + di) = (ac - bd) + (ad + bc)i.',
      latex: `z_1 + z_2 = ${sum.rectangularLatex},\\quad z_1 \\cdot z_2 = ${product.rectangularLatex}`,
    },
    {
      id: 'cx-div',
      rule: 'Quotient via Complex Conjugate',
      description: 'Multiply numerator and denominator by z̄₂ to rationalize the denominator.',
      latex: quotient
        ? `\\frac{z_1}{z_2} = \\frac{(${z1.rectangularLatex})(${z2.conjugate.re >= 0 ? formatComplexRect(z2.conjugate) : formatComplexRect(z2.conjugate)})}{${fmt(denom)}} = ${quotient.rectangularLatex}`
        : `\\frac{z_1}{z_2}\\text{ is undefined because }z_2 = 0.`,
    },
  ];

  return { z1, z2, sum, difference, product, quotient, steps };
}

export function solveDeMoivreAndRoots(
  zIn: ComplexNumber,
  powerN: number,
  rootN: number
): DeMoivreAndRootsResult {
  if (!Number.isInteger(powerN) || Math.abs(powerN) > 24) {
    throw new Error('Power exponent n must be an integer between -24 and 24.');
  }
  if (!Number.isInteger(rootN) || rootN < 2 || rootN > 12) {
    throw new Error('Root order k must be an integer between 2 and 12.');
  }

  const base = describeComplex(zIn);
  if (base.modulus < 1e-12 && powerN <= 0) {
    throw new Error('0 raised to a non-positive power is undefined.');
  }

  const rPow = base.modulus === 0 ? 0 : Math.pow(base.modulus, powerN);
  const thetaPow = base.argRad * powerN;
  const powered = describeComplex({
    re: rPow * Math.cos(thetaPow),
    im: rPow * Math.sin(thetaPow),
  });

  const rootR = base.modulus === 0 ? 0 : Math.pow(base.modulus, 1 / rootN);
  const roots: (ComplexForms & { k: number })[] = [];
  for (let k = 0; k < rootN; k++) {
    const phi = (base.argRad + 2 * Math.PI * k) / rootN;
    const form = describeComplex({
      re: rootR * Math.cos(phi),
      im: rootR * Math.sin(phi),
    });
    roots.push({ ...form, k });
  }

  const steps: DerivationStep[] = [
    {
      id: 'demoivre-base',
      rule: "De Moivre's Theorem Formula",
      description: 'Raise modulus to power n and multiply principal argument by n.',
      latex: `z^{${powerN}} = r^{${powerN}}\\left(\\cos(${powerN}\\theta) + i\\sin(${powerN}\\theta)\\right) = ${fmt(rPow)}\\,\\angle\\,${fmt((thetaPow * 180) / Math.PI)}^\\circ = ${powered.rectangularLatex}`,
    },
    {
      id: 'nth-roots',
      rule: `Principal & All ${rootN}-th Roots`,
      description: `Evaluate w_k = r^(1/${rootN}) · exp(i(θ + 2πk)/${rootN}) for k = 0, ..., ${rootN - 1}.`,
      latex: `|w_k| = ${fmt(rootR)},\\quad \\Delta\\theta = \\frac{360^\\circ}{${rootN}} = ${fmt(360 / rootN)}^\\circ`,
    },
  ];

  return {
    base,
    powerN,
    powered,
    rootN,
    roots,
    steps,
  };
}
