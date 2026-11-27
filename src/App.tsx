import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  Bell,
  Binary,
  BookMarked,
  BookOpen,
  Brain,
  Calculator,
  Compass,
  Dot,
  FileOutput,
  FileText,
  Film,
  FolderKanban,
  FunctionSquare,
  GitBranch,
  GitCompare,
  GitFork,
  GraduationCap,
  Grid3X3,
  HardDriveDownload,
  HelpCircle,
  History,
  Layers,
  LineChart,
  Menu,
  Mountain,
  Network,
  Orbit,
  PenTool,
  Ruler,
  Scale,
  ScanLine,
  Settings,
  Sigma,
  Sliders,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import { AboutView } from './components/AboutView';
import { AdvancedGeometryView } from './components/AdvancedGeometryView';
import { CalculatorWorkspace, type CalcToolId } from './components/CalculatorWorkspace';
import { CalculusLabView } from './components/CalculusLabView';
import { ComplexNumbersView } from './components/ComplexNumbersView';
import { DashboardView } from './components/DashboardView';
import { DifferentialEquationsView } from './components/DifferentialEquationsView';
import { DiscreteMathView } from './components/DiscreteMathView';
import { EquationEditorView } from './components/EquationEditorView';
import { ExamPrepView } from './components/ExamPrepView';
import { ExportStudioView } from './components/ExportStudioView';
import { FlashcardsView } from './components/FlashcardsView';
import { FormulaDerivationView } from './components/FormulaDerivationView';
import { FormulaSheetView } from './components/FormulaSheetView';
import { FourierLaplaceView } from './components/FourierLaplaceView';
import { GraphAnimationView } from './components/GraphAnimationView';
import { GraphingCalculatorView } from './components/GraphingCalculatorView';
import { LimitsContinuityView } from './components/LimitsContinuityView';
import { LinearAlgebraView } from './components/LinearAlgebraView';
import { MathHistoryView } from './components/MathHistoryView';
import { MathScannerView } from './components/MathScannerView';
import { MathSolverView } from './components/MathSolverView';
import { MathWhiteboardView } from './components/MathWhiteboardView';
import { MatrixOperatorsView } from './components/MatrixOperatorsView';
import { MatrixVisualizerView } from './components/MatrixVisualizerView';
import { NotebookView } from './components/NotebookView';
import { NumericalMethodsView } from './components/NumericalMethodsView';
import { OfflineModeView } from './components/OfflineModeView';
import { OperationsResearchView } from './components/OperationsResearchView';
import { OptimizationView } from './components/OptimizationView';
import { ProbStatsView } from './components/ProbStatsView';
import { QuestionPaperView } from './components/QuestionPaperView';
import { QuizView } from './components/QuizView';
import { ResearchWorkspaceView } from './components/ResearchWorkspaceView';
import { RivifyBrandLockup } from './components/RivifyLogo';
import { ScientificCalculatorView } from './components/ScientificCalculatorView';
import { SeriesIntegralsView } from './components/SeriesIntegralsView';
import { SettingsModal } from './components/SettingsModal';
import { SmartRevisionView } from './components/SmartRevisionView';
import { UnitConverterView } from './components/UnitConverterView';
import { VectorTheoremsView } from './components/VectorTheoremsView';
import { VirtualClassroomView } from './components/VirtualClassroomView';
import { computeGamification } from './engine/gamification';
import type { SolverMode } from './engine/solver';
import { getTranslations } from './i18n/translations';
import { dbGet, dbSet } from './storage/offlineDb';
import type {
  ActivityEvent,
  AppSettings,
  CalculatorSubTab,
  ClassroomLessonProgress,
  ExamAttempt,
  FlashcardProgress,
  HistoryItem,
  NotebookNote,
  QuizAttempt,
  RecentGraphSession,
  ResearchProject,
  SavedEquation,
  ScientificHistoryItem,
  ToolId,
  WhiteboardSession,
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
  displayName: 'RIVIFY Scholar',
};

const STORAGE_SETTINGS_KEY = 'rivify_settings_v1';
const STORAGE_HISTORY_KEY = 'rivify_history_v1';
const STORAGE_QUIZ_KEY = 'rivify_quiz_attempts_v1';
const STORAGE_ACTIVITY_KEY = 'rivify_activity_v1';
const STORAGE_FAV_FORMULAS_KEY = 'rivify_fav_formulas_v1';
const STORAGE_DAILY_KEY = 'rivify_daily_done_v1';
const STORAGE_FLASHCARDS_KEY = 'rivify_flashcards_v1';
const STORAGE_NOTEBOOK_KEY = 'rivify_notebook_v1';
const STORAGE_SCI_HISTORY_KEY = 'rivify_sci_history_v1';
const STORAGE_EXAM_ATTEMPTS_KEY = 'rivify_exam_attempts_v1';
const STORAGE_WHITEBOARDS_KEY = 'rivify_whiteboards_v1';
const STORAGE_SAVED_EQUATIONS_KEY = 'rivify_saved_equations_v1';
const STORAGE_RECENT_GRAPHS_KEY = 'rivify_recent_graphs_v1';
const STORAGE_RESEARCH_KEY = 'rivify_research_projects_v1';
const STORAGE_CLASSROOM_KEY = 'rivify_classroom_v1';

const LEGACY_KEYS = {
  settings: 'derivify_settings_v1',
  history: 'derivify_history_v1',
  quiz: 'derivify_quiz_attempts_v1',
  activity: 'derivify_activity_v1',
  favFormulas: 'derivify_fav_formulas_v1',
  daily: 'derivify_daily_done_v1',
  flashcards: 'derivify_flashcards_v1',
  notebook: 'derivify_notebook_v1',
  sciHistory: 'derivify_sci_history_v1',
  examAttempts: 'derivify_exam_attempts_v1',
  whiteboards: 'derivify_whiteboards_v1',
  savedEquations: 'derivify_saved_equations_v1',
  recentGraphs: 'derivify_recent_graphs_v1',
  research: 'derivify_research_projects_v1',
  classroom: 'derivify_classroom_v1',
} as const;

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

function loadJson<T>(key: string, fallback: T, legacyKey?: string): T {
  try {
    const raw = localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return fallback;
}

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolId>('partial-derivative');
  const [subTab, setSubTab] = useState<CalculatorSubTab>('calculator');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [reminderBanner, setReminderBanner] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadJson<Partial<AppSettings>>(STORAGE_SETTINGS_KEY, {}, LEGACY_KEYS.settings);
    const merged = { ...DEFAULT_SETTINGS, ...loaded };
    if (merged.displayName === 'Derivify Scholar') merged.displayName = 'RIVIFY Scholar';
    return merged;
  });
  const [history, setHistory] = useState<HistoryItem[]>(() =>
    loadJson<HistoryItem[]>(STORAGE_HISTORY_KEY, [], LEGACY_KEYS.history)
  );
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>(() =>
    loadJson<QuizAttempt[]>(STORAGE_QUIZ_KEY, [], LEGACY_KEYS.quiz)
  );
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(() =>
    loadJson<ActivityEvent[]>(STORAGE_ACTIVITY_KEY, [], LEGACY_KEYS.activity)
  );
  const [favoriteFormulaIds, setFavoriteFormulaIds] = useState<string[]>(() =>
    loadJson<string[]>(STORAGE_FAV_FORMULAS_KEY, [], LEGACY_KEYS.favFormulas)
  );
  const [dailyCompletedDate, setDailyCompletedDate] = useState<string | null>(() =>
    loadJson<string | null>(STORAGE_DAILY_KEY, null, LEGACY_KEYS.daily)
  );
  const [flashcardProgress, setFlashcardProgress] = useState<Record<string, FlashcardProgress>>(() =>
    loadJson<Record<string, FlashcardProgress>>(STORAGE_FLASHCARDS_KEY, {}, LEGACY_KEYS.flashcards)
  );
  const [notebookNotes, setNotebookNotes] = useState<NotebookNote[]>(() =>
    loadJson<NotebookNote[]>(STORAGE_NOTEBOOK_KEY, [], LEGACY_KEYS.notebook)
  );
  const [scientificHistory, setScientificHistory] = useState<ScientificHistoryItem[]>(() =>
    loadJson<ScientificHistoryItem[]>(STORAGE_SCI_HISTORY_KEY, [], LEGACY_KEYS.sciHistory)
  );
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>(() =>
    loadJson<ExamAttempt[]>(STORAGE_EXAM_ATTEMPTS_KEY, [], LEGACY_KEYS.examAttempts)
  );
  const [whiteboards, setWhiteboards] = useState<WhiteboardSession[]>(() =>
    loadJson<WhiteboardSession[]>(STORAGE_WHITEBOARDS_KEY, [], LEGACY_KEYS.whiteboards)
  );
  const [savedEquations, setSavedEquations] = useState<SavedEquation[]>(() =>
    loadJson<SavedEquation[]>(STORAGE_SAVED_EQUATIONS_KEY, [], LEGACY_KEYS.savedEquations)
  );
  const [recentGraphs, setRecentGraphs] = useState<RecentGraphSession[]>(() =>
    loadJson<RecentGraphSession[]>(STORAGE_RECENT_GRAPHS_KEY, [], LEGACY_KEYS.recentGraphs)
  );
  const [researchProjects, setResearchProjects] = useState<ResearchProject[]>(() =>
    loadJson<ResearchProject[]>(STORAGE_RESEARCH_KEY, [], LEGACY_KEYS.research)
  );
  const [classroomProgress, setClassroomProgress] = useState<
    Record<string, ClassroomLessonProgress>
  >(() => loadJson<Record<string, ClassroomLessonProgress>>(STORAGE_CLASSROOM_KEY, {}, LEGACY_KEYS.classroom));

  const hydratedRef = useRef(false);
  const lastReminderDateRef = useRef<string | null>(null);

  const [quizJumpLevel, setQuizJumpLevel] = useState<1 | 2 | 3 | 4 | null>(null);

  const [externalLoad, setExternalLoad] = useState<{
    tool: CalcToolId;
    expr: string;
    secondary?: string;
    nonce: number;
  } | null>(null);
  const [externalSolver, setExternalSolver] = useState<{
    expr: string;
    mode?: SolverMode;
    nonce: number;
  } | null>(null);
  const [externalGraph, setExternalGraph] = useState<{
    expr: string;
    nonce: number;
  } | null>(null);
  const [externalScientific, setExternalScientific] = useState<{
    expr: string;
    nonce: number;
  } | null>(null);
  const [externalExport, setExternalExport] = useState<{
    heading: string;
    plainText: string;
    latex?: string;
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
    const [h, q, a, f, d, fc, nb, sci, ex, wb, eq, rg, rp, cp] = await Promise.all([
      dbGet<HistoryItem[]>(STORAGE_HISTORY_KEY, [], LEGACY_KEYS.history),
      dbGet<QuizAttempt[]>(STORAGE_QUIZ_KEY, [], LEGACY_KEYS.quiz),
      dbGet<ActivityEvent[]>(STORAGE_ACTIVITY_KEY, [], LEGACY_KEYS.activity),
      dbGet<string[]>(STORAGE_FAV_FORMULAS_KEY, [], LEGACY_KEYS.favFormulas),
      dbGet<string | null>(STORAGE_DAILY_KEY, null, LEGACY_KEYS.daily),
      dbGet<Record<string, FlashcardProgress>>(STORAGE_FLASHCARDS_KEY, {}, LEGACY_KEYS.flashcards),
      dbGet<NotebookNote[]>(STORAGE_NOTEBOOK_KEY, [], LEGACY_KEYS.notebook),
      dbGet<ScientificHistoryItem[]>(STORAGE_SCI_HISTORY_KEY, [], LEGACY_KEYS.sciHistory),
      dbGet<ExamAttempt[]>(STORAGE_EXAM_ATTEMPTS_KEY, [], LEGACY_KEYS.examAttempts),
      dbGet<WhiteboardSession[]>(STORAGE_WHITEBOARDS_KEY, [], LEGACY_KEYS.whiteboards),
      dbGet<SavedEquation[]>(STORAGE_SAVED_EQUATIONS_KEY, [], LEGACY_KEYS.savedEquations),
      dbGet<RecentGraphSession[]>(STORAGE_RECENT_GRAPHS_KEY, [], LEGACY_KEYS.recentGraphs),
      dbGet<ResearchProject[]>(STORAGE_RESEARCH_KEY, [], LEGACY_KEYS.research),
      dbGet<Record<string, ClassroomLessonProgress>>(STORAGE_CLASSROOM_KEY, {}, LEGACY_KEYS.classroom),
    ]);
    setHistory(h);
    setQuizAttempts(q);
    setActivityEvents(a);
    setFavoriteFormulaIds(f);
    setDailyCompletedDate(d);
    setFlashcardProgress(fc);
    setNotebookNotes(nb);
    setScientificHistory(sci);
    setExamAttempts(ex);
    setWhiteboards(wb);
    setSavedEquations(eq);
    setRecentGraphs(rg);
    setResearchProjects(rp);
    setClassroomProgress(cp);
  };

  // Hydrate offline IndexedDB on mount
  useEffect(() => {
    let active = true;
    async function hydrate() {
      const s = await dbGet<AppSettings>(STORAGE_SETTINGS_KEY, DEFAULT_SETTINGS, LEGACY_KEYS.settings);
      if (!active) return;
      const mergedSettings = { ...DEFAULT_SETTINGS, ...s };
      if (mergedSettings.displayName === 'Derivify Scholar') {
        mergedSettings.displayName = 'RIVIFY Scholar';
      }
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
        setScientificHistory([]);
        setExamAttempts([]);
        setWhiteboards([]);
        setSavedEquations([]);
        setRecentGraphs([]);
        setResearchProjects([]);
        setClassroomProgress({});
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

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_SCI_HISTORY_KEY, scientificHistory);
    }
  }, [scientificHistory, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_EXAM_ATTEMPTS_KEY, examAttempts);
    }
  }, [examAttempts, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_WHITEBOARDS_KEY, whiteboards);
    }
  }, [whiteboards, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_SAVED_EQUATIONS_KEY, savedEquations);
    }
  }, [savedEquations, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_RECENT_GRAPHS_KEY, recentGraphs);
    }
  }, [recentGraphs, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_RESEARCH_KEY, researchProjects);
    }
  }, [researchProjects, settings.guestMode]);

  useEffect(() => {
    if (hydratedRef.current && !settings.guestMode) {
      void dbSet(STORAGE_CLASSROOM_KEY, classroomProgress);
    }
  }, [classroomProgress, settings.guestMode]);

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
      setScientificHistory([]);
      setExamAttempts([]);
      setWhiteboards([]);
      setSavedEquations([]);
      setRecentGraphs([]);
      setResearchProjects([]);
      setClassroomProgress({});
    } else if (wasGuest && !next.guestMode) {
      // Exiting Guest Mode: restore saved profile from IndexedDB
      await loadPersistedProfile();
    }
  };

  // Daily study reminder scheduler
  const fireStudyReminder = async (isTest = false): Promise<string> => {
    const title = 'RIVIFY Study Reminder';
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
    version: 3,
    exportedAt: new Date().toISOString(),
    settings,
    history,
    quizAttempts,
    activityEvents,
    favoriteFormulaIds,
    dailyCompletedDate,
    flashcardProgress,
    notebookNotes,
    scientificHistory,
    examAttempts,
    whiteboards,
    savedEquations,
    recentGraphs,
    researchProjects,
    classroomProgress,
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
    if (Array.isArray(data.scientificHistory)) {
      setScientificHistory(data.scientificHistory as ScientificHistoryItem[]);
    }
    if (Array.isArray(data.examAttempts)) setExamAttempts(data.examAttempts as ExamAttempt[]);
    if (Array.isArray(data.whiteboards)) setWhiteboards(data.whiteboards as WhiteboardSession[]);
    if (Array.isArray(data.savedEquations)) setSavedEquations(data.savedEquations as SavedEquation[]);
    if (Array.isArray(data.recentGraphs)) setRecentGraphs(data.recentGraphs as RecentGraphSession[]);
    if (Array.isArray(data.researchProjects)) setResearchProjects(data.researchProjects as ResearchProject[]);
    if (data.classroomProgress && typeof data.classroomProgress === 'object') {
      setClassroomProgress(data.classroomProgress as Record<string, ClassroomLessonProgress>);
    }
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
    a.download = `rivify-backup-${new Date().toISOString().slice(0, 10)}.json`;
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

  const handleSaveAdvancedNote = (note: { title: string; topic: string; content: string }) => {
    handleCreateNote(note);
    recordActivity('calculation', note.topic);
  };

  const handleSendToSolver = (expression: string, mode?: SolverMode) => {
    setExternalSolver({ expr: expression, mode, nonce: Date.now() });
    setActiveTool('math-solver');
  };

  const handleSendToGraph = (expression: string) => {
    setExternalGraph({ expr: expression, nonce: Date.now() });
    setActiveTool('graphing-calculator');
  };

  const handleSendToScientific = (expression: string) => {
    setExternalScientific({ expr: expression, nonce: Date.now() });
    setActiveTool('scientific-calculator');
  };

  const handleSendToExport = (item: { heading: string; plainText: string; latex?: string }) => {
    setExternalExport({ ...item, nonce: Date.now() });
    setActiveTool('export-studio');
  };

  const handleRecordGraphSession = (session: RecentGraphSession) => {
    setRecentGraphs((prev) => {
      const filtered = prev.filter((g) => g.id !== session.id);
      return [session, ...filtered].slice(0, 12);
    });
  };

  const topBarTitle =
    activeTool === 'quiz'
      ? t.calculusQuiz
      : activeTool === 'calculus-lab'
      ? t.calculusLab
      : activeTool === 'scientific-calculator'
      ? t.scientificCalculator
      : activeTool === 'graphing-calculator'
      ? t.graphingCalculator
      : activeTool === 'math-solver'
      ? t.mathSolver
      : activeTool === 'math-scanner'
      ? t.mathScanner
      : activeTool === 'differential-equations'
      ? t.differentialEquations
      : activeTool === 'linear-algebra'
      ? t.linearAlgebra
      : activeTool === 'numerical-methods'
      ? t.numericalMethods
      : activeTool === 'probability-statistics'
      ? t.probabilityStatistics
      : activeTool === 'complex-numbers'
      ? t.complexNumbers
      : activeTool === 'discrete-math'
      ? t.discreteMath
      : activeTool === 'fourier-laplace'
      ? t.fourierLaplace
      : activeTool === 'advanced-geometry'
      ? t.advancedGeometry
      : activeTool === 'operations-research'
      ? t.operationsResearch
      : activeTool === 'math-whiteboard'
      ? t.mathWhiteboard
      : activeTool === 'equation-editor'
      ? t.equationEditor
      : activeTool === 'formula-derivation'
      ? t.formulaDerivation
      : activeTool === 'graph-animation'
      ? t.graphAnimation
      : activeTool === 'smart-revision'
      ? t.smartRevision
      : activeTool === 'virtual-classroom'
      ? t.virtualClassroom
      : activeTool === 'question-paper'
      ? t.questionPaper
      : activeTool === 'research-workspace'
      ? t.researchWorkspace
      : activeTool === 'unit-converter'
      ? t.unitConverter
      : activeTool === 'matrix-visualizer'
      ? t.matrixVisualizer
      : activeTool === 'math-history'
      ? t.mathHistory
      : activeTool === 'offline-mode'
      ? t.offlineMode
      : activeTool === 'exam-prep'
      ? t.examPrep
      : activeTool === 'export-studio'
      ? t.exportStudio
      : activeTool === 'limits-continuity'
      ? t.limitsContinuity
      : activeTool === 'optimization-lab'
      ? t.optimizationLab
      : activeTool === 'vector-theorems'
      ? t.vectorTheorems
      : activeTool === 'matrix-operators'
      ? t.matrixOperators
      : activeTool === 'series-integrals'
      ? t.seriesIntegrals
      : activeTool === 'notebook'
      ? t.notebook
      : activeTool === 'flashcards'
      ? t.flashcards
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
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200 dark:border-white/10">
        <RivifyBrandLockup showTagline onClick={() => handleSelectTool('dashboard')} />
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close toolkit menu"
          className="lg:hidden min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5" aria-label={t.toolkit}>
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

        <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Calculators &amp; Solvers
        </div>

        <button
          type="button"
          onClick={() => handleSelectTool('scientific-calculator')}
          className={`w-full min-h-[42px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'scientific-calculator'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Calculator className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.scientificCalculator}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTool('math-solver')}
          className={`w-full min-h-[42px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'math-solver'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.mathSolver}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTool('graphing-calculator')}
          className={`w-full min-h-[42px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'graphing-calculator'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <LineChart className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.graphingCalculator}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTool('calculus-lab')}
          className={`w-full min-h-[42px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'calculus-lab'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Layers className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.calculusLab}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTool('math-scanner')}
          className={`w-full min-h-[42px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
            activeTool === 'math-scanner'
              ? 'bg-[#2F7CF6] text-white'
              : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <ScanLine className="w-4.5 h-4.5 shrink-0" />
          <span className="truncate">{t.mathScanner}</span>
        </button>

        <div className="my-2 border-t border-slate-200 dark:border-white/10" />
        <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Engineering Math Labs
        </div>

        {(
          [
            { id: 'differential-equations', label: t.differentialEquations, icon: GitBranch },
            { id: 'linear-algebra', label: t.linearAlgebra, icon: Grid3X3 },
            { id: 'numerical-methods', label: t.numericalMethods, icon: Binary },
            { id: 'probability-statistics', label: t.probabilityStatistics, icon: BarChart2 },
            { id: 'complex-numbers', label: t.complexNumbers, icon: Compass },
            { id: 'discrete-math', label: t.discreteMath, icon: Network },
            { id: 'fourier-laplace', label: t.fourierLaplace, icon: Activity },
            { id: 'advanced-geometry', label: t.advancedGeometry, icon: Compass },
            { id: 'operations-research', label: t.operationsResearch, icon: Sliders },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const isActive = activeTool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTool(item.id)}
              className={`w-full min-h-[42px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
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

        <div className="my-2 border-t border-slate-200 dark:border-white/10" />
        <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Multivariable Calculus
        </div>

        {/* 6 Core Multivariable Tools */}
        {localizedCalcTools.map((item) => {
          const Icon = item.icon;
          const isActive = activeTool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTool(item.id)}
              className={`w-full min-h-[42px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
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

        {/* University Calculus Modules */}
        {(
          [
            { id: 'limits-continuity', label: t.limitsContinuity, icon: GitFork },
            { id: 'optimization-lab', label: t.optimizationLab, icon: Scale },
            { id: 'vector-theorems', label: t.vectorTheorems, icon: Orbit },
            { id: 'matrix-operators', label: t.matrixOperators, icon: Grid3X3 },
            { id: 'series-integrals', label: t.seriesIntegrals, icon: Sigma },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const isActive = activeTool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTool(item.id)}
              className={`w-full min-h-[42px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
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

        <div className="my-2 border-t border-slate-200 dark:border-white/10" />
        <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Interactive Workspace
        </div>

        {(
          [
            { id: 'math-whiteboard', label: t.mathWhiteboard, icon: PenTool },
            { id: 'equation-editor', label: t.equationEditor, icon: Sigma },
            { id: 'formula-derivation', label: t.formulaDerivation, icon: GitCompare },
            { id: 'graph-animation', label: t.graphAnimation, icon: Film },
            { id: 'matrix-visualizer', label: t.matrixVisualizer, icon: Grid3X3 },
            { id: 'unit-converter', label: t.unitConverter, icon: Ruler },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const isActive = activeTool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTool(item.id)}
              className={`w-full min-h-[42px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#2F7CF6] text-white'
                  : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="my-2 border-t border-slate-200 dark:border-white/10" />
        <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Learning, Research &amp; Utilities
        </div>

        {(
          [
            { id: 'virtual-classroom', label: t.virtualClassroom, icon: GraduationCap },
            { id: 'smart-revision', label: t.smartRevision, icon: Brain },
            { id: 'exam-prep', label: t.examPrep, icon: GraduationCap },
            { id: 'question-paper', label: t.questionPaper, icon: FileText },
            { id: 'research-workspace', label: t.researchWorkspace, icon: FolderKanban },
            { id: 'flashcards', label: t.flashcards, icon: Brain },
            { id: 'notebook', label: t.notebook, icon: BookMarked },
            { id: 'math-history', label: t.mathHistory, icon: History },
            { id: 'export-studio', label: t.exportStudio, icon: FileOutput },
            { id: 'dashboard', label: t.dashboard, icon: BarChart3 },
            { id: 'formula-sheet', label: t.formulaLibrary, icon: BookOpen },
            { id: 'offline-mode', label: t.offlineMode, icon: HardDriveDownload },
            { id: 'about', label: t.aboutDeveloper, icon: User },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const isActive = activeTool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTool(item.id)}
              className={`w-full min-h-[42px] px-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#2F7CF6] text-white'
                  : 'text-slate-700 dark:text-[#CAC4D0] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
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
                aria-label="Open RIVIFY navigation menu"
                className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <RivifyBrandLockup compact onClick={() => handleSelectTool('dashboard')} />
              <span
                className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/15 shrink-0"
                aria-hidden="true"
              />
              <h1 className="hidden sm:block text-base font-medium font-display text-slate-900 dark:text-white truncate">
                {topBarTitle}
              </h1>
              {activeToolMeta && (
                <span className="hidden md:inline-block text-xs text-slate-500 dark:text-slate-300/80 truncate">
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
                  onSaveToNotebook={(note) => {
                    handleCreateNote(note);
                  }}
                  externalLoad={externalLoad}
                />
              )}

              {activeTool === 'scientific-calculator' && (
                <ScientificCalculatorView
                  settings={settings}
                  history={scientificHistory}
                  externalExpr={externalScientific}
                  onSaveResult={(item) => {
                    setScientificHistory((prev) => [item, ...prev].slice(0, 60));
                    recordActivity('calculation', 'Scientific Calculator');
                  }}
                  onClearHistory={() => setScientificHistory([])}
                  onSendToSolver={(exprText) => handleSendToSolver(exprText)}
                  onSendToGraph={(exprText) => handleSendToGraph(exprText)}
                  onSaveToNotebook={handleSaveAdvancedNote}
                  onSendToExport={handleSendToExport}
                />
              )}

              {activeTool === 'math-solver' && (
                <MathSolverView
                  settings={settings}
                  externalInput={externalSolver}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'graphing-calculator' && (
                <GraphingCalculatorView
                  settings={settings}
                  externalGraph={externalGraph}
                  onRecordGraphSession={handleRecordGraphSession}
                />
              )}

              {activeTool === 'math-scanner' && (
                <MathScannerView
                  onSendToSolver={(exprText) => handleSendToSolver(exprText)}
                  onSendToGraph={(exprText) => handleSendToGraph(exprText)}
                  onSendToScientific={(exprText) => handleSendToScientific(exprText)}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'differential-equations' && (
                <DifferentialEquationsView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'linear-algebra' && (
                <LinearAlgebraView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'numerical-methods' && (
                <NumericalMethodsView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'probability-statistics' && (
                <ProbStatsView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'complex-numbers' && (
                <ComplexNumbersView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'discrete-math' && (
                <DiscreteMathView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'fourier-laplace' && (
                <FourierLaplaceView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'advanced-geometry' && (
                <AdvancedGeometryView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'operations-research' && (
                <OperationsResearchView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'math-whiteboard' && (
                <MathWhiteboardView
                  settings={settings}
                  sessions={whiteboards}
                  onSaveSession={(sess) => {
                    setWhiteboards((prev) => {
                      const exists = prev.some((x) => x.id === sess.id);
                      return exists
                        ? prev.map((x) => (x.id === sess.id ? sess : x))
                        : [sess, ...prev];
                    });
                    recordActivity('calculation', 'Math Whiteboard');
                  }}
                  onDeleteSession={(id) =>
                    setWhiteboards((prev) => prev.filter((x) => x.id !== id))
                  }
                />
              )}

              {activeTool === 'equation-editor' && (
                <EquationEditorView
                  settings={settings}
                  savedEquations={savedEquations}
                  onSaveEquation={(eq) => {
                    setSavedEquations((prev) => [eq, ...prev].slice(0, 60));
                    recordActivity('calculation', 'Equation Editor');
                  }}
                  onDeleteEquation={(id) =>
                    setSavedEquations((prev) => prev.filter((x) => x.id !== id))
                  }
                  onSaveToNotebook={handleSaveAdvancedNote}
                  onSendToExport={handleSendToExport}
                />
              )}

              {activeTool === 'formula-derivation' && (
                <FormulaDerivationView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                  onSendToExport={handleSendToExport}
                />
              )}

              {activeTool === 'graph-animation' && (
                <GraphAnimationView
                  settings={settings}
                  onRecordGraphSession={handleRecordGraphSession}
                />
              )}

              {activeTool === 'smart-revision' && (
                <SmartRevisionView
                  settings={settings}
                  flashcardProgress={flashcardProgress}
                  quizAttempts={quizAttempts}
                  examAttempts={examAttempts}
                  onRateCard={handleRateFlashcard}
                  onOpenFlashcards={() => setActiveTool('flashcards')}
                  onPracticeLevel={(lvl) => {
                    setQuizJumpLevel(lvl);
                    setActiveTool('quiz');
                  }}
                  onUpdateReminder={(enabled, time) =>
                    void handleSettingsChange({
                      ...settings,
                      reminderEnabled: enabled,
                      reminderTime: time,
                    })
                  }
                />
              )}

              {activeTool === 'virtual-classroom' && (
                <VirtualClassroomView
                  settings={settings}
                  progressMap={classroomProgress}
                  onUpdateProgress={(lessonId, prog) => {
                    setClassroomProgress((prev) => ({ ...prev, [lessonId]: prog }));
                    recordActivity('quiz', 'Virtual Classroom');
                  }}
                />
              )}

              {activeTool === 'question-paper' && (
                <QuestionPaperView authorName={settings.displayName} />
              )}

              {activeTool === 'research-workspace' && (
                <ResearchWorkspaceView
                  authorName={settings.displayName}
                  projects={researchProjects}
                  history={history}
                  recentGraphs={recentGraphs}
                  onSaveProject={(proj) => {
                    setResearchProjects((prev) => {
                      const exists = prev.some((x) => x.id === proj.id);
                      return exists
                        ? prev.map((x) => (x.id === proj.id ? proj : x))
                        : [proj, ...prev];
                    });
                  }}
                  onDeleteProject={(id) =>
                    setResearchProjects((prev) => prev.filter((x) => x.id !== id))
                  }
                />
              )}

              {activeTool === 'unit-converter' && <UnitConverterView />}

              {activeTool === 'matrix-visualizer' && (
                <MatrixVisualizerView settings={settings} />
              )}

              {activeTool === 'math-history' && (
                <MathHistoryView
                  history={history}
                  scientificHistory={scientificHistory}
                  onReopenSymbolic={(item) => {
                    setActiveTool(item.tool);
                    setSubTab('calculator');
                    setExternalLoad({
                      tool: item.tool,
                      expr: item.expression,
                      secondary: item.secondaryInput,
                      nonce: Date.now(),
                    });
                  }}
                  onSendToSolver={(exprText) => handleSendToSolver(exprText)}
                  onToggleBookmark={handleToggleBookmark}
                  onDeleteSymbolic={handleDeleteHistory}
                  onClearScientific={() => setScientificHistory([])}
                />
              )}

              {activeTool === 'offline-mode' && (
                <OfflineModeView
                  isOnline={isOnline}
                  onExportBackup={handleExportBackup}
                  onCloudPush={handleCloudPush}
                  localCounts={{
                    calculations: history.length + scientificHistory.length,
                    notes: notebookNotes.length,
                    whiteboards: whiteboards.length,
                    equations: savedEquations.length,
                    researchProjects: researchProjects.length,
                  }}
                />
              )}

              {activeTool === 'exam-prep' && (
                <ExamPrepView
                  examAttempts={examAttempts}
                  onRecordExamAttempt={(att) => {
                    setExamAttempts((prev) => [att, ...prev].slice(0, 40));
                    recordActivity('mock', att.topic);
                  }}
                />
              )}

              {activeTool === 'export-studio' && (
                <ExportStudioView
                  authorName={settings.displayName}
                  history={history}
                  scientificHistory={scientificHistory}
                  notes={notebookNotes}
                  examAttempts={examAttempts}
                  externalItem={externalExport}
                />
              )}

              {activeTool === 'limits-continuity' && (
                <LimitsContinuityView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'optimization-lab' && (
                <OptimizationView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'vector-theorems' && (
                <VectorTheoremsView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'matrix-operators' && (
                <MatrixOperatorsView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
                />
              )}

              {activeTool === 'series-integrals' && (
                <SeriesIntegralsView
                  settings={settings}
                  onSaveToNotebook={handleSaveAdvancedNote}
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

              {activeTool === 'dashboard' && (
                <DashboardView
                  history={history}
                  scientificHistory={scientificHistory}
                  examAttempts={examAttempts}
                  quizAttempts={quizAttempts}
                  activityEvents={activityEvents}
                  favoriteFormulaIds={favoriteFormulaIds}
                  flashcardProgress={flashcardProgress}
                  whiteboards={whiteboards}
                  researchProjects={researchProjects}
                  recentGraphs={recentGraphs}
                  savedEquations={savedEquations}
                  classroomProgress={classroomProgress}
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
                  onOpenTool={(tool) => handleSelectTool(tool)}
                  onReopenCalculation={(item) => {
                    setActiveTool(item.tool);
                    setSubTab('calculator');
                    setExternalLoad({
                      tool: item.tool,
                      expr: item.expression,
                      secondary: item.secondaryInput,
                      nonce: Date.now(),
                    });
                  }}
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

          <footer
            className={`border-t border-slate-200 dark:border-white/10 bg-white/70 dark:bg-[#0E1015]/90 px-4 sm:px-6 lg:px-8 py-4 ${
              isCalcTool(activeTool) ? 'pb-20 md:pb-4' : ''
            }`}
          >
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <RivifyBrandLockup compact onClick={() => handleSelectTool('dashboard')} />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Explore. Calculate. Master.
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => handleSelectTool('dashboard')}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Dashboard
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => handleSelectTool('about')}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  About RIVIFY
                </button>
              </div>
            </div>
          </footer>

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
