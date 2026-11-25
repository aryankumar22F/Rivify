import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';

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

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in your deployment Environment Variables or Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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
              'The handwriting recognition service is temporarily busy due to high demand. Please try again in a moment.',
          };
        }
        return { status: code, message: parsed.error.message };
      }
    } catch {
      // fall through
    }
  }

  if (raw.includes('GEMINI_API_KEY')) {
    return { status: 503, message: raw };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'API key rejected. Please verify GEMINI_API_KEY in deployment environment variables.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Rate limit reached. Please wait a few seconds and try again.',
    };
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message:
        'The handwriting recognition service is temporarily busy due to high demand. Please try again in a moment.',
    };
  }

  return { status: 500, message: raw || 'Unable to process handwriting input.' };
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT')
  );
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithResilience(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, 'model'>
) {
  const attempts: { model: string; delayMs: number }[] = [
    { model: PRIMARY_MODEL, delayMs: 0 },
    { model: PRIMARY_MODEL, delayMs: 550 },
    { model: FALLBACK_MODEL, delayMs: 750 },
    { model: FALLBACK_MODEL, delayMs: 1200 },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await sleep(attempt.delayMs);
    }
    try {
      return await ai.models.generateContent({
        ...params,
        model: attempt.model,
      });
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ocrConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  // Handwriting recognition endpoint
  app.post('/api/assistant/recognize-handwriting', async (req, res) => {
    try {
      const { imageBase64 } = req.body as { imageBase64?: string };
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Handwriting canvas image is required.' });
        return;
      }

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const ai = createGeminiClient();

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

      res.json({ expression: raw });
    } catch (err: unknown) {
      const { status, message } = extractReadableError(err);
      res.status(status).json({ error: message });
    }
  });

  // Math Scanner OCR endpoint for uploaded images (returns expression + LaTeX only, never fabricates solutions)
  app.post('/api/scanner/recognize-image', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Uploaded equation image is required.' });
        return;
      }

      const dataUrlMatch = imageBase64.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
      const cleanMime = dataUrlMatch
        ? dataUrlMatch[1].toLowerCase() === 'image/jpg'
          ? 'image/jpeg'
          : dataUrlMatch[1].toLowerCase()
        : mimeType && /^image\/(png|jpeg|jpg|webp)$/i.test(mimeType)
        ? mimeType.toLowerCase() === 'image/jpg'
          ? 'image/jpeg'
          : mimeType.toLowerCase()
        : 'image/png';
      const base64Data = dataUrlMatch ? dataUrlMatch[2] : imageBase64;

      if (base64Data.length < 32) {
        res.status(400).json({ error: 'Image payload appears empty or corrupted.' });
        return;
      }

      const ai = createGeminiClient();
      const response = await generateWithResilience(ai, {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: base64Data,
              },
            },
            {
              text: `Extract ONLY the mathematical expression or equation visible in this image.
Do NOT solve the equation or invent steps.
Respond strictly as a JSON object with keys:
- "readable": boolean (true if a valid math expression/equation is legible, false if image has no legible math)
- "expression": string (single-line plain-text syntax compatible with a math parser using *, /, +, -, ^, parentheses, =, and functions like sin, cos, tan, ln, log, exp, sqrt; e.g. "x^2 - 5*x + 6 = 0" or "2*x^2*y + sin(x)")
- "latex": string (clean LaTeX representation of the extracted expression)
- "detectedCategory": string (e.g. "Algebraic Equation", "Calculus Expression", "Linear System", "Trigonometric Expression", or "Unreadable")
- "reason": string (only brief explanation if readable is false or notation was ambiguous).`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
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
        res.status(422).json({
          error: 'OCR could not structure a mathematical expression from this image. Try a clearer crop.',
        });
        return;
      }

      if (parsed.readable === false || !parsed.expression?.trim()) {
        res.status(422).json({
          error:
            parsed.reason?.trim() ||
            'No legible mathematical equation was detected in the uploaded image.',
        });
        return;
      }

      res.json({
        expression: parsed.expression.trim(),
        latex: (parsed.latex ?? parsed.expression).trim(),
        detectedCategory: parsed.detectedCategory?.trim() || 'Mathematical Expression',
        notes: parsed.reason?.trim() || undefined,
      });
    } catch (err: unknown) {
      const { status, message } = extractReadableError(err);
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

  return app;
}
