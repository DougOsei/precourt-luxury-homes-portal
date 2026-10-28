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

// Initial 16 maintenance fee records corresponding to the 16 units across Amamoley and Kwabenya
export const DEFAULT_MAINTENANCE_FEES = [
  {
    id: 'FEE-2026-AM01',
    tenantId: 'PLH-001',
    tenantName: 'Dominic Bannerman',
    phone: '573304065',
    unitId: 'AM-01',
    propertyId: 'PLH-AM',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 3000.0,
    paymentStatus: 'PAID',
    dueDate: '2026-03-31',
    paymentDate: '2026-01-14',
    paymentMethod: 'bank_transfer',
    receiptNumber: 'RCP-2026-001',
    installments: [
      {
        id: 'inst-1',
        amount: 3000.0,
        date: '2026-01-14',
        method: 'bank_transfer',
        receiptNumber: 'RCP-2026-001',
        notes: 'Full payment for 2026 Facility & Maintenance fee',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Paid in full via GCB Bank transfer. Account in excellent standing.',
    updatedAt: '2026-01-14T10:00:00.000Z'
  },
  {
    id: 'FEE-2026-AM02',
    tenantId: 'PLH-003',
    tenantName: 'Bridget Naa Dedei Queye',
    phone: '240293048',
    unitId: 'AM-02',
    propertyId: 'PLH-AM',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 0.0,
    paymentStatus: 'OVERDUE',
    dueDate: '2026-03-31',
    paymentDate: null,
    paymentMethod: null,
    receiptNumber: null,
    installments: [],
    notes: 'Payment overdue. Formal reminder letter issued. Douglas Amadie following up.',
    updatedAt: '2026-04-05T09:30:00.000Z'
  },
  {
    id: 'FEE-2026-AM03',
    tenantId: 'PLH-005',
    tenantName: 'Joseph Adams Offei',
    phone: '507813839',
    unitId: 'AM-03',
    propertyId: 'PLH-AM',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 0.0,
    paymentStatus: 'PENDING',
    dueDate: '2026-11-30',
    paymentDate: null,
    paymentMethod: null,
    receiptNumber: null,
    installments: [],
    notes: 'Pending billing cycle payment. Advance tenancy agreement.',
    updatedAt: '2026-08-01T12:00:00.000Z'
  },
  {
    id: 'FEE-2026-AM04',
    tenantId: 'PLH-002',
    tenantName: 'Dorcas kyerewaa Jaase',
    phone: '549550164',
    unitId: 'AM-04',
    propertyId: 'PLH-AM',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 3000.0,
    paymentStatus: 'PAID',
    dueDate: '2026-09-30',
    paymentDate: '2026-09-02',
    paymentMethod: 'momo',
    receiptNumber: 'RCP-2026-004',
    installments: [
      {
        id: 'inst-2',
        amount: 3000.0,
        date: '2026-09-02',
        method: 'momo',
        receiptNumber: 'RCP-2026-004',
        notes: 'Full settlement via MTN Mobile Money',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Paid via MTN MoMo ref #MM260902881.',
    updatedAt: '2026-09-02T14:15:00.000Z'
  },
  {
    id: 'FEE-2026-AM05',
    tenantId: 'PLH-006',
    tenantName: 'Andrew Koomson',
    phone: '558118520',
    unitId: 'AM-05',
    propertyId: 'PLH-AM',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 2000.0,
    paymentStatus: 'PARTIALLY_PAID',
    dueDate: '2026-10-31',
    paymentDate: '2026-10-05',
    paymentMethod: 'cash',
    receiptNumber: 'RCP-2026-005',
    installments: [
      {
        id: 'inst-3',
        amount: 2000.0,
        date: '2026-10-05',
        method: 'cash',
        receiptNumber: 'RCP-2026-005',
        notes: 'First installment of GH₵ 2,000 paid to Douglas Amadie',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Balance of GH₵ 1,000 committed by end of month.',
    updatedAt: '2026-10-05T11:20:00.000Z'
  },
  {
    id: 'FEE-2026-AM06',
    tenantId: 'PLH-007',
    tenantName: 'Albert Amankwah',
    phone: '541448628',
    unitId: 'AM-06',
    propertyId: 'PLH-AM',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 3000.0,
    paymentStatus: 'PAID',
    dueDate: '2026-09-30',
    paymentDate: '2026-09-10',
    paymentMethod: 'bank_transfer',
    receiptNumber: 'RCP-2026-006',
    installments: [
      {
        id: 'inst-4',
        amount: 3000.0,
        date: '2026-09-10',
        method: 'bank_transfer',
        receiptNumber: 'RCP-2026-006',
        notes: 'Full payment via Standard Chartered',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Paid in full.',
    updatedAt: '2026-09-10T16:00:00.000Z'
  },
  {
    id: 'FEE-2026-AM07',
    tenantId: 'PLH-004',
    tenantName: 'Patience Angela Hadzi',
    phone: '244243061',
    unitId: 'AM-07',
    propertyId: 'PLH-AM',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 1500.0,
    paymentStatus: 'PARTIALLY_PAID',
    dueDate: '2026-10-31',
    paymentDate: '2026-09-15',
    paymentMethod: 'momo',
    receiptNumber: 'RCP-2026-007',
    installments: [
      {
        id: 'inst-5',
        amount: 1500.0,
        date: '2026-09-15',
        method: 'momo',
        receiptNumber: 'RCP-2026-007',
        notes: 'Installment 1 of 2 (50%)',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Second installment of GH₵ 1,500 due November 15.',
    updatedAt: '2026-09-15T15:30:00.000Z'
  },
  {
    id: 'FEE-2026-AM08',
    tenantId: 'PLH-008',
    tenantName: 'Grace Yamson',
    phone: '542405934',
    unitId: 'AM-08',
    propertyId: 'PLH-AM',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 0.0,
    paymentStatus: 'PENDING',
    dueDate: '2026-11-15',
    paymentDate: null,
    paymentMethod: null,
    receiptNumber: null,
    installments: [],
    notes: 'Short term lease; fee payable in upcoming cycle.',
    updatedAt: '2026-07-01T08:00:00.000Z'
  },

  // Kwabenya Complex Units (KW-01 to KW-08)
  {
    id: 'FEE-2026-KW01',
    tenantId: 'PLH-013',
    tenantName: 'Michael Ofori',
    phone: '549623380',
    unitId: 'KW-01',
    propertyId: 'PLH-KW',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 3000.0,
    paymentStatus: 'PAID',
    dueDate: '2026-04-30',
    paymentDate: '2026-03-25',
    paymentMethod: 'bank_transfer',
    receiptNumber: 'RCP-2026-013',
    installments: [
      {
        id: 'inst-6',
        amount: 3000.0,
        date: '2026-03-25',
        method: 'bank_transfer',
        receiptNumber: 'RCP-2026-013',
        notes: 'Full payment via Ecobank transfer',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Receipt delivered and acknowledged.',
    updatedAt: '2026-03-25T11:00:00.000Z'
  },
  {
    id: 'FEE-2026-KW02',
    tenantId: 'PLH-010',
    tenantName: 'Salima Mohammed',
    phone: '241978601',
    unitId: 'KW-02',
    propertyId: 'PLH-KW',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 3000.0,
    paymentStatus: 'PAID',
    dueDate: '2026-03-31',
    paymentDate: '2026-02-10',
    paymentMethod: 'bank_transfer',
    receiptNumber: 'RCP-2026-010',
    installments: [
      {
        id: 'inst-7',
        amount: 3000.0,
        date: '2026-02-10',
        method: 'bank_transfer',
        receiptNumber: 'RCP-2026-010',
        notes: 'Payment upon lease renewal',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Paid in full.',
    updatedAt: '2026-02-10T10:45:00.000Z'
  },
  {
    id: 'FEE-2026-KW03',
    tenantId: 'PLH-011',
    tenantName: 'Bless Detsor',
    phone: '547199177',
    unitId: 'KW-03',
    propertyId: 'PLH-KW',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 1500.0,
    paymentStatus: 'PARTIALLY_PAID',
    dueDate: '2026-03-31',
    paymentDate: '2026-02-20',
    paymentMethod: 'momo',
    receiptNumber: 'RCP-2026-011',
    installments: [
      {
        id: 'inst-8',
        amount: 1500.0,
        date: '2026-02-20',
        method: 'momo',
        receiptNumber: 'RCP-2026-011',
        notes: '50% installment paid',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Second tranche expected end of Q4.',
    updatedAt: '2026-02-20T13:20:00.000Z'
  },
  {
    id: 'FEE-2026-KW04',
    tenantId: 'PLH-016',
    tenantName: 'Leslie Mannoh',
    phone: '204047168',
    unitId: 'KW-04',
    propertyId: 'PLH-KW',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 0.0,
    paymentStatus: 'PENDING',
    dueDate: '2026-11-30',
    paymentDate: null,
    paymentMethod: null,
    receiptNumber: null,
    installments: [],
    notes: 'Scheduled for end of year settlement.',
    updatedAt: '2026-09-01T09:00:00.000Z'
  },
  {
    id: 'FEE-2026-KW05',
    tenantId: 'PLH-015',
    tenantName: 'Emekosim Christian',
    phone: '551904042',
    unitId: 'KW-05',
    propertyId: 'PLH-KW',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 3000.0,
    paymentStatus: 'PAID',
    dueDate: '2026-03-31',
    paymentDate: '2026-02-15',
    paymentMethod: 'bank_transfer',
    receiptNumber: 'RCP-2026-015',
    installments: [
      {
        id: 'inst-9',
        amount: 3000.0,
        date: '2026-02-15',
        method: 'bank_transfer',
        receiptNumber: 'RCP-2026-015',
        notes: 'Full payment cleared via Zenith Bank',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Paid in full.',
    updatedAt: '2026-02-15T15:00:00.000Z'
  },
  {
    id: 'FEE-2026-KW06',
    tenantId: 'PLH-012',
    tenantName: 'Akweteh Haikodai',
    phone: '243425325',
    unitId: 'KW-06',
    propertyId: 'PLH-KW',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 3000.0,
    paymentStatus: 'PAID',
    dueDate: '2026-03-31',
    paymentDate: '2026-01-05',
    paymentMethod: 'bank_transfer',
    receiptNumber: 'RCP-2026-012',
    installments: [
      {
        id: 'inst-10',
        amount: 3000.0,
        date: '2026-01-05',
        method: 'bank_transfer',
        receiptNumber: 'RCP-2026-012',
        notes: 'Early bird settlement',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Paid in full.',
    updatedAt: '2026-01-05T09:10:00.000Z'
  },
  {
    id: 'FEE-2026-KW07',
    tenantId: 'PLH-009',
    tenantName: 'Zack Fatawu',
    phone: '591834138',
    unitId: 'KW-07',
    propertyId: 'PLH-KW',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 1500.0,
    paymentStatus: 'PARTIALLY_PAID',
    dueDate: '2026-08-31',
    paymentDate: '2026-08-01',
    paymentMethod: 'momo',
    receiptNumber: 'RCP-2026-009',
    installments: [
      {
        id: 'inst-11',
        amount: 1500.0,
        date: '2026-08-01',
        method: 'momo',
        receiptNumber: 'RCP-2026-009',
        notes: 'First installment paid on lease inception',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Balance due by 30th November.',
    updatedAt: '2026-08-01T17:00:00.000Z'
  },
  {
    id: 'FEE-2026-KW08',
    tenantId: 'PLH-014',
    tenantName: 'Abdul Karim Hannifa',
    phone: '503170163',
    unitId: 'KW-08',
    propertyId: 'PLH-KW',
    billingYear: 2026,
    totalAmountDue: 3000.0,
    amountPaid: 3000.0,
    paymentStatus: 'PAID',
    dueDate: '2026-03-31',
    paymentDate: '2026-02-12',
    paymentMethod: 'bank_transfer',
    receiptNumber: 'RCP-2026-014',
    installments: [
      {
        id: 'inst-12',
        amount: 3000.0,
        date: '2026-02-12',
        method: 'bank_transfer',
        receiptNumber: 'RCP-2026-014',
        notes: 'Full payment',
        recordedBy: 'Douglas Amadie'
      }
    ],
    notes: 'Paid in full.',
    updatedAt: '2026-02-12T11:45:00.000Z'
  }
];

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
  const totalUnits = fees.length || 16;
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
