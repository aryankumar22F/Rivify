import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Copy,
  FileDown,
  History,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { CalcToolId } from './CalculatorWorkspace';
import type { HistoryItem, ScientificHistoryItem } from '../types';
import { downloadCustomPdfReport } from '../utils/pdfReport';
import { ClearAllActionButton } from './ActionButtons';

interface MathHistoryViewProps {
  history: HistoryItem[];
  scientificHistory: ScientificHistoryItem[];
  onReopenSymbolic: (item: HistoryItem) => void;
  onSendToSolver: (expr: string) => void;
  onToggleBookmark: (id: string) => void;
  onDeleteSymbolic: (id: string) => void;
  onClearScientific: () => void;
}

type UnifiedEntry =
  | {
      kind: 'symbolic';
      id: string;
      tool: CalcToolId;
      topic: string;
      expression: string;
      result: string;
      latex: string;
      timestamp: number;
      bookmarked: boolean;
      raw: HistoryItem;
    }
  | {
      kind: 'scientific';
      id: string;
      topic: string;
      expression: string;
      result: string;
      latex: string;
      timestamp: number;
      bookmarked: false;
      raw: ScientificHistoryItem;
    };

export function MathHistoryView({
  history,
  scientificHistory,
  onReopenSymbolic,
  onSendToSolver,
  onToggleBookmark,
  onDeleteSymbolic,
  onClearScientific,
}: MathHistoryViewProps) {
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sciClearedNotice, setSciClearedNotice] = useState(false);
  const sciClearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (sciClearTimerRef.current) window.clearTimeout(sciClearTimerRef.current);
    };
  }, []);

  const unified = useMemo<UnifiedEntry[]>(() => {
    const sym: UnifiedEntry[] = history.map((h) => ({
      kind: 'symbolic',
      id: h.id,
      tool: h.tool,
      topic: h.toolLabel,
      expression: h.expression,
      result: h.resultPlain,
      latex: h.resultLatex,
      timestamp: h.timestamp,
      bookmarked: Boolean(h.bookmarked),
      raw: h,
    }));
    const sci: UnifiedEntry[] = scientificHistory.map((s) => ({
      kind: 'scientific',
      id: s.id,
      topic: 'Scientific Calculator',
      expression: s.expression,
      result: s.result,
      latex: `${s.expression} = ${s.result}`,
      timestamp: s.timestamp,
      bookmarked: false,
      raw: s,
    }));
    return [...sym, ...sci].sort((a, b) => b.timestamp - a.timestamp);
  }, [history, scientificHistory]);

  const topics = useMemo(() => {
    const set = new Set(unified.map((u) => u.topic));
    return ['all', ...Array.from(set)];
  }, [unified]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const q = query.trim().toLowerCase();

    return unified.filter((item) => {
      if (bookmarksOnly && !item.bookmarked) return false;
      if (topicFilter !== 'all' && item.topic !== topicFilter) return false;
      if (dateRange === 'today' && item.timestamp < todayStart.getTime()) return false;
      if (dateRange === '7d' && item.timestamp < now - 7 * 86400000) return false;
      if (dateRange === '30d' && item.timestamp < now - 30 * 86400000) return false;
      if (q) {
        const hay = `${item.topic} ${item.expression} ${item.result}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [unified, query, dateRange, topicFilter, bookmarksOnly]);

  const handleExportPdf = () => {
    downloadCustomPdfReport({
      title: 'RIVIFY Mathematical Calculation History',
      items: filtered.slice(0, 40).map((item) => ({
        heading: `${item.topic} — ${item.expression}`,
        subtitle: new Date(item.timestamp).toLocaleString(),
        plainText: `Result: ${item.result}`,
        latex: item.latex,
      })),
      filename: `rivify-history-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-[#2F7CF6]" />
              Mathematical Calculation History
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Search, filter by topic or date range, bookmark key derivations, reopen calculations, and export clean PDF transcripts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(scientificHistory.length > 0 || sciClearedNotice) && (
              <ClearAllActionButton
                label="Clear Sci Tape"
                clearedLabel="Cleared successfully"
                cleared={sciClearedNotice}
                variant="danger"
                size="sm"
                onClick={() => {
                  if (sciClearTimerRef.current) window.clearTimeout(sciClearTimerRef.current);
                  onClearScientific();
                  setSciClearedNotice(true);
                  sciClearTimerRef.current = window.setTimeout(() => setSciClearedNotice(false), 2200);
                }}
              />
            )}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={filtered.length === 0}
              className="h-9 px-3.5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export Filtered PDF ({filtered.length})
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search expressions, tools, or results..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-xs text-slate-900 dark:text-white"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              aria-label="Filter by topic"
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-xs text-slate-900 dark:text-white"
            >
              {topics.map((tp) => (
                <option key={tp} value={tp}>
                  {tp === 'all' ? 'All Calculators & Topics' : tp}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              aria-label="Filter by date"
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-xs text-slate-900 dark:text-white"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => setBookmarksOnly((b) => !b)}
              className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                bookmarksOnly
                  ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                  : 'border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Saved Only
            </button>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <History className="w-7 h-7 mx-auto text-slate-400" />
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              No matching calculations found
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Run calculations in Partial Derivative, Gradient, Vector Field, or Scientific Calculator to build your searchable archive.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-semibold text-[#2F7CF6]">{item.topic}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="font-mono text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {item.expression}
                  </div>
                  <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 truncate">
                    = {item.result}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {item.kind === 'symbolic' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onToggleBookmark(item.id)}
                        aria-label="Toggle bookmark"
                        className={`p-2 rounded-lg border ${
                          item.bookmarked
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-500'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onReopenSymbolic(item.raw)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#2F7CF6] text-white text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Reopen
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onSendToSolver(item.expression)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#2F7CF6]" />
                    Solver
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(item.latex);
                        setCopiedId(item.id);
                        setTimeout(() => setCopiedId(null), 1500);
                      } catch {
                        // ignore
                      }
                    }}
                    className="p-2 rounded-lg border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300"
                    title="Copy LaTeX"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {item.kind === 'symbolic' && (
                    <button
                      type="button"
                      onClick={() => onDeleteSymbolic(item.id)}
                      aria-label="Delete calculation"
                      className="p-2 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
