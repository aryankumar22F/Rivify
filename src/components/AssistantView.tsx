import { Fragment, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpenCheck,
  Lightbulb,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { solvePartialDerivative } from '../engine/calculus';
import { MathTex } from './MathTex';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantViewProps {
  initialContext?: {
    tool: string;
    expression: string;
    result: string;
    nonce: number;
  } | null;
}

const STARTER_PROMPTS = [
  'Explain the multivariable Chain Rule with a step-by-step example.',
  'Why is the gradient vector ∇f always perpendicular to level curves?',
  'How do I classify a saddle point using the Hessian determinant D?',
  'What is the geometric difference between divergence and curl?',
];

function renderRichMathText(text: string) {
  const blockParts = text.split(/(\$\$[\s\S]*?\$\$)/g);
  return blockParts.map((part, bIdx) => {
    if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
      const tex = part.slice(2, -2).trim();
      return (
        <div key={`b-${bIdx}`} className="my-2 overflow-x-auto">
          <MathTex tex={tex} display />
        </div>
      );
    }
    const inlineParts = part.split(/(\$[^$\n]+?\$)/g);
    return (
      <Fragment key={`b-${bIdx}`}>
        {inlineParts.map((sub, iIdx) => {
          if (sub.startsWith('$') && sub.endsWith('$') && sub.length > 2) {
            return <MathTex key={`i-${iIdx}`} tex={sub.slice(1, -1)} />;
          }
          return (
            <span key={`i-${iIdx}`} className="whitespace-pre-wrap">
              {sub}
            </span>
          );
        })}
      </Fragment>
    );
  });
}

export function AssistantView({ initialContext }: AssistantViewProps) {
  const [mode, setMode] = useState<'chat' | 'check'>('chat');
  const [tutorMode, setTutorMode] = useState<'explain' | 'hint'>('explain');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<{
    tool: string;
    expression: string;
    result: string;
  } | null>(null);

  const [checkExpr, setCheckExpr] = useState('sin(x*y) + x^2');
  const [checkVar, setCheckVar] = useState('x');
  const [studentAttempt, setStudentAttempt] = useState('');
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);

  const lastRetryFnRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialContext) {
      setMode('chat');
      setActiveContext({
        tool: initialContext.tool,
        expression: initialContext.expression,
        result: initialContext.result,
      });
      setInput(
        `Walk me through the steps and intuition for ${initialContext.tool} of ${initialContext.expression}.`
      );
    }
  }, [initialContext]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const executeChat = async (historyToSend: ChatMessage[]) => {
    setLoading(true);
    setErrorMsg(null);
    lastRetryFnRef.current = () => executeChat(historyToSend);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyToSend.map((m) => ({ role: m.role, content: m.content })),
          tutorMode,
          context: activeContext ?? undefined,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Assistant request failed.');
      }
      lastRetryFnRef.current = null;
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: data.reply! },
      ]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to reach AI Calculus Assistant.'
      );
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textToSend) setInput('');
    executeChat(nextHistory);
  };

  const executeCheckWork = async () => {
    if (!checkExpr.trim() || !studentAttempt.trim() || loading) return;

    setLoading(true);
    setErrorMsg(null);
    setCheckFeedback(null);
    lastRetryFnRef.current = executeCheckWork;

    try {
      const expected = solvePartialDerivative(checkExpr, checkVar || 'x', 1);
      const res = await fetch('/api/assistant/check-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expression: checkExpr,
          variable: checkVar || 'x',
          expectedSymbolic: expected.plain,
          studentAttempt,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Solution check failed.');
      }
      lastRetryFnRef.current = null;
      setCheckFeedback(data.reply);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to check solution.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            AI Calculus Tutor
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Get step-by-step explanations, Socratic hints, or mistake diagnostics on your solutions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          {mode === 'chat' && (
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#111319] border border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setTutorMode('explain')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  tutorMode === 'explain'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Full Steps
              </button>
              <button
                type="button"
                onClick={() => setTutorMode('hint')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  tutorMode === 'hint'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Lightbulb className="w-3 h-3" />
                Hint Only
              </button>
            </div>
          )}

          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#111319] border border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('chat');
                setErrorMsg(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'chat'
                  ? 'bg-[#2F7CF6] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask Tutor
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('check');
                setErrorMsg(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'check'
                  ? 'bg-[#2F7CF6] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpenCheck className="w-3.5 h-3.5" />
              Check My Work
            </button>
          </div>
        </div>
      </div>

      {activeContext && mode === 'chat' && (
        <div className="rounded-xl border border-[#2F7CF6]/30 bg-[#2F7CF6]/8 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="text-slate-700 dark:text-slate-200 truncate">
            Context: <span className="font-semibold">{activeContext.tool}</span> ·{' '}
            <span className="font-mono">{activeContext.expression}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveContext(null)}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white shrink-0"
          >
            Clear context
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 flex items-center justify-between gap-3 text-sm text-rose-700 dark:text-rose-300"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          {lastRetryFnRef.current && (
            <button
              type="button"
              onClick={() => lastRetryFnRef.current?.()}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      )}

      {mode === 'chat' ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] overflow-hidden flex flex-col min-h-[460px] max-h-[68vh]">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="py-8 text-center space-y-5">
                <div className="w-11 h-11 rounded-2xl bg-[#2F7CF6]/15 text-[#2F7CF6] flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Personal Multivariable Calculus Tutor
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {tutorMode === 'hint'
                      ? 'Hint mode active: ask a problem and receive Socratic hints without spoiling the final answer.'
                      : 'Full Steps mode active: ask any question to get complete LaTeX derivations.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl mx-auto text-left">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#22252E] hover:border-[#2F7CF6] p-3 text-xs text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#2F7CF6] text-white'
                        : 'bg-slate-100 dark:bg-[#22252E] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {m.role === 'user' ? m.content : renderRichMathText(m.content)}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 bg-slate-100 dark:bg-[#22252E] text-slate-600 dark:text-slate-300 text-sm inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{tutorMode === 'hint' ? 'Preparing Socratic hint...' : 'Deriving explanation...'}</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="p-3.5 border-t border-slate-200 dark:border-white/10 flex items-center gap-2.5 bg-slate-50 dark:bg-[#14171E]"
          >
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                aria-label="Clear conversation"
                className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:text-rose-500 flex items-center justify-center transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                tutorMode === 'hint'
                  ? 'Ask for a hint on a problem...'
                  : 'Ask a calculus question (e.g., How do I differentiate x*ln(x*y) w.r.t. x?)...'
              }
              className="flex-1 h-11 px-4 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#191C24] text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="h-11 px-4 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeCheckWork();
            }}
            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-3 space-y-1.5">
                <label htmlFor="chk-expr" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Original Function f(x, y)
                </label>
                <input
                  id="chk-expr"
                  type="text"
                  value={checkExpr}
                  onChange={(e) => setCheckExpr(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="chk-var" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Variable
                </label>
                <input
                  id="chk-var"
                  type="text"
                  maxLength={2}
                  value={checkVar}
                  onChange={(e) => setCheckVar(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="chk-attempt" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Your Attempted Partial Derivative (∂f/∂{checkVar || 'x'})
              </label>
              <input
                id="chk-attempt"
                type="text"
                value={studentAttempt}
                onChange={(e) => setStudentAttempt(e.target.value)}
                placeholder="e.g., cos(x*y) + 2*x"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
              />
            </div>

            <button
              type="submit"
              disabled={!checkExpr.trim() || !studentAttempt.trim() || loading}
              className="h-11 px-5 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpenCheck className="w-4 h-4" />}
              <span>Check My Solution</span>
            </button>
          </form>

          {checkFeedback && (
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
              {renderRichMathText(checkFeedback)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
