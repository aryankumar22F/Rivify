import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  Check,
  Eye,
  FileDown,
  PenLine,
  Pin,
  PinOff,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import type { NotebookNote } from '../types';
import { downloadSingleSolutionPdf, shareSolutionText, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface NotebookViewProps {
  notes: NotebookNote[];
  onCreateNote: (note: { title: string; topic: string; content: string }) => NotebookNote;
  onUpdateNote: (
    id: string,
    updates: Partial<Pick<NotebookNote, 'title' | 'topic' | 'content'>>
  ) => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
  hapticsEnabled: boolean;
}

const NOTE_TOPICS = [
  'Partial Derivatives',
  'Gradient & Directional',
  'Hessian & Extrema',
  'Jacobian & Laplacian',
  'Taylor Series',
  'Multiple & Vector Integrals',
  'General Calculus',
];

function renderMathMarkdown(text: string) {
  const blockParts = text.split(/(\$\$[\s\S]*?\$\$)/g);
  return blockParts.map((part, bIdx) => {
    if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
      const tex = part.slice(2, -2).trim();
      return (
        <div key={`nb-${bIdx}`} className="my-2.5 overflow-x-auto">
          <MathTex tex={tex} display />
        </div>
      );
    }
    const inlineParts = part.split(/(\$[^$\n]+?\$)/g);
    return (
      <Fragment key={`nb-${bIdx}`}>
        {inlineParts.map((sub, iIdx) => {
          if (sub.startsWith('$') && sub.endsWith('$') && sub.length > 2) {
            return <MathTex key={`ni-${iIdx}`} tex={sub.slice(1, -1)} />;
          }
          return (
            <span key={`ni-${iIdx}`} className="whitespace-pre-wrap">
              {sub}
            </span>
          );
        })}
      </Fragment>
    );
  });
}

export function NotebookView({
  notes,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePin,
  hapticsEnabled,
}: NotebookViewProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const sortedFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...notes]
      .filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.topic.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, search]);

  useEffect(() => {
    if (selectedId && notes.some((n) => n.id === selectedId)) return;
    setSelectedId(sortedFiltered[0]?.id ?? null);
  }, [notes, selectedId, sortedFiltered]);

  const activeNote = notes.find((n) => n.id === selectedId) ?? null;

  const handleNewNote = () => {
    triggerHaptic(hapticsEnabled, 10);
    const created = onCreateNote({
      title: 'Untitled Calculus Note',
      topic: 'Partial Derivatives',
      content:
        'Theorem / Example:\n\nFor $f(x, y) = x^2 y + \\sin(xy)$, by Clairaut’s Theorem:\n$$f_{xy} = f_{yx} = 2x + \\cos(xy) - xy\\sin(xy)$$',
    });
    setSelectedId(created.id);
    setViewMode('split');
  };

  const handleShare = async () => {
    if (!activeNote) return;
    triggerHaptic(hapticsEnabled, 10);
    const res = await shareSolutionText(
      `${activeNote.title} (${activeNote.topic})`,
      activeNote.content
    );
    setShareStatus(res === 'shared' ? 'Shared!' : res === 'copied' ? 'Copied to clipboard' : null);
    setTimeout(() => setShareStatus(null), 1800);
  };

  const handleExportPdf = () => {
    if (!activeNote) return;
    triggerHaptic(hapticsEnabled, 12);
    downloadSingleSolutionPdf({
      title: activeNote.title,
      expression: activeNote.topic,
      secondary: `Updated ${new Date(activeNote.updatedAt).toLocaleDateString()}`,
      resultPlain: activeNote.content,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-[#2F7CF6]" />
            Personal Mathematical Notebook
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Write derivations with inline <code className="font-mono">$...$</code> or display{' '}
            <code className="font-mono">$$...$$</code> LaTeX, or clip results directly from any calculator.
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewNote}
          className="h-10 px-4 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#2F7CF6]/12 text-[#2F7CF6] flex items-center justify-center mx-auto">
            <BookMarked className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Your Math Notebook is Empty
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create study notes with live KaTeX math formatting or use “Save Note” from any calculator result to build your personal theorem sheet.
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewNote}
            className="px-5 py-2.5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Note</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Sidebar list */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes or formulas..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#22252E] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
              />
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {sortedFiltered.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                  No notes match “{search}”.
                </p>
              ) : (
                sortedFiltered.map((note) => {
                  const isSel = note.id === activeNote?.id;
                  return (
                    <div
                      key={note.id}
                      onClick={() => setSelectedId(note.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(note.id);
                        }
                      }}
                      className={`rounded-xl border p-3 cursor-pointer transition-colors space-y-1 ${
                        isSel
                          ? 'border-[#2F7CF6] bg-[#2F7CF6]/8 dark:bg-[#2F7CF6]/15'
                          : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {note.title || 'Untitled Note'}
                          </div>
                          <div className="text-[11px] text-[#2F7CF6] font-medium truncate">
                            {note.topic}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePin(note.id);
                            }}
                            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                            className="p-1 rounded-md text-slate-400 hover:text-amber-500 transition-colors"
                          >
                            {note.pinned ? (
                              <Pin className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <PinOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNote(note.id);
                            }}
                            aria-label="Delete note"
                            className="p-1 rounded-md text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Editor + Live LaTeX Preview */}
          {activeNote && (
            <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#12141B] border border-slate-200 dark:border-white/10">
                  {(
                    [
                      { id: 'split', label: 'Split' },
                      { id: 'edit', label: 'Edit' },
                      { id: 'preview', label: 'Preview' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setViewMode(m.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                        viewMode === m.id
                          ? 'bg-[#2F7CF6] text-white'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {m.id === 'edit' && <PenLine className="w-3 h-3" />}
                      {m.id === 'preview' && <Eye className="w-3 h-3" />}
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5 transition-colors"
                  >
                    {shareStatus ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{shareStatus}</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="h-9 px-3 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => onUpdateNote(activeNote.id, { title: e.target.value })}
                  placeholder="Note Title"
                  aria-label="Note title"
                  className="sm:col-span-2 h-11 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                />
                <select
                  value={
                    NOTE_TOPICS.includes(activeNote.topic) ? activeNote.topic : NOTE_TOPICS[6]
                  }
                  onChange={(e) => onUpdateNote(activeNote.id, { topic: e.target.value })}
                  aria-label="Note topic"
                  className="h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                >
                  {NOTE_TOPICS.map((tp) => (
                    <option key={tp} value={tp}>
                      {tp}
                    </option>
                  ))}
                  {!NOTE_TOPICS.includes(activeNote.topic) && (
                    <option value={activeNote.topic}>{activeNote.topic}</option>
                  )}
                </select>
              </div>

              <div
                className={`grid gap-4 ${
                  viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {viewMode !== 'preview' && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Markdown + LaTeX Source
                    </div>
                    <textarea
                      value={activeNote.content}
                      onChange={(e) => onUpdateNote(activeNote.id, { content: e.target.value })}
                      rows={13}
                      aria-label="Note math content"
                      placeholder="Write notes using $...$ for inline LaTeX and $$...$$ for equations."
                      className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-[#12141B] font-mono text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#2F7CF6] resize-y"
                    />
                  </div>
                )}

                {viewMode !== 'edit' && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Rendered KaTeX Preview
                    </div>
                    <div className="min-h-[290px] p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] text-sm text-slate-800 dark:text-slate-100 leading-relaxed overflow-x-auto">
                      {activeNote.content.trim() ? (
                        renderMathMarkdown(activeNote.content)
                      ) : (
                        <span className="text-xs text-slate-400">
                          Start typing equations to preview rendered LaTeX here.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
