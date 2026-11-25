import { useMemo, useState } from 'react';
import { ArrowLeftRight, Check, Copy, Ruler } from 'lucide-react';
import {
  convertUnits,
  formatUnitNumber,
  UNIT_CATEGORIES,
  type UnitCategoryId,
} from '../engine/unitConverter';

export function UnitConverterView() {
  const [categoryId, setCategoryId] = useState<UnitCategoryId>('length');
  const [valueStr, setValueStr] = useState('10');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('ft');
  const [copied, setCopied] = useState(false);

  const activeCategory = useMemo(
    () => UNIT_CATEGORIES.find((c) => c.id === categoryId) ?? UNIT_CATEGORIES[0],
    [categoryId]
  );

  const handleSelectCategory = (nextId: UnitCategoryId) => {
    setCategoryId(nextId);
    const cat = UNIT_CATEGORIES.find((c) => c.id === nextId);
    if (cat && cat.units.length >= 2) {
      setFromUnit(cat.units[0].id);
      setToUnit(cat.units[1].id);
    }
  };

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  const conversion = useMemo(() => {
    try {
      const num = Number(valueStr);
      if (valueStr.trim() === '' || !Number.isFinite(num)) {
        return { result: null, error: 'Enter a valid numeric magnitude.' };
      }
      const res = convertUnits(categoryId, num, fromUnit, toUnit);
      return { result: res, error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Conversion failed.' };
    }
  }, [categoryId, valueStr, fromUnit, toUnit]);

  const toMeta = activeCategory.units.find((u) => u.id === toUnit);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Ruler className="w-5 h-5 text-[#2F7CF6]" />
            Engineering &amp; Scientific Unit Converter
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Instant precision conversions across 11 physical and scientific dimensions with exact factor formulas and multi-unit reference tables.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {UNIT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelectCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                categoryId === cat.id
                  ? 'bg-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Input Value</label>
            <input
              type="number"
              step="any"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              className="mt-1 w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-base tabular-nums text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 items-end">
            <div className="sm:col-span-5">
              <label className="text-xs text-slate-500 dark:text-slate-400">From Unit</label>
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-xs text-slate-900 dark:text-white"
              >
                {activeCategory.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-1 flex justify-center">
              <button
                type="button"
                onClick={handleSwap}
                aria-label="Swap units"
                className="h-10 w-10 rounded-xl border border-slate-200 dark:border-white/15 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-[#2F7CF6]"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>
            <div className="sm:col-span-5">
              <label className="text-xs text-slate-500 dark:text-slate-400">To Unit</label>
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#22252E] text-xs text-slate-900 dark:text-white"
              >
                {activeCategory.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {conversion.error && (
            <div className="text-xs text-rose-500">{conversion.error}</div>
          )}

          {conversion.result && (
            <div className="rounded-xl border border-[#2F7CF6]/30 bg-[#2F7CF6]/8 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2F7CF6]">Converted Output</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `${formatUnitNumber(conversion.result!.value, 8)} ${toMeta?.symbol ?? ''}`
                      );
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      // ignore
                    }
                  }}
                  className="text-xs text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 hover:text-[#2F7CF6]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {formatUnitNumber(conversion.result.value, 8)} {toMeta?.symbol}
              </div>
              <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                {conversion.result.formulaText}
              </div>
            </div>
          )}
        </div>

        {/* All-Unit Table */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            All {activeCategory.label} Equivalents
          </h3>
          {conversion.result && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {conversion.result.allUnits.map((row) => (
                <div
                  key={row.id}
                  onClick={() => setToUnit(row.id)}
                  className={`cursor-pointer rounded-xl border p-3 flex items-center justify-between gap-2 text-xs transition-colors ${
                    row.id === toUnit
                      ? 'border-[#2F7CF6] bg-[#2F7CF6]/10'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6]/50'
                  }`}
                >
                  <span className="text-slate-600 dark:text-slate-300 truncate">{row.name}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                    {formatUnitNumber(row.value, 6)} {row.symbol}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
