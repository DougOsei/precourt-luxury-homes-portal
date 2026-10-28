require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { seedDatabase } = require('./seed');
const {
  applySecurityHeaders,
  enforceFetchMetadataIsolation,
  checkRateLimit,
  safeErrorResponse,
  formatZodError,
  schemas
} = require('./security');
const {
  getAuthenticatedSession,
  requireAuth,
  handleAuthLoginEndpoint,
  handleAuthLogoutEndpoint,
  handleAuthSessionCheckEndpoint,
  handleAdminManagersEndpoint
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 5050;
const LOCAL_STATE_FILE = path.join(__dirname, 'portal_state.json');
const GIST_FILENAME = 'plh_portal_state.json';

// -------------------------------------------------------------
// PHASE 4 & 5: HTTP SECURITY HEADERS, CORS, PAYLOAD SIZE & RATE LIMITING
// -------------------------------------------------------------
app.disable('x-powered-by');

app.use((req, res, next) => {
  applySecurityHeaders(req, res);
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);

// Enforce 512 KB max JSON body payload to mitigate DoS (Phase 5)
app.use(express.json({ limit: '512kb' }));

// -------------------------------------------------------------
// PHASE 3: AUTHENTICATION & SUPER ADMIN MANAGER PROVISIONING ENDPOINTS
// -------------------------------------------------------------
app.all('/api/auth/login', async (req, res) => {
  await handleAuthLoginEndpoint(req, res);
});

app.all('/api/auth/logout', async (req, res) => {
  await handleAuthLogoutEndpoint(req, res);
});

app.all('/api/auth/session', async (req, res) => {
  await handleAuthSessionCheckEndpoint(req, res);
});

app.all('/api/admin/managers', async (req, res) => {
  await handleAdminManagersEndpoint(req, res);
});

// Fetch Metadata resource isolation, sliding-window rate limiting & RBAC on remaining /api routes
app.use('/api', (req, res, next) => {
  if (!enforceFetchMetadataIsolation(req, res)) return;

  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const allowed = checkRateLimit(req, res, {
    bucket: isMutation ? 'api-write' : 'api-read',
    maxRequests: isMutation ? 60 : 240,
    windowMs: 60_000
  });
  if (!allowed) return;

  if (isMutation) {
    const session = requireAuth(req, res, ['SUPER_ADMIN', 'FACILITY_MANAGER']);
    if (!session) return;
    req.userSession = session;
  } else {
    req.userSession = getAuthenticatedSession(req);
  }

  next();
});

// Express route helpers for Zod validation (Phase 2)
function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: `Validation error: ${formatZodError(parsed.error)}`
      });
    }
    req.validatedBody = parsed.data;
    next();
  };
}

function validateIdParam(req, res, next) {
  const parsed = schemas.IdParamSchema.safeParse(req.params || {});
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: `Invalid route parameter: ${formatZodError(parsed.error)}`
    });
  }
  req.params.id = parsed.data.id;
  next();
}

// -------------------------------------------------------------
// REAL-TIME CROSS-BROWSER & CLOUD PORTAL STATE SYNC
// -------------------------------------------------------------
app.get('/api/portal-state', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const gistId = process.env.PLH_GIST_ID;
  const githubToken = process.env.PLH_GITHUB_TOKEN;

  try {
    let cloudState = null;
    if (gistId) {
      try {
        const headers = {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Precourt-Luxury-Homes-Portal'
        };
        if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
        const gRes = await fetch(`https://api.github.com/gists/${gistId}`, {
          headers,
          cache: 'no-store'
        });
        if (gRes.ok) {
          const gData = await gRes.json();
          const content = gData.files?.[GIST_FILENAME]?.content;
          if (content) cloudState = JSON.parse(content);
        }
      } catch (e) {}
    }

    let localState = null;
    if (fs.existsSync(LOCAL_STATE_FILE)) {
      try {
        localState = JSON.parse(fs.readFileSync(LOCAL_STATE_FILE, 'utf8'));
      } catch (e) {}
    }

    let resolvedState = cloudState || localState;
    if (cloudState && localState) {
      resolvedState =
        (Number(localState.updatedAt) || 0) > (Number(cloudState.updatedAt) || 0)
          ? localState
          : cloudState;
    }

    if (resolvedState) {
      fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(resolvedState, null, 2), 'utf8');
    }

    res.json({
      ok: true,
      source: cloudState ? 'cloud+local' : 'local-disk',
      role: req.userSession?.role || 'property_manager',
      state: resolvedState
    });
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/portal-state');
  }
});

app.put(
  '/api/portal-state',
  validateBody(schemas.PortalStatePayloadSchema),
  async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const gistId = process.env.PLH_GIST_ID;
    const githubToken = process.env.PLH_GITHUB_TOKEN;

    try {
      const valid = req.validatedBody;
      const nextState = {
        tenants: valid.tenants,
        properties: valid.properties,
        settings: valid.settings,
        updatedAt: Number(valid.updatedAt) || Date.now()
      };

      fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(nextState, null, 2), 'utf8');

      let syncedCloud = false;
      if (gistId && githubToken) {
        try {
          const gRes = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${githubToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Precourt-Luxury-Homes-Portal'
            },
            body: JSON.stringify({
              files: {
                [GIST_FILENAME]: {
                  content: JSON.stringify(nextState, null, 2)
                }
              }
            })
          });
          syncedCloud = gRes.ok;
        } catch (e) {}
      }

      res.json({
        ok: true,
        source: syncedCloud ? 'cloud+local' : 'local-disk',
        role: req.userSession?.role || 'property_manager',
        updatedAt: nextState.updatedAt,
        state: nextState
      });
    } catch (err) {
      safeErrorResponse(res, err, 'PUT /api/portal-state');
    }
  }
);

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
    const currentMonth = today.substring(0, 7);

    const totalProperties = db.prepare('SELECT COUNT(*) as count FROM properties').get().count;
    const unitsSummary = db
      .prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
        SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
      FROM units
    `)
      .get();

    const occupancyRate =
      unitsSummary.total > 0 ? Math.round((unitsSummary.occupied / unitsSummary.total) * 100) : 0;

    const activeTenants = db
      .prepare("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'")
      .get().count;

    const activeLeases = db
      .prepare("SELECT COUNT(*) as count FROM leases WHERE status IN ('active', 'expiring_soon', 'expired')")
      .get().count;

    const rentChargedMonth = db
      .prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM charges 
      WHERE (period_month = ? OR due_date LIKE ?) AND charge_type = 'rent'
    `)
      .get(currentMonth, `${currentMonth}%`).total;

    const rentCollectedMonth = db
      .prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM payments 
      WHERE payment_date LIKE ?
    `)
      .get(`${currentMonth}%`).total;

    const totalChargesAllTime = db
      .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM charges')
      .get().total;
    const totalPaymentsAllTime = db
      .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments')
      .get().total;
    const totalOutstandingBalance = Math.max(0, totalChargesAllTime - totalPaymentsAllTime);

    const overdueStats = db
      .prepare(`
      SELECT 
        COUNT(*) as overdue_count,
        COALESCE(SUM(amount), 0) as overdue_amount
      FROM charges
      WHERE due_date < ? AND status != 'paid'
    `)
      .get(today);

    const openMaintenance = db
      .prepare(`
      SELECT COUNT(*) as count 
      FROM maintenance_requests 
      WHERE status IN ('reported', 'in_progress', 'scheduled')
    `)
      .get().count;

    const urgentMaintenance = db
      .prepare(`
      SELECT COUNT(*) as count 
      FROM maintenance_requests 
      WHERE priority = 'urgent' AND status != 'completed' AND status != 'cancelled'
    `)
      .get().count;

    const totalMaintenanceCostMonth = db
      .prepare(`
      SELECT COALESCE(SUM(CASE WHEN actual_cost > 0 THEN actual_cost ELSE estimated_cost END), 0) as total
      FROM maintenance_requests
      WHERE date_reported LIKE ? OR date_completed LIKE ?
    `)
      .get(`${currentMonth}%`, `${currentMonth}%`).total;

    const totalMaintenanceCostAllTime = db
      .prepare(`
      SELECT COALESCE(SUM(CASE WHEN actual_cost > 0 THEN actual_cost ELSE estimated_cost END), 0) as total
      FROM maintenance_requests
    `)
      .get().total;

    const upcomingExpirations = db
      .prepare(`
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
    `)
      .all(today, today);

    const recentPayments = db
      .prepare(`
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
    `)
      .all();

    const urgentTickets = db
      .prepare(`
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
    `)
      .all();

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
        collectionRate:
          rentChargedMonth > 0 ? Math.round((rentCollectedMonth / rentChargedMonth) * 100) : 100,
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
    safeErrorResponse(res, err, 'GET /api/dashboard/stats');
  }
});

// -------------------------------------------------------------
// PROPERTIES API
// -------------------------------------------------------------
app.get('/api/properties', (req, res) => {
  try {
    const properties = db
      .prepare(`
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
    `)
      .all();

    res.json(properties);
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/properties');
  }
});

app.get('/api/properties/:id', validateIdParam, (req, res) => {
  try {
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const units = db
      .prepare(`
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
    `)
      .all(req.params.id);

    const maintenance = db
      .prepare(`
      SELECT m.*, u.unit_number
      FROM maintenance_requests m
      LEFT JOIN units u ON m.unit_id = u.id
      WHERE m.property_id = ?
      ORDER BY m.date_reported DESC
    `)
      .all(req.params.id);

    res.json({ ...property, units, maintenance });
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/properties/:id');
  }
});

app.post('/api/properties', validateBody(schemas.SqlPropertySchema), (req, res) => {
  try {
    const {
      name,
      address,
      city,
      state,
      zip_code,
      property_type,
      year_built,
      image_url,
      description
    } = req.validatedBody;

    const id = `prop-${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO properties (id, name, address, city, state, zip_code, property_type, year_built, image_url, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      address,
      city,
      state,
      zip_code,
      property_type || 'Apartment Complex',
      year_built || null,
      image_url || null,
      description || null
    );

    const created = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (err) {
    safeErrorResponse(res, err, 'POST /api/properties');
  }
});

app.put(
  '/api/properties/:id',
  validateIdParam,
  validateBody(schemas.SqlPropertySchema),
  (req, res) => {
    try {
      const {
        name,
        address,
        city,
        state,
        zip_code,
        property_type,
        year_built,
        image_url,
        description
      } = req.validatedBody;
      db.prepare(`
      UPDATE properties
      SET name = ?, address = ?, city = ?, state = ?, zip_code = ?, property_type = ?, year_built = ?, image_url = ?, description = ?
      WHERE id = ?
    `).run(
        name,
        address,
        city,
        state,
        zip_code,
        property_type || 'Apartment Complex',
        year_built || null,
        image_url || null,
        description || null,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (err) {
      safeErrorResponse(res, err, 'PUT /api/properties/:id');
    }
  }
);

app.delete('/api/properties/:id', validateIdParam, (req, res) => {
  try {
    db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Property deleted' });
  } catch (err) {
    safeErrorResponse(res, err, 'DELETE /api/properties/:id');
  }
});

// -------------------------------------------------------------
// UNITS API
// -------------------------------------------------------------
app.get('/api/units', (req, res) => {
  try {
    const queryCheck = schemas.SqlUnitQuerySchema.safeParse(req.query || {});
    if (!queryCheck.success) {
      return res.status(400).json({ ok: false, error: formatZodError(queryCheck.error) });
    }
    const validQuery = queryCheck.data;

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

    if (validQuery.property_id) {
      conditions.push('u.property_id = ?');
      params.push(validQuery.property_id);
    }
    if (validQuery.status) {
      conditions.push('u.status = ?');
      params.push(validQuery.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY p.name ASC, u.unit_number ASC';

    const units = db.prepare(query).all(...params);
    res.json(units);
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/units');
  }
});

app.post('/api/units', validateBody(schemas.SqlUnitSchema), (req, res) => {
  try {
    const {
      property_id,
      unit_number,
      floor,
      bedrooms,
      bathrooms,
      square_feet,
      market_rent,
      status,
      features
    } = req.validatedBody;

    const id = `unit-${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO units (id, property_id, unit_number, floor, bedrooms, bathrooms, square_feet, market_rent, status, features)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      property_id,
      unit_number,
      floor || 1,
      bedrooms || 1,
      bathrooms || 1.0,
      square_feet || null,
      market_rent,
      status || 'vacant',
      features || ''
    );

    const created = db
      .prepare(`
      SELECT u.*, p.name as property_name 
      FROM units u 
      JOIN properties p ON u.property_id = p.id 
      WHERE u.id = ?
    `)
      .get(id);

    res.status(201).json(created);
  } catch (err) {
    safeErrorResponse(res, err, 'POST /api/units');
  }
});

app.put('/api/units/:id', validateIdParam, validateBody(schemas.SqlUnitSchema), (req, res) => {
  try {
    const {
      property_id,
      unit_number,
      floor,
      bedrooms,
      bathrooms,
      square_feet,
      market_rent,
      status,
      features
    } = req.validatedBody;
    db.prepare(`
      UPDATE units
      SET property_id = ?, unit_number = ?, floor = ?, bedrooms = ?, bathrooms = ?, square_feet = ?, market_rent = ?, status = ?, features = ?
      WHERE id = ?
    `).run(
      property_id,
      unit_number,
      floor,
      bedrooms,
      bathrooms,
      square_feet,
      market_rent,
      status,
      features,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    safeErrorResponse(res, err, 'PUT /api/units/:id');
  }
});

app.delete('/api/units/:id', validateIdParam, (req, res) => {
  try {
    db.prepare('DELETE FROM units WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Unit deleted' });
  } catch (err) {
    safeErrorResponse(res, err, 'DELETE /api/units/:id');
  }
});

// -------------------------------------------------------------
// TENANTS API
// -------------------------------------------------------------
app.get('/api/tenants', (req, res) => {
  try {
    const tenants = db
      .prepare(`
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
    `)
      .all();

    res.json(tenants);
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/tenants');
  }
});

app.get('/api/tenants/:id', validateIdParam, (req, res) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const leases = db
      .prepare(`
      SELECT l.*, u.unit_number, p.name as property_name
      FROM leases l
      JOIN units u ON l.unit_id = u.id
      JOIN properties p ON u.property_id = p.id
      WHERE l.tenant_id = ?
      ORDER BY l.start_date DESC
    `)
      .all(req.params.id);

    const charges = db
      .prepare(`
      SELECT * FROM charges WHERE tenant_id = ? ORDER BY due_date DESC
    `)
      .all(req.params.id);

    const payments = db
      .prepare(`
      SELECT * FROM payments WHERE tenant_id = ? ORDER BY payment_date DESC
    `)
      .all(req.params.id);

    const maintenance = db
      .prepare(`
      SELECT m.*, u.unit_number, p.name as property_name
      FROM maintenance_requests m
      JOIN properties p ON m.property_id = p.id
      LEFT JOIN units u ON m.unit_id = u.id
      WHERE m.tenant_id = ?
      ORDER BY m.date_reported DESC
    `)
      .all(req.params.id);

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
    safeErrorResponse(res, err, 'GET /api/tenants/:id');
  }
});

app.post('/api/tenants', validateBody(schemas.SqlTenantSchema), (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      whatsapp,
      national_id,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relation,
      employer,
      monthly_income,
      status,
      notes
    } = req.validatedBody;

    const id = `PLH-${Math.floor(100 + Math.random() * 900)}`;
    const finalEmail =
      email ||
      `${first_name.toLowerCase()}.${last_name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`;

    db.prepare(`
      INSERT INTO tenants (id, first_name, last_name, email, phone, whatsapp, national_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, employer, monthly_income, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      first_name,
      last_name,
      finalEmail,
      phone,
      whatsapp || phone,
      national_id || null,
      emergency_contact_name || null,
      emergency_contact_phone || null,
      emergency_contact_relation || null,
      employer || null,
      monthly_income || null,
      status || 'active',
      notes || null
    );

    const created = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (err) {
    safeErrorResponse(res, err, 'POST /api/tenants');
  }
});

app.put(
  '/api/tenants/:id',
  validateIdParam,
  validateBody(schemas.SqlTenantSchema),
  (req, res) => {
    try {
      const {
        first_name,
        last_name,
        email,
        phone,
        whatsapp,
        national_id,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relation,
        employer,
        monthly_income,
        status,
        notes
      } = req.validatedBody;
      db.prepare(`
      UPDATE tenants
      SET first_name = ?, last_name = ?, email = ?, phone = ?, whatsapp = ?, national_id = ?, emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relation = ?, employer = ?, monthly_income = ?, status = ?, notes = ?
      WHERE id = ?
    `).run(
        first_name,
        last_name,
        email,
        phone,
        whatsapp || phone,
        national_id,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relation,
        employer,
        monthly_income,
        status,
        notes,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (err) {
      safeErrorResponse(res, err, 'PUT /api/tenants/:id');
    }
  }
);

app.delete('/api/tenants/:id', validateIdParam, (req, res) => {
  try {
    db.prepare('DELETE FROM tenants WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Tenant deleted' });
  } catch (err) {
    safeErrorResponse(res, err, 'DELETE /api/tenants/:id');
  }
});

// -------------------------------------------------------------
// LEASES & TENANCY DATES API
// -------------------------------------------------------------
app.get('/api/leases', (req, res) => {
  try {
    const today = getTodayString();
    const leases = db
      .prepare(`
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
          WHEN (julianday(l.end_date) - julianday(?)) <= 90 THEN 'expiring_soon'
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
    `)
      .all(today, today, today, today);

    res.json(leases);
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/leases');
  }
});

app.post('/api/leases', validateBody(schemas.SqlLeaseCreateSchema), (req, res) => {
  try {
    const {
      tenant_id,
      unit_id,
      start_date,
      end_date,
      monthly_rent,
      security_deposit,
      duration_months,
      total_contract_value,
      rent_due_day,
      terms,
      generate_first_month_rent
    } = req.validatedBody;

    const leaseId = `lease-${uuidv4().substring(0, 8)}`;
    const deposit =
      security_deposit !== undefined ? Number(security_deposit) : Number(monthly_rent);
    const months = duration_months ? Number(duration_months) : 12;
    const totalContract = total_contract_value
      ? Number(total_contract_value)
      : Number(monthly_rent) * months;

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO leases (id, tenant_id, unit_id, start_date, end_date, monthly_rent, security_deposit, duration_months, total_contract_value, rent_due_day, status, terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(
        leaseId,
        tenant_id,
        unit_id,
        start_date,
        end_date,
        monthly_rent,
        deposit,
        months,
        totalContract,
        rent_due_day || 1,
        terms || null
      );

      db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").run(unit_id);
      db.prepare("UPDATE tenants SET status = 'active' WHERE id = ?").run(tenant_id);

      if (generate_first_month_rent !== false) {
        const startMonth = start_date.substring(0, 7);
        const chgId = `chg-${uuidv4().substring(0, 8)}`;
        db.prepare(`
          INSERT INTO charges (id, lease_id, tenant_id, charge_type, description, amount, due_date, period_month, status)
          VALUES (?, ?, ?, 'rent', ?, ?, ?, ?, 'unpaid')
        `).run(
          chgId,
          leaseId,
          tenant_id,
          `Advance Rent (${months} Months)`,
          totalContract,
          start_date,
          startMonth
        );
      }
    });

    transaction();

    const created = db
      .prepare(`
      SELECT l.*, t.first_name || ' ' || t.last_name as tenant_name, u.unit_number, p.name as property_name
      FROM leases l
      JOIN tenants t ON l.tenant_id = t.id
      JOIN units u ON l.unit_id = u.id
      JOIN properties p ON u.property_id = p.id
      WHERE l.id = ?
    `)
      .get(leaseId);

    res.status(201).json(created);
  } catch (err) {
    safeErrorResponse(res, err, 'POST /api/leases');
  }
});

app.put(
  '/api/leases/:id',
  validateIdParam,
  validateBody(schemas.SqlLeaseUpdateSchema),
  (req, res) => {
    try {
      const {
        start_date,
        end_date,
        monthly_rent,
        security_deposit,
        rent_due_day,
        status,
        terms
      } = req.validatedBody;
      db.prepare(`
      UPDATE leases
      SET start_date = ?, end_date = ?, monthly_rent = ?, security_deposit = ?, rent_due_day = ?, status = ?, terms = ?
      WHERE id = ?
    `).run(
        start_date,
        end_date,
        monthly_rent,
        security_deposit,
        rent_due_day,
        status,
        terms,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (err) {
      safeErrorResponse(res, err, 'PUT /api/leases/:id');
    }
  }
);

app.post(
  '/api/leases/:id/terminate',
  validateIdParam,
  validateBody(schemas.SqlLeaseTerminateSchema),
  (req, res) => {
    try {
      const { termination_date, unit_status_after } = req.validatedBody;
      const lease = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id);
      if (!lease) return res.status(404).json({ error: 'Lease not found' });

      const transaction = db.transaction(() => {
        db.prepare(`
        UPDATE leases 
        SET status = 'terminated', end_date = COALESCE(?, end_date) 
        WHERE id = ?
      `).run(termination_date || getTodayString(), req.params.id);

        db.prepare('UPDATE units SET status = ? WHERE id = ?').run(
          unit_status_after || 'vacant',
          lease.unit_id
        );
      });

      transaction();
      res.json({ success: true, message: 'Lease terminated and unit status updated' });
    } catch (err) {
      safeErrorResponse(res, err, 'POST /api/leases/:id/terminate');
    }
  }
);

app.post(
  '/api/leases/:id/renew',
  validateIdParam,
  validateBody(schemas.SqlLeaseRenewSchema),
  (req, res) => {
    try {
      const { new_end_date, new_monthly_rent, terms } = req.validatedBody;
      const oldLease = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id);
      if (!oldLease) return res.status(404).json({ error: 'Lease not found' });

      const newRent =
        new_monthly_rent !== undefined ? Number(new_monthly_rent) : oldLease.monthly_rent;

      db.prepare(`
      UPDATE leases
      SET end_date = ?, monthly_rent = ?, status = 'active', terms = COALESCE(?, terms)
      WHERE id = ?
    `).run(new_end_date, newRent, terms, req.params.id);

      const renewed = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id);
      res.json(renewed);
    } catch (err) {
      safeErrorResponse(res, err, 'POST /api/leases/:id/renew');
    }
  }
);

// -------------------------------------------------------------
// RENT PAYMENTS, CHARGES & BALANCES API
// -------------------------------------------------------------
app.get('/api/finances/balances', (req, res) => {
  try {
    const balances = db
      .prepare(`
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
    `)
      .all();

    res.json(balances);
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/finances/balances');
  }
});

app.get('/api/finances/charges', (req, res) => {
  try {
    const charges = db
      .prepare(`
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
    `)
      .all();

    res.json(charges);
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/finances/charges');
  }
});

app.post(
  '/api/finances/charges',
  validateBody(schemas.SqlChargeCreateSchema),
  (req, res) => {
    try {
      const { lease_id, charge_type, description, amount, due_date, period_month } =
        req.validatedBody;

      const lease = db.prepare('SELECT tenant_id FROM leases WHERE id = ?').get(lease_id);
      if (!lease) return res.status(404).json({ error: 'Lease not found' });

      const id = `chg-${uuidv4().substring(0, 8)}`;
      db.prepare(`
      INSERT INTO charges (id, lease_id, tenant_id, charge_type, description, amount, due_date, period_month, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')
    `).run(
        id,
        lease_id,
        lease.tenant_id,
        charge_type || 'rent',
        description,
        amount,
        due_date,
        period_month || due_date.substring(0, 7)
      );

      const created = db.prepare('SELECT * FROM charges WHERE id = ?').get(id);
      res.status(201).json(created);
    } catch (err) {
      safeErrorResponse(res, err, 'POST /api/finances/charges');
    }
  }
);

app.post(
  '/api/finances/generate-monthly-charges',
  validateBody(schemas.SqlGenerateChargesSchema),
  (req, res) => {
    try {
      const { month } = req.validatedBody;
      const targetMonth = month || getTodayString().substring(0, 7);

      const activeLeases = db.prepare("SELECT * FROM leases WHERE status = 'active'").all();
      let generatedCount = 0;

      const transaction = db.transaction(() => {
        activeLeases.forEach((lease) => {
          const existing = db
            .prepare(`
          SELECT id FROM charges 
          WHERE lease_id = ? AND period_month = ? AND charge_type = 'rent'
        `)
            .get(lease.id, targetMonth);

          if (!existing) {
            const chgId = `chg-${uuidv4().substring(0, 8)}`;
            const dueDayPadded = String(lease.rent_due_day || 1).padStart(2, '0');
            const dueDate = `${targetMonth}-${dueDayPadded}`;

            db.prepare(`
            INSERT INTO charges (id, lease_id, tenant_id, charge_type, description, amount, due_date, period_month, status)
            VALUES (?, ?, ?, 'rent', ?, ?, ?, ?, 'unpaid')
          `).run(
              chgId,
              lease.id,
              lease.tenant_id,
              `Rent - ${targetMonth}`,
              lease.monthly_rent,
              dueDate,
              targetMonth
            );
            generatedCount++;
          }
        });
      });

      transaction();
      res.json({ success: true, generatedCount, month: targetMonth });
    } catch (err) {
      safeErrorResponse(res, err, 'POST /api/finances/generate-monthly-charges');
    }
  }
);

app.get('/api/finances/payments', (req, res) => {
  try {
    const payments = db
      .prepare(`
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
    `)
      .all();

    res.json(payments);
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/finances/payments');
  }
});

app.post(
  '/api/finances/payments',
  validateBody(schemas.SqlPaymentCreateSchema),
  (req, res) => {
    try {
      const {
        lease_id,
        tenant_id,
        charge_id,
        amount,
        payment_date,
        payment_method,
        reference_no,
        notes
      } = req.validatedBody;
      if (!lease_id && !tenant_id) {
        return res.status(400).json({ error: 'Lease or tenant is required' });
      }

      let finalLeaseId = lease_id;
      let finalTenantId = tenant_id;

      if (!finalTenantId && finalLeaseId) {
        const lease = db.prepare('SELECT tenant_id FROM leases WHERE id = ?').get(finalLeaseId);
        if (lease) finalTenantId = lease.tenant_id;
      } else if (!finalLeaseId && finalTenantId) {
        const activeLease = db
          .prepare("SELECT id FROM leases WHERE tenant_id = ? AND status = 'active'")
          .get(finalTenantId);
        if (activeLease) finalLeaseId = activeLease.id;
      }

      if (!finalLeaseId || !finalTenantId) {
        return res
          .status(400)
          .json({ error: 'Could not associate payment with an active lease and tenant' });
      }

      const payId = `pay-${uuidv4().substring(0, 8)}`;
      const dateCode = payment_date.replace(/-/g, '');
      const randCode = Math.floor(1000 + Math.random() * 9000);
      const receiptNumber = `REC-${dateCode}-${randCode}`;

      const transaction = db.transaction(() => {
        db.prepare(`
        INSERT INTO payments (id, lease_id, tenant_id, charge_id, amount, payment_date, payment_method, reference_no, notes, receipt_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
          payId,
          finalLeaseId,
          finalTenantId,
          charge_id || null,
          Number(amount),
          payment_date,
          payment_method || 'bank_transfer',
          reference_no || null,
          notes || null,
          receiptNumber
        );

        if (charge_id) {
          const charge = db.prepare('SELECT amount FROM charges WHERE id = ?').get(charge_id);
          if (charge) {
            const totalPaidForCharge =
              db
                .prepare('SELECT SUM(amount) as total FROM payments WHERE charge_id = ?')
                .get(charge_id).total || 0;
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

      const created = db
        .prepare(`
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
    `)
        .get(payId);

      res.status(201).json(created);
    } catch (err) {
      safeErrorResponse(res, err, 'POST /api/finances/payments');
    }
  }
);

app.get('/api/finances/receipt/:id', validateIdParam, (req, res) => {
  try {
    const payment = db
      .prepare(`
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
    `)
      .get(req.params.id);

    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/finances/receipt/:id');
  }
});

// -------------------------------------------------------------
// MAINTENANCE REQUESTS & COSTS API
// -------------------------------------------------------------
app.get('/api/maintenance', (req, res) => {
  try {
    const queryCheck = schemas.SqlMaintenanceQuerySchema.safeParse(req.query || {});
    if (!queryCheck.success) {
      return res.status(400).json({ ok: false, error: formatZodError(queryCheck.error) });
    }
    const validQuery = queryCheck.data;

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

    if (validQuery.status) {
      conditions.push('m.status = ?');
      params.push(validQuery.status);
    }
    if (validQuery.priority) {
      conditions.push('m.priority = ?');
      params.push(validQuery.priority);
    }
    if (validQuery.category) {
      conditions.push('m.category = ?');
      params.push(validQuery.category);
    }
    if (validQuery.property_id) {
      conditions.push('m.property_id = ?');
      params.push(validQuery.property_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY m.date_reported DESC';

    const requests = db.prepare(query).all(...params);
    res.json(requests);
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/maintenance');
  }
});

app.post(
  '/api/maintenance',
  validateBody(schemas.SqlMaintenanceCreateSchema),
  (req, res) => {
    try {
      const {
        property_id,
        unit_id,
        tenant_id,
        title,
        description,
        category,
        priority,
        status,
        estimated_cost,
        actual_cost,
        contractor_name,
        contractor_phone,
        invoice_ref,
        date_reported,
        date_scheduled,
        date_completed,
        notes
      } = req.validatedBody;

      const id = `maint-${uuidv4().substring(0, 8)}`;
      const reportedDate = date_reported || getTodayString();

      db.prepare(`
      INSERT INTO maintenance_requests (
        id, property_id, unit_id, tenant_id, title, description, category, priority,
        status, estimated_cost, actual_cost, contractor_name, contractor_phone,
        invoice_ref, date_reported, date_scheduled, date_completed, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        property_id,
        unit_id || null,
        tenant_id || null,
        title,
        description,
        category || 'general',
        priority || 'medium',
        status || 'reported',
        estimated_cost || 0,
        actual_cost || 0,
        contractor_name || null,
        contractor_phone || null,
        invoice_ref || null,
        reportedDate,
        date_scheduled || null,
        date_completed || null,
        notes || null
      );

      const created = db
        .prepare(`
      SELECT m.*, p.name as property_name, u.unit_number
      FROM maintenance_requests m
      JOIN properties p ON m.property_id = p.id
      LEFT JOIN units u ON m.unit_id = u.id
      WHERE m.id = ?
    `)
        .get(id);

      res.status(201).json(created);
    } catch (err) {
      safeErrorResponse(res, err, 'POST /api/maintenance');
    }
  }
);

app.put(
  '/api/maintenance/:id',
  validateIdParam,
  validateBody(schemas.SqlMaintenanceCreateSchema),
  (req, res) => {
    try {
      const {
        property_id,
        unit_id,
        tenant_id,
        title,
        description,
        category,
        priority,
        status,
        estimated_cost,
        actual_cost,
        contractor_name,
        contractor_phone,
        invoice_ref,
        date_reported,
        date_scheduled,
        date_completed,
        notes
      } = req.validatedBody;

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
        property_id,
        unit_id || null,
        tenant_id || null,
        title,
        description,
        category,
        priority,
        status,
        estimated_cost || 0,
        actual_cost || 0,
        contractor_name || null,
        contractor_phone || null,
        invoice_ref || null,
        date_reported || getTodayString(),
        date_scheduled || null,
        finalDateCompleted,
        notes || null,
        req.params.id
      );

      const updated = db
        .prepare('SELECT * FROM maintenance_requests WHERE id = ?')
        .get(req.params.id);
      res.json(updated);
    } catch (err) {
      safeErrorResponse(res, err, 'PUT /api/maintenance/:id');
    }
  }
);

app.patch(
  '/api/maintenance/:id/status',
  validateIdParam,
  validateBody(schemas.SqlMaintenanceStatusSchema),
  (req, res) => {
    try {
      const { status, actual_cost, notes } = req.validatedBody;
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
    `).run(status, actual_cost ?? null, status, completedDate, notes, req.params.id);

      const updated = db
        .prepare('SELECT * FROM maintenance_requests WHERE id = ?')
        .get(req.params.id);
      res.json(updated);
    } catch (err) {
      safeErrorResponse(res, err, 'PATCH /api/maintenance/:id/status');
    }
  }
);

app.delete('/api/maintenance/:id', validateIdParam, (req, res) => {
  try {
    db.prepare('DELETE FROM maintenance_requests WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Maintenance request deleted' });
  } catch (err) {
    safeErrorResponse(res, err, 'DELETE /api/maintenance/:id');
  }
});

app.get('/api/maintenance-analytics/summary', (req, res) => {
  try {
    const byCategory = db
      .prepare(`
      SELECT 
        category,
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_requests,
        SUM(actual_cost) as total_actual_cost,
        SUM(estimated_cost) as total_estimated_cost
      FROM maintenance_requests
      GROUP BY category
      ORDER BY total_actual_cost DESC
    `)
      .all();

    const byProperty = db
      .prepare(`
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
    `)
      .all();

    res.json({ byCategory, byProperty });
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/maintenance-analytics/summary');
  }
});

// -------------------------------------------------------------
// REPORTS & DATA BACKUP
// -------------------------------------------------------------
app.get('/api/reports/cashflow', (req, res) => {
  try {
    const months = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push(past.toISOString().substring(0, 7));
    }

    const cashflow = months.map((m) => {
      const rentCollected = db
        .prepare(`
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM payments 
        WHERE payment_date LIKE ?
      `)
        .get(`${m}%`).total;

      const maintenanceCost = db
        .prepare(`
        SELECT COALESCE(SUM(CASE WHEN actual_cost > 0 THEN actual_cost ELSE estimated_cost END), 0) as total
        FROM maintenance_requests
        WHERE (date_completed LIKE ? OR date_reported LIKE ?)
      `)
        .get(`${m}%`, `${m}%`).total;

      return {
        month: m,
        rentIncome: rentCollected,
        maintenanceCost: maintenanceCost,
        netCashflow: rentCollected - maintenanceCost
      };
    });

    res.json(cashflow);
  } catch (err) {
    safeErrorResponse(res, err, 'GET /api/reports/cashflow');
  }
});

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
    safeErrorResponse(res, err, 'GET /api/export/backup');
  }
});

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
    safeErrorResponse(res, err, 'POST /api/seed/reset');
  }
});

// In production, serve Vite client build with Route Protection Middleware
const clientDistPath = path.join(__dirname, '..', 'dist');
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.url.startsWith('/api')) {
    const urlPath = req.path || '/';
    const session = getAuthenticatedSession(req);

    // 1. Redirect authenticated users away from /login directly to their dashboard
    if (urlPath === '/login' && session) {
      return res.redirect(302, '/dashboard');
    }

    // 2. Guard protected routes (/dashboard, /properties, /tenants, /leases, /finances, /settings, /admin/*)
    const isProtectedRoute =
      urlPath.startsWith('/dashboard') ||
      urlPath.startsWith('/properties') ||
      urlPath.startsWith('/tenants') ||
      urlPath.startsWith('/leases') ||
      urlPath.startsWith('/finances') ||
      urlPath.startsWith('/settings') ||
      urlPath.startsWith('/admin');

    if (isProtectedRoute && !session) {
      return res.redirect(302, `/login?callbackUrl=${encodeURIComponent(req.originalUrl || urlPath)}`);
    }

    // 3. Prevent FACILITY_MANAGER users from accessing /admin/* management routes
    if (urlPath.startsWith('/admin') && session && session.role !== 'SUPER_ADMIN') {
      return res.redirect(302, '/dashboard');
    }

    return res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) next();
    });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Facility & Tenant Management Server running on http://localhost:${PORT}`);
});
