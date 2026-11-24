export type ToolId =
  | 'partial-derivative'
  | 'gradient'
  | 'directional-derivative'
  | 'maxima-minima'
  | 'linear-approximation'
  | 'vector-field'
  | 'matrix-operators'
  | 'series-integrals'
  | 'calculus-lab'
  | 'quiz'
  | 'flashcards'
  | 'notebook'
  | 'arena'
  | 'assistant'
  | 'dashboard'
  | 'formula-sheet'
  | 'about';

export type CalculatorSubTab = 'calculator' | 'history' | 'graph';

export type AngleUnit = 'rad' | 'deg';

export type AppLanguage = 'en' | 'hi';

export interface AppSettings {
  theme: 'dark' | 'light';
  angleUnit: AngleUnit;
  precision: 2 | 4 | 6;
  autoExpandSteps: boolean;
  dailyGoal: number;
  hapticsEnabled: boolean;
  language: AppLanguage;
  reminderEnabled: boolean;
  reminderTime: string; // HH:MM
  guestMode: boolean;
  displayName: string;
}

export interface DerivationStep {
  id: string;
  rule: string;
  description: string;
  latex: string;
}

export interface HistoryItem {
  id: string;
  tool: Exclude<
    ToolId,
    | 'matrix-operators'
    | 'series-integrals'
    | 'calculus-lab'
    | 'quiz'
    | 'flashcards'
    | 'notebook'
    | 'arena'
    | 'assistant'
    | 'dashboard'
    | 'formula-sheet'
    | 'about'
  >;
  toolLabel: string;
  expression: string;
  secondaryInput?: string;
  resultLatex: string;
  resultPlain: string;
  steps?: DerivationStep[];
  timestamp: number;
  bookmarked?: boolean;
  payload: Record<string, string | number>;
}

export interface QuizQuestion {
  id: string;
  level: 1 | 2 | 3 | 4;
  levelName: string;
  category: string;
  prompt: string;
  expressionLatex: string;
  optionsLatex: string[];
  correctIndex: number;
  explanationLatex: string;
  isGenerated?: boolean;
}

export interface QuizAttempt {
  id: string;
  questionId: string;
  category: string;
  level: 1 | 2 | 3 | 4;
  correct: boolean;
  isDailyChallenge?: boolean;
  isMockTest?: boolean;
  timestamp: number;
}

export interface ActivityEvent {
  id: string;
  dateKey: string; // YYYY-MM-DD
  kind: 'calculation' | 'quiz' | 'daily' | 'flashcard' | 'mock';
  topic: string;
  timestamp: number;
}

export interface FlashcardProgress {
  formulaId: string;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: number;
  lastQuality: 1 | 2 | 3 | 4;
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  progressText: string;
}

export interface LearningPathStep {
  id: string;
  topic: string;
  reason: string;
  priority: 'Focus Area' | 'Next Step' | 'Mastery';
  recommendedAction: 'practice' | 'flashcards' | 'calculator';
  level?: 1 | 2 | 3 | 4;
}

export interface NotebookNote {
  id: string;
  title: string;
  topic: string;
  content: string;
  pinned?: boolean;
  updatedAt: number;
  createdAt: number;
}

export interface LeaderboardEntry {
  id: string;
  displayName: string;
  weekKey: string;
  xp: number;
  accuracy: number;
  problemsSolved: number;
  streak: number;
  updatedAt: number;
}

export interface ChallengeSubmission {
  playerName: string;
  score: number;
  total: number;
  elapsedSeconds: number;
  submittedAt: number;
}

export interface ChallengeRoom {
  code: string;
  creatorName: string;
  topic: string;
  seed: number;
  questionCount: number;
  createdAt: number;
  submissions: ChallengeSubmission[];
}
