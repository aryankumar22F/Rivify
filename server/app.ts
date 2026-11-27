import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleGenAI, ThinkingLevel, Type, type GenerateContentParameters } from '@google/genai';

function resolveWritableDataDir(): string {
  // Vercel and read-only serverless filesystems must write only to os.tmpdir()
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'rivify-data');
  }
  return path.resolve(process.cwd(), '.data');
}

const DATA_DIR = resolveWritableDataDir();
const SYNC_DIR = path.resolve(DATA_DIR, 'sync');

const memorySyncStore = new Map<string, { syncedAt: number; snapshot: unknown }>();

function ensureDataDirs(): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(SYNC_DIR)) fs.mkdirSync(SYNC_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function resolveSyncTarget(passphrase: string): { hash: string; filePath: string } {
  const hash = crypto.createHash('sha256').update(passphrase).digest('hex');
  const filePath = path.resolve(SYNC_DIR, `${hash}.json`);
  if (!filePath.startsWith(SYNC_DIR + path.sep)) {
    throw new Error('Invalid sync target');
  }
  return { hash, filePath };
}

const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-4-hydrogen';

function resolveGeminiApiKey(): { apiKey: string | null; source: string | null } {
  const candidates: Array<[string, string | undefined]> = [
    ['RIVIFY_API_KEY', process.env.RIVIFY_API_KEY],
    ['GEMINI_API_KEY', process.env.GEMINI_API_KEY],
    ['GOOGLE_API_KEY', process.env.GOOGLE_API_KEY],
  ];
  for (const [name, raw] of candidates) {
    const trimmed = raw?.trim();
    if (trimmed) {
      return { apiKey: trimmed, source: name };
    }
  }
  return { apiKey: null, source: null };
}

function createGeminiClient(): { ai: GoogleGenAI; keySource: string } {
  const { apiKey, source } = resolveGeminiApiKey();
  if (!apiKey || !source) {
    throw new Error(
      'Missing Gemini API key on the server. Configure RIVIFY_API_KEY or GEMINI_API_KEY in your deployment Environment Variables.'
    );
  }
  return {
    ai: new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    }),
    keySource: source,
  };
}

function extractReadableError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);

  const jsonStart = raw.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error?.message) {
        const code = parsed.error.code ?? 500;
        if (code === 503 || parsed.error.status === 'UNAVAILABLE') {
          return {
            status: 503,
            message:
              'The equation recognition service is temporarily busy due to high demand. Please try again in a moment.',
          };
        }
        return { status: code, message: parsed.error.message };
      }
    } catch {
      // fall through
    }
  }

  if (raw.includes('Missing Gemini API key') || raw.includes('GEMINI_API_KEY') || raw.includes('RIVIFY_API_KEY')) {
    return { status: 503, message: raw };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
    return {
      status: 403,
      message: 'API key rejected by Gemini API. Please verify RIVIFY_API_KEY or GEMINI_API_KEY in deployment environment variables.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Rate limit reached. Please wait a few seconds and try again.',
    };
  }
  if (raw.includes('OCR_TIMEOUT') || raw.includes('timed out')) {
    return {
      status: 504,
      message: 'Equation recognition timed out. Please crop closer to the equation and try again.',
    };
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message:
        'The equation recognition service is temporarily busy due to high demand. Please try again in a moment.',
    };
  }

  return { status: 500, message: raw || 'Unable to process image or handwriting input.' };
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('404') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT')
  );
}

function isTimeoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('TIMEOUT') || msg.includes('timed out') || msg.includes('AbortError');
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithTimeout(
  ai: GoogleGenAI,
  params: GenerateContentParameters,
  timeoutMs: number
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      ai.models.generateContent(params),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('OCR_TIMEOUT: Request timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateWithResilience(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, 'model'>
) {
  const attempts: {
    model: string;
    delayMs: number;
    timeoutMs: number;
    thinkingLevel: ThinkingLevel;
  }[] = [
    { model: PRIMARY_MODEL, delayMs: 0, timeoutMs: 8000, thinkingLevel: ThinkingLevel.MINIMAL },
    { model: FALLBACK_MODEL, delayMs: 150, timeoutMs: 8000, thinkingLevel: ThinkingLevel.LOW },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await sleep(attempt.delayMs);
    }
    const attemptStart = Date.now();
    try {
      return await generateWithTimeout(
        ai,
        {
          ...params,
          model: attempt.model,
          config: {
            ...params.config,
            thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
          },
        },
        attempt.timeoutMs
      );
    } catch (err) {
      lastErr = err;
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(
        `[ocr] attempt failed model=${attempt.model} durationMs=${Date.now() - attemptStart} reason="${reason.slice(0, 180)}"`
      );
      if (!isTransientError(err) && !isTimeoutError(err)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

export function createApiApp() {
  const app = express();
  const jsonParser = express.json({ limit: '10mb' });

  // Prevent body-parser stream deadlock when Vercel (@vercel/node) pre-parses req.body
  app.use((req, res, next) => {
    const r = req as express.Request & { _body?: boolean; readableEnded?: boolean };
    if (r.body !== undefined) {
      if (typeof r.body === 'string') {
        try {
          r.body = JSON.parse(r.body);
        } catch {
          // keep raw string
        }
      } else if (Buffer.isBuffer(r.body)) {
        try {
          r.body = JSON.parse(r.body.toString('utf8'));
        } catch {
          // keep raw buffer
        }
      }
      r._body = true;
      next();
      return;
    }
    if (r.readableEnded) {
      r._body = true;
      r.body = {};
      next();
      return;
    }
    jsonParser(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    const { apiKey, source } = resolveGeminiApiKey();
    res.json({
      ok: true,
      ocrConfigured: Boolean(apiKey),
      keySource: source,
    });
  });

  // Handwriting recognition endpoint
  app.post('/api/assistant/recognize-handwriting', async (req, res) => {
    const startedAt = Date.now();
    try {
      const { imageBase64 } = (req.body ?? {}) as { imageBase64?: string };
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Handwriting canvas image is required.' });
        return;
      }

      const base64Data = imageBase64
        .replace(/^data:image\/\w+;base64,/i, '')
        .replace(/\s+/g, '');
      if (base64Data.length < 32) {
        res.status(400).json({ error: 'Handwriting image payload is empty or corrupted.' });
        return;
      }

      const { ai, keySource } = createGeminiClient();
      console.info(
        `[ocr:handwriting] start keySource=${keySource} payloadKB=${Math.round(
          (base64Data.length * 3) / 4 / 1024
        )}`
      );

      const response = await generateWithResilience(ai, {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Data,
              },
            },
            {
              text: `Read the handwritten mathematical expression in this image.
Return ONLY a single-line plain algebraic expression compatible with our parser (use *, /, +, -, ^, parentheses, and functions sin, cos, tan, ln, exp, sqrt).
Examples:
- "2x^2 y^3" -> 2*x^2*y^3
- "sin(xy) + e^x" -> sin(x*y)+e^x
- "x over y" -> x/y
Do not include "f(x,y) =", markdown backticks, or any extra words. Just the expression.`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const raw = (response.text ?? '')
        .replace(/```[a-z]*\n?/gi, '')
        .replace(/```/g, '')
        .replace(/^f\([^)]*\)\s*=\s*/i, '')
        .trim()
        .split('\n')[0]
        .trim();

      if (!raw) {
        res.status(422).json({ error: 'Could not detect a readable mathematical expression.' });
        return;
      }

      console.info(`[ocr:handwriting] success durationMs=${Date.now() - startedAt}`);
      res.json({ expression: raw });
    } catch (err: unknown) {
      const { status, message } = extractReadableError(err);
      console.error(
        `[ocr:handwriting] failed status=${status} durationMs=${Date.now() - startedAt} error="${message}"`
      );
      res.status(status).json({ error: message });
    }
  });

  // Math Scanner OCR endpoint for uploaded images (returns expression + LaTeX only, never fabricates solutions)
  app.post('/api/scanner/recognize-image', async (req, res) => {
    const startedAt = Date.now();
    try {
      const { imageBase64, mimeType } = (req.body ?? {}) as {
        imageBase64?: string;
        mimeType?: string;
      };
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Uploaded equation image is required.' });
        return;
      }

      const anyDataUrlMatch = imageBase64.match(/^data:([^;]+);base64,([\s\S]+)$/i);
      const rawMime = (anyDataUrlMatch ? anyDataUrlMatch[1] : mimeType || 'image/png')
        .trim()
        .toLowerCase();
      const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;

      if (!['image/png', 'image/jpeg', 'image/webp'].includes(normalizedMime)) {
        res.status(400).json({
          error: `Unsupported image format "${rawMime}". Upload a PNG, JPG, or WEBP image.`,
        });
        return;
      }

      const base64Data = (anyDataUrlMatch ? anyDataUrlMatch[2] : imageBase64).replace(/\s+/g, '');

      if (base64Data.length < 32) {
        res.status(400).json({ error: 'Image payload appears empty or corrupted.' });
        return;
      }

      const { ai, keySource } = createGeminiClient();
      console.info(
        `[ocr:scanner] start keySource=${keySource} mime=${normalizedMime} payloadKB=${Math.round(
          (base64Data.length * 3) / 4 / 1024
        )}`
      );

      const response = await generateWithResilience(ai, {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: base64Data,
              },
            },
            {
              text: `Extract ONLY the mathematical expression or equation visible in this image.
Do NOT solve the equation or invent steps.
Return a JSON object with keys:
- "readable": boolean (true if a valid math expression/equation is legible, false if image has no legible math)
- "expression": string (clean single-line expression or equation preserving notation like "∂f/∂x = 2*x*y + 3*y^2", "x^2 - 5*x + 6 = 0", or "2*x^2*y + sin(x)")
- "latex": string (clean LaTeX representation, e.g. "\\frac{\\partial f}{\\partial x} = 2xy + 3y^2")
- "detectedCategory": string (e.g. "Partial Differential", "Algebraic Equation", "Calculus Expression", "Linear System", "Trigonometric Expression", or "Unreadable")
- "reason": string (brief note only if readable is false or notation was ambiguous).`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              readable: { type: Type.BOOLEAN },
              expression: { type: Type.STRING },
              latex: { type: Type.STRING },
              detectedCategory: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ['readable', 'expression', 'latex', 'detectedCategory'],
          },
        },
      });

      const rawText = (response.text ?? '{}')
        .replace(/```json\n?/gi, '')
        .replace(/```/g, '')
        .trim();

      let parsed: {
        readable?: boolean;
        expression?: string;
        latex?: string;
        detectedCategory?: string;
        reason?: string;
      };
      try {
        parsed = JSON.parse(rawText);
      } catch {
        console.warn(`[ocr:scanner] unparseable JSON durationMs=${Date.now() - startedAt}`);
        res.status(422).json({
          error: 'OCR could not structure a mathematical expression from this image. Try a clearer crop.',
        });
        return;
      }

      if (parsed.readable === false || !parsed.expression?.trim()) {
        console.info(`[ocr:scanner] unreadable durationMs=${Date.now() - startedAt}`);
        res.status(422).json({
          error:
            parsed.reason?.trim() ||
            'No legible mathematical equation was detected in the uploaded image.',
        });
        return;
      }

      console.info(
        `[ocr:scanner] success mime=${normalizedMime} durationMs=${Date.now() - startedAt}`
      );
      res.json({
        expression: parsed.expression.trim(),
        latex: (parsed.latex ?? parsed.expression).trim(),
        detectedCategory: parsed.detectedCategory?.trim() || 'Mathematical Expression',
        notes: parsed.reason?.trim() || undefined,
      });
    } catch (err: unknown) {
      const { status, message } = extractReadableError(err);
      console.error(
        `[ocr:scanner] failed status=${status} durationMs=${Date.now() - startedAt} error="${message}"`
      );
      res.status(status).json({ error: message });
    }
  });

  // Optional Cloud Sync
  app.post('/api/sync/push', (req, res) => {
    try {
      const { passphrase, snapshot } = req.body as {
        passphrase?: string;
        snapshot?: unknown;
      };
      if (typeof passphrase !== 'string' || passphrase.trim().length < 6) {
        res.status(400).json({ error: 'Sync passphrase must be at least 6 characters.' });
        return;
      }
      if (!snapshot || typeof snapshot !== 'object') {
        res.status(400).json({ error: 'Valid workspace snapshot object is required.' });
        return;
      }
      const { hash, filePath } = resolveSyncTarget(passphrase.trim());
      const payload = { syncedAt: Date.now(), snapshot };
      memorySyncStore.set(hash, payload);
      if (ensureDataDirs()) {
        try {
          fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
        } catch {
          // keep memory store if read-only
        }
      }
      res.json({ syncedAt: payload.syncedAt });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to save cloud sync snapshot.',
      });
    }
  });

  app.post('/api/sync/pull', (req, res) => {
    try {
      const { passphrase } = req.body as { passphrase?: string };
      if (typeof passphrase !== 'string' || passphrase.trim().length < 6) {
        res.status(400).json({ error: 'Sync passphrase must be at least 6 characters.' });
        return;
      }
      const { hash, filePath } = resolveSyncTarget(passphrase.trim());
      const mem = memorySyncStore.get(hash);
      if (mem) {
        res.json(mem);
        return;
      }
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
          syncedAt: number;
          snapshot: unknown;
        };
        memorySyncStore.set(hash, data);
        res.json(data);
        return;
      }
      res.status(404).json({ error: 'No cloud snapshot found for that passphrase.' });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to pull cloud sync snapshot.',
      });
    }
  });

  // Always return JSON for unmatched /api/* endpoints rather than HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  // Always serialize Express middleware errors (e.g. PayloadTooLargeError, SyntaxError) as JSON
  app.use(
    (
      err: { status?: number; statusCode?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.status || err.statusCode || 500;
      res.status(status).json({
        error: err.message || 'Server failed to process the request.',
      });
    }
  );

  return app;
}
