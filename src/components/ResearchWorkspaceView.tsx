import { useState } from 'react';
import { FileCode, FileDown, FolderKanban, Link2, Plus, Trash2 } from 'lucide-react';
import type { HistoryItem, RecentGraphSession, ResearchAttachment, ResearchProject } from '../types';
import {
  buildLatexDocument,
  downloadCustomPdfReport,
  downloadLatexFile,
  type ExportDocumentItem,
} from '../utils/pdfReport';
import { MathTex } from './MathTex';

interface ResearchWorkspaceViewProps {
  authorName: string;
  projects: ResearchProject[];
  history: HistoryItem[];
  recentGraphs: RecentGraphSession[];
  onSaveProject: (project: ResearchProject) => void;
  onDeleteProject: (id: string) => void;
}

export function ResearchWorkspaceView({
  authorName,
  projects,
  history,
  recentGraphs,
  onSaveProject,
  onDeleteProject,
}: ResearchWorkspaceViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null);
  const activeProject = projects.find((p) => p.id === selectedId) ?? projects[0] ?? null;

  const [newFormulaLabel, setNewFormulaLabel] = useState('Key Identity');
  const [newFormulaLatex, setNewFormulaLatex] = useState('\\nabla \\cdot (\\nabla \\times \\mathbf{F}) = 0');
  const [showTexPreview, setShowTexPreview] = useState(false);

  const createNewProject = () => {
    const now = Date.now();
    const created: ResearchProject = {
      id: `proj-${now}-${Math.random().toString(36).slice(2, 5)}`,
      title: `Mathematical Research Study ${projects.length + 1}`,
      domain: 'Applied & Engineering Mathematics',
      abstract: 'Outline your problem statement, assumptions, and analytical methodology here.',
      formulas: [
        {
          id: `rf-${now}`,
          label: 'Governing Equation',
          latex: '\\frac{\\partial u}{\\partial t} = \\alpha \\nabla^2 u',
        },
      ],
      attachments: [],
      notes: 'Add observations, numerical tolerances, and verification notes.',
      createdAt: now,
      updatedAt: now,
    };
    onSaveProject(created);
    setSelectedId(created.id);
  };

  const updateActive = (patch: Partial<ResearchProject>) => {
    if (!activeProject) return;
    onSaveProject({ ...activeProject, ...patch, updatedAt: Date.now() });
  };

  const attachHistoryItem = (item: HistoryItem) => {
    if (!activeProject) return;
    const att: ResearchAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: `${item.toolLabel}: ${item.expression}`,
      kind: 'calculation',
      summary: item.resultPlain,
      latex: item.resultLatex,
    };
    updateActive({ attachments: [...activeProject.attachments, att] });
  };

  const attachGraphItem = (g: RecentGraphSession) => {
    if (!activeProject) return;
    const att: ResearchAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: `${g.title} (${g.expression})`,
      kind: 'graph',
      summary: `Plotted in ${g.sourceTool}`,
    };
    updateActive({ attachments: [...activeProject.attachments, att] });
  };

  const buildReportItems = (proj: ResearchProject): ExportDocumentItem[] => [
    { heading: 'Abstract & Methodology', subtitle: `Domain: ${proj.domain}`, plainText: proj.abstract },
    ...proj.formulas.map((f) => ({
      heading: f.label,
      plainText: 'Research Formula',
      latex: f.latex,
    })),
    ...proj.attachments.map((a) => ({
      heading: `Attached ${a.kind.toUpperCase()}: ${a.label}`,
      plainText: a.summary,
      latex: a.latex,
    })),
    { heading: 'Research Notes & Observations', plainText: proj.notes },
  ];

  const texPreview = activeProject
    ? buildLatexDocument({
        title: activeProject.title,
        author: authorName,
        items: buildReportItems(activeProject),
      })
    : '';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-[#2F7CF6]" />
            Mathematical Research Workspace
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Organize structured mathematics projects with abstracts, KaTeX equations, attached calculations/graphs, research notes, and PDF/LaTeX manuscript exports.
          </p>
        </div>
        <button
          type="button"
          onClick={createNewProject}
          className="h-10 px-4 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Research Project</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Project List */}
        <div className="lg:col-span-4 space-y-2.5">
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 bg-white dark:bg-[#191C24] p-6 text-center space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No research projects yet. Create one to begin compiling derivations and graphs.
              </p>
            </div>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`cursor-pointer rounded-2xl border p-4 space-y-1 transition-colors ${
                  activeProject?.id === p.id
                    ? 'border-[#2F7CF6] bg-[#2F7CF6]/10'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] hover:border-[#2F7CF6]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {p.title}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${p.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(p.id);
                    }}
                    className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[11px] text-[#2F7CF6]">{p.domain}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {p.formulas.length} formulas · {p.attachments.length} attachments
                </div>
              </div>
            ))
          )}
        </div>

        {/* Active Project Workspace */}
        <div className="lg:col-span-8">
          {!activeProject ? (
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-10 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select or create a research project to manage formulas, notes, and exports.
              </p>
              <button
                type="button"
                onClick={createNewProject}
                className="px-4 py-2 rounded-xl bg-[#2F7CF6] text-white text-xs font-semibold"
              >
                Create First Project
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-white/10">
                <div className="text-xs font-semibold text-[#2F7CF6]">Active Workspace</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTexPreview((v) => !v)}
                    className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {showTexPreview ? 'Edit Mode' : 'LaTeX Source'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadLatexFile(
                        texPreview,
                        `${activeProject.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.tex`
                      )
                    }
                    className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    .TEX
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCustomPdfReport({
                        title: activeProject.title,
                        author: authorName,
                        items: buildReportItems(activeProject),
                        filename: `${activeProject.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
                      })
                    }
                    className="h-8 px-3 rounded-lg bg-[#2F7CF6] text-white text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Export PDF
                  </button>
                </div>
              </div>

              {showTexPreview ? (
                <pre className="p-4 rounded-xl bg-slate-50 dark:bg-[#12151C] font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">
                  {texPreview}
                </pre>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Project Title</label>
                      <input
                        type="text"
                        value={activeProject.title}
                        onChange={(e) => updateActive({ title: e.target.value })}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Research Domain</label>
                      <input
                        type="text"
                        value={activeProject.domain}
                        onChange={(e) => updateActive({ domain: e.target.value })}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Abstract / Problem Statement</label>
                    <textarea
                      rows={3}
                      value={activeProject.abstract}
                      onChange={(e) => updateActive({ abstract: e.target.value })}
                      className="mt-1 w-full p-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Formulas */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      Equations &amp; Derivations ({activeProject.formulas.length})
                    </div>
                    {activeProject.formulas.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-[#2F7CF6]">{f.label}</div>
                          <div className="overflow-x-auto text-slate-900 dark:text-white mt-1">
                            <MathTex tex={f.latex} />
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove formula"
                          onClick={() =>
                            updateActive({
                              formulas: activeProject.formulas.filter((x) => x.id !== f.id),
                            })
                          }
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                      <input
                        type="text"
                        value={newFormulaLabel}
                        onChange={(e) => setNewFormulaLabel(e.target.value)}
                        placeholder="Label"
                        className="sm:col-span-4 h-9 px-3 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent text-xs text-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        value={newFormulaLatex}
                        onChange={(e) => setNewFormulaLatex(e.target.value)}
                        placeholder="LaTeX formula"
                        className="sm:col-span-6 h-9 px-3 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newFormulaLatex.trim()) return;
                          updateActive({
                            formulas: [
                              ...activeProject.formulas,
                              {
                                id: `rf-${Date.now()}`,
                                label: newFormulaLabel.trim() || 'Formula',
                                latex: newFormulaLatex.trim(),
                              },
                            ],
                          });
                        }}
                        className="sm:col-span-2 h-9 rounded-lg bg-[#2F7CF6] text-white text-xs font-semibold"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Attach Saved Calculations or Graphs */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-[#2F7CF6]" />
                      Attached Calculations &amp; Visualizations ({activeProject.attachments.length})
                    </div>
                    {activeProject.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {att.label}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            {att.summary}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateActive({
                              attachments: activeProject.attachments.filter((x) => x.id !== att.id),
                            })
                          }
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <div className="flex flex-wrap gap-1.5">
                      {history.slice(0, 3).map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => attachHistoryItem(h)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/15 text-[11px] text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6]"
                        >
                          + Attach {h.toolLabel}: {h.expression}
                        </button>
                      ))}
                      {recentGraphs.slice(0, 2).map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => attachGraphItem(g)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/15 text-[11px] text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6]"
                        >
                          + Attach Graph: {g.expression}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Research Notes</label>
                    <textarea
                      rows={4}
                      value={activeProject.notes}
                      onChange={(e) => updateActive({ notes: e.target.value })}
                      className="mt-1 w-full p-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
