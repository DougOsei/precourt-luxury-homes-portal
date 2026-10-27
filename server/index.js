const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { seedDatabase } = require('./seed');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Helper function to format current date
function getTodayString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// -------------------------------------------------------------
// DASHBOARD STATS
// -------------------------------------------------------------
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const today = getTodayString();
    const currentMonth = today.substring(0, 7); // e.g. '2026-10'

    // Properties & Units
    const totalProperties = db.prepare('SELECT COUNT(*) as count FROM properties').get().count;
    const unitsSummary = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
        SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
      FROM units
    `).get();

    const occupancyRate = unitsSummary.total > 0 
      ? Math.round((unitsSummary.occupied / unitsSummary.total) * 100) 
      : 0;

    // Active Tenants
    const activeTenants = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'").get().count;

    // Active Leases
    const activeLeases = db.prepare("SELECT COUNT(*) as count FROM leases WHERE status IN ('active', 'expiring_soon', 'expired')").get().count;

    // Monthly Financials
    const rentChargedMonth = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM charges 
      WHERE (period_month = ? OR due_date LIKE ?) AND charge_type = 'rent'
    `).get(currentMonth, `${currentMonth}%`).total;

    const rentCollectedMonth = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM payments 
      WHERE payment_date LIKE ?
    `).get(`${currentMonth}%`).total;

    // Total outstanding balance across all tenants
    const totalChargesAllTime = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM charges').get().total;
    const totalPaymentsAllTime = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments').get().total;
    const totalOutstandingBalance = Math.max(0, totalChargesAllTime - totalPaymentsAllTime);

    // Overdue charges count & sum
    const overdueStats = db.prepare(`
      SELECT 
        COUNT(*) as overdue_count,
        COALESCE(SUM(amount), 0) as overdue_amount
      FROM charges
      WHERE due_date < ? AND status != 'paid'
    `).get(today);

    // Maintenance Stats
    const openMaintenance = db.prepare(`
      SELECT COUNT(*) as count 
      FROM maintenance_requests 
      WHERE status IN ('reported', 'in_progress', 'scheduled')
    `).get().count;

    const urgentMaintenance = db.prepare(`
      SELECT COUNT(*) as count 
      FROM maintenance_requests 
      WHERE priority = 'urgent' AND status != 'completed' AND status != 'cancelled'
    `).get().count;

    const totalMaintenanceCostMonth = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN actual_cost > 0 THEN actual_cost ELSE estimated_cost END), 0) as total
      FROM maintenance_requests
      WHERE date_reported LIKE ? OR date_completed LIKE ?
    `).get(`${currentMonth}%`, `${currentMonth}%`).total;

    const totalMaintenanceCostAllTime = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN actual_cost > 0 THEN actual_cost ELSE estimated_cost END), 0) as total
      FROM maintenance_requests
    `).get().total;

    // Upcoming Lease Expirations (Next 90 days)
    const upcomingExpirations = db.prepare(`
      SELECT 
        l.id as lease_id,
        l.start_date,
        l.end_date,
        l.monthly_rent,
        t.first_name || ' ' || t.last_name as tenant_name,
        t.phone as tenant_phone,
        t.whatsapp as tenant_whatsapp,
        t.email as tenant_email,
        u.unit_number,
        p.name as property_name,
        CAST((julianday(l.end_date) - julianday(?)) AS INTEGER) as days_remaining
      FROM leases l
      JOIN tenants t ON l.tenant_id = t.id
      JOIN units u ON l.unit_id = u.id
      JOIN properties p ON u.property_id = p.id
      WHERE l.status IN ('active', 'expiring_soon', 'expired') AND l.end_date <= date(?, '+90 days')
      ORDER BY l.end_date ASC
      LIMIT 6
    `).all(today, today);

    // Recent Payments
    const recentPayments = db.prepare(`
      SELECT 
        p.id,
        p.amount,
        p.payment_date,
        p.payment_method,
        p.receipt_number,
        t.first_name || ' ' || t.last_name as tenant_name,
        u.unit_number,
        pr.name as property_name
      FROM payments p
      JOIN tenants t ON p.tenant_id = t.id
      JOIN leases l ON p.lease_id = l.id
      JOIN units u ON l.unit_id = u.id
      JOIN properties pr ON u.property_id = pr.id
      ORDER BY p.payment_date DESC, p.created_at DESC
      LIMIT 5
    `).all();

    // Urgent / Open Maintenance
    const urgentTickets = db.prepare(`
      SELECT 
        m.id,
        m.title,
        m.priority,
        m.status,
        m.date_reported,
        m.estimated_cost,
        m.actual_cost,
        p.name as property_name,
        u.unit_number
      FROM maintenance_requests m
      JOIN properties p ON m.property_id = p.id
      LEFT JOIN units u ON m.unit_id = u.id
      WHERE m.status IN ('reported', 'in_progress', 'scheduled')
      ORDER BY 
        CASE m.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        m.date_reported DESC
      LIMIT 5
    `).all();

    res.json({
      properties: {
        total: totalProperties,
        unitsTotal: unitsSummary.total || 0,
        occupiedUnits: unitsSummary.occupied || 0,
        vacantUnits: unitsSummary.vacant || 0,
        maintenanceUnits: unitsSummary.maintenance || 0,
        occupancyRate
      },
      tenants: {
        activeCount: activeTenants,
        activeLeases
      },
      finances: {
        rentChargedMonth,
        rentCollectedMonth,
        collectionRate: rentChargedMonth > 0 ? Math.round((rentCollectedMonth / rentChargedMonth) * 100) : 100,
        totalOutstandingBalance,
        overdueCount: overdueStats.overdue_count,
        overdueAmount: overdueStats.overdue_amount
      },
      maintenance: {
        openTickets: openMaintenance,
        urgentTickets: urgentMaintenance,
        costThisMonth: totalMaintenanceCostMonth,
        costTotal: totalMaintenanceCostAllTime
      },
      upcomingExpirations,
      recentPayments,
      urgentTickets
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// PROPERTIES API
// -------------------------------------------------------------
app.get('/api/properties', (req, res) => {
  try {
    const properties = db.prepare(`
      SELECT 
        p.*,
        COUNT(u.id) as total_units,
        SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END) as occupied_units,
        SUM(CASE WHEN u.status = 'vacant' THEN 1 ELSE 0 END) as vacant_units,
        SUM(CASE WHEN u.status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_units,
        COALESCE(SUM(u.market_rent), 0) as potential_monthly_revenue
      FROM properties p
      LEFT JOIN units u ON p.id = u.property_id
      GROUP BY p.id
      ORDER BY p.name ASC
    `).all();

    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/properties/:id', (req, res) => {
  try {
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const units = db.prepare(`
      SELECT 
        u.*,
        l.id as active_lease_id,
        l.monthly_rent as actual_rent,
        l.start_date as lease_start,
        l.end_date as lease_end,
        t.id as tenant_id,
        t.first_name || ' ' || t.last_name as tenant_name,
        t.email as tenant_email,
        t.phone as tenant_phone
      FROM units u
      LEFT JOIN leases l ON u.id = l.unit_id AND l.status = 'active'
      LEFT JOIN tenants t ON l.tenant_id = t.id
      WHERE u.property_id = ?
      ORDER BY u.unit_number ASC
    `).all(req.params.id);

    const maintenance = db.prepare(`
      SELECT m.*, u.unit_number
      FROM maintenance_requests m
      LEFT JOIN units u ON m.unit_id = u.id
      WHERE m.property_id = ?
      ORDER BY m.date_reported DESC
    `).all(req.params.id);

    res.json({ ...property, units, maintenance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/properties', (req, res) => {
  try {
    const { name, address, city, state, zip_code, property_type, year_built, image_url, description } = req.body;
    if (!name || !address || !city || !state || !zip_code) {
      return res.status(400).json({ error: 'Please provide all required fields (name, address, city, state, zip_code)' });
    }

    const id = `prop-${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO properties (id, name, address, city, state, zip_code, property_type, year_built, image_url, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, address, city, state, zip_code, property_type || 'Apartment Complex', year_built || null, image_url || null, description || null);

    const created = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/properties/:id', (req, res) => {
  try {
    const { name, address, city, state, zip_code, property_type, year_built, image_url, description } = req.body;
    db.prepare(`
      UPDATE properties
      SET name = ?, address = ?, city = ?, state = ?, zip_code = ?, property_type = ?, year_built = ?, image_url = ?, description = ?
      WHERE id = ?
    `).run(name, address, city, state, zip_code, property_type, year_built, image_url, description, req.params.id);

    const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/properties/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// UNITS API
// -------------------------------------------------------------
app.get('/api/units', (req, res) => {
  try {
    let query = `
      SELECT 
        u.*,
        p.name as property_name,
        p.address as property_address,
        l.id as active_lease_id,
        l.monthly_rent as actual_rent,
        l.start_date as lease_start,
        l.end_date as lease_end,
        t.id as tenant_id,
        t.first_name || ' ' || t.last_name as tenant_name,
        t.phone as tenant_phone
      FROM units u
      JOIN properties p ON u.property_id = p.id
      LEFT JOIN leases l ON u.id = l.unit_id AND l.status IN ('active', 'expiring_soon')
      LEFT JOIN tenants t ON l.tenant_id = t.id
    `;
    const params = [];
    const conditions = [];

    if (req.query.property_id) {
      conditions.push('u.property_id = ?');
      params.push(req.query.property_id);
    }
    if (req.query.status) {
      conditions.push('u.status = ?');
      params.push(req.query.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY p.name ASC, u.unit_number ASC';

    const units = db.prepare(query).all(...params);
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/units', (req, res) => {
  try {
    const { property_id, unit_number, floor, bedrooms, bathrooms, square_feet, market_rent, status, features } = req.body;
    if (!property_id || !unit_number || market_rent === undefined) {
      return res.status(400).json({ error: 'Property, unit number, and market rent are required' });
    }

    const id = `unit-${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO units (id, property_id, unit_number, floor, bedrooms, bathrooms, square_feet, market_rent, status, features)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, property_id, unit_number, floor || 1, bedrooms || 1, bathrooms || 1.0, square_feet || null, market_rent, status || 'vacant', features || '');

    const created = db.prepare(`
      SELECT u.*, p.name as property_name 
      FROM units u 
      JOIN properties p ON u.property_id = p.id 
      WHERE u.id = ?
    `).get(id);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/units/:id', (req, res) => {
  try {
    const { property_id, unit_number, floor, bedrooms, bathrooms, square_feet, market_rent, status, features } = req.body;
    db.prepare(`
      UPDATE units
      SET property_id = ?, unit_number = ?, floor = ?, bedrooms = ?, bathrooms = ?, square_feet = ?, market_rent = ?, status = ?, features = ?
      WHERE id = ?
    `).run(property_id, unit_number, floor, bedrooms, bathrooms, square_feet, market_rent, status, features, req.params.id);

    const updated = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/units/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM units WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Unit deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// TENANTS API
// -------------------------------------------------------------
app.get('/api/tenants', (req, res) => {
  try {
    const tenants = db.prepare(`
      SELECT 
        t.*,
        l.id as lease_id,
        l.start_date as lease_start,
        l.end_date as lease_end,
        l.monthly_rent,
        l.status as lease_status,
        u.id as unit_id,
        u.unit_number,
        p.id as property_id,
        p.name as property_name,
        COALESCE((SELECT SUM(amount) FROM charges WHERE tenant_id = t.id), 0) as total_charged,
        COALESCE((SELECT SUM(amount) FROM payments WHERE tenant_id = t.id), 0) as total_paid,
        (COALESCE((SELECT SUM(amount) FROM charges WHERE tenant_id = t.id), 0) - COALESCE((SELECT SUM(amount) FROM payments WHERE tenant_id = t.id), 0)) as balance
      FROM tenants t
      LEFT JOIN leases l ON t.id = l.tenant_id AND l.status IN ('active', 'expiring_soon', 'expired')
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN properties p ON u.property_id = p.id
      ORDER BY t.id ASC
    `).all();

    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tenants/:id', (req, res) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const leases = db.prepare(`
      SELECT l.*, u.unit_number, p.name as property_name
      FROM leases l
      JOIN units u ON l.unit_id = u.id
      JOIN properties p ON u.property_id = p.id
      WHERE l.tenant_id = ?
      ORDER BY l.start_date DESC
    `).all(req.params.id);

    const charges = db.prepare(`
      SELECT * FROM charges WHERE tenant_id = ? ORDER BY due_date DESC
    `).all(req.params.id);

    const payments = db.prepare(`
      SELECT * FROM payments WHERE tenant_id = ? ORDER BY payment_date DESC
    `).all(req.params.id);

    const maintenance = db.prepare(`
      SELECT m.*, u.unit_number, p.name as property_name
      FROM maintenance_requests m
      JOIN properties p ON m.property_id = p.id
      LEFT JOIN units u ON m.unit_id = u.id
      WHERE m.tenant_id = ?
      ORDER BY m.date_reported DESC
    `).all(req.params.id);

    const totalCharged = charges.reduce((acc, c) => acc + c.amount, 0);
    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = totalCharged - totalPaid;

    res.json({
      ...tenant,
      balance,
      totalCharged,
      totalPaid,
      leases,
      charges,
      payments,
      maintenance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tenants', (req, res) => {
  try {
    const { first_name, last_name, email, phone, whatsapp, national_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, employer, monthly_income, status, notes } = req.body;
    if (!first_name || !last_name || !phone) {
      return res.status(400).json({ error: 'First name, last name, and phone are required' });
    }

    const id = `PLH-${Math.floor(100 + Math.random() * 900)}`;
    const finalEmail = email || `${first_name.toLowerCase()}.${last_name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`;

    db.prepare(`
      INSERT INTO tenants (id, first_name, last_name, email, phone, whatsapp, national_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, employer, monthly_income, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, first_name, last_name, finalEmail, phone, whatsapp || phone, national_id || null, emergency_contact_name || null, emergency_contact_phone || null, emergency_contact_relation || null, employer || null, monthly_income || null, status || 'active', notes || null);

    const created = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tenants/:id', (req, res) => {
  try {
    const { first_name, last_name, email, phone, whatsapp, national_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, employer, monthly_income, status, notes } = req.body;
    db.prepare(`
      UPDATE tenants
      SET first_name = ?, last_name = ?, email = ?, phone = ?, whatsapp = ?, national_id = ?, emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relation = ?, employer = ?, monthly_income = ?, status = ?, notes = ?
      WHERE id = ?
    `).run(first_name, last_name, email, phone, whatsapp || phone, national_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, employer, monthly_income, status, notes, req.params.id);

    const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tenants/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tenants WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Tenant deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// LEASES & TENANCY DATES API
// -------------------------------------------------------------
app.get('/api/leases', (req, res) => {
  try {
    const today = getTodayString();
    const leases = db.prepare(`
      SELECT 
        l.*,
        t.first_name || ' ' || t.last_name as tenant_name,
        t.email as tenant_email,
        t.phone as tenant_phone,
        t.whatsapp as tenant_whatsapp,
        u.unit_number,
        u.bedrooms,
        u.bathrooms,
        p.id as property_id,
        p.name as property_name,
        p.address as property_address,
        CAST((julianday(l.end_date) - julianday(?)) AS INTEGER) as days_remaining,
        CASE
          WHEN l.status = 'terminated' THEN 'terminated'
          WHEN l.end_date < ? THEN 'expired'
          WHEN (julianday(l.end_date) - julianday(?)) <= 60 THEN 'expiring_soon'
          WHEN l.start_date > ? THEN 'pending'
          ELSE 'active'
        END as calculated_status
      FROM leases l
      JOIN tenants t ON l.tenant_id = t.id
      JOIN units u ON l.unit_id = u.id
      JOIN properties p ON u.property_id = p.id
      ORDER BY 
        CASE WHEN l.status = 'active' THEN 1 ELSE 2 END,
        l.end_date ASC
    `).all(today, today, today, today);

    res.json(leases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leases', (req, res) => {
  try {
    const { tenant_id, unit_id, start_date, end_date, monthly_rent, security_deposit, duration_months, total_contract_value, rent_due_day, terms, generate_first_month_rent } = req.body;
    if (!tenant_id || !unit_id || !start_date || !end_date || monthly_rent === undefined) {
      return res.status(400).json({ error: 'Tenant, unit, start date, end date, and monthly rent are required' });
    }

    const leaseId = `lease-${uuidv4().substring(0, 8)}`;
    const deposit = security_deposit !== undefined ? Number(security_deposit) : Number(monthly_rent);
    const months = duration_months ? Number(duration_months) : 12;
    const totalContract = total_contract_value ? Number(total_contract_value) : (Number(monthly_rent) * months);

    const transaction = db.transaction(() => {
      // 1. Create lease
      db.prepare(`
        INSERT INTO leases (id, tenant_id, unit_id, start_date, end_date, monthly_rent, security_deposit, duration_months, total_contract_value, rent_due_day, status, terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(leaseId, tenant_id, unit_id, start_date, end_date, monthly_rent, deposit, months, totalContract, rent_due_day || 1, terms || null);

      // 2. Set unit status to occupied
      db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").run(unit_id);

      // 3. Set tenant status to active
      db.prepare("UPDATE tenants SET status = 'active' WHERE id = ?").run(tenant_id);

      // 4. Optionally generate initial rent charge
      if (generate_first_month_rent !== false) {
        const startMonth = start_date.substring(0, 7);
        const chgId = `chg-${uuidv4().substring(0, 8)}`;
        db.prepare(`
          INSERT INTO charges (id, lease_id, tenant_id, charge_type, description, amount, due_date, period_month, status)
          VALUES (?, ?, ?, 'rent', ?, ?, ?, ?, 'unpaid')
        `).run(chgId, leaseId, tenant_id, `Advance Rent (${months} Months)`, totalContract, start_date, startMonth);
      }
    });

    transaction();

    const created = db.prepare(`
      SELECT l.*, t.first_name || ' ' || t.last_name as tenant_name, u.unit_number, p.name as property_name
      FROM leases l
      JOIN tenants t ON l.tenant_id = t.id
      JOIN units u ON l.unit_id = u.id
      JOIN properties p ON u.property_id = p.id
      WHERE l.id = ?
    `).get(leaseId);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/leases/:id', (req, res) => {
  try {
    const { start_date, end_date, monthly_rent, security_deposit, rent_due_day, status, terms } = req.body;
    db.prepare(`
      UPDATE leases
      SET start_date = ?, end_date = ?, monthly_rent = ?, security_deposit = ?, rent_due_day = ?, status = ?, terms = ?
      WHERE id = ?
    `).run(start_date, end_date, monthly_rent, security_deposit, rent_due_day, status, terms, req.params.id);

    const updated = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Terminate lease
app.post('/api/leases/:id/terminate', (req, res) => {
  try {
    const { termination_date, unit_status_after } = req.body;
    const lease = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id);
    if (!lease) return res.status(404).json({ error: 'Lease not found' });

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE leases 
        SET status = 'terminated', end_date = COALESCE(?, end_date) 
        WHERE id = ?
      `).run(termination_date || getTodayString(), req.params.id);

      // Free unit
      db.prepare('UPDATE units SET status = ? WHERE id = ?').run(unit_status_after || 'vacant', lease.unit_id);
    });

    transaction();
    res.json({ success: true, message: 'Lease terminated and unit status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Renew lease
app.post('/api/leases/:id/renew', (req, res) => {
  try {
    const { new_end_date, new_monthly_rent, terms } = req.body;
    const oldLease = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id);
    if (!oldLease) return res.status(404).json({ error: 'Lease not found' });

    const newRent = new_monthly_rent !== undefined ? Number(new_monthly_rent) : oldLease.monthly_rent;
    db.prepare(`
      UPDATE leases
      SET end_date = ?, monthly_rent = ?, status = 'active', terms = COALESCE(?, terms)
      WHERE id = ?
    `).run(new_end_date, newRent, terms, req.params.id);

    const renewed = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id);
    res.json(renewed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// RENT PAYMENTS, CHARGES & BALANCES API
// -------------------------------------------------------------
app.get('/api/finances/balances', (req, res) => {
  try {
    const balances = db.prepare(`
      SELECT 
        t.id as tenant_id,
        t.first_name || ' ' || t.last_name as tenant_name,
        t.email as tenant_email,
        t.phone as tenant_phone,
        l.id as lease_id,
        l.monthly_rent,
        l.status as lease_status,
        u.unit_number,
        p.name as property_name,
        COALESCE(c.total_charged, 0) as total_charged,
        COALESCE(pay.total_paid, 0) as total_paid,
        (COALESCE(c.total_charged, 0) - COALESCE(pay.total_paid, 0)) as balance,
        pay.last_payment_date
      FROM tenants t
      LEFT JOIN leases l ON t.id = l.tenant_id AND l.status IN ('active', 'expiring_soon')
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN properties p ON u.property_id = p.id
      LEFT JOIN (
        SELECT tenant_id, SUM(amount) as total_charged 
        FROM charges 
        GROUP BY tenant_id
      ) c ON t.id = c.tenant_id
      LEFT JOIN (
        SELECT tenant_id, SUM(amount) as total_paid, MAX(payment_date) as last_payment_date 
        FROM payments 
        GROUP BY tenant_id
      ) pay ON t.id = pay.tenant_id
      ORDER BY balance DESC, t.last_name ASC
    `).all();

    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/finances/charges', (req, res) => {
  try {
    const charges = db.prepare(`
      SELECT 
        c.*,
        t.first_name || ' ' || t.last_name as tenant_name,
        u.unit_number,
        p.name as property_name
      FROM charges c
      JOIN tenants t ON c.tenant_id = t.id
      JOIN leases l ON c.lease_id = l.id
      JOIN units u ON l.unit_id = u.id
      JOIN properties p ON u.property_id = p.id
      ORDER BY c.due_date DESC, c.created_at DESC
    `).all();

    res.json(charges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/finances/charges', (req, res) => {
  try {
    const { lease_id, charge_type, description, amount, due_date, period_month } = req.body;
    if (!lease_id || !description || amount === undefined || !due_date) {
      return res.status(400).json({ error: 'Lease, description, amount, and due date are required' });
    }

    const lease = db.prepare('SELECT tenant_id FROM leases WHERE id = ?').get(lease_id);
    if (!lease) return res.status(404).json({ error: 'Lease not found' });

    const id = `chg-${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO charges (id, lease_id, tenant_id, charge_type, description, amount, due_date, period_month, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')
    `).run(id, lease_id, lease.tenant_id, charge_type || 'rent', description, amount, due_date, period_month || due_date.substring(0, 7));

    const created = db.prepare('SELECT * FROM charges WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto generate monthly rent charges for all active leases for a given month
app.post('/api/finances/generate-monthly-charges', (req, res) => {
  try {
    const { month } = req.body; // e.g. "2026-11"
    const targetMonth = month || getTodayString().substring(0, 7);

    const activeLeases = db.prepare("SELECT * FROM leases WHERE status = 'active'").all();
    let generatedCount = 0;

    const transaction = db.transaction(() => {
      activeLeases.forEach(lease => {
        // Check if charge already exists for this lease and month
        const existing = db.prepare(`
          SELECT id FROM charges 
          WHERE lease_id = ? AND period_month = ? AND charge_type = 'rent'
        `).get(lease.id, targetMonth);

        if (!existing) {
          const chgId = `chg-${uuidv4().substring(0, 8)}`;
          const dueDayPadded = String(lease.rent_due_day || 1).padStart(2, '0');
          const dueDate = `${targetMonth}-${dueDayPadded}`;

          db.prepare(`
            INSERT INTO charges (id, lease_id, tenant_id, charge_type, description, amount, due_date, period_month, status)
            VALUES (?, ?, ?, 'rent', ?, ?, ?, ?, 'unpaid')
          `).run(chgId, lease.id, lease.tenant_id, `Rent - ${targetMonth}`, lease.monthly_rent, dueDate, targetMonth);
          generatedCount++;
        }
      });
    });

    transaction();
    res.json({ success: true, generatedCount, month: targetMonth });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/finances/payments', (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT 
        p.*,
        t.first_name || ' ' || t.last_name as tenant_name,
        t.email as tenant_email,
        u.unit_number,
        pr.name as property_name,
        c.description as charge_description
      FROM payments p
      JOIN tenants t ON p.tenant_id = t.id
      JOIN leases l ON p.lease_id = l.id
      JOIN units u ON l.unit_id = u.id
      JOIN properties pr ON u.property_id = pr.id
      LEFT JOIN charges c ON p.charge_id = c.id
      ORDER BY p.payment_date DESC, p.created_at DESC
    `).all();

    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/finances/payments', (req, res) => {
  try {
    const { lease_id, tenant_id, charge_id, amount, payment_date, payment_method, reference_no, notes } = req.body;
    if ((!lease_id && !tenant_id) || amount === undefined || !payment_date) {
      return res.status(400).json({ error: 'Lease or tenant, amount, and payment date are required' });
    }

    let finalLeaseId = lease_id;
    let finalTenantId = tenant_id;

    if (!finalTenantId && finalLeaseId) {
      const lease = db.prepare('SELECT tenant_id FROM leases WHERE id = ?').get(finalLeaseId);
      if (lease) finalTenantId = lease.tenant_id;
    } else if (!finalLeaseId && finalTenantId) {
      const activeLease = db.prepare("SELECT id FROM leases WHERE tenant_id = ? AND status = 'active'").get(finalTenantId);
      if (activeLease) finalLeaseId = activeLease.id;
    }

    if (!finalLeaseId || !finalTenantId) {
      return res.status(400).json({ error: 'Could not associate payment with an active lease and tenant' });
    }

    const payId = `pay-${uuidv4().substring(0, 8)}`;
    const dateCode = payment_date.replace(/-/g, '');
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `REC-${dateCode}-${randCode}`;

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO payments (id, lease_id, tenant_id, charge_id, amount, payment_date, payment_method, reference_no, notes, receipt_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(payId, finalLeaseId, finalTenantId, charge_id || null, Number(amount), payment_date, payment_method || 'bank_transfer', reference_no || null, notes || null, receiptNumber);

      // If tied to charge, update charge status
      if (charge_id) {
        const charge = db.prepare('SELECT amount FROM charges WHERE id = ?').get(charge_id);
        if (charge) {
          const totalPaidForCharge = db.prepare('SELECT SUM(amount) as total FROM payments WHERE charge_id = ?').get(charge_id).total || 0;
          let newStatus = 'unpaid';
          if (totalPaidForCharge >= charge.amount) {
            newStatus = 'paid';
          } else if (totalPaidForCharge > 0) {
            newStatus = 'partial';
          }
          db.prepare('UPDATE charges SET status = ? WHERE id = ?').run(newStatus, charge_id);
        }
      }
    });

    transaction();

    const created = db.prepare(`
      SELECT 
        p.*,
        t.first_name || ' ' || t.last_name as tenant_name,
        u.unit_number,
        pr.name as property_name
      FROM payments p
      JOIN tenants t ON p.tenant_id = t.id
      JOIN leases l ON p.lease_id = l.id
      JOIN units u ON l.unit_id = u.id
      JOIN properties pr ON u.property_id = pr.id
      WHERE p.id = ?
    `).get(payId);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/finances/receipt/:id', (req, res) => {
  try {
    const payment = db.prepare(`
      SELECT 
        p.*,
        t.first_name,
        t.last_name,
        t.email as tenant_email,
        t.phone as tenant_phone,
        u.unit_number,
        pr.name as property_name,
        pr.address as property_address,
        pr.city,
        pr.state,
        pr.zip_code,
        l.monthly_rent
      FROM payments p
      JOIN tenants t ON p.tenant_id = t.id
      JOIN leases l ON p.lease_id = l.id
      JOIN units u ON l.unit_id = u.id
      JOIN properties pr ON u.property_id = pr.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// MAINTENANCE REQUESTS & COSTS API
// -------------------------------------------------------------
app.get('/api/maintenance', (req, res) => {
  try {
    let query = `
      SELECT 
        m.*,
        p.name as property_name,
        u.unit_number,
        t.first_name || ' ' || t.last_name as tenant_name,
        t.phone as tenant_phone
      FROM maintenance_requests m
      JOIN properties p ON m.property_id = p.id
      LEFT JOIN units u ON m.unit_id = u.id
      LEFT JOIN tenants t ON m.tenant_id = t.id
    `;
    const params = [];
    const conditions = [];

    if (req.query.status) {
      conditions.push('m.status = ?');
      params.push(req.query.status);
    }
    if (req.query.priority) {
      conditions.push('m.priority = ?');
      params.push(req.query.priority);
    }
    if (req.query.category) {
      conditions.push('m.category = ?');
      params.push(req.query.category);
    }
    if (req.query.property_id) {
      conditions.push('m.property_id = ?');
      params.push(req.query.property_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY m.date_reported DESC';

    const requests = db.prepare(query).all(...params);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/maintenance', (req, res) => {
  try {
    const { property_id, unit_id, tenant_id, title, description, category, priority, status, estimated_cost, actual_cost, contractor_name, contractor_phone, invoice_ref, date_reported, date_scheduled, date_completed, notes } = req.body;
    if (!property_id || !title || !description) {
      return res.status(400).json({ error: 'Property, title, and description are required' });
    }

    const id = `maint-${uuidv4().substring(0, 8)}`;
    const reportedDate = date_reported || getTodayString();

    db.prepare(`
      INSERT INTO maintenance_requests (
        id, property_id, unit_id, tenant_id, title, description, category, priority,
        status, estimated_cost, actual_cost, contractor_name, contractor_phone,
        invoice_ref, date_reported, date_scheduled, date_completed, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, property_id, unit_id || null, tenant_id || null, title, description,
      category || 'general', priority || 'medium', status || 'reported',
      estimated_cost || 0, actual_cost || 0, contractor_name || null,
      contractor_phone || null, invoice_ref || null, reportedDate,
      date_scheduled || null, date_completed || null, notes || null
    );

    const created = db.prepare(`
      SELECT m.*, p.name as property_name, u.unit_number
      FROM maintenance_requests m
      JOIN properties p ON m.property_id = p.id
      LEFT JOIN units u ON m.unit_id = u.id
      WHERE m.id = ?
    `).get(id);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/maintenance/:id', (req, res) => {
  try {
    const { property_id, unit_id, tenant_id, title, description, category, priority, status, estimated_cost, actual_cost, contractor_name, contractor_phone, invoice_ref, date_reported, date_scheduled, date_completed, notes } = req.body;

    let finalDateCompleted = date_completed;
    if (status === 'completed' && !finalDateCompleted) {
      finalDateCompleted = getTodayString();
    }

    db.prepare(`
      UPDATE maintenance_requests
      SET property_id = ?, unit_id = ?, tenant_id = ?, title = ?, description = ?,
          category = ?, priority = ?, status = ?, estimated_cost = ?, actual_cost = ?,
          contractor_name = ?, contractor_phone = ?, invoice_ref = ?,
          date_reported = ?, date_scheduled = ?, date_completed = ?, notes = ?
      WHERE id = ?
    `).run(
      property_id, unit_id || null, tenant_id || null, title, description,
      category, priority, status, estimated_cost || 0, actual_cost || 0,
      contractor_name || null, contractor_phone || null, invoice_ref || null,
      date_reported, date_scheduled || null, finalDateCompleted, notes || null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/maintenance/:id/status', (req, res) => {
  try {
    const { status, actual_cost, notes } = req.body;
    let completedDate = null;
    if (status === 'completed') {
      completedDate = getTodayString();
    }

    db.prepare(`
      UPDATE maintenance_requests
      SET status = ?, 
          actual_cost = COALESCE(?, actual_cost),
          date_completed = CASE WHEN ? = 'completed' THEN COALESCE(date_completed, ?) ELSE date_completed END,
          notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(status, actual_cost, status, completedDate, notes, req.params.id);

    const updated = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/maintenance/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM maintenance_requests WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Maintenance request deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Maintenance cost analysis
app.get('/api/maintenance-analytics/summary', (req, res) => {
  try {
    const byCategory = db.prepare(`
      SELECT 
        category,
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_requests,
        SUM(actual_cost) as total_actual_cost,
        SUM(estimated_cost) as total_estimated_cost
      FROM maintenance_requests
      GROUP BY category
      ORDER BY total_actual_cost DESC
    `).all();

    const byProperty = db.prepare(`
      SELECT 
        p.id,
        p.name as property_name,
        COUNT(m.id) as total_requests,
        SUM(m.actual_cost) as total_actual_cost,
        SUM(m.estimated_cost) as total_estimated_cost
      FROM properties p
      LEFT JOIN maintenance_requests m ON p.id = m.property_id
      GROUP BY p.id
      ORDER BY total_actual_cost DESC
    `).all();

    res.json({ byCategory, byProperty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// REPORTS & DATA BACKUP
// -------------------------------------------------------------
app.get('/api/reports/cashflow', (req, res) => {
  try {
    // Generate monthly cashflow for past 6 months
    const months = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push(past.toISOString().substring(0, 7));
    }

    const cashflow = months.map(m => {
      const rentCollected = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM payments 
        WHERE payment_date LIKE ?
      `).get(`${m}%`).total;

      const maintenanceCost = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN actual_cost > 0 THEN actual_cost ELSE estimated_cost END), 0) as total
        FROM maintenance_requests
        WHERE (date_completed LIKE ? OR date_reported LIKE ?)
      `).get(`${m}%`, `${m}%`).total;

      return {
        month: m,
        rentIncome: rentCollected,
        maintenanceCost: maintenanceCost,
        netCashflow: rentCollected - maintenanceCost
      };
    });

    res.json(cashflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export all database tables as JSON
app.get('/api/export/backup', (req, res) => {
  try {
    const data = {
      properties: db.prepare('SELECT * FROM properties').all(),
      units: db.prepare('SELECT * FROM units').all(),
      tenants: db.prepare('SELECT * FROM tenants').all(),
      leases: db.prepare('SELECT * FROM leases').all(),
      charges: db.prepare('SELECT * FROM charges').all(),
      payments: db.prepare('SELECT * FROM payments').all(),
      maintenance_requests: db.prepare('SELECT * FROM maintenance_requests').all(),
      exported_at: new Date().toISOString()
    };
    res.setHeader('Content-disposition', 'attachment; filename=rental_manager_backup.json');
    res.setHeader('Content-type', 'application/json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset demo data
app.post('/api/seed/reset', (req, res) => {
  try {
    db.exec(`
      DELETE FROM payments;
      DELETE FROM charges;
      DELETE FROM maintenance_requests;
      DELETE FROM leases;
      DELETE FROM units;
      DELETE FROM tenants;
      DELETE FROM properties;
    `);
    seedDatabase();
    res.json({ success: true, message: 'Database reset to demo state' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// In production, serve Vite client build
const clientDistPath = path.join(__dirname, '..', 'dist');
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.url.startsWith('/api')) {
    return res.sendFile(path.join(clientDistPath, 'index.html'), err => {
      if (err) next();
    });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Facility & Tenant Management Server running on http://localhost:${PORT}`);
});
