import React, { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  Building2,
  FileText,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search
} from 'lucide-react';
import {
  formatCurrency,
  formatCompactCurrency,
  formatDateCSV
} from '../utils';

export default function FinancesView({
  tenants,
  properties,
  metrics,
  settings,
  onSelectTenant,
  onOpenStatement,
  onExportCSV
}) {
  const [selectedProp, setSelectedProp] = useState('all');
  const [search, setSearch] = useState('');
  const sym = settings?.currencySymbol || 'GH₵';

  const leased = tenants.filter((t) => !t.isVacantSlot && t.rentStatus !== 'No Contract');

  const amLeased = leased.filter((t) => t.property === 'PLH-AM');
  const kwLeased = leased.filter((t) => t.property === 'PLH-KW');

  const amMonthly = amLeased.reduce((s, t) => s + (Number(t.monthlyRent) || 0), 0);
  const kwMonthly = kwLeased.reduce((s, t) => s + (Number(t.monthlyRent) || 0), 0);

  const amTotalContract = amLeased.reduce((s, t) => s + (Number(t.totalRent) || 0), 0);
  const kwTotalContract = kwLeased.reduce((s, t) => s + (Number(t.totalRent) || 0), 0);

  const totalContractAll = Math.max(1, amTotalContract + kwTotalContract);
  const amSharePct = Math.round((amTotalContract / totalContractAll) * 100);
  const kwSharePct = 100 - amSharePct;

  const filteredContracts = leased
    .filter((t) => {
      if (selectedProp !== 'all' && t.property !== selectedProp) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.name?.toLowerCase().includes(q) ||
          t.id?.toLowerCase().includes(q) ||
          t.unit?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => (Number(b.totalRent) || 0) - (Number(a.totalRent) || 0));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Financial Summary KPIs in Ghanaian Cedis (GHS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white border border-amber-500/30 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
              Total Contract Value (GHS)
            </span>
            <TrendingUp className="w-4 h-4 text-amber-300" />
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black font-mono text-white">
            {formatCurrency(metrics.totalContractValue, sym)}
          </div>
          <p className="mt-2 text-xs text-emerald-300">
            Across {leased.length} contracted residential units
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Monthly Run-Rate (GHS)
            </span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
            {formatCurrency(metrics.monthlyProjectedRevenue, sym)}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Annualized Equivalent: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(metrics.monthlyProjectedRevenue * 12, sym)}</strong>
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              PLH-AM (Amamoley)
            </span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-slate-900 dark:text-white">
            {formatCurrency(amTotalContract, sym)}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            Monthly: {formatCurrency(amMonthly, sym)} ({amLeased.length} units)
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              PLH-KW (Kwabenya)
            </span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-slate-900 dark:text-white">
            {formatCurrency(kwTotalContract, sym)}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            Monthly: {formatCurrency(kwMonthly, sym)} ({kwLeased.length} units)
          </p>
        </div>
      </div>

      {/* 2. Property Revenue Distribution Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Portfolio Contract Revenue Contribution (PLH-AM vs. PLH-KW)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Proportional contribution to total contracted rent of {formatCurrency(metrics.totalContractValue, sym)}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono font-bold">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              PLH-AM: {amSharePct}% ({formatCurrency(amTotalContract, sym)})
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="w-3 h-3 rounded-sm bg-amber-500" />
              PLH-KW: {kwSharePct}% ({formatCurrency(kwTotalContract, sym)})
            </span>
          </div>
        </div>

        <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex p-0.5 gap-0.5">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-l-full transition-all duration-500"
            style={{ width: `${amSharePct}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-r-full transition-all duration-500"
            style={{ width: `${kwSharePct}%` }}
          />
        </div>
      </div>

      {/* 3. Financial Contract Valuation & Collections Ledger */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              Tenant Rent & Contract Valuation Ledger ({filteredContracts.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Detailed breakdown of monthly rent, contract duration, and total advance rent in Ghanaian Cedis (GH₵)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              {['all', 'PLH-AM', 'PLH-KW'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedProp(p)}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    selectedProp === p
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p === 'all' ? 'All Properties' : p}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resident..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <button
              type="button"
              onClick={() => onExportCSV(filteredContracts)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              Export Ledger
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Tenant ID & Name</th>
                <th className="px-4 py-3.5">Unit & Property</th>
                <th className="px-4 py-3.5">Contract Term</th>
                <th className="px-4 py-3.5 text-right">Monthly Rent (GHS)</th>
                <th className="px-4 py-3.5 text-center">Months</th>
                <th className="px-4 py-3.5 text-right">Total Rent to Pay (GHS)</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Statement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredContracts.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onSelectTenant(t)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {t.id}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">{t.name}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 font-mono text-xs font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">{t.unit}</span>
                    <span className="text-slate-400 mx-1">•</span>
                    <span className="text-slate-600 dark:text-slate-300">{t.property}</span>
                  </td>

                  <td className="px-4 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {formatDateCSV(t.contractStart)} → {formatDateCSV(t.contractEnd)}
                  </td>

                  <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(t.monthlyRent, sym)}
                  </td>

                  <td className="px-4 py-3.5 text-center font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t.durationMonths}
                  </td>

                  <td className="px-4 py-3.5 text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(t.totalRent, sym)}
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        t.rentStatus === 'Expired'
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                          : t.rentStatus === 'Expiring Soon'
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {t.rentStatus}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onOpenStatement(t)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Statement
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
