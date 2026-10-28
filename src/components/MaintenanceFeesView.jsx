import React, { useState, useMemo } from 'react';
import {
  Wrench,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  CreditCard,
  Calendar,
  Wind,
  Trash2,
  Droplets,
  Sparkles,
  Search,
  Filter,
  Download,
  Plus,
  Receipt,
  FileText,
  UserCheck,
  Phone,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  Printer,
  X
} from 'lucide-react';
import {
  ANNUAL_MAINTENANCE_FEE_AMOUNT,
  CURRENT_BILLING_YEAR,
  COVERED_FACILITY_SERVICES,
  calculateMaintenanceFeeMetrics
} from '../data/maintenanceData';
import { formatCurrency, formatDateCSV, getWhatsAppUrl } from '../utils';

export default function MaintenanceFeesView({
  maintenanceFees = [],
  facilitySchedules = [],
  onUpdateFeesAndSchedules,
  currentUser,
  settings,
  onSelectTenant,
  tenants = []
}) {
  const [activeSubTab, setActiveSubTab] = useState('fees'); // 'fees' | 'operations' | 'breakdown'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OVERDUE' | 'PENDING' | 'PAID' | 'PARTIALLY_PAID'
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('ALL');

  // Modal States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [targetFeeRecord, setTargetFeeRecord] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');

  // Receipt Modal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceiptFee, setActiveReceiptFee] = useState(null);

  // Service Schedule Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [newScheduleType, setNewScheduleType] = useState('AC_SERVICING');
  const [newScheduleTitle, setNewScheduleTitle] = useState('');
  const [newScheduleFrequency, setNewScheduleFrequency] = useState('QUARTERLY');
  const [newScheduleProperty, setNewScheduleProperty] = useState('ALL');
  const [newScheduleDate, setNewScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [newScheduleVendor, setNewScheduleVendor] = useState('CoolBreeze Air Systems Ltd');
  const [newScheduleStaff, setNewScheduleStaff] = useState('Ing. Kwesi Boateng');
  const [newScheduleCost, setNewScheduleCost] = useState('1200');
  const [newScheduleNotes, setNewScheduleNotes] = useState('');

  const sym = settings?.currencySymbol || 'GH₵';

  // Metrics
  const metrics = useMemo(() => {
    return calculateMaintenanceFeeMetrics(maintenanceFees, facilitySchedules);
  }, [maintenanceFees, facilitySchedules]);

  // Filtered Fee Records
  const filteredFees = useMemo(() => {
    return maintenanceFees.filter((fee) => {
      if (statusFilter !== 'ALL' && fee.paymentStatus !== statusFilter) return false;
      if (propertyFilter !== 'ALL' && fee.propertyId !== propertyFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${fee.tenantName || ''} ${fee.unitId || ''} ${fee.phone || ''} ${
          fee.receiptNumber || ''
        } ${fee.propertyId || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [maintenanceFees, statusFilter, propertyFilter, searchQuery]);

  // Handle open Record Payment Modal
  const handleOpenPaymentModal = (fee) => {
    setTargetFeeRecord(fee);
    const remaining = Math.max(0, fee.totalAmountDue - fee.amountPaid);
    setPaymentAmount(String(remaining || 1500));
    setPaymentMethod('bank_transfer');
    setPaymentNotes('');
    setReceiptNumber(`RCP-2026-${Math.floor(100 + Math.random() * 900)}`);
    setPaymentModalOpen(true);
  };

  // Submit Payment
  const handleSubmitPayment = (e) => {
    e.preventDefault();
    if (!targetFeeRecord) return;
    const addedAmount = Number(paymentAmount) || 0;
    if (addedAmount <= 0) return;

    const newAmountPaid = (Number(targetFeeRecord.amountPaid) || 0) + addedAmount;
    const newStatus =
      newAmountPaid >= targetFeeRecord.totalAmountDue
        ? 'PAID'
        : newAmountPaid > 0
          ? 'PARTIALLY_PAID'
          : 'PENDING';

    const newInstallment = {
      id: `inst-${Date.now()}`,
      amount: addedAmount,
      date: new Date().toISOString().slice(0, 10),
      method: paymentMethod,
      receiptNumber: receiptNumber || `RCP-2026-${Date.now().toString().slice(-4)}`,
      notes: paymentNotes || 'Maintenance fee payment installment',
      recordedBy: currentUser?.fullName || 'Douglas Amadie'
    };

    const updatedFees = maintenanceFees.map((f) => {
      if (f.id !== targetFeeRecord.id) return f;
      return {
        ...f,
        amountPaid: newAmountPaid,
        paymentStatus: newStatus,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: paymentMethod,
        receiptNumber: receiptNumber || f.receiptNumber,
        installments: [newInstallment, ...(f.installments || [])],
        notes: paymentNotes ? `${f.notes ? f.notes + ' • ' : ''}${paymentNotes}` : f.notes,
        updatedAt: new Date().toISOString()
      };
    });

    // Create Audit Log Entry
    const auditEntry = {
      id: `log-fee-${Date.now()}`,
      action: 'RECORD_UPDATED',
      category: 'record_update',
      actorId: currentUser?.id || '',
      actorName: currentUser?.fullName || 'Douglas Amadie',
      actorEmail: currentUser?.email || '',
      actorRole: currentUser?.role || 'FACILITY_MANAGER',
      targetId: targetFeeRecord.id,
      targetLabel: `Maintenance Fee: ${targetFeeRecord.tenantName} (${targetFeeRecord.unitId})`,
      details: `Recorded GH₵ ${addedAmount.toLocaleString()} payment via ${paymentMethod} (Receipt: ${
        newInstallment.receiptNumber
      }). Total paid: GH₵ ${newAmountPaid.toLocaleString()} of GH₵ ${targetFeeRecord.totalAmountDue.toLocaleString()} (Status: ${newStatus}).`,
      timestamp: new Date().toISOString()
    };

    onUpdateFeesAndSchedules(updatedFees, facilitySchedules, auditEntry);
    setPaymentModalOpen(false);
    setTargetFeeRecord(null);
  };

  // Submit New Service Schedule
  const handleSubmitServiceSchedule = (e) => {
    e.preventDefault();
    if (!newScheduleTitle.trim()) return;

    const newSchedule = {
      id: `SCH-${newScheduleType.slice(0, 2)}-${Date.now()}`,
      serviceType: newScheduleType,
      title: newScheduleTitle.trim(),
      frequency: newScheduleFrequency,
      propertyId: newScheduleProperty,
      unitId: 'ALL UNITS',
      scheduledDate: newScheduleDate,
      completedDate: null,
      status: 'SCHEDULED',
      assignedVendor: newScheduleVendor,
      staffName: newScheduleStaff,
      costIncurred: Number(newScheduleCost) || 0,
      checklist: [
        { item: 'Service verification and tenant sign-off', done: false },
        { item: 'Technician safety & compliance check', done: false },
        { item: 'Waste & debris cleanup verified', done: false }
      ],
      notes: newScheduleNotes,
      receiptAttachmentUrl: null,
      loggedByManagerId: currentUser?.id || 'mgr-douglas-amadie',
      loggedByName: currentUser?.fullName || 'Douglas Amadie',
      updatedAt: new Date().toISOString()
    };

    const updatedSchedules = [newSchedule, ...facilitySchedules];
    const auditEntry = {
      id: `log-sch-${Date.now()}`,
      action: 'RECORD_UPDATED',
      category: 'record_update',
      actorId: currentUser?.id || '',
      actorName: currentUser?.fullName || 'Douglas Amadie',
      actorEmail: currentUser?.email || '',
      actorRole: currentUser?.role || 'FACILITY_MANAGER',
      targetId: newSchedule.id,
      targetLabel: `Facility Schedule: ${newSchedule.title}`,
      details: `Scheduled ${newSchedule.serviceType} for ${newSchedule.scheduledDate} with ${newSchedule.assignedVendor} (Budget: GH₵ ${newSchedule.costIncurred.toLocaleString()}).`,
      timestamp: new Date().toISOString()
    };

    onUpdateFeesAndSchedules(maintenanceFees, updatedSchedules, auditEntry);
    setScheduleModalOpen(false);
  };

  // Export Fee Ledger CSV
  const handleExportCSV = () => {
    const headers = [
      'Unit ID',
      'Tenant Name',
      'Phone',
      'Property',
      'Billing Year',
      'Amount Due (GHS)',
      'Amount Paid (GHS)',
      'Balance (GHS)',
      'Status',
      'Due Date',
      'Receipt Number',
      'Notes'
    ];
    const rows = filteredFees.map((f) => [
      f.unitId,
      f.tenantName,
      f.phone || '',
      f.propertyId,
      f.billingYear,
      f.totalAmountDue,
      f.amountPaid,
      Math.max(0, f.totalAmountDue - f.amountPaid),
      f.paymentStatus,
      f.dueDate,
      f.receiptNumber || '',
      (f.notes || '').replace(/"/g, '""')
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Precourt_Maintenance_Fees_${CURRENT_BILLING_YEAR}_Export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // WhatsApp Pre-filled Reminder Generator (30 days prior / overdue alert)
  const getFeeWhatsAppLink = (fee) => {
    if (!fee.phone) return null;
    const phone = fee.phone.replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('0') ? '233' + phone.substring(1) : phone.startsWith('233') ? phone : '233' + phone;
    const balance = Math.max(0, fee.totalAmountDue - fee.amountPaid);
    const msg =
      fee.paymentStatus === 'OVERDUE'
        ? `Dear ${fee.tenantName},\n\nThis is an urgent notice from Precourt Luxury Homes regarding the Annual Facility Maintenance Fee of GH₵ 3,000.00 for Unit ${fee.unitId} (${fee.propertyId}). Your outstanding balance of GH₵ ${balance.toLocaleString()} is currently OVERDUE.\n\nThis fee directly covers your Quarterly AC Servicing, Weekly Trash Collection, Borehole Water Pump Inspections, and Compound Cleaning.\n\nPlease remit via Mobile Money or Bank Transfer at your earliest convenience.\n\nBest regards,\nDouglas Amadie\nFacility Manager, Precourt Luxury Homes`
        : `Dear ${fee.tenantName},\n\nGreetings from Precourt Luxury Homes. This is a friendly reminder that the Annual Facility Operations & Maintenance Fee of GH₵ 3,000.00 for billing year ${fee.billingYear} (Unit ${fee.unitId}) is due on ${formatDateCSV(fee.dueDate)}.\n\nCovered services include:\n• Quarterly AC Servicing\n• Routine Trash Disposal\n• Water Pump Maintenance\n• Daily Compound Sweeping\n\nOutstanding: GH₵ ${balance.toLocaleString()}.\n\nWarm regards,\nDouglas Amadie\nFacility Manager`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Annual Maintenance Fees &amp; Facility Operations
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  GH₵ 3,000 / Tenant • Billing Year {CURRENT_BILLING_YEAR}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Managed by <strong>Douglas Amadie</strong> (Facility Manager). Tracks collection of fixed annual maintenance fees and execution of covered quarterly AC servicing, weekly trash pickup, water pump servicing, and compound cleaning.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Fee Ledger
            </button>
            <button
              type="button"
              onClick={() => {
                setNewScheduleType('AC_SERVICING');
                setNewScheduleTitle('Quarterly AC Servicing & Inspection');
                setNewScheduleFrequency('QUARTERLY');
                setScheduleModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Facility Service
            </button>
          </div>
        </div>

        {/* 2. Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200/70 dark:border-slate-800">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Total Fees Collected</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              {formatCurrency(metrics.totalCollected, sym)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>Billed: {formatCurrency(metrics.totalBilled, sym)}</span>
              <span className="font-bold text-emerald-500">{metrics.fullyPaidRate}% Full</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Outstanding Balance</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
              {formatCurrency(metrics.totalOutstanding, sym)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>{metrics.overdueCount + metrics.pendingCount} Units Pending</span>
              {metrics.overdueCount > 0 ? (
                <span className="text-rose-500 font-extrabold animate-pulse">
                  {metrics.overdueCount} Overdue!
                </span>
              ) : (
                <span className="text-emerald-500 font-semibold">0 Overdue</span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Good Standing Rate</span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {metrics.complianceRate}%
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${metrics.complianceRate}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Maintenance Fund Reserve</span>
              <CreditCard className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {formatCurrency(metrics.maintenanceFundBalance, sym)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Reserved for upcoming Q4 services &amp; emergencies
            </div>
          </div>
        </div>

        {/* Overdue Alert Banner if any overdue accounts */}
        {metrics.overdueCount > 0 && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-rose-800 dark:text-rose-200">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>
                <strong>Attention Douglas Amadie:</strong> {metrics.overdueCount} tenant account has overdue maintenance fees. Immediate reminder dispatched.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter('OVERDUE')}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white transition shrink-0 cursor-pointer"
            >
              Filter Overdue ({metrics.overdueCount})
            </button>
          </div>
        )}
      </div>

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveSubTab('fees')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'fees'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Tenant Fee Ledger ({maintenanceFees.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('operations')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'operations'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Facility Service Operations ({facilitySchedules.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('breakdown')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'breakdown'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>"Where Your Fee Goes" Covered Services</span>
        </button>
      </div>

      {/* 4. Tab Content A: Tenant Fee Ledger */}
      {activeSubTab === 'fees' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by tenant name, unit (e.g. AM-01, KW-05), phone or receipt..."
                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                {[
                  { id: 'ALL', label: 'All Units' },
                  { id: 'OVERDUE', label: 'Overdue' },
                  { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
                  { id: 'PENDING', label: 'Pending' },
                  { id: 'PAID', label: 'Paid in Full' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <select
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                aria-label="Filter by property complex"
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="ALL">All Properties</option>
                <option value="PLH-AM">PLH-AM (Amamoley)</option>
                <option value="PLH-KW">PLH-KW (Kwabenya)</option>
              </select>
            </div>
          </div>

          {/* Fee Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4">Unit / Complex</th>
                    <th className="py-3.5 px-4">Resident</th>
                    <th className="py-3.5 px-4">Billing Period</th>
                    <th className="py-3.5 px-4">Amount Paid / Due</th>
                    <th className="py-3.5 px-4">Balance</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70 text-sm">
                  {filteredFees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No maintenance fee records match your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredFees.map((fee) => {
                      const balance = Math.max(0, fee.totalAmountDue - fee.amountPaid);
                      const isOverdue = fee.paymentStatus === 'OVERDUE';
                      const isPaid = fee.paymentStatus === 'PAID';
                      const isPartial = fee.paymentStatus === 'PARTIALLY_PAID';
                      const waLink = getFeeWhatsAppLink(fee);

                      return (
                        <tr
                          key={fee.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                            isOverdue ? 'bg-rose-500/5 dark:bg-rose-500/10' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md font-mono text-xs font-black ${
                                  fee.propertyId === 'PLH-AM'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {fee.unitId}
                              </span>
                              <span className="text-xs text-slate-500 font-medium">{fee.propertyId}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {fee.tenantName}
                            </div>
                            {fee.phone && (
                              <div className="text-[11px] text-slate-400 font-mono">{fee.phone}</div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                            <div>Year {fee.billingYear}</div>
                            <div className="text-[11px] text-slate-400">Due: {formatDateCSV(fee.dueDate)}</div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                            <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                              {formatCurrency(fee.amountPaid, sym)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              of {formatCurrency(fee.totalAmountDue, sym)}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-xs">
                            {balance === 0 ? (
                              <span className="text-emerald-500">GH₵ 0.00 (Cleared)</span>
                            ) : (
                              <span className={isOverdue ? 'text-rose-500 font-black' : 'text-amber-500'}>
                                {formatCurrency(balance, sym)}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                isPaid
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                  : isPartial
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                    : isOverdue
                                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse'
                                      : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
                              }`}
                            >
                              {isPaid && <CheckCircle2 className="w-3.5 h-3.5" />}
                              {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                              {fee.paymentStatus.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Record Payment Button */}
                              {!isPaid && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPaymentModal(fee)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                                  title="Record Payment Installment"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Record Payment</span>
                                </button>
                              )}

                              {/* View Receipt Button */}
                              {fee.amountPaid > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveReceiptFee(fee);
                                    setReceiptModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                                  title="View Official Payment Receipt"
                                >
                                  <Receipt className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Receipt</span>
                                </button>
                              )}

                              {/* WhatsApp Reminder Button */}
                              {waLink && !isPaid && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                                    isOverdue
                                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 hover:bg-rose-500/25 border border-rose-500/30'
                                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                                  }`}
                                  title={isOverdue ? 'Dispatch Overdue WhatsApp Warning' : 'Send 30-Day Due Reminder'}
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </a>
                              )}
                            </div>
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
      )}

      {/* 5. Tab Content B: Recurring Maintenance Operations Tracker */}
      {activeSubTab === 'operations' && (
        <div className="space-y-6">
          {/* Operations Overview banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-500">
                  <Wind className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase">AC Servicing</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Quarterly (Q1-Q4)</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">CoolBreeze Air Systems • Next: Nov 2026</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-500">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase">Water Pump Station</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Monthly Pressure Check</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">AquaTech Solutions • 4.2 Bar Nominal</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-500">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase">Trash Evacuation</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Twice Weekly</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">CleanCity Ltd • Mon &amp; Thu Pickups</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase">Groundskeeping</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Daily Sweeps &amp; Lawns</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">Supervisor: Douglas Amadie</div>
            </div>
          </div>

          {/* Service Schedules Timeline Cards */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              Scheduled &amp; Executed Facility Operations Log (2026)
            </h3>

            <div className="space-y-4">
              {facilitySchedules.map((schedule) => {
                const isCompleted = schedule.status === 'COMPLETED';
                const isInProgress = schedule.status === 'IN_PROGRESS';

                return (
                  <div
                    key={schedule.id}
                    className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`p-3 rounded-xl shrink-0 ${
                          schedule.serviceType === 'AC_SERVICING'
                            ? 'bg-sky-500/15 text-sky-500'
                            : schedule.serviceType === 'WATER_PUMP'
                              ? 'bg-blue-500/15 text-blue-500'
                              : schedule.serviceType === 'TRASH_DISPOSAL'
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-purple-500/15 text-purple-500'
                        }`}
                      >
                        {schedule.serviceType === 'AC_SERVICING' && <Wind className="w-5 h-5" />}
                        {schedule.serviceType === 'WATER_PUMP' && <Droplets className="w-5 h-5" />}
                        {schedule.serviceType === 'TRASH_DISPOSAL' && <Trash2 className="w-5 h-5" />}
                        {schedule.serviceType === 'COMPOUND_CLEANING' && <Sparkles className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {schedule.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              isCompleted
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : isInProgress
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                  : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
                            }`}
                          >
                            {schedule.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                          <span>
                            <strong>Vendor:</strong> {schedule.assignedVendor} ({schedule.staffName})
                          </span>
                          <span>•</span>
                          <span>
                            <strong>Scheduled:</strong> {formatDateCSV(schedule.scheduledDate)}
                          </span>
                          {schedule.completedDate && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                Completed: {formatDateCSV(schedule.completedDate)}
                              </span>
                            </>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                          {schedule.notes}
                        </p>

                        {/* Checklist items */}
                        {Array.isArray(schedule.checklist) && schedule.checklist.length > 0 && (
                          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                            {schedule.checklist.map((chk, i) => (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] ${
                                  chk.done
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {chk.item}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex lg:flex-col items-center lg:items-end justify-between shrink-0 gap-2">
                      <div className="text-right">
                        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                          Incurred Cost
                        </div>
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(schedule.costIncurred, sym)}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Logged by {schedule.loggedByName}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab Content C: "Where Your Fee Goes" Covered Services Transparency Widget */}
      {activeSubTab === 'breakdown' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-amber-500/30">
            <div className="max-w-2xl">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider">
                Resident Transparency Guarantee
              </span>
              <h2 className="text-2xl sm:text-3xl font-black mt-3">
                Where Your GH₵ 3,000 Annual Maintenance Fee Goes
              </h2>
              <p className="text-sm text-slate-300 mt-2">
                At Precourt Luxury Homes, every cedi of your annual maintenance fee is ring-fenced to ensure pristine living conditions, uninterrupted essential utilities, and peak equipment longevity.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {COVERED_FACILITY_SERVICES.map((serv) => (
              <div
                key={serv.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                      {serv.frequency}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">{serv.cycle}</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-3">
                    {serv.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {serv.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Included Service Checklist:
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {serv.checklistItems.map((item, i) => (
                        <li
                          key={i}
                          className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <div>
                    <strong>Vendor:</strong> {serv.vendor} ({serv.technician})
                  </div>
                  <div className="font-mono text-amber-600 dark:text-amber-400">{serv.contact}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Modal: Record Payment Installment */}
      {paymentModalOpen && targetFeeRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Record Annual Maintenance Fee Payment
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Unit <strong>{targetFeeRecord.unitId}</strong> • {targetFeeRecord.tenantName} ({targetFeeRecord.propertyId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Total Due:</span>{' '}
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {formatCurrency(targetFeeRecord.totalAmountDue, sym)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Already Paid:</span>{' '}
                  <strong className="font-mono text-emerald-500">
                    {formatCurrency(targetFeeRecord.amountPaid, sym)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Remaining:</span>{' '}
                  <strong className="font-mono text-amber-500">
                    {formatCurrency(Math.max(0, targetFeeRecord.totalAmountDue - targetFeeRecord.amountPaid), sym)}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Payment Amount (GH₵)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max="100000"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-base font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="momo">MTN / Telecel MoMo</option>
                    <option value="cash">Cash Settlement</option>
                    <option value="cheque">Bank Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Receipt Number
                  </label>
                  <input
                    type="text"
                    required
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Notes / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via GCB Bank ref #TXN-991283"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="text-[11px] text-slate-400">
                Payment will be server-stamped by <strong>{currentUser?.fullName || 'Douglas Amadie'}</strong> and synced across all portal sessions.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition cursor-pointer"
                >
                  Confirm &amp; Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Printable Official Receipt Modal */}
      {receiptModalOpen && activeReceiptFee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                  Official Maintenance Receipt
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  Precourt Luxury Homes
                </h3>
                <p className="text-xs text-slate-400">Facility Operations &amp; Property Maintenance</p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Receipt No:</span>
                <span className="font-mono font-bold">{activeReceiptFee.receiptNumber || 'RCP-2026-OFFICIAL'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date Issued:</span>
                <span>{formatDateCSV(activeReceiptFee.paymentDate || new Date().toISOString().slice(0, 10))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Resident Name:</span>
                <span className="font-bold">{activeReceiptFee.tenantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Apartment / Unit:</span>
                <span className="font-mono font-bold text-amber-500">{activeReceiptFee.unitId} ({activeReceiptFee.propertyId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Billing Year:</span>
                <span>{activeReceiptFee.billingYear} (Annual Cycle)</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-sm font-bold">
                <span>Amount Paid:</span>
                <span className="font-mono text-emerald-500">{formatCurrency(activeReceiptFee.amountPaid, sym)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Outstanding Balance:</span>
                <span className="font-mono text-slate-400">
                  {formatCurrency(Math.max(0, activeReceiptFee.totalAmountDue - activeReceiptFee.amountPaid), sym)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-500 space-y-1">
              <div><strong>Covered Services:</strong> Quarterly AC Servicing, Weekly Trash Collection, Water Pump Servicing, Common Area Sweeping.</div>
              <div><strong>Verified By:</strong> {currentUser?.fullName || 'Douglas Amadie'} (Facility Manager)</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal: Log Facility Service */}
      {scheduleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Schedule Facility Maintenance Service
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Logged by {currentUser?.fullName || 'Douglas Amadie'} (Facility Manager)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitServiceSchedule} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Service Category
                </label>
                <select
                  value={newScheduleType}
                  onChange={(e) => {
                    setNewScheduleType(e.target.value);
                    if (e.target.value === 'AC_SERVICING') {
                      setNewScheduleTitle('Quarterly AC Servicing & Chemical Coil Wash');
                      setNewScheduleVendor('CoolBreeze Air Systems Ltd');
                      setNewScheduleStaff('Ing. Kwesi Boateng');
                      setNewScheduleFrequency('QUARTERLY');
                    } else if (e.target.value === 'WATER_PUMP') {
                      setNewScheduleTitle('Water Pumping Station Routine Pressure Test');
                      setNewScheduleVendor('AquaTech Pumping Solutions');
                      setNewScheduleStaff('Frank Osei-Tutu');
                      setNewScheduleFrequency('MONTHLY');
                    } else if (e.target.value === 'TRASH_DISPOSAL') {
                      setNewScheduleTitle('Weekly Waste Evacuation & Bin Disinfection');
                      setNewScheduleVendor('CleanCity Waste Solutions Ltd');
                      setNewScheduleStaff('Supervisor Emmanuel Mensah');
                      setNewScheduleFrequency('WEEKLY');
                    } else {
                      setNewScheduleTitle('Compound Groundskeeping & Stairwell Deep Clean');
                      setNewScheduleVendor('Precourt Facilities Staff');
                      setNewScheduleStaff('Douglas Amadie');
                      setNewScheduleFrequency('DAILY');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="AC_SERVICING">Quarterly AC Servicing</option>
                  <option value="WATER_PUMP">Water Pump Servicing &amp; Maintenance</option>
                  <option value="TRASH_DISPOSAL">Routine Trash Disposal</option>
                  <option value="COMPOUND_CLEANING">Compound Sweeping &amp; Common Area Cleaning</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Service Title / Scope
                </label>
                <input
                  type="text"
                  required
                  value={newScheduleTitle}
                  onChange={(e) => setNewScheduleTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newScheduleDate}
                    onChange={(e) => setNewScheduleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Property Location
                  </label>
                  <select
                    value={newScheduleProperty}
                    onChange={(e) => setNewScheduleProperty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="ALL">Both Amamoley &amp; Kwabenya</option>
                    <option value="PLH-AM">Amamoley (PLH-AM)</option>
                    <option value="PLH-KW">Kwabenya (PLH-KW)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Assigned Vendor / Company
                  </label>
                  <input
                    type="text"
                    required
                    value={newScheduleVendor}
                    onChange={(e) => setNewScheduleVendor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Technician / Staff Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newScheduleStaff}
                    onChange={(e) => setNewScheduleStaff(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Budget / Cost Incurred (GH₵)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newScheduleCost}
                  onChange={(e) => setNewScheduleCost(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Operational Notes &amp; Scope
                </label>
                <textarea
                  rows={2}
                  value={newScheduleNotes}
                  onChange={(e) => setNewScheduleNotes(e.target.value)}
                  placeholder="Service requirements, access details, tenant notifications..."
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition cursor-pointer"
                >
                  Save Service Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
