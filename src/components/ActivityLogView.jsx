import React, { useState, useMemo } from 'react';
import {
  Activity,
  LogIn,
  LogOut,
  FileEdit,
  UserPlus,
  RefreshCw,
  ShieldCheck,
  Building2,
  Search,
  Filter,
  Download,
  Clock,
  CheckCircle2,
  KeyRound,
  Settings,
  UserCheck
} from 'lucide-react';

function getActionMeta(action) {
  switch (action) {
    case 'USER_LOGIN':
      return {
        label: 'Signed In',
        badgeClass:
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        icon: LogIn
      };
    case 'USER_LOGOUT':
      return {
        label: 'Signed Out',
        badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
        icon: LogOut
      };
    case 'TENANT_CREATED':
      return {
        label: 'Tenant Registered',
        badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        icon: UserPlus
      };
    case 'TENANT_UPDATED':
      return {
        label: 'Record Updated',
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        icon: FileEdit
      };
    case 'LEASE_RENEWED':
      return {
        label: 'Lease Renewed',
        badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
        icon: RefreshCw
      };
    case 'UNIT_VACATED':
      return {
        label: 'Unit Vacated',
        badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        icon: Building2
      };
    case 'SETTINGS_UPDATED':
      return {
        label: 'Settings Updated',
        badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
        icon: Settings
      };
    case 'MANAGER_PROVISIONED':
    case 'MANAGER_UPDATED':
      return {
        label: 'Manager Access',
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        icon: ShieldCheck
      };
    case 'PASSWORD_RESET':
      return {
        label: 'Password Rotated',
        badgeClass: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
        icon: KeyRound
      };
    default:
      return {
        label: action || 'Portal Activity',
        badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
        icon: Activity
      };
  }
}

function formatAuditTimestamp(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(d);
}

export default function ActivityLogView({
  auditLogs = [],
  currentUser,
  onForceSync,
  onSelectTenant,
  tenants = []
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [actorFilter, setActorFilter] = useState('ALL');

  const uniqueActors = useMemo(() => {
    const set = new Set();
    auditLogs.forEach((item) => {
      if (item.actorName) set.add(item.actorName);
    });
    return Array.from(set);
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((entry) => {
      if (categoryFilter === 'AUTH' && entry.category !== 'authentication') return false;
      if (categoryFilter === 'UPDATES' && entry.category !== 'record_update') return false;
      if (categoryFilter === 'ADMIN' && entry.category !== 'administration') return false;

      if (actorFilter !== 'ALL' && entry.actorName !== actorFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${entry.actorName || ''} ${entry.actorEmail || ''} ${entry.actorRole || ''} ${
          entry.targetLabel || ''
        } ${entry.targetId || ''} ${entry.details || ''} ${entry.action || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditLogs, categoryFilter, actorFilter, searchQuery]);

  const summaryCounts = useMemo(() => {
    const logins = auditLogs.filter((e) => e.action === 'USER_LOGIN').length;
    const recordUpdates = auditLogs.filter((e) => e.category === 'record_update').length;
    const lastEntry = auditLogs[0] || null;
    return {
      total: auditLogs.length,
      logins,
      recordUpdates,
      lastEntry
    };
  }, [auditLogs]);

  const handleExportAuditCSV = () => {
    const headers = [
      'Timestamp',
      'Action',
      'Category',
      'Logged-In User',
      'Email',
      'Role',
      'Target Record',
      'Details'
    ];
    const rows = filteredLogs.map((l) => [
      l.timestamp || '',
      l.action || '',
      l.category || '',
      l.actorName || '',
      l.actorEmail || '',
      l.actorRole || '',
      l.targetLabel || l.targetId || '',
      (l.details || '').replace(/"/g, '""')
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Precourt_Audit_Activity_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Synced Activity &amp; Audit Log
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Server-Verified Attribution
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Real-time tamper-evident log of who signed in (`SUPER_ADMIN` or `FACILITY_MANAGER`) and every tenant, lease, or setting update synced across all devices.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-center">
            {onForceSync && (
              <button
                type="button"
                onClick={onForceSync}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Sync
              </button>
            )}
            <button
              type="button"
              onClick={handleExportAuditCSV}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Audit CSV
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200/70 dark:border-slate-800">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Currently Signed In
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {currentUser?.fullName || 'Authenticated User'}
              </span>
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
              {currentUser?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Facility Manager'} •{' '}
              {currentUser?.email}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Logged Events
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {summaryCounts.total}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Synced across all browsers &amp; sessions
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Record Modifications
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {summaryCounts.recordUpdates}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Tenant edits, renewals &amp; additions
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Latest Synced Action
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
              {summaryCounts.lastEntry
                ? `${summaryCounts.lastEntry.actorName} — ${
                    getActionMeta(summaryCounts.lastEntry.action).label
                  }`
                : 'No events recorded yet'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {summaryCounts.lastEntry
                ? formatAuditTimestamp(summaryCounts.lastEntry.timestamp)
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by manager name, tenant name, unit (e.g. AM-1A), or change details..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {[
              { id: 'ALL', label: 'All Activity' },
              { id: 'UPDATES', label: 'Record Updates' },
              { id: 'AUTH', label: 'Sign-Ins / Sessions' },
              { id: 'ADMIN', label: 'Admin Actions' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  categoryFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              aria-label="Filter by logged-in user"
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="ALL">All Logged-In Users</option>
              {uniqueActors.map((actor) => (
                <option key={actor} value={actor}>
                  {actor}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Logged-In User</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target Record</th>
                <th className="py-3.5 px-4">Change Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70 text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No activity log entries match your current filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry) => {
                  const meta = getActionMeta(entry.action);
                  const IconComp = meta.icon;
                  const matchingTenant =
                    entry.targetId && tenants.find((t) => t.id === entry.targetId);

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <div className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {formatAuditTimestamp(entry.timestamp)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {entry.actorName || 'Authenticated Manager'}
                        </div>
                        {entry.actorEmail && (
                          <div className="text-[11px] text-slate-400">{entry.actorEmail}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            entry.actorRole === 'SUPER_ADMIN'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {entry.actorRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Facility Manager'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.badgeClass}`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                          {meta.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {matchingTenant && onSelectTenant ? (
                          <button
                            type="button"
                            onClick={() => onSelectTenant(matchingTenant)}
                            className="font-semibold text-amber-600 dark:text-amber-400 hover:underline text-left cursor-pointer"
                          >
                            {entry.targetLabel || `${matchingTenant.name} (${matchingTenant.unit})`}
                          </button>
                        ) : (
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {entry.targetLabel || entry.targetId || '—'}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-md">
                        {entry.details || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
