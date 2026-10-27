import React, { useState } from 'react';
import {
  Hourglass,
  Calendar,
  Clock,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  MessageSquare,
  Eye,
  FileText,
  UserPlus,
  Building2,
  Search
} from 'lucide-react';
import {
  formatCurrency,
  formatDateCSV,
  formatPhone,
  getWhatsAppUrl,
  buildWhatsAppMessage
} from '../utils';

export default function LeasesView({
  tenants,
  settings,
  onSelectTenant,
  onEditTenant,
  onRenewTenant,
  onOpenStatement,
  onOpenBulkWhatsApp
}) {
  const [pipelineFilter, setPipelineFilter] = useState('all'); // 'all' | 'overdue' | 'expiring60' | '90d' | '180d' | 'longterm' | 'vacant'
  const [search, setSearch] = useState('');

  const sym = settings?.currencySymbol || 'GH₵';
  const threshold = settings?.expiryWarningThresholdDays || 90;

  const leased = tenants.filter((t) => !t.isVacantSlot && t.rentStatus !== 'No Contract');
  const vacant = tenants.filter((t) => t.isVacantSlot || t.rentStatus === 'No Contract');

  const overdueList = leased.filter((t) => t.daysToExpiry < 0);
  const expiring60List = leased.filter((t) => t.daysToExpiry >= 0 && t.daysToExpiry <= threshold);
  const next61To120List = leased.filter((t) => t.daysToExpiry > threshold && t.daysToExpiry <= 150);
  const next121To365List = leased.filter((t) => t.daysToExpiry > 150 && t.daysToExpiry <= 365);
  const over365List = leased.filter((t) => t.daysToExpiry > 365);

  const pipelineStages = [
    {
      id: 'overdue',
      label: 'Overdue / Expired',
      sub: 'Immediate renewal or handover',
      count: overdueList.length,
      color: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500 animate-ping'
    },
    {
      id: 'expiring60',
      label: `Expiring ≤ ${threshold} Days`,
      sub: `Auto-flagged (≤${threshold}d) renewal notice`,
      count: expiring60List.length,
      color: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
      dot: 'bg-amber-500'
    },
    {
      id: '90d',
      label: `${threshold + 1}–150 Days`,
      sub: 'Upcoming Q1 renewals',
      count: next61To120List.length,
      color: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300',
      dot: 'bg-teal-500'
    },
    {
      id: '180d',
      label: '151–365 Days',
      sub: 'Mid-term active contracts',
      count: next121To365List.length,
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500'
    },
    {
      id: 'longterm',
      label: '365+ Days',
      sub: 'Long-term multi-year / advance',
      count: over365List.length,
      color: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
      dot: 'bg-indigo-500'
    },
    {
      id: 'vacant',
      label: 'No Contract / Vacant',
      sub: 'Available for new lease',
      count: vacant.length,
      color: 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
      dot: 'bg-slate-400'
    }
  ];

  const filteredList = [...tenants]
    .filter((t) => {
      const isVac = t.isVacantSlot || t.rentStatus === 'No Contract';
      if (pipelineFilter === 'all' && isVac) return false;
      if (pipelineFilter === 'overdue' && (isVac || t.daysToExpiry >= 0)) return false;
      if (pipelineFilter === 'expiring60' && (isVac || t.daysToExpiry < 0 || t.daysToExpiry > threshold)) return false;
      if (pipelineFilter === '90d' && (isVac || t.daysToExpiry <= threshold || t.daysToExpiry > 150)) return false;
      if (pipelineFilter === '180d' && (isVac || t.daysToExpiry <= 150 || t.daysToExpiry > 365)) return false;
      if (pipelineFilter === 'longterm' && (isVac || t.daysToExpiry <= 365)) return false;
      if (pipelineFilter === 'vacant' && !isVac) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.name?.toLowerCase().includes(q) ||
          t.id?.toLowerCase().includes(q) ||
          t.unit?.toLowerCase().includes(q) ||
          t.property?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isVacantSlot && !b.isVacantSlot) return 1;
      if (!a.isVacantSlot && b.isVacantSlot) return -1;
      return (a.daysToExpiry ?? 99999) - (b.daysToExpiry ?? 99999);
    });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Pipeline Stage Selector Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {pipelineStages.map((stage) => {
          const isSelected = pipelineFilter === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setPipelineFilter(isSelected ? 'all' : stage.id)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'ring-2 ring-emerald-500 shadow-md ' + stage.color
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {stage.label}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
              </div>
              <div className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-white">
                {stage.count}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {stage.sub}
              </p>
            </button>
          );
        })}
      </div>

      {/* 2. Lease Expiration & Renewal Pipeline Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-amber-500" />
              Lease Expiration & Renewal Pipeline ({filteredList.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chronological countdown of all tenancy contracts, renewal dates, and expiry alerts
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {pipelineFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setPipelineFilter('all')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition cursor-pointer"
              >
                Show All Active Leases
              </button>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lease..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <button
              type="button"
              onClick={onOpenBulkWhatsApp}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Dispatch Renewal Notices
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Tenant ID & Name</th>
                <th className="px-4 py-3.5">Property & Unit</th>
                <th className="px-4 py-3.5">Start & End Dates</th>
                <th className="px-4 py-3.5">Term & Renewal Date</th>
                <th className="px-4 py-3.5">Rent & Contract Value</th>
                <th className="px-4 py-3.5">Countdown & Alert</th>
                <th className="px-5 py-3.5 text-right">Renewal Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredList.map((t) => {
                const isVac = t.isVacantSlot || t.rentStatus === 'No Contract';
                const isExpired = t.rentStatus === 'Expired';
                const isExpiring = t.rentStatus === 'Expiring Soon';
                const waPhone = t.whatsapp || t.phone;
                const pctRem = t.progress?.percentRemaining ?? 0;

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTenant(t)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {t.id}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{t.name}</div>
                          <div className="text-xs text-slate-400 font-mono">
                            {t.phone ? formatPhone(t.phone) : 'Vacant Unit'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="text-emerald-600 dark:text-emerald-400">{t.unit}</span>
                        <span className="text-slate-400">•</span>
                        <span>{t.property}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-xs">
                      {isVac ? (
                        <span className="text-slate-400 italic">No active dates</span>
                      ) : (
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {formatDateCSV(t.contractStart)}
                          </div>
                          <div className="text-slate-500">to {formatDateCSV(t.contractEnd)}</div>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      {isVac ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                            {t.durationMonths} Months
                          </span>
                          <div className="text-[11px] font-mono text-slate-500 mt-1">
                            Renew: {formatDateCSV(t.renewalDate || t.contractEnd)}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-xs">
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(t.monthlyRent, sym)}/mo
                      </div>
                      {!isVac && (
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {formatCurrency(t.totalRent, sym)}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      {isVac ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          No Contract
                        </span>
                      ) : (
                        <div className="space-y-1.5 min-w-[160px]">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isExpired
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                  : isExpiring
                                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {t.expiryAlert}
                            </span>
                            <span className="font-mono text-xs font-extrabold text-slate-800 dark:text-slate-200">
                              {t.daysToExpiry}d
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isExpired ? 'bg-rose-500' : isExpiring ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.max(5, pctRem)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {isVac ? (
                          <button
                            type="button"
                            onClick={() => onEditTenant(t)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                          >
                            Create Lease
                          </button>
                        ) : (
                          <>
                            {waPhone && (
                              <a
                                href={getWhatsAppUrl(waPhone, buildWhatsAppMessage(t, 'auto', settings))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition inline-flex items-center gap-1"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Notice
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => onRenewTenant(t)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Renew
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenStatement(t)}
                              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Generate Official Statement"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
