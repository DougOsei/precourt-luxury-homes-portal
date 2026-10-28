// Annual Maintenance Fee and Facility Operations tracking module constants and seed data
// Precourt Luxury Homes — Property & Tenant Portal

export const ANNUAL_MAINTENANCE_FEE_AMOUNT = 3000.0; // GH₵ 3,000 per tenant/unit per billing year
export const CURRENT_BILLING_YEAR = 2026;

export const COVERED_FACILITY_SERVICES = [
  {
    id: 'AC_SERVICING',
    title: 'Quarterly AC Servicing',
    description: 'Thorough coil cleaning, refrigerant gas pressure top-up, electrical checks, filter replacement, and drain flush.',
    frequency: 'QUARTERLY',
    cycle: 'Every 3 Months (Q1, Q2, Q3, Q4)',
    vendor: 'CoolBreeze Air Systems Ltd',
    technician: 'Ing. Kwesi Boateng',
    contact: '+233 24 819 4022',
    icon: 'Wind',
    checklistItems: [
      'Filter washing & antibacterial sanitize',
      'Evaporator and condenser coils degreasing',
      'R410A / R32 refrigerant pressure inspection',
      'Drainage pipe clearing and leak prevention test',
      'Compressor amperage & electrical contact check'
    ]
  },
  {
    id: 'TRASH_DISPOSAL',
    title: 'Routine Trash Disposal',
    description: 'Scheduled multi-bin solid waste collection, wheelie bin sanitization, and sorting for environmental compliance.',
    frequency: 'WEEKLY',
    cycle: 'Twice Weekly (Mondays & Thursdays)',
    vendor: 'CleanCity Waste Solutions Ltd',
    technician: 'Supervisor Emmanuel Mensah',
    contact: '+233 50 123 9876',
    icon: 'Trash2',
    checklistItems: [
      'Collection of all compound resident waste receptacles',
      'Perimeter waste bin pressure wash & deodorizing',
      'Recycling separation (plastics, cartons, organics)',
      'Dumpster enclosure clearance & sweeping'
    ]
  },
  {
    id: 'WATER_PUMP',
    title: 'Water Pump Servicing & Maintenance',
    description: 'Borehole extraction pump servicing, pressure vessel calibration, sediment filter flush, and float switch tests.',
    frequency: 'MONTHLY',
    cycle: 'Monthly Preventive Check (1st Week)',
    vendor: 'AquaTech Pumping Solutions',
    technician: 'Frank Osei-Tutu',
    contact: '+233 20 449 1102',
    icon: 'Droplets',
    checklistItems: [
      'Pumping pressure verification (nominal 4.0 - 4.5 Bar)',
      'Submersible borehole pump electrical load & insulation test',
      'Multi-stage sediment filter backwash & replacement',
      'Automatic pressure tank bladder integrity inspection',
      'Overhead polytank automated float switch calibration'
    ]
  },
  {
    id: 'COMPOUND_CLEANING',
    title: 'Compound Sweeping & Common Area Cleaning',
    description: 'Daily sweeping of interlocked paving, manicured landscape gardening, perimeter gutter drainage desilting, and staircase sanitization.',
    frequency: 'DAILY',
    cycle: 'Daily Compound Sweep + Weekly Deep Clean',
    vendor: 'Precourt Facilities Internal Staff',
    technician: 'Supervisor Douglas Amadie',
    contact: '+233 24 555 0192',
    icon: 'Sparkles',
    checklistItems: [
      'Paved driveway and parking lot mechanical broom sweeping',
      'Perimeter drainage trench clearing and desilting',
      'Lawn grooming, ornamental shrub trimming & weed control',
      'Common stairwells, banisters & security post sanitization',
      'Solar outdoor illumination lamps dusting'
    ]
  }
];

// Initial maintenance fee ledger starts empty, allowing Facility Manager and Super Admin to enter payments manually
export const DEFAULT_MAINTENANCE_FEES = [];

export function buildInitialUnitFeeRoster(tenants = []) {
  const activeTenants = tenants.filter((t) => !t.isVacantSlot && !String(t.id || '').startsWith('VAC-'));
  return activeTenants.map((t) => ({
    id: 'FEE-2026-' + String(t.unit || '').replace(/[^a-zA-Z0-9]/g, ''),
    tenantId: t.id,
    tenantName: t.name,
    phone: t.phone,
    unitId: t.unit,
    propertyId: t.property,
    billingYear: 2026,
    totalAmountDue: ANNUAL_MAINTENANCE_FEE_AMOUNT,
    amountPaid: 0.0,
    paymentStatus: 'PENDING',
    dueDate: '2026-03-31',
    paymentDate: null,
    paymentMethod: null,
    receiptNumber: null,
    installments: [],
    notes: 'Awaiting initial maintenance fee payment',
    updatedAt: new Date().toISOString()
  }));
}

// Initial Facility Service Schedules for Q1 - Q4 2026 operations
export const DEFAULT_FACILITY_SCHEDULES = [
  // 1. Quarterly AC Servicing
  {
    id: 'SCH-AC-2026-Q1',
    serviceType: 'AC_SERVICING',
    title: 'Q1 Quarterly AC Servicing & Chemical Coil Wash',
    frequency: 'QUARTERLY',
    propertyId: 'ALL',
    unitId: 'ALL UNITS',
    scheduledDate: '2026-01-20',
    completedDate: '2026-01-22',
    status: 'COMPLETED',
    assignedVendor: 'CoolBreeze Air Systems Ltd',
    staffName: 'Ing. Kwesi Boateng',
    costIncurred: 4800.0,
    checklist: [
      { item: 'All 16 units filters washed & disinfected', done: true },
      { item: 'Compressor refrigerant top-up verified', done: true },
      { item: 'Condensate drainage cleared', done: true },
      { item: 'Thermostat digital test calibrated', done: true }
    ],
    notes: 'Serviced 32 split AC units across Amamoley and Kwabenya complexes. 2 capacitor replacements completed.',
    receiptAttachmentUrl: null,
    loggedByManagerId: 'mgr-douglas-amadie',
    loggedByName: 'Douglas Amadie',
    updatedAt: '2026-01-23T10:00:00.000Z'
  },
  {
    id: 'SCH-AC-2026-Q2',
    serviceType: 'AC_SERVICING',
    title: 'Q2 Preventive AC Inspection & Pressure Calibration',
    frequency: 'QUARTERLY',
    propertyId: 'ALL',
    unitId: 'ALL UNITS',
    scheduledDate: '2026-04-18',
    completedDate: '2026-04-20',
    status: 'COMPLETED',
    assignedVendor: 'CoolBreeze Air Systems Ltd',
    staffName: 'Ing. Kwesi Boateng',
    costIncurred: 4500.0,
    checklist: [
      { item: 'Evaporator coil antibacterial wash', done: true },
      { item: 'Outdoor bracket structural inspection', done: true },
      { item: 'Gas leak sniffer test passed', done: true },
      { item: 'Remote controller batteries renewed', done: true }
    ],
    notes: 'Routine Q2 service complete with tenant satisfaction sign-offs collected by Douglas Amadie.',
    receiptAttachmentUrl: null,
    loggedByManagerId: 'mgr-douglas-amadie',
    loggedByName: 'Douglas Amadie',
    updatedAt: '2026-04-21T09:00:00.000Z'
  },
  {
    id: 'SCH-AC-2026-Q3',
    serviceType: 'AC_SERVICING',
    title: 'Q3 Comprehensive AC Maintenance & Disinfection',
    frequency: 'QUARTERLY',
    propertyId: 'ALL',
    unitId: 'ALL UNITS',
    scheduledDate: '2026-07-15',
    completedDate: '2026-07-17',
    status: 'COMPLETED',
    assignedVendor: 'CoolBreeze Air Systems Ltd',
    staffName: 'Ing. Kwesi Boateng',
    costIncurred: 4600.0,
    checklist: [
      { item: 'Chemical deep foam cleaning of cooling fins', done: true },
      { item: 'Blower fan balancing', done: true },
      { item: 'Condenser fan motor lubrication', done: true }
    ],
    notes: 'Completed ahead of rainy season humidity rise. All units cooling at optimal Delta-T (9-12°C).',
    receiptAttachmentUrl: null,
    loggedByManagerId: 'mgr-douglas-amadie',
    loggedByName: 'Douglas Amadie',
    updatedAt: '2026-07-18T14:30:00.000Z'
  },
  {
    id: 'SCH-AC-2026-Q4',
    serviceType: 'AC_SERVICING',
    title: 'Q4 Year-End AC Servicing & Seasonal Overhaul',
    frequency: 'QUARTERLY',
    propertyId: 'ALL',
    unitId: 'ALL UNITS',
    scheduledDate: '2026-11-10',
    completedDate: null,
    status: 'SCHEDULED',
    assignedVendor: 'CoolBreeze Air Systems Ltd',
    staffName: 'Ing. Kwesi Boateng',
    costIncurred: 4800.0,
    checklist: [
      { item: 'Annual deep coil sanitization', done: false },
      { item: 'Refrigerant circuit pressure test', done: false },
      { item: 'Electrical contactor torquing', done: false },
      { item: 'Tenant sign-off log verification', done: false }
    ],
    notes: 'Vendor confirmed for second week of November. Pre-notification notices to be sent to all residents 48hrs prior.',
    receiptAttachmentUrl: null,
    loggedByManagerId: 'mgr-douglas-amadie',
    loggedByName: 'Douglas Amadie',
    updatedAt: '2026-10-25T11:00:00.000Z'
  },

  // 2. Routine Water Pump Servicing & Pressure Monitoring
  {
    id: 'SCH-WP-2026-10',
    serviceType: 'WATER_PUMP',
    title: 'October Water Pumping Station & Borehole Maintenance',
    frequency: 'MONTHLY',
    propertyId: 'ALL',
    unitId: 'PLANT ROOM',
    scheduledDate: '2026-10-06',
    completedDate: '2026-10-07',
    status: 'COMPLETED',
    assignedVendor: 'AquaTech Pumping Solutions',
    staffName: 'Frank Osei-Tutu',
    costIncurred: 1200.0,
    checklist: [
      { item: 'Borehole static and pumping water level measured', done: true },
      { item: 'Sediment filter backwash and cartridge change', done: true },
      { item: 'Pressure switch cut-in at 2.8 Bar, cut-out at 4.2 Bar verified', done: true },
      { item: 'Overhead 10,000L polytank float sensors checked', done: true }
    ],
    notes: 'Both complexes have steady water supply. Chlorine dosing levels verified at 0.5ppm.',
    receiptAttachmentUrl: null,
    loggedByManagerId: 'mgr-douglas-amadie',
    loggedByName: 'Douglas Amadie',
    updatedAt: '2026-10-07T16:00:00.000Z'
  },
  {
    id: 'SCH-WP-2026-11',
    serviceType: 'WATER_PUMP',
    title: 'November Preventive Water Pump Inspection & Filter Flush',
    frequency: 'MONTHLY',
    propertyId: 'ALL',
    unitId: 'PLANT ROOM',
    scheduledDate: '2026-11-05',
    completedDate: null,
    status: 'SCHEDULED',
    assignedVendor: 'AquaTech Pumping Solutions',
    staffName: 'Frank Osei-Tutu',
    costIncurred: 1200.0,
    checklist: [
      { item: 'Pressure bladder inspection', done: false },
      { item: 'Filter replacement', done: false },
      { item: 'Electrical control panel inspection', done: false }
    ],
    notes: 'Monthly routine check booked.',
    receiptAttachmentUrl: null,
    loggedByManagerId: 'mgr-douglas-amadie',
    loggedByName: 'Douglas Amadie',
    updatedAt: '2026-10-20T10:00:00.000Z'
  },

  // 3. Routine Solid Waste & Trash Disposal
  {
    id: 'SCH-TRASH-2026-W43',
    serviceType: 'TRASH_DISPOSAL',
    title: 'Week 43 Waste Evacuation & Receptacle Sanitization',
    frequency: 'WEEKLY',
    propertyId: 'ALL',
    unitId: 'COMMON BINS',
    scheduledDate: '2026-10-23',
    completedDate: '2026-10-23',
    status: 'COMPLETED',
    assignedVendor: 'CleanCity Waste Solutions Ltd',
    staffName: 'Supervisor Emmanuel Mensah',
    costIncurred: 650.0,
    checklist: [
      { item: 'Bi-weekly collection complete (Mon & Thu)', done: true },
      { item: 'Dumpster bay disinfected with chlorine solution', done: true },
      { item: 'Replacement trash bags restocked', done: true }
    ],
    notes: 'All waste bins fully cleared and pressure washed.',
    receiptAttachmentUrl: null,
    loggedByManagerId: 'mgr-douglas-amadie',
    loggedByName: 'Douglas Amadie',
    updatedAt: '2026-10-23T17:00:00.000Z'
  },
  {
    id: 'SCH-TRASH-2026-W44',
    serviceType: 'TRASH_DISPOSAL',
    title: 'Week 44 Bi-Weekly Waste Collection',
    frequency: 'WEEKLY',
    propertyId: 'ALL',
    unitId: 'COMMON BINS',
    scheduledDate: '2026-10-30',
    completedDate: null,
    status: 'IN_PROGRESS',
    assignedVendor: 'CleanCity Waste Solutions Ltd',
    staffName: 'Supervisor Emmanuel Mensah',
    costIncurred: 650.0,
    checklist: [
      { item: 'Monday collection done', done: true },
      { item: 'Thursday pickup scheduled', done: false }
    ],
    notes: 'Mid-week collection completed. Final pickup Friday afternoon.',
    receiptAttachmentUrl: null,
    loggedByManagerId: 'mgr-douglas-amadie',
    loggedByName: 'Douglas Amadie',
    updatedAt: '2026-10-27T08:00:00.000Z'
  },

  // 4. Compound Sweeping & Common Area Groundskeeping
  {
    id: 'SCH-CLEAN-2026-W43',
    serviceType: 'COMPOUND_CLEANING',
    title: 'Week 43 Common Area Deep Cleaning & Gutter Desilting',
    frequency: 'WEEKLY',
    propertyId: 'ALL',
    unitId: 'GROUNDS',
    scheduledDate: '2026-10-24',
    completedDate: '2026-10-24',
    status: 'COMPLETED',
    assignedVendor: 'Precourt Facilities Internal Staff',
    staffName: 'Douglas Amadie',
    costIncurred: 800.0,
    checklist: [
      { item: 'Driveways & curb edges pressure swept', done: true },
      { item: 'Perimeter concrete gutters flushed', done: true },
      { item: 'Lawn edging and hedge trimming done', done: true },
      { item: 'Stairwell handrails and security gate wiped', done: true }
    ],
    notes: 'Grounds in immaculate condition at both Amamoley and Kwabenya locations.',
    receiptAttachmentUrl: null,
    loggedByManagerId: 'mgr-douglas-amadie',
    loggedByName: 'Douglas Amadie',
    updatedAt: '2026-10-24T18:00:00.000Z'
  },
  {
    id: 'SCH-CLEAN-2026-W44',
    serviceType: 'COMPOUND_CLEANING',
    title: 'Week 44 Groundskeeping & Common Area Sanitization',
    frequency: 'WEEKLY',
    propertyId: 'ALL',
    unitId: 'GROUNDS',
    scheduledDate: '2026-10-31',
    completedDate: null,
    status: 'IN_PROGRESS',
    assignedVendor: 'Precourt Facilities Internal Staff',
    staffName: 'Douglas Amadie',
    costIncurred: 800.0,
    checklist: [
      { item: 'Daily driveway sweeping maintained', done: true },
      { item: 'Staircase sanitization', done: true },
      { item: 'Weekend perimeter deep wash', done: false }
    ],
    notes: 'Ongoing daily sweeps by caretaker team supervised by Douglas Amadie.',
    receiptAttachmentUrl: null,
    loggedByManagerId: 'mgr-douglas-amadie',
    loggedByName: 'Douglas Amadie',
    updatedAt: '2026-10-28T06:00:00.000Z'
  }
];

export function calculateMaintenanceFeeMetrics(fees = [], schedules = []) {
  const totalUnits = fees.length;
  const totalBilled = fees.reduce((sum, f) => sum + (Number(f.totalAmountDue) || 3000), 0);
  const totalCollected = fees.reduce((sum, f) => sum + (Number(f.amountPaid) || 0), 0);
  const totalOutstanding = Math.max(0, totalBilled - totalCollected);

  const paidCount = fees.filter((f) => f.paymentStatus === 'PAID').length;
  const partiallyPaidCount = fees.filter((f) => f.paymentStatus === 'PARTIALLY_PAID').length;
  const pendingCount = fees.filter((f) => f.paymentStatus === 'PENDING').length;
  const overdueCount = fees.filter((f) => f.paymentStatus === 'OVERDUE').length;

  // Good standing includes fully paid and partially paid accounts
  const inGoodStandingCount = paidCount + partiallyPaidCount;
  const complianceRate = totalUnits > 0 ? Math.round((inGoodStandingCount / totalUnits) * 100) : 0;
  const fullyPaidRate = totalUnits > 0 ? Math.round((paidCount / totalUnits) * 100) : 0;

  // Maintenance Fund reserve: Total fees collected minus actual operational expenses incurred
  const totalOperationsCostIncurred = schedules
    .filter((s) => s.status === 'COMPLETED')
    .reduce((sum, s) => sum + (Number(s.costIncurred) || 0), 0);
  
  const projectedQuarterlyExpenses = 12000.0;
  const maintenanceFundBalance = Math.max(0, totalCollected - totalOperationsCostIncurred);

  return {
    totalUnits,
    totalBilled,
    totalCollected,
    totalOutstanding,
    complianceRate,
    fullyPaidRate,
    paidCount,
    partiallyPaidCount,
    pendingCount,
    overdueCount,
    totalOperationsCostIncurred,
    maintenanceFundBalance,
    projectedQuarterlyExpenses
  };
}
