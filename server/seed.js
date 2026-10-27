const db = require('./database');
const { v4: uuidv4 } = require('uuid');

function seedDatabase() {
  console.log('Seeding sheet data into database...');

  // Clear existing records
  db.exec(`
    DELETE FROM payments;
    DELETE FROM charges;
    DELETE FROM maintenance_requests;
    DELETE FROM leases;
    DELETE FROM units;
    DELETE FROM tenants;
    DELETE FROM properties;
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

  });

  transaction();
  console.log('Database successfully seeded with sheet data: 16 tenants across PLH-AM and PLH-KW.');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
