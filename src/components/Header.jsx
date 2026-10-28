import React from 'react';
import {
  Menu,
  UserPlus,
  MessageSquareShare,
  Download,
  AlertTriangle,
  Calendar,
  Building2,
  Sun,
  Moon,
  CloudCheck,
  RefreshCw
} from 'lucide-react';
import { formatDateCSV } from '../utils';

export default function Header({
  currentTab,
  setMobileOpen,
  metrics,
  onOpenAddTenant,
  onOpenBulkWhatsApp,
  onExportCSV,
  onNavigate,
  themeMode,
  onToggleTheme,
  settings,
  syncStatus = 'synced',
  onForceSync
}) {
  const getHeaderMeta = () => {
    switch (currentTab) {
      case 'dashboard':
        return {
          badge: 'EXECUTIVE OVERVIEW',
          title: 'Precourt Luxury Homes — Executive Dashboard',
          subtitle: 'Real-time occupancy analytics, GH₵ revenue projections, and contract expiry intelligence'
        };
      case 'properties':
        return {
          badge: 'ASSET PORTFOLIO',
          title: 'Properties & Units Directory',
          subtitle: 'Manage PLH-AM (Amamoley) & PLH-KW (Kwabenya) luxury residential units and occupancy'
        };
      case 'tenants':
        return {
          badge: 'RESIDENT DIRECTORY',
          title: 'Interactive Tenant Management',
          subtitle: 'Search, multi-filter, inspect contract countdowns, and dispatch WhatsApp notices'
        };
      case 'leases':
        return {
          badge: 'RENEWAL PIPELINE',
          title: 'Lease Agreements & Expirations',
          subtitle: 'Track 30/60/90/180+ day expiry timelines, overdue leases, and 1-click contract renewals'
        };
      case 'finances':
        return {
          badge: 'REVENUE & COLLECTIONS (GHS)',
          title: 'Financials & Contract Revenue',
          subtitle: 'Monthly and cumulative contract valuations in Ghanaian Cedis (GH₵) with official statements'
        };
      case 'settings':
        return {
          badge: 'PORTAL PREFERENCES',
          title: 'Settings & System Configuration',
          subtitle: 'Customize expiry warning thresholds, currency display, WhatsApp templates, and CSV data'
        };
      default:
        return {
          badge: 'PRECOURT LUXURY HOMES',
          title: 'Property & Tenant Portal',
          subtitle: 'Facility & Tenant Management'
        };
    }
  };

  const { badge, title, subtitle } = getHeaderMeta();
  const refDateDisplay = settings?.referenceDateMode === 'live'
    ? formatDateCSV(new Date().toISOString().split('T')[0])
    : formatDateCSV(settings?.referenceDateMode || '2026-10-27');

  return (
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-3.5 transition-colors">
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Mobile Menu Button & Page Title */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden shrink-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                {badge}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <Calendar className="w-3 h-3 text-amber-500" />
                Ref: {refDateDisplay}
              </span>
              <button
                type="button"
                onClick={onForceSync}
                title="Live Cloud Sync across all browsers & Incognito windows — Click to sync now"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                  syncStatus === 'syncing'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/25'
                    : 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25 hover:bg-teal-500/20'
                }`}
              >
                <RefreshCw className={`w-2.5 h-2.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                <span>{syncStatus === 'syncing' ? 'Syncing Cloud...' : 'Cloud Synced'}</span>
              </button>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate mt-0.5">
              {title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden md:block truncate">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right: Alert Indicator & Quick Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Urgent Alert Pill */}
          {(metrics.expiredCount > 0 || metrics.expiringSoonCount > 0) && (
            <button
              onClick={() => onNavigate('leases')}
              className="hidden xl:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25 transition cursor-pointer"
              title="View Overdue & Expiring Leases"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
              <span>
                {metrics.expiredCount} Overdue • {metrics.expiringSoonCount} Expiring ≤{settings?.expiryWarningThresholdDays || 60}d
              </span>
            </button>
          )}

          {/* Theme Toggle Shortcut */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 transition cursor-pointer"
            title={themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle color theme"
          >
            {themeMode === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Export CSV */}
          <button
            onClick={onExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs transition cursor-pointer"
            title="Export Tenant Records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Bulk WhatsApp Reminder */}
          <button
            onClick={onOpenBulkWhatsApp}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl transition cursor-pointer"
            title="Send Bulk WhatsApp Renewal & Overdue Reminders"
          >
            <MessageSquareShare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden md:inline">Bulk WhatsApp</span>
          </button>

          {/* Primary Action: Add Tenant */}
          <button
            onClick={onOpenAddTenant}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-600/20 ring-1 ring-emerald-400/30 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Tenant</span>
          </button>
        </div>
      </div>
    </header>
  );
}
