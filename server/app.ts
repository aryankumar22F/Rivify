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
    return path.join(os.tmpdir(), 'derivify-data');
  }
  return path.resolve(process.cwd(), '.data');
}

const DATA_DIR = resolveWritableDataDir();
const SYNC_DIR = path.resolve(DATA_DIR, 'sync');
const SOCIAL_FILE = path.resolve(DATA_DIR, 'social.json');

interface StoredLeaderboardEntry {
  id: string;
  displayName: string;
  weekKey: string;
  xp: number;
  accuracy: number;
  problemsSolved: number;
  streak: number;
  updatedAt: number;
}

interface StoredChallengeRoom {
  code: string;
  creatorName: string;
  topic: string;
  seed: number;
  questionCount: number;
  createdAt: number;
  submissions: {
    playerName: string;
    score: number;
    total: number;
    elapsedSeconds: number;
    submittedAt: number;
  }[];
}

interface SocialStore {
  leaderboard: StoredLeaderboardEntry[];
  challenges: Record<string, StoredChallengeRoom>;
}

let memorySocialStore: SocialStore | null = null;
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

function readSocialStore(): SocialStore {
  if (memorySocialStore) return memorySocialStore;
  if (ensureDataDirs()) {
    try {
      if (fs.existsSync(SOCIAL_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(SOCIAL_FILE, 'utf8')) as Partial<SocialStore>;
        memorySocialStore = {
          leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : [],
          challenges:
            parsed.challenges && typeof parsed.challenges === 'object' ? parsed.challenges : {},
        };
        return memorySocialStore;
      }
    } catch {
      // ignore corrupt read
    }
  }
  memorySocialStore = { leaderboard: [], challenges: {} };
  return memorySocialStore;
}

function writeSocialStore(store: SocialStore) {
  memorySocialStore = store;
  if (ensureDataDirs()) {
    try {
      fs.writeFileSync(SOCIAL_FILE, JSON.stringify(store, null, 2), 'utf8');
    } catch {
      // keep in-memory store if disk write fails in restricted serverless environments
    }
  }
}

function sanitizeName(raw: unknown, fallback = 'Scholar'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/[^a-zA-Z0-9\s._-]/g, '').trim().slice(0, 28);
  return cleaned || fallback;
}

function getIsoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
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
              'The AI tutor is temporarily busy due to high demand. Please click Retry in a moment.',
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
        'The AI tutor is temporarily busy due to high demand. Please click Retry in a moment.',
    };
  }

  return { status: 500, message: raw || 'Unable to reach AI Calculus Assistant.' };
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

const CALCULUS_SYSTEM_INSTRUCTION = `You are Derivify's Multi-Variable Calculus Tutor for university engineering and mathematics students.
Guidelines:
1. Be mathematically rigorous, clear, and encouraging.
2. Always format mathematical expressions in clean LaTeX using $...$ for inline math and $$...$$ for display equations.
3. When explaining derivatives or multivariable operations, explicitly name the differentiation rules used (e.g., Power Rule, Product Rule, Quotient Rule, Chain Rule, Clairaut's Theorem, Hessian Test).
4. When a student submits their attempted solution or asks about a mistake, identify the exact algebraic or rule error kindly, show the corrected step-by-step derivation, and state the final simplified answer.
5. Keep responses structured with concise numbered steps and short paragraphs.`;

const HINT_SYSTEM_INSTRUCTION = `You are Derivify's Socratic Calculus Tutor.
Instead of immediately revealing the final simplified answer, give the student:
1. The key rule or theorem to apply first.
2. A targeted hint for the very next step using clean LaTeX ($...$ and $$...$$).
3. A short guiding question so they can finish the derivation themselves.`;

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  // AI Calculus Assistant chat endpoint
  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const { messages, context, tutorMode } = req.body as {
        messages?: { role: 'user' | 'assistant'; content: string }[];
        tutorMode?: 'explain' | 'hint';
        context?: {
          tool?: string;
          expression?: string;
          result?: string;
        };
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'At least one message is required.' });
        return;
      }

      const ai = createGeminiClient();
      const baseInstruction =
        tutorMode === 'hint' ? HINT_SYSTEM_INSTRUCTION : CALCULUS_SYSTEM_INSTRUCTION;

      const contextNote = context?.expression
        ? `\n\nCurrent Calculator Context:\n- Active Tool: ${context.tool ?? 'Calculator'}\n- Expression: ${context.expression}\n- Symbolic Result: ${context.result ?? 'N/A'}`
        : '';

      const historyContents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content).slice(0, 4000) }],
      }));

      const response = await generateWithResilience(ai, {
        contents: historyContents,
        config: {
          systemInstruction: baseInstruction + contextNote,
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: 'The assistant returned an empty response.' });
        return;
      }

      res.json({ reply });
    } catch (err: unknown) {
      const { status, message } = extractReadableError(err);
      res.status(status).json({ error: message });
    }
  });

  // Mistake Analysis endpoint
  app.post('/api/assistant/check-work', async (req, res) => {
    try {
      const { expression, variable, expectedSymbolic, studentAttempt } = req.body as {
        expression?: string;
        variable?: string;
        expectedSymbolic?: string;
        studentAttempt?: string;
      };

      if (!expression || !studentAttempt) {
        res.status(400).json({
          error: 'Both the original expression and your attempted solution are required.',
        });
        return;
      }

      const ai = createGeminiClient();
      const prompt = `A student tried to differentiate f = ${expression} with respect to ${
        variable || 'x'
      }.
Our symbolic engine verified the exact derivative is: ${expectedSymbolic || 'N/A'}.
The student's attempted answer is: ${studentAttempt}.

Analyze whether the student's answer is mathematically equivalent to the exact derivative.
- If it IS equivalent (even if written in unsimplified or differently ordered form), confirm they are correct and note any optional simplification.
- If it has a mistake, pinpoint the exact rule or algebra error (e.g., forgot Chain Rule factor, sign error in Quotient Rule, treated y as variable instead of constant), and walk through the correct derivation step by step using LaTeX ($...$ and $$...$$).`;

      const response = await generateWithResilience(ai, {
        contents: prompt,
        config: {
          systemInstruction: CALCULUS_SYSTEM_INSTRUCTION,
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: 'Empty response from assistant.' });
        return;
      }
      res.json({ reply });
    } catch (err: unknown) {
      const { status, message } = extractReadableError(err);
      res.status(status).json({ error: message });
    }
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

  // Weekly Leaderboard
  app.get('/api/social/leaderboard', (req, res) => {
    const weekKey =
      typeof req.query.week === 'string' && /^\d{4}-W\d{2}$/.test(req.query.week)
        ? req.query.week
        : getIsoWeekKey();
    const store = readSocialStore();
    const entries = store.leaderboard
      .filter((e) => e.weekKey === weekKey)
      .sort((a, b) => b.xp - a.xp || b.accuracy - a.accuracy)
      .slice(0, 50);
    res.json({ weekKey, entries });
  });

  app.post('/api/social/leaderboard', (req, res) => {
    const { id, displayName, xp, accuracy, problemsSolved, streak } = req.body as Record<
      string,
      unknown
    >;
    const cleanId =
      typeof id === 'string' && /^[a-zA-Z0-9_-]{4,64}$/.test(id)
        ? id
        : `user-${crypto.randomBytes(6).toString('hex')}`;
    const cleanName = sanitizeName(displayName, 'Derivify Scholar');
    const cleanXp = Math.max(0, Math.min(1000000, Math.floor(Number(xp) || 0)));
    const cleanAcc = Math.max(0, Math.min(100, Math.round(Number(accuracy) || 0)));
    const cleanSolved = Math.max(0, Math.min(100000, Math.floor(Number(problemsSolved) || 0)));
    const cleanStreak = Math.max(0, Math.min(3650, Math.floor(Number(streak) || 0)));
    const weekKey = getIsoWeekKey();

    const store = readSocialStore();
    const existingIdx = store.leaderboard.findIndex(
      (e) => e.id === cleanId && e.weekKey === weekKey
    );
    const entry: StoredLeaderboardEntry = {
      id: cleanId,
      displayName: cleanName,
      weekKey,
      xp: cleanXp,
      accuracy: cleanAcc,
      problemsSolved: cleanSolved,
      streak: cleanStreak,
      updatedAt: Date.now(),
    };
    if (existingIdx >= 0) {
      store.leaderboard[existingIdx] = entry;
    } else {
      store.leaderboard.push(entry);
    }
    writeSocialStore(store);
    res.json({ entry, weekKey });
  });

  // Friends Challenges & Quiz Competitions
  app.post('/api/social/challenges', (req, res) => {
    const { creatorName, topic, questionCount } = req.body as Record<string, unknown>;
    const cleanCreator = sanitizeName(creatorName, 'Challenger');
    const cleanTopic =
      typeof topic === 'string' && topic.trim().length > 0
        ? topic.trim().slice(0, 48)
        : 'Mixed Multivariable';
    const count = Math.max(5, Math.min(12, Math.floor(Number(questionCount) || 5)));
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const seed = crypto.randomInt(10000, 99999999);

    const room: StoredChallengeRoom = {
      code,
      creatorName: cleanCreator,
      topic: cleanTopic,
      seed,
      questionCount: count,
      createdAt: Date.now(),
      submissions: [],
    };
    const store = readSocialStore();
    store.challenges[code] = room;
    writeSocialStore(store);
    res.json({ room });
  });

  app.get('/api/social/challenges/:code', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z0-9]{4,10}$/.test(code)) {
      res.status(400).json({ error: 'Invalid challenge code format.' });
      return;
    }
    const store = readSocialStore();
    const room = store.challenges[code];
    if (!room) {
      res.status(404).json({ error: 'Challenge room not found. Check the 6-character code.' });
      return;
    }
    res.json({ room });
  });

  app.post('/api/social/challenges/:code/submit', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z0-9]{4,10}$/.test(code)) {
      res.status(400).json({ error: 'Invalid challenge code.' });
      return;
    }
    const store = readSocialStore();
    const room = store.challenges[code];
    if (!room) {
      res.status(404).json({ error: 'Challenge room not found.' });
      return;
    }
    const { playerName, score, total, elapsedSeconds } = req.body as Record<string, unknown>;
    const submission = {
      playerName: sanitizeName(playerName, 'Player'),
      score: Math.max(0, Math.min(room.questionCount, Math.floor(Number(score) || 0))),
      total: Math.max(1, Math.min(20, Math.floor(Number(total) || room.questionCount))),
      elapsedSeconds: Math.max(1, Math.min(3600, Math.floor(Number(elapsedSeconds) || 1))),
      submittedAt: Date.now(),
    };
    room.submissions.push(submission);
    room.submissions.sort((a, b) => b.score - a.score || a.elapsedSeconds - b.elapsedSeconds);
    writeSocialStore(store);
    res.json({ room });
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
