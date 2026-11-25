import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  Search,
  Trash2,
} from 'lucide-react';
import type { HistoryItem } from '../types';
import { ClearAllActionButton } from './ActionButtons';
import { MathTex } from './MathTex';

interface HistoryPanelProps {
  items: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onToggleBookmark: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export function HistoryPanel({
  items,
  onRestore,
  onToggleBookmark,
  onDelete,
  onClearAll,
}: HistoryPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'bookmarked'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearedNotice, setClearedNotice] = useState(false);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const bmMatch = filter === 'all' || Boolean(item.bookmarked);
      const qMatch =
        !q ||
        item.expression.toLowerCase().includes(q) ||
        item.toolLabel.toLowerCase().includes(q) ||
        item.resultPlain.toLowerCase().includes(q);
      return bmMatch && qMatch;
    });
  }, [items, filter, search]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // clipboard unavailable
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-10 text-center space-y-3">
        {clearedNotice && (
          <div
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-xs font-medium text-emerald-600 dark:text-emerald-400"
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>Cleared successfully</span>
          </div>
        )}
        <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-[#242834] text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
          <History className="w-5 h-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          No Calculation History Yet
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Run any partial derivative, gradient, directional derivative, extrema test, tangent plane, or vector field analysis to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Saved Calculations
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {items.length} {items.length === 1 ? 'entry' : 'entries'} ·{' '}
            {items.filter((i) => i.bookmarked).length} bookmarked
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter history..."
              className="h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#191C24] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
            />
          </div>

          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#191C24] border border-slate-200 dark:border-white/10">
            {(['all', 'bookmarked'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-[#2F7CF6] text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <ClearAllActionButton
            label="Clear All"
            clearedLabel="Cleared successfully"
            cleared={clearedNotice}
            variant="danger"
            size="sm"
            onClick={() => {
              if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
              setSearch('');
              setFilter('all');
              setExpandedId(null);
              onClearAll();
              setClearedNotice(true);
              clearTimerRef.current = window.setTimeout(() => setClearedNotice(false), 2200);
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => {
          const timeStr = new Date(item.timestamp).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          const isExpanded = expandedId === item.id;

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {item.toolLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{timeStr}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleBookmark(item.id)}
                    aria-label={item.bookmarked ? 'Remove bookmark' : 'Bookmark calculation'}
                    className={`min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center transition-colors ${
                      item.bookmarked
                        ? 'text-amber-500 bg-amber-500/12'
                        : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${item.bookmarked ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(item.id, item.resultPlain)}
                    aria-label="Copy plain result"
                    className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 inline-flex items-center gap-1.5 text-xs transition-colors"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onRestore(item)}
                    className="min-h-[34px] px-2.5 rounded-lg bg-[#2F7CF6]/10 text-[#2F7CF6] hover:bg-[#2F7CF6]/20 inline-flex items-center gap-1 text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    <span>Reopen</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    aria-label="Delete history item"
                    className="min-h-[34px] min-w-[34px] rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#12141B] px-3 py-2 rounded-xl overflow-x-auto">
                {item.expression}
                {item.secondaryInput ? `  (${item.secondaryInput})` : ''}
              </div>

              <div className="overflow-x-auto text-slate-900 dark:text-white px-1">
                <MathTex tex={item.resultLatex} />
              </div>

              {item.steps && item.steps.length > 0 && (
                <div className="pt-2 border-t border-slate-200/80 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{isExpanded ? 'Hide steps' : `Review ${item.steps.length} derivation steps`}</span>
                  </button>
                  {isExpanded && (
                    <div className="mt-2.5 space-y-2">
                      {item.steps.map((st, idx) => (
                        <div
                          key={st.id}
                          className="rounded-xl bg-slate-50 dark:bg-[#12141B] p-3 text-xs space-y-1"
                        >
                          <div className="font-semibold text-[#2F7CF6]">
                            {idx + 1}. {st.rule}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400">{st.description}</div>
                          <div className="overflow-x-auto pt-1 text-slate-900 dark:text-slate-100">
                            <MathTex tex={st.latex} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No matching calculations found.
          </div>
        )}
      </div>
    </div>
  );
}
