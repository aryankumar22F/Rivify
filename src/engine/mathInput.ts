export type MathCommandKind =
  | 'expression'
  | 'equation'
  | 'linear-system'
  | 'differential-assignment'
  | 'function-assignment'
  | 'derivative'
  | 'integral'
  | 'limit';

export interface AnalyzedMathInput {
  kind: MathCommandKind;
  expr: string;
  variable?: string;
  isPartial?: boolean;
  lhsLabel?: string;
  lower?: number;
  upper?: number;
  limitTarget?: number;
}

const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
  '⁽': '(',
  '⁾': ')',
  'ˣ': 'x',
  'ʸ': 'y',
  'ᶻ': 'z',
  'ⁿ': 'n',
  'ᵗ': 't',
};

const KNOWN_FUNCS = [
  'arcsin',
  'arccos',
  'arctan',
  'asinh',
  'acosh',
  'atanh',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'cbrt',
  'root',
  'fact',
  'floor',
  'ceil',
  'round',
  'log2',
  'sin',
  'cos',
  'tan',
  'csc',
  'sec',
  'cot',
  'asin',
  'acos',
  'atan',
  'exp',
  'abs',
  'log',
  'ln',
  'ncr',
  'npr',
] as const;

function skipSpaces(s: string, idx: number): number {
  let i = idx;
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}

/**
 * Reads either `{balanced content}` or `[balanced content]` or a single char token (e.g. `\frac12`).
 */
function readLatexGroup(
  s: string,
  startIdx: number,
  openCh: '{' | '[' = '{',
  closeCh: '}' | ']' = '}'
): { content: string; endIdx: number } | null {
  const i = skipSpaces(s, startIdx);
  if (i >= s.length) return null;

  if (s[i] === openCh) {
    let depth = 0;
    let cursor = i;
    while (cursor < s.length) {
      if (s[cursor] === openCh) depth++;
      else if (s[cursor] === closeCh) {
        depth--;
        if (depth === 0) {
          return {
            content: s.slice(i + 1, cursor),
            endIdx: cursor + 1,
          };
        }
      }
      cursor++;
    }
    // Unclosed group: return remaining text gracefully
    return { content: s.slice(i + 1), endIdx: s.length };
  }

  if (openCh === '{') {
    // Single-token fallback like \frac12 -> reads '1' then '2'
    if (/[a-zA-Z0-9]/.test(s[i])) {
      return { content: s[i], endIdx: i + 1 };
    }
  }
  return null;
}

function replaceLatexFractionsAndRoots(input: string): string {
  let out = input;
  // Repeat in case nested macros exist (capped to avoid infinite loop)
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    let result = '';
    let i = 0;

    while (i < out.length) {
      if (
        out.startsWith('\\dfrac', i) ||
        out.startsWith('\\tfrac', i) ||
        out.startsWith('\\cfrac', i) ||
        out.startsWith('\\frac', i)
      ) {
        const cmdLen = out.startsWith('\\frac', i) ? 5 : 6;
        const afterCmd = i + cmdLen;
        if (afterCmd >= out.length || !/[a-zA-Z]/.test(out[afterCmd])) {
          const numGroup = readLatexGroup(out, afterCmd, '{', '}');
          if (numGroup) {
            const denGroup = readLatexGroup(out, numGroup.endIdx, '{', '}');
            if (denGroup) {
              result += `((${numGroup.content})/(${denGroup.content}))`;
              i = denGroup.endIdx;
              changed = true;
              continue;
            }
          }
        }
      }

      if (out.startsWith('\\sqrt', i)) {
        const afterCmd = i + 5;
        if (afterCmd >= out.length || !/[a-zA-Z]/.test(out[afterCmd])) {
          const optIdx = skipSpaces(out, afterCmd);
          if (out[optIdx] === '[') {
            const nthGroup = readLatexGroup(out, optIdx, '[', ']');
            const bodyGroup = nthGroup ? readLatexGroup(out, nthGroup.endIdx, '{', '}') : null;
            if (nthGroup && bodyGroup) {
              result += `((${bodyGroup.content})^(1/(${nthGroup.content})))`;
              i = bodyGroup.endIdx;
              changed = true;
              continue;
            }
          }
          const bodyGroup = readLatexGroup(out, afterCmd, '{', '}');
          if (bodyGroup) {
            result += `sqrt(${bodyGroup.content})`;
            i = bodyGroup.endIdx;
            changed = true;
            continue;
          }
        }
      }

      result += out[i];
      i++;
    }

    out = result;
    if (!changed) break;
  }
  return out;
}

function replaceAbsoluteBars(input: string): string {
  // Replace \left| ... \right| first, then single-pair |...|
  let out = input.replace(/\\left\|([^|]+?)\\right\|/g, 'abs($1)');
  let prev = '';
  let guard = 0;
  while (out !== prev && guard++ < 8) {
    prev = out;
    out = out.replace(/\|([^|]+?)\|/g, 'abs($1)');
  }
  return out;
}

function replaceTextWrappers(input: string): string {
  let out = input;
  const wrappers = ['\\text', '\\mathrm', '\\mathbf', '\\mathit', '\\operatorname', '\\boldsymbol'];
  for (const w of wrappers) {
    let idx = out.indexOf(w);
    let guard = 0;
    while (idx !== -1 && guard++ < 16) {
      const nextCh = out[idx + w.length];
      if (!nextCh || !/[a-zA-Z]/.test(nextCh)) {
        const grp = readLatexGroup(out, idx + w.length, '{', '}');
        if (grp) {
          out = `${out.slice(0, idx)} ${grp.content} ${out.slice(grp.endIdx)}`;
          idx = out.indexOf(w);
          continue;
        }
      }
      idx = out.indexOf(w, idx + w.length);
    }
  }
  return out;
}

/**
 * Converts normal text phrases, Unicode symbols, and LaTeX syntax into
 * canonical expression syntax accepted by RIVIFY's algebraic & scientific parsers.
 */
export function preprocessMathSyntax(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  // Strip surrounding LaTeX math delimiters ($...$, $$...$$, \(...\), \[...\])
  s = s
    .replace(/^\$\$([\s\S]*)\$\$$/, '$1')
    .replace(/^\$([\s\S]*)\$$/, '$1')
    .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
    .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
    .replace(/\\displaystyle\b|\\textstyle\b|\\limits\b/g, ' ')
    .trim();

  // Replace \text{...}, \mathrm{...}, \operatorname{...}
  s = replaceTextWrappers(s);

  // Convert Unicode superscript runs (e.g. 3y² -> 3y^(2), e⁻ˣ -> e^(-x))
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾ˣʸᶻⁿᵗ]+/g, (seq) => {
    const mapped = Array.from(seq)
      .map((ch) => SUPERSCRIPT_MAP[ch] ?? ch)
      .join('');
    return `^(${mapped})`;
  });

  // Normalize common Unicode symbols & LaTeX spacing/operators
  s = s
    .replace(/\\,|\\;|\\:|\\!|\\quad|\\qquad|\\ /g, ' ')
    .replace(/\\cdot|\\times|\\ast/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\pm/g, '+')
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\theta\b|θ/g, 't')
    .replace(/\\infty\b|∞/g, 'Infinity')
    .replace(/\\to\b|\\rightarrow\b|→/g, '->')
    .replace(/[×·•∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt');

  // Natural-language / normal text math phrases
  s = s
    .replace(/\bsquare\s+root\s+of\b/gi, 'sqrt ')
    .replace(/\bcube\s+root\s+of\b/gi, 'cbrt ')
    .replace(/\babsolute\s+value\s+of\b/gi, 'abs ')
    .replace(/\bnatural\s+log(?:arithm)?\s+of\b/gi, 'ln ')
    .replace(/\blogarithm\s+of\b/gi, 'log ')
    .replace(/\bsine\s+of\b/gi, 'sin ')
    .replace(/\bcosine\s+of\b/gi, 'cos ')
    .replace(/\btangent\s+of\b/gi, 'tan ')
    .replace(/\braised\s+to\s+the\s+power\s+of\b/gi, '^')
    .replace(/\bto\s+the\s+power\s+of\b/gi, '^')
    .replace(/\braised\s+to\b/gi, '^')
    .replace(/\bmultiplied\s+by\b/gi, '*')
    .replace(/\bdivided\s+by\b/gi, '/')
    .replace(/\btimes\b/gi, '*')
    .replace(/\bover\b/gi, '/')
    .replace(/\bplus\b/gi, '+')
    .replace(/\bminus\b/gi, '-')
    .replace(/\bsquared\b/gi, '^2')
    .replace(/\bcubed\b/gi, '^3');

  // Replace \frac{A}{B} & \sqrt[n]{A} & \sqrt{A}
  s = replaceLatexFractionsAndRoots(s);

  // Replace \left|...\right| and |...|
  s = replaceAbsoluteBars(s);

  // Convert \left( \right) \left[ \right] \left\{ \right\} and square brackets
  s = s
    .replace(/\\left\s*([([{])/g, '$1')
    .replace(/\\right\s*([)\]}])/g, '$1')
    .replace(/\\\{/g, '(')
    .replace(/\\\}/g, ')')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')');

  // Strip leading backslash from known functions (\sin -> sin, \ln -> ln, \exp -> exp, ...)
  const funcUnion = KNOWN_FUNCS.join('|');
  s = s.replace(new RegExp(`\\\\(${funcUnion})\\b`, 'gi'), (_, fn: string) => fn.toLowerCase());

  // Handle LaTeX powers on functions: sin^{2}(x), sin^2(x), sin^2 x -> (sin(x))^(2)
  s = s.replace(
    new RegExp(
      `\\b(${funcUnion})\\s*\\^\\s*(?:\\{([^}]+)\\}|(\\([^)]+\\))|(-?\\d+(?:\\.\\d+)?))\\s*(?:\\(([^)]+)\\)|([a-zA-Z0-9_.]+))`,
      'gi'
    ),
    (_, fn: string, pBrace?: string, pParen?: string, pNum?: string, argParen?: string, argAtom?: string) => {
      const power = pBrace ?? (pParen ? pParen.slice(1, -1) : pNum ?? '2');
      const arg = argParen ?? argAtom ?? 'x';
      return `(${fn.toLowerCase()}(${arg}))^(${power})`;
    }
  );

  // Convert remaining ^{...} and _{...} / {...} braces into parentheses
  s = s.replace(/\^\{([^{}]+)\}/g, '^($1)');
  let prevBrace = '';
  let braceGuard = 0;
  while (s !== prevBrace && braceGuard++ < 8) {
    prevBrace = s;
    s = s.replace(/\{([^{}]*)\}/g, '($1)');
  }
  s = s.replace(/[{}]/g, (m) => (m === '{' ? '(' : ')'));

  // Handle space-separated function arguments like "sin x", "cos 2x", "ln x", "sqrt 16"
  s = s.replace(
    new RegExp(
      `\\b(${funcUnion})\\s+(?![(*/+,;^=\\-])([a-zA-Z0-9_.]+(?:\\^(?:\\([^)]+\\)|-?[a-zA-Z0-9_.]+))?)`,
      'gi'
    ),
    (_, fn: string, arg: string) => `${fn.toLowerCase()}(${arg})`
  );

  // Collapse double parens created by e.g. sqrt((x+1))? Wait - keep valid balanced parens, normalize whitespace
  return s.replace(/\s+/g, ' ').trim();
}

function splitTopLevelEquals(s: string): [string, string] | null {
  let depth = 0;
  let eqIdx = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth = Math.max(0, depth - 1);
    else if (ch === '=' && depth === 0) {
      if (eqIdx !== -1) return null; // multiple '=' signs
      eqIdx = i;
    }
  }
  if (eqIdx === -1) return null;
  return [s.slice(0, eqIdx).trim(), s.slice(eqIdx + 1).trim()];
}

function isDifferentialLhs(lhsRaw: string): { isPartial: boolean; variable: string; lhsLabel: string } | null {
  const compact = lhsRaw
    .replace(/^\$+|\$+$|^\\\(|\\\)$|^\\\[|\\\]$/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\s+/g, '');

  // LaTeX partial: \frac{\partial f}{\partial x}, \dfrac{\partial y}{\partial t}, \frac{\partial^2 f}{\partial x^2}
  const latexPartial = compact.match(
    /^\\?[dt]?frac\{\\partial(?:\^[0-9]+)?[a-zA-Z]?\}\{\\partial([a-zA-Z])(?:\^[0-9]+)?\}$/i
  );
  if (latexPartial) {
    return {
      isPartial: true,
      variable: latexPartial[1].toLowerCase(),
      lhsLabel: lhsRaw.trim(),
    };
  }

  // LaTeX slash partial: \partial f / \partial x, \partial / \partial x
  const latexSlashPartial = compact.match(/^\\partial[a-zA-Z]?\/\\partial([a-zA-Z])$/i);
  if (latexSlashPartial) {
    return {
      isPartial: true,
      variable: latexSlashPartial[1].toLowerCase(),
      lhsLabel: lhsRaw.trim(),
    };
  }

  // LaTeX operator subscript partial: \partial_x f, \partial_{x} f
  const latexOpSubPartial = compact.match(/^\\partial_\{?([a-zA-Z])\}?(?:\(?[a-zA-Z,]+\)?)?$/i);
  if (latexOpSubPartial) {
    return {
      isPartial: true,
      variable: latexOpSubPartial[1].toLowerCase(),
      lhsLabel: lhsRaw.trim(),
    };
  }

  // LaTeX ordinary: \frac{df}{dx}, \frac{dy}{dx}, \frac{d^2y}{dx^2}
  const latexOrd = compact.match(
    /^\\?[dt]?frac\{d(?:\^[0-9]+)?[a-zA-Z]?\}\{d([a-zA-Z])(?:\^[0-9]+)?\}$/i
  );
  if (latexOrd) {
    return {
      isPartial: false,
      variable: latexOrd[1].toLowerCase(),
      lhsLabel: lhsRaw.trim(),
    };
  }

  // Unicode / plain partial: ∂f/∂x, ∂y/∂t, ∂/∂x, ∂²f/∂x²
  const unicodePartial = compact.match(/^∂[²³0-9]?[a-zA-Z]?\/∂([a-zA-Z])[²³0-9]?$/i);
  if (unicodePartial) {
    return {
      isPartial: true,
      variable: unicodePartial[1].toLowerCase(),
      lhsLabel: lhsRaw.trim(),
    };
  }

  // Plain ordinary: df/dx, dy/dx, d/dx, d^2y/dx^2
  const plainOrd = compact.match(/^d(?:\^?[0-9]+)?[a-zA-Z]?\/d([a-zA-Z])(?:\^?[0-9]+)?$/i);
  if (plainOrd) {
    return {
      isPartial: false,
      variable: plainOrd[1].toLowerCase(),
      lhsLabel: lhsRaw.trim(),
    };
  }

  // Subscript partial: f_x, f_x(x,y), u_t
  const subPartial = compact.match(/^[a-zA-Z]_([a-zA-Z])(?:\([a-zA-Z,]+\))?$/i);
  if (subPartial) {
    return {
      isPartial: true,
      variable: subPartial[1].toLowerCase(),
      lhsLabel: lhsRaw.trim(),
    };
  }

  // Prime notation: f'(x), y'(x), y', y''
  const primeMatch = compact.match(/^[a-zA-Z]'{1,2}(?:\(([a-zA-Z])\))?$/);
  if (primeMatch) {
    return {
      isPartial: false,
      variable: (primeMatch[1] ?? 'x').toLowerCase(),
      lhsLabel: lhsRaw.trim(),
    };
  }

  return null;
}

function isFunctionAssignmentLhs(lhsRaw: string, rhsRaw = ''): boolean {
  const compact = lhsRaw.replace(/\\left|\\right|\s+/g, '');
  // f(x), f(x, y), g(t), h(x)
  if (/^[a-zA-Z]\([a-zA-Z](?:,[a-zA-Z])*\)$/.test(compact)) {
    return true;
  }
  const single = compact.toLowerCase();
  // f = RHS, y = RHS, z = RHS, g = RHS, h = RHS, u = RHS, v = RHS, w = RHS
  // Only treat as assignment if the LHS symbol doesn't also appear as an unknown on RHS (so "y = 2y - 4" remains an equation)
  if (/^[fghuvwyz]$/.test(single)) {
    const rhsNorm = preprocessMathSyntax(rhsRaw).toLowerCase();
    const usedOnRhs = new RegExp(`(?<![a-z])${single}(?![a-z])`).test(rhsNorm);
    if (!usedOnRhs) {
      return true;
    }
  }
  return false;
}

/**
 * Analyzes user input in any form (normal text, LaTeX, Unicode, or ASCII)
 * to extract intent (command/derivative/integral/equation/system/expression) and expression body.
 */
export function analyzeMathInput(rawInput: string): AnalyzedMathInput {
  let raw = rawInput.trim();
  if (!raw) return { kind: 'expression', expr: '' };

  // Strip surrounding math delimiters first
  raw = raw
    .replace(/^\$\$([\s\S]*)\$\$$/, '$1')
    .replace(/^\$([\s\S]*)\$$/, '$1')
    .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
    .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
    .trim();

  // Handle LaTeX \begin{cases} ... \end{cases}
  if (/\\begin\{cases\}/i.test(raw)) {
    const inner = raw
      .replace(/\\begin\{cases\}/gi, '')
      .replace(/\\end\{cases\}/gi, '')
      .replace(/\\\\/g, ';')
      .trim();
    return { kind: 'linear-system', expr: inner };
  }

  // Check if multi-line or semicolon-separated system of equations
  if (/[;\n]/.test(raw) && raw.includes('=')) {
    return { kind: 'linear-system', expr: raw };
  }

  // Check "solve <equation>" prefix
  if (/^solve\s+/i.test(raw)) {
    const rest = raw.replace(/^solve\s+/i, '').trim();
    if (rest.includes('=')) {
      return { kind: 'equation', expr: rest };
    }
  }

  // Check differential or function assignment (`LHS = RHS`)
  const eqSplit = splitTopLevelEquals(raw);
  if (eqSplit) {
    const [lhs, rhs] = eqSplit;
    const diffLhs = isDifferentialLhs(lhs);
    if (diffLhs && rhs) {
      return {
        kind: 'differential-assignment',
        expr: rhs,
        variable: diffLhs.variable,
        isPartial: diffLhs.isPartial,
        lhsLabel: diffLhs.lhsLabel,
      };
    }
    if (isFunctionAssignmentLhs(lhs, rhs) && rhs) {
      return {
        kind: 'function-assignment',
        expr: rhs,
        lhsLabel: lhs,
      };
    }
    return { kind: 'equation', expr: raw };
  }

  // Check explicit derivative operator / natural text:
  // "\frac{\partial}{\partial x}(expr)", "\frac{d}{dx}(expr)", "∂/∂x(expr)", "d/dx(expr)"
  const opDerivMatch = raw.match(
    /^(?:\\?[dt]?frac\{\\partial\}\{\\partial\s*([a-zA-Z])\}|\\?[dt]?frac\{d\}\{d\s*([a-zA-Z])\}|∂\s*\/\s*∂\s*([a-zA-Z])|d\s*\/\s*d\s*([a-zA-Z]))\s*(?:of\s+)?([\s\S]+)$/i
  );
  if (opDerivMatch) {
    const variable = (
      opDerivMatch[1] ||
      opDerivMatch[2] ||
      opDerivMatch[3] ||
      opDerivMatch[4] ||
      'x'
    ).toLowerCase();
    return {
      kind: 'derivative',
      variable,
      expr: opDerivMatch[5].trim(),
    };
  }

  // Natural text: "(partial) derivative of <expr> with respect to <var>"
  const textDerivMatch = raw.match(
    /^(?:find\s+(?:the\s+)?)?(?:partial\s+)?(?:derivative|differentiate|diff)\s+(?:of\s+)?([\s\S]+?)(?:\s+(?:with\s+respect\s+to|w\.?r\.?t\.?)\s+([a-zA-Z]))?$/i
  );
  if (textDerivMatch) {
    return {
      kind: 'derivative',
      variable: (textDerivMatch[2] || 'x').toLowerCase(),
      expr: textDerivMatch[1].trim(),
    };
  }

  // LaTeX integral: "\int_{a}^{b} expr dx" or "\int expr \, \mathrm{d}x"
  const latexIntMatch = raw.match(
    /^\\int(?:\s*_\s*(?:\{([^}]+)\}|([^\s^]+))\s*\^\s*(?:\{([^}]+)\}|([^\s]+)))?\s+([\s\S]+?)(?:(?:\\[,;:!]|\\quad|\\qquad|\s|,)*(?:\\mathrm\{d\}|d)([a-zA-Z]))?$/i
  );
  if (latexIntMatch) {
    const lowerStr = latexIntMatch[1] ?? latexIntMatch[2];
    const upperStr = latexIntMatch[3] ?? latexIntMatch[4];
    const lower = lowerStr !== undefined ? Number(preprocessMathSyntax(lowerStr)) : undefined;
    const upper = upperStr !== undefined ? Number(preprocessMathSyntax(upperStr)) : undefined;
    return {
      kind: 'integral',
      expr: latexIntMatch[5].trim(),
      variable: (latexIntMatch[6] || 'x').toLowerCase(),
      lower: lower !== undefined && Number.isFinite(lower) ? lower : undefined,
      upper: upper !== undefined && Number.isFinite(upper) ? upper : undefined,
    };
  }

  // Natural text integral: "integrate <expr> [from a to b] [wrt x]"
  const textIntMatch = raw.match(
    /^(?:find\s+(?:the\s+)?)?(?:integral\s+of|integrate)\s+([\s\S]+?)(?:\s+from\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?))?(?:\s+(?:with\s+respect\s+to|w\.?r\.?t\.?)\s+([a-zA-Z]))?(?:\s+d([a-zA-Z]))?$/i
  );
  if (textIntMatch) {
    const lower = textIntMatch[2] !== undefined ? Number(textIntMatch[2]) : undefined;
    const upper = textIntMatch[3] !== undefined ? Number(textIntMatch[3]) : undefined;
    return {
      kind: 'integral',
      expr: textIntMatch[1].trim(),
      variable: (textIntMatch[4] || textIntMatch[5] || 'x').toLowerCase(),
      lower: lower !== undefined && Number.isFinite(lower) ? lower : undefined,
      upper: upper !== undefined && Number.isFinite(upper) ? upper : undefined,
    };
  }

  // LaTeX limit: "\lim_{x \to a} expr"
  const latexLimMatch = raw.match(
    /^\\lim(?:_\{?\s*([a-zA-Z])\s*(?:\\to|\\rightarrow|->|→)\s*([^}\s]+)\s*\}?)?\s+([\s\S]+)$/i
  );
  if (latexLimMatch) {
    const targetVal = latexLimMatch[2] ? Number(preprocessMathSyntax(latexLimMatch[2])) : undefined;
    return {
      kind: 'limit',
      variable: (latexLimMatch[1] || 'x').toLowerCase(),
      limitTarget: targetVal !== undefined && Number.isFinite(targetVal) ? targetVal : undefined,
      expr: latexLimMatch[3].trim(),
    };
  }

  // Natural text: "simplify <expr>" / "evaluate <expr>"
  const simpEvalMatch = raw.match(/^(?:simplify|evaluate|calculate|compute)\s+([\s\S]+)$/i);
  if (simpEvalMatch) {
    return { kind: 'expression', expr: simpEvalMatch[1].trim() };
  }

  return { kind: 'expression', expr: raw };
}

/**
 * Strips differential/function LHS assignments and calculus command wrappers
 * and returns normalized algebraic syntax suitable for parseExpression().
 */
export function normalizeExpressionOnly(rawInput: string): string {
  const analyzed = analyzeMathInput(rawInput);
  if (analyzed.kind === 'linear-system') {
    throw new Error(
      'Systems of equations (separated by ";" or new lines) must be solved in Math Problem Solver → Linear System.'
    );
  }
  if (analyzed.kind === 'equation') {
    const eqSplit = splitTopLevelEquals(analyzed.expr);
    if (!eqSplit) {
      return preprocessMathSyntax(analyzed.expr);
    }
    const [rawLhs, rawRhs] = eqSplit;
    const lhs = preprocessMathSyntax(rawLhs);
    const rhs = preprocessMathSyntax(rawRhs);
    if (!lhs) {
      throw new Error('Incomplete equation: missing expression before "=".');
    }
    if (!rhs || rhs === '0') {
      return lhs;
    }
    return `(${lhs}) - (${rhs})`;
  }
  return preprocessMathSyntax(analyzed.expr);
}
