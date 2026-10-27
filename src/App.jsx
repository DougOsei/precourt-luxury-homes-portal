import React, { useState, useEffect, useMemo } from 'react';
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

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [autoTick, setAutoTick] = useState(0);

  // Directory cross-navigation filter state
  const [directoryInitialFilters, setDirectoryInitialFilters] = useState(null);

  // Load persisted state from LocalStorage or fall back to initial CSV data
  const [rawTenants, setRawTenants] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TENANTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t) => enrichTenantRecord(t, DEFAULT_SETTINGS));
        }
      }
    } catch (e) {
      console.error('Failed to read tenants from localStorage:', e);
    }
    return INITIAL_TENANTS.map((t) => enrichTenantRecord(t, DEFAULT_SETTINGS));
  });

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

  // Auto-update ticker: re-evaluates contract countdowns and expiry alerts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAutoTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Persist to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TENANTS, JSON.stringify(rawTenants));
    } catch (e) {}
  }, [rawTenants]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(properties));
    } catch (e) {}
  }, [properties]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {}
  }, [settings]);

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

  // Handlers for CRUD & Lease Actions
  const handleSaveTenantModal = (formData) => {
    setRawTenants((prev) => {
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
        ? `Updated record for ${formData.name} (${formData.id})`
        : `Registered ${formData.name} in Unit ${formData.unit}`,
      'success'
    );
  };

  const handleSaveInlineDrawer = (updatedTenant) => {
    setRawTenants((prev) =>
      prev.map((item) => (item.id === selectedTenantId ? { ...item, ...updatedTenant, isVacantSlot: false } : item))
    );
    setSelectedTenantId(updatedTenant.id);
    showToast(`Saved changes for ${updatedTenant.name} (${updatedTenant.id})`, 'success');
  };

  const handleConfirmRenewLease = (tenant, renewalDetails) => {
    setRawTenants((prev) =>
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
      `Lease renewed for ${tenant.name} (${tenant.unit}) until ${formatDateCSV(renewalDetails.contractEnd)}`,
      'success'
    );
  };

  const handleDeleteTenant = (tenant) => {
    if (!window.confirm(`Remove tenant record "${tenant.name}" (${tenant.id}) and mark Unit ${tenant.unit} as Vacant?`)) {
      return;
    }
    setRawTenants((prev) =>
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
    setRawTenants([...imported, ...defaultVacant]);
    showToast(`Successfully ingested ${imported.length} tenant contracts from CSV!`, 'success');
  };

  const handleResetDemo = () => {
    if (!window.confirm('Reset Precourt Luxury Homes portal back to the initial 16-tenant CSV dataset?')) return;
    setRawTenants(INITIAL_TENANTS);
    setProperties(INITIAL_PROPERTIES);
    setSettings(DEFAULT_SETTINGS);
    setSelectedTenantId(null);
    showToast('Portal reset to initial Precourt Luxury Homes CSV dataset', 'success');
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
                showToast('Portal preferences saved successfully', 'success');
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
