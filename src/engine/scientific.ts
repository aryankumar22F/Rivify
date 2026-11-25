import type { AngleUnit } from '../types';

export interface ScientificEvaluation {
  expression: string;
  value: number;
  decimalFormatted: string;
  scientificNotation: string;
  fractionFormatted: string | null;
  latex: string;
}

type SciToken =
  | { kind: 'num'; value: number; raw: string }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '^' | 'mod' }
  | { kind: 'postfix'; value: '!' | '%' }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' };

const SCI_FUNCTIONS = new Set<string>([
  'sin',
  'cos',
  'tan',
  'csc',
  'sec',
  'cot',
  'asin',
  'acos',
  'atan',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'log',
  'ln',
  'log2',
  'exp',
  'sqrt',
  'cbrt',
  'abs',
  'floor',
  'ceil',
  'round',
  'root',
  'ncr',
  'npr',
  'fact',
]);

const SCI_CONSTANTS = new Set<string>(['pi', 'e', 'ans']);

function factorial(n: number): number {
  if (!Number.isFinite(n) || n < 0 || Math.abs(n - Math.round(n)) > 1e-12) {
    throw new Error('Factorial (!) is only defined for non-negative integers.');
  }
  const intN = Math.round(n);
  if (intN > 170) {
    throw new Error('Factorial overflow: maximum supported integer is 170.');
  }
  let res = 1;
  for (let i = 2; i <= intN; i++) res *= i;
  return res;
}

function nCr(n: number, r: number): number {
  if (
    !Number.isFinite(n) ||
    !Number.isFinite(r) ||
    n < 0 ||
    r < 0 ||
    Math.abs(n - Math.round(n)) > 1e-9 ||
    Math.abs(r - Math.round(r)) > 1e-9
  ) {
    throw new Error('nCr requires non-negative integers.');
  }
  const ni = Math.round(n);
  const ri = Math.round(r);
  if (ri > ni) return 0;
  if (ri === 0 || ri === ni) return 1;
  const k = Math.min(ri, ni - ri);
  let res = 1;
  for (let i = 1; i <= k; i++) {
    res = (res * (ni - k + i)) / i;
  }
  return Math.round(res);
}

function nPr(n: number, r: number): number {
  if (
    !Number.isFinite(n) ||
    !Number.isFinite(r) ||
    n < 0 ||
    r < 0 ||
    Math.abs(n - Math.round(n)) > 1e-9 ||
    Math.abs(r - Math.round(r)) > 1e-9
  ) {
    throw new Error('nPr requires non-negative integers.');
  }
  const ni = Math.round(n);
  const ri = Math.round(r);
  if (ri > ni) return 0;
  let res = 1;
  for (let i = 0; i < ri; i++) res *= ni - i;
  return res;
}

function tokenizeScientific(input: string): SciToken[] {
  const cleaned = input
    .replace(/π/g, 'pi')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/·/g, '*')
    .replace(/−/g, '-')
    .replace(/√/g, 'sqrt')
    .trim();

  if (!cleaned) {
    throw new Error('Enter an expression to calculate.');
  }

  const raw: SciToken[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++;
      continue;
    }

    // Number (including scientific notation like 1.5e-3 or 2e4)
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let s = '';
      let dots = 0;
      while (i < cleaned.length && ((cleaned[i] >= '0' && cleaned[i] <= '9') || cleaned[i] === '.')) {
        if (cleaned[i] === '.') dots++;
        if (dots > 1) throw new Error(`Invalid decimal number near "${s}."`);
        s += cleaned[i];
        i++;
      }
      if (
        i < cleaned.length &&
        (cleaned[i] === 'e' || cleaned[i] === 'E') &&
        i + 1 < cleaned.length &&
        (cleaned[i + 1] === '+' ||
          cleaned[i + 1] === '-' ||
          (cleaned[i + 1] >= '0' && cleaned[i + 1] <= '9'))
      ) {
        s += cleaned[i];
        i++;
        if (cleaned[i] === '+' || cleaned[i] === '-') {
          s += cleaned[i];
          i++;
        }
        while (i < cleaned.length && cleaned[i] >= '0' && cleaned[i] <= '9') {
          s += cleaned[i];
          i++;
        }
      }
      const v = Number(s);
      if (!Number.isFinite(v)) throw new Error(`Invalid number "${s}"`);
      raw.push({ kind: 'num', value: v, raw: s });
      continue;
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      let ident = '';
      while (
        i < cleaned.length &&
        ((cleaned[i] >= 'a' && cleaned[i] <= 'z') ||
          (cleaned[i] >= 'A' && cleaned[i] <= 'Z') ||
          (cleaned[i] >= '0' && cleaned[i] <= '9'))
      ) {
        ident += cleaned[i].toLowerCase();
        i++;
      }
      if (ident === 'mod') {
        raw.push({ kind: 'op', value: 'mod' });
      } else {
        raw.push({ kind: 'ident', value: ident });
      }
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      raw.push({ kind: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '!' || ch === '%') {
      raw.push({ kind: 'postfix', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      raw.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      raw.push({ kind: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',') {
      raw.push({ kind: 'comma' });
      i++;
      continue;
    }

    throw new Error(`Unsupported symbol "${ch}"`);
  }

  // Insert implicit multiplication where unambiguous (e.g., 2pi, 2(3+4), (2)(3), 3sin(30))
  const out: SciToken[] = [];
  for (let idx = 0; idx < raw.length; idx++) {
    const curr = raw[idx];
    out.push(curr);
    if (idx === raw.length - 1) continue;
    const next = raw[idx + 1];
    const currValueEnd =
      curr.kind === 'num' ||
      curr.kind === 'rparen' ||
      curr.kind === 'postfix' ||
      (curr.kind === 'ident' && SCI_CONSTANTS.has(curr.value));
    const nextValueStart =
      next.kind === 'num' || next.kind === 'lparen' || next.kind === 'ident';
    if (currValueEnd && nextValueStart) {
      out.push({ kind: 'op', value: '*' });
    }
  }
  return out;
}

export function evaluateScientificExpression(
  input: string,
  opts?: {
    angleUnit?: AngleUnit;
    precision?: number;
    ansValue?: number;
  }
): ScientificEvaluation {
  const angleUnit = opts?.angleUnit ?? 'rad';
  const precision = Math.min(12, Math.max(2, opts?.precision ?? 6));
  const ansValue = opts?.ansValue ?? 0;

  const tokens = tokenizeScientific(input);
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const toRad = (v: number) => (angleUnit === 'deg' ? (v * Math.PI) / 180 : v);
  const fromRad = (v: number) => (angleUnit === 'deg' ? (v * 180) / Math.PI : v);

  function parseAddSub(): number {
    let left = parseMulDivMod();
    while (peek()?.kind === 'op' && ((peek() as { value: string }).value === '+' || (peek() as { value: string }).value === '-')) {
      const op = (consume() as { kind: 'op'; value: '+' | '-' }).value;
      const right = parseMulDivMod();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseMulDivMod(): number {
    let left = parseUnary();
    while (
      peek()?.kind === 'op' &&
      ((peek() as { value: string }).value === '*' ||
        (peek() as { value: string }).value === '/' ||
        (peek() as { value: string }).value === 'mod')
    ) {
      const op = (consume() as { kind: 'op'; value: '*' | '/' | 'mod' }).value;
      const right = parseUnary();
      if (op === '*') left = left * right;
      else if (op === '/') {
        if (Math.abs(right) < 1e-15) throw new Error('Division by zero is undefined.');
        left = left / right;
      } else {
        if (Math.abs(right) < 1e-15) throw new Error('Modulo by zero is undefined.');
        left = ((left % right) + right) % right;
      }
    }
    return left;
  }

  function parseUnary(): number {
    const t = peek();
    if (t?.kind === 'op' && t.value === '-') {
      consume();
      return -parseUnary();
    }
    if (t?.kind === 'op' && t.value === '+') {
      consume();
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower(): number {
    const base = parsePostfix();
    const t = peek();
    if (t?.kind === 'op' && t.value === '^') {
      consume();
      const exp = parseUnary();
      const val = Math.pow(base, exp);
      if (!Number.isFinite(val)) {
        throw new Error('Power operation resulted in overflow or undefined real number.');
      }
      return val;
    }
    return base;
  }

  function parsePostfix(): number {
    let val = parsePrimary();
    while (peek()?.kind === 'postfix') {
      const pf = (consume() as { kind: 'postfix'; value: '!' | '%' }).value;
      if (pf === '!') val = factorial(val);
      else val = val / 100;
    }
    return val;
  }

  function applyFunc(name: string, args: number[]): number {
    const fn =
      name === 'arcsin'
        ? 'asin'
        : name === 'arccos'
        ? 'acos'
        : name === 'arctan'
        ? 'atan'
        : name;

    if (fn === 'root' || fn === 'ncr' || fn === 'npr') {
      if (args.length !== 2) throw new Error(`${name}(a, b) requires exactly 2 arguments.`);
      if (fn === 'ncr') return nCr(args[0], args[1]);
      if (fn === 'npr') return nPr(args[0], args[1]);
      const [n, x] = args;
      if (n === 0) throw new Error('0th root is undefined.');
      if (x < 0 && Math.abs(n % 2) !== 1) {
        throw new Error('Even root of a negative number is not real.');
      }
      return x < 0 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n);
    }

    if (args.length !== 1) throw new Error(`${name}(x) requires 1 argument.`);
    const a = args[0];

    switch (fn) {
      case 'sin': {
        const v = Math.sin(toRad(a));
        return Math.abs(v) < 1e-14 ? 0 : v;
      }
      case 'cos': {
        const v = Math.cos(toRad(a));
        return Math.abs(v) < 1e-14 ? 0 : v;
      }
      case 'tan': {
        const c = Math.cos(toRad(a));
        if (Math.abs(c) < 1e-13) throw new Error('Tangent is undefined at odd multiples of 90° (π/2).');
        const v = Math.tan(toRad(a));
        return Math.abs(v) < 1e-14 ? 0 : v;
      }
      case 'csc': {
        const s = Math.sin(toRad(a));
        if (Math.abs(s) < 1e-13) throw new Error('Cosecant is undefined where sin(x) = 0.');
        return 1 / s;
      }
      case 'sec': {
        const c = Math.cos(toRad(a));
        if (Math.abs(c) < 1e-13) throw new Error('Secant is undefined where cos(x) = 0.');
        return 1 / c;
      }
      case 'cot': {
        const s = Math.sin(toRad(a));
        if (Math.abs(s) < 1e-13) throw new Error('Cotangent is undefined where sin(x) = 0.');
        return Math.cos(toRad(a)) / s;
      }
      case 'asin':
        if (a < -1 || a > 1) throw new Error('arcsin domain requires -1 ≤ x ≤ 1.');
        return fromRad(Math.asin(a));
      case 'acos':
        if (a < -1 || a > 1) throw new Error('arccos domain requires -1 ≤ x ≤ 1.');
        return fromRad(Math.acos(a));
      case 'atan':
        return fromRad(Math.atan(a));
      case 'sinh':
        return Math.sinh(a);
      case 'cosh':
        return Math.cosh(a);
      case 'tanh':
        return Math.tanh(a);
      case 'asinh':
        return Math.asinh(a);
      case 'acosh':
        if (a < 1) throw new Error('arccosh domain requires x ≥ 1.');
        return Math.acosh(a);
      case 'atanh':
        if (a <= -1 || a >= 1) throw new Error('arctanh domain requires -1 < x < 1.');
        return Math.atanh(a);
      case 'ln':
        if (a <= 0) throw new Error('Natural logarithm ln(x) requires x > 0.');
        return Math.log(a);
      case 'log':
        if (a <= 0) throw new Error('Common logarithm log(x) requires x > 0.');
        return Math.log10(a);
      case 'log2':
        if (a <= 0) throw new Error('Binary logarithm log₂(x) requires x > 0.');
        return Math.log2(a);
      case 'exp':
        return Math.exp(a);
      case 'sqrt':
        if (a < 0) throw new Error('Square root of a negative number is not real.');
        return Math.sqrt(a);
      case 'cbrt':
        return Math.cbrt(a);
      case 'abs':
        return Math.abs(a);
      case 'floor':
        return Math.floor(a);
      case 'ceil':
        return Math.ceil(a);
      case 'round':
        return Math.round(a);
      case 'fact':
        return factorial(a);
      default:
        throw new Error(`Unknown function "${name}".`);
    }
  }

  function parsePrimary(): number {
    const t = peek();
    if (!t) throw new Error('Unexpected end of expression.');

    if (t.kind === 'num') {
      consume();
      return t.value;
    }

    if (t.kind === 'ident') {
      consume();
      if (t.value === 'pi') return Math.PI;
      if (t.value === 'e') return Math.E;
      if (t.value === 'ans') return ansValue;

      if (SCI_FUNCTIONS.has(t.value)) {
        const next = peek();
        if (!next || next.kind !== 'lparen') {
          throw new Error(`Expected "(" after function "${t.value}".`);
        }
        consume();
        const args: number[] = [parseAddSub()];
        while (peek()?.kind === 'comma') {
          consume();
          args.push(parseAddSub());
        }
        const close = peek();
        if (!close || close.kind !== 'rparen') {
          throw new Error(`Missing ")" for function "${t.value}".`);
        }
        consume();
        return applyFunc(t.value, args);
      }
      throw new Error(`Unknown identifier "${t.value}".`);
    }

    if (t.kind === 'lparen') {
      consume();
      const inner = parseAddSub();
      const close = peek();
      if (!close || close.kind !== 'rparen') {
        throw new Error('Missing closing parenthesis ")".');
      }
      consume();
      return inner;
    }

    throw new Error('Invalid syntax in expression.');
  }

  const value = parseAddSub();
  if (pos < tokens.length) {
    throw new Error('Unexpected trailing tokens in expression.');
  }
  if (!Number.isFinite(value)) {
    throw new Error('Numerical overflow or undefined mathematical result.');
  }

  const cleanVal = Math.abs(value) < 1e-13 ? 0 : value;
  const decimalFormatted = Number.isInteger(cleanVal)
    ? String(cleanVal)
    : Number(cleanVal.toFixed(precision)).toString();

  return {
    expression: input,
    value: cleanVal,
    decimalFormatted,
    scientificNotation: cleanVal === 0 ? '0' : cleanVal.toExponential(Math.min(6, precision)),
    fractionFormatted: toFractionString(cleanVal),
    latex: formatScientificInputLatex(input),
  };
}

export function toFractionString(val: number, maxDen = 10000): string | null {
  if (!Number.isFinite(val)) return null;
  if (Math.abs(val - Math.round(val)) < 1e-11) {
    return String(Math.round(val));
  }
  const sign = val < 0 ? -1 : 1;
  const x = Math.abs(val);
  if (x > 1e6) return null;

  let h1 = 1;
  let h0 = 0;
  let k1 = 0;
  let k0 = 1;
  let b = x;

  for (let i = 0; i < 32; i++) {
    const a = Math.floor(b);
    const auxH = h1;
    h1 = a * h1 + h0;
    h0 = auxH;
    const auxK = k1;
    k1 = a * k1 + k0;
    k0 = auxK;
    if (k1 > maxDen) {
      return Math.abs(val - (sign * h0) / k0) < 1e-8 ? `${sign * h0}/${k0}` : null;
    }
    const approx = h1 / k1;
    if (Math.abs(x - approx) < 1e-9) {
      return k1 === 1 ? String(sign * h1) : `${sign * h1}/${k1}`;
    }
    const frac = b - a;
    if (frac < 1e-12) break;
    b = 1 / frac;
  }
  return null;
}

export function formatScientificInputLatex(expr: string): string {
  return expr
    .replace(/pi/gi, '\\pi ')
    .replace(/sqrt\(/g, '\\sqrt{')
    .replace(/\*/g, ' \\cdot ')
    .replace(/mod/gi, ' \\bmod ');
}

export function toSolverExpression(expr: string): string {
  return expr
    .replace(/π/g, 'pi')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/√/g, 'sqrt')
    .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
}
