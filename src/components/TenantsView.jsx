import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Download,
  MessageSquareShare,
  Phone,
  Mail,
  MessageSquare,
  Eye,
  Edit3,
  RefreshCw,
  Trash2,
  ChevronDown,
  Check,
  X,
  Building2,
  Calendar,
  ArrowUpDown
} from 'lucide-react';
import {
  formatCurrency,
  formatDateCSV,
  formatPhone,
  getDialUrl,
  getWhatsAppUrl,
  buildWhatsAppMessage,
  getInitials
} from '../utils';

function MultiSelectDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
          selected.length > 0
            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70'
        }`}
      >
        <span className="truncate">{label}</span>
        {selected.length > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold">
            {selected.length}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl z-30 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Filter by {label}</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          {options.map((opt) => {
            const isChecked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleOption(opt.value)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isChecked
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.dot && <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />}
                  <span className="truncate">{opt.label}</span>
                </div>
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                    isChecked
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {isChecked && <Check className="w-3 h-3" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TenantsView({
  tenants,
  properties,
  settings,
  initialFilters,
  onClearInitialFilters,
  onSelectTenant,
  onEditTenant,
  onRenewTenant,
  onDeleteTenant,
  onOpenAddTenant,
  onExportCSV,
  onOpenBulkWhatsApp
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [alertFilter, setAlertFilter] = useState([]);
  const [showVacantSlots, setShowVacantSlots] = useState(settings?.showVacantInDirectory || false);
  const [sortField, setSortField] = useState('id'); // 'id', 'name', 'daysToExpiry', 'monthlyRent', 'totalRent'
  const [sortDir, setSortDir] = useState('asc');

  const sym = settings?.currencySymbol || 'GH₵';
  const threshold = settings?.expiryWarningThresholdDays || 90;

  // Apply external filter navigation (e.g. from Dashboard cards/charts)
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.property) setPropertyFilter(initialFilters.property);
      if (initialFilters.status) {
        setStatusFilter(initialFilters.status);
        if (initialFilters.status.includes('No Contract')) {
          setShowVacantSlots(true);
        }
      }
      if (initialFilters.alert) setAlertFilter(initialFilters.alert);
      if (onClearInitialFilters) onClearInitialFilters();
    }
  }, [initialFilters]);

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: `${p.id} (${p.shortName})`,
    dot: p.id === 'PLH-AM' ? 'bg-emerald-500' : 'bg-amber-500'
  }));

  const statusOptions = [
    { value: 'Active', label: 'Active', dot: 'bg-emerald-500' },
    { value: 'Expiring Soon', label: 'Expiring Soon', dot: 'bg-amber-500' },
    { value: 'Expired', label: 'Expired', dot: 'bg-rose-500' },
    { value: 'No Contract', label: 'No Contract / Vacant', dot: 'bg-slate-400' }
  ];

  const alertOptions = [
    { value: 'OK', label: 'OK (Good Standing)', dot: 'bg-emerald-500' },
    { value: `EXPIRING: ${threshold} DAYS OR LESS`, label: `EXPIRING: ${threshold} DAYS OR LESS`, dot: 'bg-amber-500' },
    { value: 'OVERDUE / EXPIRED', label: 'OVERDUE / EXPIRED', dot: 'bg-rose-500' },
    { value: 'No Contract', label: 'No Contract / Vacant', dot: 'bg-slate-400' }
  ];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setPropertyFilter([]);
    setStatusFilter([]);
    setAlertFilter([]);
  };

  // Filter & Sort logic
  const filteredTenants = tenants
    .filter((t) => {
      if (!showVacantSlots && t.isVacantSlot && !statusFilter.includes('No Contract') && !alertFilter.includes('No Contract')) {
        return false;
      }

      if (propertyFilter.length > 0 && !propertyFilter.includes(t.property)) {
        return false;
      }

      if (statusFilter.length > 0 && !statusFilter.includes(t.rentStatus)) {
        return false;
      }

      if (alertFilter.length > 0) {
        const matchesAlert = alertFilter.some((af) => {
          if (af.startsWith('EXPIRING:')) return t.expiryAlert?.startsWith('EXPIRING:');
          return t.expiryAlert === af;
        });
        if (!matchesAlert) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = t.id?.toLowerCase().includes(q);
        const matchName = t.name?.toLowerCase().includes(q);
        const matchUnit = t.unit?.toLowerCase().includes(q);
        const matchProp = t.property?.toLowerCase().includes(q);
        const matchPhone = t.phone?.toLowerCase().includes(q) || formatPhone(t.phone).toLowerCase().includes(q);
        const matchEmail = t.email?.toLowerCase().includes(q);
        return matchId || matchName || matchUnit || matchProp || matchPhone || matchEmail;
      }

      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'id') {
        cmp = (a.id || '').localeCompare(b.id || '');
      } else if (sortField === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '');
      } else if (sortField === 'daysToExpiry') {
        const da = a.daysToExpiry ?? 99999;
        const db = b.daysToExpiry ?? 99999;
        cmp = da - db;
      } else if (sortField === 'monthlyRent') {
        cmp = (Number(a.monthlyRent) || 0) - (Number(b.monthlyRent) || 0);
      } else if (sortField === 'totalRent') {
        cmp = (Number(a.totalRent) || 0) - (Number(b.totalRent) || 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const activeFiltersCount = propertyFilter.length + statusFilter.length + alertFilter.length + (searchQuery ? 1 : 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Search & Multi-Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
          {/* Global Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Tenant Name, ID (e.g. PLH-001), Unit (AM-01, KW-02), or Phone..."
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenAddTenant}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-sm transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Tenant
            </button>

            <button
              type="button"
              onClick={() => onExportCSV(filteredTenants)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Export to CSV ({filteredTenants.length})
            </button>

            <button
              type="button"
              onClick={onOpenBulkWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl transition cursor-pointer"
            >
              <MessageSquareShare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Bulk WhatsApp Reminder
            </button>
          </div>
        </div>

        {/* Multi-Select Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filters:
            </span>

            <MultiSelectDropdown
              label="Property"
              options={propertyOptions}
              selected={propertyFilter}
              onChange={setPropertyFilter}
            />

            <MultiSelectDropdown
              label="Rent Status"
              options={statusOptions}
              selected={statusFilter}
              onChange={setStatusFilter}
            />

            <MultiSelectDropdown
              label="Expiry Alert"
              options={alertOptions}
              selected={alertFilter}
              onChange={setAlertFilter}
            />

            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showVacantSlots}
                onChange={(e) => setShowVacantSlots(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Show Vacant / No Contract Slots</span>
            </label>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Reset All ({activeFiltersCount})
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing <span className="font-extrabold text-slate-900 dark:text-white">{filteredTenants.length}</span> records
          </div>
        </div>
      </div>

      {/* 2. Interactive Tenant Data Table (responsive-table compliant) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs overflow-hidden">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="tenants-table-caption"
          className="table-wrapper"
        >
          <table className="plh-table text-left text-sm">
            <caption id="tenants-table-caption" className="sr-only">
              Precourt Luxury Homes Tenant Directory and Lease Status Table
            </caption>
            <thead className="bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-700/80">
              <tr>
                <th className="px-4 sm:px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => handleSort('id')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <span>Tenant ID & Resident</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="px-4 py-3.5">Unit & Property</th>
                <th className="px-4 py-3.5">Contract Timeline</th>
                <th className="px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => handleSort('monthlyRent')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <span>Rent Details (GH₵)</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => handleSort('daysToExpiry')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <span>Expiry Status & Alert</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="px-4 py-3.5">Contact Shortcuts</th>
                <th className="px-4 sm:px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredTenants.length > 0 ? (
                filteredTenants.map((tenant) => {
                  const isVacant = tenant.rentStatus === 'No Contract' || tenant.isVacantSlot;
                  const isExpired = tenant.rentStatus === 'Expired';
                  const isExpiringSoon = tenant.rentStatus === 'Expiring Soon';
                  const isAM = tenant.property === 'PLH-AM';
                  const waPhone = tenant.whatsapp || tenant.phone;
                  const waMessage = buildWhatsAppMessage(tenant, 'auto', settings);

                  return (
                    <tr
                      key={tenant.id}
                      onClick={() => onSelectTenant(tenant)}
                      className={`group transition-colors cursor-pointer ${
                        isVacant
                          ? 'bg-slate-50/40 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                          : 'hover:bg-emerald-50/40 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Col 1: Sticky Row Header (Tenant ID + Avatar + Name) */}
                      <th scope="row" className="px-4 sm:px-5 py-3.5 font-normal text-left group-hover:bg-emerald-50/40 dark:group-hover:bg-slate-800/60 transition-colors">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                              isVacant
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                : isExpired
                                  ? 'bg-gradient-to-br from-rose-500 to-rose-700 text-white'
                                  : isExpiringSoon
                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                                    : isAM
                                      ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white'
                                      : 'bg-gradient-to-br from-slate-800 to-slate-950 text-amber-300 ring-1 ring-amber-400/40'
                            }`}
                          >
                            {getInitials(tenant.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                                {tenant.id}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                {tenant.name}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              {tenant.phone ? (
                                <span className="font-mono">{formatPhone(tenant.phone)}</span>
                              ) : (
                                <span className="italic text-slate-400">No phone assigned</span>
                              )}
                              {tenant.email ? (
                                <span className="truncate max-w-[140px] text-slate-400">• {tenant.email}</span>
                              ) : (
                                !isVacant && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-400">
                                    No email
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </th>

                      {/* Col 2: Unit & Property Badge */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold bg-slate-900 dark:bg-slate-800 text-white border border-slate-700">
                            <Building2 className="w-3 h-3 text-amber-400" />
                            {tenant.unit || 'Unassigned'}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                              isAM
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {tenant.property} • {isAM ? 'Amasaman' : 'Kwabenya'}
                          </span>
                        </div>
                      </td>

                      {/* Col 3: Contract Timeline */}
                      <td className="px-4 py-3.5">
                        {isVacant ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 italic">
                            Vacant — Ready for Lease
                          </span>
                        ) : (
                          <div className="space-y-0.5 text-xs">
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <span>{formatDateCSV(tenant.contractStart)}</span>
                              <span className="text-slate-400">→</span>
                              <span>{formatDateCSV(tenant.contractEnd)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                                {tenant.durationMonths} Months
                              </span>
                              <span>Renewal: {formatDateCSV(tenant.renewalDate || tenant.contractEnd)}</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Col 4: Rent Details (Monthly & Total in GHS) */}
                      <td className="px-4 py-3.5">
                        {isVacant ? (
                          <div className="text-xs">
                            <div className="font-mono font-bold text-slate-500 dark:text-slate-400">
                              {formatCurrency(tenant.monthlyRent, sym)}/mo
                            </div>
                            <span className="text-[10px] text-slate-400">Market Asking Rate</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-mono font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">
                              {formatCurrency(tenant.monthlyRent, sym)}
                              <span className="text-[10px] font-normal text-slate-400"> /mo</span>
                            </div>
                            <div className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              Total: {formatCurrency(tenant.totalRent, sym)}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Col 5: Dynamic Expiry Badge & Countdown */}
                      <td className="px-4 py-3.5">
                        {isVacant ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            No Contract / Vacant
                          </span>
                        ) : isExpired ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/35">
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                              OVERDUE / EXPIRED
                            </span>
                            <div className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400 pl-1">
                              {tenant.daysToExpiry} days ({Math.abs(tenant.daysToExpiry)}d overdue)
                            </div>
                          </div>
                        ) : isExpiringSoon ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              {tenant.expiryAlert}
                            </span>
                            <div className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 pl-1">
                              {tenant.daysToExpiry} days remaining
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              OK • Active
                            </span>
                            <div className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 pl-1">
                              {tenant.daysToExpiry} days to expiry
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Col 6: Contact Shortcuts (One-click Call, Mailto, WhatsApp) */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        {isVacant ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {/* Call */}
                            {tenant.phone && (
                              <a
                                href={getDialUrl(tenant.phone)}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition"
                                title={`Call ${formatPhone(tenant.phone)}`}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}

                            {/* Direct WhatsApp with Pre-filled Greeting */}
                            {waPhone && (
                              <a
                                href={getWhatsAppUrl(waPhone, waMessage)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold transition"
                                title={`WhatsApp ${formatPhone(waPhone)}`}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>WA</span>
                              </a>
                            )}

                            {/* Email / Mailto */}
                            {tenant.email ? (
                              <a
                                href={`mailto:${tenant.email}?subject=${encodeURIComponent(`Precourt Luxury Homes — Tenancy Notice (${tenant.unit})`)}`}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition"
                                title={`Email ${tenant.email}`}
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onEditTenant(tenant)}
                                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 hover:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 transition cursor-pointer"
                                title="No email on file — click to add email"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Col 7: Row Actions (View Details, Edit Record, Renew Lease) */}
                      <td className="px-4 sm:px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectTenant(tenant)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer inline-flex items-center gap-1"
                            title="View Details in Slide-Over Drawer"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="hidden 2xl:inline">Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditTenant(tenant)}
                            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title={isVacant ? 'Assign Tenant to Unit' : 'Edit Record'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {!isVacant && (
                            <button
                              type="button"
                              onClick={() => onRenewTenant(tenant)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition cursor-pointer inline-flex items-center gap-1"
                              title="Renew Lease"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Renew</span>
                            </button>
                          )}

                          {!isVacant && (
                            <button
                              type="button"
                              onClick={() => onDeleteTenant(tenant)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Remove Tenant Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Users className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        No matching tenant records
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Try clearing one or more active filters or adjusting your search query.
                      </p>
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="mt-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
