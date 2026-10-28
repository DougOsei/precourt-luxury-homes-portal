import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import PropertiesView from './components/PropertiesView';
import TenantsView from './components/TenantsView';
import LeasesView from './components/LeasesView';
import FinancesView from './components/FinancesView';
import SettingsView from './components/SettingsView';
import LoginPage from './components/LoginPage';
import ManagersAdminView from './components/ManagersAdminView';
import ActivityLogView from './components/ActivityLogView';
import TenantDrawer from './components/TenantDrawer';
import TenantModal, {
  RenewLeaseModal,
  BulkWhatsAppModal,
  TenantStatementModal
} from './components/TenantModal';
import Toast from './components/Toast';
import {
  INITIAL_TENANTS,
  INITIAL_PROPERTIES,
  DEFAULT_SETTINGS
} from './data/initialTenants';
import {
  enrichTenantRecord,
  exportTenantsToCSV,
  parseCSVToTenants,
  formatDateCSV
} from './utils';

const STORAGE_KEY_TENANTS = 'plh_portal_tenants_v3';
const STORAGE_KEY_PROPERTIES = 'plh_portal_properties_v3';
const STORAGE_KEY_SETTINGS = 'plh_portal_settings_v3';
const STORAGE_KEY_AUDIT_LOGS = 'plh_portal_audit_logs_v3';
const STORAGE_KEY_UPDATED_AT = 'plh_portal_updated_at_v3';

// Helper to recover any unsynced edits from v3, v2, or v1 localStorage keys
function loadInitialTenantsFromLocalStorage() {
  const keysToTry = [STORAGE_KEY_TENANTS, 'plh_portal_tenants_v2', 'plh_portal_tenants_v1'];
  for (const key of keysToTry) {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out legacy placeholder vacant slots if 16 real tenants exist
          const realTenants = parsed.filter((t) => !t.isVacantSlot && !String(t.id || '').startsWith('VAC-'));
          const baseList = realTenants.length >= 16 ? realTenants : parsed;
          return baseList.map((t) => enrichTenantRecord(t, DEFAULT_SETTINGS));
        }
      }
    } catch (e) {}
  }
  return INITIAL_TENANTS.map((t) => enrichTenantRecord(t, DEFAULT_SETTINGS));
}

function resolveTabFromPath(pathname) {
  const p = (pathname || '/').toLowerCase();
  if (p.startsWith('/admin/managers') || p.startsWith('/admin')) return 'managers';
  if (p.startsWith('/activity-log') || p.startsWith('/audit')) return 'activity-log';
  if (p.startsWith('/properties')) return 'properties';
  if (p.startsWith('/tenants')) return 'tenants';
  if (p.startsWith('/leases')) return 'leases';
  if (p.startsWith('/finances')) return 'finances';
  if (p.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

function resolvePathFromTab(tab) {
  switch (tab) {
    case 'managers':
      return '/admin/managers';
    case 'activity-log':
      return '/activity-log';
    case 'properties':
      return '/properties';
    case 'tenants':
      return '/tenants';
    case 'leases':
      return '/leases';
    case 'finances':
      return '/finances';
    case 'settings':
      return '/settings';
    default:
      return '/dashboard';
  }
}

export default function App() {
  const [currentTab, setCurrentTabState] = useState(() =>
    typeof window !== 'undefined' ? resolveTabFromPath(window.location.pathname) : 'dashboard'
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [autoTick, setAutoTick] = useState(0);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing'

  // Authentication & RBAC state read exclusively from encrypted HttpOnly cookie session
  const [authChecking, setAuthChecking] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [sessionCookieType, setSessionCookieType] = useState(
    'AES-256-GCM; HttpOnly; SameSite=Lax'
  );
  const csrfTokenRef = useRef('');

  // Directory cross-navigation filter state
  const [directoryInitialFilters, setDirectoryInitialFilters] = useState(null);

  // Load persisted state from LocalStorage or fall back to initial CSV data
  const [rawTenants, setRawTenants] = useState(() => loadInitialTenantsFromLocalStorage());

  const [properties, setProperties] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROPERTIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_PROPERTIES;
  });

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          expiryWarningThresholdDays: Number(parsed.expiryWarningThresholdDays) || 90
        };
      }
    } catch (e) {}
    return DEFAULT_SETTINGS;
  });

  const [auditLogs, setAuditLogs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  // Track latest state in refs for cloud sync & polling
  const rawTenantsRef = useRef(rawTenants);
  const propertiesRef = useRef(properties);
  const settingsRef = useRef(settings);
  const auditLogsRef = useRef(auditLogs);
  const isSavingRef = useRef(false);
  const lastKnownUpdatedAtRef = useRef(
    (() => {
      try {
        return Number(localStorage.getItem(STORAGE_KEY_UPDATED_AT)) || 0;
      } catch (e) {
        return 0;
      }
    })()
  );

  useEffect(() => {
    rawTenantsRef.current = rawTenants;
    try {
      localStorage.setItem(STORAGE_KEY_TENANTS, JSON.stringify(rawTenants));
    } catch (e) {}
  }, [rawTenants]);

  useEffect(() => {
    propertiesRef.current = properties;
    try {
      localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(properties));
    } catch (e) {}
  }, [properties]);

  useEffect(() => {
    settingsRef.current = settings;
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {}
  }, [settings]);

  useEffect(() => {
    auditLogsRef.current = auditLogs;
    try {
      localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(auditLogs));
    } catch (e) {}
  }, [auditLogs]);

  // Push any portal state update to /api/portal-state (Cloud + Local Server + BroadcastChannel)
  const pushStateToCloud = useCallback(
    async (nextTenants, nextProps, nextSettings, auditEntry = null) => {
      const updatedAt = Date.now();
      lastKnownUpdatedAtRef.current = updatedAt;
      isSavingRef.current = true;
      setSyncStatus('syncing');

      const nextAuditLogs = auditEntry
        ? [auditEntry, ...auditLogsRef.current.filter((e) => e.id !== auditEntry.id)].slice(0, 200)
        : auditLogsRef.current;

      if (auditEntry) {
        setAuditLogs(nextAuditLogs);
        auditLogsRef.current = nextAuditLogs;
      }

      try {
        localStorage.setItem(STORAGE_KEY_UPDATED_AT, String(updatedAt));
      } catch (e) {}

      // Broadcast immediately to other open tabs in the same browser
      try {
        const bc = new BroadcastChannel('plh_portal_live_sync');
        bc.postMessage({
          tenants: nextTenants,
          properties: nextProps,
          settings: nextSettings,
          auditLogs: nextAuditLogs,
          updatedAt
        });
        bc.close();
      } catch (e) {}

      try {
        const res = await fetch('/api/portal-state', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfTokenRef.current ? { 'X-CSRF-Token': csrfTokenRef.current } : {})
          },
          body: JSON.stringify({
            tenants: nextTenants,
            properties: nextProps,
            settings: nextSettings,
            auditLogs: nextAuditLogs,
            ...(auditEntry ? { auditEntry } : {}),
            updatedAt
          })
        });
        if (res.status === 401 || res.status === 403) {
          setToast({
            message: 'Session expired or insufficient permissions to modify portal state.',
            type: 'error'
          });
        } else if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.state?.auditLogs)) {
            setAuditLogs(data.state.auditLogs);
            auditLogsRef.current = data.state.auditLogs;
          }
        }
        setSyncStatus('synced');
      } catch (err) {
        console.error('Failed to push portal state to cloud:', err);
        setSyncStatus('synced');
      } finally {
        isSavingRef.current = false;
      }
    },
    []
  );

  // Pull latest portal state from /api/portal-state (syncs across Chrome, Edge, Safari, Mobile & Incognito)
  const pullStateFromCloud = useCallback(
    async (isInitialBoot = false) => {
      if (isSavingRef.current) return;
      try {
        const res = await fetch(`/api/portal-state?t=${Date.now()}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) return;
        const data = await res.json();
        const serverState = data?.state;

        if (!serverState || !Array.isArray(serverState.tenants)) {
          // Server has no state yet: upload current browser state
          await pushStateToCloud(
            rawTenantsRef.current,
            propertiesRef.current,
            settingsRef.current
          );
          return;
        }

        // Always synchronize auditLogs so login/logout and record update history stays live
        if (Array.isArray(serverState.auditLogs)) {
          setAuditLogs(serverState.auditLogs);
          auditLogsRef.current = serverState.auditLogs;
        }

        const serverUpdatedAt = Number(serverState.updatedAt) || 0;
        const localUpdatedAt = lastKnownUpdatedAtRef.current;

        // Check if this browser has unsynced local changes while server is still at initial seed (updatedAt === 0)
        if (isInitialBoot && serverUpdatedAt === 0) {
          const defaultSerialized = JSON.stringify(
            INITIAL_TENANTS.map((t) => enrichTenantRecord(t, DEFAULT_SETTINGS))
          );
          const localSerialized = JSON.stringify(
            rawTenantsRef.current.map((t) => enrichTenantRecord(t, DEFAULT_SETTINGS))
          );
          if (localSerialized !== defaultSerialized) {
            await pushStateToCloud(
              rawTenantsRef.current,
              propertiesRef.current,
              settingsRef.current
            );
            return;
          }
        }

        // Adopt server state whenever server is newer OR on initial login/boot when server has state
        // This guarantees Facility Manager and Super Admin always see the exact same synced dataset
        if (
          serverUpdatedAt > localUpdatedAt ||
          (isInitialBoot && serverUpdatedAt > 0) ||
          (isInitialBoot && localUpdatedAt === 0 && serverUpdatedAt >= 0)
        ) {
          lastKnownUpdatedAtRef.current = serverUpdatedAt;
          try {
            localStorage.setItem(STORAGE_KEY_UPDATED_AT, String(serverUpdatedAt));
          } catch (e) {}

          const nextSettings = serverState.settings
            ? {
                ...DEFAULT_SETTINGS,
                ...serverState.settings,
                expiryWarningThresholdDays:
                  Number(serverState.settings.expiryWarningThresholdDays) || 90
              }
            : settingsRef.current;

          if (Array.isArray(serverState.properties) && serverState.properties.length > 0) {
            setProperties(serverState.properties);
          }
          if (serverState.settings) {
            setSettings(nextSettings);
          }
          setRawTenants(serverState.tenants.map((t) => enrichTenantRecord(t, nextSettings)));
        }
      } catch (e) {
        // Ignore transient network errors during background poll
      }
    },
    [pushStateToCloud]
  );

  // Sync csrfTokenRef
  useEffect(() => {
    csrfTokenRef.current = csrfToken;
  }, [csrfToken]);

  // Role-aware navigation & History API synchronization
  const setCurrentTab = useCallback(
    (nextTab, replaceHistory = false) => {
      if (nextTab === 'managers' && authUser && authUser.role !== 'SUPER_ADMIN') {
        setToast({
          message: 'Access Denied (403): Super Admin privileges are required to access /admin/managers.',
          type: 'error'
        });
        setCurrentTabState('dashboard');
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/dashboard');
        }
        return;
      }

      setCurrentTabState(nextTab);
      if (typeof window !== 'undefined') {
        const targetPath = resolvePathFromTab(nextTab);
        if (window.location.pathname !== targetPath) {
          if (replaceHistory) {
            window.history.replaceState({}, '', targetPath);
          } else {
            window.history.pushState({}, '', targetPath);
          }
        }
      }
    },
    [authUser]
  );

  // Set up initial cloud pull, HttpOnly cookie session verification, periodic 4-second live sync, window focus/visibility sync, and BroadcastChannel
  useEffect(() => {
    fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((sessionData) => {
        if (sessionData?.cookieType) setSessionCookieType(sessionData.cookieType);
        if (sessionData?.authenticated && sessionData?.user) {
          setAuthUser(sessionData.user);
          setCsrfToken(sessionData.csrfToken || '');
          csrfTokenRef.current = sessionData.csrfToken || '';

          if (typeof window !== 'undefined') {
            const path = window.location.pathname.toLowerCase();
            const params = new URLSearchParams(window.location.search);
            const callbackUrl = params.get('callbackUrl');
            if (path.startsWith('/login')) {
              const target =
                callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
                  ? callbackUrl
                  : '/dashboard';
              window.history.replaceState({}, '', target);
              setCurrentTabState(resolveTabFromPath(target));
            } else if (
              (path.startsWith('/admin') || currentTab === 'managers') &&
              sessionData.user.role !== 'SUPER_ADMIN'
            ) {
              window.history.replaceState({}, '', '/dashboard');
              setCurrentTabState('dashboard');
            }
          }
          pullStateFromCloud(true);
        } else {
          setAuthUser(null);
          if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            if (!path.toLowerCase().startsWith('/login')) {
              const callbackUrl = encodeURIComponent(path + (window.location.search || ''));
              window.history.replaceState({}, '', `/login?callbackUrl=${callbackUrl}`);
            }
          }
        }
      })
      .catch(() => {
        setAuthUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });

    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        setCurrentTabState(resolveTabFromPath(window.location.pathname));
      }
    };
    window.addEventListener('popstate', handlePopState);

    const pollInterval = setInterval(() => {
      pullStateFromCloud(false);
    }, 4000);

    const tickInterval = setInterval(() => {
      setAutoTick((t) => t + 1);
    }, 60000);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        pullStateFromCloud(false);
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    let bc = null;
    try {
      bc = new BroadcastChannel('plh_portal_live_sync');
      bc.onmessage = (event) => {
        const msg = event.data;
        if (msg && Number(msg.updatedAt) > lastKnownUpdatedAtRef.current) {
          lastKnownUpdatedAtRef.current = Number(msg.updatedAt);
          if (Array.isArray(msg.tenants)) setRawTenants(msg.tenants);
          if (Array.isArray(msg.properties)) setProperties(msg.properties);
          if (msg.settings) setSettings(msg.settings);
          if (Array.isArray(msg.auditLogs)) setAuditLogs(msg.auditLogs);
        }
      };
    } catch (e) {}

    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      if (bc) bc.close();
    };
  }, [pullStateFromCloud]);

  // Color Scheme state & listeners (following dark-mode and dark-mode-toggle guides)
  const [storedScheme, setStoredScheme] = useState(() => {
    try {
      return localStorage.getItem('color-scheme'); // 'light' | 'dark' | null
    } catch (e) {
      return null;
    }
  });

  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e) => setSystemDark(e.matches);
    mql.addEventListener('change', handleMediaChange);

    const handleStorageChange = (e) => {
      if (e.key === 'color-scheme') {
        const val = e.newValue;
        setStoredScheme(val);
        const meta = document.querySelector('meta[name="color-scheme"]');
        if (meta) meta.content = val ?? 'light dark';
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mql.removeEventListener('change', handleMediaChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const renderedTheme = storedScheme || (systemDark ? 'dark' : 'light');
  const colorSchemePref = storedScheme || 'system';

  const applyColorSchemeMeta = (nextStored) => {
    setStoredScheme(nextStored);
    try {
      if (nextStored) {
        localStorage.setItem('color-scheme', nextStored);
      } else {
        localStorage.removeItem('color-scheme');
      }
    } catch (e) {}
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.content = nextStored ?? 'light dark';
    }
  };

  // Two-state toggle logic per dark-mode-toggle guide
  const handleQuickToggleTheme = () => {
    const sysScheme = systemDark ? 'dark' : 'light';
    const currentRendered = storedScheme ?? sysScheme;
    const target = currentRendered === 'dark' ? 'light' : 'dark';

    if (target === sysScheme) {
      // Returning to system preference: remove stored override
      applyColorSchemeMeta(null);
    } else {
      applyColorSchemeMeta(target);
    }
  };

  // Three-state setting control in SettingsView
  const handleSetColorSchemePref = (pref) => {
    if (pref === 'system') {
      applyColorSchemeMeta(null);
      showToast('Appearance set to follow System Default', 'info');
    } else {
      applyColorSchemeMeta(pref);
      showToast(`Appearance pinned to ${pref === 'dark' ? 'Luxury Dark' : 'Light'} Mode`, 'success');
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Both Super Admin and Facility Manager access the full synced property & tenant dataset
  const visibleProperties = useMemo(() => properties, [properties]);

  // Enrich all tenant records dynamically (auto-updates daysToExpiry, rentStatus, expiryAlert, progress for ≤90 days)
  const tenants = useMemo(() => {
    return rawTenants.map((t) => enrichTenantRecord(t, settings));
  }, [rawTenants, settings, autoTick]);

  // Compute Executive KPI Metrics
  const metrics = useMemo(() => {
    const leased = tenants.filter((t) => !t.isVacantSlot && t.rentStatus !== 'No Contract');
    const vacant = tenants.filter((t) => t.isVacantSlot || t.rentStatus === 'No Contract');

    const occupiedUnits = leased.length;
    const configuredTotal = visibleProperties.reduce((sum, p) => sum + (Number(p.totalUnits) || 8), 0);
    const totalUnits = Math.max(configuredTotal || 16, occupiedUnits + vacant.length);
    const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    const strictlyActiveCount = leased.filter((t) => t.rentStatus === 'Active').length;
    const expiringSoonCount = leased.filter((t) => t.rentStatus === 'Expiring Soon').length;
    const expiredCount = leased.filter((t) => t.rentStatus === 'Expired').length;
    const activeLeasesCount = strictlyActiveCount + expiringSoonCount;

    const monthlyProjectedRevenue = leased.reduce((acc, t) => acc + (Number(t.monthlyRent) || 0), 0);
    const totalContractValue = leased.reduce((acc, t) => acc + (Number(t.totalRent) || 0), 0);
    const activeContractValue = leased
      .filter((t) => t.rentStatus !== 'Expired')
      .reduce((acc, t) => acc + (Number(t.totalRent) || 0), 0);

    return {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate,
      strictlyActiveCount,
      expiringSoonCount,
      expiredCount,
      activeLeasesCount,
      monthlyProjectedRevenue,
      totalContractValue,
      activeContractValue
    };
  }, [tenants, visibleProperties]);

  // Active Slide-Over Drawer & Modals State
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);

  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewingTenant, setRenewingTenant] = useState(null);

  const [bulkWaModalOpen, setBulkWaModalOpen] = useState(false);

  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [statementTenant, setStatementTenant] = useState(null);

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === selectedTenantId) || null,
    [tenants, selectedTenantId]
  );

  // Build an attribution stamp and audit log entry for the currently logged-in user
  const createAuditEntry = useCallback(
    ({ action, category = 'record_update', targetId = '', targetLabel = '', details = '' }) => {
      const nowIso = new Date().toISOString();
      return {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        action,
        category,
        actorId: authUser?.id || '',
        actorName: authUser?.fullName || 'Authenticated Manager',
        actorEmail: authUser?.email || '',
        actorRole: authUser?.role || 'FACILITY_MANAGER',
        targetId,
        targetLabel,
        details,
        timestamp: nowIso
      };
    },
    [authUser]
  );

  const getActorStamp = useCallback(() => {
    return {
      lastUpdatedBy: authUser?.fullName || 'Authenticated Manager',
      lastUpdatedByEmail: authUser?.email || '',
      lastUpdatedByRole: authUser?.role || 'FACILITY_MANAGER',
      lastUpdatedAt: new Date().toISOString()
    };
  }, [authUser]);

  const handleLoginSuccess = (user, nextCsrfToken, redirectPath = '/dashboard') => {
    setAuthUser(user);
    setCsrfToken(nextCsrfToken || '');
    csrfTokenRef.current = nextCsrfToken || '';
    pullStateFromCloud(true);

    const safePath =
      redirectPath && redirectPath.startsWith('/') && !redirectPath.startsWith('//')
        ? redirectPath
        : '/dashboard';
    const targetTab = resolveTabFromPath(safePath);
    if (targetTab === 'managers' && user.role !== 'SUPER_ADMIN') {
      setCurrentTab('dashboard', true);
    } else {
      setCurrentTab(targetTab, true);
    }
    showToast(`Welcome back, ${user.fullName} (${user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Facility Manager'})`, 'success');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfTokenRef.current ? { 'X-CSRF-Token': csrfTokenRef.current } : {})
        }
      });
    } catch (e) {}
    setAuthUser(null);
    setCsrfToken('');
    csrfTokenRef.current = '';
    setSelectedTenantId(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/login');
    }
    showToast('Signed out securely. Session cookie revoked.', 'info');
  };

  const handleSwitchRole = async () => {
    showToast('Role is cryptographically bound to your authenticated account.', 'info');
  };

  const handleClearSessionData = async () => {
    await handleLogout();
  };

  // Helper to commit tenant list updates and sync to Cloud + all browsers/Incognito immediately
  const commitTenantsUpdate = (updaterFn, auditEntry = null) => {
    if (!authUser || (authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'FACILITY_MANAGER')) {
      showToast('Authentication required to modify tenant records.', 'error');
      return false;
    }
    setRawTenants((prev) => {
      const nextRaw = typeof updaterFn === 'function' ? updaterFn(prev) : updaterFn;
      const nextEnriched = nextRaw.map((t) => enrichTenantRecord(t, settingsRef.current));
      pushStateToCloud(nextEnriched, propertiesRef.current, settingsRef.current, auditEntry);
      return nextEnriched;
    });
    return true;
  };

  // Helper to summarize field-level changes between old and updated tenant record
  const buildTenantDiffSummary = (oldRecord, newRecord) => {
    if (!oldRecord) {
      return `Registered ${newRecord.name} in Unit ${newRecord.unit} (${newRecord.property}) at GH₵${Number(newRecord.monthlyRent || 0).toLocaleString()}/mo.`;
    }
    const changes = [];
    if (oldRecord.name !== newRecord.name) changes.push(`Name: "${oldRecord.name}" → "${newRecord.name}"`);
    if (oldRecord.unit !== newRecord.unit) changes.push(`Unit: ${oldRecord.unit} → ${newRecord.unit}`);
    if (Number(oldRecord.monthlyRent) !== Number(newRecord.monthlyRent)) {
      changes.push(
        `Monthly Rent: GH₵${Number(oldRecord.monthlyRent || 0).toLocaleString()} → GH₵${Number(
          newRecord.monthlyRent || 0
        ).toLocaleString()}`
      );
    }
    if (oldRecord.contractStart !== newRecord.contractStart || oldRecord.contractEnd !== newRecord.contractEnd) {
      changes.push(
        `Lease Period: ${formatDateCSV(newRecord.contractStart)} to ${formatDateCSV(newRecord.contractEnd)}`
      );
    }
    if ((oldRecord.phone || '') !== (newRecord.phone || '')) {
      changes.push(`Phone: ${newRecord.phone || 'Cleared'}`);
    }
    if ((oldRecord.notes || '') !== (newRecord.notes || '')) {
      changes.push('Updated tenancy notes');
    }
    return changes.length > 0
      ? `Updated ${newRecord.name} (Unit ${newRecord.unit}): ${changes.join('; ')}`
      : `Saved updates for ${newRecord.name} (Unit ${newRecord.unit})`;
  };

  // Handlers for CRUD & Lease Actions
  const handleSaveTenantModal = (formData) => {
    const stamp = getActorStamp();
    const isExistingEdit = Boolean(editingTenant && !editingTenant.isVacantSlot);
    const auditEntry = createAuditEntry({
      action: isExistingEdit ? 'TENANT_UPDATED' : 'TENANT_CREATED',
      category: 'record_update',
      targetId: formData.id,
      targetLabel: `${formData.name} (${formData.id} • Unit ${formData.unit})`,
      details: isExistingEdit
        ? buildTenantDiffSummary(editingTenant, formData)
        : `Registered new tenant ${formData.name} in Unit ${formData.unit} (${formData.property}) — Monthly Rent GH₵${Number(
            formData.monthlyRent || 0
          ).toLocaleString()}`
    });

    commitTenantsUpdate((prev) => {
      // If converting a vacant slot into an occupied tenant record
      if (formData.originalVacantId) {
        return prev.map((item) =>
          item.id === formData.originalVacantId
            ? {
                ...item,
                ...formData,
                ...stamp,
                isVacantSlot: false,
                rentStatus: 'Active',
                paymentStatus: 'Paid in Full',
                amountPaid: Number(formData.totalRent) || 0,
                renewalHistory: [
                  {
                    date: formData.contractStart,
                    period: `${formatDateCSV(formData.contractStart)} to ${formatDateCSV(formData.contractEnd)}`,
                    months: Number(formData.durationMonths) || 12,
                    monthlyRent: Number(formData.monthlyRent) || 0,
                    totalRent: Number(formData.totalRent) || 0,
                    type: 'New Tenancy Agreement'
                  }
                ]
              }
            : item
        );
      }

      const exists = prev.some((item) => item.id === (editingTenant?.id || formData.id));
      if (exists && editingTenant) {
        return prev.map((item) =>
          item.id === editingTenant.id
            ? {
                ...item,
                ...formData,
                ...stamp,
                isVacantSlot: false,
                monthlyRent: Number(formData.monthlyRent) || 0,
                durationMonths: Number(formData.durationMonths) || 12,
                totalRent: Number(formData.totalRent) || 0
              }
            : item
        );
      }

      // If assigning to a unit that had a vacant slot, replace that vacant slot
      const matchingVacant = prev.find(
        (item) => item.isVacantSlot && item.unit?.toUpperCase() === formData.unit?.toUpperCase()
      );
      if (matchingVacant) {
        return prev.map((item) =>
          item.id === matchingVacant.id
            ? {
                ...formData,
                ...stamp,
                isVacantSlot: false,
                rentStatus: 'Active',
                paymentStatus: 'Paid in Full',
                amountPaid: Number(formData.totalRent) || 0,
                renewalHistory: [
                  {
                    date: formData.contractStart,
                    period: `${formatDateCSV(formData.contractStart)} to ${formatDateCSV(formData.contractEnd)}`,
                    months: Number(formData.durationMonths) || 12,
                    monthlyRent: Number(formData.monthlyRent) || 0,
                    totalRent: Number(formData.totalRent) || 0,
                    type: 'Initial Tenancy Contract'
                  }
                ]
              }
            : item
        );
      }

      return [
        {
          ...formData,
          ...stamp,
          isVacantSlot: false,
          rentStatus: 'Active',
          paymentStatus: 'Paid in Full',
          amountPaid: Number(formData.totalRent) || 0,
          renewalHistory: [
            {
              date: formData.contractStart,
              period: `${formatDateCSV(formData.contractStart)} to ${formatDateCSV(formData.contractEnd)}`,
              months: Number(formData.durationMonths) || 12,
              monthlyRent: Number(formData.monthlyRent) || 0,
              totalRent: Number(formData.totalRent) || 0,
              type: 'Initial Tenancy Contract'
            }
          ]
        },
        ...prev
      ];
    }, auditEntry);

    setSelectedTenantId(formData.id);
    showToast(
      editingTenant && !editingTenant.isVacantSlot
        ? `Updated & synced record for ${formData.name} (${formData.id})`
        : `Registered & synced ${formData.name} in Unit ${formData.unit}`,
      'success'
    );
  };

  const handleSaveInlineDrawer = (updatedTenant) => {
    const stamp = getActorStamp();
    const oldTenant = rawTenantsRef.current.find((t) => t.id === selectedTenantId);
    const auditEntry = createAuditEntry({
      action: 'TENANT_UPDATED',
      category: 'record_update',
      targetId: updatedTenant.id,
      targetLabel: `${updatedTenant.name} (${updatedTenant.id} • Unit ${updatedTenant.unit})`,
      details: buildTenantDiffSummary(oldTenant, updatedTenant)
    });

    commitTenantsUpdate(
      (prev) =>
        prev.map((item) =>
          item.id === selectedTenantId
            ? { ...item, ...updatedTenant, ...stamp, isVacantSlot: false }
            : item
        ),
      auditEntry
    );
    setSelectedTenantId(updatedTenant.id);
    showToast(`Saved & synced changes for ${updatedTenant.name} (${updatedTenant.id})`, 'success');
  };

  const handleConfirmRenewLease = (tenant, renewalDetails) => {
    const stamp = getActorStamp();
    const auditEntry = createAuditEntry({
      action: 'LEASE_RENEWED',
      category: 'record_update',
      targetId: tenant.id,
      targetLabel: `${tenant.name} (${tenant.id} • Unit ${tenant.unit})`,
      details: `Renewed lease for ${tenant.name} (Unit ${tenant.unit}) for ${
        renewalDetails.durationMonths
      } months (${formatDateCSV(renewalDetails.contractStart)} to ${formatDateCSV(
        renewalDetails.contractEnd
      )}) at GH₵${Number(renewalDetails.monthlyRent || 0).toLocaleString()}/mo.`
    });

    commitTenantsUpdate(
      (prev) =>
        prev.map((item) => {
          if (item.id !== tenant.id) return item;
          const historyEntry = {
            date: renewalDetails.contractStart,
            period: `${formatDateCSV(renewalDetails.contractStart)} to ${formatDateCSV(
              renewalDetails.contractEnd
            )}`,
            months: renewalDetails.durationMonths,
            monthlyRent: renewalDetails.monthlyRent,
            totalRent: renewalDetails.totalRent,
            type: `Renewed (${renewalDetails.durationMonths} Months by ${
              authUser?.fullName || 'Manager'
            })`
          };
          return {
            ...item,
            ...stamp,
            contractStart: renewalDetails.contractStart,
            contractEnd: renewalDetails.contractEnd,
            durationMonths: renewalDetails.durationMonths,
            monthlyRent: renewalDetails.monthlyRent,
            totalRent: renewalDetails.totalRent,
            renewalDate: renewalDetails.renewalDate,
            notes: renewalDetails.notes || item.notes,
            rentStatus: 'Active',
            expiryAlert: 'OK',
            renewalHistory: [historyEntry, ...(item.renewalHistory || [])]
          };
        }),
      auditEntry
    );
    showToast(
      `Lease renewed & synced for ${tenant.name} (${tenant.unit}) until ${formatDateCSV(renewalDetails.contractEnd)}`,
      'success'
    );
  };

  const handleDeleteTenant = (tenant) => {
    if (!window.confirm(`Remove tenant record "${tenant.name}" (${tenant.id}) and mark Unit ${tenant.unit} as Vacant?`)) {
      return;
    }
    const stamp = getActorStamp();
    const auditEntry = createAuditEntry({
      action: 'UNIT_VACATED',
      category: 'record_update',
      targetId: tenant.id,
      targetLabel: `${tenant.name} (${tenant.id} • Unit ${tenant.unit})`,
      details: `Removed tenant ${tenant.name} and marked Unit ${tenant.unit} (${tenant.property}) as Vacant.`
    });

    commitTenantsUpdate(
      (prev) =>
        prev.map((item) =>
          item.id === tenant.id
            ? {
                id: `VAC-${tenant.unit}`,
                name: 'Vacant Unit — No Contract',
                phone: '',
                whatsapp: '',
                email: '',
                property: tenant.property,
                unit: tenant.unit,
                contractStart: '',
                contractEnd: '',
                monthlyRent: tenant.monthlyRent,
                durationMonths: 0,
                totalRent: 0,
                renewalDate: '',
                rentStatus: 'No Contract',
                daysToExpiry: null,
                expiryAlert: 'No Contract',
                notes: `Vacated by ${tenant.name}. Available for new lease.`,
                isVacantSlot: true,
                ...stamp,
                renewalHistory: []
              }
            : item
        ),
      auditEntry
    );
    if (selectedTenantId === tenant.id) {
      setSelectedTenantId(null);
    }
    showToast(`Removed ${tenant.name}; Unit ${tenant.unit} is now marked Vacant`, 'info');
  };

  const handleExportCSV = (customSubset = null) => {
    const listToExport = Array.isArray(customSubset) ? customSubset : tenants;
    exportTenantsToCSV(listToExport, 'Precourt_Luxury_Homes_Tenants_Export.csv');
    showToast(`Exported ${listToExport.length} records to CSV`, 'success');
  };

  const handleImportCSVText = (csvText) => {
    const imported = parseCSVToTenants(csvText);
    if (!imported.length) {
      showToast('Could not parse valid tenant rows from the provided CSV', 'error');
      return;
    }
    const stamp = getActorStamp();
    const auditEntry = createAuditEntry({
      action: 'CSV_IMPORTED',
      category: 'record_update',
      targetId: 'CSV-IMPORT',
      targetLabel: `CSV Batch Import (${imported.length} records)`,
      details: `Imported and synchronized ${imported.length} tenant contracts from CSV file.`
    });
    const defaultVacant = INITIAL_TENANTS.filter((t) => t.isVacantSlot);
    commitTenantsUpdate(
      [...imported.map((t) => ({ ...t, ...stamp })), ...defaultVacant],
      auditEntry
    );
    showToast(`Successfully ingested & synced ${imported.length} tenant contracts from CSV!`, 'success');
  };

  const handleResetDemo = () => {
    if (!window.confirm('Reset Precourt Luxury Homes portal back to the initial 16-tenant CSV dataset?')) return;
    const auditEntry = createAuditEntry({
      action: 'TENANT_UPDATED',
      category: 'record_update',
      targetId: 'PORTAL-RESET',
      targetLabel: 'Initial 16-Unit Dataset Reset',
      details: 'Reset portal records to the default 16-unit Amamoley & Kwabenya dataset.'
    });
    const resetTenants = INITIAL_TENANTS.map((t) => enrichTenantRecord(t, DEFAULT_SETTINGS));
    setRawTenants(resetTenants);
    setProperties(INITIAL_PROPERTIES);
    setSettings(DEFAULT_SETTINGS);
    setSelectedTenantId(null);
    pushStateToCloud(resetTenants, INITIAL_PROPERTIES, DEFAULT_SETTINGS, auditEntry);
    showToast('Portal reset & synced across all browsers to initial CSV dataset', 'success');
  };

  const handleFilterNavigate = (targetTab, filters) => {
    setDirectoryInitialFilters(filters);
    setCurrentTab(targetTab);
  };

  // Guard unauthenticated visits and initial session check
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Verifying Encrypted Session...
          </p>
        </div>
      </div>
    );
  }

  if (!authUser || authUser.requirePasswordReset) {
    const callbackUrl =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('callbackUrl') || '/dashboard'
        : '/dashboard';
    return (
      <>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          callbackUrl={callbackUrl}
          themeMode={renderedTheme}
          onToggleTheme={handleQuickToggleTheme}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 1. Collapsible Luxury Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
        metrics={metrics}
        themeMode={renderedTheme}
        onToggleTheme={handleQuickToggleTheme}
        settings={settings}
        onResetDemo={handleResetDemo}
        currentUser={authUser}
        onLogout={handleLogout}
        auditLogsCount={auditLogs.length}
      />

      {/* 2. Main Viewport */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'
        }`}
      >
        <Header
          currentTab={currentTab}
          setMobileOpen={setMobileMenuOpen}
          metrics={metrics}
          onOpenAddTenant={() => {
            setEditingTenant(null);
            setTenantModalOpen(true);
          }}
          onOpenBulkWhatsApp={() => setBulkWaModalOpen(true)}
          onExportCSV={() => handleExportCSV(tenants.filter((t) => !t.isVacantSlot))}
          onNavigate={setCurrentTab}
          themeMode={renderedTheme}
          onToggleTheme={handleQuickToggleTheme}
          settings={settings}
          syncStatus={syncStatus}
          onForceSync={() => {
            pullStateFromCloud(false);
            showToast('Synced latest records from cloud', 'info');
          }}
          currentUser={authUser}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {currentTab === 'dashboard' && (
            <Dashboard
              tenants={tenants}
              properties={visibleProperties}
              metrics={metrics}
              settings={settings}
              onNavigate={setCurrentTab}
              onSelectTenant={(t) => setSelectedTenantId(t.id)}
              onRenewTenant={(t) => {
                setRenewingTenant(t);
                setRenewModalOpen(true);
              }}
              onFilterNavigate={handleFilterNavigate}
              auditLogs={auditLogs}
            />
          )}

          {currentTab === 'properties' && (
            <PropertiesView
              tenants={tenants}
              properties={visibleProperties}
              settings={settings}
              onSelectTenant={(t) => setSelectedTenantId(t.id)}
              onEditTenant={(t) => {
                setEditingTenant(t);
                setTenantModalOpen(true);
              }}
              onRenewTenant={(t) => {
                setRenewingTenant(t);
                setRenewModalOpen(true);
              }}
              onOpenAddTenant={() => {
                setEditingTenant(null);
                setTenantModalOpen(true);
              }}
            />
          )}

          {currentTab === 'tenants' && (
            <TenantsView
              tenants={tenants}
              properties={visibleProperties}
              settings={settings}
              initialFilters={directoryInitialFilters}
              onClearInitialFilters={() => setDirectoryInitialFilters(null)}
              onSelectTenant={(t) => setSelectedTenantId(t.id)}
              onEditTenant={(t) => {
                setEditingTenant(t);
                setTenantModalOpen(true);
              }}
              onRenewTenant={(t) => {
                setRenewingTenant(t);
                setRenewModalOpen(true);
              }}
              onDeleteTenant={handleDeleteTenant}
              onOpenAddTenant={() => {
                setEditingTenant(null);
                setTenantModalOpen(true);
              }}
              onExportCSV={handleExportCSV}
              onOpenBulkWhatsApp={() => setBulkWaModalOpen(true)}
            />
          )}

          {currentTab === 'leases' && (
            <LeasesView
              tenants={tenants}
              settings={settings}
              onSelectTenant={(t) => setSelectedTenantId(t.id)}
              onEditTenant={(t) => {
                setEditingTenant(t);
                setTenantModalOpen(true);
              }}
              onRenewTenant={(t) => {
                setRenewingTenant(t);
                setRenewModalOpen(true);
              }}
              onOpenStatement={(t) => {
                setStatementTenant(t);
                setStatementModalOpen(true);
              }}
              onOpenBulkWhatsApp={() => setBulkWaModalOpen(true)}
            />
          )}

          {currentTab === 'finances' && (
            <FinancesView
              tenants={tenants}
              properties={visibleProperties}
              metrics={metrics}
              settings={settings}
              onSelectTenant={(t) => setSelectedTenantId(t.id)}
              onOpenStatement={(t) => {
                setStatementTenant(t);
                setStatementModalOpen(true);
              }}
              onExportCSV={handleExportCSV}
            />
          )}

          {currentTab === 'activity-log' && (
            <ActivityLogView
              auditLogs={auditLogs}
              currentUser={authUser}
              tenants={tenants}
              onSelectTenant={(t) => setSelectedTenantId(t.id)}
              onForceSync={() => {
                pullStateFromCloud(false);
                showToast('Refreshed latest activity log & records from cloud', 'info');
              }}
            />
          )}

          {currentTab === 'managers' && authUser?.role === 'SUPER_ADMIN' && (
            <ManagersAdminView
              currentUser={authUser}
              csrfToken={csrfToken}
              onShowToast={showToast}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={(next) => {
                const auditEntry = createAuditEntry({
                  action: 'SETTINGS_UPDATED',
                  category: 'record_update',
                  targetId: 'PORTAL-SETTINGS',
                  targetLabel: 'Portal Preferences & Alert Thresholds',
                  details: `Updated portal preferences (Expiry warning threshold: ${
                    next.expiryWarningThresholdDays || 90
                  } days, Currency: ${next.currencyCode || 'GHS'}).`
                });
                setSettings(next);
                pushStateToCloud(
                  rawTenantsRef.current,
                  propertiesRef.current,
                  next,
                  auditEntry
                );
                showToast('Portal preferences saved & synced across all browsers', 'success');
              }}
              colorSchemePref={colorSchemePref}
              onSetColorSchemePref={handleSetColorSchemePref}
              onExportCSV={() => handleExportCSV(tenants)}
              onImportCSVText={handleImportCSVText}
              onResetDemo={handleResetDemo}
              userRole="property_manager"
              sessionCookieType={sessionCookieType}
              onSwitchRole={handleSwitchRole}
              onClearSessionData={handleClearSessionData}
            />
          )}
        </main>
      </div>

      {/* 3. Slide-Over Tenant Detail & Inline Edit Drawer */}
      {selectedTenant && (
        <TenantDrawer
          tenant={selectedTenant}
          properties={visibleProperties}
          settings={settings}
          onClose={() => setSelectedTenantId(null)}
          onSaveInline={handleSaveInlineDrawer}
          onOpenFullEditModal={(t) => {
            setEditingTenant(t);
            setTenantModalOpen(true);
          }}
          onOpenRenewModal={(t) => {
            setRenewingTenant(t);
            setRenewModalOpen(true);
          }}
          onOpenStatementModal={(t) => {
            setStatementTenant(t);
            setStatementModalOpen(true);
          }}
        />
      )}

      {/* 4. Interactive Modal: Add / Edit Tenant */}
      <TenantModal
        isOpen={tenantModalOpen}
        onClose={() => setTenantModalOpen(false)}
        editingTenant={editingTenant}
        tenants={tenants}
        properties={visibleProperties}
        settings={settings}
        onSave={handleSaveTenantModal}
      />

      {/* 5. Interactive Modal: Renew / Extend Lease */}
      <RenewLeaseModal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        tenant={renewingTenant}
        settings={settings}
        onConfirmRenew={handleConfirmRenewLease}
      />

      {/* 6. Interactive Modal: Bulk WhatsApp Reminder Dispatch */}
      <BulkWhatsAppModal
        isOpen={bulkWaModalOpen}
        onClose={() => setBulkWaModalOpen(false)}
        tenants={tenants}
        settings={settings}
      />

      {/* 7. Printable Official Tenant Statement Modal */}
      <TenantStatementModal
        isOpen={statementModalOpen}
        onClose={() => setStatementModalOpen(false)}
        tenant={statementTenant}
        properties={visibleProperties}
        settings={settings}
      />

      {/* 8. Global Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
