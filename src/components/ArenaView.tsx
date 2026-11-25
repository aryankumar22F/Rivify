import { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Flame,
  Loader2,
  Play,
  RefreshCw,
  Share2,
  Swords,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { GamificationSummary } from '../engine/gamification';
import { ASSESSMENT_TOPICS, generateSeededChallenge } from '../engine/problemGenerator';
import type { ChallengeRoom, LeaderboardEntry, QuizAttempt, QuizQuestion } from '../types';
import { parseApiResponse } from '../utils/apiClient';
import { shareSolutionText, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface ArenaViewProps {
  displayName: string;
  userId: string;
  gamification: GamificationSummary;
  quizAttempts: QuizAttempt[];
  totalProblemsSolved: number;
  initialChallengeCode?: string | null;
  hapticsEnabled: boolean;
  onRecordAttempt: (attempt: QuizAttempt) => void;
}

export function ArenaView({
  displayName,
  userId,
  gamification,
  quizAttempts,
  totalProblemsSolved,
  initialChallengeCode,
  hapticsEnabled,
  onRecordAttempt,
}: ArenaViewProps) {
  const [tab, setTab] = useState<'leaderboard' | 'challenges'>(
    initialChallengeCode ? 'challenges' : 'leaderboard'
  );

  // Leaderboard state
  const [weekKey, setWeekKey] = useState('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbError, setLbError] = useState<string | null>(null);
  const [postingStats, setPostingStats] = useState(false);
  const [postMessage, setPostMessage] = useState<string | null>(null);

  // Challenge state
  const [createTopic, setCreateTopic] = useState<string>('Mixed Multivariable');
  const [createCount, setCreateCount] = useState<number>(5);
  const [joinCode, setJoinCode] = useState<string>(initialChallengeCode ?? '');
  const [activeRoom, setActiveRoom] = useState<ChallengeRoom | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Active challenge quiz session state
  const [playingQuestions, setPlayingQuestions] = useState<QuizQuestion[] | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [submittingScore, setSubmittingScore] = useState(false);

  const accuracy =
    quizAttempts.length > 0
      ? Math.round((quizAttempts.filter((a) => a.correct).length / quizAttempts.length) * 100)
      : 0;

  const fetchLeaderboard = async () => {
    setLbLoading(true);
    setLbError(null);
    try {
      const res = await fetch('/api/social/leaderboard');
      const data = await parseApiResponse<{
        weekKey?: string;
        entries?: LeaderboardEntry[];
      }>(res, 'Could not load leaderboard.');
      setWeekKey(data.weekKey ?? '');
      setEntries(data.entries ?? []);
    } catch (err) {
      setLbError(err instanceof Error ? err.message : 'Unable to reach leaderboard service.');
    } finally {
      setLbLoading(false);
    }
  };

  useEffect(() => {
    void fetchLeaderboard();
  }, []);

  const loadRoomByCode = async (rawCode: string) => {
    const clean = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) {
      setRoomError('Enter a 6-character challenge code.');
      return;
    }
    setRoomBusy(true);
    setRoomError(null);
    try {
      const res = await fetch(`/api/social/challenges/${clean}`);
      const data = await parseApiResponse<{ room?: ChallengeRoom }>(
        res,
        'Challenge room not found.'
      );
      if (!data.room) throw new Error('Challenge room not found.');
      setActiveRoom(data.room);
      setPlayingQuestions(null);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Failed to load challenge room.');
    } finally {
      setRoomBusy(false);
    }
  };

  useEffect(() => {
    if (initialChallengeCode) {
      setTab('challenges');
      setJoinCode(initialChallengeCode);
      void loadRoomByCode(initialChallengeCode);
    }
  }, [initialChallengeCode]);

  const handlePostMyStats = async () => {
    setPostingStats(true);
    setLbError(null);
    setPostMessage(null);
    triggerHaptic(hapticsEnabled, 12);
    try {
      const res = await fetch('/api/social/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          displayName,
          xp: gamification.xp,
          accuracy,
          problemsSolved: totalProblemsSolved,
          streak: gamification.currentStreak,
        }),
      });
      await parseApiResponse<{ entry?: LeaderboardEntry }>(res, 'Could not submit score.');
      setPostMessage('Your verified stats have been posted to this week’s leaderboard.');
      await fetchLeaderboard();
    } catch (err) {
      setLbError(err instanceof Error ? err.message : 'Failed to post stats.');
    } finally {
      setPostingStats(false);
    }
  };

  const handleCreateRoom = async () => {
    setRoomBusy(true);
    setRoomError(null);
    triggerHaptic(hapticsEnabled, 12);
    try {
      const res = await fetch('/api/social/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorName: displayName,
          topic: createTopic,
          questionCount: createCount,
        }),
      });
      const data = await parseApiResponse<{ room?: ChallengeRoom }>(
        res,
        'Failed to create room.'
      );
      if (!data.room) throw new Error('Failed to create room.');
      setActiveRoom(data.room);
      setJoinCode(data.room.code);
      setPlayingQuestions(null);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Could not create challenge room.');
    } finally {
      setRoomBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!activeRoom) return;
    const shareUrl = `${window.location.origin}?challenge=${activeRoom.code}`;
    await shareSolutionText(
      `Derivify Quiz Challenge (${activeRoom.code})`,
      `Compete with me on "${activeRoom.topic}" (${activeRoom.questionCount} questions)! Open ${shareUrl} or enter code ${activeRoom.code}.`
    );
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleStartRoomMatch = () => {
    if (!activeRoom) return;
    triggerHaptic(hapticsEnabled, 12);
    const qs = generateSeededChallenge(
      activeRoom.topic,
      activeRoom.seed,
      activeRoom.questionCount
    );
    setPlayingQuestions(qs);
    setQIdx(0);
    setSelectedOpt(null);
    setScore(0);
    setStartedAt(Date.now());
  };

  const handleAnswerChallenge = (optIdx: number) => {
    if (!playingQuestions || selectedOpt !== null) return;
    const q = playingQuestions[qIdx];
    const right = optIdx === q.correctIndex;
    setSelectedOpt(optIdx);
    if (right) setScore((s) => s + 1);
    triggerHaptic(hapticsEnabled, right ? 12 : [18, 25, 18]);

    onRecordAttempt({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      questionId: q.id,
      category: q.category,
      level: q.level,
      correct: right,
      timestamp: Date.now(),
    });
  };

  const handleAdvanceChallenge = async () => {
    if (!playingQuestions || !activeRoom) return;
    if (qIdx + 1 < playingQuestions.length) {
      setQIdx((i) => i + 1);
      setSelectedOpt(null);
      return;
    }

    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    setSubmittingScore(true);
    try {
      const res = await fetch(`/api/social/challenges/${activeRoom.code}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: displayName,
          score,
          total: playingQuestions.length,
          elapsedSeconds,
        }),
      });
      const data = await parseApiResponse<{ room?: ChallengeRoom }>(
        res,
        'Could not submit challenge score.'
      );
      if (data.room) {
        setActiveRoom(data.room);
      }
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Unable to submit challenge score.');
    } finally {
      setSubmittingScore(false);
      setPlayingQuestions(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Swords className="w-5 h-5 text-[#2F7CF6]" />
            Weekly Leaderboard & Friends Challenges
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Compare verified progress with peers or create seeded quiz competitions with shareable room codes.
          </p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#191C24] border border-slate-200 dark:border-white/10 self-start">
          <button
            type="button"
            onClick={() => setTab('leaderboard')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'leaderboard'
                ? 'bg-[#2F7CF6] text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Weekly Leaderboard</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('challenges')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'challenges'
                ? 'bg-[#2F7CF6] text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Friends Challenge</span>
          </button>
        </div>
      </div>

      {tab === 'leaderboard' && (
        <div className="space-y-5">
          {/* Your Verified Stats Banner */}
          <div className="rounded-2xl border border-[#2F7CF6]/30 bg-white dark:bg-[#191C24] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#2F7CF6]">
                Your Verified Weekly Stats · {weekKey || 'Current Week'}
              </div>
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                {displayName}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                {gamification.xp} XP · {accuracy}% Quiz Accuracy · {totalProblemsSolved} Solved ·{' '}
                {gamification.currentStreak}d Streak
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void fetchLeaderboard()}
                disabled={lbLoading}
                className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${lbLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={handlePostMyStats}
                disabled={postingStats}
                className="h-10 px-4 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                {postingStats ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>Post My Verified Stats</span>
              </button>
            </div>
          </div>

          {postMessage && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              {postMessage}
            </div>
          )}

          {lbError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-600 dark:text-rose-300"
            >
              {lbError}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] overflow-hidden">
            {lbLoading ? (
              <div className="p-10 flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#2F7CF6]" />
                <span>Loading standings...</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Trophy className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  No Scores Posted This Week Yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  This leaderboard displays only real student-submitted standings. Click “Post My Verified Stats” above to claim Rank #1 for {weekKey || 'this week'}.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-white/10">
                {entries.map((entry, idx) => {
                  const isYou = entry.id === userId;
                  return (
                    <div
                      key={`${entry.id}-${entry.weekKey}`}
                      className={`px-5 py-3.5 flex items-center justify-between gap-4 ${
                        isYou ? 'bg-[#2F7CF6]/8 dark:bg-[#2F7CF6]/12' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums shrink-0 ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : idx === 1
                              ? 'bg-slate-400/20 text-slate-600 dark:text-slate-300'
                              : idx === 2
                              ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                              : 'bg-slate-100 dark:bg-[#22252E] text-slate-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {entry.displayName} {isYou ? '(You)' : ''}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {entry.accuracy}% acc · {entry.problemsSolved} solved
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 text-right tabular-nums">
                        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <Flame className="w-3.5 h-3.5" />
                          {entry.streak}d
                        </span>
                        <span className="text-sm font-bold text-[#2F7CF6]">
                          {entry.xp} XP
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'challenges' && (
        <div className="space-y-5">
          {!playingQuestions ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Create Challenge */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Host a Quiz Competition
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Generates a deterministic seeded question set so every friend gets identical problems.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Topic
                      </label>
                      <select
                        value={createTopic}
                        onChange={(e) => setCreateTopic(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                      >
                        <option value="Mixed Multivariable">Mixed Multivariable</option>
                        {ASSESSMENT_TOPICS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Questions
                      </label>
                      <select
                        value={createCount}
                        onChange={(e) => setCreateCount(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                      >
                        <option value={5}>5 Questions</option>
                        <option value={8}>8 Questions</option>
                        <option value={10}>10 Questions</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    disabled={roomBusy}
                    className="w-full h-10 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                  >
                    Create Challenge Room
                  </button>
                </div>

                {/* Join Challenge */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Join a Friend’s Challenge
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Enter a 6-character challenge code shared by a classmate or open their invite link.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="e.g. A4F92B"
                      maxLength={8}
                      aria-label="Challenge room code"
                      className="flex-1 h-10 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm uppercase tracking-wider text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                    />
                    <button
                      type="button"
                      onClick={() => void loadRoomByCode(joinCode)}
                      disabled={roomBusy}
                      className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold whitespace-nowrap"
                    >
                      Join Room
                    </button>
                  </div>

                  {roomError && (
                    <div role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                      {roomError}
                    </div>
                  )}
                </div>
              </div>

              {activeRoom && (
                <div className="rounded-2xl border border-[#2F7CF6]/35 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-[#2F7CF6]">
                        Room {activeRoom.code} · Hosted by {activeRoom.creatorName}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-0.5">
                        {activeRoom.topic} ({activeRoom.questionCount} Questions)
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyInvite}
                        className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Invite Link Copied</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share Invite</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(activeRoom.code);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 1500);
                        }}
                        className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{activeRoom.code}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleStartRoomMatch}
                        className="h-10 px-4 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Challenge</span>
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Room Scoreboard ({activeRoom.submissions.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => void loadRoomByCode(activeRoom.code)}
                        className="text-xs text-[#2F7CF6] hover:underline inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                      </button>
                    </div>

                    {activeRoom.submissions.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No submissions yet — click “Start Challenge” to set the benchmark score.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activeRoom.submissions.map((sub, i) => (
                          <div
                            key={`${sub.playerName}-${sub.submittedAt}-${i}`}
                            className="rounded-xl bg-slate-50 dark:bg-[#22252E] border border-slate-200 dark:border-white/10 px-4 py-2.5 flex items-center justify-between text-xs tabular-nums"
                          >
                            <span className="font-semibold text-slate-900 dark:text-white">
                              #{i + 1} · {sub.playerName}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">
                              <strong>
                                {sub.score}/{sub.total}
                              </strong>{' '}
                              · <Clock className="w-3 h-3 inline mr-0.5" />
                              {sub.elapsedSeconds}s
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Playing Active Challenge Room */
            <div className="max-w-xl mx-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111319] p-6 space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>Room {activeRoom?.code}</span>
                <span>
                  Question {qIdx + 1} / {playingQuestions.length}
                </span>
                <span>Score: {score}</span>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                  {playingQuestions[qIdx].prompt}
                </h3>
                {playingQuestions[qIdx].expressionLatex && (
                  <div className="py-2 overflow-x-auto text-slate-900 dark:text-white">
                    <MathTex tex={playingQuestions[qIdx].expressionLatex} display />
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                {playingQuestions[qIdx].optionsLatex.map((opt, idx) => {
                  const answered = selectedOpt !== null;
                  const isCorrect = idx === playingQuestions[qIdx].correctIndex;
                  const isSelected = idx === selectedOpt;
                  let cls =
                    'border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6]';
                  if (answered) {
                    if (isCorrect) cls = 'border-emerald-500 bg-emerald-500/12';
                    else if (isSelected) cls = 'border-rose-500 bg-rose-500/12';
                    else cls = 'border-slate-200 dark:border-white/10 opacity-70';
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={answered}
                      onClick={() => handleAnswerChallenge(idx)}
                      className={`w-full min-h-[60px] px-4 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 overflow-x-auto transition-colors ${cls}`}
                    >
                      <div className="mx-auto text-slate-900 dark:text-slate-100">
                        <MathTex tex={opt} />
                      </div>
                      {answered && isCorrect && (
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      {answered && isSelected && !isCorrect && (
                        <X className="w-4 h-4 text-rose-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedOpt !== null && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#191C24] p-3 text-xs overflow-x-auto">
                  <MathTex tex={playingQuestions[qIdx].explanationLatex} />
                </div>
              )}

              <button
                type="button"
                disabled={selectedOpt === null || submittingScore}
                onClick={() => void handleAdvanceChallenge()}
                className="w-full h-11 rounded-full bg-[#2F7CF6] hover:bg-[#256AE0] disabled:opacity-40 text-white text-sm font-semibold transition-colors"
              >
                {submittingScore
                  ? 'Submitting Score...'
                  : qIdx + 1 < playingQuestions.length
                  ? 'Next Question'
                  : 'Submit Challenge Score'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
