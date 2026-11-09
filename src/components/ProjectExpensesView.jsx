import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  HardHat,
  Building2,
  DollarSign,
  TrendingUp,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  Plus,
  Upload,
  Download,
  FileText,
  FileCheck,
  ChevronDown,
  X,
  Eye,
  Check,
  Trash2,
  Edit,
  ExternalLink,
  Layers,
  Compass,
  Umbrella,
  Zap,
  Palette,
  Truck,
  ShieldAlert,
  ArrowUpDown,
  RefreshCw,
  Printer,
  Sparkles,
  Phone,
  Tag
} from 'lucide-react';
import { z } from 'zod';
import {
  CONSTRUCTION_CATEGORIES,
  roundCurrency,
  formatGHS,
  formatUSD,
  calculateProjectMetrics,
  groupExpensesByCategory,
  groupExpensesByMonth,
  exportExpensesToCSV
} from '../data/constructionData';

// Zod Schema for logging/editing a project expense
const ExpenseFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Item description must be at least 3 characters')
    .max(200, 'Item description cannot exceed 200 characters'),
  categoryId: z.string().min(1, 'Please select a construction category'),
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(100_000_000, 'Amount cannot exceed GH₵ 100,000,000'),
  expenseDate: z.string().min(1, 'Please select an expense date'),
  vendorName: z
    .string()
    .trim()
    .min(2, 'Vendor/supplier name must be at least 2 characters')
    .max(120, 'Vendor name cannot exceed 120 characters'),
  vendorPhone: z.string().trim().max(40).optional().default(''),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE']),
  transactionReference: z.string().trim().max(80).optional().default(''),
  notes: z.string().trim().max(2000).optional().default('')
});

export default function ProjectExpensesView({
  projects = [],
  expenses = [],
  onUpdateProjectAndExpenses,
  currentUser,
  showToast = () => {}
}) {
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Active project selection (defaults to first project)
  const currentProject = projects[0] || {
    id: 'PRJ-PLH-PH1',
    projectName: 'Precourt Luxury Apartments - Phase 1',
    totalBudget: 4500000.0,
    currency: 'GHS',
    secondaryCurrency: 'USD',
    exchangeRate: 15.5,
    startDate: '2026-01-15',
    targetCompletionDate: '2026-12-20',
    projectStatus: 'ACTIVE',
    location: 'Airport Residential Area, Accra',
    description: 'Ultra-luxury 12-unit residential development with underground parking & pool.',
    adminApprovalThreshold: 10000.0
  };

  // Currency view state: 'GHS' (primary) or 'USD' (secondary)
  const [currencyMode, setCurrencyMode] = useState('GHS'); // 'GHS' | 'USD'

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'PAID'
  const [selectedDateRange, setSelectedDateRange] = useState('ALL'); // 'ALL' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'CUSTOM'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('ALL');

  // Modals
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [receiptPreviewExpense, setReceiptPreviewExpense] = useState(null);

  // Form states for Log/Edit modal
  const [formValues, setFormValues] = useState({
    title: '',
    categoryId: 'SUBSTRUCTURE_FOUNDATION',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    vendorName: '',
    vendorPhone: '',
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: '',
    notes: '',
    invoiceReceiptUrl: null,
    receiptFileName: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef(null);

  // Budget Edit form states
  const [budgetForm, setBudgetForm] = useState({
    projectName: currentProject.projectName || '',
    totalBudget: currentProject.totalBudget || 4500000,
    exchangeRate: currentProject.exchangeRate || 15.5,
    adminApprovalThreshold: currentProject.adminApprovalThreshold || 10000,
    targetCompletionDate: currentProject.targetCompletionDate || '2026-12-20',
    projectStatus: currentProject.projectStatus || 'ACTIVE'
  });

  // Fetch verified expenses from real database on mount
  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${currentProject.id || 'PRJ-PLH-PH1'}/expenses?t=${Date.now()}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.ok && Array.isArray(data.expenses)) {
          onUpdateProjectAndExpenses([currentProject], data.expenses, null);
        }
      })
      .catch((err) => {
        console.error('Failed to load project expenses from database:', err);
      });

    return () => {
      active = false;
    };
  }, [currentProject.id]);

  // Unique vendors for filter dropdown
  const uniqueVendors = useMemo(() => {
    const set = new Set();
    expenses.forEach((e) => {
      if (e.vendorName && e.vendorName.trim()) set.add(e.vendorName.trim());
    });
    return Array.from(set).sort();
  }, [expenses]);

  // Financial Metrics Calculation
  const metrics = useMemo(() => {
    return calculateProjectMetrics(currentProject, expenses);
  }, [currentProject, expenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const today = new Date();
    const thisMonthPrefix = today.toISOString().slice(0, 7); // "YYYY-MM"
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    return expenses.filter((exp) => {
      // 1. Search Query
      if (query) {
        const titleMatch = (exp.title || '').toLowerCase().includes(query);
        const vendorMatch = (exp.vendorName || '').toLowerCase().includes(query);
        const refMatch = (exp.transactionReference || '').toLowerCase().includes(query);
        const notesMatch = (exp.notes || '').toLowerCase().includes(query);
        const idMatch = (exp.id || '').toLowerCase().includes(query);
        if (!titleMatch && !vendorMatch && !refMatch && !notesMatch && !idMatch) {
          return false;
        }
      }

      // 2. Category filter
      if (selectedCategory !== 'ALL' && exp.categoryId !== selectedCategory) {
        return false;
      }

      // 3. Status filter
      if (selectedStatus !== 'ALL' && exp.approvalStatus !== selectedStatus) {
        return false;
      }

      // 4. Vendor filter
      if (selectedVendor !== 'ALL' && exp.vendorName !== selectedVendor) {
        return false;
      }

      // 5. Date filter
      if (selectedDateRange === 'THIS_MONTH') {
        if (!exp.expenseDate || !exp.expenseDate.startsWith(thisMonthPrefix)) return false;
      } else if (selectedDateRange === 'LAST_30_DAYS') {
        if (!exp.expenseDate || exp.expenseDate < thirtyDaysAgo) return false;
      } else if (selectedDateRange === 'CUSTOM') {
        if (customStartDate && exp.expenseDate < customStartDate) return false;
        if (customEndDate && exp.expenseDate > customEndDate) return false;
      }

      return true;
    });
  }, [
    expenses,
    searchQuery,
    selectedCategory,
    selectedStatus,
    selectedVendor,
    selectedDateRange,
    customStartDate,
    customEndDate
  ]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    return groupExpensesByCategory(expenses);
  }, [expenses]);

  // Monthly breakdown
  const monthlyTimeline = useMemo(() => {
    return groupExpensesByMonth(expenses);
  }, [expenses]);

  // Open Add modal
  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setFormValues({
      title: '',
      categoryId: 'SUBSTRUCTURE_FOUNDATION',
      amount: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      vendorName: '',
      vendorPhone: '',
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: '',
      notes: '',
      invoiceReceiptUrl: null,
      receiptFileName: ''
    });
    setFormErrors({});
    setLogModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (exp) => {
    setEditingExpense(exp);
    setFormValues({
      title: exp.title || '',
      categoryId: exp.categoryId || 'SUBSTRUCTURE_FOUNDATION',
      amount: exp.amount || '',
      expenseDate: exp.expenseDate || new Date().toISOString().slice(0, 10),
      vendorName: exp.vendorName || '',
      vendorPhone: exp.vendorPhone || '',
      paymentMethod: exp.paymentMethod || 'BANK_TRANSFER',
      transactionReference: exp.transactionReference || '',
      notes: exp.notes || '',
      invoiceReceiptUrl: exp.invoiceReceiptUrl || null,
      receiptFileName: exp.receiptFileName || ''
    });
    setFormErrors({});
    setLogModalOpen(true);
  };

  // Receipt File Upload Handler (PNG, JPG, PDF up to 10MB)
  const handleReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      showToast('Receipt file size exceeds 10 MB limit.', 'error');
      return;
    }

    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      showToast('Unsupported file type. Please upload a PNG, JPEG, or PDF receipt.', 'error');
      return;
    }

    setUploadingReceipt(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string') {
        // Attempt upload to server endpoint /api/uploads/receipt if available
        try {
          const res = await fetch('/api/uploads/receipt', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              fileData: dataUrl
            })
          });
          if (res.ok) {
            const result = await res.json();
            if (result.ok && result.url) {
              setFormValues((prev) => ({
                ...prev,
                invoiceReceiptUrl: result.url,
                receiptFileName: file.name
              }));
              showToast('Receipt uploaded and verified successfully!', 'success');
              setUploadingReceipt(false);
              return;
            }
          }
        } catch (err) {
          // Fall back to storing Base64 Data URL so preview works offline or on serverless
        }

        // Fallback: use dataUrl
        setFormValues((prev) => ({
          ...prev,
          invoiceReceiptUrl: dataUrl,
          receiptFileName: file.name
        }));
        showToast('Receipt attached to record.', 'success');
      }
      setUploadingReceipt(false);
    };
    reader.onerror = () => {
      showToast('Error reading receipt file.', 'error');
      setUploadingReceipt(false);
    };
    reader.readAsDataURL(file);
  };

  // Remove attached receipt
  const handleRemoveReceipt = () => {
    setFormValues((prev) => ({
      ...prev,
      invoiceReceiptUrl: null,
      receiptFileName: ''
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit Expense Form directly to backend database
  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    const result = ExpenseFormSchema.safeParse(formValues);
    if (!result.success) {
      const errors = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0]] = err.message;
      });
      setFormErrors(errors);
      showToast('Please fix the validation errors in the form.', 'error');
      return;
    }

    setIsSubmitting(true);
    const parsed = result.data;
    const amountNum = roundCurrency(parsed.amount);
    const threshold = Number(currentProject.adminApprovalThreshold) || 10000;
    const exchangeRate = Number(currentProject.exchangeRate) || 15.5;
    const amountUsd = Math.round((amountNum / exchangeRate) * 100) / 100;
    const nowIso = new Date().toISOString();

    // Determine approval status
    let finalStatus = 'APPROVED';
    if (!isSuperAdmin && amountNum > threshold) {
      finalStatus = 'PENDING';
    } else if (editingExpense?.approvalStatus) {
      finalStatus = editingExpense.approvalStatus;
    } else if (isSuperAdmin) {
      finalStatus = 'APPROVED';
    }

    if (editingExpense) {
      // Edit existing expense
      const updatedExpense = {
        ...editingExpense,
        ...parsed,
        amount: amountNum,
        amountUsd,
        currency: 'GHS',
        invoiceReceiptUrl: formValues.invoiceReceiptUrl,
        receiptFileName: formValues.receiptFileName,
        approvalStatus: isSuperAdmin ? (formValues.approvalStatus || editingExpense.approvalStatus) : finalStatus,
        updatedAt: nowIso
      };

      const updatedList = expenses.map((item) =>
        item.id === editingExpense.id ? updatedExpense : item
      );

      const auditEntry = {
        id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'PROJECT_EXPENSE_UPDATED',
        category: 'record_update',
        actorId: currentUser?.id || 'manager',
        actorName: currentUser?.fullName || 'Douglas Amadie',
        actorEmail: currentUser?.email || 'douglas.amadie@precourtluxury.com',
        actorRole: currentUser?.role || 'FACILITY_MANAGER',
        targetId: updatedExpense.id,
        targetLabel: updatedExpense.title,
        details: `Updated construction expense of GH₵ ${amountNum.toLocaleString()} for ${parsed.vendorName}.`,
        timestamp: nowIso
      };

      onUpdateProjectAndExpenses([currentProject], updatedList, auditEntry);
      showToast(`Expense updated successfully (${formatGHS(amountNum)})`, 'success');
    } else {
      // Create new expense directly in real database
      let savedRecord = null;
      try {
        const payload = {
          projectId: currentProject.id || 'PRJ-PLH-PH1',
          ...parsed,
          amount: amountNum,
          currency: 'GHS',
          amountUsd,
          invoiceReceiptUrl: formValues.invoiceReceiptUrl,
          receiptFileName: formValues.receiptFileName,
          approvalStatus: finalStatus,
          expenseDate: parsed.expenseDate || nowIso.slice(0, 10)
        };
        const res = await fetch(`/api/projects/${currentProject.id || 'PRJ-PLH-PH1'}/expenses`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData?.ok && resData.expense) {
            savedRecord = resData.expense;
          }
        }
      } catch (err) {
        console.error('Failed to post expense directly to backend:', err);
      }

      const newId = savedRecord?.id || `EXP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const newExpense = savedRecord || {
        id: newId,
        projectId: currentProject.id || 'PRJ-PLH-PH1',
        ...parsed,
        amount: amountNum,
        currency: 'GHS',
        amountUsd,
        invoiceReceiptUrl: formValues.invoiceReceiptUrl,
        receiptFileName: formValues.receiptFileName,
        recordedByUserId: currentUser?.id || 'douglas.amadie',
        recordedByName: currentUser?.fullName || 'Douglas Amadie (Facility Manager)',
        approvalStatus: finalStatus,
        approvedByName: finalStatus === 'APPROVED' ? (currentUser?.fullName || 'Kwame Mensah') : null,
        approvedAt: finalStatus === 'APPROVED' ? nowIso : null,
        updatedAt: nowIso,
        createdAt: nowIso
      };

      const updatedList = [newExpense, ...expenses.filter((e) => e.id !== newExpense.id)];

      const auditEntry = {
        id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'PROJECT_EXPENSE_LOGGED',
        category: 'record_update',
        actorId: currentUser?.id || 'manager',
        actorName: currentUser?.fullName || 'Douglas Amadie',
        actorEmail: currentUser?.email || 'douglas.amadie@precourtluxury.com',
        actorRole: currentUser?.role || 'FACILITY_MANAGER',
        targetId: newExpense.id,
        targetLabel: newExpense.title,
        details: `Logged new construction expense of GH₵ ${amountNum.toLocaleString()} for ${parsed.vendorName} (Status: ${finalStatus}).`,
        timestamp: nowIso
      };

      onUpdateProjectAndExpenses([currentProject], updatedList, auditEntry);

      if (finalStatus === 'PENDING') {
        showToast(
          `Expense logged: Exceeds GH₵ 10,000 threshold and requires Super Admin approval.`,
          'info'
        );
      } else {
        showToast(`Expense of ${formatGHS(amountNum)} logged & saved to database!`, 'success');
      }
    }

    setIsSubmitting(false);
    setLogModalOpen(false);
  };

  // Approve a pending expense (Super Admin only)
  const handleApproveExpense = async (exp) => {
    if (!isSuperAdmin) {
      showToast('Super Admin authorization is required to approve expenses.', 'error');
      return;
    }

    try {
      await fetch(`/api/projects/expenses/${exp.id}/approve`, {
        method: 'PATCH',
        credentials: 'same-origin'
      });
    } catch (err) {
      console.error('Failed to approve expense on server:', err);
    }

    const nowIso = new Date().toISOString();
    const updated = {
      ...exp,
      approvalStatus: 'APPROVED',
      approvedByName: currentUser?.fullName || 'Kwame Mensah (Super Admin)',
      approvedAt: nowIso,
      updatedAt: nowIso
    };

    const updatedList = expenses.map((item) => (item.id === exp.id ? updated : item));

    const auditEntry = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: 'PROJECT_EXPENSE_APPROVED',
      category: 'record_update',
      actorId: currentUser?.id || 'super-admin',
      actorName: currentUser?.fullName || 'Kwame Mensah',
      actorEmail: currentUser?.email || 'admin@precourtluxury.com',
      actorRole: 'SUPER_ADMIN',
      targetId: exp.id,
      targetLabel: exp.title,
      details: `Approved construction expense of GH₵ ${Number(exp.amount).toLocaleString()} for ${exp.vendorName}.`,
      timestamp: nowIso
    };

    onUpdateProjectAndExpenses([currentProject], updatedList, auditEntry);
    showToast(`Expense of ${formatGHS(exp.amount)} approved by Super Admin.`, 'success');
  };

  // Mark as Paid (Super Admin)
  const handleMarkAsPaid = (exp) => {
    if (!isSuperAdmin) {
      showToast('Super Admin authorization is required to mark payments.', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    const updated = {
      ...exp,
      approvalStatus: 'PAID',
      updatedAt: nowIso
    };

    const updatedList = expenses.map((item) => (item.id === exp.id ? updated : item));

    const auditEntry = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: 'PROJECT_EXPENSE_PAID',
      category: 'record_update',
      actorId: currentUser?.id || 'super-admin',
      actorName: currentUser?.fullName || 'Kwame Mensah',
      actorEmail: currentUser?.email || 'admin@precourtluxury.com',
      actorRole: 'SUPER_ADMIN',
      targetId: exp.id,
      targetLabel: exp.title,
      details: `Marked construction expense of GH₵ ${Number(exp.amount).toLocaleString()} as PAID.`,
      timestamp: nowIso
    };

    onUpdateProjectAndExpenses([currentProject], updatedList, auditEntry);
    showToast(`Expense marked as PAID.`, 'success');
  };

  // Delete an expense directly from database
  const handleDeleteExpense = async (exp) => {
    if (!isSuperAdmin) {
      showToast('Super Admin authorization is required to delete expenses.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete "${exp.title}" (${formatGHS(exp.amount)})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/expenses/${exp.id}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        await fetch(`/api/expenses/${exp.id}`, {
          method: 'DELETE',
          credentials: 'same-origin'
        });
      }
    } catch (err) {
      console.error('Failed to send DELETE mutation to database:', err);
    }

    const updatedList = expenses.filter((item) => item.id !== exp.id);
    const nowIso = new Date().toISOString();

    const auditEntry = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: 'PROJECT_EXPENSE_DELETED',
      category: 'record_update',
      actorId: currentUser?.id || 'super-admin',
      actorName: currentUser?.fullName || 'Kwame Mensah',
      actorEmail: currentUser?.email || 'admin@precourtluxury.com',
      actorRole: 'SUPER_ADMIN',
      targetId: exp.id,
      targetLabel: exp.title,
      details: `Deleted construction expense of GH₵ ${Number(exp.amount).toLocaleString()} for ${exp.vendorName}.`,
      timestamp: nowIso
    };

    onUpdateProjectAndExpenses([currentProject], updatedList, auditEntry);
    showToast(`Expense permanently deleted from database.`, 'info');
  };

  // Save Budget Configuration (Super Admin)
  const handleSaveBudget = (e) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      showToast('Super Admin privileges required to update project budget.', 'error');
      return;
    }

    const totalBudget = Number(budgetForm.totalBudget) || 0;
    const exchangeRate = Number(budgetForm.exchangeRate) || 15.5;
    const threshold = Number(budgetForm.adminApprovalThreshold) || 10000;
    const nowIso = new Date().toISOString();

    const updatedProject = {
      ...currentProject,
      projectName: budgetForm.projectName,
      totalBudget,
      exchangeRate,
      adminApprovalThreshold: threshold,
      targetCompletionDate: budgetForm.targetCompletionDate,
      projectStatus: budgetForm.projectStatus,
      updatedAt: nowIso
    };

    const updatedProjectsList = projects.map((p) =>
      p.id === currentProject.id ? updatedProject : p
    );
    if (!projects.some((p) => p.id === currentProject.id)) {
      updatedProjectsList.push(updatedProject);
    }

    const auditEntry = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: 'PROJECT_BUDGET_CONFIGURED',
      category: 'record_update',
      actorId: currentUser?.id || 'super-admin',
      actorName: currentUser?.fullName || 'Kwame Mensah',
      actorEmail: currentUser?.email || 'admin@precourtluxury.com',
      actorRole: 'SUPER_ADMIN',
      targetId: currentProject.id,
      targetLabel: updatedProject.projectName,
      details: `Configured project budget: GH₵ ${totalBudget.toLocaleString()} (Rate: ${exchangeRate} GHS/USD, Threshold: GH₵ ${threshold.toLocaleString()}).`,
      timestamp: nowIso
    };

    onUpdateProjectAndExpenses(updatedProjectsList, expenses, auditEntry);
    showToast('Project budget & parameters updated successfully!', 'success');
    setBudgetModalOpen(false);
  };

  // Export to CSV
  const handleExportCSV = () => {
    exportExpensesToCSV(filteredExpenses, currentProject);
    showToast(`Exported ${filteredExpenses.length} construction expenses to CSV`, 'success');
  };

  // Export / Print PDF Report
  const handlePrintReport = () => {
    window.print();
  };

  // Category Map for quick lookup
  const categoryMap = useMemo(() => {
    return Object.fromEntries(CONSTRUCTION_CATEGORIES.map((c) => [c.id, c]));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. PROJECT HERO & EXECUTIVE HEADER */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-xs relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <HardHat className="w-3.5 h-3.5" />
                Capital Expenditure (CapEx) Tracker
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Status: {currentProject.projectStatus || 'ACTIVE'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {currentProject.id}
              </span>
            </div>

            <h1 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">
              {currentProject.projectName}
            </h1>

            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              {currentProject.description ||
                'Precourt construction and development cost tracking: contractor payouts, materials procurement, municipal permits, and site burn rate.'}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span className="flex items-center gap-1 font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {currentProject.location}
              </span>
              <span className="flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Target Completion: {currentProject.targetCompletionDate}
              </span>
              <span className="flex items-center gap-1 font-medium font-mono">
                Approval Threshold: {formatGHS(currentProject.adminApprovalThreshold || 10000)}
              </span>
            </div>
          </div>

          {/* Action buttons & Currency Switch */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {/* Currency Switcher */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setCurrencyMode('GHS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currencyMode === 'GHS'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                GH₵ (GHS)
              </button>
              <button
                type="button"
                onClick={() => setCurrencyMode('USD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currencyMode === 'USD'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={`Exchange rate: 1 USD = ${currentProject.exchangeRate || 15.5} GH₵`}
              >
                $ (USD)
              </button>
            </div>

            {/* Edit Budget (Super Admin only) */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setBudgetForm({
                    projectName: currentProject.projectName || '',
                    totalBudget: currentProject.totalBudget || 4500000,
                    exchangeRate: currentProject.exchangeRate || 15.5,
                    adminApprovalThreshold: currentProject.adminApprovalThreshold || 10000,
                    targetCompletionDate: currentProject.targetCompletionDate || '2026-12-20',
                    projectStatus: currentProject.projectStatus || 'ACTIVE'
                  });
                  setBudgetModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Configure Budget</span>
              </button>
            )}

            {/* Log New Expense Button */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log New Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE FINANCIAL KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budget Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Project Budget</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {currencyMode === 'GHS'
                ? formatGHS(metrics.totalBudget)
                : formatUSD(metrics.totalBudget, metrics.exchangeRate)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {currencyMode === 'GHS'
                ? formatUSD(metrics.totalBudget, metrics.exchangeRate) + ' equivalent'
                : formatGHS(metrics.totalBudget) + ' original'}
            </div>
          </div>
        </div>

        {/* Total Spent to Date Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Spent to Date</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              {currencyMode === 'GHS'
                ? formatGHS(metrics.approvedPaidTotal)
                : formatUSD(metrics.approvedPaidTotal, metrics.exchangeRate)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>{metrics.variancePercentage}% of budget allocated</span>
              {metrics.pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                  +{metrics.pendingCount} pending
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Remaining Balance Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Remaining Balance</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
              {currencyMode === 'GHS'
                ? formatGHS(metrics.remainingBalance)
                : formatUSD(metrics.remainingBalance, metrics.exchangeRate)}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  metrics.variancePercentage > 90
                    ? 'bg-rose-500'
                    : metrics.variancePercentage > 75
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, metrics.variancePercentage)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Current Month Burn Rate Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Monthly Burn Rate</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono tracking-tight">
              {currencyMode === 'GHS'
                ? formatGHS(metrics.currentMonthSpend)
                : formatUSD(metrics.currentMonthSpend, metrics.exchangeRate)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Active month outflow & artisan disbursements
            </div>
          </div>
        </div>
      </div>

      {/* 3. VISUAL ANALYTICS: SPEND BY CATEGORY & MONTHLY TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Spend by Category (Donut + Legend) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Spend Breakdown by Construction Category</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Proportion allocated to materials, labor, foundation, blockwork & permits
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {categoryBreakdown.length} active
            </span>
          </div>

          {/* SVG Donut Chart and Interactive List */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            {/* SVG Donut Chart */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="14"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  {(() => {
                    const totalSpend = metrics.totalSpent || 1;
                    let accumulatedPercent = 0;
                    return categoryBreakdown.map((cat, idx) => {
                      const percent = (cat.totalAmount / totalSpend) * 100;
                      const strokeDasharray = `${(percent * 2.387).toFixed(1)} 238.7`;
                      const strokeDashoffset = `-${(accumulatedPercent * 2.387).toFixed(1)}`;
                      accumulatedPercent += percent;
                      return (
                        <circle
                          key={cat.id || idx}
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke={cat.color || '#3B82F6'}
                          strokeWidth="14"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-300 hover:opacity-80"
                        />
                      );
                    });
                  })()}
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Outflow</span>
                  <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                    {currencyMode === 'GHS'
                      ? `GH₵ ${(metrics.totalSpent / 1000).toFixed(0)}k`
                      : `$ ${(metrics.totalSpent / (metrics.exchangeRate * 1000)).toFixed(0)}k`}
                  </span>
                </div>
              </div>
            </div>

            {/* Category Legend List */}
            <div className="sm:col-span-7 space-y-2 max-h-56 overflow-y-auto pr-1">
              {categoryBreakdown.map((cat) => {
                const totalSpend = metrics.totalSpent || 1;
                const percent = Math.round((cat.totalAmount / totalSpend) * 100);
                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {cat.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-right">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {currencyMode === 'GHS' ? formatGHS(cat.totalAmount) : formatUSD(cat.totalAmount, metrics.exchangeRate)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">({percent}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Monthly Cash Outflow Timeline (Bar Chart) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Monthly Cash Outflow Timeline</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tracking CapEx disbursements across project construction phases
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {monthlyTimeline.length} months
            </span>
          </div>

          {/* Bar Chart Visualization */}
          <div className="space-y-3 pt-2">
            {(() => {
              const maxMonth = Math.max(...monthlyTimeline.map((m) => m.total), 1);
              return monthlyTimeline.map((m) => {
                const percent = Math.min(100, Math.round((m.total / maxMonth) * 100));
                return (
                  <div key={m.monthKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {m.label} ({m.count} txns)
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {currencyMode === 'GHS'
                          ? formatGHS(m.total)
                          : formatUSD(m.total, metrics.exchangeRate)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden flex items-center p-0.5">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* 4. EXPENSE LEDGER CONTROLS (SEARCH, FILTERS & EXPORT) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses, vendors, transaction IDs..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action buttons (Export to CSV & Print Report) */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrintReport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-blue-500" />
              <span>Print Audit Report</span>
            </button>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="ALL">All Categories ({CONSTRUCTION_CATEGORIES.length})</option>
              {CONSTRUCTION_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending Approval</option>
            </select>
          </div>

          {/* Vendor Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Vendor / Supplier
            </label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="ALL">All Vendors ({uniqueVendors.length})</option>
              {uniqueVendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Date Period
            </label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="ALL">All Dates</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </div>
        </div>

        {/* Custom date range inputs if selected */}
        {selectedDateRange === 'CUSTOM' && (
          <div className="flex items-center gap-3 pt-2">
            <div>
              <label className="text-[11px] text-slate-400 block mb-0.5">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-0.5">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. INTERACTIVE EXPENSE LEDGER TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Project Expense Ledger ({filteredExpenses.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Detailed breakdown of CapEx disbursements, invoices & contractor payouts
            </p>
          </div>
          {metrics.pendingCount > 0 && (
            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              {metrics.pendingCount} expenses awaiting Super Admin approval
            </span>
          )}
        </div>

        {expenses.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
              <HardHat className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                No expenses recorded yet. Click 'Log New Expense' to get started
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Record construction materials, foundation earthworks, artisan payouts, and statutory municipal fees.
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Log New Expense
            </button>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <HardHat className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No construction expenses match your filters
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search query, category selection, or date range, or click "Log New Expense" to create a new entry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Item & Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Vendor / Supplier</th>
                  <th className="py-3 px-4">Method & Ref</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredExpenses.map((exp) => {
                  const cat = categoryMap[exp.categoryId] || {
                    name: exp.categoryId,
                    color: '#64748B',
                    bgColor: 'bg-slate-500/10 text-slate-700'
                  };

                  const isPending = exp.approvalStatus === 'PENDING';
                  const isApproved = exp.approvalStatus === 'APPROVED';
                  const isPaid = exp.approvalStatus === 'PAID';

                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {exp.expenseDate}
                      </td>

                      {/* Item Title & Milestone Notes */}
                      <td className="py-3.5 px-4 min-w-[240px]">
                        <div className="font-bold text-slate-900 dark:text-white">{exp.title}</div>
                        {exp.notes && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {exp.notes}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Logged by: {exp.recordedByName || 'Douglas Amadie'}
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cat.bgColor || 'bg-slate-100 text-slate-700'}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </span>
                      </td>

                      {/* Vendor */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {exp.vendorName}
                        </div>
                        {exp.vendorPhone && (
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {exp.vendorPhone}
                          </div>
                        )}
                      </td>

                      {/* Payment Method & Reference */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {exp.paymentMethod.replace('_', ' ')}
                        </span>
                        {exp.transactionReference && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {exp.transactionReference}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                        <div className="font-black text-slate-900 dark:text-white">
                          {currencyMode === 'GHS'
                            ? formatGHS(exp.amount)
                            : formatUSD(exp.amount, metrics.exchangeRate)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {currencyMode === 'GHS'
                            ? formatUSD(exp.amount, metrics.exchangeRate)
                            : formatGHS(exp.amount)}
                        </div>
                      </td>

                      {/* Receipt preview link */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {exp.invoiceReceiptUrl ? (
                          <button
                            type="button"
                            onClick={() => setReceiptPreviewExpense(exp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                            title="Preview attached receipt / waybill"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-500" />
                            <span>View</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Paid
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                            <Check className="w-3 h-3" /> Approved
                          </span>
                        )}
                        {isPending && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 animate-pulse"
                            title="Requires Super Admin approval (> GH₵ 10,000 threshold)"
                          >
                            <AlertTriangle className="w-3 h-3" /> Pending Admin
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Super Admin Approve Action */}
                          {isSuperAdmin && isPending && (
                            <button
                              type="button"
                              onClick={() => handleApproveExpense(exp)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shadow-xs"
                              title="Approve this expense"
                            >
                              Approve
                            </button>
                          )}

                          {/* Super Admin Mark as Paid */}
                          {isSuperAdmin && isApproved && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsPaid(exp)}
                              className="px-2 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer"
                              title="Mark as Paid"
                            >
                              Mark Paid
                            </button>
                          )}

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(exp)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Edit expense entry"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button (Super Admin only) */}
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp)}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Delete entry (Super Admin)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. MODAL: LOG / EDIT EXPENSE */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                    {editingExpense ? 'Edit Construction Expense' : 'Log New Construction Expense'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Precourt Luxury Apartments - Phase 1 CapEx Ledger
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs">
              {/* Category Dropdown */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Construction Category *
                </label>
                <select
                  value={formValues.categoryId}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, categoryId: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/40"
                >
                  {CONSTRUCTION_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.description}
                    </option>
                  ))}
                </select>
                {formErrors.categoryId && (
                  <p className="text-rose-500 text-[11px] mt-1">{formErrors.categoryId}</p>
                )}
              </div>

              {/* Title / Description */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Item Description * (e.g. 500 Bags of 42.5R Cement - Batch 3)
                </label>
                <input
                  type="text"
                  value={formValues.title}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="e.g. High-Tensile 16mm Rebar Rods - 15 Tons"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40"
                />
                {formErrors.title && (
                  <p className="text-rose-500 text-[11px] mt-1">{formErrors.title}</p>
                )}
              </div>

              {/* Amount (GH₵) & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (GH₵) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 font-mono">
                      GH₵
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formValues.amount}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, amount: e.target.value }))
                      }
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-amber-500/40"
                    />
                  </div>
                  {formValues.amount && !isNaN(Number(formValues.amount)) && (
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">
                      ≈{' '}
                      {formatUSD(
                        Number(formValues.amount),
                        currentProject.exchangeRate || 15.5
                      )}{' '}
                      USD (Rate: 1 USD = {currentProject.exchangeRate || 15.5} GH₵)
                    </p>
                  )}
                  {formErrors.amount && (
                    <p className="text-rose-500 text-[11px] mt-1">{formErrors.amount}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    value={formValues.expenseDate}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, expenseDate: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40"
                  />
                  {formErrors.expenseDate && (
                    <p className="text-rose-500 text-[11px] mt-1">{formErrors.expenseDate}</p>
                  )}
                </div>
              </div>

              {/* Vendor & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vendor / Artisan / Supplier *
                  </label>
                  <input
                    type="text"
                    value={formValues.vendorName}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, vendorName: e.target.value }))
                    }
                    placeholder="e.g. Ghacem Cement Distributors"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40"
                  />
                  {formErrors.vendorName && (
                    <p className="text-rose-500 text-[11px] mt-1">{formErrors.vendorName}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vendor Phone / Contact
                  </label>
                  <input
                    type="text"
                    value={formValues.vendorPhone}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, vendorPhone: e.target.value }))
                    }
                    placeholder="e.g. +233 24 000 0000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40 font-mono"
                  />
                </div>
              </div>

              {/* Payment Method & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formValues.paymentMethod}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, paymentMethod: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/40"
                  >
                    <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                    <option value="MOBILE_MONEY">Mobile Money (MTN / Telecel)</option>
                    <option value="CHEQUE">Company Cheque</option>
                    <option value="CASH">Cash (Petty Cash Voucher)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Reference Code / Cheque No / MoMo ID
                  </label>
                  <input
                    type="text"
                    value={formValues.transactionReference}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        transactionReference: e.target.value
                      }))
                    }
                    placeholder="e.g. CHQ-880192 or MTN-MM-0192"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>

              {/* Receipt File Upload (PNG, JPG, PDF up to 10MB) */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Receipt / Invoice / Waybill File (PNG, JPEG, PDF - max 10MB)
                </label>
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-center space-y-2">
                  {formValues.invoiceReceiptUrl ? (
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {formValues.receiptFileName || 'Attached Receipt File'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveReceipt}
                        className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1 rounded-lg hover:bg-rose-500/10 transition"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                        onChange={handleReceiptFileChange}
                        className="hidden"
                        id="receipt-file-input"
                      />
                      <label
                        htmlFor="receipt-file-input"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>
                          {uploadingReceipt ? 'Processing Receipt...' : 'Upload Receipt or Invoice'}
                        </span>
                      </label>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Files are verified and linked to the expense for auditing.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Notes / Milestone */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Notes / Milestone References
                </label>
                <textarea
                  rows={2}
                  value={formValues.notes}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="e.g. Stored in ground floor warehouse depot. Slump test certificate attached."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              {/* Approval Notice for Facility Manager */}
              {!isSuperAdmin && Number(formValues.amount) > (currentProject.adminApprovalThreshold || 10000) && (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-bold">Super Admin Approval Notice:</span> This expense
                    exceeds the GH₵ {(currentProject.adminApprovalThreshold || 10000).toLocaleString()}{' '}
                    threshold. It will be recorded as <span className="font-extrabold underline">PENDING</span> until Kwame Mensah reviews and approves it.
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setLogModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || uploadingReceipt}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingExpense
                      ? 'Save Changes'
                      : 'Record Construction Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: RECEIPT PREVIEW */}
      {receiptPreviewExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                  Attached Receipt / Waybill Preview
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {receiptPreviewExpense.title} — {formatGHS(receiptPreviewExpense.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptPreviewExpense(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Display */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950/5 dark:bg-slate-950/40 p-4 flex flex-col items-center justify-center min-h-[300px]">
              {receiptPreviewExpense.invoiceReceiptUrl?.startsWith('data:application/pdf') ||
              receiptPreviewExpense.receiptFileName?.toLowerCase().endsWith('.pdf') ? (
                <div className="text-center space-y-3 p-6">
                  <FileText className="w-16 h-16 text-amber-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    PDF Invoice Document Attached
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {receiptPreviewExpense.receiptFileName || 'invoice.pdf'}
                  </p>
                  <a
                    href={receiptPreviewExpense.invoiceReceiptUrl}
                    download={receiptPreviewExpense.receiptFileName || 'receipt.pdf'}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF Document
                  </a>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <img
                    src={receiptPreviewExpense.invoiceReceiptUrl}
                    alt={receiptPreviewExpense.title}
                    className="max-h-[480px] w-auto object-contain rounded-xl shadow-md border border-slate-200 dark:border-slate-800 mx-auto"
                  />
                  <div className="pt-2">
                    <a
                      href={receiptPreviewExpense.invoiceReceiptUrl}
                      download={receiptPreviewExpense.receiptFileName || 'receipt.jpg'}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Original High-Res Receipt
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Vendor: {receiptPreviewExpense.vendorName}</span>
              <span>Date: {receiptPreviewExpense.expenseDate}</span>
              <span>Status: {receiptPreviewExpense.approvalStatus}</span>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: EDIT BUDGET & PROJECT CONFIGURATION (SUPER ADMIN ONLY) */}
      {budgetModalOpen && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                  Configure Construction Project Budget
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBudgetModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={budgetForm.projectName}
                  onChange={(e) =>
                    setBudgetForm((prev) => ({ ...prev, projectName: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Total Project Budget (GH₵)
                </label>
                <input
                  type="number"
                  step="1000"
                  value={budgetForm.totalBudget}
                  onChange={(e) =>
                    setBudgetForm((prev) => ({ ...prev, totalBudget: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    USD Exchange Rate (GHS / USD)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={budgetForm.exchangeRate}
                    onChange={(e) =>
                      setBudgetForm((prev) => ({ ...prev, exchangeRate: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Admin Approval Threshold (GH₵)
                  </label>
                  <input
                    type="number"
                    step="500"
                    value={budgetForm.adminApprovalThreshold}
                    onChange={(e) =>
                      setBudgetForm((prev) => ({
                        ...prev,
                        adminApprovalThreshold: e.target.value
                      }))
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={budgetForm.targetCompletionDate}
                    onChange={(e) =>
                      setBudgetForm((prev) => ({
                        ...prev,
                        targetCompletionDate: e.target.value
                      }))
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Project Status
                  </label>
                  <select
                    value={budgetForm.projectStatus}
                    onChange={(e) =>
                      setBudgetForm((prev) => ({ ...prev, projectStatus: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active Construction</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setBudgetModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                >
                  Save Budget Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
