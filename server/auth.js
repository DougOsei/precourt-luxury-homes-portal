const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const dotenv = require('dotenv');

// Load .env.local first (if present), then .env
const rootDir = path.join(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const {
  applySecurityHeaders,
  enforceFetchMetadataIsolation,
  checkRateLimit,
  readBoundedJsonBody,
  sanitizeString,
  formatZodError,
  scrubSensitiveLog
} = require('./security');

const BCRYPT_COST = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout after 5 consecutive failures
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours session lifetime
const LOCAL_STATE_FILE = path.join(__dirname, 'portal_state.json');
const GIST_FILENAME = 'plh_portal_state.json';

// Optional SQLite connection (used when running in Node/Express/Vite)
let sqliteDb = null;
try {
  sqliteDb = require('./database');
} catch (e) {
  sqliteDb = null;
}

// Pre-computed cost-12 bcrypt hash for constant-time user enumeration defense
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('plh-timing-safe-nonexistent-user-guard-2026!', BCRYPT_COST);

// In-memory brute-force & replay tracking (works across serverless warm instances and Express)
const loginAttemptMap = new Map();
const revokedSessionJtis = new Set();
let memoryManagersCache = null;

function getEncryptionKey() {
  const rawSecret =
    process.env.AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.PLH_GIST_ID ||
    'precourt-luxury-homes-default-auth-encryption-key-2026';
  return crypto.createHash('sha256').update(String(rawSecret)).digest();
}

function getHmacKey() {
  const rawSecret =
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.PLH_GIST_ID ||
    'precourt-luxury-homes-default-hmac-signing-key-2026';
  return crypto.createHash('sha256').update(`hmac:${rawSecret}`).digest();
}

// -------------------------------------------------------------
// 1. DEFAULT SEEDED ACCOUNTS (SUPER_ADMIN & DOUGLAS AMADIE)
// -------------------------------------------------------------
function buildDefaultSeededManagers() {
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Kwame Mensah';
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'admin@precourtluxury.com').toLowerCase().trim();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'PrecourtAdmin@2026!';

  const douglasName = process.env.DOUGLAS_MANAGER_NAME || 'Douglas Amadie';
  const douglasEmail = (
    process.env.DOUGLAS_MANAGER_EMAIL || 'douglas.amadie@precourtluxury.com'
  )
    .toLowerCase()
    .trim();
  const douglasPassword = process.env.DOUGLAS_MANAGER_PASSWORD || 'DouglasPLH@2026!';

  return [
    {
      id: 'mgr-super-admin',
      fullName: superAdminName,
      email: superAdminEmail,
      username: 'admin',
      passwordHash: bcrypt.hashSync(superAdminPassword, BCRYPT_COST),
      role: 'SUPER_ADMIN',
      assignedProperties: ['PLH-AM', 'PLH-KW'],
      status: 'Active',
      requirePasswordReset: false,
      failedLoginAttempts: 0,
      lockedUntil: 0,
      lastLoginAt: null,
      createdAt: '2026-01-15T08:00:00.000Z'
    },
    {
      id: 'mgr-douglas-amadie',
      fullName: douglasName,
      email: douglasEmail,
      username: 'douglas.amadie',
      passwordHash: bcrypt.hashSync(douglasPassword, BCRYPT_COST),
      role: 'FACILITY_MANAGER',
      assignedProperties: ['PLH-AM', 'PLH-KW'],
      status: 'Active',
      requirePasswordReset: false,
      failedLoginAttempts: 0,
      lockedUntil: 0,
      lastLoginAt: null,
      createdAt: '2026-10-01T09:30:00.000Z'
    }
  ];
}

function sanitizeManagerForClient(mgr) {
  if (!mgr) return null;
  let props = mgr.assignedProperties;
  if (typeof props === 'string') {
    try {
      props = JSON.parse(props);
    } catch (e) {
      props = ['PLH-AM', 'PLH-KW'];
    }
  }
  return {
    id: mgr.id,
    fullName: mgr.fullName || mgr.full_name,
    email: mgr.email,
    username: mgr.username,
    role: mgr.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'FACILITY_MANAGER',
    assignedProperties: Array.isArray(props) ? props : ['PLH-AM', 'PLH-KW'],
    status: mgr.status || 'Active',
    requirePasswordReset: Boolean(mgr.requirePasswordReset ?? mgr.require_password_reset),
    lastLoginAt: mgr.lastLoginAt || mgr.last_login_at || null,
    createdAt: mgr.createdAt || mgr.created_at || new Date().toISOString()
  };
}

function normalizeDbRowToManager(row) {
  if (!row) return null;
  let assignedProperties = ['PLH-AM', 'PLH-KW'];
  try {
    assignedProperties = Array.isArray(row.assigned_properties)
      ? row.assigned_properties
      : JSON.parse(row.assigned_properties || '["PLH-AM","PLH-KW"]');
  } catch (e) {}

  return {
    id: row.id,
    fullName: row.full_name || row.fullName,
    email: (row.email || '').toLowerCase().trim(),
    username: (row.username || '').toLowerCase().trim(),
    passwordHash: row.password_hash || row.passwordHash,
    role: row.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'FACILITY_MANAGER',
    assignedProperties,
    status: row.status || 'Active',
    requirePasswordReset: Boolean(row.require_password_reset ?? row.requirePasswordReset),
    failedLoginAttempts: Number(row.failed_login_attempts ?? row.failedLoginAttempts ?? 0),
    lockedUntil: Number(row.locked_until ?? row.lockedUntil ?? 0),
    lastLoginAt: row.last_login_at || row.lastLoginAt || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString()
  };
}

// Sync managers to SQLite if available
function syncManagersToSqlite(managers) {
  if (!sqliteDb || !Array.isArray(managers)) return;
  try {
    const upsert = sqliteDb.prepare(`
      INSERT INTO managers (
        id, full_name, email, username, password_hash, role,
        assigned_properties, status, require_password_reset,
        failed_login_attempts, locked_until, last_login_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        full_name = excluded.full_name,
        email = excluded.email,
        username = excluded.username,
        password_hash = excluded.password_hash,
        role = excluded.role,
        assigned_properties = excluded.assigned_properties,
        status = excluded.status,
        require_password_reset = excluded.require_password_reset,
        failed_login_attempts = excluded.failed_login_attempts,
        locked_until = excluded.locked_until,
        last_login_at = excluded.last_login_at
    `);
    const tx = sqliteDb.transaction((list) => {
      for (const m of list) {
        upsert.run(
          m.id,
          m.fullName,
          m.email.toLowerCase().trim(),
          (m.username || m.email.split('@')[0]).toLowerCase().trim(),
          m.passwordHash,
          m.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'FACILITY_MANAGER',
          JSON.stringify(m.assignedProperties || ['PLH-AM', 'PLH-KW']),
          m.status || 'Active',
          m.requirePasswordReset ? 1 : 0,
          Number(m.failedLoginAttempts || 0),
          Number(m.lockedUntil || 0),
          m.lastLoginAt || null,
          m.createdAt || new Date().toISOString()
        );
      }
    });
    tx(managers);
  } catch (e) {
    // Ignore SQLite write errors on read-only serverless filesystems
  }
}

async function loadManagersStore() {
  const gistId = process.env.PLH_GIST_ID;
  const githubToken = process.env.PLH_GITHUB_TOKEN;

  // 1. Check SQLite first if running locally
  let sqliteManagers = [];
  if (sqliteDb) {
    try {
      const rows = sqliteDb.prepare('SELECT * FROM managers ORDER BY created_at ASC').all();
      sqliteManagers = rows.map(normalizeDbRowToManager);
    } catch (e) {}
  }

  // 2. Check local portal_state.json
  let fileManagers = [];
  if (fs.existsSync(LOCAL_STATE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_STATE_FILE, 'utf8'));
      if (Array.isArray(parsed.managers) && parsed.managers.length > 0) {
        fileManagers = parsed.managers.map(normalizeDbRowToManager);
      }
    } catch (e) {}
  }

  // 3. Check Cloud Gist if configured
  let gistManagers = [];
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
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.managers) && parsed.managers.length > 0) {
            gistManagers = parsed.managers.map(normalizeDbRowToManager);
          }
        }
      }
    } catch (e) {}
  }

  // Merge managers preferring the richest/latest set, ensuring default Super Admin and Douglas Amadie exist
  const baseList =
    gistManagers.length > 0
      ? gistManagers
      : sqliteManagers.length > 0
        ? sqliteManagers
        : fileManagers.length > 0
          ? fileManagers
          : memoryManagersCache || [];

  const mergedById = new Map();
  for (const m of [...sqliteManagers, ...fileManagers, ...gistManagers, ...baseList]) {
    if (m && m.id) {
      mergedById.set(m.id, m);
    }
  }

  if (mergedById.size === 0) {
    const defaults = buildDefaultSeededManagers();
    for (const d of defaults) mergedById.set(d.id, d);
  } else {
    // Always ensure Super Admin and Douglas Amadie exist unless explicitly present
    const hasSuperAdmin = Array.from(mergedById.values()).some((m) => m.role === 'SUPER_ADMIN');
    const hasDouglas = Array.from(mergedById.values()).some(
      (m) =>
        m.id === 'mgr-douglas-amadie' ||
        m.email.toLowerCase().includes('douglas') ||
        m.fullName.toLowerCase().includes('douglas amadie')
    );
    if (!hasSuperAdmin || !hasDouglas) {
      const defaults = buildDefaultSeededManagers();
      if (!hasSuperAdmin) mergedById.set(defaults[0].id, defaults[0]);
      if (!hasDouglas) mergedById.set(defaults[1].id, defaults[1]);
    }
  }

  const finalManagers = Array.from(mergedById.values());
  memoryManagersCache = finalManagers;
  syncManagersToSqlite(finalManagers);
  return finalManagers;
}

async function saveManagersStore(managers) {
  memoryManagersCache = managers;
  syncManagersToSqlite(managers);

  // Save into local portal_state.json if writable
  try {
    let currentLocal = {};
    if (fs.existsSync(LOCAL_STATE_FILE)) {
      currentLocal = JSON.parse(fs.readFileSync(LOCAL_STATE_FILE, 'utf8'));
    }
    currentLocal.managers = managers;
    currentLocal.managersUpdatedAt = Date.now();
    fs.mkdirSync(path.dirname(LOCAL_STATE_FILE), { recursive: true });
    fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(currentLocal, null, 2), 'utf8');
  } catch (e) {}

  // Save into Cloud Gist if configured
  const gistId = process.env.PLH_GIST_ID;
  const githubToken = process.env.PLH_GITHUB_TOKEN;
  if (gistId && githubToken) {
    try {
      const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Precourt-Luxury-Homes-Portal'
      };
      let existingState = {};
      const gGet = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers,
        cache: 'no-store'
      });
      if (gGet.ok) {
        const gData = await gGet.json();
        const content = gData.files?.[GIST_FILENAME]?.content;
        if (content) existingState = JSON.parse(content);
      }
      const nextPayload = {
        ...existingState,
        managers,
        managersUpdatedAt: Date.now()
      };
      await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify(nextPayload, null, 2)
            }
          }
        })
      });
    } catch (e) {}
  }

  return managers;
}

// -------------------------------------------------------------
// 2. ENCRYPTED & SIGNED SESSION TOKENS (AES-256-GCM + HMAC-SHA256)
// -------------------------------------------------------------
function isSecureRequest(req) {
  const proto = req.headers?.['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.includes('https')) return true;
  if (req.secure || req.socket?.encrypted) return true;
  return process.env.NODE_ENV === 'production';
}

function getAuthCookieName(req) {
  return isSecureRequest(req) ? '__Host-plh_auth_session' : 'plh_auth_session';
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

function createEncryptedSessionToken(user) {
  const nowSec = Math.floor(Date.now() / 1000);
  const csrfToken = crypto.randomBytes(24).toString('base64url');
  const jti = crypto.randomBytes(16).toString('base64url');

  const payload = {
    sub: user.id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    role: user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'FACILITY_MANAGER',
    assignedProperties: Array.isArray(user.assignedProperties)
      ? user.assignedProperties
      : ['PLH-AM', 'PLH-KW'],
    requirePasswordReset: Boolean(user.requirePasswordReset),
    csrfToken,
    jti,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS
  };

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  const envelope = `${iv.toString('base64url')}.${encrypted.toString(
    'base64url'
  )}.${authTag.toString('base64url')}`;
  const signature = crypto
    .createHmac('sha256', getHmacKey())
    .update(envelope)
    .digest('base64url');

  return {
    token: `${envelope}.${signature}`,
    payload
  };
}

function verifyEncryptedSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;

  const [ivB64, cipherB64, tagB64, providedSig] = parts;
  const envelope = `${ivB64}.${cipherB64}.${tagB64}`;
  const expectedSig = crypto
    .createHmac('sha256', getHmacKey())
    .update(envelope)
    .digest('base64url');

  const sigBufA = Buffer.from(providedSig);
  const sigBufB = Buffer.from(expectedSig);
  if (sigBufA.length !== sigBufB.length || !crypto.timingSafeEqual(sigBufA, sigBufB)) {
    return null;
  }

  try {
    const iv = Buffer.from(ivB64, 'base64url');
    const encrypted = Buffer.from(cipherB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');

    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8'
    );
    const payload = JSON.parse(decrypted);

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSec) return null;
    if (payload.jti && revokedSessionJtis.has(payload.jti)) return null;

    return payload;
  } catch (e) {
    return null;
  }
}

function setAuthenticatedCookie(req, res, user) {
  const cookieName = getAuthCookieName(req);
  const { token, payload } = createEncryptedSessionToken(user);
  const secureFlag = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${encodeURIComponent(
      token
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureFlag}`
  );
  return payload;
}

function clearAuthenticatedCookie(req, res, currentSession = null) {
  if (currentSession?.jti) {
    revokedSessionJtis.add(currentSession.jti);
  }
  const cookieName = getAuthCookieName(req);
  const secureFlag = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
  );
  res.setHeader('Clear-Site-Data', '"cookies"');
}

function getAuthenticatedSession(req) {
  const cookies = parseCookies(req);
  const rawToken = cookies['__Host-plh_auth_session'] || cookies['plh_auth_session'];
  return verifyEncryptedSessionToken(rawToken);
}

function verifyCsrfIfPresent(req, res, session) {
  if (!session) return true;
  const headerToken = req.headers?.['x-csrf-token'];
  // If client sends X-CSRF-Token, strictly validate it against the session CSRF token
  if (headerToken && session.csrfToken && headerToken !== session.csrfToken) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        error: 'Invalid CSRF token. Please refresh the page and try again.'
      })
    );
    return false;
  }
  return true;
}

function requireAuth(req, res, allowedRoles = ['SUPER_ADMIN', 'FACILITY_MANAGER']) {
  const session = getAuthenticatedSession(req);
  if (!session) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        authenticated: false,
        error: 'Authentication required. Please sign in at /login.'
      })
    );
    return null;
  }

  if (!verifyCsrfIfPresent(req, res, session)) {
    return null;
  }

  if (!allowedRoles.includes(session.role)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        error: `Forbidden: This resource requires ${allowedRoles.join(' or ')} privileges.`
      })
    );
    return null;
  }

  return session;
}

// -------------------------------------------------------------
// 3. ZOD VALIDATION SCHEMAS FOR LOGIN & MANAGER PROVISIONING
// -------------------------------------------------------------
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

const LoginCredentialsSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(2, 'Please enter your email address or username')
    .max(160, 'Identifier is too long'),
  password: z
    .string()
    .min(1, 'Please enter your password')
    .max(128, 'Password is too long')
});

const CreateManagerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(120, 'Full name must be under 120 characters')
    .transform((v) => sanitizeString(v, 120)),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(160)
    .transform((v) => v.toLowerCase()),
  role: z.enum(['SUPER_ADMIN', 'FACILITY_MANAGER']).default('FACILITY_MANAGER'),
  assignedProperties: z
    .array(z.enum(['PLH-AM', 'PLH-KW']))
    .min(1, 'Assign at least one property/facility')
    .default(['PLH-AM', 'PLH-KW']),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(
      PASSWORD_COMPLEXITY_REGEX,
      'Password must include uppercase, lowercase, number, and special character'
    ),
  requirePasswordReset: z.boolean().optional().default(true)
});

const ResetManagerPasswordSchema = z.object({
  managerId: z.string().min(1).max(80),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(
      PASSWORD_COMPLEXITY_REGEX,
      'Password must include uppercase, lowercase, number, and special character'
    ),
  requirePasswordReset: z.boolean().optional().default(true)
});

const UpdateManagerSchema = z.object({
  managerId: z.string().min(1).max(80),
  fullName: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .optional()
    .transform((v) => (v ? sanitizeString(v, 120) : undefined)),
  role: z.enum(['SUPER_ADMIN', 'FACILITY_MANAGER']).optional(),
  assignedProperties: z.array(z.enum(['PLH-AM', 'PLH-KW'])).min(1).optional(),
  status: z.enum(['Active', 'Inactive']).optional()
});

const ChangeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128)
    .regex(
      PASSWORD_COMPLEXITY_REGEX,
      'New password must include uppercase, lowercase, number, and special character'
    )
});

// -------------------------------------------------------------
// 4. BRUTE-FORCE 5-ATTEMPT LOCKOUT TRACKER
// -------------------------------------------------------------
function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

function getAttemptState(ip, identifier, managerRecord) {
  const now = Date.now();
  const key = `${ip}:${identifier.toLowerCase()}`;
  const mem = loginAttemptMap.get(key) || { count: 0, lockedUntil: 0 };

  const dbLockedUntil = Number(managerRecord?.lockedUntil || 0);
  const effectiveLockedUntil = Math.max(mem.lockedUntil || 0, dbLockedUntil);

  if (effectiveLockedUntil > now) {
    return {
      isLocked: true,
      remainingSeconds: Math.ceil((effectiveLockedUntil - now) / 1000),
      attempts: MAX_FAILED_ATTEMPTS
    };
  }

  // Reset expired lockouts
  if (mem.lockedUntil && mem.lockedUntil <= now) {
    loginAttemptMap.delete(key);
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }

  const attempts = Math.max(mem.count || 0, Number(managerRecord?.failedLoginAttempts || 0));
  return {
    isLocked: false,
    remainingSeconds: 0,
    attempts
  };
}

async function recordFailedLoginAttempt(ip, identifier, managers, managerRecord) {
  const now = Date.now();
  const key = `${ip}:${identifier.toLowerCase()}`;
  const current = loginAttemptMap.get(key) || { count: 0, lockedUntil: 0 };
  const nextCount = (current.count || 0) + 1;
  const lockedUntil = nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0;

  loginAttemptMap.set(key, { count: nextCount, lockedUntil });

  if (managerRecord) {
    const mgrAttempts = Number(managerRecord.failedLoginAttempts || 0) + 1;
    const mgrLockedUntil = mgrAttempts >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0;
    const updatedManagers = managers.map((m) =>
      m.id === managerRecord.id
        ? { ...m, failedLoginAttempts: mgrAttempts, lockedUntil: mgrLockedUntil }
        : m
    );
    await saveManagersStore(updatedManagers);
    return {
      attempts: Math.max(nextCount, mgrAttempts),
      isLocked: Math.max(nextCount, mgrAttempts) >= MAX_FAILED_ATTEMPTS,
      remainingSeconds: lockedUntil ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : 0
    };
  }

  return {
    attempts: nextCount,
    isLocked: nextCount >= MAX_FAILED_ATTEMPTS,
    remainingSeconds: lockedUntil ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : 0
  };
}

async function clearFailedLoginAttempts(ip, identifier, managers, managerRecord) {
  const key = `${ip}:${identifier.toLowerCase()}`;
  loginAttemptMap.delete(key);

  if (managerRecord) {
    const nowIso = new Date().toISOString();
    const updatedManagers = managers.map((m) =>
      m.id === managerRecord.id
        ? { ...m, failedLoginAttempts: 0, lockedUntil: 0, lastLoginAt: nowIso }
        : m
    );
    await saveManagersStore(updatedManagers);
  }
}

// -------------------------------------------------------------
// 5. HTTP ENDPOINT HANDLERS (SHARED BY EXPRESS, VITE & VERCEL)
// -------------------------------------------------------------
async function handleAuthLoginEndpoint(req, res) {
  applySecurityHeaders(req, res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json');

  if (!enforceFetchMetadataIsolation(req, res)) return;
  if (!checkRateLimit(req, res, { bucket: 'auth-login', maxRequests: 25, windowMs: 60_000 })) return;

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  try {
    const rawBody = await readBoundedJsonBody(req, res);
    if (!rawBody) return;

    const parsed = LoginCredentialsSchema.safeParse(rawBody);
    if (!parsed.success) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Invalid email or password.'
        })
      );
      return;
    }

    const { identifier, password } = parsed.data;
    const cleanId = identifier.toLowerCase().trim();
    const ip = getClientIp(req);

    const managers = await loadManagersStore();
    const matchedManager = managers.find(
      (m) =>
        m.email.toLowerCase() === cleanId ||
        (m.username && m.username.toLowerCase() === cleanId) ||
        m.fullName.toLowerCase() === cleanId
    );

    // Check 5-attempt brute-force lockout BEFORE verifying password
    const lockState = getAttemptState(ip, cleanId, matchedManager);
    if (lockState.isLocked) {
      const mins = Math.ceil(lockState.remainingSeconds / 60);
      res.statusCode = 429;
      res.setHeader('Retry-After', String(lockState.remainingSeconds));
      res.end(
        JSON.stringify({
          ok: false,
          locked: true,
          retryAfterSeconds: lockState.remainingSeconds,
          error: `Account temporarily locked due to 5 consecutive failed sign-in attempts. Please try again in ${mins} minute(s).`
        })
      );
      return;
    }

    // Constant-time bcrypt cost-12 comparison even if user does not exist (prevents user enumeration)
    const targetHash = matchedManager ? matchedManager.passwordHash : DUMMY_BCRYPT_HASH;
    const passwordValid = await bcrypt.compare(password, targetHash);

    if (!matchedManager || !passwordValid || matchedManager.status === 'Inactive') {
      const failInfo = await recordFailedLoginAttempt(ip, cleanId, managers, matchedManager);
      const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - failInfo.attempts);

      if (failInfo.isLocked) {
        res.statusCode = 429;
        res.setHeader('Retry-After', String(failInfo.remainingSeconds));
        res.end(
          JSON.stringify({
            ok: false,
            locked: true,
            remainingAttempts: 0,
            retryAfterSeconds: failInfo.remainingSeconds,
            error:
              'Too many failed sign-in attempts (5/5). Your access has been temporarily locked for 15 minutes.'
          })
        );
        return;
      }

      // Generic error message that never leaks whether the email/username exists
      res.statusCode = 401;
      res.end(
        JSON.stringify({
          ok: false,
          remainingAttempts,
          error: 'Invalid email or password.'
        })
      );
      return;
    }

    // Successful authentication! Clear failed attempts and issue encrypted HttpOnly session cookie
    await clearFailedLoginAttempts(ip, cleanId, managers, matchedManager);
    const sessionPayload = setAuthenticatedCookie(req, res, matchedManager);

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        authenticated: true,
        user: sanitizeManagerForClient({
          ...matchedManager,
          lastLoginAt: new Date().toISOString()
        }),
        csrfToken: sessionPayload.csrfToken
      })
    );
  } catch (err) {
    console.error('[auth/login] Error:', scrubSensitiveLog(err));
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'Authentication service unavailable.' }));
  }
}

async function handleAuthLogoutEndpoint(req, res) {
  applySecurityHeaders(req, res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json');

  if (!enforceFetchMetadataIsolation(req, res)) return;

  const session = getAuthenticatedSession(req);
  clearAuthenticatedCookie(req, res, session);

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      authenticated: false
    })
  );
}

async function handleAuthSessionCheckEndpoint(req, res) {
  applySecurityHeaders(req, res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json');

  if (!enforceFetchMetadataIsolation(req, res)) return;
  if (!checkRateLimit(req, res, { bucket: 'auth-session', maxRequests: 180, windowMs: 60_000 })) return;

  if (req.method === 'DELETE') {
    return handleAuthLogoutEndpoint(req, res);
  }

  // Password change on first login or profile password update
  if (req.method === 'PATCH' || req.method === 'POST') {
    const session = requireAuth(req, res, ['SUPER_ADMIN', 'FACILITY_MANAGER']);
    if (!session) return;

    const body = await readBoundedJsonBody(req, res);
    if (!body) return;

    const parsed = ChangeOwnPasswordSchema.safeParse(body);
    if (!parsed.success) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: formatZodError(parsed.error) }));
      return;
    }

    const managers = await loadManagersStore();
    const idx = managers.findIndex((m) => m.id === session.sub);
    if (idx === -1) {
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false, error: 'Account not found.' }));
      return;
    }

    const currentValid = await bcrypt.compare(
      parsed.data.currentPassword,
      managers[idx].passwordHash
    );
    if (!currentValid) {
      res.statusCode = 401;
      res.end(JSON.stringify({ ok: false, error: 'Current password is incorrect.' }));
      return;
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_COST);
    managers[idx] = {
      ...managers[idx],
      passwordHash: newHash,
      requirePasswordReset: false
    };
    await saveManagersStore(managers);

    const refreshedSession = setAuthenticatedCookie(req, res, managers[idx]);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        authenticated: true,
        user: sanitizeManagerForClient(managers[idx]),
        csrfToken: refreshedSession.csrfToken
      })
    );
    return;
  }

  const session = getAuthenticatedSession(req);
  if (!session) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        authenticated: false,
        user: null
      })
    );
    return;
  }

  // Verify user is still active in store
  const managers = await loadManagersStore();
  const liveUser = managers.find((m) => m.id === session.sub);
  if (!liveUser || liveUser.status === 'Inactive') {
    clearAuthenticatedCookie(req, res, session);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        authenticated: false,
        user: null
      })
    );
    return;
  }

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      authenticated: true,
      role: liveUser.role,
      user: sanitizeManagerForClient(liveUser),
      csrfToken: session.csrfToken,
      cookieType: isSecureRequest(req)
        ? '__Host-plh_auth_session (AES-256-GCM; HttpOnly; Secure; SameSite=Lax)'
        : 'plh_auth_session (AES-256-GCM; HttpOnly; SameSite=Lax)'
    })
  );
}

// -------------------------------------------------------------
// 6. SUPER ADMIN MANAGER PROVISIONING ENDPOINT (/api/admin/managers)
// -------------------------------------------------------------
async function handleAdminManagersEndpoint(req, res) {
  applySecurityHeaders(req, res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json');

  if (!enforceFetchMetadataIsolation(req, res)) return;
  if (!checkRateLimit(req, res, { bucket: 'admin-managers', maxRequests: 90, windowMs: 60_000 }))
    return;

  // Strictly enforce SUPER_ADMIN role (returns 403 Forbidden for FACILITY_MANAGER)
  const session = requireAuth(req, res, ['SUPER_ADMIN']);
  if (!session) return;

  try {
    const managers = await loadManagersStore();

    if (req.method === 'GET') {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          ok: true,
          managers: managers.map(sanitizeManagerForClient)
        })
      );
      return;
    }

    // Create / Invite a new Manager
    if (req.method === 'POST') {
      const rawBody = await readBoundedJsonBody(req, res);
      if (!rawBody) return;

      const parsed = CreateManagerSchema.safeParse(rawBody);
      if (!parsed.success) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: formatZodError(parsed.error) }));
        return;
      }

      const { fullName, email, role, assignedProperties, password, requirePasswordReset } =
        parsed.data;

      if (managers.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
        res.statusCode = 409;
        res.end(
          JSON.stringify({
            ok: false,
            error: 'A manager with this email address already exists.'
          })
        );
        return;
      }

      const baseUsername = email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '');
      const username = managers.some((m) => m.username === baseUsername)
        ? `${baseUsername}.${Math.floor(10 + Math.random() * 89)}`
        : baseUsername;

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      const newManager = {
        id: `mgr-${crypto.randomBytes(4).toString('hex')}`,
        fullName,
        email,
        username,
        passwordHash,
        role,
        assignedProperties,
        status: 'Active',
        requirePasswordReset: Boolean(requirePasswordReset),
        failedLoginAttempts: 0,
        lockedUntil: 0,
        lastLoginAt: null,
        createdAt: new Date().toISOString()
      };

      const nextManagers = [...managers, newManager];
      await saveManagersStore(nextManagers);

      res.statusCode = 201;
      res.end(
        JSON.stringify({
          ok: true,
          manager: sanitizeManagerForClient(newManager),
          managers: nextManagers.map(sanitizeManagerForClient)
        })
      );
      return;
    }

    // Reset a Manager's Password OR Update Manager Profile/Status/Properties
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const rawBody = await readBoundedJsonBody(req, res);
      if (!rawBody) return;

      // Action A: Password Reset
      if (rawBody.action === 'reset_password' || rawBody.newPassword) {
        const parsed = ResetManagerPasswordSchema.safeParse(rawBody);
        if (!parsed.success) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: formatZodError(parsed.error) }));
          return;
        }

        const { managerId, newPassword, requirePasswordReset } = parsed.data;
        const targetIdx = managers.findIndex((m) => m.id === managerId);
        if (targetIdx === -1) {
          res.statusCode = 404;
          res.end(JSON.stringify({ ok: false, error: 'Manager account not found.' }));
          return;
        }

        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
        managers[targetIdx] = {
          ...managers[targetIdx],
          passwordHash,
          requirePasswordReset: Boolean(requirePasswordReset),
          failedLoginAttempts: 0,
          lockedUntil: 0
        };

        await saveManagersStore(managers);
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            ok: true,
            message: `Password reset completed for ${managers[targetIdx].fullName}.`,
            manager: sanitizeManagerForClient(managers[targetIdx]),
            managers: managers.map(sanitizeManagerForClient)
          })
        );
        return;
      }

      // Action B: Update Role, Assigned Properties, or Account Status (Active / Inactive)
      const parsed = UpdateManagerSchema.safeParse(rawBody);
      if (!parsed.success) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: formatZodError(parsed.error) }));
        return;
      }

      const { managerId, fullName, role, assignedProperties, status } = parsed.data;
      const targetIdx = managers.findIndex((m) => m.id === managerId);
      if (targetIdx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ ok: false, error: 'Manager account not found.' }));
        return;
      }

      // Prevent deactivating or demoting the last active SUPER_ADMIN
      const activeSuperAdmins = managers.filter(
        (m) => m.role === 'SUPER_ADMIN' && m.status === 'Active'
      );
      if (
        managers[targetIdx].role === 'SUPER_ADMIN' &&
        activeSuperAdmins.length <= 1 &&
        (role === 'FACILITY_MANAGER' || status === 'Inactive')
      ) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            ok: false,
            error: 'Cannot deactivate or demote the last active Super Admin account.'
          })
        );
        return;
      }

      managers[targetIdx] = {
        ...managers[targetIdx],
        fullName: fullName ?? managers[targetIdx].fullName,
        role: role ?? managers[targetIdx].role,
        assignedProperties: assignedProperties ?? managers[targetIdx].assignedProperties,
        status: status ?? managers[targetIdx].status
      };

      await saveManagersStore(managers);
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          ok: true,
          manager: sanitizeManagerForClient(managers[targetIdx]),
          managers: managers.map(sanitizeManagerForClient)
        })
      );
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  } catch (err) {
    console.error('[admin/managers] Error:', scrubSensitiveLog(err));
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'Unable to process manager provisioning request.' }));
  }
}

module.exports = {
  BCRYPT_COST,
  buildDefaultSeededManagers,
  loadManagersStore,
  saveManagersStore,
  sanitizeManagerForClient,
  getAuthenticatedSession,
  requireAuth,
  handleAuthLoginEndpoint,
  handleAuthLogoutEndpoint,
  handleAuthSessionCheckEndpoint,
  handleAdminManagersEndpoint
};
