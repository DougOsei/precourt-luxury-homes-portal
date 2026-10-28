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
    const errText = await res.text();
    throw new Error(`GitHub Gist PATCH failed (${res.status}): ${errText}`);
  }

  return statePayload;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const gistId = process.env.PLH_GIST_ID;
  const githubToken = process.env.PLH_GITHUB_TOKEN;

  try {
    if (req.method === 'GET') {
      if (gistId) {
        const cloudState = await fetchFromGist(gistId, githubToken);
        if (cloudState) {
          memoryCache = cloudState;
          return res.status(200).json({
            ok: true,
            source: 'cloud-gist',
            state: cloudState
          });
        }
      }

      return res.status(200).json({
        ok: true,
        source: memoryCache ? 'memory' : 'empty',
        state: memoryCache
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.tenants)) {
        return res.status(400).json({ ok: false, error: 'Invalid state payload: tenants array required' });
      }

      const nextState = {
        tenants: body.tenants,
        properties: Array.isArray(body.properties) ? body.properties : undefined,
        settings: body.settings || undefined,
        updatedAt: Number(body.updatedAt) || Date.now()
      };

      memoryCache = nextState;

      if (gistId && githubToken) {
        await saveToGist(gistId, githubToken, nextState);
        return res.status(200).json({
          ok: true,
          source: 'cloud-gist',
          updatedAt: nextState.updatedAt,
          state: nextState
        });
      }

      return res.status(200).json({
        ok: true,
        source: 'memory',
        updatedAt: nextState.updatedAt,
        state: nextState
      });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/portal-state:', err);
    return res.status(500).json({
      ok: false,
      error: err.message,
      state: memoryCache
    });
  }
};
