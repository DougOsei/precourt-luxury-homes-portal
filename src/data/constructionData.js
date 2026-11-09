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

export const DEFAULT_PROJECT_EXPENSES = [
  {
    id: 'EXP-2026-001',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'PERMITS_LEGAL',
    title: 'Accra Metropolitan Assembly (AMA) Building Permit & Planning Approval',
    amount: 38500.0,
    currency: 'GHS',
    amountUsd: 2483.87,
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'AMA-BLD-2026-904',
    vendorName: 'Accra Metropolitan Assembly (Town Planning Dept)',
    vendorPhone: '+233 30 266 5471',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'AMA_Building_Permit_Receipt.pdf',
    expenseDate: '2026-01-22',
    recordedByUserId: 'admin-kwame',
    recordedByName: 'Kwame Mensah (Super Admin)',
    approvalStatus: 'PAID',
    approvedByName: 'Kwame Mensah',
    approvedAt: '2026-01-22T10:00:00Z',
    notes: 'Official municipal permit receipt covering architectural, structural & fire compliance.'
  },
  {
    id: 'EXP-2026-002',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'ARCHITECTURAL_ENGINEERING',
    title: 'Geotechnical Soil Investigation & Core Boring Test (4 Boreholes)',
    amount: 18000.0,
    currency: 'GHS',
    amountUsd: 1161.29,
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'GTC-INV-8821',
    vendorName: 'GeoTech Consult Ghana Ltd',
    vendorPhone: '+233 24 331 9081',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'GeoTech_Soil_Test_Report.pdf',
    expenseDate: '2026-01-28',
    recordedByUserId: 'douglas.amadie',
    recordedByName: 'Douglas Amadie (Facility Manager)',
    approvalStatus: 'APPROVED',
    approvedByName: 'Kwame Mensah',
    approvedAt: '2026-01-29T14:15:00Z',
    notes: 'Bearing capacity verified at 220 kPa for foundation pad design.'
  },
  {
    id: 'EXP-2026-003',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'EQUIPMENT_HAULAGE',
    title: 'Site Excavation & Earth Removal (CAT 320D Excavator - 5 Days)',
    amount: 27500.0,
    currency: 'GHS',
    amountUsd: 1774.19,
    paymentMethod: 'CHEQUE',
    transactionReference: 'CHQ-880192',
    vendorName: 'Nana Kofi Heavy Equipment & Haulage Ltd',
    vendorPhone: '+233 50 442 8810',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'Excavator_Rental_Waybill_01.pdf',
    expenseDate: '2026-02-05',
    recordedByUserId: 'douglas.amadie',
    recordedByName: 'Douglas Amadie (Facility Manager)',
    approvalStatus: 'PAID',
    approvedByName: 'Kwame Mensah',
    approvedAt: '2026-02-06T09:30:00Z',
    notes: 'Basement and pad foundation trench excavation including 14 tipper truck trips to landfill.'
  },
  {
    id: 'EXP-2026-004',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'SUBSTRUCTURE_FOUNDATION',
    title: 'High-Tensile Steel Rebars (16mm, 12mm & 10mm High-Yield Rods - 15 Tons)',
    amount: 142500.0,
    currency: 'GHS',
    amountUsd: 9193.55,
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'B5-WT-99320',
    vendorName: 'B5 Plus Steel Industries Ltd',
    vendorPhone: '+233 30 330 2001',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'B5_Plus_Rebar_Invoice_15T.pdf',
    expenseDate: '2026-02-14',
    recordedByUserId: 'admin-kwame',
    recordedByName: 'Kwame Mensah (Super Admin)',
    approvalStatus: 'PAID',
    approvedByName: 'Kwame Mensah',
    approvedAt: '2026-02-14T11:00:00Z',
    notes: 'Grade 500B high-yield rebars certified for raft foundation and column starter bars.'
  },
  {
    id: 'EXP-2026-005',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'SUBSTRUCTURE_FOUNDATION',
    title: 'Bulk Portland Cement (600 Bags of Ghacem 42.5R Super Rapid Hardening)',
    amount: 67200.0,
    currency: 'GHS',
    amountUsd: 4335.48,
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'GHACEM-DISP-4402',
    vendorName: 'Ghacem Ghana Cement Distributors',
    vendorPhone: '+233 24 559 1100',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'Ghacem_Cement_Delivery_Waybill.pdf',
    expenseDate: '2026-02-20',
    recordedByUserId: 'douglas.amadie',
    recordedByName: 'Douglas Amadie (Facility Manager)',
    approvalStatus: 'PAID',
    approvedByName: 'Kwame Mensah',
    approvedAt: '2026-02-21T08:45:00Z',
    notes: 'GH₵ 112 per bag including delivery to site offloading zone.'
  },
  {
    id: 'EXP-2026-006',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'LABOR_CONTRACTORS',
    title: 'Foundation Steel Bending & Formwork Carpentry Gang Labor Payout (Stage 1)',
    amount: 22000.0,
    currency: 'GHS',
    amountUsd: 1419.35,
    paymentMethod: 'MOBILE_MONEY',
    transactionReference: 'MTN-MM-20260228-40192',
    vendorName: 'Kofi Mensah Artisan Steel Benders Gang',
    vendorPhone: '+233 24 991 3302',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'Steel_Benders_Labor_Disbursement_Sheet.pdf',
    expenseDate: '2026-02-28',
    recordedByUserId: 'douglas.amadie',
    recordedByName: 'Douglas Amadie (Facility Manager)',
    approvalStatus: 'PAID',
    approvedByName: 'Kwame Mensah',
    approvedAt: '2026-02-28T16:00:00Z',
    notes: 'Signed wage sheet for 14 artisans for raft rebars and stub columns fabrication.'
  },
  {
    id: 'EXP-2026-007',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'SUBSTRUCTURE_FOUNDATION',
    title: 'Ready-Mix Concrete Pouring (Grade C30/37 - 85 Cubic Meters via Boom Pump)',
    amount: 114750.0,
    currency: 'GHS',
    amountUsd: 7403.23,
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'ATL-CONC-88120',
    vendorName: 'Atlantic Ready-Mix Concrete Ltd',
    vendorPhone: '+233 30 221 4400',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'Atlantic_ReadyMix_Concrete_BatchTicket.pdf',
    expenseDate: '2026-03-08',
    recordedByUserId: 'admin-kwame',
    recordedByName: 'Kwame Mensah (Super Admin)',
    approvalStatus: 'PAID',
    approvedByName: 'Kwame Mensah',
    approvedAt: '2026-03-08T18:00:00Z',
    notes: 'Continuous raft foundation slab pour with slump test verification (120mm).'
  },
  {
    id: 'EXP-2026-008',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'SUPERSTRUCTURE_BLOCKWORK',
    title: '6-inch Solid Vibrated Concrete Blocks (4,500 Units - First Batch)',
    amount: 40500.0,
    currency: 'GHS',
    amountUsd: 2612.90,
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'QBK-INV-1092',
    vendorName: 'Quality Block Factory & Precast Ltd',
    vendorPhone: '+233 20 812 7701',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'Block_Delivery_Waybill_Batch1.pdf',
    expenseDate: '2026-03-18',
    recordedByUserId: 'douglas.amadie',
    recordedByName: 'Douglas Amadie (Facility Manager)',
    approvalStatus: 'APPROVED',
    approvedByName: 'Kwame Mensah',
    approvedAt: '2026-03-19T10:10:00Z',
    notes: 'GH₵ 9.00 per unit including stacking on ground floor slab.'
  },
  {
    id: 'EXP-2026-009',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'MEP_SERVICES',
    title: 'Ground Plumbing Sub-drainage & HDPE Sewage Pipe Line (Schedule 40 & Fittings)',
    amount: 19800.0,
    currency: 'GHS',
    amountUsd: 1277.42,
    paymentMethod: 'MOBILE_MONEY',
    transactionReference: 'MTN-MM-20260325-11029',
    vendorName: 'AquaFlow Plumbing Supplies Ltd',
    vendorPhone: '+233 24 661 8021',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'AquaFlow_HDPE_Plumbing_Receipt.pdf',
    expenseDate: '2026-03-25',
    recordedByUserId: 'douglas.amadie',
    recordedByName: 'Douglas Amadie (Facility Manager)',
    approvalStatus: 'APPROVED',
    approvedByName: 'Kwame Mensah',
    approvedAt: '2026-03-26T12:00:00Z',
    notes: '110mm and 160mm sewer pipes embedded before ground slab casting.'
  },
  {
    id: 'EXP-2026-010',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'CONTINGENCY_SITE_OVERHEAD',
    title: 'Site Security Guards 24/7 Patrol Allowance (Feb - Mar 2026)',
    amount: 6400.0,
    currency: 'GHS',
    amountUsd: 412.90,
    paymentMethod: 'CASH',
    transactionReference: 'SEC-CSH-2026-03',
    vendorName: 'Apex Shield Guard Services',
    vendorPhone: '+233 50 119 2200',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'Apex_Security_Monthly_Invoice.pdf',
    expenseDate: '2026-03-31',
    recordedByUserId: 'douglas.amadie',
    recordedByName: 'Douglas Amadie (Facility Manager)',
    approvalStatus: 'PAID',
    approvedByName: 'Kwame Mensah',
    approvedAt: '2026-03-31T17:00:00Z',
    notes: 'Two 12-hour shifts daily protecting cement depot and rebars.'
  },
  {
    id: 'EXP-2026-011',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'LABOR_CONTRACTORS',
    title: 'Masons Gang Masonry Wall Construction Payout (Ground to First Floor)',
    amount: 16500.0,
    currency: 'GHS',
    amountUsd: 1064.52,
    paymentMethod: 'MOBILE_MONEY',
    transactionReference: 'MTN-MM-20260408-55102',
    vendorName: 'Master Yaw Boakye Masons Guild',
    vendorPhone: '+233 24 772 1092',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'Masons_Guild_Wage_Invoice.pdf',
    expenseDate: '2026-04-08',
    recordedByUserId: 'douglas.amadie',
    recordedByName: 'Douglas Amadie (Facility Manager)',
    approvalStatus: 'PENDING',
    approvedByName: null,
    approvedAt: null,
    notes: 'Requires Super Admin approval (> GH₵ 10,000 threshold). 10 masons and 12 laborers.'
  },
  {
    id: 'EXP-2026-012',
    projectId: 'PRJ-PLH-PH1',
    categoryId: 'SUBSTRUCTURE_FOUNDATION',
    title: 'Marine Plywood & Scaffolding Boards for First Floor Suspended Slab Formwork',
    amount: 28500.0,
    currency: 'GHS',
    amountUsd: 1838.71,
    paymentMethod: 'CHEQUE',
    transactionReference: 'CHQ-880211',
    vendorName: 'Woodland Timber & Plywood Depot Ltd',
    vendorPhone: '+233 20 551 8890',
    invoiceReceiptUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    receiptFileName: 'Woodland_Formwork_Plywood_Waybill.pdf',
    expenseDate: '2026-04-12',
    recordedByUserId: 'douglas.amadie',
    recordedByName: 'Douglas Amadie (Facility Manager)',
    approvalStatus: 'PENDING',
    approvedByName: null,
    approvedAt: null,
    notes: 'Requires Super Admin approval (> GH₵ 10,000 threshold). 18mm film-faced marine boards.'
  }
];

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
