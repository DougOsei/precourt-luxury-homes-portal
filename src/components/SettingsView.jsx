import React, { useState } from 'react';
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Bell,
  Wallet,
  MessageSquare,
  Upload,
  Download,
  RotateCcw,
  Save,
  CheckCircle2,
  ShieldCheck,
  Lock,
  LogOut
} from 'lucide-react';

export default function SettingsView({
  settings,
  onUpdateSettings,
  colorSchemePref,
  onSetColorSchemePref,
  onExportCSV,
  onImportCSVText,
  onResetDemo,
  userRole = 'property_manager',
  sessionCookieType = 'HttpOnly; SameSite=Lax',
  onSwitchRole,
  onClearSessionData
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [csvInput, setCsvInput] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    onUpdateSettings(localSettings);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        onImportCSVText(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-200">
      {/* 1. Theme & Color Scheme Preference (Three-State Control per dark-mode-toggle guide) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Role-Based Access Control (RBAC) &amp; HttpOnly Cookie Session
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Session role is verified server-side via signed <code className="font-mono text-emerald-600 dark:text-emerald-400">{sessionCookieType}</code> cookie (never stored in LocalStorage).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSwitchRole && onSwitchRole('property_manager')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                userRole === 'property_manager'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Property Manager (Write)
            </button>
            <button
              type="button"
              onClick={() => onSwitchRole && onSwitchRole('tenant_viewer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                userRole === 'tenant_viewer'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Lock className="w-3 h-3 inline mr-1" />
              Tenant Viewer (Read-Only)
            </button>
            {onClearSessionData && (
              <button
                type="button"
                onClick={onClearSessionData}
                title="Clear HttpOnly Session Cookie & Site Data"
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            Appearance & Color Scheme Override
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose whether Precourt Luxury Homes Portal follows your OS theme or pins Light / Dark mode
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: 'system',
              label: 'System Default',
              desc: 'Automatically adapts to OS light/dark setting',
              icon: Monitor
            },
            {
              id: 'light',
              label: 'Light Theme',
              desc: 'Crisp alabaster & emerald daylight palette',
              icon: Sun
            },
            {
              id: 'dark',
              label: 'Luxury Dark Theme',
              desc: 'Deep obsidian slate, emerald & gold accents',
              icon: Moon
            }
          ].map((opt) => {
            const Icon = opt.icon;
            const isSelected = colorSchemePref === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSetColorSchemePref(opt.id)}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-emerald-500' : 'text-slate-400'}`} />
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">{opt.label}</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Portal Thresholds, Currency & WhatsApp Templates */}
      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-xs space-y-5"
      >
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-500" />
            Lease Expiry Thresholds & Currency Configuration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure when leases trigger the "EXPIRING: X DAYS OR LESS" warning badge
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Expiring Soon Threshold (Days)
            </label>
            <input
              type="number"
              min="7"
              max="180"
              value={localSettings.expiryWarningThresholdDays}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, expiryWarningThresholdDays: Number(e.target.value) || 90 })
              }
              className="w-full px-3.5 py-2 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
            <span className="text-[10px] text-slate-400">Default: 90 days (auto-flags contracts ≤90 days)</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Countdown Reference Date
            </label>
            <select
              value={localSettings.referenceDateMode}
              onChange={(e) => setLocalSettings({ ...localSettings, referenceDateMode: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              <option value="2026-10-27">27-Oct-2026 (Dataset Reference Date)</option>
              <option value="live">Live System Clock</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Currency Symbol (GHS)
            </label>
            <input
              type="text"
              value={localSettings.currencySymbol}
              onChange={(e) => setLocalSettings({ ...localSettings, currencySymbol: e.target.value || 'GH₵' })}
              className="w-full px-3.5 py-2 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
            WhatsApp Automated Notice Templates
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Renewal Reminder Template (≤90 Days)
            </label>
            <textarea
              rows={2}
              value={localSettings.whatsappTemplateRenewal}
              onChange={(e) => setLocalSettings({ ...localSettings, whatsappTemplateRenewal: e.target.value })}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Overdue / Expired Notice Template
            </label>
            <textarea
              rows={2}
              value={localSettings.whatsappTemplateOverdue}
              onChange={(e) => setLocalSettings({ ...localSettings, whatsappTemplateOverdue: e.target.value })}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Portal Preferences
          </button>
        </div>
      </form>

      {/* 3. CSV Data Ingestion, Export & Demo Reset */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-500" />
            CSV Spreadsheet Ingestion & Data Persistence
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All changes are cached automatically in browser LocalStorage. You can also import a CSV file or reset to the original 16-tenant Precourt Luxury Homes dataset.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Upload CSV File</span>
            <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => onExportCSV()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Download Full CSV Backup</span>
          </button>

          <button
            type="button"
            onClick={onResetDemo}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Initial PLH CSV Dataset</span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Or Paste Raw CSV Rows to Ingest:
          </label>
          <textarea
            rows={3}
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder="Tenant ID,Tenant Name,Phone,WhatsApp,Email,Property,Apartment/Unit,Contract Start,Contract End,Monthly Rent (GHS),No. of Months,Total Rent to Pay (GHS)..."
            className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          />
          {csvInput.trim() && (
            <button
              type="button"
              onClick={() => {
                onImportCSVText(csvInput);
                setCsvInput('');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition cursor-pointer"
            >
              Ingest Pasted CSV Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
