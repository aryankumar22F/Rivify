import type { AngleUnit, DerivationStep } from '../types';

export type ExprNode =
  | { type: 'number'; value: number }
  | { type: 'constant'; name: 'pi' | 'e' }
  | { type: 'variable'; name: string }
  | { type: 'unary'; op: '-'; arg: ExprNode }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: ExprNode; right: ExprNode }
  | { type: 'func'; name: FuncName; arg: ExprNode };

export type FuncName =
  | 'sin'
  | 'cos'
  | 'tan'
  | 'csc'
  | 'sec'
  | 'cot'
  | 'asin'
  | 'acos'
  | 'atan'
  | 'sinh'
  | 'cosh'
  | 'tanh'
  | 'ln'
  | 'log'
  | 'exp'
  | 'sqrt'
  | 'abs';

const FUNCTIONS = new Set<string>([
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
  'ln',
  'log',
  'exp',
  'sqrt',
  'abs',
]);

const CONSTANTS = new Set<string>(['pi', 'e']);

type Token =
  | { kind: 'number'; value: number; raw: string }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

function normalizeFuncName(name: string): FuncName {
  if (name === 'arcsin') return 'asin';
  if (name === 'arccos') return 'acos';
  if (name === 'arctan') return 'atan';
  return name as FuncName;
}

export function tokenize(input: string): Token[] {
  const cleaned = input
    .replace(/π/g, 'pi')
    .replace(/·/g, '*')
    .replace(/×/g, '*')
    .replace(/−/g, '-')
    .replace(/\s+/g, '');

  if (!cleaned) {
    throw new Error('Expression is empty');
  }

  const rawTokens: Token[] = [];
  let i = 0;

  while (i < cleaned.length) {
    const ch = cleaned[i];

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let numStr = '';
      let dotCount = 0;
      while (i < cleaned.length && ((cleaned[i] >= '0' && cleaned[i] <= '9') || cleaned[i] === '.')) {
        if (cleaned[i] === '.') dotCount++;
        if (dotCount > 1) throw new Error(`Invalid number near "${numStr}."`);
        numStr += cleaned[i];
        i++;
      }
      const val = Number(numStr);
      if (Number.isNaN(val)) throw new Error(`Invalid number "${numStr}"`);
      rawTokens.push({ kind: 'number', value: val, raw: numStr });
      continue;
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      let ident = '';
      while (
        i < cleaned.length &&
        ((cleaned[i] >= 'a' && cleaned[i] <= 'z') ||
          (cleaned[i] >= 'A' && cleaned[i] <= 'Z'))
      ) {
        ident += cleaned[i].toLowerCase();
        i++;
      }

      if (FUNCTIONS.has(ident) || CONSTANTS.has(ident)) {
        rawTokens.push({ kind: 'ident', value: ident });
      } else if (ident.length > 1) {
        // Check if identifier ends with a known function or constant, or split into single-letter variables like "xy" -> x * y
        // First check if it starts with a known function/constant? No, e.g. "xsin" -> x * sin
        let cursor = 0;
        const sortedKnown = [...Array.from(FUNCTIONS), ...Array.from(CONSTANTS)].sort(
          (a, b) => b.length - a.length
        );
        while (cursor < ident.length) {
          const rest = ident.slice(cursor);
          const matched = sortedKnown.find((kw) => rest.startsWith(kw));
          if (matched) {
            rawTokens.push({ kind: 'ident', value: matched });
            cursor += matched.length;
          } else {
            rawTokens.push({ kind: 'ident', value: ident[cursor] });
            cursor += 1;
          }
        }
      } else {
        rawTokens.push({ kind: 'ident', value: ident });
      }
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      rawTokens.push({ kind: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      rawTokens.push({ kind: 'lparen' });
      i++;
      continue;
    }

    if (ch === ')') {
      rawTokens.push({ kind: 'rparen' });
      i++;
      continue;
    }

    throw new Error(`Unexpected character "${ch}"`);
  }

  // Insert implicit multiplication tokens
  const tokens: Token[] = [];
  for (let idx = 0; idx < rawTokens.length; idx++) {
    const curr = rawTokens[idx];
    tokens.push(curr);
    if (idx === rawTokens.length - 1) continue;
    const next = rawTokens[idx + 1];

    const currIsValueEnd =
      curr.kind === 'number' ||
      curr.kind === 'rparen' ||
      (curr.kind === 'ident' && !FUNCTIONS.has(curr.value));

    const nextIsValueStart =
      next.kind === 'number' ||
      next.kind === 'lparen' ||
      next.kind === 'ident';

    if (currIsValueEnd && nextIsValueStart) {
      tokens.push({ kind: 'op', value: '*' });
    }
  }

  return tokens;
}

export function parseExpression(input: string): ExprNode {
  const tokens = tokenize(input);
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    const t = tokens[pos];
    pos++;
    return t;
  }

  function parseAddSub(): ExprNode {
    let left = parseMulDiv();
    while (peek()?.kind === 'op' && (peek() as { kind: 'op'; value: string }).value.match(/^[+-]$/)) {
      const op = (consume() as { kind: 'op'; value: '+' | '-' }).value;
      const right = parseMulDiv();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  function parseMulDiv(): ExprNode {
    let left = parseUnary();
    while (peek()?.kind === 'op' && (peek() as { kind: 'op'; value: string }).value.match(/^[*/]$/)) {
      const op = (consume() as { kind: 'op'; value: '*' | '/' }).value;
      const right = parseUnary();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  function parseUnary(): ExprNode {
    const t = peek();
    if (t?.kind === 'op' && t.value === '-') {
      consume();
      return { type: 'unary', op: '-', arg: parseUnary() };
    }
    if (t?.kind === 'op' && t.value === '+') {
      consume();
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower(): ExprNode {
    const base = parsePrimary();
    const t = peek();
    if (t?.kind === 'op' && t.value === '^') {
      consume();
      const exp = parseUnary(); // Right associative, handles x^-2
      return { type: 'binary', op: '^', left: base, right: exp };
    }
    return base;
  }

  function parsePrimary(): ExprNode {
    const t = peek();
    if (!t) {
      throw new Error('Unexpected end of expression');
    }

    if (t.kind === 'number') {
      consume();
      return { type: 'number', value: t.value };
    }

    if (t.kind === 'ident') {
      consume();
      if (CONSTANTS.has(t.value)) {
        return { type: 'constant', name: t.value as 'pi' | 'e' };
      }
      if (FUNCTIONS.has(t.value)) {
        const next = peek();
        if (!next || next.kind !== 'lparen') {
          throw new Error(`Expected "(" after function "${t.value}"`);
        }
        consume(); // (
        const arg = parseAddSub();
        const close = peek();
        if (!close || close.kind !== 'rparen') {
          throw new Error(`Missing closing ")" for "${t.value}(...)"`);
        }
        consume(); // )
        return { type: 'func', name: normalizeFuncName(t.value), arg };
      }
      return { type: 'variable', name: t.value };
    }

    if (t.kind === 'lparen') {
      consume();
      const inner = parseAddSub();
      const close = peek();
      if (!close || close.kind !== 'rparen') {
        throw new Error('Missing closing parenthesis ")"');
      }
      consume();
      return inner;
    }

    throw new Error(`Unexpected token "${t.kind === 'op' ? t.value : t.kind}"`);
  }

  const ast = parseAddSub();
  if (pos < tokens.length) {
    throw new Error('Unexpected trailing input in expression');
  }
  return simplify(ast);
}

export function validateExpression(input: string): {
  valid: boolean;
  error?: string;
  variables: string[];
} {
  try {
    const ast = parseExpression(input);
    return { valid: true, variables: extractVariables(ast) };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid mathematical expression',
      variables: [],
    };
  }
}

export function dependsOn(node: ExprNode, variable: string): boolean {
  switch (node.type) {
    case 'number':
    case 'constant':
      return false;
    case 'variable':
      return node.name === variable;
    case 'unary':
      return dependsOn(node.arg, variable);
    case 'binary':
      return dependsOn(node.left, variable) || dependsOn(node.right, variable);
    case 'func':
      return dependsOn(node.arg, variable);
  }
}

export function extractVariables(node: ExprNode, out = new Set<string>()): string[] {
  switch (node.type) {
    case 'variable':
      out.add(node.name);
      break;
    case 'unary':
      extractVariables(node.arg, out);
      break;
    case 'binary':
      extractVariables(node.left, out);
      extractVariables(node.right, out);
      break;
    case 'func':
      extractVariables(node.arg, out);
      break;
    default:
      break;
  }
  return Array.from(out).sort();
}

export function astEquals(a: ExprNode, b: ExprNode): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'number':
      return Math.abs(a.value - (b as { type: 'number'; value: number }).value) < 1e-12;
    case 'constant':
      return a.name === (b as { type: 'constant'; name: string }).name;
    case 'variable':
      return a.name === (b as { type: 'variable'; name: string }).name;
    case 'unary':
      return astEquals(a.arg, (b as { type: 'unary'; arg: ExprNode }).arg);
    case 'func':
      return (
        a.name === (b as { type: 'func'; name: FuncName; arg: ExprNode }).name &&
        astEquals(a.arg, (b as { type: 'func'; name: FuncName; arg: ExprNode }).arg)
      );
    case 'binary': {
      const bb = b as { type: 'binary'; op: string; left: ExprNode; right: ExprNode };
      return a.op === bb.op && astEquals(a.left, bb.left) && astEquals(a.right, bb.right);
    }
  }
}

function isZero(n: ExprNode): boolean {
  return n.type === 'number' && Math.abs(n.value) < 1e-12;
}

function isOne(n: ExprNode): boolean {
  return n.type === 'number' && Math.abs(n.value - 1) < 1e-12;
}

function isMinusOne(n: ExprNode): boolean {
  return n.type === 'number' && Math.abs(n.value + 1) < 1e-12;
}

function num(v: number): ExprNode {
  const clean = Math.abs(v) < 1e-12 ? 0 : Number(v.toFixed(10));
  return { type: 'number', value: clean };
}

function flattenProduct(node: ExprNode): ExprNode[] {
  if (node.type === 'binary' && node.op === '*') {
    return [...flattenProduct(node.left), ...flattenProduct(node.right)];
  }
  if (node.type === 'unary' && node.op === '-') {
    return [num(-1), ...flattenProduct(node.arg)];
  }
  return [node];
}

function flattenSum(node: ExprNode): { sign: 1 | -1; node: ExprNode }[] {
  if (node.type === 'binary' && node.op === '+') {
    return [...flattenSum(node.left), ...flattenSum(node.right)];
  }
  if (node.type === 'binary' && node.op === '-') {
    const rightTerms = flattenSum(node.right).map((t) => ({
      sign: (t.sign * -1) as 1 | -1,
      node: t.node,
    }));
    return [...flattenSum(node.left), ...rightTerms];
  }
  if (node.type === 'unary' && node.op === '-') {
    return flattenSum(node.arg).map((t) => ({
      sign: (t.sign * -1) as 1 | -1,
      node: t.node,
    }));
  }
  return [{ sign: 1, node }];
}

function splitCoeffAndBase(term: ExprNode): { coeff: number; base: ExprNode | null } {
  const factors = flattenProduct(term);
  let coeff = 1;
  const nonNum: ExprNode[] = [];
  for (const f of factors) {
    if (f.type === 'number') {
      coeff *= f.value;
    } else {
      nonNum.push(f);
    }
  }
  if (nonNum.length === 0) {
    return { coeff, base: null };
  }
  let base = nonNum[0];
  for (let i = 1; i < nonNum.length; i++) {
    base = { type: 'binary', op: '*', left: base, right: nonNum[i] };
  }
  return { coeff, base };
}

function stripBaseAndExp(factor: ExprNode): { base: ExprNode; exp: ExprNode } {
  if (factor.type === 'binary' && factor.op === '^') {
    return { base: factor.left, exp: factor.right };
  }
  return { base: factor, exp: num(1) };
}

export function simplify(node: ExprNode): ExprNode {
  switch (node.type) {
    case 'number':
      return num(node.value);
    case 'constant':
    case 'variable':
      return node;
    case 'unary': {
      const arg = simplify(node.arg);
      if (arg.type === 'number') return num(-arg.value);
      if (arg.type === 'unary') return arg.arg;
      if (arg.type === 'binary' && arg.op === '*') {
        return simplify({ type: 'binary', op: '*', left: num(-1), right: arg });
      }
      return { type: 'unary', op: '-', arg };
    }
    case 'func': {
      const arg = simplify(node.arg);
      if (node.name === 'exp' && isZero(arg)) return num(1);
      if (node.name === 'ln' && arg.type === 'constant' && arg.name === 'e') return num(1);
      if (node.name === 'ln' && isOne(arg)) return num(0);
      if (node.name === 'sqrt' && arg.type === 'number' && arg.value >= 0) {
        const s = Math.sqrt(arg.value);
        if (Number.isInteger(s)) return num(s);
      }
      return { type: 'func', name: node.name, arg };
    }
    case 'binary': {
      const left = simplify(node.left);
      const right = simplify(node.right);

      if (node.op === '^') {
        if (isZero(right)) return num(1);
        if (isOne(right)) return left;
        if (isZero(left)) return num(0);
        if (isOne(left)) return num(1);
        if (left.type === 'number' && right.type === 'number') {
          const powVal = Math.pow(left.value, right.value);
          if (Number.isFinite(powVal) && Math.abs(powVal) < 1e9) {
            return num(powVal);
          }
        }
        if (left.type === 'binary' && left.op === '^') {
          return simplify({
            type: 'binary',
            op: '^',
            left: left.left,
            right: { type: 'binary', op: '*', left: left.right, right },
          });
        }
        return { type: 'binary', op: '^', left, right };
      }

      if (node.op === '/') {
        if (isZero(left)) return num(0);
        if (isOne(right)) return left;
        if (isMinusOne(right)) return simplify({ type: 'unary', op: '-', arg: left });
        if (left.type === 'number' && right.type === 'number' && right.value !== 0) {
          if (Number.isInteger(left.value) && Number.isInteger(right.value)) {
            const g = gcd(Math.abs(left.value), Math.abs(right.value));
            const nl = left.value / g;
            const nr = right.value / g;
            if (nr === 1) return num(nl);
            if (nr === -1) return num(-nl);
            if (nr < 0) return { type: 'binary', op: '/', left: num(-nl), right: num(-nr) };
            return { type: 'binary', op: '/', left: num(nl), right: num(nr) };
          }
          return num(left.value / right.value);
        }
        if (astEquals(left, right)) return num(1);
        // Fold (A / B) / C -> A / (B * C)
        if (left.type === 'binary' && left.op === '/') {
          return simplify({
            type: 'binary',
            op: '/',
            left: left.left,
            right: simplify({ type: 'binary', op: '*', left: left.right, right }),
          });
        }
        // Cancel common factors & numeric coefficients between left and right
        const numFactors = flattenProduct(left);
        const denFactors = flattenProduct(right);
        let nCoeff = 1;
        let dCoeff = 1;
        const nList: ExprNode[] = [];
        const dList: ExprNode[] = [];
        for (const f of numFactors) {
          if (f.type === 'number') nCoeff *= f.value;
          else nList.push(f);
        }
        for (const f of denFactors) {
          if (f.type === 'number') dCoeff *= f.value;
          else dList.push(f);
        }
        if (dCoeff !== 0 && (nList.length > 0 || dList.length > 0)) {
          if (Number.isInteger(nCoeff) && Number.isInteger(dCoeff)) {
            const g = gcd(Math.abs(nCoeff), Math.abs(dCoeff));
            nCoeff /= g;
            dCoeff /= g;
          } else {
            nCoeff /= dCoeff;
            dCoeff = 1;
          }
          if (dCoeff < 0) {
            nCoeff = -nCoeff;
            dCoeff = -dCoeff;
          }
          // Cancel identical symbolic factors
          for (let i = nList.length - 1; i >= 0; i--) {
            const matchIdx = dList.findIndex((d) => astEquals(d, nList[i]));
            if (matchIdx !== -1) {
              nList.splice(i, 1);
              dList.splice(matchIdx, 1);
            }
          }
          const buildProd = (c: number, arr: ExprNode[]): ExprNode => {
            if (arr.length === 0) return num(c);
            let p = arr[0];
            for (let k = 1; k < arr.length; k++) {
              p = { type: 'binary', op: '*', left: p, right: arr[k] };
            }
            if (Math.abs(c - 1) < 1e-12) return p;
            if (Math.abs(c + 1) < 1e-12) return { type: 'unary', op: '-', arg: p };
            return { type: 'binary', op: '*', left: num(c), right: p };
          };
          const cleanN = buildProd(nCoeff, nList);
          const cleanD = buildProd(dCoeff, dList);
          if (isOne(cleanD)) return cleanN;
          if (cleanN.type === 'unary' && cleanN.op === '-') {
            return {
              type: 'unary',
              op: '-',
              arg: { type: 'binary', op: '/', left: cleanN.arg, right: cleanD },
            };
          }
          return { type: 'binary', op: '/', left: cleanN, right: cleanD };
        }
        return { type: 'binary', op: '/', left, right };
      }

      if (node.op === '*') {
        // Combine flat factors, separating rational denominators cleanly
        const rawFactors = [...flattenProduct(left), ...flattenProduct(right)];
        const denPieces: ExprNode[] = [];
        const numPieces: ExprNode[] = [];
        for (const f of rawFactors) {
          if (f.type === 'binary' && f.op === '/') {
            numPieces.push(...flattenProduct(f.left));
            denPieces.push(...flattenProduct(f.right));
          } else {
            numPieces.push(f);
          }
        }

        let coeff = 1;
        const grouped: { base: ExprNode; exp: ExprNode }[] = [];

        for (const f of numPieces) {
          if (f.type === 'number') {
            coeff *= f.value;
            continue;
          }
          const { base, exp } = stripBaseAndExp(f);
          const existing = grouped.find((g) => astEquals(g.base, base));
          if (existing) {
            existing.exp = simplify({ type: 'binary', op: '+', left: existing.exp, right: exp });
          } else {
            grouped.push({ base, exp });
          }
        }

        if (Math.abs(coeff) < 1e-12) return num(0);

        // Sort factors canonically: constants, variables alphabetically, functions, complex expressions
        grouped.sort((a, b) => factorRank(a.base) - factorRank(b.base) || toPlain(a.base).localeCompare(toPlain(b.base)));

        const rebuilt: ExprNode[] = [];
        for (const g of grouped) {
          if (isZero(g.exp)) continue;
          if (isOne(g.exp)) rebuilt.push(g.base);
          else rebuilt.push({ type: 'binary', op: '^', left: g.base, right: g.exp });
        }

        let numResult: ExprNode;
        if (rebuilt.length === 0) {
          numResult = num(coeff);
        } else {
          let prod = rebuilt[0];
          for (let i = 1; i < rebuilt.length; i++) {
            prod = { type: 'binary', op: '*', left: prod, right: rebuilt[i] };
          }
          if (Math.abs(coeff - 1) < 1e-12) numResult = prod;
          else if (Math.abs(coeff + 1) < 1e-12) numResult = { type: 'unary', op: '-', arg: prod };
          else numResult = { type: 'binary', op: '*', left: num(coeff), right: prod };
        }

        if (denPieces.length > 0) {
          let denAcc = denPieces[0];
          for (let i = 1; i < denPieces.length; i++) {
            denAcc = { type: 'binary', op: '*', left: denAcc, right: denPieces[i] };
          }
          return simplify({ type: 'binary', op: '/', left: numResult, right: simplify(denAcc) });
        }

        return numResult;
      }

      if (node.op === '+' || node.op === '-') {
        const signedRight =
          node.op === '-'
            ? flattenSum(right).map((t) => ({ sign: (t.sign * -1) as 1 | -1, node: t.node }))
            : flattenSum(right);
        const terms = [...flattenSum(left), ...signedRight];

        let constSum = 0;
        const buckets: { base: ExprNode; coeff: number }[] = [];

        for (const t of terms) {
          const { coeff, base } = splitCoeffAndBase(t.node);
          const signedCoeff = coeff * t.sign;
          if (Math.abs(signedCoeff) < 1e-12) continue;
          if (!base) {
            constSum += signedCoeff;
          } else {
            const found = buckets.find((b) => astEquals(b.base, base));
            if (found) {
              found.coeff += signedCoeff;
            } else {
              buckets.push({ base, coeff: signedCoeff });
            }
          }
        }

        const finalTerms: { sign: 1 | -1; node: ExprNode }[] = [];
        for (const b of buckets) {
          if (Math.abs(b.coeff) < 1e-12) continue;
          const sign: 1 | -1 = b.coeff < 0 ? -1 : 1;
          const absC = Math.abs(b.coeff);
          const termNode =
            Math.abs(absC - 1) < 1e-12
              ? b.base
              : ({ type: 'binary', op: '*', left: num(absC), right: b.base } as ExprNode);
          finalTerms.push({ sign, node: termNode });
        }

        if (Math.abs(constSum) >= 1e-12) {
          finalTerms.push({ sign: constSum < 0 ? -1 : 1, node: num(Math.abs(constSum)) });
        }

        if (finalTerms.length === 0) return num(0);

        let acc: ExprNode =
          finalTerms[0].sign === -1
            ? simplify({ type: 'unary', op: '-', arg: finalTerms[0].node })
            : finalTerms[0].node;

        for (let i = 1; i < finalTerms.length; i++) {
          const ft = finalTerms[i];
          acc = {
            type: 'binary',
            op: ft.sign === 1 ? '+' : '-',
            left: acc,
            right: ft.node,
          };
        }
        return acc;
      }

      return { type: 'binary', op: node.op, left, right };
    }
  }
}

function factorRank(n: ExprNode): number {
  if (n.type === 'number') return 0;
  if (n.type === 'constant') return 1;
  if (n.type === 'variable') return 2;
  if (n.type === 'func') return 3;
  return 4;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function evaluateAST(
  node: ExprNode,
  scope: Record<string, number>,
  angleUnit: AngleUnit = 'rad'
): number {
  const toRad = (v: number) => (angleUnit === 'deg' ? (v * Math.PI) / 180 : v);
  const fromRad = (v: number) => (angleUnit === 'deg' ? (v * 180) / Math.PI : v);

  switch (node.type) {
    case 'number':
      return node.value;
    case 'constant':
      return node.name === 'pi' ? Math.PI : Math.E;
    case 'variable': {
      if (!(node.name in scope)) {
        throw new Error(`Missing value for variable "${node.name}"`);
      }
      return scope[node.name];
    }
    case 'unary':
      return -evaluateAST(node.arg, scope, angleUnit);
    case 'binary': {
      const l = evaluateAST(node.left, scope, angleUnit);
      const r = evaluateAST(node.right, scope, angleUnit);
      switch (node.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return l / r;
        case '^':
          return Math.pow(l, r);
      }
      break;
    }
    case 'func': {
      const a = evaluateAST(node.arg, scope, angleUnit);
      switch (node.name) {
        case 'sin':
          return Math.sin(toRad(a));
        case 'cos':
          return Math.cos(toRad(a));
        case 'tan':
          return Math.tan(toRad(a));
        case 'csc':
          return 1 / Math.sin(toRad(a));
        case 'sec':
          return 1 / Math.cos(toRad(a));
        case 'cot':
          return 1 / Math.tan(toRad(a));
        case 'asin':
          return fromRad(Math.asin(a));
        case 'acos':
          return fromRad(Math.acos(a));
        case 'atan':
          return fromRad(Math.atan(a));
        case 'sinh':
          return Math.sinh(a);
        case 'cosh':
          return Math.cosh(a);
        case 'tanh':
          return Math.tanh(a);
        case 'ln':
          return Math.log(a);
        case 'log':
          return Math.log10(a);
        case 'exp':
          return Math.exp(a);
        case 'sqrt':
          return Math.sqrt(a);
        case 'abs':
          return Math.abs(a);
      }
    }
  }
}

export function toPlain(node: ExprNode, parentPrec = 0): string {
  switch (node.type) {
    case 'number':
      return Number.isInteger(node.value) ? `${node.value}` : `${Number(node.value.toFixed(6))}`;
    case 'constant':
      return node.name;
    case 'variable':
      return node.name;
    case 'unary': {
      const inner = toPlain(node.arg, 3);
      const s = `-${inner}`;
      return parentPrec > 3 ? `(${s})` : s;
    }
    case 'func':
      return `${node.name}(${toPlain(node.arg, 0)})`;
    case 'binary': {
      const prec =
        node.op === '+' || node.op === '-'
          ? 1
          : node.op === '*' || node.op === '/'
          ? 2
          : 4;
      const l = toPlain(node.left, prec);
      const r = toPlain(node.right, node.op === '-' || node.op === '/' ? prec + 1 : prec);
      const opStr = node.op === '+' || node.op === '-' ? ` ${node.op} ` : node.op;
      const s = `${l}${opStr}${r}`;
      return prec < parentPrec ? `(${s})` : s;
    }
  }
}

export function toLatex(node: ExprNode, parentPrec = 0): string {
  switch (node.type) {
    case 'number':
      return Number.isInteger(node.value) ? `${node.value}` : `${Number(node.value.toFixed(4))}`;
    case 'constant':
      return node.name === 'pi' ? '\\pi' : 'e';
    case 'variable':
      return node.name;
    case 'unary': {
      const inner = toLatex(node.arg, 3);
      const s = `-${inner}`;
      return parentPrec > 3 ? `\\left(${s}\\right)` : s;
    }
    case 'func': {
      const argTex = toLatex(node.arg, 0);
      if (node.name === 'sqrt') return `\\sqrt{${argTex}}`;
      if (node.name === 'abs') return `\\left|${argTex}\\right|`;
      if (node.name === 'exp') return `e^{${argTex}}`;
      return `\\${node.name}\\left(${argTex}\\right)`;
    }
    case 'binary': {
      if (node.op === '/') {
        return `\\frac{${toLatex(node.left, 0)}}{${toLatex(node.right, 0)}}`;
      }
      if (node.op === '^') {
        const baseNeedsParens =
          node.left.type === 'binary' || node.left.type === 'unary' || node.left.type === 'func';
        const baseTex = baseNeedsParens
          ? `\\left(${toLatex(node.left, 0)}\\right)`
          : toLatex(node.left, 4);
        return `${baseTex}^{${toLatex(node.right, 0)}}`;
      }
      if (node.op === '*') {
        const l = toLatex(node.left, 2);
        const r = toLatex(node.right, 2);
        const leftIsNum =
          node.left.type === 'number' ||
          (node.left.type === 'unary' && node.left.arg.type === 'number');
        const rightStartsSimpleVar =
          node.right.type === 'variable' ||
          (node.right.type === 'binary' && node.right.op === '^' && node.right.left.type === 'variable');

        // Render 4*x as 4x, and x*y^3 as x \cdot y^3 for crisp textbook legibility
        const sep = leftIsNum && rightStartsSimpleVar ? '' : ' \\cdot ';
        const s = `${l}${sep}${r}`;
        return 2 < parentPrec ? `\\left(${s}\\right)` : s;
      }
      const prec = 1;
      const l = toLatex(node.left, prec);
      const r = toLatex(node.right, node.op === '-' ? prec + 1 : prec);
      const s = `${l} ${node.op} ${r}`;
      return prec < parentPrec ? `\\left(${s}\\right)` : s;
    }
  }
}

export function differentiate(
  node: ExprNode,
  variable: string,
  steps: DerivationStep[] = [],
  depth = 0
): ExprNode {
  const pushStep = (rule: string, description: string, exprBefore: ExprNode, exprAfter: ExprNode) => {
    if (depth > 3) return;
    steps.push({
      id: `step-${steps.length + 1}`,
      rule,
      description,
      latex: `\\frac{\\partial}{\\partial ${variable}}\\left(${toLatex(exprBefore)}\\right) = ${toLatex(exprAfter)}`,
    });
  };

  if (!dependsOn(node, variable)) {
    return num(0);
  }

  switch (node.type) {
    case 'number':
    case 'constant':
      return num(0);

    case 'variable': {
      const res = node.name === variable ? num(1) : num(0);
      if (depth === 0) {
        pushStep('Variable Rule', `Differentiate ${variable} with respect to ${variable}.`, node, res);
      }
      return res;
    }

    case 'unary': {
      const dArg = differentiate(node.arg, variable, steps, depth + 1);
      return simplify({ type: 'unary', op: '-', arg: dArg });
    }

    case 'binary': {
      if (node.op === '+' || node.op === '-') {
        const dl = differentiate(node.left, variable, steps, depth + 1);
        const dr = differentiate(node.right, variable, steps, depth + 1);
        const res = simplify({ type: 'binary', op: node.op, left: dl, right: dr });
        if (depth === 0) {
          pushStep(
            node.op === '+' ? 'Sum Rule' : 'Difference Rule',
            `Differentiate each term separately with respect to ${variable}.`,
            node,
            res
          );
        }
        return res;
      }

      if (node.op === '*') {
        const lDep = dependsOn(node.left, variable);
        const rDep = dependsOn(node.right, variable);
        if (!lDep) {
          const dr = differentiate(node.right, variable, steps, depth + 1);
          const res = simplify({ type: 'binary', op: '*', left: node.left, right: dr });
          if (depth <= 1) {
            pushStep(
              'Constant Multiple Rule',
              `Treat ${toPlain(node.left)} as a constant factor with respect to ${variable}.`,
              node,
              res
            );
          }
          return res;
        }
        if (!rDep) {
          const dl = differentiate(node.left, variable, steps, depth + 1);
          const res = simplify({ type: 'binary', op: '*', left: dl, right: node.right });
          if (depth <= 1) {
            pushStep(
              'Constant Multiple Rule',
              `Treat ${toPlain(node.right)} as a constant factor with respect to ${variable}.`,
              node,
              res
            );
          }
          return res;
        }
        const dl = differentiate(node.left, variable, steps, depth + 1);
        const dr = differentiate(node.right, variable, steps, depth + 1);
        const res = simplify({
          type: 'binary',
          op: '+',
          left: { type: 'binary', op: '*', left: dl, right: node.right },
          right: { type: 'binary', op: '*', left: node.left, right: dr },
        });
        pushStep(
          'Product Rule',
          `Apply (u·v)' = u'·v + u·v' with u = ${toPlain(node.left)} and v = ${toPlain(node.right)}.`,
          node,
          res
        );
        return res;
      }

      if (node.op === '/') {
        const lDep = dependsOn(node.left, variable);
        const rDep = dependsOn(node.right, variable);
        if (!rDep) {
          const dl = differentiate(node.left, variable, steps, depth + 1);
          const res = simplify({ type: 'binary', op: '/', left: dl, right: node.right });
          pushStep(
            'Constant Denominator Rule',
            `Treat denominator ${toPlain(node.right)} as constant.`,
            node,
            res
          );
          return res;
        }
        if (!lDep) {
          // c / v = c * v^-1 -> -c * v' / v^2
          const dr = differentiate(node.right, variable, steps, depth + 1);
          const res = simplify({
            type: 'binary',
            op: '/',
            left: {
              type: 'unary',
              op: '-',
              arg: { type: 'binary', op: '*', left: node.left, right: dr },
            },
            right: { type: 'binary', op: '^', left: node.right, right: num(2) },
          });
          pushStep(
            'Reciprocal / Quotient Rule',
            `Apply (c/v)' = -c·v' / v² with v = ${toPlain(node.right)}.`,
            node,
            res
          );
          return res;
        }
        const dl = differentiate(node.left, variable, steps, depth + 1);
        const dr = differentiate(node.right, variable, steps, depth + 1);
        const res = simplify({
          type: 'binary',
          op: '/',
          left: {
            type: 'binary',
            op: '-',
            left: { type: 'binary', op: '*', left: dl, right: node.right },
            right: { type: 'binary', op: '*', left: node.left, right: dr },
          },
          right: { type: 'binary', op: '^', left: node.right, right: num(2) },
        });
        pushStep(
          'Quotient Rule',
          `Apply (u/v)' = (u'v - uv') / v² with u = ${toPlain(node.left)} and v = ${toPlain(node.right)}.`,
          node,
          res
        );
        return res;
      }

      if (node.op === '^') {
        const baseDep = dependsOn(node.left, variable);
        const expDep = dependsOn(node.right, variable);

        if (baseDep && !expDep) {
          const du = differentiate(node.left, variable, steps, depth + 1);
          const res = simplify({
            type: 'binary',
            op: '*',
            left: {
              type: 'binary',
              op: '*',
              left: node.right,
              right: {
                type: 'binary',
                op: '^',
                left: node.left,
                right: simplify({ type: 'binary', op: '-', left: node.right, right: num(1) }),
              },
            },
            right: du,
          });
          pushStep(
            'Power Rule',
            `Bring down exponent ${toPlain(node.right)} and reduce power by 1${
              node.left.type !== 'variable' ? ' (with Chain Rule)' : ''
            }.`,
            node,
            res
          );
          return res;
        }

        if (!baseDep && expDep) {
          const dv = differentiate(node.right, variable, steps, depth + 1);
          const isEulerE = node.left.type === 'constant' && node.left.name === 'e';
          const baseFactor: ExprNode = isEulerE
            ? node
            : {
                type: 'binary',
                op: '*',
                left: node,
                right: { type: 'func', name: 'ln', arg: node.left },
              };
          const res = simplify({ type: 'binary', op: '*', left: baseFactor, right: dv });
          pushStep(
            'Exponential Rule',
            isEulerE
              ? `Apply d/d${variable}(e^v) = e^v · v'.`
              : `Apply d/d${variable}(a^v) = a^v · ln(a) · v'.`,
            node,
            res
          );
          return res;
        }

        // Generalized power u(x)^v(x) = u^v * (v' * ln(u) + v * u' / u)
        const du = differentiate(node.left, variable, steps, depth + 1);
        const dv = differentiate(node.right, variable, steps, depth + 1);
        const res = simplify({
          type: 'binary',
          op: '*',
          left: node,
          right: {
            type: 'binary',
            op: '+',
            left: {
              type: 'binary',
              op: '*',
              left: dv,
              right: { type: 'func', name: 'ln', arg: node.left },
            },
            right: {
              type: 'binary',
              op: '/',
              left: { type: 'binary', op: '*', left: node.right, right: du },
              right: node.left,
            },
          },
        });
        pushStep(
          'Logarithmic Differentiation',
          `Differentiate generalized power (${toPlain(node.left)})^(${toPlain(node.right)}).`,
          node,
          res
        );
        return res;
      }
      break;
    }

    case 'func': {
      const u = node.arg;
      const du = differentiate(u, variable, steps, depth + 1);
      let outer: ExprNode;
      let ruleDesc = '';

      switch (node.name) {
        case 'sin':
          outer = { type: 'func', name: 'cos', arg: u };
          ruleDesc = 'd/du [sin(u)] = cos(u)';
          break;
        case 'cos':
          outer = { type: 'unary', op: '-', arg: { type: 'func', name: 'sin', arg: u } };
          ruleDesc = 'd/du [cos(u)] = -sin(u)';
          break;
        case 'tan':
          outer = {
            type: 'binary',
            op: '^',
            left: { type: 'func', name: 'sec', arg: u },
            right: num(2),
          };
          ruleDesc = 'd/du [tan(u)] = sec²(u)';
          break;
        case 'csc':
          outer = {
            type: 'unary',
            op: '-',
            arg: {
              type: 'binary',
              op: '*',
              left: { type: 'func', name: 'csc', arg: u },
              right: { type: 'func', name: 'cot', arg: u },
            },
          };
          ruleDesc = 'd/du [csc(u)] = -csc(u)cot(u)';
          break;
        case 'sec':
          outer = {
            type: 'binary',
            op: '*',
            left: { type: 'func', name: 'sec', arg: u },
            right: { type: 'func', name: 'tan', arg: u },
          };
          ruleDesc = 'd/du [sec(u)] = sec(u)tan(u)';
          break;
        case 'cot':
          outer = {
            type: 'unary',
            op: '-',
            arg: {
              type: 'binary',
              op: '^',
              left: { type: 'func', name: 'csc', arg: u },
              right: num(2),
            },
          };
          ruleDesc = 'd/du [cot(u)] = -csc²(u)';
          break;
        case 'asin':
          outer = {
            type: 'binary',
            op: '/',
            left: num(1),
            right: {
              type: 'func',
              name: 'sqrt',
              arg: {
                type: 'binary',
                op: '-',
                left: num(1),
                right: { type: 'binary', op: '^', left: u, right: num(2) },
              },
            },
          };
          ruleDesc = 'd/du [arcsin(u)] = 1 / √(1 - u²)';
          break;
        case 'acos':
          outer = {
            type: 'binary',
            op: '/',
            left: num(-1),
            right: {
              type: 'func',
              name: 'sqrt',
              arg: {
                type: 'binary',
                op: '-',
                left: num(1),
                right: { type: 'binary', op: '^', left: u, right: num(2) },
              },
            },
          };
          ruleDesc = 'd/du [arccos(u)] = -1 / √(1 - u²)';
          break;
        case 'atan':
          outer = {
            type: 'binary',
            op: '/',
            left: num(1),
            right: {
              type: 'binary',
              op: '+',
              left: num(1),
              right: { type: 'binary', op: '^', left: u, right: num(2) },
            },
          };
          ruleDesc = 'd/du [arctan(u)] = 1 / (1 + u²)';
          break;
        case 'sinh':
          outer = { type: 'func', name: 'cosh', arg: u };
          ruleDesc = 'd/du [sinh(u)] = cosh(u)';
          break;
        case 'cosh':
          outer = { type: 'func', name: 'sinh', arg: u };
          ruleDesc = 'd/du [cosh(u)] = sinh(u)';
          break;
        case 'tanh':
          outer = {
            type: 'binary',
            op: '/',
            left: num(1),
            right: {
              type: 'binary',
              op: '^',
              left: { type: 'func', name: 'cosh', arg: u },
              right: num(2),
            },
          };
          ruleDesc = 'd/du [tanh(u)] = sech²(u)';
          break;
        case 'ln':
          outer = { type: 'binary', op: '/', left: num(1), right: u };
          ruleDesc = 'd/du [ln(u)] = 1 / u';
          break;
        case 'log':
          outer = {
            type: 'binary',
            op: '/',
            left: num(1),
            right: {
              type: 'binary',
              op: '*',
              left: u,
              right: { type: 'func', name: 'ln', arg: num(10) },
            },
          };
          ruleDesc = 'd/du [log₁₀(u)] = 1 / (u·ln(10))';
          break;
        case 'exp':
          outer = { type: 'func', name: 'exp', arg: u };
          ruleDesc = 'd/du [exp(u)] = exp(u)';
          break;
        case 'sqrt':
          outer = {
            type: 'binary',
            op: '/',
            left: num(1),
            right: {
              type: 'binary',
              op: '*',
              left: num(2),
              right: { type: 'func', name: 'sqrt', arg: u },
            },
          };
          ruleDesc = 'd/du [√u] = 1 / (2√u)';
          break;
        case 'abs':
          outer = {
            type: 'binary',
            op: '/',
            left: u,
            right: { type: 'func', name: 'abs', arg: u },
          };
          ruleDesc = 'd/du [|u|] = u / |u|';
          break;
      }

      const res = simplify({ type: 'binary', op: '*', left: outer, right: du });
      pushStep(
        u.type === 'variable' ? 'Standard Function Rule' : 'Chain Rule',
        `${ruleDesc}${u.type !== 'variable' ? ` multiplied by u' = ${toPlain(du)}` : ''}.`,
        node,
        res
      );
      return res;
    }
  }

  return num(0);
}
