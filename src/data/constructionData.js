// Precourt Luxury Homes — Construction Project Cost & Expense Tracking Data Module
// Dedicated CapEx, contractor payouts, material procurement, and milestone tracking

export const CONSTRUCTION_CATEGORIES = [
  {
    id: 'PERMITS_LEGAL',
    name: 'Permits & Legal',
    code: 'PERMITS_LEGAL',
    color: '#3B82F6', // Blue
    bgColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    description: 'Town planning, building permits, EPA, land registration & statutory approvals',
    iconName: 'FileCheck'
  },
  {
    id: 'ARCHITECTURAL_ENGINEERING',
    name: 'Architectural & Engineering',
    code: 'ARCHITECTURAL_ENGINEERING',
    color: '#8B5CF6', // Purple
    bgColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
    description: 'Structural drawings, MEP designs, soil testing & geotechnical reports',
    iconName: 'Compass'
  },
  {
    id: 'SUBSTRUCTURE_FOUNDATION',
    name: 'Substructure & Foundation',
    code: 'SUBSTRUCTURE_FOUNDATION',
    color: '#D97706', // Amber
    bgColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    description: 'Excavation, sand, stones, cement, iron rods, concrete & earthworks',
    iconName: 'Layers'
  },
  {
    id: 'SUPERSTRUCTURE_BLOCKWORK',
    name: 'Superstructure & Blockwork',
    code: 'SUPERSTRUCTURE_BLOCKWORK',
    color: '#10B981', // Emerald
    bgColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    description: 'Solid blocks, lintels, columns, formwork, scaffolding & suspended slab works',
    iconName: 'Building2'
  },
  {
    id: 'ROOFING_WATERPROOFING',
    name: 'Roofing & Waterproofing',
    code: 'ROOFING_WATERPROOFING',
    color: '#06B6D4', // Cyan
    bgColor: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    description: 'Steel trusses, roofing sheets, insulation & polymer membrane waterproofing',
    iconName: 'Umbrella'
  },
  {
    id: 'MEP_SERVICES',
    name: 'MEP Services',
    code: 'MEP_SERVICES',
    color: '#F59E0B', // Yellow-Amber
    bgColor: 'bg-yellow-500/10 text-yellow-800 dark:text-yellow-300 border-yellow-500/30',
    description: 'Electrical conduits/cables, plumbing pipes, septic tanks & water storage',
    iconName: 'Zap'
  },
  {
    id: 'FINISHING',
    name: 'Finishing & Fixtures',
    code: 'FINISHING',
    color: '#EC4899', // Pink
    bgColor: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30',
    description: 'Tiling, plastering, painting, P.O.P ceiling, doors & aluminum/glass glazing',
    iconName: 'Palette'
  },
  {
    id: 'LABOR_CONTRACTORS',
    name: 'Labor & Contractors',
    code: 'LABOR_CONTRACTORS',
    color: '#F97316', // Orange
    bgColor: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
    description: 'Masons, steel benders, carpenters, electricians, plumbers & daily artisan wages',
    iconName: 'HardHat'
  },
  {
    id: 'EQUIPMENT_HAULAGE',
    name: 'Equipment & Haulage',
    code: 'EQUIPMENT_HAULAGE',
    color: '#6366F1', // Indigo
    bgColor: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    description: 'Concrete mixer hire, excavator rental, tipper truck haulage & fuel delivery',
    iconName: 'Truck'
  },
  {
    id: 'CONTINGENCY_SITE_OVERHEAD',
    name: 'Site Overhead & Contingency',
    code: 'CONTINGENCY_SITE_OVERHEAD',
    color: '#64748B', // Slate
    bgColor: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
    description: 'Site security guards, site water/gen fuel, temporary store & miscellaneous',
    iconName: 'ShieldAlert'
  }
];

export const DEFAULT_CONSTRUCTION_PROJECTS = [
  {
    id: 'PRJ-PLH-PH1',
    projectName: 'Precourt Luxury Apartments - Phase 1',
    totalBudget: 4500000.0, // GH₵ 4,500,000.00
    currency: 'GHS',
    secondaryCurrency: 'USD',
    exchangeRate: 15.5, // 1 USD = 15.50 GH₵
    startDate: '2026-01-15',
    targetCompletionDate: '2026-12-20',
    projectStatus: 'ACTIVE', // PLANNING, ACTIVE, ON_HOLD, COMPLETED
    location: 'Airport Residential Area, Accra',
    description:
      'Ultra-luxury 12-unit residential apartment development featuring private balconies, rooftop infinity pool, smart home automation, and underground parking.',
    adminApprovalThreshold: 10000.0, // Expenses > GH₵ 10,000 require Super Admin signoff
    updatedAt: new Date().toISOString()
  }
];

export const DEFAULT_PROJECT_EXPENSES = [];

// Helper calculations with integer cents precision
export function roundCurrency(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export function formatGHS(amount) {
  const rounded = roundCurrency(amount);
  return (
    'GH₵ ' +
    rounded.toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
}

export function formatUSD(amountInGhs, exchangeRate = 15.5) {
  const ghs = Number(amountInGhs) || 0;
  const rate = Number(exchangeRate) || 15.5;
  const usd = rate > 0 ? ghs / rate : 0;
  const rounded = Math.round(usd * 100) / 100;
  return (
    '$ ' +
    rounded.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
}

export function calculateProjectMetrics(project, expenses = []) {
  const totalBudget = Number(project?.totalBudget) || 0;
  const exchangeRate = Number(project?.exchangeRate) || 15.5;

  let totalSpent = 0;
  let approvedPaidTotal = 0;
  let pendingApprovalTotal = 0;
  let currentMonthSpend = 0;

  const currentYearMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-04" or current

  expenses.forEach((exp) => {
    const amt = Number(exp.amount) || 0;
    const isApprovedOrPaid = exp.approvalStatus === 'APPROVED' || exp.approvalStatus === 'PAID';

    if (isApprovedOrPaid) {
      approvedPaidTotal += amt;
    } else if (exp.approvalStatus === 'PENDING') {
      pendingApprovalTotal += amt;
    }

    // Cumulative sum
    totalSpent += amt;

    // Check if in current month
    if (exp.expenseDate && exp.expenseDate.startsWith(currentYearMonth) && isApprovedOrPaid) {
      currentMonthSpend += amt;
    }
  });

  const remainingBalance = Math.max(0, totalBudget - approvedPaidTotal);
  const variancePercentage = totalBudget > 0 ? (approvedPaidTotal / totalBudget) * 100 : 0;

  return {
    totalBudget: roundCurrency(totalBudget),
    totalSpent: roundCurrency(totalSpent),
    approvedPaidTotal: roundCurrency(approvedPaidTotal),
    pendingApprovalTotal: roundCurrency(pendingApprovalTotal),
    remainingBalance: roundCurrency(remainingBalance),
    variancePercentage: Math.round(variancePercentage * 10) / 10,
    currentMonthSpend: roundCurrency(currentMonthSpend),
    exchangeRate,
    totalExpensesCount: expenses.length,
    pendingCount: expenses.filter((e) => e.approvalStatus === 'PENDING').length
  };
}

export function groupExpensesByCategory(expenses = []) {
  const map = {};
  CONSTRUCTION_CATEGORIES.forEach((cat) => {
    map[cat.id] = {
      ...cat,
      totalAmount: 0,
      count: 0,
      approvedPaidAmount: 0
    };
  });

  expenses.forEach((exp) => {
    const catId = exp.categoryId || 'CONTINGENCY_SITE_OVERHEAD';
    if (!map[catId]) {
      map[catId] = {
        id: catId,
        name: catId,
        color: '#94A3B8',
        bgColor: 'bg-slate-100 text-slate-700',
        totalAmount: 0,
        count: 0,
        approvedPaidAmount: 0
      };
    }
    const amt = Number(exp.amount) || 0;
    map[catId].totalAmount += amt;
    map[catId].count += 1;
    if (exp.approvalStatus === 'APPROVED' || exp.approvalStatus === 'PAID') {
      map[catId].approvedPaidAmount += amt;
    }
  });

  return Object.values(map)
    .filter((c) => c.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function groupExpensesByMonth(expenses = []) {
  const monthly = {};

  expenses.forEach((exp) => {
    if (!exp.expenseDate) return;
    const key = exp.expenseDate.slice(0, 7); // "YYYY-MM"
    if (!monthly[key]) {
      monthly[key] = {
        monthKey: key,
        total: 0,
        count: 0
      };
    }
    monthly[key].total += Number(exp.amount) || 0;
    monthly[key].count += 1;
  });

  const sortedKeys = Object.keys(monthly).sort();
  return sortedKeys.map((k) => ({
    ...monthly[k],
    total: roundCurrency(monthly[k].total),
    label: formatMonthLabel(k)
  }));
}

function formatMonthLabel(yyyyMm) {
  try {
    const [year, month] = yyyyMm.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch (e) {
    return yyyyMm;
  }
}

export function exportExpensesToCSV(expenses = [], project = null) {
  const headers = [
    'Expense ID',
    'Project ID',
    'Project Name',
    'Date',
    'Category',
    'Item Description',
    'Amount (GHS)',
    'Amount (USD)',
    'Payment Method',
    'Transaction Reference',
    'Vendor / Supplier',
    'Vendor Phone',
    'Approval Status',
    'Recorded By',
    'Approved By',
    'Receipt Attachment File',
    'Notes'
  ];

  const categoryNameMap = Object.fromEntries(
    CONSTRUCTION_CATEGORIES.map((c) => [c.id, c.name])
  );

  const rows = expenses.map((exp) => [
    `"${exp.id || ''}"`,
    `"${project?.id || exp.projectId || 'PRJ-PLH-PH1'}"`,
    `"${(project?.projectName || 'Precourt Luxury Apartments - Phase 1').replace(/"/g, '""')}"`,
    `"${exp.expenseDate || ''}"`,
    `"${categoryNameMap[exp.categoryId] || exp.categoryId || ''}"`,
    `"${(exp.title || '').replace(/"/g, '""')}"`,
    (Number(exp.amount) || 0).toFixed(2),
    (Number(exp.amountUsd) || 0).toFixed(2),
    `"${exp.paymentMethod || 'BANK_TRANSFER'}"`,
    `"${exp.transactionReference || ''}"`,
    `"${(exp.vendorName || '').replace(/"/g, '""')}"`,
    `"${exp.vendorPhone || ''}"`,
    `"${exp.approvalStatus || 'PENDING'}"`,
    `"${(exp.recordedByName || exp.recordedByUserId || '').replace(/"/g, '""')}"`,
    `"${(exp.approvedByName || '').replace(/"/g, '""')}"`,
    `"${(exp.receiptFileName || exp.invoiceReceiptUrl ? 'Yes' : 'No')}"`,
    `"${(exp.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Precourt_Construction_Expenses_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
