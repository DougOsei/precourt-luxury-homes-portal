import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UserPlus,
  Save,
  Building2,
  Calendar,
  Wallet,
  Clock,
  RefreshCw,
  MessageSquare,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Copy
} from 'lucide-react';
import {
  formatCurrency,
  formatDateCSV,
  formatPhone,
  calculateMonthsBetween,
  calculateDaysToExpiry,
  toISODateString,
  getWhatsAppUrl,
  buildWhatsAppMessage
} from '../utils';

// Reusable hook for native <dialog closedby="any"> + mandatory light-dismiss fallback
function useLightDismissDialog(isOpen, onClose) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (isOpen) onClose();
    };

    dialog.addEventListener('close', handleClose);

    // Mandatory fallback for browsers without native <dialog closedby> support
    let handleBackdropClick = null;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      handleBackdropClick = (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (handleBackdropClick) {
        dialog.removeEventListener('click', handleBackdropClick);
      }
    };
  }, [isOpen, onClose]);

  return dialogRef;
}

export default function TenantModal({
  isOpen,
  onClose,
  editingTenant,
  tenants,
  properties,
  settings,
  onSave
}) {
  const dialogRef = useLightDismissDialog(isOpen, onClose);
  const sym = settings?.currencySymbol || 'GH₵';
  const refDate = settings?.referenceDateMode || '2026-10-27';
  const threshold = Number(settings?.expiryWarningThresholdDays) || 90;

  const getNextTenantId = () => {
    const nums = tenants
      .map((t) => {
        const m = String(t.id || '').match(/^PLH-(\d+)$/i);
        return m ? Number(m[1]) : 0;
      })
      .filter((n) => n > 0);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 16;
    return `PLH-${String(maxNum + 1).padStart(3, '0')}`;
  };

  const [form, setForm] = useState({
    id: 'PLH-017',
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    property: 'PLH-AM',
    unit: 'AM-09',
    contractStart: '2026-10-27',
    contractEnd: '2027-10-27',
    monthlyRent: 2000,
    durationMonths: 12,
    totalRent: 24000,
    renewalDate: '2027-10-27',
    notes: ''
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editingTenant) {
      const isVac = editingTenant.isVacantSlot || editingTenant.rentStatus === 'No Contract';
      const defaultStart = toISODateString(editingTenant.contractStart) || '2026-10-27';
      const defaultEnd = toISODateString(editingTenant.contractEnd) || '2027-10-27';
      const defaultMos = editingTenant.durationMonths || 12;
      const defaultRent = editingTenant.monthlyRent || (editingTenant.property === 'PLH-KW' ? 5000 : 2000);
      setForm({
        id: isVac ? getNextTenantId() : editingTenant.id,
        name: isVac ? '' : (editingTenant.name || ''),
        phone: editingTenant.phone || '',
        whatsapp: editingTenant.whatsapp || '',
        email: editingTenant.email || '',
        property: editingTenant.property || 'PLH-AM',
        unit: editingTenant.unit || '',
        contractStart: defaultStart,
        contractEnd: defaultEnd,
        monthlyRent: defaultRent,
        durationMonths: defaultMos,
        totalRent: isVac ? defaultRent * defaultMos : (editingTenant.totalRent || defaultRent * defaultMos),
        renewalDate: toISODateString(editingTenant.renewalDate) || defaultEnd,
        notes: isVac ? '' : (editingTenant.notes || ''),
        originalVacantId: isVac ? editingTenant.id : null
      });
    } else {
      setForm({
        id: getNextTenantId(),
        name: '',
        phone: '',
        whatsapp: '',
        email: '',
        property: 'PLH-AM',
        unit: 'AM-09',
        contractStart: '2026-10-27',
        contractEnd: '2027-10-27',
        monthlyRent: 2000,
        durationMonths: 12,
        totalRent: 24000,
        renewalDate: '2027-10-27',
        notes: '',
        originalVacantId: null
      });
    }
  }, [isOpen, editingTenant]);

  const handlePropertyChange = (propId) => {
    const prop = properties.find((p) => p.id === propId);
    const defaultRent = prop?.defaultRent || (propId === 'PLH-KW' ? 5000 : 2000);
    const mos = Number(form.durationMonths) || 12;
    const prefix = propId === 'PLH-KW' ? 'KW-' : 'AM-';
    setForm({
      ...form,
      property: propId,
      unit: form.unit.startsWith(prefix) ? form.unit : `${prefix}09`,
      monthlyRent: defaultRent,
      totalRent: defaultRent * mos
    });
  };

  const applyDurationPreset = (months) => {
    const startStr = form.contractStart || '2026-10-27';
    const [y, m, d] = startStr.split('-').map(Number);
    const endObj = new Date(Date.UTC(y, m - 1 + months, d));
    const endISO = endObj.toISOString().split('T')[0];
    const rent = Number(form.monthlyRent) || 0;
    setForm({
      ...form,
      durationMonths: months,
      contractEnd: endISO,
      renewalDate: endISO,
      totalRent: rent * months
    });
  };

  const handleDatesChange = (field, val) => {
    const next = { ...form, [field]: val };
    if (next.contractStart && next.contractEnd) {
      const mos = calculateMonthsBetween(next.contractStart, next.contractEnd);
      next.durationMonths = mos;
      next.totalRent = (Number(next.monthlyRent) || 0) * mos;
      next.renewalDate = next.contractEnd;
    }
    setForm(next);
  };

  const handleRentOrMonthsChange = (field, val) => {
    const next = { ...form, [field]: val };
    const rent = Number(field === 'monthlyRent' ? val : next.monthlyRent) || 0;
    const mos = Number(field === 'durationMonths' ? val : next.durationMonths) || 1;
    next.totalRent = rent * mos;
    setForm(next);
  };

  const previewDaysToExpiry = calculateDaysToExpiry(form.contractEnd, refDate);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.id.trim() || !form.name.trim() || !form.phone.trim() || !form.unit.trim()) {
      setError('Please fill in all required fields (Tenant ID, Full Name, Phone, and Unit).');
      return;
    }
    onSave(form);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="tenant-modal-title"
      className="m-auto w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 shadow-2xl p-0 overflow-hidden backdrop:bg-slate-950/70"
    >
      {isOpen && (
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 id="tenant-modal-title" className="text-base sm:text-lg font-extrabold">
                  {editingTenant && !editingTenant.isVacantSlot
                    ? `Edit Tenant Record — ${editingTenant.id}`
                    : 'Register Tenant & Lease Agreement'}
                </h2>
                <p className="text-xs text-slate-300">
                  Auto-calculates contract months, total rent in GH₵, and dynamic expiry countdown
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-600 dark:text-rose-300">
                {error}
              </div>
            )}

            {/* Row 1: Tenant ID & Full Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tenant ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="PLH-017"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tenant Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dominic Bannerman"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Row 2: Phone, WhatsApp, Email */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="057 330 4065"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    WhatsApp Number
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, whatsapp: form.phone })}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Same as Phone
                  </button>
                </div>
                <input
                  type="tel"
                  placeholder="057 330 4065"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="resident@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>

            {/* Row 3: Property & Apartment/Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Property Selection *
                </label>
                <select
                  value={form.property}
                  onChange={(e) => handlePropertyChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} — {p.shortName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Apartment / Unit Identifier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AM-01 or KW-02"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2 text-sm font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            {/* Row 4: Contract Dates & Duration Shortcuts */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  Contract Timeline & Auto-Countdown
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Quick term:</span>
                  {[6, 12, 18, 24].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => applyDurationPreset(m)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        Number(form.durationMonths) === m
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {m} Mos
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Contract Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.contractStart}
                    onChange={(e) => handleDatesChange('contractStart', e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Contract End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.contractEnd}
                    onChange={(e) => handleDatesChange('contractEnd', e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Calculated Countdown
                  </label>
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-extrabold flex items-center justify-between">
                    <span>{previewDaysToExpiry !== null ? `${previewDaysToExpiry} Days` : '—'}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded ${
                        previewDaysToExpiry < 0
                          ? 'bg-rose-500/15 text-rose-600'
                          : previewDaysToExpiry <= threshold
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-emerald-500/15 text-emerald-600'
                      }`}
                    >
                      {previewDaysToExpiry < 0 ? 'OVERDUE' : previewDaysToExpiry <= threshold ? `≤${threshold}d` : 'OK'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 5: Financials (Monthly Rent, Months, Total Rent in GHS) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white border border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Monthly Rent ({sym}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.monthlyRent}
                  onChange={(e) => handleRentOrMonthsChange('monthlyRent', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Duration (Months) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.durationMonths}
                  onChange={(e) => handleRentOrMonthsChange('durationMonths', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-amber-300 mb-1">
                  Total Rent to Pay ({sym})
                </label>
                <div className="px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-400/30 text-sm font-mono font-black text-amber-300">
                  {formatCurrency(form.totalRent, sym)}
                </div>
              </div>
            </div>

            {/* Row 6: Notes / Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notes / Special Terms
              </label>
              <textarea
                rows={2}
                placeholder="Optional lease remarks, renewal notes, or payment arrangements..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {editingTenant && !editingTenant.isVacantSlot ? 'Save Changes' : 'Register Tenant & Contract'}
              </button>
            </div>
          </form>
        </div>
      )}
    </dialog>
  );
}

export function RenewLeaseModal({ isOpen, onClose, tenant, settings, onConfirmRenew }) {
  const dialogRef = useLightDismissDialog(isOpen, onClose);
  const sym = settings?.currencySymbol || 'GH₵';

  const [monthsToAdd, setMonthsToAdd] = useState(12);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newMonthlyRent, setNewMonthlyRent] = useState(2000);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen || !tenant) return;
    const baseStart = toISODateString(tenant.contractEnd) || '2026-10-27';
    const [y, m, d] = baseStart.split('-').map(Number);
    const nextEnd = new Date(Date.UTC(y, m - 1 + 12, d)).toISOString().split('T')[0];

    setMonthsToAdd(12);
    setNewStart(baseStart);
    setNewEnd(nextEnd);
    setNewMonthlyRent(tenant.monthlyRent || 2000);
    setNotes(`Renewed for 12 months effective ${formatDateCSV(baseStart)}.`);
  }, [isOpen, tenant]);

  const handlePresetMonths = (mos) => {
    setMonthsToAdd(mos);
    if (!newStart) return;
    const [y, m, d] = newStart.split('-').map(Number);
    const nextEnd = new Date(Date.UTC(y, m - 1 + mos, d)).toISOString().split('T')[0];
    setNewEnd(nextEnd);
    setNotes(`Renewed for ${mos} months effective ${formatDateCSV(newStart)}.`);
  };

  if (!tenant) return null;

  const totalRenewalValue = (Number(newMonthlyRent) || 0) * (Number(monthsToAdd) || 12);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirmRenew(tenant, {
      contractStart: newStart,
      contractEnd: newEnd,
      durationMonths: Number(monthsToAdd) || 12,
      monthlyRent: Number(newMonthlyRent) || tenant.monthlyRent,
      totalRent: totalRenewalValue,
      renewalDate: newEnd,
      notes
    });
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="renew-modal-title"
      className="m-auto w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 shadow-2xl p-0 overflow-hidden"
    >
      {isOpen && (
        <div>
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h2 id="renew-modal-title" className="text-base font-extrabold">
                  Extend / Renew Lease Agreement
                </h2>
                <p className="text-xs text-slate-300">
                  {tenant.name} ({tenant.id}) • {tenant.property} Unit {tenant.unit}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-400 block">Previous Contract End</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatDateCSV(tenant.contractEnd)} ({tenant.daysToExpiry}d)
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block">Current Monthly Rate</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(tenant.monthlyRent, sym)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Renewal Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[6, 12, 18, 24].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handlePresetMonths(m)}
                    className={`py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                      Number(monthsToAdd) === m
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {m} Months
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New End Date *
                </label>
                <input
                  type="date"
                  required
                  value={newEnd}
                  onChange={(e) => {
                    setNewEnd(e.target.value);
                    setMonthsToAdd(calculateMonthsBetween(newStart, e.target.value));
                  }}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900 text-white">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Monthly Rent ({sym}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newMonthlyRent}
                  onChange={(e) => setNewMonthlyRent(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm font-mono font-bold bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-amber-300 mb-1">
                  New Contract Total ({sym})
                </span>
                <div className="py-1.5 text-base font-mono font-black text-amber-300">
                  {formatCurrency(totalRenewalValue, sym)}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Renewal Remarks
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Confirm Lease Renewal
              </button>
            </div>
          </form>
        </div>
      )}
    </dialog>
  );
}

export function BulkWhatsAppModal({ isOpen, onClose, tenants, settings }) {
  const dialogRef = useLightDismissDialog(isOpen, onClose);
  const [audience, setAudience] = useState('priority'); // 'priority' | 'all'
  const sym = settings?.currencySymbol || 'GH₵';

  const leased = tenants.filter((t) => !t.isVacantSlot && t.rentStatus !== 'No Contract' && (t.whatsapp || t.phone));
  const priorityList = leased.filter(
    (t) => t.rentStatus === 'Expired' || t.rentStatus === 'Expiring Soon' || (t.daysToExpiry !== null && t.daysToExpiry <= 90)
  );

  const recipients = audience === 'priority' ? priorityList : leased;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="bulk-wa-title"
      className="m-auto w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 shadow-2xl p-0 overflow-hidden"
    >
      {isOpen && (
        <div className="flex flex-col max-h-[85vh]">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 id="bulk-wa-title" className="text-base font-extrabold">
                  WhatsApp Renewal & Reminder Dispatch Center
                </h2>
                <p className="text-xs text-slate-300">
                  Pre-filled personalized WhatsApp notices with contract dates and GH₵ rent figures
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAudience('priority')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  audience === 'priority'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Overdue & Upcoming ≤90d ({priorityList.length})
              </button>
              <button
                type="button"
                onClick={() => setAudience('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  audience === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                All Active Residents ({leased.length})
              </button>
            </div>
            <span className="text-xs text-slate-500">Click "Send Notice" to launch WhatsApp chat</span>
          </div>

          <div className="p-5 overflow-y-auto space-y-3 flex-1">
            {recipients.map((t) => {
              const msg = buildWhatsAppMessage(t, 'auto', settings);
              const phone = t.whatsapp || t.phone;
              const isOverdue = t.daysToExpiry < 0;
              const isSoon = t.daysToExpiry >= 0 && t.daysToExpiry <= 60;

              return (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        {t.id} • {t.unit}
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{t.name}</span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          isOverdue
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            : isSoon
                              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {t.daysToExpiry} days ({t.expiryAlert})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                      "{msg}"
                    </p>
                  </div>

                  <a
                    href={getWhatsAppUrl(phone, msg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Send Notice ({formatPhone(phone)})</span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </dialog>
  );
}

export function TenantStatementModal({ isOpen, onClose, tenant, properties, settings }) {
  const dialogRef = useLightDismissDialog(isOpen, onClose);
  if (!tenant) return null;

  const sym = settings?.currencySymbol || 'GH₵';
  const prop = properties.find((p) => p.id === tenant.property);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="statement-modal-title"
      className="m-auto w-full max-w-2xl rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-2xl p-0 overflow-hidden"
    >
      {isOpen && (
        <div>
          <div className="no-print px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span id="statement-modal-title">Official Tenant Lease & Financial Statement</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-8 space-y-6 bg-white text-slate-900">
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">
                  PRECOURT LUXURY HOMES
                </div>
                <h1 className="text-2xl font-black text-slate-900 mt-0.5">
                  OFFICIAL TENANCY STATEMENT
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Amamoley (PLH-AM) • Kwabenya (PLH-KW) • Greater Accra, Ghana
                </p>
              </div>
              <div className="text-right font-mono text-xs">
                <div className="font-bold text-slate-900">REF: STMT-{tenant.id}-2026</div>
                <div className="text-slate-500">Issued: {formatDateCSV('2026-10-27')}</div>
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                  {tenant.rentStatus}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="space-y-1">
                <div className="font-bold uppercase text-slate-400 text-[10px]">Resident Details</div>
                <div className="font-extrabold text-sm text-slate-900">{tenant.name}</div>
                <div className="font-mono text-slate-600">Tenant ID: {tenant.id}</div>
                <div className="font-mono text-slate-600">Phone: {formatPhone(tenant.phone)}</div>
                {tenant.email && <div className="text-slate-600">Email: {tenant.email}</div>}
              </div>
              <div className="space-y-1">
                <div className="font-bold uppercase text-slate-400 text-[10px]">Property & Unit</div>
                <div className="font-extrabold text-sm text-slate-900">{prop?.name || tenant.property}</div>
                <div className="font-mono font-bold text-emerald-700">Apartment / Unit: {tenant.unit}</div>
                <div className="text-slate-600">{prop?.location || 'Greater Accra, Ghana'}</div>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] font-extrabold uppercase text-slate-500">
                  <th className="py-2">Contract Description</th>
                  <th className="py-2">Start Date</th>
                  <th className="py-2">End Date</th>
                  <th className="py-2">Duration</th>
                  <th className="py-2 text-right">Monthly Rate</th>
                  <th className="py-2 text-right">Total Contract Rent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                <tr>
                  <td className="py-3 font-sans font-bold text-slate-900">
                    Residential Lease Agreement ({tenant.unit})
                  </td>
                  <td className="py-3">{formatDateCSV(tenant.contractStart)}</td>
                  <td className="py-3">{formatDateCSV(tenant.contractEnd)}</td>
                  <td className="py-3">{tenant.durationMonths} Months</td>
                  <td className="py-3 text-right">{formatCurrency(tenant.monthlyRent, sym)}</td>
                  <td className="py-3 text-right font-extrabold text-slate-900">
                    {formatCurrency(tenant.totalRent, sym)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Days Remaining to Expiry:</span>
                  <span className="font-mono font-bold">{tenant.daysToExpiry} Days</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Expiry Alert Status:</span>
                  <span className="font-mono font-bold">{tenant.expiryAlert}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-300">
                  <span>Total Contract Value:</span>
                  <span className="font-mono text-emerald-700">{formatCurrency(tenant.totalRent, sym)}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-dashed border-slate-300 text-center text-[11px] text-slate-400">
              Precourt Luxury Homes — Property & Facility Management Portal • Official Computer-Generated Statement
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
