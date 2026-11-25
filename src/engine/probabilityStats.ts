import type { DerivationStep } from '../types';

export interface DescriptiveStatsResult {
  count: number;
  sorted: number[];
  sum: number;
  mean: number;
  median: number;
  modes: number[];
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  populationVariance: number;
  sampleVariance: number;
  populationStdDev: number;
  sampleStdDev: number;
  histogramBins: { label: string; from: number; to: number; count: number }[];
  steps: DerivationStep[];
}

export interface CombinatoricsBayesResult {
  n: number;
  r: number;
  nPr: string;
  nCr: string;
  pA: number;
  pNotA: number;
  pBGivenA: number;
  pBGivenNotA: number;
  pB: number;
  pAGivenB: number;
  steps: DerivationStep[];
}

export type DistributionType = 'binomial' | 'poisson' | 'normal';

export interface DistributionResult {
  type: DistributionType;
  mean: number;
  variance: number;
  stdDev: number;
  pointValueLabel: string;
  pointProb: number;
  cdfProb: number;
  intervalProb: number;
  zScore?: number;
  series: { x: number; label: string; density: number; highlighted: boolean }[];
  steps: DerivationStep[];
}

export interface RegressionResult {
  points: { x: number; y: number }[];
  slope: number;
  intercept: number;
  r: number;
  rSquared: number;
  covariance: number;
  xMean: number;
  yMean: number;
  sse: number;
  predictedX?: number;
  predictedY?: number;
  residuals: { x: number; y: number; yHat: number; residual: number }[];
  steps: DerivationStep[];
}

function medianOfSorted(arr: number[]): number {
  const n = arr.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

export function computeDescriptiveStats(values: number[]): DescriptiveStatsResult {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) {
    throw new Error('Provide at least one finite numeric value.');
  }
  const sorted = [...clean].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const median = medianOfSorted(sorted);

  const freq = new Map<number, number>();
  let maxFreq = 0;
  for (const v of sorted) {
    const c = (freq.get(v) ?? 0) + 1;
    freq.set(v, c);
    if (c > maxFreq) maxFreq = c;
  }
  const modes =
    maxFreq <= 1
      ? []
      : Array.from(freq.entries())
          .filter(([, c]) => c === maxFreq)
          .map(([v]) => v);

  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max - min;

  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(Math.ceil(n / 2));
  const q1 = lowerHalf.length > 0 ? medianOfSorted(lowerHalf) : sorted[0];
  const q3 = upperHalf.length > 0 ? medianOfSorted(upperHalf) : sorted[n - 1];
  const iqr = q3 - q1;

  const sqDiffSum = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  const populationVariance = sqDiffSum / n;
  const sampleVariance = n > 1 ? sqDiffSum / (n - 1) : 0;
  const populationStdDev = Math.sqrt(populationVariance);
  const sampleStdDev = Math.sqrt(sampleVariance);

  const binCount = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(n))));
  const histogramBins: DescriptiveStatsResult['histogramBins'] = [];
  if (range < 1e-12) {
    histogramBins.push({
      label: `${min.toFixed(2)}`,
      from: min - 0.5,
      to: max + 0.5,
      count: n,
    });
  } else {
    const width = range / binCount;
    for (let i = 0; i < binCount; i++) {
      const from = min + i * width;
      const to = i === binCount - 1 ? max + 1e-9 : min + (i + 1) * width;
      const count = sorted.filter((v) =>
        i === binCount - 1 ? v >= from && v <= max : v >= from && v < to
      ).length;
      histogramBins.push({
        label: `${from.toFixed(1)}–${(min + (i + 1) * width).toFixed(1)}`,
        from,
        to,
        count,
      });
    }
  }

  const steps: DerivationStep[] = [
    {
      id: 'stats-mean',
      rule: 'Sample Mean',
      description: `Sum of ${n} observations divided by count n = ${n}.`,
      latex: `\\bar{x} = \\frac{1}{${n}}\\sum_{i=1}^{${n}} x_i = \\frac{${sum.toFixed(4)}}{${n}} = ${mean.toFixed(4)}`,
    },
    {
      id: 'stats-median',
      rule: 'Median & Quartiles',
      description: 'Ordered dataset midpoint and interquartile spread.',
      latex: `\\text{Median} = ${median.toFixed(4)},\\quad Q_1 = ${q1.toFixed(4)},\\; Q_3 = ${q3.toFixed(4)},\\; \\text{IQR} = ${iqr.toFixed(4)}`,
    },
    {
      id: 'stats-var',
      rule: 'Variance & Standard Deviation',
      description: 'Population (divisor n) and Sample (divisor n - 1) dispersion metrics.',
      latex: `\\sigma^2 = ${populationVariance.toFixed(4)},\\; \\sigma = ${populationStdDev.toFixed(4)}\\quad|\\quad s^2 = ${sampleVariance.toFixed(4)},\\; s = ${sampleStdDev.toFixed(4)}`,
    },
  ];

  return {
    count: n,
    sorted,
    sum,
    mean,
    median,
    modes,
    min,
    max,
    range,
    q1,
    q3,
    iqr,
    populationVariance,
    sampleVariance,
    populationStdDev,
    sampleStdDev,
    histogramBins,
    steps,
  };
}

function bigIntPerm(n: number, r: number): bigint {
  let res = 1n;
  for (let i = 0; i < r; i++) {
    res *= BigInt(n - i);
  }
  return res;
}

function bigIntComb(n: number, r: number): bigint {
  const k = Math.min(r, n - r);
  let num = 1n;
  let den = 1n;
  for (let i = 1; i <= k; i++) {
    num *= BigInt(n - k + i);
    den *= BigInt(i);
  }
  return num / den;
}

export function computeCombinatoricsAndBayes(opts: {
  n: number;
  r: number;
  pA: number;
  pBGivenA: number;
  pBGivenNotA: number;
}): CombinatoricsBayesResult {
  const n = Math.floor(opts.n);
  const r = Math.floor(opts.r);
  if (!Number.isFinite(n) || !Number.isFinite(r) || n < 0 || r < 0 || r > n || n > 170) {
    throw new Error('Ensure 0 <= r <= n <= 170 with whole numbers for nPr and nCr.');
  }
  const { pA, pBGivenA, pBGivenNotA } = opts;
  if (
    [pA, pBGivenA, pBGivenNotA].some((p) => !Number.isFinite(p) || p < 0 || p > 1)
  ) {
    throw new Error('Probabilities P(A), P(B|A), and P(B|A\') must lie in [0, 1].');
  }

  const nPrVal = bigIntPerm(n, r).toString();
  const nCrVal = bigIntComb(n, r).toString();
  const pNotA = 1 - pA;
  const pB = pA * pBGivenA + pNotA * pBGivenNotA;
  if (pB <= 0) {
    throw new Error('Total probability P(B) = 0; cannot condition on an event of zero probability.');
  }
  const pAGivenB = (pA * pBGivenA) / pB;

  const steps: DerivationStep[] = [
    {
      id: 'comb',
      rule: 'Permutations & Combinations',
      description: 'Ordered arrangements vs unordered subsets.',
      latex: `^{${n}}P_{${r}} = \\frac{${n}!}{(${n}-${r})!} = ${nPrVal},\\qquad ^{${n}}C_{${r}} = \\binom{${n}}{${r}} = ${nCrVal}`,
    },
    {
      id: 'total-prob',
      rule: 'Law of Total Probability',
      description: 'Marginal probability P(B) over partition {A, Aᶜ}.',
      latex: `P(B) = P(A)P(B|A) + P(A^c)P(B|A^c) = (${pA.toFixed(4)})(${pBGivenA.toFixed(4)}) + (${pNotA.toFixed(4)})(${pBGivenNotA.toFixed(4)}) = ${pB.toFixed(6)}`,
    },
    {
      id: 'bayes',
      rule: "Bayes' Theorem",
      description: 'Posterior probability of A given observed event B.',
      latex: `P(A|B) = \\frac{P(A)P(B|A)}{P(B)} = \\frac{${(pA * pBGivenA).toFixed(6)}}{${pB.toFixed(6)}} = ${pAGivenB.toFixed(6)}`,
    },
  ];

  return {
    n,
    r,
    nPr: nPrVal,
    nCr: nCrVal,
    pA,
    pNotA,
    pBGivenA,
    pBGivenNotA,
    pB,
    pAGivenB,
    steps,
  };
}

function logFactorial(k: number): number {
  let s = 0;
  for (let i = 2; i <= k; i++) s += Math.log(i);
  return s;
}

// Abramowitz & Stegun 7.1.26 erf approximation (max error ~1.5e-7)
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const poly =
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t) *
    Math.exp(-ax * ax);
  return sign * (1 - poly);
}

function normalCdf(x: number, mean: number, stdDev: number): number {
  return 0.5 * (1 + erf((x - mean) / (stdDev * Math.SQRT2)));
}

function normalPdf(x: number, mean: number, stdDev: number): number {
  const z = (x - mean) / stdDev;
  return Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
}

export function computeDistribution(opts: {
  type: DistributionType;
  n: number;
  p: number;
  lambda: number;
  mean: number;
  stdDev: number;
  k: number;
  xLow: number;
  xHigh: number;
}): DistributionResult {
  if (opts.type === 'binomial') {
    const n = Math.floor(opts.n);
    const p = opts.p;
    const k = Math.floor(opts.k);
    if (n < 1 || n > 200 || p < 0 || p > 1 || k < 0 || k > n) {
      throw new Error('Binomial requires 1 <= n <= 200, 0 <= p <= 1, and 0 <= k <= n.');
    }
    const pmf = (x: number) => {
      if (p === 0) return x === 0 ? 1 : 0;
      if (p === 1) return x === n ? 1 : 0;
      const logP =
        logFactorial(n) -
        logFactorial(x) -
        logFactorial(n - x) +
        x * Math.log(p) +
        (n - x) * Math.log(1 - p);
      return Math.exp(logP);
    };
    const pointProb = pmf(k);
    let cdfProb = 0;
    const series: DistributionResult['series'] = [];
    for (let x = 0; x <= n; x++) {
      const val = pmf(x);
      if (x <= k) cdfProb += val;
      series.push({ x, label: String(x), density: val, highlighted: x === k });
    }
    const mean = n * p;
    const variance = n * p * (1 - p);
    return {
      type: 'binomial',
      mean,
      variance,
      stdDev: Math.sqrt(variance),
      pointValueLabel: `P(X = ${k})`,
      pointProb,
      cdfProb,
      intervalProb: 1 - cdfProb + pointProb,
      series,
      steps: [
        {
          id: 'bin-pmf',
          rule: 'Binomial PMF',
          description: `B(n = ${n}, p = ${p}) evaluated at k = ${k}.`,
          latex: `P(X = ${k}) = \\binom{${n}}{${k}} (${p})^{${k}} (${(1 - p).toFixed(4)})^{${n - k}} = ${pointProb.toFixed(6)}`,
        },
        {
          id: 'bin-cdf',
          rule: 'Cumulative Probability & Moments',
          description: 'Mean np and variance np(1-p).',
          latex: `P(X \\le ${k}) = ${cdfProb.toFixed(6)},\\quad \\mu = ${mean.toFixed(4)},\\; \\sigma^2 = ${variance.toFixed(4)}`,
        },
      ],
    };
  }

  if (opts.type === 'poisson') {
    const lambda = opts.lambda;
    const k = Math.floor(opts.k);
    if (!Number.isFinite(lambda) || lambda <= 0 || lambda > 100 || k < 0 || k > 150) {
      throw new Error('Poisson requires 0 < λ <= 100 and integer k in [0, 150].');
    }
    const pmf = (x: number) => Math.exp(x * Math.log(lambda) - lambda - logFactorial(x));
    const maxPlot = Math.max(k + 4, Math.ceil(lambda + 4 * Math.sqrt(lambda) + 3), 10);
    const pointProb = pmf(k);
    let cdfProb = 0;
    for (let x = 0; x <= k; x++) cdfProb += pmf(x);
    const series: DistributionResult['series'] = [];
    for (let x = 0; x <= Math.min(maxPlot, 80); x++) {
      series.push({ x, label: String(x), density: pmf(x), highlighted: x === k });
    }
    return {
      type: 'poisson',
      mean: lambda,
      variance: lambda,
      stdDev: Math.sqrt(lambda),
      pointValueLabel: `P(X = ${k})`,
      pointProb,
      cdfProb: Math.min(1, cdfProb),
      intervalProb: Math.max(0, 1 - cdfProb),
      series,
      steps: [
        {
          id: 'poi-pmf',
          rule: 'Poisson PMF',
          description: `Rate parameter λ = ${lambda} at k = ${k}.`,
          latex: `P(X = ${k}) = \\frac{e^{-${lambda}} ${lambda}^{${k}}}{${k}!} = ${pointProb.toFixed(6)}`,
        },
        {
          id: 'poi-cdf',
          rule: 'Cumulative Distribution',
          description: 'Sum over 0 <= i <= k; mean and variance both equal λ.',
          latex: `P(X \\le ${k}) = ${Math.min(1, cdfProb).toFixed(6)},\\quad P(X > ${k}) = ${Math.max(0, 1 - cdfProb).toFixed(6)}`,
        },
      ],
    };
  }

  // Normal distribution
  const { mean, stdDev, xLow, xHigh } = opts;
  if (!Number.isFinite(mean) || !Number.isFinite(stdDev) || stdDev <= 0) {
    throw new Error('Normal distribution requires finite mean μ and standard deviation σ > 0.');
  }
  const a = Math.min(xLow, xHigh);
  const b = Math.max(xLow, xHigh);
  const cdfHigh = normalCdf(b, mean, stdDev);
  const cdfLow = normalCdf(a, mean, stdDev);
  const intervalProb = Math.max(0, cdfHigh - cdfLow);
  const zHigh = (b - mean) / stdDev;
  const pdfAtHigh = normalPdf(b, mean, stdDev);

  const minPlot = mean - 4 * stdDev;
  const maxPlot = mean + 4 * stdDev;
  const stepsCount = 80;
  const series: DistributionResult['series'] = [];
  for (let i = 0; i <= stepsCount; i++) {
    const x = minPlot + (i / stepsCount) * (maxPlot - minPlot);
    series.push({
      x,
      label: x.toFixed(2),
      density: normalPdf(x, mean, stdDev),
      highlighted: x >= a && x <= b,
    });
  }

  return {
    type: 'normal',
    mean,
    variance: stdDev * stdDev,
    stdDev,
    pointValueLabel: `f(${b.toFixed(2)}) PDF`,
    pointProb: pdfAtHigh,
    cdfProb: cdfHigh,
    intervalProb,
    zScore: zHigh,
    series,
    steps: [
      {
        id: 'norm-z',
        rule: 'Standard Normal Z-Transform',
        description: `Standardize bounds [${a.toFixed(3)}, ${b.toFixed(3)}] using Z = (X - μ)/σ.`,
        latex: `Z(b) = \\frac{${b.toFixed(3)} - ${mean.toFixed(3)}}{${stdDev.toFixed(3)}} = ${zHigh.toFixed(4)}`,
      },
      {
        id: 'norm-cdf',
        rule: 'Cumulative & Interval Probability',
        description: 'Area under Gaussian density curve.',
        latex: `P(${a.toFixed(2)} \\le X \\le ${b.toFixed(2)}) = \\Phi(${zHigh.toFixed(3)}) - \\Phi(${((a - mean) / stdDev).toFixed(3)}) = ${intervalProb.toFixed(6)}`,
      },
    ],
  };
}

export function computeLinearRegression(
  points: { x: number; y: number }[],
  predictX?: number
): RegressionResult {
  const clean = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length < 2) {
    throw new Error('Provide at least two valid (x, y) data points for linear regression.');
  }
  const n = clean.length;
  const xMean = clean.reduce((s, p) => s + p.x, 0) / n;
  const yMean = clean.reduce((s, p) => s + p.y, 0) / n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of clean) {
    const dx = p.x - xMean;
    const dy = p.y - yMean;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  if (sxx < 1e-12) {
    throw new Error('All x-values are identical; linear regression slope is undefined.');
  }

  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const r = syy < 1e-12 ? 1 : sxy / Math.sqrt(sxx * syy);
  const rSquared = r * r;
  const covariance = n > 1 ? sxy / (n - 1) : sxy / n;

  const residuals = clean.map((p) => {
    const yHat = intercept + slope * p.x;
    return { x: p.x, y: p.y, yHat, residual: p.y - yHat };
  });
  const sse = residuals.reduce((s, item) => s + item.residual * item.residual, 0);
  const predictedY =
    predictX !== undefined && Number.isFinite(predictX) ? intercept + slope * predictX : undefined;

  const steps: DerivationStep[] = [
    {
      id: 'reg-means',
      rule: 'Sample Means & Sums of Squares',
      description: `Computed over n = ${n} coordinate pairs.`,
      latex: `\\bar{x} = ${xMean.toFixed(4)},\\; \\bar{y} = ${yMean.toFixed(4)},\\; S_{xx} = ${sxx.toFixed(4)},\\; S_{xy} = ${sxy.toFixed(4)}`,
    },
    {
      id: 'reg-line',
      rule: 'Least-Squares Regression Line',
      description: 'Slope b₁ = Sxy / Sxx and intercept b₀ = ȳ - b₁x̄.',
      latex: `\\hat{y} = ${intercept.toFixed(4)} ${slope >= 0 ? '+' : '-'} ${Math.abs(slope).toFixed(4)}x`,
    },
    {
      id: 'reg-corr',
      rule: 'Pearson Correlation & Fit',
      description: 'Correlation coefficient r and coefficient of determination R².',
      latex: `r = ${r.toFixed(4)},\\quad R^2 = ${rSquared.toFixed(4)},\\quad \\text{Cov}(X,Y) = ${covariance.toFixed(4)}`,
    },
  ];

  return {
    points: clean,
    slope,
    intercept,
    r,
    rSquared,
    covariance,
    xMean,
    yMean,
    sse,
    predictedX: predictX !== undefined && Number.isFinite(predictX) ? predictX : undefined,
    predictedY,
    residuals,
    steps,
  };
}
