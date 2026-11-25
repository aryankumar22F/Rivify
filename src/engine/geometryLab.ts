import type { DerivationStep } from '../types';

export interface Geo2DResult {
  distance: number;
  midpoint: [number, number];
  lineFromPointsLatex: string;
  intersection: [number, number] | null;
  angleDeg: number;
  pointToLineDistance: number;
  triangleArea: number;
  steps: DerivationStep[];
}

export function compute2DCoordinateGeometry(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  line1: { a: number; b: number; c: number },
  line2: { a: number; b: number; c: number }
): Geo2DResult {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const distance = Math.hypot(dx, dy);
  const midpoint: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

  // Line through p1, p2: (y1 - y2)x + (x2 - x1)y + (x1*y2 - x2*y1) = 0
  const la = p1[1] - p2[1];
  const lb = p2[0] - p1[0];
  const lc = p1[0] * p2[1] - p2[0] * p1[1];
  const lineFromPointsLatex = `${Number(la.toFixed(3))}x ${lb >= 0 ? '+' : '-'} ${Math.abs(Number(lb.toFixed(3)))}y ${lc >= 0 ? '+' : '-'} ${Math.abs(Number(lc.toFixed(3)))} = 0`;

  // Intersection of line1 and line2: a1*x + b1*y + c1 = 0
  const det = line1.a * line2.b - line2.a * line1.b;
  let intersection: [number, number] | null = null;
  if (Math.abs(det) > 1e-10) {
    const ix = (line1.b * line2.c - line2.b * line1.c) / det;
    const iy = (line2.a * line1.c - line1.a * line2.c) / det;
    intersection = [ix, iy];
  }

  const n1 = Math.hypot(line1.a, line1.b);
  const n2 = Math.hypot(line2.a, line2.b);
  let angleDeg = 0;
  if (n1 > 1e-10 && n2 > 1e-10) {
    const cosT = Math.min(1, Math.abs(line1.a * line2.a + line1.b * line2.b) / (n1 * n2));
    angleDeg = (Math.acos(cosT) * 180) / Math.PI;
  }

  const pointToLineDistance =
    n1 > 1e-10 ? Math.abs(line1.a * p1[0] + line1.b * p1[1] + line1.c) / n1 : 0;

  const triangleArea =
    0.5 *
    Math.abs(
      p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1])
    );

  return {
    distance,
    midpoint,
    lineFromPointsLatex,
    intersection,
    angleDeg,
    pointToLineDistance,
    triangleArea,
    steps: [
      {
        id: 'g2-1',
        rule: 'Euclidean Distance & Line Equation',
        description: `Segment from (${p1[0]}, ${p1[1]}) to (${p2[0]}, ${p2[1]}).`,
        latex: `d = ${distance.toFixed(4)},\\quad M = (${midpoint[0].toFixed(2)}, ${midpoint[1].toFixed(2)}),\\quad ${lineFromPointsLatex}`,
      },
      {
        id: 'g2-2',
        rule: 'Line Intersection & Acute Angle',
        description: intersection
          ? `Lines intersect at (${intersection[0].toFixed(3)}, ${intersection[1].toFixed(3)}) with acute angle ${angleDeg.toFixed(2)}°.`
          : 'Lines are parallel or coincident (determinant = 0).',
        latex: intersection
          ? `P = (${intersection[0].toFixed(3)}, ${intersection[1].toFixed(3)}),\\quad \\theta = ${angleDeg.toFixed(2)}^\\circ`
          : `\\det = 0\\; (\\text{Parallel Lines})`,
      },
      {
        id: 'g2-3',
        rule: 'Point-to-Line Distance & Triangle Area',
        description: 'Perpendicular distance from P₁ to L₁ and shoelace area of ΔP₁P₂P₃.',
        latex: `d(P_1, L_1) = ${pointToLineDistance.toFixed(4)},\\quad \\text{Area}(\\triangle) = ${triangleArea.toFixed(4)}`,
      },
    ],
  };
}

export interface ConicResult {
  kind: 'Circle' | 'Ellipse' | 'Parabola' | 'Hyperbola' | 'Degenerate';
  discriminant: number;
  center: [number, number] | null;
  eccentricity: number;
  foci: [number, number][];
  semiMajor?: number;
  semiMinor?: number;
  standardLatex: string;
  samples: { x: number; y: number }[][];
  steps: DerivationStep[];
}

/**
 * Classifies and plots Ax^2 + Cy^2 + Dx + Ey + F = 0 (principal axes) and general Bxy discriminant
 */
export function analyzeConicSection(
  A: number,
  B: number,
  C: number,
  D: number,
  E: number,
  F: number
): ConicResult {
  const disc = B * B - 4 * A * C;
  let kind: ConicResult['kind'] = 'Degenerate';
  if (Math.abs(A) < 1e-9 && Math.abs(B) < 1e-9 && Math.abs(C) < 1e-9) {
    kind = 'Degenerate';
  } else if (Math.abs(disc) < 1e-8) {
    kind = 'Parabola';
  } else if (disc < 0) {
    kind = Math.abs(A - C) < 1e-8 && Math.abs(B) < 1e-8 ? 'Circle' : 'Ellipse';
  } else {
    kind = 'Hyperbola';
  }

  let center: [number, number] | null = null;
  let eccentricity = kind === 'Parabola' ? 1 : 0;
  const foci: [number, number][] = [];
  let semiMajor: number | undefined;
  let semiMinor: number | undefined;
  let standardLatex = `${A}x^2 + ${B}xy + ${C}y^2 + ${D}x + ${E}y + ${F} = 0`;

  // Exact center/foci/eccentricity for axis-aligned conics (B = 0)
  if (Math.abs(B) < 1e-9 && (Math.abs(A) > 1e-9 || Math.abs(C) > 1e-9)) {
    if (Math.abs(A) > 1e-9 && Math.abs(C) > 1e-9) {
      const h = -D / (2 * A);
      const k = -E / (2 * C);
      center = [h, k];
      const rhs = (D * D) / (4 * A) + (E * E) / (4 * C) - F;
      if (A * C > 0 && rhs / A > 0) {
        const rx = Math.sqrt(rhs / A);
        const ry = Math.sqrt(rhs / C);
        semiMajor = Math.max(rx, ry);
        semiMinor = Math.min(rx, ry);
        const cFocus = Math.sqrt(Math.max(0, semiMajor * semiMajor - semiMinor * semiMinor));
        eccentricity = semiMajor > 1e-9 ? cFocus / semiMajor : 0;
        if (rx >= ry) {
          foci.push([h - cFocus, k], [h + cFocus, k]);
        } else {
          foci.push([h, k - cFocus], [h, k + cFocus]);
        }
        standardLatex =
          kind === 'Circle'
            ? `(x ${h >= 0 ? '-' : '+'} ${Math.abs(h).toFixed(2)})^2 + (y ${k >= 0 ? '-' : '+'} ${Math.abs(k).toFixed(2)})^2 = ${rx.toFixed(2)}^2`
            : `\\frac{(x ${h >= 0 ? '-' : '+'} ${Math.abs(h).toFixed(2)})^2}{${(rx * rx).toFixed(2)}} + \\frac{(y ${k >= 0 ? '-' : '+'} ${Math.abs(k).toFixed(2)})^2}{${(ry * ry).toFixed(2)}} = 1`;
      } else if (A * C < 0 && Math.abs(rhs) > 1e-9) {
        const ax2 = rhs / A;
        const cy2 = rhs / C;
        const posX = ax2 > 0;
        const aVal = Math.sqrt(Math.abs(posX ? ax2 : cy2));
        const bVal = Math.sqrt(Math.abs(posX ? cy2 : ax2));
        const cFocus = Math.hypot(aVal, bVal);
        semiMajor = aVal;
        semiMinor = bVal;
        eccentricity = cFocus / aVal;
        if (posX) foci.push([h - cFocus, k], [h + cFocus, k]);
        else foci.push([h, k - cFocus], [h, k + cFocus]);
        standardLatex = posX
          ? `\\frac{(x-${h.toFixed(2)})^2}{${(aVal * aVal).toFixed(2)}} - \\frac{(y-${k.toFixed(2)})^2}{${(bVal * bVal).toFixed(2)}} = 1`
          : `\\frac{(y-${k.toFixed(2)})^2}{${(aVal * aVal).toFixed(2)}} - \\frac{(x-${h.toFixed(2)})^2}{${(bVal * bVal).toFixed(2)}} = 1`;
      }
    } else if (Math.abs(A) > 1e-9 && Math.abs(E) > 1e-9) {
      // Vertical parabola: A(x-h)^2 = -E(y-k)
      const h = -D / (2 * A);
      const k = (D * D / (4 * A) - F) / E;
      center = [h, k];
      const p = -E / (4 * A);
      foci.push([h, k + p]);
      eccentricity = 1;
      standardLatex = `(x ${h >= 0 ? '-' : '+'} ${Math.abs(h).toFixed(2)})^2 = ${(4 * p).toFixed(2)}(y ${k >= 0 ? '-' : '+'} ${Math.abs(k).toFixed(2)})`;
    } else if (Math.abs(C) > 1e-9 && Math.abs(D) > 1e-9) {
      const k = -E / (2 * C);
      const h = (E * E / (4 * C) - F) / D;
      center = [h, k];
      const p = -D / (4 * C);
      foci.push([h + p, k]);
      eccentricity = 1;
      standardLatex = `(y ${k >= 0 ? '-' : '+'} ${Math.abs(k).toFixed(2)})^2 = ${(4 * p).toFixed(2)}(x ${h >= 0 ? '-' : '+'} ${Math.abs(h).toFixed(2)})`;
    }
  }

  // Numerical implicit curve contour segments on [-10, 10]^2 via marching-squares points
  const samples: { x: number; y: number }[][] = [];
  const evalConic = (x: number, y: number) => A * x * x + B * x * y + C * y * y + D * x + E * y + F;
  const grid = 64;
  const span = 10;
  const step = (2 * span) / grid;
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const x0 = -span + i * step;
      const y0 = -span + j * step;
      const x1 = x0 + step;
      const y1 = y0 + step;
      const v00 = evalConic(x0, y0);
      const v10 = evalConic(x1, y0);
      const v11 = evalConic(x1, y1);
      const v01 = evalConic(x0, y1);
      const pts: { x: number; y: number }[] = [];
      const interp = (aX: number, aY: number, bX: number, bY: number, va: number, vb: number) => {
        if ((va <= 0 && vb > 0) || (va >= 0 && vb < 0)) {
          const t = va / (va - vb);
          pts.push({ x: aX + t * (bX - aX), y: aY + t * (bY - aY) });
        }
      };
      interp(x0, y0, x1, y0, v00, v10);
      interp(x1, y0, x1, y1, v10, v11);
      interp(x1, y1, x0, y1, v11, v01);
      interp(x0, y1, x0, y0, v01, v00);
      if (pts.length >= 2) {
        samples.push([pts[0], pts[1]]);
      }
    }
  }

  return {
    kind,
    discriminant: disc,
    center,
    eccentricity,
    foci,
    semiMajor,
    semiMinor,
    standardLatex,
    samples,
    steps: [
      {
        id: 'con-1',
        rule: 'Quadratic Discriminant Classification',
        description: `B² - 4AC = ${disc.toFixed(4)} → ${kind}.`,
        latex: `\\Delta = B^2 - 4AC = ${disc.toFixed(4)} \\implies \\textbf{${kind}}`,
      },
      {
        id: 'con-2',
        rule: 'Standard Canonical Form & Eccentricity',
        description: center
          ? `Center/Vertex at (${center[0].toFixed(3)}, ${center[1].toFixed(3)}), eccentricity e = ${eccentricity.toFixed(4)}.`
          : 'General conic equation classified.',
        latex: `${standardLatex},\\quad e = ${eccentricity.toFixed(4)}`,
      },
    ],
  };
}

// ---------------- 2D Geometric Transformations ----------------

export interface GeoTransform2DResult {
  matrix: number[][];
  original: [number, number][];
  transformed: [number, number][];
  steps: DerivationStep[];
}

export function apply2DTransform(
  shape: [number, number][],
  tx: number,
  ty: number,
  angleDeg: number,
  sx: number,
  sy: number,
  reflect: 'none' | 'x-axis' | 'y-axis' | 'y=x'
): GeoTransform2DResult {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);

  // Scale -> Reflect -> Rotate -> Translate
  let rx0 = sx;
  let ry0 = sy;
  let swapXY = false;
  if (reflect === 'x-axis') ry0 = -ry0;
  else if (reflect === 'y-axis') rx0 = -rx0;
  else if (reflect === 'y=x') swapXY = true;

  const m00 = swapXY ? -s * rx0 : c * rx0;
  const m01 = swapXY ? c * ry0 : -s * ry0;
  const m10 = swapXY ? c * rx0 : s * rx0;
  const m11 = swapXY ? s * ry0 : c * ry0;

  const matrix = [
    [Number(m00.toFixed(4)), Number(m01.toFixed(4)), Number(tx.toFixed(4))],
    [Number(m10.toFixed(4)), Number(m11.toFixed(4)), Number(ty.toFixed(4))],
    [0, 0, 1],
  ];

  const transformed: [number, number][] = shape.map(([x, y]) => [
    m00 * x + m01 * y + tx,
    m10 * x + m11 * y + ty,
  ]);

  return {
    matrix,
    original: shape,
    transformed,
    steps: [
      {
        id: 'gt-1',
        rule: 'Homogeneous 3×3 Transformation Matrix',
        description: `Composed scaling (${sx}, ${sy}), reflection (${reflect}), rotation (${angleDeg}°), and translation (${tx}, ${ty}).`,
        latex: `T = \\begin{bmatrix} ${matrix[0].join(' & ')} \\\\ ${matrix[1].join(' & ')} \\\\ 0 & 0 & 1 \\end{bmatrix}`,
      },
    ],
  };
}

// ---------------- 3D Geometry (Lines & Planes) ----------------

export interface Geo3DResult {
  planeAngleDeg: number;
  pointToPlaneDist: number;
  linePlaneIntersection: [number, number, number] | null;
  skewLinesDist: number;
  lineEquationLatex: string;
  planeEquationLatex: string;
  steps: DerivationStep[];
}

export function compute3DGeometry(
  p0: [number, number, number],
  d1: [number, number, number],
  p1: [number, number, number],
  d2: [number, number, number],
  plane1: { a: number; b: number; c: number; d: number },
  plane2: { a: number; b: number; c: number; d: number }
): Geo3DResult {
  const n1Mag = Math.hypot(plane1.a, plane1.b, plane1.c);
  const n2Mag = Math.hypot(plane2.a, plane2.b, plane2.c);
  const dotN = plane1.a * plane2.a + plane1.b * plane2.b + plane1.c * plane2.c;
  const planeAngleDeg =
    n1Mag > 1e-9 && n2Mag > 1e-9
      ? (Math.acos(Math.min(1, Math.abs(dotN) / (n1Mag * n2Mag))) * 180) / Math.PI
      : 0;

  // Plane ax + by + cz = d -> |a x0 + b y0 + c z0 - d| / |n|
  const pointToPlaneDist =
    n1Mag > 1e-9
      ? Math.abs(plane1.a * p0[0] + plane1.b * p0[1] + plane1.c * p0[2] - plane1.d) / n1Mag
      : 0;

  // Line L1(t) = p0 + t*d1 intersect Plane 1: n · (p0 + t d1) = d
  const denom = plane1.a * d1[0] + plane1.b * d1[1] + plane1.c * d1[2];
  let linePlaneIntersection: [number, number, number] | null = null;
  if (Math.abs(denom) > 1e-9) {
    const t = (plane1.d - (plane1.a * p0[0] + plane1.b * p0[1] + plane1.c * p0[2])) / denom;
    linePlaneIntersection = [p0[0] + t * d1[0], p0[1] + t * d1[1], p0[2] + t * d1[2]];
  }

  // Shortest distance between lines L1(p0, d1) and L2(p1, d2)
  const cross: [number, number, number] = [
    d1[1] * d2[2] - d1[2] * d2[1],
    d1[2] * d2[0] - d1[0] * d2[2],
    d1[0] * d2[1] - d1[1] * d2[0],
  ];
  const crossMag = Math.hypot(cross[0], cross[1], cross[2]);
  const diff: [number, number, number] = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  let skewLinesDist = 0;
  if (crossMag > 1e-9) {
    skewLinesDist = Math.abs(diff[0] * cross[0] + diff[1] * cross[1] + diff[2] * cross[2]) / crossMag;
  } else {
    // Parallel lines: |(p1 - p0) x d1| / |d1|
    const d1Mag = Math.hypot(d1[0], d1[1], d1[2]);
    if (d1Mag > 1e-9) {
      const pc = [
        diff[1] * d1[2] - diff[2] * d1[1],
        diff[2] * d1[0] - diff[0] * d1[2],
        diff[0] * d1[1] - diff[1] * d1[0],
      ];
      skewLinesDist = Math.hypot(pc[0], pc[1], pc[2]) / d1Mag;
    }
  }

  const lineEquationLatex = `\\mathbf{r}(t) = \\langle ${p0.join(', ')}\\rangle + t\\langle ${d1.join(', ')}\\rangle`;
  const planeEquationLatex = `${plane1.a}x ${plane1.b >= 0 ? '+' : '-'} ${Math.abs(plane1.b)}y ${plane1.c >= 0 ? '+' : '-'} ${Math.abs(plane1.c)}z = ${plane1.d}`;

  return {
    planeAngleDeg,
    pointToPlaneDist,
    linePlaneIntersection,
    skewLinesDist,
    lineEquationLatex,
    planeEquationLatex,
    steps: [
      {
        id: 'g3-1',
        rule: 'Point-to-Plane Distance & Dihedral Angle',
        description: `Distance from P₀ to Π₁ and acute angle between Π₁ and Π₂.`,
        latex: `d(P_0, \\Pi_1) = ${pointToPlaneDist.toFixed(4)},\\quad \\theta(\\Pi_1,\\Pi_2) = ${planeAngleDeg.toFixed(2)}^\\circ`,
      },
      {
        id: 'g3-2',
        rule: 'Line-Plane Intersection & Skew Line Distance',
        description: linePlaneIntersection
          ? `L₁ intersects Π₁ at (${linePlaneIntersection.map((v) => v.toFixed(3)).join(', ')}).`
          : 'Line L₁ is parallel to plane Π₁.',
        latex: linePlaneIntersection
          ? `P_{\\text{int}} = (${linePlaneIntersection.map((v) => v.toFixed(3)).join(', ')}),\\quad d(L_1, L_2) = ${skewLinesDist.toFixed(4)}`
          : `d(L_1, L_2) = ${skewLinesDist.toFixed(4)}`,
      },
    ],
  };
}
