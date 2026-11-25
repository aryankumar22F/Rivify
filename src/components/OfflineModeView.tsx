import { useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Download,
  FileDown,
  Globe,
  HardDrive,
  Share,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { usePWAInstall, useServiceWorkerStatus } from '../utils/usePWA';

interface OfflineModeViewProps {
  isOnline: boolean;
  onExportBackup: () => void;
  onCloudPush: (passphrase: string) => Promise<string>;
  localCounts: {
    calculations: number;
    notes: number;
    whiteboards: number;
    equations: number;
    researchProjects: number;
  };
}

const OFFLINE_CAPABLE = [
  'Symbolic Calculus (Partial Derivatives, Gradients, Extrema, Vector Fields)',
  'Engineering Labs (ODE/PDE, Linear Algebra, Discrete Math, Fourier/Laplace, OR, Geometry)',
  'Interactive 2D/3D Graphing, Surface Plots & Graph Animation Studio',
  'Scientific Calculator, Unit Converter, Matrix Visualizer & Equation Editor',
  'Formula Derivation Engine & Identity Verification',
  'Math Whiteboard, Math Notebook & Research Workspace (IndexedDB)',
  'Quizzes, SM-2 Flashcards, Smart Revision, Virtual Classroom & Question Papers',
  'PDF & LaTeX (.tex) Export Engines',
];

const INTERNET_REQUIRED = [
  'Camera / Photo Math Scanner OCR (requires Gemini Vision API via /api/scanner/recognize-image)',
  'Handwritten Equation Canvas Recognition (requires /api/assistant/recognize-handwriting)',
  'Optional Passphrase Cloud Backup & Sync (/api/sync/push & /api/sync/pull)',
];

export function OfflineModeView({
  isOnline,
  onExportBackup,
  onCloudPush,
  localCounts,
}: OfflineModeViewProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const swReady = useServiceWorkerStatus();
  const [passphrase, setPassphrase] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleInstall = async () => {
    const ok = await install();
    if (!ok && isIOS) {
      setSyncMessage('Tap Safari Share button → "Add to Home Screen" to install offline.');
    }
  };

  const handleSyncNow = async () => {
    if (!passphrase.trim()) {
      setSyncMessage('Enter your sync passphrase first (at least 6 characters).');
      return;
    }
    setSyncing(true);
    const msg = await onCloudPush(passphrase.trim());
    setSyncMessage(msg);
    setSyncing(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191C24] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-emerald-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-amber-500" />
              )}
              Offline Mathematics Mode (PWA)
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Install RIVIFY as an offline Progressive Web App, verify Service Worker precaching, and inspect which features run 100% locally.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={() => void handleInstall()}
                className="h-10 px-4 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Install App Offline
              </button>
            )}
            {isInstalled && (
              <span className="h-9 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Installed as PWA
              </span>
            )}
            <button
              type="button"
              onClick={onExportBackup}
              className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4" />
              Export Local Backup
            </button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3.5 space-y-1">
            <div className="text-slate-500 dark:text-slate-400">Network Connection</div>
            <div className={`text-sm font-bold ${isOnline ? 'text-emerald-500' : 'text-amber-500'}`}>
              {isOnline ? 'Online — Full + Cloud Ready' : 'Offline — Local Engines Active'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3.5 space-y-1">
            <div className="text-slate-500 dark:text-slate-400">Service Worker Cache</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-[#2F7CF6]" />
              {swReady ? 'Active & Precached' : 'Browser Runtime Ready'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#22252E] p-3.5 space-y-1">
            <div className="text-slate-500 dark:text-slate-400">Local IndexedDB Records</div>
            <div className="text-sm font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {localCounts.calculations} calc · {localCounts.notes} notes · {localCounts.whiteboards} boards · {localCounts.researchProjects} projects
            </div>
          </div>
        </div>

        {isIOS && !isInstalled && (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-sky-700 dark:text-sky-200 flex items-center gap-2">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>
              On iOS Safari: tap the <Share className="w-3.5 h-3.5 inline mx-0.5" /> Share icon and select <strong>Add to Home Screen</strong> to use RIVIFY offline anytime.
            </span>
          </div>
        )}
      </div>

      {/* Capability Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-emerald-500/30 bg-white dark:bg-[#191C24] p-5 space-y-3">
          <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Works 100% Offline (Client-Side Engines)
          </div>
          <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
            {OFFLINE_CAPABLE.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-white dark:bg-[#191C24] p-5 space-y-4">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Requires Active Internet Connection
            </div>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
              {INTERNET_REQUIRED.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2.5">
            <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <CloudUpload className="w-3.5 h-3.5 text-[#2F7CF6]" />
              Sync Offline Work to Cloud Snapshot
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Sync passphrase"
                className="flex-1 h-9 px-3 rounded-lg border border-slate-300 dark:border-white/20 bg-transparent text-xs text-slate-900 dark:text-white"
              />
              <button
                type="button"
                disabled={!isOnline || syncing}
                onClick={() => void handleSyncNow()}
                className="h-9 px-3.5 rounded-lg bg-[#2F7CF6] text-white text-xs font-semibold disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
            {syncMessage && (
              <div className="text-xs text-slate-600 dark:text-slate-300">{syncMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
