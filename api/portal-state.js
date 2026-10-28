const {
  applySecurityHeaders,
  enforceFetchMetadataIsolation,
  checkRateLimit,
  readBoundedJsonBody,
  formatZodError,
  scrubSensitiveLog,
  schemas
} = require('../server/security');
const { getAuthenticatedSession, requireAuth, mergeAuditLogs } = require('../server/auth');

const GIST_FILENAME = 'plh_portal_state.json';

// In-memory fallback cache for warm serverless invocations if env vars are missing
let memoryCache = null;

async function fetchFromGist(gistId, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'User-Agent': 'Precourt-Luxury-Homes-Portal'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'GET',
    headers,
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`GitHub Gist GET failed with status ${res.status}`);
  }

  const data = await res.json();
  const fileObj = data.files && data.files[GIST_FILENAME];
  if (!fileObj || !fileObj.content) {
    return null;
  }

  return JSON.parse(fileObj.content);
}

async function saveToGist(gistId, token, statePayload) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Precourt-Luxury-Homes-Portal'
  };

  let existingManagers = undefined;
  let existingAuditLogs = [];
  try {
    const existing = await fetchFromGist(gistId, token);
    if (existing && Array.isArray(existing.managers)) {
      existingManagers = existing.managers;
    }
    if (existing && Array.isArray(existing.auditLogs)) {
      existingAuditLogs = existing.auditLogs;
    }
  } catch (e) {}

  const mergedPayload = {
    ...statePayload,
    auditLogs: mergeAuditLogs(existingAuditLogs, statePayload.auditLogs || []),
    managers: statePayload.managers || existingManagers
  };

  const body = {
    description: `Precourt Luxury Homes — Portal State (Synced ${new Date().toISOString()})`,
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify(mergedPayload, null, 2)
      }
    }
  };

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`GitHub Gist PATCH failed with status ${res.status}`);
  }

  return mergedPayload;
}

module.exports = async function handler(req, res) {
  applySecurityHeaders(req, res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!enforceFetchMetadataIsolation(req, res)) {
    return;
  }

  const isWrite = req.method === 'PUT' || req.method === 'POST';
  if (
    !checkRateLimit(req, res, {
      bucket: isWrite ? 'portal-state-write' : 'portal-state-read',
      maxRequests: isWrite ? 60 : 240,
      windowMs: 60_000
    })
  ) {
    return;
  }

  const gistId = process.env.PLH_GIST_ID;
  const githubToken = process.env.PLH_GITHUB_TOKEN;

  try {
    if (req.method === 'GET') {
      const session = getAuthenticatedSession(req);

      if (gistId) {
        const cloudState = await fetchFromGist(gistId, githubToken);
        if (cloudState) {
          cloudState.auditLogs = mergeAuditLogs(cloudState.auditLogs || [], memoryCache?.auditLogs || []);
          memoryCache = cloudState;
          const safeState = { ...cloudState };
          delete safeState.managers;
          return res.status(200).json({
            ok: true,
            source: 'cloud-gist',
            role: session?.role || null,
            state: safeState
          });
        }
      }

      const safeMem = memoryCache
        ? { ...memoryCache, auditLogs: mergeAuditLogs(memoryCache.auditLogs || []) }
        : null;
      if (safeMem) delete safeMem.managers;
      return res.status(200).json({
        ok: true,
        source: safeMem ? 'memory' : 'empty',
        role: session?.role || null,
        state: safeMem
      });
    }

    if (isWrite) {
      // Require authenticated SUPER_ADMIN or FACILITY_MANAGER session
      const session = requireAuth(req, res, ['SUPER_ADMIN', 'FACILITY_MANAGER']);
      if (!session) return;

      const rawBody = await readBoundedJsonBody(req, res);
      if (!rawBody) return;

      const parsed = schemas.PortalStatePayloadSchema.safeParse(rawBody);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: `Validation failed: ${formatZodError(parsed.error)}`
        });
      }

      const valid = parsed.data;
      const verifiedAuditEntry = valid.auditEntry
        ? {
            ...valid.auditEntry,
            actorId: session.sub || valid.auditEntry.actorId || '',
            actorName: session.fullName || valid.auditEntry.actorName || 'Authenticated Manager',
            actorEmail: session.email || valid.auditEntry.actorEmail || '',
            actorRole: session.role || valid.auditEntry.actorRole || 'FACILITY_MANAGER',
            timestamp: valid.auditEntry.timestamp || new Date().toISOString()
          }
        : null;

      const mergedLogs = mergeAuditLogs(
        memoryCache?.auditLogs || [],
        valid.auditLogs || [],
        verifiedAuditEntry
      );

      const nextState = {
        tenants: valid.tenants,
        properties: valid.properties,
        settings: valid.settings,
        auditLogs: mergedLogs,
        updatedAt: Number(valid.updatedAt) || Date.now()
      };

      memoryCache = {
        ...(memoryCache || {}),
        ...nextState
      };

      if (gistId && githubToken) {
        const savedGist = await saveToGist(gistId, githubToken, nextState);
        const safeSaved = { ...savedGist };
        delete safeSaved.managers;
        return res.status(200).json({
          ok: true,
          source: 'cloud-gist',
          role: session.role,
          updatedAt: nextState.updatedAt,
          state: safeSaved
        });
      }

      return res.status(200).json({
        ok: true,
        source: 'memory',
        role: session.role,
        updatedAt: nextState.updatedAt,
        state: nextState
      });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/portal-state] Error:', scrubSensitiveLog(err));
    return res.status(500).json({
      ok: false,
      error: 'Unable to synchronize portal state at this time.',
      state: memoryCache
    });
  }
};
