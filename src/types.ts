export type ToolId =
  | 'partial-derivative'
  | 'gradient'
  | 'directional-derivative'
  | 'maxima-minima'
  | 'linear-approximation'
  | 'vector-field'
  | 'limits-continuity'
  | 'optimization-lab'
  | 'vector-theorems'
  | 'matrix-operators'
  | 'series-integrals'
  | 'calculus-lab'
  | 'math-solver'
  | 'graphing-calculator'
  | 'scientific-calculator'
  | 'differential-equations'
  | 'linear-algebra'
  | 'numerical-methods'
  | 'probability-statistics'
  | 'complex-numbers'
  | 'math-scanner'
  | 'exam-prep'
  | 'export-studio'
  | 'discrete-math'
  | 'fourier-laplace'
  | 'advanced-geometry'
  | 'operations-research'
  | 'math-whiteboard'
  | 'equation-editor'
  | 'formula-derivation'
  | 'graph-animation'
  | 'smart-revision'
  | 'virtual-classroom'
  | 'question-paper'
  | 'research-workspace'
  | 'unit-converter'
  | 'matrix-visualizer'
  | 'math-history'
  | 'offline-mode'
  | 'quiz'
  | 'flashcards'
  | 'notebook'
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

export type CoreCalcToolId =
  | 'partial-derivative'
  | 'gradient'
  | 'directional-derivative'
  | 'maxima-minima'
  | 'linear-approximation'
  | 'vector-field';

export interface HistoryItem {
  id: string;
  tool: CoreCalcToolId;
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
  difficultyTier?: 'Beginner' | 'Intermediate' | 'Advanced';
  questionType?: 'mcq' | 'short-answer';
  category: string;
  prompt: string;
  expressionLatex: string;
  optionsLatex: string[];
  correctIndex: number;
  acceptedAnswers?: string[];
  numericAnswer?: number;
  tolerance?: number;
  answerHint?: string;
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
  userResponse?: string;
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

export interface ScientificHistoryItem {
  id: string;
  expression: string;
  result: string;
  numericValue: number;
  angleUnit: AngleUnit;
  timestamp: number;
}

export interface ExamQuestion {
  id: string;
  topic: string;
  examStyle: 'topic' | 'mock' | 'aktu';
  sectionLabel: string; // e.g., "Section A · 2 Marks" or "Core Concept"
  marks: number;
  questionType: 'mcq' | 'numerical';
  prompt: string;
  expressionLatex: string;
  optionsLatex?: string[];
  correctIndex?: number;
  numericAnswer?: number;
  tolerance?: number;
  answerHint?: string;
  explanationLatex: string;
  sourceLabel: string; // Explicit sample label, never fake PYQ claim
}

export interface ExamAttempt {
  id: string;
  mode: 'topic' | 'mock' | 'aktu';
  title: string;
  topic: string;
  totalQuestions: number;
  correctCount: number;
  scoreMarks: number;
  maxMarks: number;
  durationSeconds: number;
  timestamp: number;
  topicBreakdown: Record<string, { total: number; correct: number }>;
}

export interface WhiteboardAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  isLatex: boolean;
  color: string;
}

export interface WhiteboardSession {
  id: string;
  title: string;
  background: 'slate' | 'white' | 'grid' | 'blueprint';
  dataUrl: string;
  actionsJson: string;
  annotations: WhiteboardAnnotation[];
  createdAt: number;
  updatedAt: number;
}

export interface SavedEquation {
  id: string;
  title: string;
  latex: string;
  category: string;
  updatedAt: number;
}

export interface RecentGraphSession {
  id: string;
  title: string;
  sourceTool: string;
  expression: string;
  secondary?: string;
  timestamp: number;
}

export interface ResearchAttachment {
  id: string;
  label: string;
  kind: 'calculation' | 'graph' | 'derivation';
  summary: string;
  latex?: string;
}

export interface ResearchProject {
  id: string;
  title: string;
  domain: string;
  abstract: string;
  formulas: { id: string; label: string; latex: string }[];
  attachments: ResearchAttachment[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClassroomLessonProgress {
  completed: boolean;
  quizScore?: number;
  lastViewedAt: number;
}

