const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'rental_manager.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip_code TEXT NOT NULL,
      property_type TEXT NOT NULL DEFAULT 'Apartment Complex',
      year_built INTEGER,
      image_url TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      unit_number TEXT NOT NULL,
      floor INTEGER DEFAULT 1,
      bedrooms INTEGER NOT NULL DEFAULT 1,
      bathrooms REAL NOT NULL DEFAULT 1.0,
      square_feet INTEGER,
      market_rent REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'vacant', -- vacant, occupied, maintenance
      features TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      whatsapp TEXT,
      national_id TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_relation TEXT,
      employer TEXT,
      monthly_income REAL,
      status TEXT NOT NULL DEFAULT 'active', -- active, past, applicant
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leases (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      monthly_rent REAL NOT NULL,
      security_deposit REAL NOT NULL,
      duration_months INTEGER DEFAULT 12,
      total_contract_value REAL,
      rent_due_day INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active', -- active, pending, expired, terminated
      terms TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS charges (
      id TEXT PRIMARY KEY,
      lease_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      charge_type TEXT NOT NULL DEFAULT 'rent', -- rent, deposit, late_fee, utility, maintenance_fee
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      period_month TEXT,
      status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, partial, paid
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      lease_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      charge_id TEXT,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'bank_transfer', -- bank_transfer, credit_card, cash, cheque, online, momo
      reference_no TEXT,
      notes TEXT,
      receipt_number TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (charge_id) REFERENCES charges(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS maintenance_requests (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      unit_id TEXT,
      tenant_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general', -- plumbing, electrical, hvac, appliance, structural, pest_control, general
      priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
      status TEXT NOT NULL DEFAULT 'reported', -- reported, in_progress, scheduled, completed, cancelled
      estimated_cost REAL DEFAULT 0,
      actual_cost REAL DEFAULT 0,
      contractor_name TEXT,
      contractor_phone TEXT,
      invoice_ref TEXT,
      date_reported TEXT NOT NULL,
      date_scheduled TEXT,
      date_completed TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
    );
  `);

  // Safe migrations for existing tables
  try {
    const tenantCols = db.prepare("PRAGMA table_info(tenants)").all().map(c => c.name);
    if (!tenantCols.includes('whatsapp')) {
      db.exec("ALTER TABLE tenants ADD COLUMN whatsapp TEXT");
    }
    const leaseCols = db.prepare("PRAGMA table_info(leases)").all().map(c => c.name);
    if (!leaseCols.includes('duration_months')) {
      db.exec("ALTER TABLE leases ADD COLUMN duration_months INTEGER DEFAULT 12");
    }
    if (!leaseCols.includes('total_contract_value')) {
      db.exec("ALTER TABLE leases ADD COLUMN total_contract_value REAL");
    }
  } catch (e) {
    console.error('Migration note:', e.message);
  }
}

initSchema();

module.exports = db;
