import { useMemo, useState } from 'react';
import { Check, CheckCircle2, Compass, FileDown, Save, TriangleAlert } from 'lucide-react';
import {
  solveChainRuleComposition,
  solveImplicitDifferentiation,
  solveSurfaceNormal,
  solveTotalDerivative,
  solveVectorPotential,
  verifyDivergenceTheorem,
  verifyGreensTheorem,
  verifyStokesTheorem,
} from '../engine/advancedMath';
import type { AppSettings } from '../types';
import { downloadSingleSolutionPdf, triggerHaptic } from '../utils/pdfReport';
import { MathTex } from './MathTex';

type VectorTheoremTab =
  | 'implicit-chain'
  | 'normal-potential'
  | 'greens'
  | 'stokes'
  | 'divergence';

interface VectorTheoremsViewProps {
  settings: AppSettings;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

export function VectorTheoremsView({
  settings,
  onSaveToNotebook,
}: VectorTheoremsViewProps) {
  const [tab, setTab] = useState<VectorTheoremTab>('implicit-chain');

  // 1. Implicit / Chain Rule / Total Derivative
  const [diffSubMode, setDiffSubMode] = useState<'implicit' | 'chain' | 'total'>('implicit');
  const [impDim, setImpDim] = useState<'2d' | '3d'>('2d');
  const [impExpr, setImpExpr] = useState('x^2 + y^2 - 25');
  const [ptX, setPtX] = useState('3');
  const [ptY, setPtY] = useState('4');
  const [ptZ, setPtZ] = useState('0');

  const [chainF, setChainF] = useState('x^2*y + y^3');
  const [chainX, setChainX] = useState('cos(t)');
  const [chainY, setChainY] = useState('sin(t)');
  const [chainT, setChainT] = useState('0.5');

  const [totExpr, setTotExpr] = useState('x^2*y + 3*y');
  const [tot3D, setTot3D] = useState(false);
  const [dxVal, setDxVal] = useState('0.05');
  const [dyVal, setDyVal] = useState('-0.02');
  const [dzVal, setDzVal] = useState('0.01');

  // 2. Surface Normal & Potential
  const [npSubMode, setNpSubMode] = useState<'normal' | 'potential'>('normal');
  const [surfMode, setSurfMode] = useState<'explicit' | 'implicit'>('explicit');
  const [surfExpr, setSurfExpr] = useState('x^2 + y^2');
  const [pot3D, setPot3D] = useState(false);
  const [potP, setPotP] = useState('2*x*y');
  const [potQ, setPotQ] = useState('x^2 + 3*y^2');
  const [potR, setPotR] = useState('2*z');

  // 3-5. Vector Calculus Theorems
  const [thmP, setThmP] = useState('-y');
  const [thmQ, setThmQ] = useState('x');
  const [thmR, setThmR] = useState('z^2');
  const [stokesG, setStokesG] = useState('4 - x^2 - y^2');
  const [stokesRadius, setStokesRadius] = useState('2');
  const [bxMin, setBxMin] = useState('0');
  const [bxMax, setBxMax] = useState('2');
  const [byMin, setByMin] = useState('0');
  const [byMax, setByMax] = useState('3');
  const [bzMin, setBzMin] = useState('0');
  const [bzMax, setBzMax] = useState('1');

  const [savedNote, setSavedNote] = useState(false);
  const fmt = (n: number) => Number(n.toFixed(settings.precision)).toString();

  const computed = useMemo(() => {
    try {
      const px = Number(ptX);
      const py = Number(ptY);
      const pz = Number(ptZ);

      if (tab === 'implicit-chain') {
        if (diffSubMode === 'implicit') {
          const res = solveImplicitDifferentiation(
            impExpr,
            impDim,
            { x: px, y: py, z: pz },
            settings.angleUnit
          );
          return { kind: 'implicit' as const, res, error: null as string | null };
        }
        if (diffSubMode === 'chain') {
          const tv = chainT !== '' && Number.isFinite(Number(chainT)) ? Number(chainT) : undefined;
          const res = solveChainRuleComposition(chainF, chainX, chainY, tv, settings.angleUnit);
          return { kind: 'chain' as const, res, error: null };
        }
        const res = solveTotalDerivative(
          totExpr,
          { x: px || 0, y: py || 0, z: pz || 0 },
          { dx: Number(dxVal) || 0, dy: Number(dyVal) || 0, dz: Number(dzVal) || 0 },
          tot3D,
          settings.angleUnit
        );
        return { kind: 'total' as const, res, error: null };
      }

      if (tab === 'normal-potential') {
        if (npSubMode === 'normal') {
          const res = solveSurfaceNormal(
            surfExpr,
            surfMode,
            { x: px || 0, y: py || 0, z: pz || 0 },
            settings.angleUnit
          );
          return { kind: 'normal' as const, res, error: null };
        }
        const res = solveVectorPotential(
          potP,
          potQ,
          pot3D ? potR : undefined,
          pot3D,
          { x: px || 1, y: py || 1, z: pz || 1 },
          settings.angleUnit
        );
        return { kind: 'potential' as const, res, error: null };
      }

      if (tab === 'greens') {
        const res = verifyGreensTheorem(
          thmP,
          thmQ,
          Number(bxMin) || 0,
          Number(bxMax) || 1,
          Number(byMin) || 0,
          Number(byMax) || 1,
          settings.angleUnit
        );
        return { kind: 'theorem' as const, res, error: null };
      }

      if (tab === 'stokes') {
        const res = verifyStokesTheorem(
          thmP,
          thmQ,
          thmR,
          stokesG,
          Math.max(0.1, Number(stokesRadius) || 1),
          settings.angleUnit
        );
        return { kind: 'theorem' as const, res, error: null };
      }

      const res = verifyDivergenceTheorem(
        thmP,
        thmQ,
        thmR,
        Number(bxMin) || 0,
        Number(bxMax) || 1,
        Number(byMin) || 0,
        Number(byMax) || 1,
        Number(bzMin) || 0,
        Number(bzMax) || 1,
        settings.angleUnit
      );
      return { kind: 'theorem' as const, res, error: null };
    } catch (e) {
      return {
        kind: 'error' as const,
        res: null,
        error: e instanceof Error ? e.message : 'Unable to evaluate calculation.',
      };
    }
  }, [
    tab,
    diffSubMode,
    impDim,
    impExpr,
    ptX,
    ptY,
    ptZ,
    chainF,
    chainX,
    chainY,
    chainT,
    totExpr,
    tot3D,
    dxVal,
    dyVal,
    dzVal,
    npSubMode,
    surfMode,
    surfExpr,
    pot3D,
    potP,
    potQ,
    potR,
    thmP,
    thmQ,
    thmR,
    stokesG,
    stokesRadius,
    bxMin,
    bxMax,
    byMin,
    byMax,
    bzMin,
    bzMax,
    settings.angleUnit,
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#2F7CF6]" />
            Vector Calculus Theorems, Implicit Diff & Potential Fields
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Verify Green’s, Stokes’, and Divergence theorems numerically, compute implicit and total derivatives, and reconstruct conservative scalar potentials.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'implicit-chain', label: 'Implicit, Chain & Total Diff' },
              { id: 'normal-potential', label: 'Surface Normals & Potential' },
              { id: 'greens', label: "Green's Theorem" },
              { id: 'stokes', label: "Stokes' Theorem" },
              { id: 'divergence', label: 'Divergence (Gauss) Theorem' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                if (item.id === 'divergence') {
                  setThmP('x^2');
                  setThmQ('y^2');
                  setThmR('z^2');
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === item.id
                  ? 'bg-[#2F7CF6] text-white'
                  : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          {tab === 'implicit-chain' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'implicit', label: 'Implicit F=0' },
                    { id: 'chain', label: 'Chain Rule f(x(t),y(t))' },
                    { id: 'total', label: 'Total Diff df' },
                  ] as const
                ).map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setDiffSubMode(sub.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      diffSubMode === sub.id
                        ? 'bg-[#2F7CF6] text-white'
                        : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {diffSubMode === 'implicit' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Relation Type</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setImpDim('2d');
                          setImpExpr('x^2 + y^2 - 25');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          impDim === '2d' ? 'bg-[#2F7CF6] text-white' : 'bg-slate-100 dark:bg-[#22252E]'
                        }`}
                      >
                        2D F(x, y)=0
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImpDim('3d');
                          setImpExpr('x^2 + y^2 + z^2 - 14');
                          setPtX('1');
                          setPtY('2');
                          setPtZ('3');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          impDim === '3d' ? 'bg-[#2F7CF6] text-white' : 'bg-slate-100 dark:bg-[#22252E]'
                        }`}
                      >
                        3D F(x, y, z)=0
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">F = 0 expression</label>
                    <input
                      type="text"
                      value={impExpr}
                      onChange={(e) => setImpExpr(e.target.value)}
                      className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              {diffSubMode === 'chain' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Outer f(x, y)</label>
                    <input
                      type="text"
                      value={chainF}
                      onChange={(e) => setChainF(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">x(t)</label>
                      <input
                        type="text"
                        value={chainX}
                        onChange={(e) => setChainX(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">y(t)</label>
                      <input
                        type="text"
                        value={chainY}
                        onChange={(e) => setChainY(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Evaluate at t</label>
                    <input
                      type="number"
                      step="any"
                      value={chainT}
                      onChange={(e) => setChainT(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {diffSubMode === 'total' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Variables</span>
                    <button
                      type="button"
                      onClick={() => setTot3D((v) => !v)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#22252E] text-[#2F7CF6]"
                    >
                      {tot3D ? '3D (x,y,z)' : '2D (x,y)'}
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Function f</label>
                    <input
                      type="text"
                      value={totExpr}
                      onChange={(e) => setTotExpr(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">dx</label>
                      <input
                        type="number"
                        step="any"
                        value={dxVal}
                        onChange={(e) => setDxVal(e.target.value)}
                        className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">dy</label>
                      <input
                        type="number"
                        step="any"
                        value={dyVal}
                        onChange={(e) => setDyVal(e.target.value)}
                        className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                    {tot3D && (
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400">dz</label>
                        <input
                          type="number"
                          step="any"
                          value={dzVal}
                          onChange={(e) => setDzVal(e.target.value)}
                          className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {diffSubMode !== 'chain' && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Point x</label>
                    <input
                      type="number"
                      step="any"
                      value={ptX}
                      onChange={(e) => setPtX(e.target.value)}
                      className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Point y</label>
                    <input
                      type="number"
                      step="any"
                      value={ptY}
                      onChange={(e) => setPtY(e.target.value)}
                      className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                  {(impDim === '3d' || tot3D) && (
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">Point z</label>
                      <input
                        type="number"
                        step="any"
                        value={ptZ}
                        onChange={(e) => setPtZ(e.target.value)}
                        className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'normal-potential' && (
            <>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setNpSubMode('normal')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    npSubMode === 'normal'
                      ? 'bg-[#2F7CF6] text-white'
                      : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Surface Normal Vector
                </button>
                <button
                  type="button"
                  onClick={() => setNpSubMode('potential')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    npSubMode === 'potential'
                      ? 'bg-[#2F7CF6] text-white'
                      : 'bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Potential Function Finder
                </button>
              </div>

              {npSubMode === 'normal' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Surface Form</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSurfMode('explicit');
                          setSurfExpr('x^2 + y^2');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          surfMode === 'explicit'
                            ? 'bg-[#2F7CF6] text-white'
                            : 'bg-slate-100 dark:bg-[#22252E]'
                        }`}
                      >
                        z = f(x, y)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSurfMode('implicit');
                          setSurfExpr('x^2 + y^2 + z^2');
                          setPtX('1');
                          setPtY('2');
                          setPtZ('2');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          surfMode === 'implicit'
                            ? 'bg-[#2F7CF6] text-white'
                            : 'bg-slate-100 dark:bg-[#22252E]'
                        }`}
                      >
                        F(x, y, z) = c
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Surface Expression</label>
                    <input
                      type="text"
                      value={surfExpr}
                      onChange={(e) => setSurfExpr(e.target.value)}
                      className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Field Dimension</span>
                    <button
                      type="button"
                      onClick={() => setPot3D((v) => !v)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#22252E] text-[#2F7CF6]"
                    >
                      {pot3D ? '3D ⟨P, Q, R⟩' : '2D ⟨P, Q⟩'}
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">P</label>
                      <input
                        type="text"
                        value={potP}
                        onChange={(e) => setPotP(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">Q</label>
                      <input
                        type="text"
                        value={potQ}
                        onChange={(e) => setPotQ(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                    {pot3D && (
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400">R</label>
                        <input
                          type="text"
                          value={potR}
                          onChange={(e) => setPotR(e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Point x</label>
                  <input
                    type="number"
                    step="any"
                    value={ptX}
                    onChange={(e) => setPtX(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Point y</label>
                  <input
                    type="number"
                    step="any"
                    value={ptY}
                    onChange={(e) => setPtY(e.target.value)}
                    className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                {(surfMode === 'implicit' || pot3D) && (
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Point z</label>
                    <input
                      type="number"
                      step="any"
                      value={ptZ}
                      onChange={(e) => setPtZ(e.target.value)}
                      className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {(tab === 'greens' || tab === 'stokes' || tab === 'divergence') && (
            <>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Field Component P</label>
                  <input
                    type="text"
                    value={thmP}
                    onChange={(e) => setThmP(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Field Component Q</label>
                  <input
                    type="text"
                    value={thmQ}
                    onChange={(e) => setThmQ(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                {tab !== 'greens' && (
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Field Component R</label>
                    <input
                      type="text"
                      value={thmR}
                      onChange={(e) => setThmR(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {tab === 'stokes' ? (
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2">
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Surface z = g(x, y)</label>
                    <input
                      type="text"
                      value={stokesG}
                      onChange={(e) => setStokesG(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">Disk Radius R</label>
                    <input
                      type="number"
                      step="any"
                      value={stokesRadius}
                      onChange={(e) => setStokesRadius(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">x min</label>
                    <input
                      type="number"
                      step="any"
                      value={bxMin}
                      onChange={(e) => setBxMin(e.target.value)}
                      className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">x max</label>
                    <input
                      type="number"
                      step="any"
                      value={bxMax}
                      onChange={(e) => setBxMax(e.target.value)}
                      className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">y min</label>
                    <input
                      type="number"
                      step="any"
                      value={byMin}
                      onChange={(e) => setByMin(e.target.value)}
                      className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">y max</label>
                    <input
                      type="number"
                      step="any"
                      value={byMax}
                      onChange={(e) => setByMax(e.target.value)}
                      className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                  {tab === 'divergence' && (
                    <>
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400">z min</label>
                        <input
                          type="number"
                          step="any"
                          value={bzMin}
                          onChange={(e) => setBzMin(e.target.value)}
                          className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400">z max</label>
                        <input
                          type="number"
                          step="any"
                          value={bzMax}
                          onChange={(e) => setBzMax(e.target.value)}
                          className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {computed.error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300"
            >
              {computed.error}
            </div>
          )}
        </div>

        {/* Result Panel */}
        <div
          aria-live="polite"
          className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Symbolic & Numerical Verification
            </h3>
            {computed.res && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(settings.hapticsEnabled, 12);
                    onSaveToNotebook({
                      title: `Vector Analysis (${tab})`,
                      topic: 'Vector Calculus Theorems',
                      content: computed.res!.steps.map((s) => `**${s.rule}**\n$$${s.latex}$$`).join('\n\n'),
                    });
                    setSavedNote(true);
                    setTimeout(() => setSavedNote(false), 1800);
                  }}
                  className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
                >
                  {savedNote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{savedNote ? 'Saved' : 'Note'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(settings.hapticsEnabled, 12);
                    downloadSingleSolutionPdf({
                      title: `RIVIFY · ${tab}`,
                      expression: thmP,
                      resultPlain: computed.res!.steps[0]?.description ?? '',
                      steps: computed.res!.steps,
                    });
                  }}
                  className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            )}
          </div>

          {computed.kind === 'implicit' && computed.res && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                {computed.res.mode === '2d' ? (
                  <MathTex tex={`\\frac{dy}{dx} = ${computed.res.dydxLatex}`} display />
                ) : (
                  <MathTex
                    tex={`\\frac{\\partial z}{\\partial x} = ${computed.res.dzdxLatex}, \\qquad \\frac{\\partial z}{\\partial y} = ${computed.res.dzdyLatex}`}
                    display
                  />
                )}
              </div>
              {computed.res.mode === '2d' && computed.res.evaluatedSlope !== undefined && (
                <div className="text-xs font-mono text-[#2F7CF6] tabular-nums">
                  Evaluated slope dy/dx at ({ptX}, {ptY}) = <strong>{fmt(computed.res.evaluatedSlope)}</strong>
                </div>
              )}
              {computed.res.mode === '3d' && computed.res.evaluatedDzDx !== undefined && (
                <div className="text-xs font-mono text-[#2F7CF6] tabular-nums">
                  At ({ptX}, {ptY}, {ptZ}): ∂z/∂x = <strong>{fmt(computed.res.evaluatedDzDx)}</strong> · ∂z/∂y ={' '}
                  <strong>{fmt(computed.res.evaluatedDzDy ?? 0)}</strong>
                </div>
              )}
            </div>
          )}

          {computed.kind === 'chain' && computed.res && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={`\\frac{df}{dt} = ${computed.res.dfdtSymbolicLatex}`} display />
              </div>
              {computed.res.evaluatedDfDt !== undefined && (
                <div className="text-xs font-mono text-[#2F7CF6] tabular-nums">
                  At t = {chainT}: df/dt = <strong>{fmt(computed.res.evaluatedDfDt)}</strong>
                </div>
              )}
            </div>
          )}

          {computed.kind === 'total' && computed.res && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={computed.res.dfLatex} display />
              </div>
              {computed.res.evaluatedDf !== undefined && (
                <div className="text-xs font-mono text-[#2F7CF6] tabular-nums">
                  Total differential df ≈ <strong>{fmt(computed.res.evaluatedDf)}</strong>
                </div>
              )}
            </div>
          )}

          {computed.kind === 'normal' && computed.res && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={computed.res.normalSymbolicLatex} display />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono tabular-nums">
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3">
                  <div className="text-slate-500 dark:text-slate-400">Normal Vector N</div>
                  <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                    ⟨{computed.res.normalVector.map(fmt).join(', ')}⟩
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] p-3">
                  <div className="text-slate-500 dark:text-slate-400">Unit Normal n̂</div>
                  <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                    ⟨{computed.res.unitNormal.map(fmt).join(', ')}⟩
                  </div>
                </div>
              </div>
            </div>
          )}

          {computed.kind === 'potential' && computed.res && (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-4 flex items-center gap-2.5 text-sm font-semibold ${
                  computed.res.isConservative
                    ? 'border-emerald-500/40 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/8 text-rose-700 dark:text-rose-300'
                }`}
              >
                {computed.res.isConservative ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <TriangleAlert className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {computed.res.isConservative
                    ? `Conservative Field — Scalar Potential φ(P) − φ(0) = ${fmt(
                        computed.res.potentialValueAtPoint ?? 0
                      )}`
                    : 'Non-Conservative Field (Curl ≠ 0) — No Potential Function Exists'}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
                <MathTex tex={computed.res.curlTestLatex} display />
              </div>
            </div>
          )}

          {computed.kind === 'theorem' && computed.res && (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-3.5 flex items-center justify-between gap-2 text-xs font-semibold ${
                  computed.res.verified
                    ? 'border-emerald-500/40 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/8 text-amber-700 dark:text-amber-300'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {computed.res.verified
                      ? 'Theorem Identity Verified (LHS = RHS)'
                      : 'Numerical Discrepancy Detected'}
                  </span>
                </span>
                <span className="font-mono tabular-nums">
                  |LHS − RHS| = {computed.res.difference.toExponential(2)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 space-y-1.5 overflow-x-auto">
                  <div className="text-[11px] font-semibold text-[#2F7CF6]">LHS Integral</div>
                  <div className="text-slate-900 dark:text-white">
                    <MathTex tex={computed.res.lhsLatex} />
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 space-y-1.5 overflow-x-auto">
                  <div className="text-[11px] font-semibold text-emerald-500">RHS Integral</div>
                  <div className="text-slate-900 dark:text-white">
                    <MathTex tex={computed.res.rhsLatex} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {computed.res && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
              {computed.res.steps.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-3 text-xs space-y-1"
                >
                  <div className="font-semibold text-[#2F7CF6]">{s.rule}</div>
                  <div className="text-slate-600 dark:text-slate-400">{s.description}</div>
                  <div className="overflow-x-auto text-slate-900 dark:text-slate-100">
                    <MathTex tex={s.latex} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
