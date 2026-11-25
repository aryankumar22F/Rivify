import type {
  AchievementBadge,
  ActivityEvent,
  FlashcardProgress,
  HistoryItem,
  LearningPathStep,
  QuizAttempt,
} from '../types';

export interface GamificationSummary {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreak: number;
  todaySolved: number;
  badges: AchievementBadge[];
  learningPath: LearningPathStep[];
}

export function computeStreak(events: ActivityEvent[]): number {
  const uniqueDates = Array.from(new Set(events.map((e) => e.dateKey))).sort().reverse();
  if (uniqueDates.length === 0) return 0;

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const yestKey = yest.toISOString().slice(0, 10);

  if (uniqueDates[0] !== todayKey && uniqueDates[0] !== yestKey) {
    return 0;
  }

  let streak = 1;
  let cursor = new Date(`${uniqueDates[0]}T00:00:00`);
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(cursor);
    prev.setDate(cursor.getDate() - 1);
    const expected = prev.toISOString().slice(0, 10);
    if (uniqueDates[i] === expected) {
      streak += 1;
      cursor = prev;
    } else {
      break;
    }
  }
  return streak;
}

export function computeGamification(
  history: HistoryItem[],
  quizAttempts: QuizAttempt[],
  activityEvents: ActivityEvent[],
  flashcards: Record<string, FlashcardProgress>
): GamificationSummary {
  const calcCount = history.length;
  const correctQuiz = quizAttempts.filter((a) => a.correct).length;
  const wrongQuiz = quizAttempts.length - correctQuiz;
  const dailyCount = activityEvents.filter((e) => e.kind === 'daily').length;
  const flashCount = activityEvents.filter((e) => e.kind === 'flashcard').length;
  const mockCount = activityEvents.filter((e) => e.kind === 'mock').length;

  const xp =
    calcCount * 15 +
    correctQuiz * 20 +
    wrongQuiz * 5 +
    dailyCount * 35 +
    flashCount * 10 +
    mockCount * 40;

  const xpPerLevel = 150;
  const level = Math.floor(xp / xpPerLevel) + 1;
  const xpIntoLevel = xp % xpPerLevel;
  const xpForNextLevel = xpPerLevel;

  const currentStreak = computeStreak(activityEvents);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySolved = activityEvents.filter((e) => e.dateKey === todayKey).length;

  const masteredCards = Object.values(flashcards).filter((c) => c.repetitions >= 2).length;
  const distinctTools = new Set(history.map((h) => h.tool)).size;

  const badges: AchievementBadge[] = [
    {
      id: 'b-first-calc',
      title: 'Symbolic Explorer',
      description: 'Run 5 symbolic multivariable calculations',
      earned: calcCount >= 5,
      progressText: `${Math.min(calcCount, 5)} / 5 calculations`,
    },
    {
      id: 'b-toolkit',
      title: 'Full Toolkit',
      description: 'Use at least 4 different calculus tools',
      earned: distinctTools >= 4,
      progressText: `${Math.min(distinctTools, 4)} / 4 tools`,
    },
    {
      id: 'b-quiz-pro',
      title: 'Derivation Ace',
      description: 'Answer 15 quiz questions correctly',
      earned: correctQuiz >= 15,
      progressText: `${Math.min(correctQuiz, 15)} / 15 correct`,
    },
    {
      id: 'b-streak',
      title: 'Consistent Scholar',
      description: 'Maintain a 3-day learning streak',
      earned: currentStreak >= 3,
      progressText: `${Math.min(currentStreak, 3)} / 3 days`,
    },
    {
      id: 'b-flashcards',
      title: 'Spaced Memory',
      description: 'Review and retain 5 formula flashcards (2+ reps)',
      earned: masteredCards >= 5,
      progressText: `${Math.min(masteredCards, 5)} / 5 cards`,
    },
    {
      id: 'b-daily',
      title: 'Daily Challenger',
      description: 'Complete a Daily Calculus Challenge',
      earned: dailyCount >= 1,
      progressText: `${Math.min(dailyCount, 1)} / 1 completed`,
    },
  ];

  // Personalized Learning Path based on actual quiz topic accuracy
  const topicStats = new Map<string, { total: number; correct: number }>();
  for (const a of quizAttempts) {
    const cur = topicStats.get(a.category) ?? { total: 0, correct: 0 };
    cur.total += 1;
    if (a.correct) cur.correct += 1;
    topicStats.set(a.category, cur);
  }

  const curriculum: { topic: string; level: 1 | 2 | 3 | 4 }[] = [
    { topic: 'Partial Derivative', level: 1 },
    { topic: 'Limits & Continuity', level: 2 },
    { topic: 'Gradient', level: 3 },
    { topic: 'Directional Derivative', level: 3 },
    { topic: 'Linear Approximation', level: 3 },
    { topic: 'Integration', level: 2 },
    { topic: 'Maxima & Minima', level: 4 },
    { topic: 'Optimization', level: 4 },
    { topic: 'Vector Field', level: 4 },
    { topic: 'Vector Theorems', level: 4 },
    { topic: 'Linear Algebra', level: 3 },
  ];

  const learningPath: LearningPathStep[] = [];

  // 1. Weak topics (< 75% accuracy)
  for (const item of curriculum) {
    const st = topicStats.get(item.topic);
    if (st && st.total > 0) {
      const acc = Math.round((st.correct / st.total) * 100);
      if (acc < 75) {
        learningPath.push({
          id: `lp-weak-${item.topic}`,
          topic: item.topic,
          reason: `Current quiz accuracy is ${acc}% (${st.correct}/${st.total}). Review rules and practice targeted problems.`,
          priority: 'Focus Area',
          recommendedAction: 'practice',
          level: item.level,
        });
      }
    }
  }

  // 2. Unattempted topics
  for (const item of curriculum) {
    if (!topicStats.has(item.topic)) {
      learningPath.push({
        id: `lp-next-${item.topic}`,
        topic: item.topic,
        reason: 'Not yet assessed in quizzes. Explore interactively or test your understanding.',
        priority: 'Next Step',
        recommendedAction: 'practice',
        level: item.level,
      });
    }
  }

  // 3. Mastered topics
  for (const item of curriculum) {
    const st = topicStats.get(item.topic);
    if (st && st.total > 0 && Math.round((st.correct / st.total) * 100) >= 75) {
      const acc = Math.round((st.correct / st.total) * 100);
      learningPath.push({
        id: `lp-master-${item.topic}`,
        topic: item.topic,
        reason: `Strong mastery at ${acc}% accuracy. Reinforce formulas with spaced-repetition flashcards.`,
        priority: 'Mastery',
        recommendedAction: 'flashcards',
        level: item.level,
      });
    }
  }

  return {
    xp,
    level,
    xpIntoLevel,
    xpForNextLevel,
    currentStreak,
    todaySolved,
    badges,
    learningPath: learningPath.slice(0, 6),
  };
}
