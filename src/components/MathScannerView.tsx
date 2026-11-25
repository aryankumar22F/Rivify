import { useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  Calculator,
  Check,
  LineChart,
  Loader2,
  Save,
  ScanLine,
  Sparkles,
  Upload,
} from 'lucide-react';
import { parseApiResponse } from '../utils/apiClient';
import { MathTex } from './MathTex';

interface MathScannerViewProps {
  onSendToSolver: (expr: string) => void;
  onSendToGraph: (expr: string) => void;
  onSendToScientific: (expr: string) => void;
  onSaveToNotebook: (note: { title: string; topic: string; content: string }) => void;
}

interface ScannerRecognitionResponse {
  expression: string;
  latex: string;
  detectedCategory?: string;
  notes?: string;
}

export function MathScannerView({
  onSendToSolver,
  onSendToGraph,
  onSendToScientific,
  onSaveToNotebook,
}: MathScannerViewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/png');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expression, setExpression] = useState('');
  const [latex, setLatex] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Unsupported image format. Please upload a PNG, JPG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image exceeds 5 MB limit. Please upload a smaller or cropped image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl.includes(',')) {
        setError('Could not read the selected image file.');
        return;
      }
      const [meta, b64] = dataUrl.split(',', 2);
      const detectedMime = meta.match(/data:(.*?);/)?.[1] || file.type;
      setPreviewUrl(dataUrl);
      setImageBase64(b64);
      setMimeType(detectedMime);
    };
    reader.onerror = () => setError('Failed to read image file.');
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileSelected(e.target.files?.[0]);
  };

  const handleRecognize = async () => {
    if (!imageBase64) {
      setError('Upload an image containing a mathematical expression first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scanner/recognize-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      const data = await parseApiResponse<ScannerRecognitionResponse>(
        res,
        'Unable to extract equation from image.'
      );
      setExpression(data.expression || '');
      setLatex(data.latex || data.expression || '');
      setCategory(data.detectedCategory || null);
      setNotes(data.notes || null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'OCR service unavailable right now. You can type or edit the expression manually below.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-[#2F7CF6]" />
          Math Scanner (Image to Equation)
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Upload a photo or screenshot of printed or handwritten math (PNG, JPG, WEBP), inspect the recognized formula, edit if needed, and send it straight to the Solver, Grapher, Scientific Calculator, or Notebook.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Image Upload Panel */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/20 hover:border-[#2F7CF6] p-6 text-center transition-colors">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />
            <Upload className="w-7 h-7 mx-auto text-[#2F7CF6] mb-2" />
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Click to upload equation image
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              PNG, JPG, or WEBP up to 5 MB
            </div>
          </label>

          {previewUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-900/5 dark:bg-black/30 max-h-[260px] flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Uploaded math problem preview"
                className="max-h-[250px] w-auto object-contain"
              />
            </div>
          )}

          <button
            type="button"
            disabled={!imageBase64 || loading}
            onClick={() => void handleRecognize()}
            className="w-full h-11 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Recognizing Equation...</span>
              </>
            ) : (
              <>
                <ScanLine className="w-4 h-4" />
                <span>Extract Equation</span>
              </>
            )}
          </button>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Extracted Result & Cross-Module Actions */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Extracted Expression
            </h3>
            {category && (
              <span className="text-xs font-medium text-[#2F7CF6]">{category}</span>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Editable Plain Expression (for Solver / Grapher / Calculator)
            </label>
            <textarea
              rows={3}
              value={expression}
              onChange={(e) => {
                setExpression(e.target.value);
                if (!latex) setLatex(e.target.value);
              }}
              placeholder="Extracted math expression will appear here..."
              className="mt-1 w-full p-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent font-mono text-sm text-slate-900 dark:text-white"
            />
          </div>

          {(latex || expression) && (
            <div className="rounded-xl bg-slate-50 dark:bg-[#12141B] border border-slate-200 dark:border-white/10 p-4 overflow-x-auto text-slate-900 dark:text-white">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                KaTeX Preview
              </div>
              <MathTex tex={latex || expression} display />
            </div>
          )}

          {notes && (
            <div className="text-xs text-slate-600 dark:text-slate-400 rounded-xl bg-slate-50 dark:bg-[#22252E] p-3">
              {notes}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              disabled={!expression.trim()}
              onClick={() => onSendToSolver(expression.trim())}
              className="h-10 px-3 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Send to Math Solver</span>
            </button>

            <button
              type="button"
              disabled={!expression.trim()}
              onClick={() => onSendToGraph(expression.trim())}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/15 hover:border-[#2F7CF6] disabled:opacity-40 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
            >
              <LineChart className="w-3.5 h-3.5 text-emerald-500" />
              <span>Plot in Grapher</span>
            </button>

            <button
              type="button"
              disabled={!expression.trim()}
              onClick={() => onSendToScientific(expression.trim())}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/15 hover:border-[#2F7CF6] disabled:opacity-40 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-500" />
              <span>Open in Sci Calc</span>
            </button>

            <button
              type="button"
              disabled={!expression.trim()}
              onClick={() => {
                onSaveToNotebook({
                  title: `Scanned Equation: ${expression.slice(0, 28)}`,
                  topic: category || 'Math Scanner',
                  content: `${expression}\n$$${latex || expression}$$`,
                });
                setSavedNote(true);
                setTimeout(() => setSavedNote(false), 1600);
              }}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/15 hover:border-[#2F7CF6] disabled:opacity-40 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
            >
              {savedNote ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Save className="w-3.5 h-3.5 text-sky-500" />
              )}
              <span>{savedNote ? 'Saved to Notebook' : 'Save to Notebook'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
