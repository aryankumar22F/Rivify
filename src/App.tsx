import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Bot,
  Brain,
  Calculator,
  Compass,
  Dot,
  FunctionSquare,
  Grid3X3,
  HelpCircle,
  History,
  Layers,
  Menu,
  Mountain,
  Network,
  Settings,
  Sigma,
  Swords,
  TrendingUp,
  User,
  UserCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import { AboutView } from './components/AboutView';
import { ArenaView } from './components/ArenaView';
import { AssistantView } from './components/AssistantView';
import { CalculatorWorkspace, type CalcToolId } from './components/CalculatorWorkspace';
import { CalculusLabView } from './components/CalculusLabView';
import { DashboardView } from './components/DashboardView';
import { FlashcardsView } from './components/FlashcardsView';
import { FormulaSheetView } from './components/FormulaSheetView';
import { MatrixOperatorsView } from './components/MatrixOperatorsView';
import { NotebookView } from './components/NotebookView';
import { QuizView } from './components/QuizView';
import { SeriesIntegralsView } from './components/SeriesIntegralsView';
import { SettingsModal } from './components/SettingsModal';
import { computeGamification } from './engine/gamification';
import { getTranslations } from './i18n/translations';
import { dbGet, dbSet } from './storage/offlineDb';
import type {
  ActivityEvent,
  AppSettings,
  CalculatorSubTab,
  FlashcardProgress,
  HistoryItem,
  NotebookNote,
  QuizAttempt,
  ToolId,
} from './types';
import { parseApiResponse } from './utils/apiClient';
import { downloadCalculusPdfReport, triggerHaptic } from './utils/pdfReport';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  angleUnit: 'rad',
  precision: 4,
  autoExpandSteps: false,
  dailyGoal: 10,
  hapticsEnabled: true,
  language: 'en',
  reminderEnabled: false,
  reminderTime: '19:00',
  guestMode: false,
  displayName: 'Derivify Scholar',
};

const STORAGE_SETTINGS_KEY = 'derivify_settings_v1';
const STORAGE_HISTORY_KEY = 'derivify_history_v1';
const STORAGE_QUIZ_KEY = 'derivify_quiz_attempts_v1';
const STORAGE_ACTIVITY_KEY = 'derivify_activity_v1';
const STORAGE_FAV_FORMULAS_KEY = 'derivify_fav_formulas_v1';
const STORAGE_DAILY_KEY = 'derivify_daily_done_v1';
const STORAGE_FLASHCARDS_KEY = 'derivify_flashcards_v1';
const STORAGE_NOTEBOOK_KEY = 'derivify_notebook_v1';
const STORAGE_USER_ID_KEY = 'derivify_user_id_v1';

const CALC_TOOL_IDS: { id: CalcToolId; icon: typeof Calculator }[] = [
  { id: 'partial-derivative', icon: FunctionSquare },
  { id: 'gradient', icon: Compass },
  { id: 'directional-derivative', icon: ArrowUpRight },
  { id: 'maxima-minima', icon: Mountain },
  { id: 'linear-approximation', icon: Dot },
  { id: 'vector-field', icon: Network },
];

function isCalcTool(id: ToolId): id is CalcToolId {
  return CALC_TOOL_IDS.some((t) => t.id === id);
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return fallback;
}

function getOrCreateUserId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_USER_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{4,64}$/.test(existing)) return existing;
    const created = `u-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    localStorage.setItem(STORAGE_USER_ID_KEY, created);
    return created;
  } catch {
    return `u-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export default function App() {
  const initialChallenge = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const code = new URLSearchParams(window.location.search).get('challenge');
    return code && /^[a-zA-Z0-9]{4,10}$/.test(code) ? code.toUpperCase() : null;
  }, []);

  const [activeTool, setActiveTool] = useState<ToolId>(
    initialChallenge ? 'arena' : 'partial-derivative'
  );
  const [subTab, setSubTab] = useState<CalculatorSubTab>('calculator');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [reminderBanner, setReminderBanner] = useState<string | null>(null);
  const [userId] = useState<string>(() => getOrCreateUserId());

  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadJson<Partial<AppSettings>>(STORAGE_SETTINGS_KEY, {}),
  }));
  const [history, setHistory] = useState<HistoryItem[]>(() =>
    loadJson<HistoryItem[]>(STORAGE_HISTORY_KEY, [])
  );
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>(() =>
    loadJson<QuizAttempt[]>(STORAGE_QUIZ_KEY, [])
  );
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(() =>
    loadJson<ActivityEvent[]>(STORAGE_ACTIVITY_KEY, [])
  );
  const [favoriteFormulaIds, setFavoriteFormulaIds] = useState<string[]>(() =>
    loadJson<string[]>(STORAGE_FAV_FORMULAS_KEY, [])
  );
  const [dailyCompletedDate, setDailyCompletedDate] = useState<string | null>(() =>
    loadJson<string | null>(STORAGE_DAILY_KEY, null)
  );
  const [flashcardProgress, setFlashcardProgress] = useState<Record<string, FlashcardProgress>>(() =>
    loadJson<Record<string, FlashcardProgress>>(STORAGE_FLASHCARDS_KEY, {})
  );
  const [notebookNotes, setNotebookNotes] = useState<NotebookNote[]>(() =>
    loadJson<NotebookNote[]>(STORAGE_NOTEBOOK_KEY, [])
  );

  const hydratedRef = useRef(false);
  const lastReminderDateRef = useRef<string | null>(null);

  const [quizJumpLevel, setQuizJumpLevel] = useState<1 | 2 | 3 | 4 | null>(null);
  const [assistantContext, setAssistantContext] = useState<{
    tool: string;
    expression: string;
    result: string;
    nonce: number;
  } | null>(null);

  const [externalLoad, setExternalLoad] = useState<{
    tool: CalcToolId;
    expr: string;
    secondary?: string;
    nonce: number;
  } | null>(null);

  const t = useMemo(() => getTranslations(settings.language), [settings.language]);

  const localizedCalcTools = useMemo(() => {
    const labelMap: Record<CalcToolId, string> = {
      'partial-derivative': t.partialDerivative,
      gradient: t.gradient,
      'directional-derivative': t.directionalDerivative,
      'maxima-minima': t.maximaMinima,
      'linear-approximation': t.linearApproximation,
      'vector-field': t.vectorField,
    };
    return CALC_TOOL_IDS.map((item) => ({
      ...item,
      label: labelMap[item.id],
    }));
  }, [t]);

  // Offline/Online network listener
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const loadPersistedProfile = async () => {
    const [h, q, a, f, d, fc, nb] = await Promise.all([
      dbGet<HistoryItem[]>(STORAGE_HISTORY_KEY, []),
      dbGet<QuizAttempt[]>(STORAGE_QUIZ_KEY, []),
      dbGet<ActivityEvent[]>(STORAGE_ACTIVITY_KEY, []),
      dbGet<string[]>(STORAGE_FAV_FORMULAS_KEY, []),
      dbGet<string | null>(STORAGE_DAILY_KEY, null),
      dbGet<Record<string, FlashcardProgress>>(STORAGE_FLASHCARDS_KEY, {}),
      dbGet<NotebookNote[]>(STORAGE_NOTEBOOK_KEY, []),
    ]);
    setHistory(h);
    setQuizAttempts(q);
    setActivityEvents(a);
    setFavoriteFormulaIds(f);
    setDailyCompletedDate(d);
    setFlashcardProgress(fc);
    setNotebookNotes(nb);
  };

  // Hydrate offline IndexedDB on mount
  useEffect(() => {
    let active = true;
    async function hydrate() {
      const s = await dbGet<AppSettings>(STORAGE_SETTINGS_KEY, DEFAULT_SETTINGS);
      if (!active) return;
      const mergedSettings = { ...DEFAULT_SETTINGS, ...s };
      setSettings(mergedSettings);
      if (!mergedSettings.guestMode) {
        await loadPersistedProfile();
      } else {
        setHistory([]);
        setQuizAttempts([]);
        setActivityEvents([]);
        setFavoriteFormulaIds([]);
        setDailyCompletedDate(null);
        setFlashcardProgress({});
        setNotebookNotes([]);
      }
      if (active) hydratedRef.current = true;
    }
    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  // Theme & Settings persistence
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (hydratedRef.current) {
      void dbSet(STORAGE_SETTINGS_KEY, settings);
    }
  }, [settings]);

  // Persist user collections only when NOT in Guest Mode
  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) void dbSet(STORAGE_HISTORY_KEY, history);
  }, [history, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) void dbSet(STORAGE_QUIZ_KEY, quizAttempts);
  }, [quizAttempts, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) void dbSet(STORAGE_ACTIVITY_KEY, activityEvents);
  }, [activityEvents, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_FAV_FORMULAS_KEY, favoriteFormulaIds);
    }
  }, [favoriteFormulaIds, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_DAILY_KEY, dailyCompletedDate);
    }
  }, [dailyCompletedDate, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_FLASHCARDS_KEY, flashcardProgress);
    }
  }, [flashcardProgress, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_NOTEBOOK_KEY, notebookNotes);
    }
  }, [notebookNotes, settings.guestMode]);

  const handleSettingsChange = async (next: AppSettings) => {
    const wasGuest = settings.guestMode;
    setSettings(next);
    if (!wasGuest && next.guestMode) {
      // Entering Guest Mode: keep saved profile safe in IndexedDB and start clean session
      setHistory([]);
      setQuizAttempts([]);
      setActivityEvents([]);
      setFavoriteFormulaIds([]);
      setDailyCompletedDate(null);
      setFlashcardProgress({});
      setNotebookNotes([]);
    } else if (wasGuest && !next.guestMode) {
      // Exiting Guest Mode: restore saved profile from IndexedDB
      await loadPersistedProfile();
    }
  };

  // Daily study reminder scheduler
  const fireStudyReminder = async (isTest = false): Promise<string> => {
    const title = 'Derivify Study Reminder';
    const body =
      gamification.todaySolved >= settings.dailyGoal
        ? `Great consistency! You've hit your ${settings.dailyGoal}-problem goal today.`
        : `Time for Multivariable Calculus — ${Math.max(
            1,
            settings.dailyGoal - gamification.todaySolved
          )} actions left for today’s goal.`;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default' && isTest) {
        try {
          await Notification.requestPermission();
        } catch {
          // ignore
        }
      }
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, { body });
          if (isTest) return 'Browser notification sent.';
          return 'sent';
        } catch {
          // fall back to in-app banner
        }
      }
    }
    setReminderBanner(body);
    return 'Displayed in-app reminder banner (browser notifications blocked or unavailable).';
  };

  const gamification = useMemo(
    () => computeGamification(history, quizAttempts, activityEvents, flashcardProgress),
    [history, quizAttempts, activityEvents, flashcardProgress]
  );

  useEffect(() => {
    if (!settings.reminderEnabled) return;
    const checkReminder = () => {
      const now = new Date();
      const dateKey = now.toISOString().slice(0, 10);
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}`;
      if (hhmm === settings.reminderTime && lastReminderDateRef.current !== dateKey) {
        lastReminderDateRef.current = dateKey;
        void fireStudyReminder(false);
      }
    };
    const timer = window.setInterval(checkReminder, 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.reminderEnabled, settings.reminderTime]);

  const recordActivity = (kind: ActivityEvent['kind'], topic: string) => {
    const now = new Date();
    setActivityEvents((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dateKey: now.toISOString().slice(0, 10),
          kind,
          topic,
          timestamp: now.getTime(),
        },
        ...prev,
      ].slice(0, 500)
    );
  };

  const handleSelectTool = (tool: ToolId) => {
    triggerHaptic(settings.hapticsEnabled, 8);
    setActiveTool(tool);
    setDrawerOpen(false);
    if (tool !== 'quiz') setQuizJumpLevel(null);
    if (isCalcTool(tool)) {
      setSubTab('calculator');
    }
  };

  const handleSaveHistory = (item: HistoryItem) => {
    setHistory((prev) => [item, ...prev].slice(0, 60));
    recordActivity('calculation', item.toolLabel);
  };

  const handleToggleBookmark = (id: string) => {
    triggerHaptic(settings.hapticsEnabled, 10);
    setHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, bookmarked: !item.bookmarked } : item))
    );
  };

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleRecordAttempt = (attempt: QuizAttempt) => {
    setQuizAttempts((prev) => [attempt, ...prev].slice(0, 400));
    recordActivity(attempt.isDailyChallenge ? 'daily' : 'quiz', attempt.category);
  };

  const handleToggleFavoriteFormula = (id: string) => {
    triggerHaptic(settings.hapticsEnabled, 10);
    setFavoriteFormulaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Notebook CRUD handlers
  const handleCreateNote = (note: { title: string; topic: string; content: string }): NotebookNote => {
    const now = Date.now();
    const created: NotebookNote = {
      id: `note-${now}-${Math.random().toString(36).slice(2, 6)}`,
      title: note.title,
      topic: note.topic,
      content: note.content,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    setNotebookNotes((prev) => [created, ...prev]);
    return created;
  };

  const handleUpdateNote = (
    id: string,
    updates: Partial<Pick<NotebookNote, 'title' | 'topic' | 'content'>>
  ) => {
    setNotebookNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n))
    );
  };

  const handleDeleteNote = (id: string) => {
    setNotebookNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleToggleNotePin = (id: string) => {
    setNotebookNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n))
    );
  };

  // Backup & Restore + Cloud Sync helpers
  const buildWorkspaceSnapshot = () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    history,
    quizAttempts,
    activityEvents,
    favoriteFormulaIds,
    dailyCompletedDate,
    flashcardProgress,
    notebookNotes,
  });

  const applyWorkspaceSnapshot = (raw: unknown): string | null => {
    if (!raw || typeof raw !== 'object') return 'Invalid backup JSON file.';
    const data = raw as Record<string, unknown>;
    if (Array.isArray(data.history)) setHistory(data.history as HistoryItem[]);
    if (Array.isArray(data.quizAttempts)) setQuizAttempts(data.quizAttempts as QuizAttempt[]);
    if (Array.isArray(data.activityEvents)) setActivityEvents(data.activityEvents as ActivityEvent[]);
    if (Array.isArray(data.favoriteFormulaIds)) {
      setFavoriteFormulaIds(data.favoriteFormulaIds as string[]);
    }
    if (typeof data.dailyCompletedDate === 'string' || data.dailyCompletedDate === null) {
      setDailyCompletedDate(data.dailyCompletedDate as string | null);
    }
    if (data.flashcardProgress && typeof data.flashcardProgress === 'object') {
      setFlashcardProgress(data.flashcardProgress as Record<string, FlashcardProgress>);
    }
    if (Array.isArray(data.notebookNotes)) setNotebookNotes(data.notebookNotes as NotebookNote[]);
    if (data.settings && typeof data.settings === 'object') {
      setSettings((prev) => ({
        ...prev,
        ...(data.settings as Partial<AppSettings>),
        guestMode: false,
      }));
    }
    return null;
  };

  const handleExportBackup = () => {
    const json = JSON.stringify(buildWorkspaceSnapshot(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `derivify-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportBackup = async (file: File): Promise<string | null> => {
    try {
      const text = await file.text();
      return applyWorkspaceSnapshot(JSON.parse(text));
    } catch {
      return 'Could not parse backup file as valid JSON.';
    }
  };

  const handleCloudPush = async (passphrase: string): Promise<string> => {
    try {
      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passphrase,
          snapshot: buildWorkspaceSnapshot(),
        }),
      });
      const data = await parseApiResponse<{ syncedAt?: number }>(res, 'Sync failed.');
      return `Cloud snapshot saved at ${new Date(data.syncedAt ?? Date.now()).toLocaleTimeString()}.`;
    } catch (err) {
      return err instanceof Error
        ? err.message
        : 'Network unavailable — cloud sync requires an active server connection.';
    }
  };

  const handleCloudPull = async (passphrase: string): Promise<string> => {
    try {
      const res = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });
      const data = await parseApiResponse<{ syncedAt?: number; snapshot?: unknown }>(
        res,
        'Could not restore cloud snapshot.'
      );
      const err = applyWorkspaceSnapshot(data.snapshot);
      if (err) return err;
      return `Restored snapshot from ${new Date(data.syncedAt ?? Date.now()).toLocaleString()}.`;
    } catch (err) {
      return err instanceof Error
        ? err.message
        : 'Network unavailable — unable to reach cloud sync server.';
    }
  };

  // SM-2 Spaced Repetition rating handler
  const handleRateFlashcard = (formulaId: string, quality: 1 | 2 | 3 | 4) => {
    triggerHaptic(settings.hapticsEnabled, 12);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const q5 = quality === 1 ? 1 : quality === 2 ? 3 : quality === 3 ? 4 : 5;

    setFlashcardProgress((prev) => {
      const existing = prev[formulaId];
      const prevReps = existing?.repetitions ?? 0;
      const prevInterval = existing?.intervalDays ?? 0;
      const prevEf = existing?.easeFactor ?? 2.5;

      const nextEf = Math.max(
        1.3,
        prevEf + (0.1 - (5 - q5) * (0.08 + (5 - q5) * 0.02))
      );

      let nextReps = prevReps;
      let nextIntervalDays = 1;
      let nextReviewAt = now + dayMs;

      if (quality === 1) {
        nextReps = 0;
        nextIntervalDays = 0;
        nextReviewAt = now + 10 * 60 * 1000;
      } else if (quality === 2) {
        nextReps = Math.max(1, prevReps);
        nextIntervalDays = 1;
        nextReviewAt = now + dayMs;
      } else if (quality === 3) {
        nextReps = prevReps + 1;
        nextIntervalDays =
          nextReps === 1 ? 1 : nextReps === 2 ? 3 : Math.round(prevInterval * nextEf);
        nextReviewAt = now + nextIntervalDays * dayMs;
      } else {
        nextReps = prevReps + 1;
        nextIntervalDays =
          nextReps === 1
            ? 4
            : nextReps === 2
            ? 6
            : Math.round(Math.max(4, prevInterval * nextEf * 1.3));
        nextReviewAt = now + nextIntervalDays * dayMs;
      }

      return {
        ...prev,
        [formulaId]: {
          formulaId,
          repetitions: nextReps,
          intervalDays: nextIntervalDays,
          easeFactor: Number(nextEf.toFixed(2)),
          nextReviewAt,
          lastQuality: quality,
        },
      };
    });

    recordActivity('flashcard', formulaId);
  };

  const topBarTitle =
    activeTool === 'quiz'
      ? t.calculusQuiz
      : activeTool === 'calculus-lab'
      ? t.calculusLab
      : activeTool === 'matrix-operators'
      ? t.matrixOperators
      : activeTool === 'series-integrals'
      ? t.seriesIntegrals
      : activeTool === 'notebook'
      ? t.notebook
      : activeTool === 'arena'
      ? t.arena
      : activeTool === 'flashcards'
      ? t.flashcards
      : activeTool === 'assistant'
      ? t.assistant
      : activeTool === 'dashboard'
      ? t.dashboard
      : activeTool === 'formula-sheet'
      ? t.formulaLibrary
      : activeTool === 'about'
      ? t.aboutDeveloper
      : t.appName;

  const activeToolMeta = localizedCalcTools.find((item) => item.id === activeTool);

  const renderDrawerContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-[#1E1C22] text-slate-900 dark:text-[#E6E1E5]">
      <div className="px-5 py-5 flex items-center justify-between border-b border-slate-200 dark:border-white/10">
        <span className="text-lg font-medium font-display tracking-tight">{t.toolkit}</span>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close toolkit menu"
          className="lg:hidden min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5" aria-label="Calculus Toolkit">
        {/* Highlighted Calculus Quiz */}
        <button
          type="button"
          onClick={() => handleSelectTool('quiz')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center justify-between text-sm font-medium transition-colors ${
            activeTool === 'quiz'
              ? 'bg-[#2F7CF6] text-white'
              : 'bg-rose-500/10 dark:bg-[#2E2528] text-slate-900 dark:text-[#F2DDE1] hover:bg-rose-500/15 dark:hover:bg-[#3A2F33]'
          }`}
        >
          <span className="inline-flex items-center gap-3">
            <HelpCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{t.calculusQuiz}</span>
          </span>
          <span
            className={`text-xs font-semibold ${
              activeTool === 'quiz' ? 'text-white/90' : 'text-rose-600 dark:text-[#F2B8B5]'
            }`}
          >
            {t.practice}
          </span>
        </button>

        {/* Interactive 3D Calculus Lab */}
        <button
          type="button"
          onClick={() => handleSelectTool('calculus-lab')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'calculus-lab'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Layers className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.calculusLab}</span>
        </button>

        {/* Formula Flashcards */}
        <button
          type="button"
          onClick={() => handleSelectTool('flashcards')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'flashcards'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Brain className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.flashcards}</span>
        </button>

        {/* Math Notebook */}
        <button
          type="button"
          onClick={() => handleSelectTool('notebook')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'notebook'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <BookMarked className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.notebook}</span>
        </button>

        {/* Challenges & Leaderboard */}
        <button
          type="button"
          onClick={() => handleSelectTool('arena')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'arena'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Swords className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.arena}</span>
        </button>

        {/* AI Calculus Assistant */}
        <button
          type="button"
          onClick={() => handleSelectTool('assistant')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'assistant'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Bot className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.assistant}</span>
        </button>

        {/* Learning Dashboard */}
        <button
          type="button"
          onClick={() => handleSelectTool('dashboard')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'dashboard'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <BarChart3 className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.dashboard}</span>
        </button>

        <div className="my-2.5 border-t border-slate-200 dark:border-white/10" />

        {/* 6 Core Multivariable Tools */}
        {localizedCalcTools.map((item) => {
          const Icon = item.icon;
          const isActive = activeTool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTool(item.id)}
              className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#2F7CF6]/15 dark:bg-[#4A4458]/70 text-[#2F7CF6] dark:text-[#E8DEF8]'
                  : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        {/* Advanced Operators & Integrals */}
        <button
          type="button"
          onClick={() => handleSelectTool('matrix-operators')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'matrix-operators'
              ? 'bg-[#2F7CF6]/15 dark:bg-[#4A4458]/70 text-[#2F7CF6] dark:text-[#E8DEF8]'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Grid3X3 className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.matrixOperators}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTool('series-integrals')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'series-integrals'
              ? 'bg-[#2F7CF6]/15 dark:bg-[#4A4458]/70 text-[#2F7CF6] dark:text-[#E8DEF8]'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Sigma className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.seriesIntegrals}</span>
        </button>

        <div className="my-2.5 border-t border-slate-200 dark:border-white/10" />

        {/* Formula Library & About */}
        <button
          type="button"
          onClick={() => handleSelectTool('formula-sheet')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'formula-sheet'
              ? 'bg-[#2F7CF6]/15 dark:bg-[#4A4458]/70 text-[#2F7CF6] dark:text-[#E8DEF8]'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <BookOpen className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.formulaLibrary}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTool('about')}
          className={`w-full min-h-[44px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'about'
              ? 'bg-[#2F7CF6]/15 dark:bg-[#4A4458]/70 text-[#2F7CF6] dark:text-[#E8DEF8]'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <User className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.aboutDeveloper}</span>
        </button>
      </nav>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex bg-slate-50 dark:bg-[#0E1015] text-slate-900 dark:text-[#ECEFF4]">
        {/* Persistent Desktop Toolkit Rail */}
        <aside className="hidden lg:block w-72 shrink-0 border-r border-slate-200 dark:border-white/10 sticky top-0 h-screen">
          {renderDrawerContent()}
        </aside>

        {/* Mobile Slide-Over Drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="relative z-10 w-76 max-w-[85vw] h-full shadow-2xl">
              {renderDrawerContent()}
            </aside>
          </div>
        )}

        {/* Main Content Shell */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 flex items-center justify-between gap-4 bg-white/95 dark:bg-[#1A2940] border-b border-slate-200 dark:border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open Calculus Toolkit drawer"
                className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-medium font-display text-slate-900 dark:text-white truncate">
                {topBarTitle}
              </h1>
              {activeToolMeta && (
                <span className="hidden sm:inline-block text-xs text-slate-500 dark:text-slate-300/80 truncate">
                  · {activeToolMeta.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isCalcTool(activeTool) && (
                <div className="hidden md:flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#111C2D] border border-slate-200 dark:border-white/10 mr-1">
                  {(['calculator', 'history', 'graph'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSubTab(tab)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                        subTab === tab
                          ? 'bg-[#2F7CF6] text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </header>

          {settings.guestMode && (
            <div className="px-4 sm:px-6 py-2 bg-sky-500/12 border-b border-sky-500/30 text-xs text-sky-800 dark:text-sky-200 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{t.guestBanner}</span>
              </span>
              <button
                type="button"
                onClick={() => void handleSettingsChange({ ...settings, guestMode: false })}
                className="text-xs font-semibold underline shrink-0"
              >
                Exit Guest
              </button>
            </div>
          )}

          {reminderBanner && (
            <div className="px-4 sm:px-6 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 shrink-0" />
                <span>{reminderBanner}</span>
              </span>
              <button
                type="button"
                onClick={() => setReminderBanner(null)}
                aria-label="Dismiss reminder"
                className="p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {!isOnline && (
            <div className="px-4 sm:px-6 py-2 bg-amber-500/15 border-b border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>{t.offlineBanner}</span>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
            <motion.div
              key={activeTool}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {isCalcTool(activeTool) && (
                <CalculatorWorkspace
                  activeTool={activeTool}
                  subTab={subTab}
                  onSubTabChange={setSubTab}
                  settings={settings}
                  history={history}
                  onSaveHistory={handleSaveHistory}
                  onToggleBookmark={handleToggleBookmark}
                  onDeleteHistory={handleDeleteHistory}
                  onClearHistory={handleClearHistory}
                  onAskAI={(ctx) => {
                    setAssistantContext({ ...ctx, nonce: Date.now() });
                    setActiveTool('assistant');
                  }}
                  onSaveToNotebook={(note) => {
                    handleCreateNote(note);
                  }}
                  externalLoad={externalLoad}
                />
              )}

              {activeTool === 'matrix-operators' && (
                <MatrixOperatorsView
                  settings={settings}
                  onAskAI={(ctx) => {
                    setAssistantContext({ ...ctx, nonce: Date.now() });
                    setActiveTool('assistant');
                  }}
                  onSaveToNotebook={(note) => {
                    handleCreateNote(note);
                  }}
                />
              )}

              {activeTool === 'series-integrals' && (
                <SeriesIntegralsView
                  settings={settings}
                  onAskAI={(ctx) => {
                    setAssistantContext({ ...ctx, nonce: Date.now() });
                    setActiveTool('assistant');
                  }}
                  onSaveToNotebook={(note) => {
                    handleCreateNote(note);
                  }}
                />
              )}

              {activeTool === 'calculus-lab' && <CalculusLabView settings={settings} />}

              {activeTool === 'quiz' && (
                <QuizView
                  quizAttempts={quizAttempts}
                  dailyCompletedDate={dailyCompletedDate}
                  initialLevel={quizJumpLevel}
                  hapticsEnabled={settings.hapticsEnabled}
                  onRecordAttempt={handleRecordAttempt}
                  onCompleteDaily={(dateKey) => setDailyCompletedDate(dateKey)}
                  onCompleteMock={() => recordActivity('mock', 'Timed Mock Test')}
                />
              )}

              {activeTool === 'flashcards' && (
                <FlashcardsView
                  progressMap={flashcardProgress}
                  onRateCard={handleRateFlashcard}
                  onTryInCalculator={(ex) => {
                    setActiveTool(ex.tool);
                    setSubTab('calculator');
                    setExternalLoad({
                      tool: ex.tool,
                      expr: ex.expr,
                      secondary: ex.secondary,
                      nonce: Date.now(),
                    });
                  }}
                />
              )}

              {activeTool === 'notebook' && (
                <NotebookView
                  notes={notebookNotes}
                  onCreateNote={handleCreateNote}
                  onUpdateNote={handleUpdateNote}
                  onDeleteNote={handleDeleteNote}
                  onTogglePin={handleToggleNotePin}
                  hapticsEnabled={settings.hapticsEnabled}
                />
              )}

              {activeTool === 'arena' && (
                <ArenaView
                  displayName={settings.displayName || 'Derivify Scholar'}
                  userId={userId}
                  gamification={gamification}
                  quizAttempts={quizAttempts}
                  totalProblemsSolved={history.length + quizAttempts.length}
                  initialChallengeCode={initialChallenge}
                  hapticsEnabled={settings.hapticsEnabled}
                  onRecordAttempt={handleRecordAttempt}
                />
              )}

              {activeTool === 'assistant' && (
                <AssistantView initialContext={assistantContext} />
              )}

              {activeTool === 'dashboard' && (
                <DashboardView
                  history={history}
                  quizAttempts={quizAttempts}
                  activityEvents={activityEvents}
                  favoriteFormulaIds={favoriteFormulaIds}
                  gamification={gamification}
                  dailyGoal={settings.dailyGoal}
                  onPracticeTopic={(lvl) => {
                    setQuizJumpLevel(lvl);
                    setActiveTool('quiz');
                  }}
                  onOpenQuiz={() => {
                    setQuizJumpLevel(null);
                    setActiveTool('quiz');
                  }}
                  onOpenFlashcards={() => setActiveTool('flashcards')}
                  onDownloadPdf={() => {
                    triggerHaptic(settings.hapticsEnabled, 14);
                    downloadCalculusPdfReport(history, quizAttempts, gamification);
                  }}
                />
              )}

              {activeTool === 'formula-sheet' && (
                <FormulaSheetView
                  favoriteIds={favoriteFormulaIds}
                  onToggleFavorite={handleToggleFavoriteFormula}
                  onLoadExample={(ex) => {
                    setActiveTool(ex.tool);
                    setSubTab('calculator');
                    setExternalLoad({
                      tool: ex.tool,
                      expr: ex.expr,
                      secondary: ex.secondary,
                      nonce: Date.now(),
                    });
                  }}
                />
              )}

              {activeTool === 'about' && <AboutView />}
            </motion.div>
          </main>

          {isCalcTool(activeTool) && (
            <nav
              aria-label="Calculator Views"
              className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 dark:bg-[#1E2027]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/10 grid grid-cols-3 items-center px-2"
            >
              {(
                [
                  { id: 'calculator', label: 'Calculator', icon: Calculator },
                  { id: 'history', label: 'History', icon: History },
                  { id: 'graph', label: 'Graph', icon: TrendingUp },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = subTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(settings.hapticsEnabled, 8);
                      setSubTab(item.id);
                    }}
                    className="flex flex-col items-center justify-center gap-1 min-h-[44px]"
                  >
                    <span
                      className={`px-4 py-1 rounded-full transition-colors ${
                        active
                          ? 'bg-[#2F7CF6]/20 text-[#2F7CF6] dark:text-[#7EB0FF]'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        active
                          ? 'text-[#2F7CF6] dark:text-[#7EB0FF]'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onChange={(next) => void handleSettingsChange(next)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onCloudPush={handleCloudPush}
          onCloudPull={handleCloudPull}
          onTestReminder={() => fireStudyReminder(true)}
        />
      </div>
    </MotionConfig>
  );
}
