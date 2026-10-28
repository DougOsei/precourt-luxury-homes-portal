import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  applySecurityHeaders,
  enforceFetchMetadataIsolation,
  checkRateLimit,
  resolveSession,
  requireRole,
  readBoundedJsonBody,
  handleSessionEndpoint,
  formatZodError,
  scrubSensitiveLog,
  schemas
} = require('./server/security');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_STATE_FILE = path.join(__dirname, 'server', 'portal_state.json');
const GIST_FILENAME = 'plh_portal_state.json';

function plhPortalStateSyncPlugin() {
  return {
    name: 'plh-portal-state-sync',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      const gistId = env.PLH_GIST_ID || process.env.PLH_GIST_ID;
      const githubToken = env.PLH_GITHUB_TOKEN || process.env.PLH_GITHUB_TOKEN;

      // Apply HTTP security headers across dev server responses
      server.middlewares.use((req, res, next) => {
        applySecurityHeaders(req, res);
        next();
      });

      // Handle /api/auth/session directly in Vite dev server
      server.middlewares.use('/api/auth/session', async (req, res) => {
        await handleSessionEndpoint(req, res);
      });

      server.middlewares.use('/api/portal-state', async (req, res, next) => {
        applySecurityHeaders(req, res);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

        if (!enforceFetchMetadataIsolation(req, res)) return;

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

        try {
          if (req.method === 'GET') {
            const session = resolveSession(req, res, { autoIssue: true });

            // Try cloud Gist first if configured, falling back to local server/portal_state.json
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
              } catch (e) {
                // Fallback to local file below
              }
            }

            let localState = null;
            if (fs.existsSync(LOCAL_STATE_FILE)) {
              try {
                localState = JSON.parse(fs.readFileSync(LOCAL_STATE_FILE, 'utf8'));
              } catch (e) {}
            }

            // Pick whichever has the newer updatedAt timestamp
            let resolvedState = cloudState || localState;
            if (cloudState && localState) {
              resolvedState =
                (Number(localState.updatedAt) || 0) > (Number(cloudState.updatedAt) || 0)
                  ? localState
                  : cloudState;
            }

            if (resolvedState && fs.existsSync(path.dirname(LOCAL_STATE_FILE))) {
              fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(resolvedState, null, 2), 'utf8');
            }

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                ok: true,
                source: cloudState ? 'cloud+local' : 'local-disk',
                role: session.role,
                state: resolvedState
              })
            );
            return;
          }

          if (isWrite) {
            const session = requireRole(req, res, ['property_manager']);
            if (!session) return;

            const rawBody = await readBoundedJsonBody(req, res);
            if (!rawBody) return;

            const parsed = schemas.PortalStatePayloadSchema.safeParse(rawBody);
            if (!parsed.success) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  ok: false,
                  error: `Validation failed: ${formatZodError(parsed.error)}`
                })
              );
              return;
            }

            const valid = parsed.data;
            const nextState = {
              tenants: valid.tenants,
              properties: valid.properties,
              settings: valid.settings,
              updatedAt: Number(valid.updatedAt) || Date.now()
            };

            // Always persist to shared local disk file immediately
            fs.mkdirSync(path.dirname(LOCAL_STATE_FILE), { recursive: true });
            fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(nextState, null, 2), 'utf8');

            // Also persist to Cloud Gist if configured
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

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                ok: true,
                source: syncedCloud ? 'cloud+local' : 'local-disk',
                role: session.role,
                updatedAt: nextState.updatedAt,
                state: nextState
              })
            );
            return;
          }

          next();
        } catch (err) {
          console.error('[vite/portal-state] Error:', scrubSensitiveLog(err));
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: 'Internal server error' }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    plhPortalStateSyncPlugin()
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true
      }
    }
  }
});
