import React, { useState } from 'react';
import {
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Phone,
  MessageSquare,
  RefreshCw,
  Eye,
  Sparkles,
  ChevronRight,
  Calendar,
  Activity,
  Wrench
} from 'lucide-react';
import {
  formatCurrency,
  formatCompactCurrency,
  formatDateCSV,
  getWhatsAppUrl,
  buildWhatsAppMessage,
  getDialUrl
} from '../utils';

export default function Dashboard({
  tenants,
  properties,
  metrics,
  settings,
  onNavigate,
  onSelectTenant,
  onRenewTenant,
  onFilterNavigate,
  auditLogs = [],
  maintenanceFees = [],
  facilitySchedules = []
}) {
  const [propertyChartMode, setPropertyChartMode] = useState('units'); // 'units' | 'revenue'
  const [selectedTimelineBucket, setSelectedTimelineBucket] = useState(null);
  const [hoveredRingSlice, setHoveredRingSlice] = useState(null);

  const sym = settings?.currencySymbol || 'GH₵';
  const threshold = settings?.expiryWarningThresholdDays || 90;

  // Maintenance fees overview for Facility Manager Douglas Amadie
  const overdueFeesList = maintenanceFees.filter((f) => f.paymentStatus === 'OVERDUE');
  const totalFeesCollected = maintenanceFees.reduce((acc, f) => acc + (Number(f.amountPaid) || 0), 0);
  const totalFeesDue = maintenanceFees.reduce((acc, f) => acc + (Number(f.totalAmountDue) || 3000), 0);
  const totalFeesOutstanding = Math.max(0, totalFeesDue - totalFeesCollected);
  const feeComplianceRate = totalFeesDue > 0 ? Math.round((totalFeesCollected / totalFeesDue) * 100) : 100;

  // Compute property breakdown (PLH-AM vs PLH-KW)
  const propertyStats = properties.map((prop) => {
    const propTenants = tenants.filter((t) => t.property === prop.id && t.rentStatus !== 'No Contract');
    const propVacant = tenants.filter((t) => t.property === prop.id && t.rentStatus === 'No Contract');
    const occupied = propTenants.length;
    const total = Math.max(prop.totalUnits || 8, occupied + propVacant.length);
    const vacant = Math.max(0, total - occupied);
    const occRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    const monthlyRev = propTenants.reduce((acc, t) => acc + (Number(t.monthlyRent) || 0), 0);
    const contractVal = propTenants.reduce((acc, t) => acc + (Number(t.totalRent) || 0), 0);
    const expiringCount = propTenants.filter((t) => t.rentStatus === 'Expiring Soon').length;
    const expiredCount = propTenants.filter((t) => t.rentStatus === 'Expired').length;

    return {
      ...prop,
      occupied,
      vacant,
      total,
      occRate,
      monthlyRev,
      contractVal,
      expiringCount,
      expiredCount
    };
  });

  // Compute Lease Expiry Timeline buckets (Overdue, 0-30d, 31-60d, 61-90d, 91-180d, 180+d)
  const leasedTenants = tenants.filter((t) => t.rentStatus !== 'No Contract' && t.daysToExpiry !== null);

  const timelineBuckets = [
    {
      id: 'overdue',
      label: 'Overdue (<0d)',
      shortLabel: 'Overdue',
      color: 'bg-rose-500',
      textColor: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      items: leasedTenants.filter((t) => t.daysToExpiry < 0)
    },
    {
      id: '30d',
      label: '0–30 Days',
      shortLabel: '≤30 Days',
      color: 'bg-orange-500',
      textColor: 'text-orange-600 dark:text-orange-400',
      badgeBg: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
      items: leasedTenants.filter((t) => t.daysToExpiry >= 0 && t.daysToExpiry <= 30)
    },
    {
      id: '60d',
      label: '31–60 Days',
      shortLabel: '31–60d',
      color: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
      items: leasedTenants.filter((t) => t.daysToExpiry > 30 && t.daysToExpiry <= 60)
    },
    {
      id: '90d',
      label: '61–90 Days',
      shortLabel: '61–90d',
      color: 'bg-teal-500',
      textColor: 'text-teal-600 dark:text-teal-400',
      badgeBg: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
      items: leasedTenants.filter((t) => t.daysToExpiry > 60 && t.daysToExpiry <= 90)
    },
    {
      id: '180d',
      label: '91–180 Days',
      shortLabel: '91–180d',
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      items: leasedTenants.filter((t) => t.daysToExpiry > 90 && t.daysToExpiry <= 180)
    },
    {
      id: '180plus',
      label: '180+ Days',
      shortLabel: '180+ Days',
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600 dark:text-indigo-400',
      badgeBg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      items: leasedTenants.filter((t) => t.daysToExpiry > 180)
    }
  ];

  const maxBucketCount = Math.max(1, ...timelineBuckets.map((b) => b.items.length));

  // Status Ring Chart Data
  const statusSlices = [
    {
      id: 'Active',
      label: 'Active (OK)',
      count: metrics.strictlyActiveCount,
      color: '#10b981', // emerald-500
      dotClass: 'bg-emerald-500',
      desc: `Contracts in good standing (>${threshold}d)`
    },
    {
      id: 'Expiring Soon',
      label: `Expiring Soon (≤${threshold}d)`,
      count: metrics.expiringSoonCount,
      color: '#f59e0b', // amber-500
      dotClass: 'bg-amber-500',
      desc: 'Requires renewal outreach'
    },
    {
      id: 'Expired',
      label: 'Expired / Overdue',
      count: metrics.expiredCount,
      color: '#f43f5e', // rose-500
      dotClass: 'bg-rose-500',
      desc: 'Immediate action required'
    },
    {
      id: 'No Contract',
      label: 'Vacant / No Contract',
      count: metrics.vacantUnits,
      color: '#64748b', // slate-500
      dotClass: 'bg-slate-500',
      desc: 'Available units ready for lease'
    }
  ];

  const totalStatusUnits = Math.max(1, statusSlices.reduce((acc, s) => acc + s.count, 0));

  // Calculate SVG Donut segments
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;
  const donutSegments = statusSlices.map((slice) => {
    const fraction = slice.count / totalStatusUnits;
    const dashArray = `${fraction * circumference} ${circumference}`;
    const dashOffset = -cumulativeFraction * circumference;
    cumulativeFraction += fraction;
    return {
      ...slice,
      fraction,
      percentage: Math.round(fraction * 100),
      dashArray,
      dashOffset
    };
  });

  // Priority Attention List: Expired + Expiring Soon + next closest expiring
  const priorityAttentionTenants = [...leasedTenants]
    .sort((a, b) => (a.daysToExpiry ?? 9999) - (b.daysToExpiry ?? 9999))
    .slice(0, 5);

  const activeTimelineBucketObj = timelineBuckets.find((b) => b.id === selectedTimelineBucket) || null;

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      {/* 1. Six Executive KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Occupancy Rate */}
        <div
          onClick={() => onNavigate('properties')}
          className="group relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs hover:shadow-lg hover:border-emerald-500/40 transition-all cursor-pointer overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
              Occupancy Rate
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {metrics.occupancyRate}%
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.occupiedUnits}/{metrics.totalUnits} Units
            </span>
          </div>
          <div className="mt-3 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
              style={{ width: `${metrics.occupancyRate}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{metrics.occupiedUnits} Occupied</span>
            <span>{metrics.vacantUnits} Vacant</span>
          </p>
        </div>

        {/* KPI 2: Active Leases Count */}
        <div
          onClick={() => onFilterNavigate('tenants', { status: ['Active'] })}
          className="group relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs hover:shadow-lg hover:border-emerald-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Active Leases
            </span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {metrics.activeLeasesCount}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Current
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
              {metrics.strictlyActiveCount} OK
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold">
              {metrics.expiringSoonCount} ≤{threshold}d
            </span>
          </div>
        </div>

        {/* KPI 3: Expiring Soon Leases (<= 60 Days) */}
        <div
          onClick={() => onFilterNavigate('tenants', { status: ['Expiring Soon'] })}
          className="group relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-500/30 dark:border-amber-500/30 shadow-xs hover:shadow-lg hover:border-amber-500/60 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Expiring ≤ {threshold}d
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {metrics.expiringSoonCount}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {metrics.expiringSoonCount === 1 ? 'Lease' : 'Leases'}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-300 font-semibold truncate">
            {metrics.expiringSoonCount > 0
              ? 'Warning: Renewal notice due'
              : `No leases expiring within ${threshold}d`}
          </p>
        </div>

        {/* KPI 4: Expired / Overdue Leases */}
        <div
          onClick={() => onFilterNavigate('tenants', { status: ['Expired'] })}
          className="group relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-rose-500/35 dark:border-rose-500/35 shadow-xs hover:shadow-lg hover:border-rose-500/70 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Expired / Overdue
            </span>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
              {metrics.expiredCount}
            </span>
            <span className="text-xs font-semibold text-rose-600/80 dark:text-rose-400/80">
              Action Needed
            </span>
          </div>
          <p className="mt-3 text-[11px] text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            {metrics.expiredCount > 0 ? 'Requires immediate renewal' : 'Zero overdue contracts'}
          </p>
        </div>

        {/* KPI 5: Total Monthly Projected Revenue (GHS) */}
        <div
          onClick={() => onNavigate('finances')}
          className="group relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs hover:shadow-lg hover:border-emerald-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Monthly Revenue
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {formatCurrency(metrics.monthlyProjectedRevenue, sym)}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>PLH-AM + PLH-KW</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Per Month</span>
          </p>
        </div>

        {/* KPI 6: Total Active Contract Value (GHS) */}
        <div
          onClick={() => onNavigate('finances')}
          className="group relative bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white p-5 rounded-2xl border border-amber-500/30 shadow-md hover:shadow-xl transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-amber-300/90 uppercase tracking-wider">
              Contract Value
            </span>
            <div className="p-2 rounded-xl bg-amber-400/15 text-amber-300 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
              {formatCurrency(metrics.totalContractValue, sym)}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-emerald-300/90 flex items-center justify-between font-medium">
            <span>Active: {formatCompactCurrency(metrics.activeContractValue, sym)}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-300" />
          </p>
        </div>
      </div>

      {/* 1B. Annual Maintenance Fee & Facility Operations Spotlight (GH₵ 3,000 / Unit) */}
      <div
        onClick={() => onNavigate('maintenance-fees')}
        className={`group p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          overdueFeesList.length > 0
            ? 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-500/40 hover:border-rose-500/70'
            : 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`p-3 rounded-2xl shrink-0 ${
              overdueFeesList.length > 0
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  overdueFeesList.length > 0
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {overdueFeesList.length > 0 ? `${overdueFeesList.length} OVERDUE ACCOUNTS` : 'ANNUAL FEES ALL CURRENT'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">
                Douglas Amadie • Facility Operations
              </span>
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white mt-0.5">
              Annual Maintenance Fee Ledger (GH₵ 3,000 / Unit) & Service Schedules
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Quarterly AC Servicing, Routine Trash Disposal, Water Pump Maintenance & Compound Cleaning.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 shrink-0 self-end md:self-center">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Collected to Date</span>
            <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
              GH₵ {totalFeesCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
              {feeComplianceRate}% Compliance
            </span>
          </div>
          <div className="text-right pl-4 border-l border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Outstanding</span>
            <span
              className={`text-base font-black font-mono ${
                overdueFeesList.length > 0
                  ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              GH₵ {totalFeesOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
              {overdueFeesList.length} Accounts
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-emerald-600 group-hover:text-white transition shadow-2xs">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 2. Three Visual Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Occupancy & Revenue by Property (PLH-AM vs PLH-KW) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                  Occupancy by Property
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PLH-AM (Amasaman) vs. PLH-KW (Kwabenya)
                </p>
              </div>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-bold">
                <button
                  onClick={() => setPropertyChartMode('units')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    propertyChartMode === 'units'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Units
                </button>
                <button
                  onClick={() => setPropertyChartMode('revenue')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    propertyChartMode === 'revenue'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Revenue
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              {propertyStats.map((prop, idx) => {
                const isAM = prop.id === 'PLH-AM';
                const maxRev = Math.max(...propertyStats.map((p) => p.contractVal), 1);
                const revBarPct = Math.round((prop.contractVal / maxRev) * 100);

                return (
                  <div
                    key={prop.id}
                    onClick={() => onFilterNavigate('tenants', { property: [prop.id] })}
                    className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 hover:border-emerald-500/40 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-mono font-extrabold ${
                            isAM
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {prop.id}
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {prop.shortName}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 font-mono">
                        {propertyChartMode === 'units'
                          ? `${prop.occupied}/${prop.total} (${prop.occRate}%)`
                          : formatCurrency(prop.monthlyRev, sym) + '/mo'}
                      </span>
                    </div>

                    {/* Visual Stacked Bar */}
                    {propertyChartMode === 'units' ? (
                      <>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isAM ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${prop.occRate}%` }}
                            title={`${prop.occupied} Occupied Units`}
                          />
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${isAM ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              {prop.occupied} Occupied
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                              {prop.vacant} Vacant
                            </span>
                          </div>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {formatCurrency(prop.monthlyRev, sym)}/mo
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isAM
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                                : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            }`}
                            style={{ width: `${revBarPct}%` }}
                          />
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Total Contract Value:</span>
                          <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(prop.contractVal, sym)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Combined Monthly Yield:</span>
            <span className="font-mono font-extrabold text-slate-900 dark:text-white">
              {formatCurrency(metrics.monthlyProjectedRevenue, sym)}
            </span>
          </div>
        </div>

        {/* Chart 2: Lease Expiry Timeline (30, 60, 90, 180+ days) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                  Lease Expiry Timeline
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upcoming contract expirations across 30, 60, 90, and 180+ day horizons
                </p>
              </div>
              {selectedTimelineBucket && (
                <button
                  onClick={() => setSelectedTimelineBucket(null)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Reset View
                </button>
              )}
            </div>

            {/* Vertical Bar Chart */}
            <div className="mt-5 grid grid-cols-6 gap-2.5 items-end h-44 pt-6 px-1">
              {timelineBuckets.map((bucket) => {
                const count = bucket.items.length;
                const heightPct = count === 0 ? 6 : Math.max(18, Math.round((count / maxBucketCount) * 100));
                const isSelected = selectedTimelineBucket === bucket.id;

                return (
                  <button
                    key={bucket.id}
                    type="button"
                    onClick={() => setSelectedTimelineBucket(isSelected ? null : bucket.id)}
                    className={`group flex flex-col items-center h-full justify-end cursor-pointer focus:outline-none ${
                      selectedTimelineBucket && !isSelected ? 'opacity-45' : 'opacity-100'
                    }`}
                  >
                    <span className={`text-xs font-mono font-extrabold mb-1.5 ${bucket.textColor}`}>
                      {count}
                    </span>
                    <div className="w-full bg-slate-100 dark:bg-slate-800/90 rounded-xl h-32 flex items-end p-1 border border-slate-200/50 dark:border-slate-800 group-hover:border-slate-300 dark:group-hover:border-slate-700 transition">
                      <div
                        className={`w-full rounded-lg transition-all duration-500 ${bucket.color} ${
                          isSelected ? 'ring-2 ring-offset-2 ring-emerald-500 dark:ring-offset-slate-900' : ''
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="mt-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 text-center leading-tight">
                      {bucket.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Interactive Bucket Detail Strip */}
            <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              {activeTimelineBucketObj ? (
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {activeTimelineBucketObj.label} ({activeTimelineBucketObj.items.length} leases)
                    </span>
                    <span className="text-[11px] text-slate-400">Click tenant to inspect</span>
                  </div>
                  {activeTimelineBucketObj.items.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                      {activeTimelineBucketObj.items.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onSelectTenant(t)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer flex items-center gap-1.5 ${activeTimelineBucketObj.badgeBg}`}
                        >
                          <span className="font-mono font-bold">{t.unit}</span>
                          <span className="truncate max-w-[110px]">{t.name}</span>
                          <span className="font-mono opacity-80">({t.daysToExpiry}d)</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No contracts fall within this timeframe.</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Click any bar above to inspect tenants in that expiry window.</span>
                  <button
                    onClick={() => onNavigate('leases')}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 shrink-0 cursor-pointer"
                  >
                    Pipeline <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart 3: Status Breakdown (Visual Ring / Donut Chart) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                Status Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Portfolio-wide lease & unit status
              </p>
            </div>

            {/* SVG Ring Chart */}
            <div className="my-4 flex items-center justify-center relative">
              <svg className="w-40 h-40 -rotate-90 transform" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="18"
                  className="text-slate-100 dark:text-slate-800"
                />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.id}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={hoveredRingSlice === seg.id ? '22' : '18'}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredRingSlice(seg.id)}
                    onMouseLeave={() => setHoveredRingSlice(null)}
                    onClick={() => onFilterNavigate('tenants', { status: [seg.id] })}
                  />
                ))}
              </svg>

              {/* Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                {hoveredRingSlice ? (
                  <>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {donutSegments.find((s) => s.id === hoveredRingSlice)?.count || 0}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 max-w-[85px] truncate">
                      {hoveredRingSlice}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {metrics.totalUnits}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Units
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Ring Legend */}
            <div className="space-y-2">
              {donutSegments.map((seg) => (
                <button
                  key={seg.id}
                  onClick={() => onFilterNavigate('tenants', { status: [seg.id] })}
                  onMouseEnter={() => setHoveredRingSlice(seg.id)}
                  onMouseLeave={() => setHoveredRingSlice(null)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${seg.dotClass}`} />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {seg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                      {seg.count}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 w-9 text-right">
                      ({seg.percentage}%)
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Priority Lease Alerts & Upcoming Expirations Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-white to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 dark:text-white text-base">
                Priority Lease Countdown & Immediate Action Queue
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sorted by shortest days to expiry — click any row to open the Slide-Over Tenant Drawer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('tenants')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 transition flex items-center gap-1 cursor-pointer"
            >
              Open Full Directory ({tenants.filter(t => !t.isVacantSlot).length})
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3">Tenant ID & Name</th>
                <th className="px-5 py-3">Property & Unit</th>
                <th className="px-5 py-3">Contract End</th>
                <th className="px-5 py-3">Monthly Rent</th>
                <th className="px-5 py-3">Days to Expiry</th>
                <th className="px-5 py-3">Expiry Alert</th>
                <th className="px-5 py-3 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {priorityAttentionTenants.map((t) => {
                const isExpired = t.daysToExpiry < 0;
                const isExpiring = t.daysToExpiry >= 0 && t.daysToExpiry <= threshold;
                const waNumber = t.whatsapp || t.phone;
                const waMsg = buildWhatsAppMessage(t, 'auto', settings);

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTenant(t)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 rounded-lg font-mono text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {t.id}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{t.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {t.durationMonths} Months • Total: {formatCurrency(t.totalRent, sym)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono">{t.unit}</span>
                        <span className="text-slate-400">•</span>
                        <span>{t.property}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {formatDateCSV(t.contractEnd)}
                    </td>

                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(t.monthlyRent, sym)}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-extrabold ${
                          isExpired
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            : isExpiring
                              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {t.daysToExpiry} days
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      {isExpired ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          OVERDUE / EXPIRED
                        </span>
                      ) : isExpiring ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          {t.expiryAlert}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          OK
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {waNumber && (
                          <a
                            href={getWhatsAppUrl(waNumber, waMsg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition"
                            title="Send WhatsApp Reminder"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </a>
                        )}
                        <button
                          onClick={() => onRenewTenant(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition cursor-pointer"
                          title="Renew Lease"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Renew</span>
                        </button>
                        <button
                          onClick={() => onSelectTenant(t)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Open Slide-Over Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Recent Synced Activity & Login Log */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 dark:text-white text-base">
                Recent Logins &amp; Record Updates Log
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tracks who signed in (Super Admin or Facility Manager) and which records were updated across sessions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('activity-log')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer self-start sm:self-center"
          >
            <span>View Full Activity Log ({auditLogs.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {auditLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No login or record update events logged yet in this session.
            </div>
          ) : (
            auditLogs.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 border ${
                      item.actorRole === 'SUPER_ADMIN'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {item.actorRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Facility Manager'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {item.actorName}{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        — {item.targetLabel || item.action}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      {item.details}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-400 shrink-0">
                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
