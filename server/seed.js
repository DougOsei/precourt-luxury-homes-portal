const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const rootDir = path.join(__dirname, '..');
if (fs.existsSync(path.join(rootDir, '.env.local'))) {
  dotenv.config({ path: path.join(rootDir, '.env.local') });
}
if (fs.existsSync(path.join(rootDir, '.env'))) {
  dotenv.config({ path: path.join(rootDir, '.env') });
}

const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const { buildDefaultSeededManagers } = require('./auth');

function seedDatabase() {
  console.log('Seeding sheet data and administrative accounts into database...');

  // Clear existing records
  db.exec(`
    DELETE FROM payments;
    DELETE FROM charges;
    DELETE FROM maintenance_requests;
    DELETE FROM leases;
    DELETE FROM units;
    DELETE FROM tenants;
    DELETE FROM properties;
    DELETE FROM managers;
  `);

  const insertProperty = db.prepare(`
    INSERT INTO properties (id, name, address, city, state, zip_code, property_type, year_built, image_url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertUnit = db.prepare(`
    INSERT INTO units (id, property_id, unit_number, floor, bedrooms, bathrooms, square_feet, market_rent, status, features)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTenant = db.prepare(`
    INSERT INTO tenants (id, first_name, last_name, email, phone, whatsapp, national_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, employer, monthly_income, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLease = db.prepare(`
    INSERT INTO leases (id, tenant_id, unit_id, start_date, end_date, monthly_rent, security_deposit, duration_months, total_contract_value, rent_due_day, status, terms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCharge = db.prepare(`
    INSERT INTO charges (id, lease_id, tenant_id, charge_type, description, amount, due_date, period_month, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO payments (id, lease_id, tenant_id, charge_id, amount, payment_date, payment_method, reference_no, notes, receipt_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMaintenance = db.prepare(`
    INSERT INTO maintenance_requests (id, property_id, unit_id, tenant_id, title, description, category, priority, status, estimated_cost, actual_cost, contractor_name, contractor_phone, invoice_ref, date_reported, date_scheduled, date_completed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    // 1. PROPERTIES
    const propAM = {
      id: 'PLH-AM',
      name: 'Precourt Luxury Homes — Amamoley (PLH-AM)',
      address: 'Amamoley Estates Enclave',
      city: 'Amamoley, Accra',
      state: 'Greater Accra',
      zip_code: 'GA-048',
      property_type: 'Luxury Apartment Complex',
      year_built: 2023,
      image_url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      description: 'Premier 8-apartment residential complex in Amamoley (PLH-AM) featuring modern self-contained apartments, constant borehole water supply, ECG prepaid meters, and 24/7 gated security.'
    };

    const propKW = {
      id: 'PLH-KW',
      name: 'Precourt Luxury Homes — Kwabenya (PLH-KW)',
      address: 'Kwabenya Hills Executive Enclave',
      city: 'Kwabenya, Accra',
      state: 'Greater Accra',
      zip_code: 'GA-085',
      property_type: 'Luxury Gated Residence',
      year_built: 2024,
      image_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      description: 'High-end 8-apartment gated executive residences in Kwabenya (PLH-KW) with luxury 3-bedroom suites, electric perimeter fencing, standby generator backup, and dedicated resident parking.'
    };

    [propAM, propKW].forEach(p => {
      insertProperty.run(p.id, p.name, p.address, p.city, p.state, p.zip_code, p.property_type, p.year_built, p.image_url, p.description);
    });

    // 2. UNITS (All 16 fully occupied apartments: 8 at Amamoley + 8 at Kwabenya)
    const unitsData = [
      // PLH-AM Units (8 apartments)
      { id: 'unit-AM-01', propId: 'PLH-AM', num: 'AM-01', floor: 1, beds: 2, baths: 2, sqft: 950, rent: 2000, status: 'occupied', feats: 'Self-contained, Balcony, Tiled floors, Water heater' },
      { id: 'unit-AM-02', propId: 'PLH-AM', num: 'AM-02', floor: 1, beds: 2, baths: 2, sqft: 950, rent: 2000, status: 'occupied', feats: 'Self-contained, Fitted kitchen, Prepaid meter' },
      { id: 'unit-AM-03', propId: 'PLH-AM', num: 'AM-03', floor: 1, beds: 2, baths: 2, sqft: 950, rent: 2000, status: 'occupied', feats: 'Ground floor, Security burglar proofing' },
      { id: 'unit-AM-04', propId: 'PLH-AM', num: 'AM-04', floor: 1, beds: 2, baths: 2, sqft: 950, rent: 2000, status: 'occupied', feats: 'Modern finishes, POP ceiling' },
      { id: 'unit-AM-05', propId: 'PLH-AM', num: 'AM-05', floor: 2, beds: 2, baths: 2, sqft: 980, rent: 2000, status: 'occupied', feats: 'Top floor, Great cross ventilation, Private balcony' },
      { id: 'unit-AM-06', propId: 'PLH-AM', num: 'AM-06', floor: 2, beds: 2, baths: 2, sqft: 980, rent: 2000, status: 'occupied', feats: 'Spacious hall, En-suite master bedroom' },
      { id: 'unit-AM-07', propId: 'PLH-AM', num: 'AM-07', floor: 2, beds: 2, baths: 1.5, sqft: 880, rent: 1800, status: 'occupied', feats: 'Standard 2-bedroom suite, Ceiling fans' },
      { id: 'unit-AM-08', propId: 'PLH-AM', num: 'AM-08', floor: 2, beds: 3, baths: 2.5, sqft: 1150, rent: 3000, status: 'occupied', feats: 'Executive 3-bedroom, Master en-suite, Store room' },

      // PLH-KW Units (8 apartments)
      { id: 'unit-KW-01', propId: 'PLH-KW', num: 'KW-01', floor: 1, beds: 3, baths: 3, sqft: 1450, rent: 5000, status: 'occupied', feats: 'Executive 3-bed apartment, AC installed, Fitted cabinets' },
      { id: 'unit-KW-02', propId: 'PLH-KW', num: 'KW-02', floor: 1, beds: 3, baths: 3, sqft: 1450, rent: 5000, status: 'occupied', feats: 'Luxury finishes, Modern kitchen island, Water heaters' },
      { id: 'unit-KW-03', propId: 'PLH-KW', num: 'KW-03', floor: 1, beds: 3, baths: 3, sqft: 1450, rent: 5000, status: 'occupied', feats: 'Private parking space, Constant flow pressure pump' },
      { id: 'unit-KW-04', propId: 'PLH-KW', num: 'KW-04', floor: 2, beds: 3, baths: 3, sqft: 1480, rent: 5000, status: 'occupied', feats: 'Corner unit, Hilltop breeze, Wardrobes fitted' },
      { id: 'unit-KW-05', propId: 'PLH-KW', num: 'KW-05', floor: 2, beds: 3, baths: 3, sqft: 1480, rent: 5000, status: 'occupied', feats: 'En-suite bedrooms, Balcony overview' },
      { id: 'unit-KW-06', propId: 'PLH-KW', num: 'KW-06', floor: 2, beds: 3, baths: 3, sqft: 1480, rent: 5000, status: 'occupied', feats: 'Executive suite, Porcelain tiles throughout' },
      { id: 'unit-KW-07', propId: 'PLH-KW', num: 'KW-07', floor: 3, beds: 3, baths: 3.5, sqft: 1650, rent: 5500, status: 'occupied', feats: 'Penthouse suite, Extra guest washroom, Panoramic views' },
      { id: 'unit-KW-08', propId: 'PLH-KW', num: 'KW-08', floor: 3, beds: 3, baths: 3, sqft: 1480, rent: 5000, status: 'occupied', feats: 'Top floor, Polished granite countertops' }
    ];

    unitsData.forEach(u => {
      insertUnit.run(u.id, u.propId, u.num, u.floor, u.beds, u.baths, u.sqft, u.rent, u.status, u.feats);
    });

    // 3. TENANTS (Exact 16 Tenants from CSV)
    const rawTenants = [
      { id: 'PLH-001', name: 'Dominic Bannerman', phone: '573304065', wa: '573304065', email: '', prop: 'PLH-AM', unit: 'unit-AM-01', start: '2025-03-15', end: '2027-03-15', rent: 2000, mos: 24, total: 48000, status: 'Active', days: 139, alert: 'OK' },
      { id: 'PLH-002', name: 'Dorcas kyerewaa Jaase', phone: '549550164', wa: '549550164', email: '', prop: 'PLH-AM', unit: 'unit-AM-04', start: '2026-09-01', end: '2027-09-01', rent: 2000, mos: 12, total: 24000, status: 'Active', days: 309, alert: 'OK' },
      { id: 'PLH-003', name: 'Bridget Naa Dedei Queye', phone: '240293048', wa: '240293048', email: '', prop: 'PLH-AM', unit: 'unit-AM-02', start: '2025-10-20', end: '2026-10-20', rent: 2000, mos: 12, total: 24000, status: 'Expired', days: -7, alert: 'OVERDUE / EXPIRED' },
      { id: 'PLH-004', name: 'Patience Angela Hadzi', phone: '244243061', wa: '', email: '', prop: 'PLH-AM', unit: 'unit-AM-07', start: '2026-09-10', end: '2027-09-10', rent: 1800, mos: 12, total: 21600, status: 'Active', days: 318, alert: 'OK' },
      { id: 'PLH-005', name: 'Joseph Adams Offei', phone: '507813839', wa: '', email: '', prop: 'PLH-AM', unit: 'unit-AM-03', start: '2027-07-19', end: '2028-07-19', rent: 2000, mos: 12, total: 24000, status: 'Active', days: 631, alert: 'OK' },
      { id: 'PLH-006', name: 'Andrew Koomson', phone: '558118520', wa: '', email: '', prop: 'PLH-AM', unit: 'unit-AM-05', start: '2026-10-01', end: '2027-04-01', rent: 2000, mos: 6, total: 12000, status: 'Active', days: 156, alert: 'OK' },
      { id: 'PLH-007', name: 'Albert Amankwah', phone: '541448628', wa: '', email: '', prop: 'PLH-AM', unit: 'unit-AM-06', start: '2026-09-09', end: '2027-09-09', rent: 2000, mos: 12, total: 24000, status: 'Active', days: 317, alert: 'OK' },
      { id: 'PLH-008', name: 'Grace Yamson', phone: '542405934', wa: '', email: '', prop: 'PLH-AM', unit: 'unit-AM-08', start: '2026-06-15', end: '2026-12-15', rent: 3000, mos: 6, total: 18000, status: 'Expiring Soon', days: 49, alert: 'EXPIRING: 90 DAYS OR LESS' },
      
      { id: 'PLH-009', name: 'Zack Fatawu', phone: '591834138', wa: '', email: '', prop: 'PLH-KW', unit: 'unit-KW-07', start: '2026-07-25', end: '2027-01-25', rent: 5500, mos: 6, total: 33000, status: 'Expiring Soon', days: 90, alert: 'EXPIRING: 90 DAYS OR LESS' },
      { id: 'PLH-010', name: 'Salima Mohammed', phone: '241978601', wa: '', email: '', prop: 'PLH-KW', unit: 'unit-KW-02', start: '2026-02-07', end: '2027-02-07', rent: 5000, mos: 12, total: 60000, status: 'Active', days: 103, alert: 'OK' },
      { id: 'PLH-011', name: 'Bless Detsor', phone: '547199177', wa: '', email: '', prop: 'PLH-KW', unit: 'unit-KW-03', start: '2026-02-18', end: '2027-02-18', rent: 5000, mos: 12, total: 60000, status: 'Active', days: 114, alert: 'OK' },
      { id: 'PLH-012', name: 'Akweteh Haikodai', phone: '243425325', wa: '', email: '', prop: 'PLH-KW', unit: 'unit-KW-06', start: '2025-12-30', end: '2026-12-30', rent: 5000, mos: 12, total: 60000, status: 'Expiring Soon', days: 64, alert: 'EXPIRING: 90 DAYS OR LESS' },
      { id: 'PLH-013', name: 'Michael Ofori', phone: '549623380', wa: '', email: '', prop: 'PLH-KW', unit: 'unit-KW-01', start: '2026-03-20', end: '2027-03-20', rent: 5000, mos: 12, total: 60000, status: 'Active', days: 144, alert: 'OK' },
      { id: 'PLH-014', name: 'Abdul Karim Hannifa', phone: '503170163', wa: '', email: '', prop: 'PLH-KW', unit: 'unit-KW-08', start: '2026-02-04', end: '2027-02-04', rent: 5000, mos: 12, total: 60000, status: 'Active', days: 100, alert: 'OK' },
      { id: 'PLH-015', name: 'Emekosim Christian', phone: '551904042', wa: '', email: '', prop: 'PLH-KW', unit: 'unit-KW-05', start: '2026-02-12', end: '2027-02-12', rent: 5000, mos: 12, total: 60000, status: 'Active', days: 108, alert: 'OK' },
      { id: 'PLH-016', name: 'Leslie Mannoh', phone: '204047168', wa: '', email: '', prop: 'PLH-KW', unit: 'unit-KW-04', start: '2026-02-10', end: '2027-02-10', rent: 5000, mos: 12, total: 60000, status: 'Active', days: 106, alert: 'OK' }
    ];

    rawTenants.forEach(t => {
      const nameParts = t.name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;
      const email = t.email || '';

      insertTenant.run(
        t.id,
        firstName,
        lastName,
        email,
        t.phone,
        t.wa || null,
        `GHA-${t.id}`,
        'Emergency Contact',
        t.phone,
        'Next of Kin',
        'Private Business / Professional',
        t.rent * 3.5,
        'active',
        t.alert !== 'OK' ? `Alert Status: ${t.alert}` : null
      );

      // 4. LEASE
      const leaseId = `lease-${t.id.toLowerCase()}`;
      const leaseStatus = t.status === 'Expired' ? 'expired' : (t.status === 'Expiring Soon' ? 'expiring_soon' : 'active');
      insertLease.run(
        leaseId,
        t.id,
        t.unit,
        t.start,
        t.end,
        t.rent,
        t.rent, // security deposit
        t.mos,
        t.total,
        1, // due day
        leaseStatus,
        `${t.mos}-month tenancy contract for GH₵ ${t.total.toLocaleString()} total advance rent.`
      );

      // 5. CHARGES & PAYMENTS
      // Create initial contract charge
      const chgId = `chg-${t.id.toLowerCase()}`;
      insertCharge.run(
        chgId,
        leaseId,
        t.id,
        'rent',
        `Contract Advance Rent (${t.mos} Months)`,
        t.total,
        t.start,
        t.start.substring(0, 7),
        'paid'
      );

      // Payments recorded
      if (t.id === 'PLH-003') {
        // Bridget Naa Dedei Queye has paid contract, but has an active renewal pending
        insertPayment.run(
          `pay-${t.id.toLowerCase()}-1`,
          leaseId,
          t.id,
          chgId,
          t.total,
          t.start,
          'bank_transfer',
          'GCB-TRANSFER-8812',
          'Full 12-month advance rent paid',
          `REC-${t.start.replace(/-/g, '')}-1001`
        );

        // Add a utility/renewal charge of 1,200 GHS so she shows a balance
        const renewalChgId = `chg-renewal-${t.id.toLowerCase()}`;
        insertCharge.run(
          renewalChgId,
          leaseId,
          t.id,
          'utility',
          'Facility Maintenance & Renewal Holding Fee',
          1200,
          '2026-10-01',
          '2026-10',
          'unpaid'
        );
      } else if (t.id === 'PLH-008') {
        // Grace Yamson has paid partial (16,500 of 18,000, balance 1,500)
        insertPayment.run(
          `pay-${t.id.toLowerCase()}-1`,
          leaseId,
          t.id,
          chgId,
          16500,
          t.start,
          'online',
          'MOMO-MTN-99412',
          'Partial advance payment via MTN MoMo',
          `REC-${t.start.replace(/-/g, '')}-1008`
        );
      } else {
        // Fully paid contract
        insertPayment.run(
          `pay-${t.id.toLowerCase()}-1`,
          leaseId,
          t.id,
          chgId,
          t.total,
          t.start,
          t.rent >= 5000 ? 'bank_transfer' : 'online',
          `TRX-${t.id}-OK`,
          `Verified advance payment of GH₵${t.total.toLocaleString()}`,
          `REC-${t.start.replace(/-/g, '')}-${t.id.replace('PLH-', '')}`
        );
      }
    });

    // 6. REALISTIC MAINTENANCE TICKETS FOR THE PLH FACILITIES
    const maintList = [
      {
        id: 'maint-plh-1',
        propId: 'PLH-AM',
        unitId: 'unit-AM-02',
        tenantId: 'PLH-003',
        title: 'AC Servicing & Pre-renewal Inspection',
        desc: 'Comprehensive split unit AC filter cleaning and gas pressure check prior to contract renewal date.',
        cat: 'hvac',
        priority: 'high',
        status: 'in_progress',
        est: 450,
        act: 0,
        contractor: 'Accra ColdAir Engineering',
        phone: '0244112233',
        rep: '2026-10-02',
        notes: 'Technician dispatched for assessment.'
      },
      {
        id: 'maint-plh-2',
        propId: 'PLH-AM',
        unitId: 'unit-AM-04',
        tenantId: 'PLH-002',
        title: 'Water Heater Thermostat Check',
        desc: 'Water heater tripping breaker after 10 minutes of operation. Heating element replaced.',
        cat: 'electrical',
        priority: 'medium',
        status: 'completed',
        est: 350,
        act: 320,
        contractor: 'ElectroFix Electricals',
        phone: '0207889900',
        rep: '2026-09-20',
        comp: '2026-09-22',
        notes: 'Thermostat calibrated and tested safe.'
      },
      {
        id: 'maint-plh-3',
        propId: 'PLH-KW',
        unitId: 'unit-KW-07',
        tenantId: 'PLH-009',
        title: 'Penthouse Water Booster Pressure Pump Servicing',
        desc: 'Automatic booster pump failing to stop when overhead polytank reaches max level.',
        cat: 'plumbing',
        priority: 'urgent',
        status: 'completed',
        est: 1200,
        act: 1150,
        contractor: 'FlowMaster Hydro Services',
        phone: '0541234567',
        rep: '2026-09-28',
        comp: '2026-09-29',
        notes: 'Pressure switch and float sensor replaced.'
      },
      {
        id: 'maint-plh-4',
        propId: 'PLH-KW',
        unitId: 'unit-KW-01',
        tenantId: 'PLH-013',
        title: 'Kitchen Sink Drainage Unblocking',
        desc: 'Kitchen sink draining slowly due to grease buildup in exterior trap.',
        cat: 'plumbing',
        priority: 'medium',
        status: 'completed',
        est: 280,
        act: 250,
        contractor: 'FlowMaster Hydro Services',
        phone: '0541234567',
        rep: '2026-09-15',
        comp: '2026-09-15',
        notes: 'Line flushed with eco-friendly de-greaser.'
      },
      {
        id: 'maint-plh-5',
        propId: 'PLH-KW',
        unitId: 'unit-KW-06',
        tenantId: 'PLH-012',
        title: 'Unit KW-06 Annual Preventive Inspection',
        desc: 'Routine fixture inspection and AC servicing ahead of December contract renewal.',
        cat: 'structural',
        priority: 'low',
        status: 'in_progress',
        est: 650,
        act: 0,
        contractor: 'Prime Decorators Ghana',
        phone: '0277334455',
        rep: '2026-10-04',
        notes: 'Scheduled inspection with resident.'
      },
      {
        id: 'maint-plh-6',
        propId: 'PLH-AM',
        unitId: null,
        tenantId: null,
        title: 'Compound Solar Floodlights Battery Replacement',
        desc: 'Two security solar floodlights along the entrance gate battery backup depleted.',
        cat: 'electrical',
        priority: 'medium',
        status: 'scheduled',
        est: 850,
        act: 0,
        contractor: 'SunTech Solutions',
        phone: '0266778899',
        rep: '2026-10-05',
        notes: 'Scheduled for installation Saturday morning.'
      }
    ];

    maintList.forEach(m => {
      insertMaintenance.run(
        m.id,
        m.propId,
        m.unitId,
        m.tenantId,
        m.title,
        m.desc,
        m.cat,
        m.priority,
        m.status,
        m.est,
        m.act || 0,
        m.contractor,
        m.phone,
        `INV-${m.id}`,
        m.rep,
        m.rep,
        m.comp || null,
        m.notes
      );
    });

    // 7. SEED ADMINISTRATIVE & FACILITY MANAGER ACCOUNTS (BCRYPT COST 12)
    const insertManager = db.prepare(`
      INSERT INTO managers (
        id, full_name, email, username, password_hash, role,
        assigned_properties, status, require_password_reset,
        failed_login_attempts, locked_until, last_login_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultManagers = buildDefaultSeededManagers();
    defaultManagers.forEach(mgr => {
      insertManager.run(
        mgr.id,
        mgr.fullName,
        mgr.email,
        mgr.username,
        mgr.passwordHash,
        mgr.role,
        JSON.stringify(mgr.assignedProperties),
        mgr.status,
        mgr.requirePasswordReset ? 1 : 0,
        0,
        0,
        null,
        mgr.createdAt
      );
    });

    seedConstructionData();
  });

  transaction();
  console.log('Database successfully seeded: 16 tenants (PLH-AM & PLH-KW), Super Admin account, and Facility Manager Douglas Amadie.');
}

function seedConstructionData() {
  const insertCategory = db.prepare(`
    INSERT OR REPLACE INTO expense_categories (id, name, code, color, bg_color, description, icon_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const categories = [
    { id: 'PERMITS_LEGAL', name: 'Permits & Legal', code: 'PERMITS_LEGAL', color: '#3B82F6', bgColor: 'bg-blue-500/10 text-blue-700', description: 'Town planning, building permits, EPA, land registration', iconName: 'FileCheck' },
    { id: 'ARCHITECTURAL_ENGINEERING', name: 'Architectural & Engineering', code: 'ARCHITECTURAL_ENGINEERING', color: '#8B5CF6', bgColor: 'bg-purple-500/10 text-purple-700', description: 'Structural drawings, MEP designs, soil tests', iconName: 'Compass' },
    { id: 'SUBSTRUCTURE_FOUNDATION', name: 'Substructure & Foundation', code: 'SUBSTRUCTURE_FOUNDATION', color: '#D97706', bgColor: 'bg-amber-500/10 text-amber-700', description: 'Excavation, sand, stones, cement, iron rods, concrete', iconName: 'Layers' },
    { id: 'SUPERSTRUCTURE_BLOCKWORK', name: 'Superstructure & Blockwork', code: 'SUPERSTRUCTURE_BLOCKWORK', color: '#10B981', bgColor: 'bg-emerald-500/10 text-emerald-700', description: 'Blocks, lintels, columns, formwork, scaffolding', iconName: 'Building2' },
    { id: 'ROOFING_WATERPROOFING', name: 'Roofing & Waterproofing', code: 'ROOFING_WATERPROOFING', color: '#06B6D4', bgColor: 'bg-cyan-500/10 text-cyan-700', description: 'Trusses, roofing sheets, membrane waterproofing', iconName: 'Umbrella' },
    { id: 'MEP_SERVICES', name: 'MEP Services', code: 'MEP_SERVICES', color: '#F59E0B', bgColor: 'bg-yellow-500/10 text-yellow-800', description: 'Electrical conduits/wiring, plumbing pipes, septic tanks, water storage', iconName: 'Zap' },
    { id: 'FINISHING', name: 'Finishing & Fixtures', code: 'FINISHING', color: '#EC4899', bgColor: 'bg-pink-500/10 text-pink-700', description: 'Tiling, plastering, painting, ceiling/P.O.P., doors, aluminum/glass windows', iconName: 'Palette' },
    { id: 'LABOR_CONTRACTORS', name: 'Labor & Contractors', code: 'LABOR_CONTRACTORS', color: '#F97316', bgColor: 'bg-orange-500/10 text-orange-700', description: 'Masons, steel benders, carpenters, day labor, electrician fees', iconName: 'HardHat' },
    { id: 'EQUIPMENT_HAULAGE', name: 'Equipment & Haulage', code: 'EQUIPMENT_HAULAGE', color: '#6366F1', bgColor: 'bg-indigo-500/10 text-indigo-700', description: 'Concrete mixer rentals, excavator hire, tipper truck delivery fees', iconName: 'Truck' },
    { id: 'CONTINGENCY_SITE_OVERHEAD', name: 'Site Overhead & Contingency', code: 'CONTINGENCY_SITE_OVERHEAD', color: '#64748B', bgColor: 'bg-slate-500/10 text-slate-700', description: 'Site security, water/generator fuel, temporary site office', iconName: 'ShieldAlert' }
  ];

  categories.forEach(cat => {
    insertCategory.run(cat.id, cat.name, cat.code, cat.color, cat.bgColor, cat.description, cat.iconName);
  });

  const insertProject = db.prepare(`
    INSERT OR REPLACE INTO construction_projects (
      id, project_name, total_budget, currency, secondary_currency, exchange_rate,
      start_date, target_completion_date, project_status, location, description,
      admin_approval_threshold, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertProject.run(
    'PRJ-PLH-PH1',
    'Precourt Luxury Apartments - Phase 1',
    4500000.0,
    'GHS',
    'USD',
    15.5,
    '2026-01-15',
    '2026-12-20',
    'ACTIVE',
    'Airport Residential Area, Accra',
    'Ultra-luxury 12-unit residential apartment development featuring private balconies, rooftop infinity pool, and underground parking.',
    10000.0,
    new Date().toISOString()
  );

  const insertExpense = db.prepare(`
    INSERT OR REPLACE INTO project_expenses (
      id, project_id, category_id, title, amount, currency, amount_usd,
      payment_method, transaction_reference, vendor_name, vendor_phone,
      invoice_receipt_url, receipt_file_name, expense_date, recorded_by_user_id,
      recorded_by_name, approval_status, approved_by_name, approved_at, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialExpenses = [
    ['EXP-2026-001', 'PRJ-PLH-PH1', 'PERMITS_LEGAL', 'Accra Metropolitan Assembly (AMA) Building Permit & Planning Approval', 38500.0, 'GHS', 2483.87, 'BANK_TRANSFER', 'AMA-BLD-2026-904', 'Accra Metropolitan Assembly (Town Planning Dept)', '+233 30 266 5471', 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80', 'AMA_Building_Permit_Receipt.pdf', '2026-01-22', 'admin-kwame', 'Kwame Mensah (Super Admin)', 'PAID', 'Kwame Mensah', '2026-01-22T10:00:00Z', 'Official municipal permit receipt covering architectural, structural & fire compliance.', new Date().toISOString()],
    ['EXP-2026-002', 'PRJ-PLH-PH1', 'ARCHITECTURAL_ENGINEERING', 'Geotechnical Soil Investigation & Core Boring Test (4 Boreholes)', 18000.0, 'GHS', 1161.29, 'BANK_TRANSFER', 'GTC-INV-8821', 'GeoTech Consult Ghana Ltd', '+233 24 331 9081', 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80', 'GeoTech_Soil_Test_Report.pdf', '2026-01-28', 'douglas.amadie', 'Douglas Amadie (Facility Manager)', 'APPROVED', 'Kwame Mensah', '2026-01-29T14:15:00Z', 'Bearing capacity verified at 220 kPa for foundation pad design.', new Date().toISOString()],
    ['EXP-2026-003', 'PRJ-PLH-PH1', 'EQUIPMENT_HAULAGE', 'Site Excavation & Earth Removal (CAT 320D Excavator - 5 Days)', 27500.0, 'GHS', 1774.19, 'CHEQUE', 'CHQ-880192', 'Nana Kofi Heavy Equipment & Haulage Ltd', '+233 50 442 8810', 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80', 'Excavator_Rental_Waybill_01.pdf', '2026-02-05', 'douglas.amadie', 'Douglas Amadie (Facility Manager)', 'PAID', 'Kwame Mensah', '2026-02-06T09:30:00Z', 'Basement and pad foundation trench excavation including 14 tipper truck trips to landfill.', new Date().toISOString()],
    ['EXP-2026-004', 'PRJ-PLH-PH1', 'SUBSTRUCTURE_FOUNDATION', 'High-Tensile Steel Rebars (16mm, 12mm & 10mm High-Yield Rods - 15 Tons)', 142500.0, 'GHS', 9193.55, 'BANK_TRANSFER', 'B5-WT-99320', 'B5 Plus Steel Industries Ltd', '+233 30 330 2001', 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80', 'B5_Plus_Rebar_Invoice_15T.pdf', '2026-02-14', 'admin-kwame', 'Kwame Mensah (Super Admin)', 'PAID', 'Kwame Mensah', '2026-02-14T11:00:00Z', 'Grade 500B high-yield rebars certified for raft foundation and column starter bars.', new Date().toISOString()],
    ['EXP-2026-005', 'PRJ-PLH-PH1', 'SUBSTRUCTURE_FOUNDATION', 'Bulk Portland Cement (600 Bags of Ghacem 42.5R Super Rapid Hardening)', 67200.0, 'GHS', 4335.48, 'BANK_TRANSFER', 'GHACEM-DISP-4402', 'Ghacem Ghana Cement Distributors', '+233 24 559 1100', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80', 'Ghacem_Cement_Delivery_Waybill.pdf', '2026-02-20', 'douglas.amadie', 'Douglas Amadie (Facility Manager)', 'PAID', 'Kwame Mensah', '2026-02-21T08:45:00Z', 'GH₵ 112 per bag including delivery to site offloading zone.', new Date().toISOString()],
    ['EXP-2026-006', 'PRJ-PLH-PH1', 'LABOR_CONTRACTORS', 'Foundation Steel Bending & Formwork Carpentry Gang Labor Payout (Stage 1)', 22000.0, 'GHS', 1419.35, 'MOBILE_MONEY', 'MTN-MM-20260228-40192', 'Kofi Mensah Artisan Steel Benders Gang', '+233 24 991 3302', 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?auto=format&fit=crop&w=1200&q=80', 'Steel_Benders_Labor_Disbursement_Sheet.pdf', '2026-02-28', 'douglas.amadie', 'Douglas Amadie (Facility Manager)', 'PAID', 'Kwame Mensah', '2026-02-28T16:00:00Z', 'Signed wage sheet for 14 artisans for raft rebars and stub columns fabrication.', new Date().toISOString()],
    ['EXP-2026-007', 'PRJ-PLH-PH1', 'SUBSTRUCTURE_FOUNDATION', 'Ready-Mix Concrete Pouring (Grade C30/37 - 85 Cubic Meters via Boom Pump)', 114750.0, 'GHS', 7403.23, 'BANK_TRANSFER', 'ATL-CONC-88120', 'Atlantic Ready-Mix Concrete Ltd', '+233 30 221 4400', 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80', 'Atlantic_ReadyMix_Concrete_BatchTicket.pdf', '2026-03-08', 'admin-kwame', 'Kwame Mensah (Super Admin)', 'PAID', 'Kwame Mensah', '2026-03-08T18:00:00Z', 'Continuous raft foundation slab pour with slump test verification (120mm).', new Date().toISOString()],
    ['EXP-2026-008', 'PRJ-PLH-PH1', 'SUPERSTRUCTURE_BLOCKWORK', '6-inch Solid Vibrated Concrete Blocks (4,500 Units - First Batch)', 40500.0, 'GHS', 2612.90, 'BANK_TRANSFER', 'QBK-INV-1092', 'Quality Block Factory & Precast Ltd', '+233 20 812 7701', 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&w=1200&q=80', 'Block_Delivery_Waybill_Batch1.pdf', '2026-03-18', 'douglas.amadie', 'Douglas Amadie (Facility Manager)', 'APPROVED', 'Kwame Mensah', '2026-03-19T10:10:00Z', 'GH₵ 9.00 per unit including stacking on ground floor slab.', new Date().toISOString()],
    ['EXP-2026-009', 'PRJ-PLH-PH1', 'MEP_SERVICES', 'Ground Plumbing Sub-drainage & HDPE Sewage Pipe Line (Schedule 40 & Fittings)', 19800.0, 'GHS', 1277.42, 'MOBILE_MONEY', 'MTN-MM-20260325-11029', 'AquaFlow Plumbing Supplies Ltd', '+233 24 661 8021', 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80', 'AquaFlow_HDPE_Plumbing_Receipt.pdf', '2026-03-25', 'douglas.amadie', 'Douglas Amadie (Facility Manager)', 'APPROVED', 'Kwame Mensah', '2026-03-26T12:00:00Z', '110mm and 160mm sewer pipes embedded before ground slab casting.', new Date().toISOString()],
    ['EXP-2026-010', 'PRJ-PLH-PH1', 'CONTINGENCY_SITE_OVERHEAD', 'Site Security Guards 24/7 Patrol Allowance (Feb - Mar 2026)', 6400.0, 'GHS', 412.90, 'CASH', 'SEC-CSH-2026-03', 'Apex Shield Guard Services', '+233 50 119 2200', 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80', 'Apex_Security_Monthly_Invoice.pdf', '2026-03-31', 'douglas.amadie', 'Douglas Amadie (Facility Manager)', 'PAID', 'Kwame Mensah', '2026-03-31T17:00:00Z', 'Two 12-hour shifts daily protecting cement depot and rebars.', new Date().toISOString()],
    ['EXP-2026-011', 'PRJ-PLH-PH1', 'LABOR_CONTRACTORS', 'Masons Gang Masonry Wall Construction Payout (Ground to First Floor)', 16500.0, 'GHS', 1064.52, 'MOBILE_MONEY', 'MTN-MM-20260408-55102', 'Master Yaw Boakye Masons Guild', '+233 24 772 1092', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80', 'Masons_Guild_Wage_Invoice.pdf', '2026-04-08', 'douglas.amadie', 'Douglas Amadie (Facility Manager)', 'PENDING', null, null, 'Requires Super Admin approval (> GH₵ 10,000 threshold). 10 masons and 12 laborers.', new Date().toISOString()],
    ['EXP-2026-012', 'PRJ-PLH-PH1', 'SUBSTRUCTURE_FOUNDATION', 'Marine Plywood & Scaffolding Boards for First Floor Suspended Slab Formwork', 28500.0, 'GHS', 1838.71, 'CHEQUE', 'CHQ-880211', 'Woodland Timber & Plywood Depot Ltd', '+233 20 551 8890', 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80', 'Woodland_Formwork_Plywood_Waybill.pdf', '2026-04-12', 'douglas.amadie', 'Douglas Amadie (Facility Manager)', 'PENDING', null, null, 'Requires Super Admin approval (> GH₵ 10,000 threshold). 18mm film-faced marine boards.', new Date().toISOString()]
  ];

  initialExpenses.forEach(exp => {
    insertExpense.run(...exp);
  });
}

function ensureConstructionSeeded() {
  try {
    const existing = db.prepare('SELECT count(*) as count FROM construction_projects').get();
    if (!existing || existing.count === 0) {
      seedConstructionData();
      console.log('Seeded default construction project and initial expense ledger.');
    }
  } catch (e) {
    console.error('Error verifying construction seed:', e.message);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, ensureConstructionSeeded };
