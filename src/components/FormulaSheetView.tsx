import { useMemo, useState } from 'react';
import { ArrowRight, Search, Star } from 'lucide-react';
import { FORMULA_CATEGORIES, FORMULA_SHEET, type FormulaEntry } from '../data/formulaSheet';
import { MathTex } from './MathTex';

interface FormulaSheetViewProps {
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
  onLoadExample: (example: NonNullable<FormulaEntry['tryExample']>) => void;
}

export function FormulaSheetView({
  favoriteIds,
  onToggleFavorite,
  onLoadExample,
}: FormulaSheetViewProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof FORMULA_CATEGORIES)[number]>('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORMULA_SHEET.filter((item) => {
      const catMatch =
        category === 'All'
          ? true
          : category === 'Favorites'
          ? favoriteIds.includes(item.id)
          : item.category === category;
      const textMatch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [query, category, favoriteIds]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Formula Library
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Topic-organized differentiation rules, partial theorems, chain rules, and vector calculus operators.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search formulas..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#12141B] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#2F7CF6]"
            />
          </div>
        </div>

        {/* Category filter segmented bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FORMULA_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                category === cat
                  ? 'bg-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat === 'Favorites' ? `Favorites (${favoriteIds.length})` : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Formula Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => {
          const isFav = favoriteIds.includes(item.id);
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {item.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(item.id)}
                    aria-label={isFav ? 'Remove formula from favorites' : 'Save formula to favorites'}
                    className={`min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center transition-colors ${
                      isFav
                        ? 'text-amber-500 bg-amber-500/12'
                        : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200/80 dark:border-white/5 px-4 py-3 overflow-x-auto text-slate-900 dark:text-slate-100">
                  <MathTex tex={item.formulaLatex} display />
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.note}
                </p>
              </div>

              {item.tryExample && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onLoadExample(item.tryExample!)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F7CF6] hover:underline whitespace-nowrap shrink-0"
                  >
                    <span>Try in Calculator</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {category === 'Favorites'
            ? 'No favorite formulas yet. Click the star icon on any formula card to save it here.'
            : `No formulas match "${query}". Try clearing your search filter.`}
        </div>
      )}
    </div>
  );
}
