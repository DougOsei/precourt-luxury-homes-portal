const {
  applySecurityHeaders,
  enforceFetchMetadataIsolation,
  checkRateLimit,
  resolveSession,
  requireRole,
  readBoundedJsonBody,
  formatZodError,
  scrubSensitiveLog,
  schemas
} = require('../server/security');

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

  const body = {
    description: `Precourt Luxury Homes — Portal State (Synced ${new Date().toISOString()})`,
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify(statePayload, null, 2)
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

  return statePayload;
}

module.exports = async function handler(req, res) {
  applySecurityHeaders(req, res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Enforce Fetch Metadata resource isolation (blocks cross-site CSRF / XSSI)
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
      const session = resolveSession(req, res, { autoIssue: true });

      if (gistId) {
        const cloudState = await fetchFromGist(gistId, githubToken);
        if (cloudState) {
          memoryCache = cloudState;
          return res.status(200).json({
            ok: true,
            source: 'cloud-gist',
            role: session.role,
            state: cloudState
          });
        }
      }

      return res.status(200).json({
        ok: true,
        source: memoryCache ? 'memory' : 'empty',
        role: session.role,
        state: memoryCache
      });
    }

    if (isWrite) {
      // Enforce server-side RBAC from HttpOnly signed cookie
      const session = requireRole(req, res, ['property_manager']);
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
      const nextState = {
        tenants: valid.tenants,
        properties: valid.properties,
        settings: valid.settings,
        updatedAt: Number(valid.updatedAt) || Date.now()
      };

      memoryCache = nextState;

      if (gistId && githubToken) {
        await saveToGist(gistId, githubToken, nextState);
        return res.status(200).json({
          ok: true,
          source: 'cloud-gist',
          role: session.role,
          updatedAt: nextState.updatedAt,
          state: nextState
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
