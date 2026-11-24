import { useRef, useState } from 'react';
import {
  Bell,
  CloudDownload,
  CloudUpload,
  Download,
  Globe,
  Moon,
  Sun,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import type { AppSettings } from '../types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => Promise<string | null>;
  onCloudPush: (passphrase: string) => Promise<string>;
  onCloudPull: (passphrase: string) => Promise<string>;
  onTestReminder: () => Promise<string>;
}

export function SettingsModal({
  open,
  onClose,
  settings,
  onChange,
  onExportBackup,
  onImportBackup,
  onCloudPush,
  onCloudPull,
  onTestReminder,
}: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [syncPassphrase, setSyncPassphrase] = useState('');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);

  if (!open) return null;

  const handleToggleReminder = async () => {
    const nextEnabled = !settings.reminderEnabled;
    if (
      nextEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      try {
        await Notification.requestPermission();
      } catch {
        // ignore permission failure in sandboxed iframes
      }
    }
    onChange({ ...settings, reminderEnabled: nextEnabled });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#191C24] p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Calculator & Study Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Display Name */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Learner Name
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Shown on Weekly Leaderboard & Challenges
              </div>
            </div>
            <input
              type="text"
              value={settings.displayName}
              maxLength={32}
              onChange={(e) => onChange({ ...settings, displayName: e.target.value })}
              aria-label="Learner display name"
              className="w-full sm:w-48 h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
            />
          </div>

          {/* Language */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#2F7CF6]" />
                <span>Language / भाषा</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Interface & toolkit labels
              </div>
            </div>
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#12141B] border border-slate-200 dark:border-white/10">
              {(
                [
                  { id: 'en', label: 'English' },
                  { id: 'hi', label: 'हिन्दी' },
                ] as const
              ).map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => onChange({ ...settings, language: lang.id })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    settings.language === lang.id
                      ? 'bg-[#2F7CF6] text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Guest Mode */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-amber-500" />
                <span>Guest Mode</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Practice without saving to permanent profile
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.guestMode}
              onClick={() => onChange({ ...settings, guestMode: !settings.guestMode })}
              className={`w-12 h-7 rounded-full transition-colors p-1 flex items-center ${
                settings.guestMode
                  ? 'bg-amber-500 justify-end'
                  : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Appearance</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Material 3 dark or light surface
              </div>
            </div>
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#12141B] border border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => onChange({ ...settings, theme: 'dark' })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  settings.theme === 'dark'
                    ? 'bg-[#2F7CF6] text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...settings, theme: 'light' })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  settings.theme === 'light'
                    ? 'bg-[#2F7CF6] text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
            </div>
          </div>

          {/* Angle Unit */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Angle Mode</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Used for trigonometric evaluations
              </div>
            </div>
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#12141B] border border-slate-200 dark:border-white/10">
              {(['rad', 'deg'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => onChange({ ...settings, angleUnit: unit })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase transition-colors ${
                    settings.angleUnit === unit
                      ? 'bg-[#2F7CF6] text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>

          {/* Decimal Precision */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Decimal Precision
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Rounding for point evaluations
              </div>
            </div>
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#12141B] border border-slate-200 dark:border-white/10">
              {([2, 4, 6] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange({ ...settings, precision: p })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                    settings.precision === p
                      ? 'bg-[#2F7CF6] text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Learning Goal */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Daily Learning Goal
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Target problems & cards per day
              </div>
            </div>
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#12141B] border border-slate-200 dark:border-white/10">
              {[5, 10, 20].map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => onChange({ ...settings, dailyGoal: goal })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                    settings.dailyGoal === goal
                      ? 'bg-[#2F7CF6] text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Study Reminders */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#12141B] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-[#2F7CF6]" />
                  <span>Daily Study Reminder</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Browser notification or in-app study prompt
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.reminderEnabled}
                onClick={() => void handleToggleReminder()}
                className={`w-12 h-7 rounded-full transition-colors p-1 flex items-center ${
                  settings.reminderEnabled
                    ? 'bg-[#2F7CF6] justify-end'
                    : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => onChange({ ...settings, reminderTime: e.target.value })}
                aria-label="Reminder time"
                className="h-9 px-3 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#191C24] text-xs font-mono text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={async () => {
                  const msg = await onTestReminder();
                  setReminderStatus(msg);
                  setTimeout(() => setReminderStatus(null), 3000);
                }}
                className="h-9 px-3 rounded-lg border border-slate-300 dark:border-white/20 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#2F7CF6]"
              >
                Test Reminder
              </button>
            </div>
            {reminderStatus && (
              <div className="text-[11px] text-[#2F7CF6] dark:text-[#7EB0FF]">
                {reminderStatus}
              </div>
            )}
          </div>

          {/* Auto-expand steps */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Auto-Expand Step-by-Step
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Show derivation rules automatically after solving
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoExpandSteps}
              onClick={() =>
                onChange({ ...settings, autoExpandSteps: !settings.autoExpandSteps })
              }
              className={`w-12 h-7 rounded-full transition-colors p-1 flex items-center ${
                settings.autoExpandSteps
                  ? 'bg-[#2F7CF6] justify-end'
                  : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* Haptic Feedback */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Haptic Feedback
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Tactile vibration on supported mobile devices
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.hapticsEnabled}
              onClick={() =>
                onChange({ ...settings, hapticsEnabled: !settings.hapticsEnabled })
              }
              className={`w-12 h-7 rounded-full transition-colors p-1 flex items-center ${
                settings.hapticsEnabled
                  ? 'bg-[#2F7CF6] justify-end'
                  : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* Data Backup & Restore */}
          <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-3">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Data Backup & Restore
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Export or restore history, notebook, quiz attempts, and flashcards as JSON
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onExportBackup}
                className="h-10 rounded-xl border border-slate-300 dark:border-white/20 text-xs font-medium text-slate-800 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 rounded-xl border border-slate-300 dark:border-white/20 text-xs font-medium text-slate-800 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const err = await onImportBackup(file);
                  setBackupStatus(err ?? 'Backup restored cleanly.');
                  e.target.value = '';
                }}
              />
            </div>
            {backupStatus && (
              <div className="text-xs text-[#2F7CF6] dark:text-[#7EB0FF]">{backupStatus}</div>
            )}
          </div>

          {/* Optional Cloud Sync */}
          <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-3">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Optional Cloud Sync
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Enter a private sync key (6+ chars) to push or pull your workspace across sessions
              </div>
            </div>
            <input
              type="password"
              value={syncPassphrase}
              onChange={(e) => setSyncPassphrase(e.target.value)}
              placeholder="Private sync passphrase (min 6 chars)"
              aria-label="Cloud sync passphrase"
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#2F7CF6]"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={syncBusy}
                onClick={async () => {
                  setSyncBusy(true);
                  const msg = await onCloudPush(syncPassphrase);
                  setSyncStatus(msg);
                  setSyncBusy(false);
                }}
                className="h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span>Sync Up</span>
              </button>
              <button
                type="button"
                disabled={syncBusy}
                onClick={async () => {
                  setSyncBusy(true);
                  const msg = await onCloudPull(syncPassphrase);
                  setSyncStatus(msg);
                  setSyncBusy(false);
                }}
                className="h-10 rounded-xl border border-slate-300 dark:border-white/20 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-[#2F7CF6] inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CloudDownload className="w-3.5 h-3.5" />
                <span>Restore Cloud</span>
              </button>
            </div>
            {syncStatus && (
              <div className="text-xs text-slate-600 dark:text-slate-300">{syncStatus}</div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-[#2F7CF6] hover:bg-[#256AE0] text-white text-sm font-semibold transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
