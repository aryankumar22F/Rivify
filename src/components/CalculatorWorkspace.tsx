import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileDown,
  Minus,
  PenTool,
  Plus,
  Share2,
  Sparkles,
} from 'lucide-react';
import {
  CalculateActionButton,
  ClearAllActionButton,
  type ActionStatus,
} from './ActionButtons';
import {
  solveDirectionalDerivative,
  solveGradient,
  solveLinearApproximation,
  solveMaximaMinima,
  solvePartialDerivative,
  solveVectorField,
  type DirectionalDerivativeResult,
  type GradientResult,
  type LinearApproxResult,
  type MaximaMinimaResult,
  type PartialDerivativeResult,
  type VectorFieldResult,
} from '../engine/calculus';
import { validateExpression } from '../engine/symbolic';
import type {
  AppSettings,
  CalculatorSubTab,
  DerivationStep,
  HistoryItem,
} from '../types';
import {
  downloadSingleSolutionPdf,
  shareSolutionText,
  triggerHaptic,
} from '../utils/pdfReport';
import { GraphPanel } from './GraphPanel';
import { HandwritingPadModal } from './HandwritingPadModal';
import { HistoryPanel } from './HistoryPanel';
import { MathTex } from './MathTex';

export type CalcToolId = HistoryItem['tool'];

interface CalculatorWorkspaceProps {
  activeTool: CalcToolId;
  subTab: CalculatorSubTab;
  onSubTabChange: (t: CalculatorSubTab) => void;
  settings: AppSettings;
  history: HistoryItem[];
  onSaveHistory: (item: HistoryItem) => void;
  onToggleBookmark: (id: string) => void;
  onDeleteHistory: (id: string) => void;
  onClearHistory: () => void;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
  externalLoad?: {
    tool: CalcToolId;
    expr: string;
    secondary?: string;
    payload?: Record<string, string | number>;
    nonce: number;
  } | null;
}

const TOOL_PRESETS: Record<CalcToolId, { label: string; expr: string; secondary?: string }[]> = {
  'partial-derivative': [
    { label: '2x²y³', expr: '2*x^2*y^3', secondary: 'x' },
    { label: 'sin(xy) + eˣ', expr: 'sin(x*y) + e^x', secondary: 'x' },
    { label: 'x / y', expr: 'x/y', secondary: 'y' },
    { label: 'ln(x² + y²)', expr: 'ln(x^2 + y^2)', secondary: 'x' },
  ],
  gradient: [
    { label: 'x²y + 3y', expr: 'x^2*y + 3*y' },
    { label: 'e^(x²−y²)', expr: 'e^(x^2 - y^2)' },
    { label: 'x·sin(y) + z²', expr: 'x*sin(y) + z^2' },
  ],
  'directional-derivative': [
    { label: 'x² + y²', expr: 'x^2 + y^2' },
    { label: 'x·e^y', expr: 'x*e^y' },
    { label: 'sin(x)cos(y)', expr: 'sin(x)*cos(y)' },
  ],
  'maxima-minima': [
    { label: 'Saddle x² − y²', expr: 'x^2 - y^2' },
    { label: 'Bowl x² + y² − 4x', expr: 'x^2 + y^2 - 4*x + 2*y' },
    { label: 'Monkey Saddle', expr: 'x^3 - 3*x*y^2' },
  ],
  'linear-approximation': [
    { label: 'x² + 2y²', expr: 'x^2 + 2*y^2' },
    { label: '√(x² + y²)', expr: 'sqrt(x^2 + y^2)' },
    { label: 'e^(x·y)', expr: 'e^(x*y)' },
  ],
  'vector-field': [
    { label: 'Vortex ⟨−y, x⟩', expr: '-y', secondary: 'x' },
    { label: 'Radial ⟨x, y⟩', expr: 'x', secondary: 'y' },
    { label: 'Conservative ⟨2xy, x²+1⟩', expr: '2*x*y', secondary: 'x^2 + 1' },
  ],
};

const TOOL_TITLES: Record<CalcToolId, string> = {
  'partial-derivative': 'Partial Derivative',
  gradient: 'Gradient',
  'directional-derivative': 'Directional Derivative',
  'maxima-minima': 'Maxima & Minima Test',
  'linear-approximation': 'Linear Approximation',
  'vector-field': 'Vector Field',
};

export function CalculatorWorkspace({
  activeTool,
  subTab,
  onSubTabChange,
  settings,
  history,
  onSaveHistory,
  onToggleBookmark,
  onDeleteHistory,
  onClearHistory,
  onSaveToNotebook,
  externalLoad,
}: CalculatorWorkspaceProps) {
  const [expr, setExpr] = useState('2*x^2*y^3');
  const [variable, setVariable] = useState('x');
  const [order, setOrder] = useState(1);

  const [ptX, setPtX] = useState('1');
  const [ptY, setPtY] = useState('2');
  const [ptZ, setPtZ] = useState('1');

  const [dirX, setDirX] = useState('3');
  const [dirY, setDirY] = useState('4');
  const [dirZ, setDirZ] = useState('0');

  const [targetX, setTargetX] = useState('1.1');
  const [targetY, setTargetY] = useState('1.9');

  const [vecP, setVecP] = useState('-y');
  const [vecQ, setVecQ] = useState('x');

  const [showSteps, setShowSteps] = useState(settings.autoExpandSteps);
  const [copied, setCopied] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState(false);
  const [savedNoteFeedback, setSavedNoteFeedback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [handwritingOpen, setHandwritingOpen] = useState(false);

  const [calcStatus, setCalcStatus] = useState<ActionStatus>('idle');
  const [evalStatus, setEvalStatus] = useState<ActionStatus>('idle');
  const [calcSuccessMsg, setCalcSuccessMsg] = useState<string | null>(null);
  const [evalFeedback, setEvalFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [clearedFeedback, setClearedFeedback] = useState(false);

  const calcLockRef = useRef(false);
  const evalLockRef = useRef(false);
  const calcTimerRef = useRef<number | null>(null);
  const evalTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const [partialRes, setPartialRes] = useState<PartialDerivativeResult | null>(null);
  const [gradRes, setGradRes] = useState<GradientResult | null>(null);
  const [dirRes, setDirRes] = useState<DirectionalDerivativeResult | null>(null);
  const [maxMinRes, setMaxMinRes] = useState<MaximaMinimaResult | null>(null);
  const [linRes, setLinRes] = useState<LinearApproxResult | null>(null);
  const [vfRes, setVfRes] = useState<VectorFieldResult | null>(null);

  const [graphExpr, setGraphExpr] = useState('2*x^2*y^3');
  const [graphSecondary, setGraphSecondary] = useState<string | undefined>(undefined);
  const [graphDeriv, setGraphDeriv] = useState<string | undefined>('4*x*y^3');

  useEffect(() => {
    return () => {
      if (calcTimerRef.current) window.clearTimeout(calcTimerRef.current);
      if (evalTimerRef.current) window.clearTimeout(evalTimerRef.current);
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const liveValidation = useMemo(() => {
    if (activeTool === 'vector-field') {
      const vp = validateExpression(vecP);
      const vq = validateExpression(vecQ);
      if (!vp.valid) return { valid: false, error: `P(x,y): ${vp.error}`, variables: [] };
      if (!vq.valid) return { valid: false, error: `Q(x,y): ${vq.error}`, variables: [] };
      return {
        valid: true,
        variables: Array.from(new Set([...vp.variables, ...vq.variables])).sort(),
      };
    }
    return validateExpression(expr);
  }, [activeTool, expr, vecP, vecQ]);

  const fmt = (n: number) => Number(n.toFixed(settings.precision)).toString();

  const runCalculation = (
    saveToHistory: boolean,
    overrides?: {
      tool?: CalcToolId;
      expr?: string;
      variable?: string;
      order?: number;
      vecP?: string;
      vecQ?: string;
    }
  ): boolean => {
    const tool = overrides?.tool ?? activeTool;
    const activeExpr = overrides?.expr ?? expr;
    const activeVar = overrides?.variable ?? variable;
    const activeOrder = overrides?.order ?? order;
    const activeP = overrides?.vecP ?? vecP;
    const activeQ = overrides?.vecQ ?? vecQ;

    setErrorMsg(null);
    if (saveToHistory) {
      triggerHaptic(settings.hapticsEnabled, 14);
    }
    const numX = Number(ptX);
    const numY = Number(ptY);
    const numZ = Number(ptZ);
    const pointScope: Record<string, number> = {};
    if (ptX !== '' && Number.isFinite(numX)) pointScope.x = numX;
    if (ptY !== '' && Number.isFinite(numY)) pointScope.y = numY;
    if (ptZ !== '' && Number.isFinite(numZ)) pointScope.z = numZ;

    try {
      if (tool === 'partial-derivative') {
        const res = solvePartialDerivative(activeExpr, activeVar, activeOrder, pointScope, settings.angleUnit);
        setPartialRes(res);
        setGraphExpr(activeExpr);
        setGraphSecondary(undefined);
        setGraphDeriv(res.plain);
        if (saveToHistory) {
          onSaveHistory({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool,
            toolLabel: `${TOOL_TITLES[tool]} (Order ${activeOrder})`,
            expression: activeExpr,
            secondaryInput: `∂/∂${activeVar}`,
            resultLatex: res.fullEquationLatex,
            resultPlain: res.plain,
            steps: res.steps,
            timestamp: Date.now(),
            payload: { expr: activeExpr, variable: activeVar, order: activeOrder },
          });
        }
      } else if (tool === 'gradient') {
        const res = solveGradient(activeExpr, pointScope, settings.angleUnit);
        setGradRes(res);
        setGraphExpr(activeExpr);
        setGraphSecondary(undefined);
        setGraphDeriv(res.components[0]?.plain);
        if (saveToHistory) {
          onSaveHistory({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool,
            toolLabel: TOOL_TITLES[tool],
            expression: activeExpr,
            resultLatex: res.vectorLatex,
            resultPlain: `<${res.components.map((c) => c.plain).join(', ')}>`,
            steps: res.components.flatMap((c) => c.steps),
            timestamp: Date.now(),
            payload: { expr: activeExpr },
          });
        }
      } else if (tool === 'directional-derivative') {
        const dVec = [Number(dirX) || 0, Number(dirY) || 0, Number(dirZ) || 0];
        const res = solveDirectionalDerivative(activeExpr, pointScope, dVec, settings.angleUnit);
        setDirRes(res);
        setGraphExpr(activeExpr);
        setGraphSecondary(undefined);
        setGraphDeriv(undefined);
        if (saveToHistory) {
          onSaveHistory({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool,
            toolLabel: TOOL_TITLES[tool],
            expression: activeExpr,
            secondaryInput: `v=⟨${dirX},${dirY}⟩ at (${ptX},${ptY})`,
            resultLatex: `D_{\\mathbf{u}} f(P) = ${fmt(res.directionalValue)}`,
            resultPlain: `${fmt(res.directionalValue)}`,
            steps: res.steps,
            timestamp: Date.now(),
            payload: { expr: activeExpr },
          });
        }
      } else if (tool === 'maxima-minima') {
        const x0 = Number(ptX);
        const y0 = Number(ptY);
        if (!Number.isFinite(x0) || !Number.isFinite(y0)) {
          throw new Error('Provide valid numeric test coordinates (x₀, y₀)');
        }
        const res = solveMaximaMinima(activeExpr, x0, y0, settings.angleUnit);
        setMaxMinRes(res);
        setGraphExpr(activeExpr);
        setGraphSecondary(undefined);
        setGraphDeriv(undefined);
        if (saveToHistory) {
          onSaveHistory({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool,
            toolLabel: TOOL_TITLES[tool],
            expression: activeExpr,
            secondaryInput: `(${x0}, ${y0})`,
            resultLatex: `D = ${fmt(res.discriminant)} \\;\\text{(${res.classification})}`,
            resultPlain: `${res.classification}, D = ${fmt(res.discriminant)}`,
            steps: res.steps,
            timestamp: Date.now(),
            payload: { expr: activeExpr },
          });
        }
      } else if (tool === 'linear-approximation') {
        const x0 = Number(ptX);
        const y0 = Number(ptY);
        if (!Number.isFinite(x0) || !Number.isFinite(y0)) {
          throw new Error('Provide valid numeric anchor coordinates (x₀, y₀)');
        }
        const tx = targetX !== '' ? Number(targetX) : undefined;
        const ty = targetY !== '' ? Number(targetY) : undefined;
        const res = solveLinearApproximation(activeExpr, x0, y0, tx, ty, settings.angleUnit);
        setLinRes(res);
        setGraphExpr(activeExpr);
        setGraphSecondary(undefined);
        setGraphDeriv(undefined);
        if (saveToHistory) {
          onSaveHistory({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool,
            toolLabel: TOOL_TITLES[tool],
            expression: activeExpr,
            secondaryInput: `at (${x0}, ${y0})`,
            resultLatex: res.tangentPlaneLatex,
            resultPlain: res.tangentPlanePlain,
            steps: res.steps,
            timestamp: Date.now(),
            payload: { expr: activeExpr },
          });
        }
      } else if (tool === 'vector-field') {
        const x0 = ptX !== '' ? Number(ptX) : undefined;
        const y0 = ptY !== '' ? Number(ptY) : undefined;
        const res = solveVectorField(activeP, activeQ, x0, y0, settings.angleUnit);
        setVfRes(res);
        setGraphExpr(activeP);
        setGraphSecondary(activeQ);
        setGraphDeriv(undefined);
        if (saveToHistory) {
          onSaveHistory({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool,
            toolLabel: TOOL_TITLES[tool],
            expression: `⟨${activeP}, ${activeQ}⟩`,
            resultLatex: `\\nabla\\cdot\\mathbf{F} = ${res.divLatex},\\; \\operatorname{curl}\\mathbf{F} = ${res.curlLatex}`,
            resultPlain: `div=${res.divLatex}, curl=${res.curlLatex}`,
            steps: res.steps,
            timestamp: Date.now(),
            payload: { vecP: activeP, vecQ: activeQ },
          });
        }
      }
      return true;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Unable to evaluate expression');
      return false;
    }
  };

  const handleCalculateSubmit = async () => {
    if (calcLockRef.current) return;
    calcLockRef.current = true;
    if (calcTimerRef.current) window.clearTimeout(calcTimerRef.current);
    setClearedFeedback(false);
    setCalcSuccessMsg(null);
    setErrorMsg(null);
    setCalcStatus('calculating');

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 140);
      });
    });

    const ok = runCalculation(true);
    calcLockRef.current = false;

    if (ok) {
      setCalcStatus('success');
      setCalcSuccessMsg('Calculation completed');
      calcTimerRef.current = window.setTimeout(() => {
        setCalcStatus('idle');
        setCalcSuccessMsg(null);
      }, 2000);
    } else {
      setCalcStatus('error');
      calcTimerRef.current = window.setTimeout(() => {
        setCalcStatus('idle');
      }, 2200);
    }
  };

  const handleEvaluatePoint = async () => {
    if (evalLockRef.current) return;
    evalLockRef.current = true;
    if (evalTimerRef.current) window.clearTimeout(evalTimerRef.current);
    setEvalFeedback(null);
    setEvalStatus('calculating');
    triggerHaptic(settings.hapticsEnabled, 10);

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 140);
      });
    });

    try {
      if (activeTool === 'vector-field') {
        if (!vecP.trim() || !vecQ.trim()) {
          throw new Error('Enter P(x, y) and Q(x, y) expressions before evaluating.');
        }
        if (ptX === '' || ptY === '' || !Number.isFinite(Number(ptX)) || !Number.isFinite(Number(ptY))) {
          throw new Error('Provide numeric coordinates (x, y) to evaluate.');
        }
      } else {
        if (!expr.trim()) {
          throw new Error('Enter a function f(...) before evaluating at a point.');
        }
        if (ptX === '' || !Number.isFinite(Number(ptX))) {
          throw new Error('Provide a numeric x coordinate to evaluate.');
        }
        if (
          (activeTool !== 'partial-derivative' || liveValidation.variables.includes('y')) &&
          (ptY === '' || !Number.isFinite(Number(ptY)))
        ) {
          throw new Error('Provide a numeric y coordinate to evaluate.');
        }
        if (liveValidation.variables.includes('z') && (ptZ === '' || !Number.isFinite(Number(ptZ)))) {
          throw new Error('Provide a numeric z coordinate to evaluate.');
        }
      }

      const ok = runCalculation(false);
      if (!ok) {
        throw new Error('Unable to evaluate at the given point.');
      }

      setEvalStatus('success');
      setEvalFeedback({ kind: 'success', text: 'Evaluated successfully' });
      evalTimerRef.current = window.setTimeout(() => {
        setEvalStatus('idle');
        setEvalFeedback(null);
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to evaluate at point';
      setEvalStatus('error');
      setEvalFeedback({ kind: 'error', text: msg });
      evalTimerRef.current = window.setTimeout(() => {
        setEvalStatus('idle');
      }, 2200);
    } finally {
      evalLockRef.current = false;
    }
  };

  useEffect(() => {
    runCalculation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setClearedFeedback(false);
    setCalcSuccessMsg(null);
    setEvalFeedback(null);
    setCalcStatus('idle');
    setEvalStatus('idle');
    if (activeTool === 'maxima-minima' && expr === '2*x^2*y^3') {
      setExpr('x^2 - y^2');
      setPtX('0');
      setPtY('0');
      runCalculation(false, { tool: 'maxima-minima', expr: 'x^2 - y^2' });
    } else if (activeTool === 'vector-field') {
      runCalculation(false, { tool: 'vector-field', vecP, vecQ });
    } else {
      runCalculation(false, { tool: activeTool });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, settings.angleUnit]);

  useEffect(() => {
    if (!externalLoad) return;
    if (externalLoad.tool === 'vector-field') {
      const pVal = externalLoad.expr;
      const qVal = externalLoad.secondary ?? 'x';
      setVecP(pVal);
      setVecQ(qVal);
      runCalculation(false, { tool: 'vector-field', vecP: pVal, vecQ: qVal });
    } else {
      setExpr(externalLoad.expr);
      const nextVar = externalLoad.secondary ?? variable;
      const nextOrd = typeof externalLoad.payload?.order === 'number' ? externalLoad.payload.order : 1;
      if (externalLoad.secondary) setVariable(externalLoad.secondary);
      setOrder(nextOrd);
      runCalculation(false, {
        tool: externalLoad.tool,
        expr: externalLoad.expr,
        variable: nextVar,
        order: nextOrd,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLoad?.nonce]);

  const handleClear = () => {
    triggerHaptic(settings.hapticsEnabled, 8);
    if (calcTimerRef.current) window.clearTimeout(calcTimerRef.current);
    if (evalTimerRef.current) window.clearTimeout(evalTimerRef.current);
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);

    setErrorMsg(null);
    setCalcSuccessMsg(null);
    setEvalFeedback(null);
    setCalcStatus('idle');
    setEvalStatus('idle');
    setGraphSecondary(undefined);
    setGraphDeriv(undefined);
    setPtX('');
    setPtY('');
    setPtZ('');

    if (activeTool === 'vector-field') {
      setVecP('');
      setVecQ('');
      setVfRes(null);
    } else {
      setExpr('');
      if (activeTool === 'partial-derivative') {
        setVariable('');
        setOrder(1);
      } else if (activeTool === 'directional-derivative') {
        setDirX('');
        setDirY('');
        setDirZ('');
      } else if (activeTool === 'linear-approximation') {
        setTargetX('');
        setTargetY('');
      }
      setPartialRes(null);
      setGradRes(null);
      setDirRes(null);
      setMaxMinRes(null);
      setLinRes(null);
    }

    setClearedFeedback(true);
    clearTimerRef.current = window.setTimeout(() => {
      setClearedFeedback(false);
    }, 2200);
  };

  let activeSteps: DerivationStep[] = [];
  let copyText = '';
  if (activeTool === 'partial-derivative' && partialRes) {
    activeSteps = partialRes.steps;
    copyText = partialRes.plain;
  } else if (activeTool === 'gradient' && gradRes) {
    activeSteps = gradRes.components.flatMap((c) => c.steps);
    copyText = `<${gradRes.components.map((c) => c.plain).join(', ')}>`;
  } else if (activeTool === 'directional-derivative' && dirRes) {
    activeSteps = dirRes.steps;
    copyText = fmt(dirRes.directionalValue);
  } else if (activeTool === 'maxima-minima' && maxMinRes) {
    activeSteps = maxMinRes.steps;
    copyText = `${maxMinRes.classification} (D = ${fmt(maxMinRes.discriminant)})`;
  } else if (activeTool === 'linear-approximation' && linRes) {
    activeSteps = linRes.steps;
    copyText = linRes.tangentPlanePlain;
  } else if (activeTool === 'vector-field' && vfRes) {
    activeSteps = vfRes.steps;
    copyText = `div = ${vfRes.divLatex}, curl = ${vfRes.curlLatex}`;
  }

  const handleCopy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      triggerHaptic(settings.hapticsEnabled, 10);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const activeInputSummary =
    activeTool === 'vector-field' ? `⟨${vecP}, ${vecQ}⟩` : expr;

  const handleExportPdf = () => {
    if (!copyText) return;
    triggerHaptic(settings.hapticsEnabled, 12);
    downloadSingleSolutionPdf({
      title: TOOL_TITLES[activeTool],
      expression: activeInputSummary,
      secondary:
        activeTool === 'partial-derivative'
          ? `Variable(s): ${variable}, Order: ${order}`
          : undefined,
      resultPlain: copyText,
      steps: activeSteps,
    });
  };

  const handleShareResult = async () => {
    if (!copyText) return;
    triggerHaptic(settings.hapticsEnabled, 10);
    await shareSolutionText(
      `RIVIFY · ${TOOL_TITLES[activeTool]}`,
      `f = ${activeInputSummary}\nResult: ${copyText}`
    );
    setSharedFeedback(true);
    setTimeout(() => setSharedFeedback(false), 1600);
  };

  const handleClipToNotebook = () => {
    if (!copyText) return;
    triggerHaptic(settings.hapticsEnabled, 12);
    onSaveToNotebook({
      title: `${TOOL_TITLES[activeTool]}: ${activeInputSummary}`,
      topic: TOOL_TITLES[activeTool],
      content: `Expression: $${activeInputSummary}$\n\nResult: \`${copyText}\`\n\n${activeSteps
        .map((st, idx) => `${idx + 1}. **${st.rule}**: ${st.description}\n$$${st.latex}$$`)
        .join('\n\n')}`,
    });
    setSavedNoteFeedback(true);
    setTimeout(() => setSavedNoteFeedback(false), 1800);
  };

  const handleRestoreHistory = (item: HistoryItem) => {
    if (item.tool === 'vector-field') {
      const pVal = String(item.payload.vecP ?? '-y');
      const qVal = String(item.payload.vecQ ?? 'x');
      setVecP(pVal);
      setVecQ(qVal);
      runCalculation(false, { tool: 'vector-field', vecP: pVal, vecQ: qVal });
    } else {
      const eVal = String(item.payload.expr ?? item.expression);
      const vVal = String(item.payload.variable ?? 'x');
      const oVal = Number(item.payload.order ?? 1);
      setExpr(eVal);
      setVariable(vVal);
      setOrder(oVal);
      runCalculation(false, { tool: item.tool, expr: eVal, variable: vVal, order: oVal });
    }
    onSubTabChange('calculator');
  };

  if (subTab === 'history') {
    return (
      <div className="max-w-4xl mx-auto">
        <HistoryPanel
          items={history}
          onRestore={handleRestoreHistory}
          onToggleBookmark={onToggleBookmark}
          onDelete={onDeleteHistory}
          onClearAll={onClearHistory}
        />
      </div>
    );
  }

  const anchorPt =
    Number.isFinite(Number(ptX)) && Number.isFinite(Number(ptY))
      ? { x: Number(ptX), y: Number(ptY) }
      : undefined;

  if (subTab === 'graph') {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <GraphPanel
          tool={activeTool}
          expression={graphExpr}
          secondaryExpr={graphSecondary}
          derivativeExpr={graphDeriv}
          anchorPoint={anchorPt}
          tangentPlane={
            activeTool === 'linear-approximation' && linRes && anchorPt
              ? {
                  f0: linRes.f0,
                  fx0: linRes.fx0,
                  fy0: linRes.fy0,
                  x0: anchorPt.x,
                  y0: anchorPt.y,
                }
              : undefined
          }
          gradientAtAnchor={
            gradRes?.evaluatedVector
              ? { gx: gradRes.evaluatedVector[0] ?? 0, gy: gradRes.evaluatedVector[1] ?? 0 }
              : undefined
          }
          angleUnit={settings.angleUnit}
          theme={settings.theme}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-6 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Examples:</span>
          {TOOL_PRESETS[activeTool].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                if (activeTool === 'vector-field') {
                  setVecP(p.expr);
                  setVecQ(p.secondary ?? 'x');
                  runCalculation(false, { tool: 'vector-field', vecP: p.expr, vecQ: p.secondary ?? 'x' });
                } else {
                  setExpr(p.expr);
                  if (p.secondary) setVariable(p.secondary);
                  runCalculation(false, {
                    tool: activeTool,
                    expr: p.expr,
                    variable: p.secondary ?? variable,
                  });
                }
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 dark:bg-[#232630] text-slate-700 dark:text-slate-300 hover:text-[#2F7CF6] dark:hover:text-[#60A5FA] border border-slate-200 dark:border-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input Card */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCalculateSubmit();
          }}
          className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#23252C] p-5 sm:p-6 space-y-5"
        >
          {activeTool === 'vector-field' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label
                  htmlFor="vec-p"
                  className="absolute -top-2.5 left-3 px-1.5 text-xs font-medium bg-white dark:bg-[#23252C] text-slate-500 dark:text-slate-400"
                >
                  Component P(x, y)
                </label>
                <input
                  id="vec-p"
                  type="text"
                  value={vecP}
                  onChange={(e) => setVecP(e.target.value)}
                  placeholder="-y"
                  className="w-full h-13 px-4 rounded-xl border border-slate-300 dark:border-white/25 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                />
              </div>

              <div className="relative">
                <label
                  htmlFor="vec-q"
                  className="absolute -top-2.5 left-3 px-1.5 text-xs font-medium bg-white dark:bg-[#23252C] text-slate-500 dark:text-slate-400"
                >
                  Component Q(x, y)
                </label>
                <input
                  id="vec-q"
                  type="text"
                  value={vecQ}
                  onChange={(e) => setVecQ(e.target.value)}
                  placeholder="x"
                  className="w-full h-13 px-4 rounded-xl border border-slate-300 dark:border-white/25 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="relative">
                <label
                  htmlFor="func-expr"
                  className="absolute -top-2.5 left-3 px-1.5 text-xs font-medium bg-white dark:bg-[#23252C] text-slate-500 dark:text-slate-400"
                >
                  Function f(...)
                </label>
                <input
                  id="func-expr"
                  type="text"
                  value={expr}
                  onChange={(e) => setExpr(e.target.value)}
                  placeholder="2*x^2*y^3"
                  className={`w-full h-13 pl-4 pr-12 rounded-xl border bg-transparent font-mono text-sm sm:text-base text-slate-900 dark:text-white focus:outline-none ${
                    liveValidation.valid
                      ? 'border-slate-300 dark:border-white/25 focus:border-[#2F7CF6]'
                      : 'border-amber-500/70 focus:border-amber-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setHandwritingOpen(true)}
                  aria-label="Write equation by hand"
                  title="Handwritten Equation Input"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-[#2F7CF6] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <PenTool className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between px-1 text-[11px]">
                {liveValidation.valid ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    Variables:{' '}
                    {liveValidation.variables.length > 0
                      ? liveValidation.variables.join(', ')
                      : 'constant'}
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    Syntax hint: {liveValidation.error}
                  </span>
                )}
              </div>
            </div>
          )}

          {activeTool === 'partial-derivative' && (() => {
            const varSeqCount =
              variable.split(/[\s,]+/).filter(Boolean).length > 1
                ? variable.split(/[\s,]+/).filter(Boolean).length
                : variable.replace(/[^a-zA-Z]/g, '').length;
            const isMixedChain = varSeqCount > 1;
            return (
              <>
                <div className="space-y-1.5">
                  <div className="relative">
                    <label
                      htmlFor="diff-var"
                      className="absolute -top-2.5 left-3 px-1.5 text-xs font-medium bg-white dark:bg-[#23252C] text-slate-500 dark:text-slate-400"
                    >
                      Variable(s) (e.g. x or x, y)
                    </label>
                    <input
                      id="diff-var"
                      type="text"
                      maxLength={14}
                      value={variable}
                      onChange={(e) =>
                        setVariable(e.target.value.replace(/[^a-zA-Z,\s]/g, ''))
                      }
                      placeholder="x or x, y"
                      className="w-full h-13 pl-4 pr-24 rounded-xl border border-slate-300 dark:border-white/25 bg-transparent font-mono text-sm sm:text-base text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                    />
                    <button
                      type="button"
                      onClick={() => setVariable(variable === 'x, y' ? 'x' : 'x, y')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-[#2F7CF6]"
                    >
                      {variable === 'x, y' ? 'Single x' : 'Mixed x,y'}
                    </button>
                  </div>
                  <p className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Enter one variable with Order below, or comma-separated variables like{' '}
                    <code className="font-mono">x, y</code> for mixed partials (Clairaut’s Theorem).
                  </p>
                </div>

                <div className="border-t border-b border-slate-200 dark:border-white/10 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Order:
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={isMixedChain}
                        aria-label="Decrease derivative order"
                        onClick={() => setOrder((o) => Math.max(1, o - 1))}
                        className="w-10 h-10 rounded-full border border-slate-300 dark:border-white/30 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center text-lg font-medium text-slate-900 dark:text-white tabular-nums">
                        {isMixedChain ? varSeqCount : order}
                      </span>
                      <button
                        type="button"
                        disabled={isMixedChain}
                        aria-label="Increase derivative order"
                        onClick={() => setOrder((o) => Math.min(5, o + 1))}
                        className="w-10 h-10 rounded-full border border-slate-300 dark:border-white/30 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isMixedChain && (
                    <span className="text-[11px] text-[#2F7CF6] font-medium">
                      Mixed sequence active
                    </span>
                  )}
                </div>
              </>
            );
          })()}

          {activeTool === 'directional-derivative' && (
            <div className="space-y-3 pt-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Direction Vector v = ⟨vₓ, vᵧ, v_z⟩
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  step="any"
                  value={dirX}
                  onChange={(e) => setDirX(e.target.value)}
                  aria-label="Direction x component"
                  placeholder="vx"
                  className="h-11 px-3 rounded-xl border border-slate-300 dark:border-white/25 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6] tabular-nums"
                />
                <input
                  type="number"
                  step="any"
                  value={dirY}
                  onChange={(e) => setDirY(e.target.value)}
                  aria-label="Direction y component"
                  placeholder="vy"
                  className="h-11 px-3 rounded-xl border border-slate-300 dark:border-white/25 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6] tabular-nums"
                />
                <input
                  type="number"
                  step="any"
                  value={dirZ}
                  onChange={(e) => setDirZ(e.target.value)}
                  aria-label="Direction z component"
                  placeholder="vz"
                  className="h-11 px-3 rounded-xl border border-slate-300 dark:border-white/25 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6] tabular-nums"
                />
              </div>
            </div>
          )}

          {activeTool === 'linear-approximation' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="relative">
                <label
                  htmlFor="target-x"
                  className="absolute -top-2.5 left-3 px-1.5 text-xs font-medium bg-white dark:bg-[#23252C] text-slate-500 dark:text-slate-400"
                >
                  Approx target x
                </label>
                <input
                  id="target-x"
                  type="number"
                  step="any"
                  value={targetX}
                  onChange={(e) => setTargetX(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/25 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6] tabular-nums"
                />
              </div>
              <div className="relative">
                <label
                  htmlFor="target-y"
                  className="absolute -top-2.5 left-3 px-1.5 text-xs font-medium bg-white dark:bg-[#23252C] text-slate-500 dark:text-slate-400"
                >
                  Approx target y
                </label>
                <input
                  id="target-y"
                  type="number"
                  step="any"
                  value={targetY}
                  onChange={(e) => setTargetY(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/25 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6] tabular-nums"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <ClearAllActionButton
                label="Clear All"
                clearedLabel="Cleared"
                cleared={clearedFeedback}
                onClick={handleClear}
              />
              <CalculateActionButton
                type="submit"
                label="Calculate"
                calculatingLabel="Calculating..."
                successLabel="Calculated"
                status={calcStatus}
              />
            </div>

            {(clearedFeedback || calcSuccessMsg) && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-end gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-1"
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{clearedFeedback ? 'Cleared successfully' : calcSuccessMsg}</span>
              </div>
            )}
          </div>
        </form>

        {/* Result Card */}
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2A2B33] p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">Result</h3>
            <div className="flex flex-wrap items-center gap-1">
              {copyText && (
                <>
                  <button
                    type="button"
                    onClick={handleClipToNotebook}
                    aria-label="Save result to notebook"
                    title="Save to Math Notebook"
                    className="min-h-[36px] min-w-[36px] rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    {savedNoteFeedback ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <BookmarkPlus className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    aria-label="Export solution as PDF"
                    title="Export Solution PDF"
                    className="min-h-[36px] min-w-[36px] rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <FileDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareResult()}
                    aria-label="Share solution"
                    title="Share Solution"
                    className="min-h-[36px] min-w-[36px] rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    {sharedFeedback ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                  </button>
                </>
              )}
              {activeSteps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSteps((s) => !s)}
                  aria-label="Toggle step-by-step derivation"
                  className="min-h-[36px] px-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                >
                  <span>Steps</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy result"
                className="min-h-[36px] min-w-[36px] rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div
            aria-live="polite"
            className="min-h-[76px] flex flex-col items-center justify-center overflow-x-auto py-2 text-slate-900 dark:text-white"
          >
            {activeTool === 'partial-derivative' && partialRes && (
              <MathTex tex={partialRes.fullEquationLatex} display />
            )}

            {activeTool === 'gradient' && gradRes && (
              <MathTex tex={gradRes.vectorLatex} display />
            )}

            {activeTool === 'directional-derivative' && dirRes && (
              <div className="space-y-2 text-center">
                <MathTex
                  tex={`D_{\\mathbf{u}} f(P) = ${fmt(dirRes.directionalValue)}`}
                  display
                />
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <MathTex tex={dirRes.gradient.vectorLatex} />
                </div>
              </div>
            )}

            {activeTool === 'maxima-minima' && maxMinRes && (
              <div className="w-full space-y-3 text-center">
                <div className="text-lg font-semibold text-[#2F7CF6] dark:text-[#60A5FA]">
                  {maxMinRes.classification}
                </div>
                <MathTex
                  tex={`D(${ptX}, ${ptY}) = ${fmt(maxMinRes.discriminant)},\\quad f_{xx} = ${fmt(
                    maxMinRes.fxxVal
                  )},\\quad f_{yy} = ${fmt(maxMinRes.fyyVal)}`}
                  display
                />
                {maxMinRes.detectedCriticalPoints.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-left">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                      Detected Critical Points:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {maxMinRes.detectedCriticalPoints.map((cp, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setPtX(String(cp.x));
                            setPtY(String(cp.y));
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 dark:bg-[#191C24] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] tabular-nums"
                        >
                          ({cp.x}, {cp.y}) · {cp.classification}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTool === 'linear-approximation' && linRes && (
              <div className="space-y-2 text-center">
                <MathTex tex={linRes.tangentPlaneLatex} display />
                {linRes.approxAtTarget !== undefined && linRes.exactAtTarget !== undefined && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums space-x-3">
                    <span>L({targetX}, {targetY}) = {fmt(linRes.approxAtTarget)}</span>
                    <span>·</span>
                    <span>Exact f = {fmt(linRes.exactAtTarget)}</span>
                    <span>·</span>
                    <span>Error = {fmt(linRes.error ?? 0)}</span>
                  </div>
                )}
              </div>
            )}

            {activeTool === 'vector-field' && vfRes && (
              <div className="space-y-2 text-center">
                <MathTex
                  tex={`\\nabla \\cdot \\mathbf{F} = ${vfRes.divLatex}, \\qquad \\operatorname{curl}_{2D}(\\mathbf{F}) = ${vfRes.curlLatex}`}
                  display
                />
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {vfRes.isConservative
                    ? 'Conservative (Irrotational) Field'
                    : 'Non-Conservative (Rotational) Field'}
                </div>
              </div>
            )}
          </div>

          {showSteps && activeSteps.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-3">
              <button
                type="button"
                onClick={() => setShowSteps(false)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#2F7CF6]" />
                  Step-by-Step Symbolic Derivation
                </span>
                <ChevronUp className="w-4 h-4" />
              </button>
              <div className="space-y-2.5">
                {activeSteps.map((st, idx) => (
                  <div
                    key={st.id}
                    className="rounded-xl bg-slate-50 dark:bg-[#191C24] border border-slate-200 dark:border-white/10 p-3.5 space-y-1.5"
                  >
                    <div className="text-xs font-semibold text-[#2F7CF6] dark:text-[#60A5FA]">
                      {idx + 1}. {st.rule}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{st.description}</p>
                    <div className="overflow-x-auto text-slate-900 dark:text-slate-100 pt-1">
                      <MathTex tex={st.latex} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showSteps && activeSteps.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSteps(true)}
              className="w-full pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <span>View {activeSteps.length} derivation steps</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Evaluate at a Point Card */}
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#23252C] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">
              Evaluate at a Point
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">
              {settings.angleUnit}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="relative">
              <label
                htmlFor="pt-x"
                className="absolute -top-2 left-2.5 px-1 text-[11px] font-mono bg-white dark:bg-[#23252C] text-slate-500 dark:text-slate-400"
              >
                x
              </label>
              <input
                id="pt-x"
                type="number"
                step="any"
                value={ptX}
                onChange={(e) => setPtX(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-[#2F7CF6]"
              />
            </div>

            <div className="relative">
              <label
                htmlFor="pt-y"
                className="absolute -top-2 left-2.5 px-1 text-[11px] font-mono bg-white dark:bg-[#23252C] text-slate-500 dark:text-slate-400"
              >
                y
              </label>
              <input
                id="pt-y"
                type="number"
                step="any"
                value={ptY}
                onChange={(e) => setPtY(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-[#2F7CF6]"
              />
            </div>

            <div className="relative">
              <label
                htmlFor="pt-z"
                className="absolute -top-2 left-2.5 px-1 text-[11px] font-mono bg-white dark:bg-[#23252C] text-slate-500 dark:text-slate-400"
              >
                z
              </label>
              <input
                id="pt-z"
                type="number"
                step="any"
                value={ptZ}
                onChange={(e) => setPtZ(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-[#2F7CF6]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-sm font-mono tabular-nums text-slate-800 dark:text-slate-100">
              {activeTool === 'partial-derivative' && partialRes?.evaluatedValue !== undefined && (
                <span>
                  Value = <strong>{fmt(partialRes.evaluatedValue)}</strong>
                </span>
              )}
              {activeTool === 'gradient' && gradRes?.evaluatedVector && (
                <span>
                  ∇f(P) = ⟨{gradRes.evaluatedVector.map(fmt).join(', ')}⟩ · ||∇f|| ={' '}
                  <strong>{fmt(gradRes.magnitude ?? 0)}</strong>
                </span>
              )}
              {activeTool === 'directional-derivative' && dirRes && (
                <span>
                  D_u f(P) = <strong>{fmt(dirRes.directionalValue)}</strong>
                </span>
              )}
              {activeTool === 'maxima-minima' && maxMinRes && (
                <span>
                  f(P) = <strong>{fmt(maxMinRes.fVal)}</strong> · ∇f = ⟨{fmt(maxMinRes.fxVal)},{' '}
                  {fmt(maxMinRes.fyVal)}⟩
                </span>
              )}
              {activeTool === 'linear-approximation' && linRes && (
                <span>
                  f(P) = <strong>{fmt(linRes.f0)}</strong> · fx = {fmt(linRes.fx0)}, fy ={' '}
                  {fmt(linRes.fy0)}
                </span>
              )}
              {activeTool === 'vector-field' && vfRes && vfRes.evalP !== undefined && (
                <span>
                  F(P) = ⟨{fmt(vfRes.evalP)}, {fmt(vfRes.evalQ ?? 0)}⟩ · div ={' '}
                  {fmt(vfRes.evalDiv ?? 0)}
                </span>
              )}
            </div>

            <CalculateActionButton
              type="button"
              label="Evaluate"
              calculatingLabel="Calculating..."
              successLabel="Evaluated"
              status={evalStatus}
              size="sm"
              onClick={() => void handleEvaluatePoint()}
              className="shrink-0"
            />
          </div>

          {evalFeedback && (
            <div
              role={evalFeedback.kind === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={`rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 ${
                evalFeedback.kind === 'error'
                  ? 'border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300'
                  : 'border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {evalFeedback.kind === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Check className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{evalFeedback.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Column on Desktop */}
      <div className="hidden xl:block xl:col-span-6 space-y-5 sticky top-20">
        <GraphPanel
          tool={activeTool}
          expression={graphExpr}
          secondaryExpr={graphSecondary}
          derivativeExpr={graphDeriv}
          anchorPoint={anchorPt}
          tangentPlane={
            activeTool === 'linear-approximation' && linRes && anchorPt
              ? {
                  f0: linRes.f0,
                  fx0: linRes.fx0,
                  fy0: linRes.fy0,
                  x0: anchorPt.x,
                  y0: anchorPt.y,
                }
              : undefined
          }
          gradientAtAnchor={
            gradRes?.evaluatedVector
              ? { gx: gradRes.evaluatedVector[0] ?? 0, gy: gradRes.evaluatedVector[1] ?? 0 }
              : undefined
          }
          angleUnit={settings.angleUnit}
          theme={settings.theme}
        />

        {history.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Recent Calculations
              </span>
              <button
                type="button"
                onClick={() => onSubTabChange('history')}
                className="text-[#2F7CF6] hover:underline font-medium"
              >
                View all ({history.length})
              </button>
            </div>
            <div className="divide-y divide-slate-200/80 dark:divide-white/5">
              {history.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleRestoreHistory(item)}
                  className="w-full py-2 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 px-2 rounded-lg transition-colors"
                >
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate">
                    {item.expression}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    {item.toolLabel}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <HandwritingPadModal
        open={handwritingOpen}
        onClose={() => setHandwritingOpen(false)}
        onInsertExpression={(recognizedExpr) => {
          triggerHaptic(settings.hapticsEnabled, 14);
          setExpr(recognizedExpr);
          runCalculation(false, { expr: recognizedExpr });
        }}
      />
    </div>
  );
}
