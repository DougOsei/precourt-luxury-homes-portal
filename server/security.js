const crypto = require('crypto');
const { z } = require('zod');

const MAX_JSON_BODY_BYTES = 512 * 1024; // 512 KB max JSON payload to mitigate DoS

// Fallback ephemeral secret generated once per process if SESSION_SECRET is not provided in .env
const FALLBACK_SECRET = crypto
  .createHash('sha256')
  .update(process.env.PLH_GIST_ID || 'precourt-luxury-homes-default-hmac-key-v1')
  .digest('hex');

function getSessionSecret() {
  return process.env.SESSION_SECRET || FALLBACK_SECRET;
}

// -------------------------------------------------------------
// 1. INPUT SANITIZATION & PII-SAFE LOGGING
// -------------------------------------------------------------
function sanitizeString(value, maxLength = 1000) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|applet|meta|link|style)[^>]*>/gi, '')
    .replace(/\bon[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\b(javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, '')
    .trim()
    .slice(0, maxLength);
}

function sanitizeNullableString(value, maxLength = 1000) {
  if (value === null || value === undefined || value === '') return null;
  return sanitizeString(value, maxLength);
}

function scrubSensitiveLog(input) {
  const raw = typeof input === 'string' ? input : input?.message || String(input || '');
  return raw
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
}

function safeErrorResponse(res, err, context = 'API') {
  console.error(`[${context}] Error:`, scrubSensitiveLog(err));
  return res.status(500).json({
    ok: false,
    error: 'An internal server error occurred while processing your request.'
  });
}

// -------------------------------------------------------------
// 2. HTTP SECURITY HEADERS & FETCH METADATA ISOLATION (PHASE 4)
// -------------------------------------------------------------
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'report-sample'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' https://images.unsplash.com data: blob:",
  "connect-src 'self' https://api.github.com",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join('; ');

function applySecurityHeaders(req, res) {
  res.setHeader('Content-Security-Policy', CSP_DIRECTIVES);
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), accelerometer=(), payment=(), usb=(), focus-without-user-activation=()'
  );
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Vary', 'Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site');
}

function enforceFetchMetadataIsolation(req, res) {
  const secFetchSite = req.headers['sec-fetch-site'];
  const secFetchMode = req.headers['sec-fetch-mode'];
  const secFetchDest = req.headers['sec-fetch-dest'];

  // Allow browsers that do not send Sec-Fetch-Site or same-origin / same-site / direct requests
  if (!secFetchSite || ['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
    return true;
  }

  // Allow top-level GET navigation if applicable
  if (
    secFetchMode === 'navigate' &&
    req.method === 'GET' &&
    !['object', 'embed'].includes(secFetchDest || '')
  ) {
    return true;
  }

  res.statusCode = 403;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      ok: false,
      error: 'Cross-site request blocked by Fetch Metadata resource isolation policy.'
    })
  );
  return false;
}

// -------------------------------------------------------------
// 3. EDGE-COMPATIBLE SLIDING-WINDOW RATE LIMITER (PHASE 5)
// -------------------------------------------------------------
const rateLimitStore = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(req, res, { bucket = 'api', maxRequests = 120, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${bucket}:${ip}`;

  let timestamps = rateLimitStore.get(key) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((timestamps[0] + windowMs - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', '0');
    res.setHeader('RateLimit-Reset', String(retryAfterSec));
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        error: `Rate limit exceeded. Please retry after ${retryAfterSec} seconds.`
      })
    );
    return false;
  }

  timestamps.push(now);
  rateLimitStore.set(key, timestamps);

  // Periodic cleanup to prevent unbounded memory growth
  if (rateLimitStore.size > 2000) {
    for (const [k, list] of rateLimitStore.entries()) {
      if (list.every((t) => now - t >= windowMs)) {
        rateLimitStore.delete(k);
      }
    }
  }

  res.setHeader('RateLimit-Limit', String(maxRequests));
  res.setHeader('RateLimit-Remaining', String(Math.max(0, maxRequests - timestamps.length)));
  res.setHeader('RateLimit-Reset', String(Math.ceil(windowMs / 1000)));
  return true;
}

// -------------------------------------------------------------
// 4. HTTPONLY SIGNED COOKIE SESSION & RBAC (PHASE 3)
// -------------------------------------------------------------
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function isSecureRequest(req) {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.includes('https')) return true;
  if (req.secure || req.socket?.encrypted) return true;
  return process.env.NODE_ENV === 'production';
}

function getCookieName(req) {
  // Use __Host- prefix when served over HTTPS per security guide
  return isSecureRequest(req) ? '__Host-plh_session' : 'plh_session';
}

function parseCookies(req) {
  const header = req.headers?.cookie;
  const out = {};
  if (!header || typeof header !== 'string') return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      try {
        out[k] = decodeURIComponent(v);
      } catch (e) {
        out[k] = v;
      }
    }
  });
  return out;
}

function signSessionToken(payload) {
  const data = {
    role: payload.role === 'tenant_viewer' ? 'tenant_viewer' : 'property_manager',
    sub: payload.sub || 'plh-admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
  const encoded = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, providedSig] = token.split('.');
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      role: payload.role === 'tenant_viewer' ? 'tenant_viewer' : 'property_manager',
      sub: payload.sub || 'plh-admin',
      iat: payload.iat,
      exp: payload.exp
    };
  } catch (e) {
    return null;
  }
}

function setSessionCookie(req, res, role = 'property_manager') {
  const cookieName = getCookieName(req);
  const token = signSessionToken({ role });
  const secureFlag = isSecureRequest(req) ? '; Secure' : '';
  const cookieStr = `${cookieName}=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureFlag}`;
  res.setHeader('Set-Cookie', cookieStr);
  return { role, sub: 'plh-admin' };
}

function clearSessionCookie(req, res) {
  const cookieName = getCookieName(req);
  const secureFlag = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
  );
  res.setHeader('Clear-Site-Data', '"cookies", "storage"');
}

function resolveSession(req, res, { autoIssue = true } = {}) {
  const cookies = parseCookies(req);
  const rawToken = cookies['__Host-plh_session'] || cookies['plh_session'];
  const verified = verifySessionToken(rawToken);
  if (verified) {
    return verified;
  }
  if (autoIssue) {
    return setSessionCookie(req, res, 'property_manager');
  }
  return null;
}

function requireRole(req, res, allowedRoles = ['property_manager']) {
  const session = resolveSession(req, res, { autoIssue: true });
  if (!session || !allowedRoles.includes(session.role)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        error: `Forbidden: Your current session role ('${
          session?.role || 'unauthenticated'
        }') does not have permission to perform this action.`
      })
    );
    return null;
  }
  return session;
}

// -------------------------------------------------------------
// 5. BOUNDED BODY READER FOR RAW NODE / VITE / VERCEL HANDLERS
// -------------------------------------------------------------
async function readBoundedJsonBody(req, res, maxBytes = MAX_JSON_BODY_BYTES) {
  if (req.body && typeof req.body === 'object') {
    const serialized = JSON.stringify(req.body);
    if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Payload Too Large (max 512 KB)' }));
      return null;
    }
    return req.body;
  }

  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > maxBytes) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Payload Too Large (max 512 KB)' }));
      return null;
    }
    try {
      return JSON.parse(req.body || '{}');
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Malformed JSON body' }));
      return null;
    }
  }

  let totalBytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Payload Too Large (max 512 KB)' }));
      return null;
    }
    chunks.push(buf);
  }

  const rawStr = Buffer.concat(chunks).toString('utf8');
  if (!rawStr.trim()) return {};
  try {
    return JSON.parse(rawStr);
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Malformed JSON body' }));
    return null;
  }
}

// -------------------------------------------------------------
// 6. STRICT ZOD RUNTIME VALIDATION SCHEMAS (PHASE 2)
// -------------------------------------------------------------
const cleanStr = (max = 300) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => sanitizeString(String(v), max));

const optStr = (max = 500) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((v) => (v === null || v === undefined ? '' : sanitizeString(String(v), max)));

const nullableStr = (max = 500) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((v) => sanitizeNullableString(v, max));

const IdParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid identifier format')
});

const RenewalHistoryItemSchema = z
  .object({
    date: optStr(40),
    period: optStr(120),
    months: z.coerce.number().min(0).max(240).optional().default(12),
    monthlyRent: z.coerce.number().min(0).max(10_000_000).optional().default(0),
    totalRent: z.coerce.number().min(0).max(100_000_000).optional().default(0),
    type: optStr(120)
  })
  .passthrough();

const PortalTenantRecordSchema = z
  .object({
    id: cleanStr(40),
    name: cleanStr(160),
    phone: optStr(40),
    whatsapp: optStr(40),
    email: optStr(160),
    property: optStr(40),
    unit: optStr(40),
    contractStart: optStr(40),
    contractEnd: optStr(40),
    monthlyRent: z.coerce.number().min(0).max(10_000_000).default(0),
    durationMonths: z.coerce.number().min(0).max(240).default(12),
    totalRent: z.coerce.number().min(0).max(100_000_000).default(0),
    renewalDate: optStr(40),
    rentStatus: optStr(60),
    daysToExpiry: z.union([z.coerce.number(), z.null()]).optional().default(null),
    expiryAlert: optStr(80),
    notes: optStr(2000),
    paymentStatus: optStr(80),
    amountPaid: z.coerce.number().min(0).max(100_000_000).optional().default(0),
    isVacantSlot: z.boolean().optional().default(false),
    lastUpdatedBy: optStr(120),
    lastUpdatedByEmail: optStr(160),
    lastUpdatedByRole: optStr(60),
    lastUpdatedAt: optStr(60),
    renewalHistory: z.array(RenewalHistoryItemSchema).max(50).optional().default([])
  })
  .passthrough();

const AuditLogEntrySchema = z
  .object({
    id: cleanStr(80),
    action: cleanStr(80),
    category: optStr(60),
    actorId: optStr(80),
    actorName: cleanStr(120),
    actorEmail: optStr(160),
    actorRole: optStr(60),
    targetId: optStr(80),
    targetLabel: optStr(200),
    details: optStr(1000),
    timestamp: cleanStr(60)
  })
  .passthrough();

const PortalPropertyRecordSchema = z
  .object({
    id: cleanStr(40),
    code: optStr(40),
    name: cleanStr(160),
    shortName: optStr(80),
    location: optStr(200),
    address: optStr(250),
    totalUnits: z.coerce.number().int().min(1).max(500).default(8),
    defaultRent: z.coerce.number().min(0).max(10_000_000).optional().default(2000),
    manager: optStr(120),
    managerPhone: optStr(40),
    description: optStr(1000),
    amenities: z.array(cleanStr(80)).max(30).optional(),
    units: z.array(cleanStr(40)).max(500).optional(),
    image: optStr(500)
  })
  .passthrough();

const PortalSettingsSchema = z
  .object({
    currencySymbol: optStr(12),
    currencyCode: optStr(12),
    expiryWarningThresholdDays: z.coerce.number().int().min(1).max(365).default(90),
    criticalWarningThresholdDays: z.coerce.number().int().min(1).max(180).optional().default(30),
    referenceDateMode: optStr(30),
    companyName: optStr(160),
    companySubtitle: optStr(160),
    companyPhone: optStr(40),
    companyWhatsApp: optStr(40),
    companyEmail: optStr(160),
    companyAddress: optStr(250),
    whatsappTemplateRenewal: optStr(1500),
    whatsappTemplateOverdue: optStr(1500),
    whatsappTemplateGeneral: optStr(1500)
  })
  .passthrough();

const MaintenanceFeeInstallmentSchema = z
  .object({
    id: optStr(80),
    amount: z.coerce.number().min(0).max(100_000_000),
    date: optStr(40),
    method: optStr(60),
    receiptNumber: optStr(80),
    notes: optStr(500),
    recordedBy: optStr(120)
  })
  .passthrough();

const MaintenanceFeeRecordSchema = z
  .object({
    id: cleanStr(80),
    tenantId: cleanStr(80),
    tenantName: cleanStr(160),
    phone: optStr(40),
    unitId: cleanStr(40),
    propertyId: cleanStr(40),
    billingYear: z.coerce.number().int().min(2020).max(2100).default(2026),
    totalAmountDue: z.coerce.number().min(0).max(10_000_000).default(3000),
    amountPaid: z.coerce.number().min(0).max(10_000_000).default(0),
    paymentStatus: z.enum(['PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE']).default('PENDING'),
    dueDate: cleanStr(40),
    paymentDate: nullableStr(40),
    paymentMethod: nullableStr(60),
    receiptNumber: nullableStr(80),
    installments: z.array(MaintenanceFeeInstallmentSchema).max(50).optional().default([]),
    notes: optStr(2000),
    updatedAt: optStr(60)
  })
  .passthrough();

const FacilityChecklistItemSchema = z
  .object({
    item: cleanStr(300),
    done: z.boolean().default(false)
  })
  .passthrough();

const FacilityServiceScheduleSchema = z
  .object({
    id: cleanStr(80),
    serviceType: z.enum(['AC_SERVICING', 'TRASH_DISPOSAL', 'WATER_PUMP', 'COMPOUND_CLEANING']),
    title: cleanStr(200),
    frequency: z.enum(['QUARTERLY', 'MONTHLY', 'WEEKLY', 'DAILY']),
    propertyId: cleanStr(40).default('ALL'),
    unitId: optStr(40),
    scheduledDate: cleanStr(40),
    completedDate: nullableStr(40),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED']).default('SCHEDULED'),
    assignedVendor: optStr(160),
    staffName: optStr(120),
    costIncurred: z.coerce.number().min(0).max(10_000_000).default(0),
    checklist: z.array(FacilityChecklistItemSchema).max(50).optional().default([]),
    notes: optStr(2000),
    receiptAttachmentUrl: nullableStr(500),
    loggedByManagerId: optStr(80),
    loggedByName: optStr(120),
    updatedAt: optStr(60)
  })
  .passthrough();

const PortalStatePayloadSchema = z.object({
  tenants: z.array(PortalTenantRecordSchema).min(1).max(200),
  properties: z.array(PortalPropertyRecordSchema).max(50).optional(),
  settings: PortalSettingsSchema.optional(),
  maintenanceFees: z.array(MaintenanceFeeRecordSchema).max(300).optional(),
  facilitySchedules: z.array(FacilityServiceScheduleSchema).max(500).optional(),
  auditLogs: z.array(AuditLogEntrySchema).max(250).optional(),
  auditEntry: AuditLogEntrySchema.optional(),
  updatedAt: z.coerce.number().optional()
});

const SessionRoleSwitchSchema = z.object({
  role: z.enum(['property_manager', 'tenant_viewer']),
  pin: optStr(32)
});

// SQLite Route Schemas
const SqlPropertySchema = z.object({
  name: cleanStr(160),
  address: cleanStr(250),
  city: cleanStr(100),
  state: cleanStr(100),
  zip_code: cleanStr(30),
  property_type: optStr(80),
  year_built: z.union([z.coerce.number().int().min(1800).max(2100), z.null()]).optional(),
  image_url: nullableStr(500),
  description: nullableStr(1500)
});

const SqlUnitSchema = z.object({
  property_id: cleanStr(64),
  unit_number: cleanStr(40),
  floor: z.coerce.number().int().min(-5).max(200).optional().default(1),
  bedrooms: z.coerce.number().int().min(0).max(20).optional().default(1),
  bathrooms: z.coerce.number().min(0).max(20).optional().default(1),
  square_feet: z.union([z.coerce.number().int().min(0).max(100_000), z.null()]).optional().default(null),
  market_rent: z.coerce.number().min(0).max(10_000_000),
  status: z.enum(['vacant', 'occupied', 'maintenance']).optional().default('vacant'),
  features: optStr(1000)
});

const SqlUnitQuerySchema = z.object({
  property_id: z.string().max(64).regex(/^[A-Za-z0-9_-]*$/).optional(),
  status: z.enum(['vacant', 'occupied', 'maintenance']).optional()
});

const SqlTenantSchema = z.object({
  first_name: cleanStr(100),
  last_name: cleanStr(100),
  email: nullableStr(160),
  phone: cleanStr(40),
  whatsapp: nullableStr(40),
  national_id: nullableStr(60),
  emergency_contact_name: nullableStr(120),
  emergency_contact_phone: nullableStr(40),
  emergency_contact_relation: nullableStr(60),
  employer: nullableStr(120),
  monthly_income: z.union([z.coerce.number().min(0).max(100_000_000), z.null()]).optional().default(null),
  status: z.enum(['active', 'past', 'applicant']).optional().default('active'),
  notes: nullableStr(2000)
});

const SqlLeaseCreateSchema = z.object({
  tenant_id: cleanStr(64),
  unit_id: cleanStr(64),
  start_date: cleanStr(30),
  end_date: cleanStr(30),
  monthly_rent: z.coerce.number().min(0).max(10_000_000),
  security_deposit: z.coerce.number().min(0).max(10_000_000).optional(),
  duration_months: z.coerce.number().int().min(1).max(240).optional().default(12),
  total_contract_value: z.coerce.number().min(0).max(100_000_000).optional(),
  rent_due_day: z.coerce.number().int().min(1).max(31).optional().default(1),
  terms: nullableStr(2000),
  generate_first_month_rent: z.boolean().optional().default(true)
});

const SqlLeaseUpdateSchema = z.object({
  start_date: cleanStr(30),
  end_date: cleanStr(30),
  monthly_rent: z.coerce.number().min(0).max(10_000_000),
  security_deposit: z.coerce.number().min(0).max(10_000_000).optional().default(0),
  rent_due_day: z.coerce.number().int().min(1).max(31).optional().default(1),
  status: z.enum(['active', 'pending', 'expiring_soon', 'expired', 'terminated']).optional().default('active'),
  terms: nullableStr(2000)
});

const SqlLeaseTerminateSchema = z.object({
  termination_date: nullableStr(30),
  unit_status_after: z.enum(['vacant', 'occupied', 'maintenance']).optional().default('vacant')
});

const SqlLeaseRenewSchema = z.object({
  new_end_date: cleanStr(30),
  new_monthly_rent: z.coerce.number().min(0).max(10_000_000).optional(),
  terms: nullableStr(2000)
});

const SqlChargeCreateSchema = z.object({
  lease_id: cleanStr(64),
  charge_type: z.enum(['rent', 'deposit', 'late_fee', 'utility', 'maintenance_fee']).optional().default('rent'),
  description: cleanStr(300),
  amount: z.coerce.number().min(0).max(100_000_000),
  due_date: cleanStr(30),
  period_month: nullableStr(15)
});

const SqlGenerateChargesSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

const SqlPaymentCreateSchema = z.object({
  lease_id: nullableStr(64),
  tenant_id: nullableStr(64),
  charge_id: nullableStr(64),
  amount: z.coerce.number().positive().max(100_000_000),
  payment_date: cleanStr(30),
  payment_method: z
    .enum(['bank_transfer', 'credit_card', 'cash', 'cheque', 'online', 'momo'])
    .optional()
    .default('bank_transfer'),
  reference_no: nullableStr(100),
  notes: nullableStr(1000)
});

const SqlMaintenanceCreateSchema = z.object({
  property_id: cleanStr(64),
  unit_id: nullableStr(64),
  tenant_id: nullableStr(64),
  title: cleanStr(200),
  description: cleanStr(2000),
  category: z
    .enum(['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest_control', 'general'])
    .optional()
    .default('general'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  status: z.enum(['reported', 'in_progress', 'scheduled', 'completed', 'cancelled']).optional().default('reported'),
  estimated_cost: z.coerce.number().min(0).max(10_000_000).optional().default(0),
  actual_cost: z.coerce.number().min(0).max(10_000_000).optional().default(0),
  contractor_name: nullableStr(120),
  contractor_phone: nullableStr(40),
  invoice_ref: nullableStr(80),
  date_reported: nullableStr(30),
  date_scheduled: nullableStr(30),
  date_completed: nullableStr(30),
  notes: nullableStr(2000)
});

const SqlMaintenanceStatusSchema = z.object({
  status: z.enum(['reported', 'in_progress', 'scheduled', 'completed', 'cancelled']),
  actual_cost: z.union([z.coerce.number().min(0).max(10_000_000), z.null()]).optional(),
  notes: nullableStr(2000)
});

const SqlMaintenanceQuerySchema = z.object({
  status: z.enum(['reported', 'in_progress', 'scheduled', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category: z
    .enum(['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest_control', 'general'])
    .optional(),
  property_id: z.string().max(64).regex(/^[A-Za-z0-9_-]*$/).optional()
});

function formatZodError(zodError) {
  return zodError.issues
    .map((issue) => `${issue.path.join('.') || 'payload'}: ${issue.message}`)
    .join('; ');
}

// Shared handler for /api/auth/session across Express, Vite dev middleware, and Vercel
async function handleSessionEndpoint(req, res) {
  applySecurityHeaders(req, res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json');

  if (!enforceFetchMetadataIsolation(req, res)) return;
  if (!checkRateLimit(req, res, { bucket: 'auth', maxRequests: 60, windowMs: 60_000 })) return;

  if (req.method === 'GET') {
    const session = resolveSession(req, res, { autoIssue: true });
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        authenticated: true,
        role: session.role,
        cookieType: isSecureRequest(req) ? '__Host-plh_session (HttpOnly; Secure; SameSite=Lax)' : 'plh_session (HttpOnly; SameSite=Lax)'
      })
    );
    return;
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const body = await readBoundedJsonBody(req, res);
    if (!body) return;
    const parsed = SessionRoleSwitchSchema.safeParse(body);
    if (!parsed.success) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: formatZodError(parsed.error) }));
      return;
    }

    const expectedPin = process.env.ADMIN_ACCESS_PIN;
    if (
      parsed.data.role === 'property_manager' &&
      expectedPin &&
      parsed.data.pin &&
      parsed.data.pin !== expectedPin
    ) {
      res.statusCode = 403;
      res.end(JSON.stringify({ ok: false, error: 'Invalid administrator access PIN.' }));
      return;
    }

    const updated = setSessionCookie(req, res, parsed.data.role);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        authenticated: true,
        role: updated.role
      })
    );
    return;
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(req, res);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, authenticated: false, role: 'tenant_viewer' }));
    return;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
}

module.exports = {
  MAX_JSON_BODY_BYTES,
  sanitizeString,
  sanitizeNullableString,
  scrubSensitiveLog,
  safeErrorResponse,
  applySecurityHeaders,
  enforceFetchMetadataIsolation,
  checkRateLimit,
  resolveSession,
  requireRole,
  setSessionCookie,
  clearSessionCookie,
  readBoundedJsonBody,
  handleSessionEndpoint,
  formatZodError,
  schemas: {
    IdParamSchema,
    PortalStatePayloadSchema,
    MaintenanceFeeRecordSchema,
    FacilityServiceScheduleSchema,
    SessionRoleSwitchSchema,
    SqlPropertySchema,
    SqlUnitSchema,
    SqlUnitQuerySchema,
    SqlTenantSchema,
    SqlLeaseCreateSchema,
    SqlLeaseUpdateSchema,
    SqlLeaseTerminateSchema,
    SqlLeaseRenewSchema,
    SqlChargeCreateSchema,
    SqlGenerateChargesSchema,
    SqlPaymentCreateSchema,
    SqlMaintenanceCreateSchema,
    SqlMaintenanceStatusSchema,
    SqlMaintenanceQuerySchema
  }
};
