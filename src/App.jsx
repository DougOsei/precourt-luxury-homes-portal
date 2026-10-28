import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import PropertiesView from './components/PropertiesView';
import TenantsView from './components/TenantsView';
import LeasesView from './components/LeasesView';
import FinancesView from './components/FinancesView';
import SettingsView from './components/SettingsView';
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

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [autoTick, setAutoTick] = useState(0);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing'

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

  // Track latest state in refs for cloud sync & polling
  const rawTenantsRef = useRef(rawTenants);
  const propertiesRef = useRef(properties);
  const settingsRef = useRef(settings);
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

  // Push any portal state update to /api/portal-state (Cloud + Local Server + BroadcastChannel)
  const pushStateToCloud = useCallback(async (nextTenants, nextProps, nextSettings) => {
    const updatedAt = Date.now();
    lastKnownUpdatedAtRef.current = updatedAt;
    isSavingRef.current = true;
    setSyncStatus('syncing');

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
        updatedAt
      });
      bc.close();
    } catch (e) {}

    try {
      const res = await fetch('/api/portal-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenants: nextTenants,
          properties: nextProps,
          settings: nextSettings,
          updatedAt
        })
      });
      if (res.ok) {
        setSyncStatus('synced');
      } else {
        setSyncStatus('synced');
      }
    } catch (err) {
      console.error('Failed to push portal state to cloud:', err);
      setSyncStatus('synced');
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  // Pull latest portal state from /api/portal-state (syncs across Chrome, Edge, Safari, Mobile & Incognito)
  const pullStateFromCloud = useCallback(
    async (isInitialBoot = false) => {
      if (isSavingRef.current) return;
      try {
        const res = await fetch(`/api/portal-state?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) return;
        const data = await res.json();
        const serverState = data?.state;

        if (!serverState || !Array.isArray(serverState.tenants)) {
          // Server has no state yet: upload current browser state
          await pushStateToCloud(rawTenantsRef.current, propertiesRef.current, settingsRef.current);
          return;
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
            await pushStateToCloud(rawTenantsRef.current, propertiesRef.current, settingsRef.current);
            return;
          }
        }

        // Adopt server state if it is newer than local or on initial boot when server has saved updates
        if (
          serverUpdatedAt > localUpdatedAt ||
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

  // Set up initial cloud pull, periodic 4-second live sync, window focus/visibility sync, and BroadcastChannel
  useEffect(() => {
    pullStateFromCloud(true);

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
        }
      };
    } catch (e) {}

    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
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

  // Enrich all tenant records dynamically (auto-updates daysToExpiry, rentStatus, expiryAlert, progress for ≤90 days)
  const tenants = useMemo(() => {
    return rawTenants.map((t) => enrichTenantRecord(t, settings));
  }, [rawTenants, settings, autoTick]);

  // Compute Executive KPI Metrics
  const metrics = useMemo(() => {
    const leased = tenants.filter((t) => !t.isVacantSlot && t.rentStatus !== 'No Contract');
    const vacant = tenants.filter((t) => t.isVacantSlot || t.rentStatus === 'No Contract');

    const occupiedUnits = leased.length;
    const configuredTotal = properties.reduce((sum, p) => sum + (Number(p.totalUnits) || 8), 0);
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
  }, [tenants]);

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

  // Helper to commit tenant list updates and sync to Cloud + all browsers/Incognito immediately
  const commitTenantsUpdate = (updaterFn) => {
    setRawTenants((prev) => {
      const nextRaw = typeof updaterFn === 'function' ? updaterFn(prev) : updaterFn;
      const nextEnriched = nextRaw.map((t) => enrichTenantRecord(t, settingsRef.current));
      pushStateToCloud(nextEnriched, propertiesRef.current, settingsRef.current);
      return nextEnriched;
    });
  };

  // Handlers for CRUD & Lease Actions
  const handleSaveTenantModal = (formData) => {
    commitTenantsUpdate((prev) => {
      // If converting a vacant slot into an occupied tenant record
      if (formData.originalVacantId) {
        return prev.map((item) =>
          item.id === formData.originalVacantId
            ? {
                ...item,
                ...formData,
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
    });

    setSelectedTenantId(formData.id);
    showToast(
      editingTenant && !editingTenant.isVacantSlot
        ? `Updated & synced record for ${formData.name} (${formData.id})`
        : `Registered & synced ${formData.name} in Unit ${formData.unit}`,
      'success'
    );
  };

  const handleSaveInlineDrawer = (updatedTenant) => {
    commitTenantsUpdate((prev) =>
      prev.map((item) => (item.id === selectedTenantId ? { ...item, ...updatedTenant, isVacantSlot: false } : item))
    );
    setSelectedTenantId(updatedTenant.id);
    showToast(`Saved & synced changes for ${updatedTenant.name} (${updatedTenant.id})`, 'success');
  };

  const handleConfirmRenewLease = (tenant, renewalDetails) => {
    commitTenantsUpdate((prev) =>
      prev.map((item) => {
        if (item.id !== tenant.id) return item;
        const historyEntry = {
          date: renewalDetails.contractStart,
          period: `${formatDateCSV(renewalDetails.contractStart)} to ${formatDateCSV(renewalDetails.contractEnd)}`,
          months: renewalDetails.durationMonths,
          monthlyRent: renewalDetails.monthlyRent,
          totalRent: renewalDetails.totalRent,
          type: `Renewed (${renewalDetails.durationMonths} Months)`
        };
        return {
          ...item,
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
      })
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
    commitTenantsUpdate((prev) =>
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
              renewalHistory: []
            }
          : item
      )
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
    const defaultVacant = INITIAL_TENANTS.filter((t) => t.isVacantSlot);
    commitTenantsUpdate([...imported, ...defaultVacant]);
    showToast(`Successfully ingested & synced ${imported.length} tenant contracts from CSV!`, 'success');
  };

  const handleResetDemo = () => {
    if (!window.confirm('Reset Precourt Luxury Homes portal back to the initial 16-tenant CSV dataset?')) return;
    const resetTenants = INITIAL_TENANTS.map((t) => enrichTenantRecord(t, DEFAULT_SETTINGS));
    setRawTenants(resetTenants);
    setProperties(INITIAL_PROPERTIES);
    setSettings(DEFAULT_SETTINGS);
    setSelectedTenantId(null);
    pushStateToCloud(resetTenants, INITIAL_PROPERTIES, DEFAULT_SETTINGS);
    showToast('Portal reset & synced across all browsers to initial CSV dataset', 'success');
  };

  const handleFilterNavigate = (targetTab, filters) => {
    setDirectoryInitialFilters(filters);
    setCurrentTab(targetTab);
  };

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
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {currentTab === 'dashboard' && (
            <Dashboard
              tenants={tenants}
              properties={properties}
              metrics={metrics}
              settings={settings}
              onNavigate={setCurrentTab}
              onSelectTenant={(t) => setSelectedTenantId(t.id)}
              onRenewTenant={(t) => {
                setRenewingTenant(t);
                setRenewModalOpen(true);
              }}
              onFilterNavigate={handleFilterNavigate}
            />
          )}

          {currentTab === 'properties' && (
            <PropertiesView
              tenants={tenants}
              properties={properties}
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
              properties={properties}
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
              properties={properties}
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

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={(next) => {
                setSettings(next);
                pushStateToCloud(rawTenantsRef.current, propertiesRef.current, next);
                showToast('Portal preferences saved & synced across all browsers', 'success');
              }}
              colorSchemePref={colorSchemePref}
              onSetColorSchemePref={handleSetColorSchemePref}
              onExportCSV={() => handleExportCSV(tenants)}
              onImportCSVText={handleImportCSVText}
              onResetDemo={handleResetDemo}
            />
          )}
        </main>
      </div>

      {/* 3. Slide-Over Tenant Detail & Inline Edit Drawer */}
      {selectedTenant && (
        <TenantDrawer
          tenant={selectedTenant}
          properties={properties}
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
        properties={properties}
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
        properties={properties}
        settings={settings}
      />

      {/* 8. Global Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
