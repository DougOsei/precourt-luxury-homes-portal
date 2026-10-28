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
  readBoundedJsonBody,
  formatZodError,
  scrubSensitiveLog,
  schemas
} = require('./server/security');
const {
  getAuthenticatedSession,
  requireAuth,
  mergeAuditLogs,
  handleAuthLoginEndpoint,
  handleAuthLogoutEndpoint,
  handleAuthSessionCheckEndpoint,
  handleAdminManagersEndpoint
} = require('./server/auth');

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

      // Apply HTTP security headers and route protection across dev server responses
      server.middlewares.use((req, res, next) => {
        applySecurityHeaders(req, res);

        // Route Protection Middleware for top-level HTML navigation
        const accept = req.headers?.accept || '';
        const urlObj = new URL(req.url || '/', 'http://localhost');
        const urlPath = urlObj.pathname;

        if (req.method === 'GET' && accept.includes('text/html') && !urlPath.startsWith('/api')) {
          const session = getAuthenticatedSession(req);

          if (urlPath === '/login' && session) {
            res.statusCode = 302;
            res.setHeader('Location', '/dashboard');
            res.end();
            return;
          }

          const isProtectedRoute =
            urlPath.startsWith('/dashboard') ||
            urlPath.startsWith('/properties') ||
            urlPath.startsWith('/tenants') ||
            urlPath.startsWith('/leases') ||
            urlPath.startsWith('/finances') ||
            urlPath.startsWith('/maintenance-fees') ||
            urlPath.startsWith('/activity-log') ||
            urlPath.startsWith('/settings') ||
            urlPath.startsWith('/admin');

          if (isProtectedRoute && !session) {
            res.statusCode = 302;
            res.setHeader(
              'Location',
              `/login?callbackUrl=${encodeURIComponent(urlPath + urlObj.search)}`
            );
            res.end();
            return;
          }

          if (urlPath.startsWith('/admin') && session && session.role !== 'SUPER_ADMIN') {
            res.statusCode = 302;
            res.setHeader('Location', '/dashboard');
            res.end();
            return;
          }
        }

        next();
      });

      // Handle /api/auth/* and /api/admin/managers directly in Vite dev server
      server.middlewares.use('/api/auth/login', async (req, res) => {
        await handleAuthLoginEndpoint(req, res);
      });

      server.middlewares.use('/api/auth/logout', async (req, res) => {
        await handleAuthLogoutEndpoint(req, res);
      });

      server.middlewares.use('/api/auth/session', async (req, res) => {
        await handleAuthSessionCheckEndpoint(req, res);
      });

      server.middlewares.use('/api/admin/managers', async (req, res) => {
        await handleAdminManagersEndpoint(req, res);
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
            const session = getAuthenticatedSession(req);

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
              resolvedState.auditLogs = mergeAuditLogs(
                cloudState?.auditLogs || [],
                localState?.auditLogs || []
              );
              if (fs.existsSync(path.dirname(LOCAL_STATE_FILE))) {
                fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(resolvedState, null, 2), 'utf8');
              }
            }

            const safeState = resolvedState ? { ...resolvedState } : null;
            if (safeState) delete safeState.managers;

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                ok: true,
                source: cloudState ? 'cloud+local' : 'local-disk',
                role: session?.role || null,
                state: safeState
              })
            );
            return;
          }

          if (isWrite) {
            const session = requireAuth(req, res, ['SUPER_ADMIN', 'FACILITY_MANAGER']);
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
            let existingManagers = undefined;
            let existingAuditLogs = [];
            if (fs.existsSync(LOCAL_STATE_FILE)) {
              try {
                const prev = JSON.parse(fs.readFileSync(LOCAL_STATE_FILE, 'utf8'));
                if (Array.isArray(prev.managers)) existingManagers = prev.managers;
                if (Array.isArray(prev.auditLogs)) existingAuditLogs = prev.auditLogs;
              } catch (e) {}
            }

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
              existingAuditLogs,
              valid.auditLogs || [],
              verifiedAuditEntry
            );

            const nextState = {
              tenants: valid.tenants,
              properties: valid.properties,
              settings: valid.settings,
              maintenanceFees: valid.maintenanceFees,
              facilitySchedules: valid.facilitySchedules,
              auditLogs: mergedLogs,
              managers: existingManagers,
              updatedAt: Number(valid.updatedAt) || Date.now()
            };

            fs.mkdirSync(path.dirname(LOCAL_STATE_FILE), { recursive: true });
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

            const safeState = { ...nextState };
            delete safeState.managers;

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                ok: true,
                source: syncedCloud ? 'cloud+local' : 'local-disk',
                role: session.role,
                updatedAt: nextState.updatedAt,
                state: safeState
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
