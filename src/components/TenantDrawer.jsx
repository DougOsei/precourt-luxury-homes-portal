import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  MessageSquare,
  Building2,
  Calendar,
  Clock,
  Wallet,
  FileText,
  RefreshCw,
  Edit3,
  Save,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  History,
  Sparkles,
  ExternalLink,
  Wrench,
  Printer,
  Receipt
} from 'lucide-react';
import { COVERED_FACILITY_SERVICES } from '../data/maintenanceData';
import {
  formatCurrency,
  formatDateCSV,
  formatPhone,
  getDialUrl,
  getWhatsAppUrl,
  buildWhatsAppMessage,
  getInitials,
  calculateMonthsBetween,
  toISODateString
} from '../utils';

export default function TenantDrawer({
  tenant,
  properties,
  settings,
  maintenanceFees = [],
  facilitySchedules = [],
  onClose,
  onSaveInline,
  onOpenFullEditModal,
  onOpenRenewModal,
  onOpenStatementModal
}) {
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [draft, setDraft] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => {
    if (tenant) {
      setIsEditingInline(false);
      setDraft({
        id: tenant.id || '',
        name: tenant.isVacantSlot ? '' : (tenant.name || ''),
        phone: tenant.phone || '',
        whatsapp: tenant.whatsapp || '',
        email: tenant.email || '',
        property: tenant.property || 'PLH-AM',
        unit: tenant.unit || '',
        contractStart: toISODateString(tenant.contractStart) || '2026-10-01',
        contractEnd: toISODateString(tenant.contractEnd) || '2027-10-01',
        monthlyRent: tenant.monthlyRent || 2000,
        durationMonths: tenant.durationMonths || 12,
        totalRent: tenant.totalRent || 24000,
        renewalDate: toISODateString(tenant.renewalDate || tenant.contractEnd) || '2027-10-01',
        notes: tenant.notes || ''
      });
    }
  }, [tenant]);

  if (!tenant) return null;

  const sym = settings?.currencySymbol || 'GH₵';
  const threshold = settings?.expiryWarningThresholdDays || 90;
  const isVacant = tenant.rentStatus === 'No Contract' || tenant.isVacantSlot;
  const isExpired = tenant.rentStatus === 'Expired';
  const isExpiringSoon = tenant.rentStatus === 'Expiring Soon';

  const progress = tenant.progress || {
    totalDays: 365,
    elapsedDays: 0,
    remainingDays: tenant.daysToExpiry ?? 0,
    percentRemaining: 50,
    percentElapsed: 50
  };

  // Circular countdown ring geometry
  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (progress.percentRemaining / 100) * ringCircumference;
  const ringStrokeColor = isVacant
    ? '#64748b'
    : isExpired
      ? '#f43f5e'
      : isExpiringSoon
        ? '#f59e0b'
        : '#10b981';

  const waPhone = tenant.whatsapp || tenant.phone;
  const waRenewalMsg = buildWhatsAppMessage(
    tenant,
    isExpired ? 'overdue' : 'renewal',
    settings
  );

  const tenantFeeRecord = maintenanceFees.find(
    (f) =>
      (f.tenantId && f.tenantId === tenant.id) ||
      (f.unitId && f.unitId.toUpperCase() === (tenant.unit || '').toUpperCase())
  ) || {
    id: `MF-${tenant.unit || '01'}-2026`,
    tenantId: tenant.id,
    unitId: tenant.unit,
    billingYear: 2026,
    totalAmountDue: 3000,
    amountPaid: 0,
    paymentStatus: 'PENDING',
    dueDate: '2026-03-31',
    paymentDate: null,
    paymentMethod: 'Mobile Money (MTN MoMo)',
    receiptNumber: `PLH-REC-2026-${tenant.unit || '00'}`
  };

  const handleDraftDateChange = (field, value) => {
    const updated = { ...draft, [field]: value };
    if (updated.contractStart && updated.contractEnd) {
      const mos = calculateMonthsBetween(updated.contractStart, updated.contractEnd);
      updated.durationMonths = mos;
      updated.totalRent = (Number(updated.monthlyRent) || 0) * mos;
      updated.renewalDate = updated.contractEnd;
    }
    setDraft(updated);
  };

  const handleDraftRentOrMonthsChange = (field, value) => {
    const updated = { ...draft, [field]: value };
    const rent = Number(field === 'monthlyRent' ? value : updated.monthlyRent) || 0;
    const mos = Number(field === 'durationMonths' ? value : updated.durationMonths) || 1;
    updated.totalRent = rent * mos;
    setDraft(updated);
  };

  const handleSaveInlineSubmit = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSaveInline({
      ...tenant,
      ...draft,
      isVacantSlot: false,
      monthlyRent: Number(draft.monthlyRent) || 0,
      durationMonths: Number(draft.durationMonths) || 12,
      totalRent: Number(draft.totalRent) || (Number(draft.monthlyRent) * Number(draft.durationMonths))
    });
    setIsEditingInline(false);
  };

  const propDetails = properties.find((p) => p.id === tenant.property);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Right-Hand Slide-Over Panel */}
      <aside
        aria-label="Tenant Details Slide-Over Panel"
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Top Drawer Header: Tenant Profile */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-14 h-14 rounded-2xl font-black text-lg flex items-center justify-center shrink-0 shadow-lg ${
                  isExpired
                    ? 'bg-gradient-to-br from-rose-500 to-rose-700 text-white'
                    : isExpiringSoon
                      ? 'bg-gradient-to-br from-amber-400 to-orange-600 text-slate-950'
                      : 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white ring-2 ring-amber-400/40'
                }`}
              >
                {getInitials(tenant.name)}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md font-mono text-xs font-extrabold bg-white/10 text-amber-300 border border-amber-400/30">
                    {tenant.id}
                  </span>
                  {isVacant ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-700 text-slate-200">
                      No Contract / Vacant
                    </span>
                  ) : isExpired ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/25 text-rose-200 border border-rose-400/40">
                      OVERDUE / EXPIRED
                    </span>
                  ) : isExpiringSoon ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/25 text-amber-200 border border-amber-400/40">
                      {tenant.expiryAlert}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/25 text-emerald-200 border border-emerald-400/40">
                      Active • OK
                    </span>
                  )}
                </div>

                <h2 className="mt-1 text-lg sm:text-xl font-extrabold text-white truncate">
                  {tenant.name}
                </h2>
                <p className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-amber-300 font-bold">{tenant.unit}</span>
                  <span>•</span>
                  <span>{propDetails?.name || tenant.property}</span>
                </p>
                {tenant.lastUpdatedBy && (
                  <p className="text-[11px] text-emerald-300/90 mt-1 flex items-center gap-1.5">
                    <span>
                      Last updated by <strong>{tenant.lastUpdatedBy}</strong> (
                      {tenant.lastUpdatedByRole === 'SUPER_ADMIN'
                        ? 'Super Admin'
                        : 'Facility Manager'}
                      )
                    </span>
                    {tenant.lastUpdatedAt && (
                      <span className="text-slate-400">
                        • {new Date(tenant.lastUpdatedAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition cursor-pointer shrink-0"
              aria-label="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Direct Contact Shortcuts Strip */}
          {!isVacant && (
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2">
              {waPhone ? (
                <a
                  href={getWhatsAppUrl(waPhone, buildWhatsAppMessage(tenant, 'general', settings))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-xs font-bold transition"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp</span>
                </a>
              ) : (
                <span className="flex items-center justify-center py-2 px-3 rounded-xl bg-white/5 text-slate-400 text-xs">
                  No WhatsApp
                </span>
              )}

              {tenant.phone ? (
                <a
                  href={getDialUrl(tenant.phone)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition font-mono"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-300" />
                  <span>{formatPhone(tenant.phone)}</span>
                </a>
              ) : (
                <span className="flex items-center justify-center py-2 px-3 rounded-xl bg-white/5 text-slate-400 text-xs">
                  No Phone
                </span>
              )}

              {tenant.email ? (
                <a
                  href={`mailto:${tenant.email}`}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition truncate"
                  title={tenant.email}
                >
                  <Mail className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                  <span className="truncate">Email</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingInline(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-dashed border-white/20 text-[11px] font-semibold transition cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>+ Add Email</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {isEditingInline && draft ? (
            /* INLINE EDIT FORM */
            <form id="drawer-inline-form" onSubmit={handleSaveInlineSubmit} className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-emerald-500/30">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Inline Record Editor
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingInline(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Tenant ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.id}
                    onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dominic Bannerman"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={draft.whatsapp}
                    onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })}
                    placeholder="Defaults to Phone"
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="resident@example.com"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Property *
                  </label>
                  <select
                    value={draft.property}
                    onChange={(e) => setDraft({ ...draft, property: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.shortName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Apartment / Unit *
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.unit}
                    onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Contract Start *
                  </label>
                  <input
                    type="date"
                    required
                    value={draft.contractStart}
                    onChange={(e) => handleDraftDateChange('contractStart', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Contract End *
                  </label>
                  <input
                    type="date"
                    required
                    value={draft.contractEnd}
                    onChange={(e) => handleDraftDateChange('contractEnd', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Monthly Rent ({sym})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={draft.monthlyRent}
                    onChange={(e) => handleDraftRentOrMonthsChange('monthlyRent', e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    No. of Months
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={draft.durationMonths}
                    onChange={(e) => handleDraftRentOrMonthsChange('durationMonths', e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Total Rent ({sym})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={draft.totalRent}
                    onChange={(e) => setDraft({ ...draft, totalRent: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Add lease remarks, payment notes, or special agreements..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingInline(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* 1. Lease Countdown Widget (Circular Ring + Linear Progress) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center gap-5">
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-24 h-24 -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r={ringRadius}
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="9"
                      className="text-slate-200 dark:text-slate-700"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={ringRadius}
                      fill="transparent"
                      stroke={ringStrokeColor}
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-black font-mono text-slate-900 dark:text-white leading-none">
                      {isVacant ? '—' : tenant.daysToExpiry}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                      {isVacant ? 'Vacant' : tenant.daysToExpiry < 0 ? 'Overdue' : 'Days Left'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      Lease Countdown
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      {isVacant ? '0%' : `${progress.percentRemaining}% Remaining`}
                    </span>
                  </div>

                  {/* Linear Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExpired
                          ? 'bg-rose-500'
                          : isExpiringSoon
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${isVacant ? 0 : Math.max(4, progress.percentRemaining)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span>Start: <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatDateCSV(tenant.contractStart)}</strong></span>
                    <span>End: <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatDateCSV(tenant.contractEnd)}</strong></span>
                  </div>
                </div>
              </div>

              {/* 2. Unit & Property Summary */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                  Unit & Property Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Property Code</span>
                    <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white mt-0.5 block">
                      {tenant.property}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Apartment / Unit</span>
                    <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      {tenant.unit}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Lease Duration</span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5 block">
                      {isVacant ? '—' : `${tenant.durationMonths} Months`}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Renewal Date</span>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white mt-1 block">
                      {formatDateCSV(tenant.renewalDate || tenant.contractEnd)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Financial Breakdown (GHS) */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-amber-500" />
                  Financial Breakdown (Ghanaian Cedis — GH₵)
                </h3>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white border border-slate-800 space-y-3">
                  <div className="grid grid-cols-2 gap-4 pb-3 border-b border-white/10">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Monthly Rent (GHS)
                      </span>
                      <span className="text-xl font-black font-mono text-white mt-0.5 block">
                        {formatCurrency(tenant.monthlyRent, sym)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90 block">
                        Total Rent to Pay (GHS)
                      </span>
                      <span className="text-xl font-black font-mono text-amber-300 mt-0.5 block">
                        {formatCurrency(tenant.totalRent, sym)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Contract Formula:</span>
                    <span className="font-mono">
                      {formatCurrency(tenant.monthlyRent, sym)} × {tenant.durationMonths} Months ={' '}
                      <strong className="text-emerald-300">{formatCurrency(tenant.totalRent, sym)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* 3B. Annual Maintenance Fee & Transparency Widget (GH₵ 3,000 / Billing Year) */}
              {!isVacant && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                      Annual Maintenance Fee & Transparency
                    </h3>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      GH₵ 3,000.00 / 2026
                    </span>
                  </div>

                  {/* Fee Status Card */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                          Annual Service Charge
                        </span>
                        <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                          GH₵ 3,000.00
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                          Payment Status
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            tenantFeeRecord.paymentStatus === 'PAID'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : tenantFeeRecord.paymentStatus === 'PARTIALLY_PAID'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : tenantFeeRecord.paymentStatus === 'OVERDUE'
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-black'
                                  : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {tenantFeeRecord.paymentStatus}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Paid to Date</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          GH₵ {(tenantFeeRecord.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Balance Due</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          GH₵ {Math.max(0, 3000 - (tenantFeeRecord.amountPaid || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Due Date</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatDateCSV(tenantFeeRecord.dueDate || '2026-03-31')}
                        </span>
                      </div>
                    </div>

                    {tenantFeeRecord.receiptNumber && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Receipt: <strong className="text-slate-800 dark:text-slate-200">{tenantFeeRecord.receiptNumber}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowReceiptModal(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View / Print Receipt</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* "Where Your Fee Goes" Breakdown Widget */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/20 to-teal-950/20 border border-emerald-500/20 dark:border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Where Your GH₵ 3,000 Fee Goes
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        4 Covered Services
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {COVERED_FACILITY_SERVICES.map((srv) => (
                        <div
                          key={srv.id}
                          className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-500/15 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                              <span>{srv.icon}</span>
                              <span>{srv.title}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              {srv.description}
                            </p>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                            <span>{srv.schedule}</span>
                            <span className="font-mono">Next: {srv.nextDate}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Contact & Notes Details */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  Contact & Remarks
                </h3>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone Number</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
                        {tenant.phone ? formatPhone(tenant.phone) : 'Not provided'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">WhatsApp Number</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
                        {tenant.whatsapp ? formatPhone(tenant.whatsapp) : tenant.phone ? `${formatPhone(tenant.phone)} (Primary)` : 'Not provided'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Email Address</span>
                      {tenant.email ? (
                        <span className="font-medium text-slate-900 dark:text-white mt-0.5 block">{tenant.email}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px]">
                          No email address on file
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Notes / Remarks</span>
                    {tenant.notes ? (
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{tenant.notes}</p>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px]">
                        No special remarks logged for this contract
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. Renewal History Log */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-500" />
                  Contract & Renewal History ({tenant.renewalHistory?.length || (isVacant ? 0 : 1)})
                </h3>
                <div className="space-y-2">
                  {tenant.renewalHistory && tenant.renewalHistory.length > 0 ? (
                    tenant.renewalHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{item.type || 'Tenancy Agreement'}</div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{item.period}</div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-extrabold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.totalRent, sym)}
                          </div>
                          <div className="text-[10px] text-slate-400">{item.months} Months</div>
                        </div>
                      </div>
                    ))
                  ) : !isVacant ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {tenant.durationMonths}-Month Tenancy Agreement
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {formatDateCSV(tenant.contractStart)} to {formatDateCSV(tenant.contractEnd)}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(tenant.totalRent, sym)}
                        </div>
                        <div className="text-[10px] text-slate-400">{tenant.durationMonths} Months</div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                      Unit is currently vacant with no active contract history.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Quick Action Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 space-y-2.5">
          {!isVacant && (
            <div className="grid grid-cols-2 gap-2">
              {waPhone && (
                <a
                  href={getWhatsAppUrl(waPhone, waRenewalMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send WhatsApp Renewal Notice</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => onOpenRenewModal(tenant)}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-sm transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Extend / Renew Lease</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {!isVacant && (
              <button
                type="button"
                onClick={() => onOpenStatementModal(tenant)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Generate Tenant Statement</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isEditingInline) {
                  const form = document.getElementById('drawer-inline-form');
                  if (form) form.requestSubmit();
                } else {
                  setIsEditingInline(true);
                }
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isVacant ? 'col-span-2 bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700 hover:bg-slate-800'
              }`}
            >
              {isEditingInline ? (
                <>
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Save Changes</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isVacant ? 'Assign Tenant / Create Contract' : 'Edit Information'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Printable Official Maintenance Fee Receipt Modal */}
      {showReceiptModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="p-6 bg-gradient-to-br from-emerald-900 to-slate-950 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                  Precourt Luxury Homes Ltd.
                </span>
                <h3 className="text-lg font-black mt-0.5">Annual Maintenance Fee Receipt</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Official Payment Voucher • Billing Cycle {tenantFeeRecord.billingYear || 2026}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Receipt No.</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {tenantFeeRecord.receiptNumber || `PLH-REC-2026-${tenant.unit}`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Date of Issue</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {formatDateCSV(tenantFeeRecord.paymentDate || tenantFeeRecord.dueDate || '2026-03-31')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Tenant / Resident</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {tenant.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Apartment & Property</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    Unit {tenant.unit} ({tenant.property})
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Total Annual Fee Due:</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">GH₵ 3,000.00</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">Total Amount Paid:</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                    GH₵ {(tenantFeeRecord.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-emerald-500/20">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Outstanding Balance:</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                    GH₵ {Math.max(0, 3000 - (tenantFeeRecord.amountPaid || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{tenantFeeRecord.paymentMethod || 'Mobile Money / Bank Transfer'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Status:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{tenantFeeRecord.paymentStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span>Managing Facility Manager:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Douglas Amadie</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Official Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
