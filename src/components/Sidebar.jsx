import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Hourglass,
  Wallet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Crown,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  UserCog,
  LogOut,
  Activity,
  Wrench
} from 'lucide-react';
import { getInitials } from '../utils';

export default function Sidebar({
  currentTab,
  setCurrentTab,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  metrics,
  themeMode,
  onToggleTheme,
  settings,
  onResetDemo,
  currentUser,
  onLogout,
  auditLogsCount = 0,
  overdueMaintenanceCount = 0
}) {
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const baseNavItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      subtitle: 'Overview, KPIs & analytics',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'maintenance-fees',
      label: 'Maintenance Fees & Ops',
      subtitle: 'GH₵ 3,000 fee & facility ops',
      icon: Wrench,
      badge: overdueMaintenanceCount > 0 ? `${overdueMaintenanceCount} overdue` : 'GH₵ 3k',
      badgeClass: overdueMaintenanceCount > 0
        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse font-bold'
        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
    },
    {
      id: 'properties',
      label: 'Properties & Units',
      subtitle: 'Occupancy & unit cards',
      icon: Building2,
      badge: `${metrics.occupiedUnits}/${metrics.totalUnits}`,
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    },
    {
      id: 'tenants',
      label: 'Tenants Directory',
      subtitle: 'Interactive grid & filters',
      icon: Users,
      badge: `${metrics.occupiedUnits}`,
      badgeClass: 'bg-slate-800 text-slate-200 border border-slate-700'
    },
    {
      id: 'leases',
      label: 'Lease & Expirations',
      subtitle: 'Renewal pipeline & alerts',
      icon: Hourglass,
      badge: (metrics.expiringSoonCount + metrics.expiredCount) > 0
        ? `${metrics.expiringSoonCount + metrics.expiredCount} alert`
        : 'All OK',
      badgeClass: metrics.expiredCount > 0
        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
        : metrics.expiringSoonCount > 0
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          : 'bg-emerald-500/20 text-emerald-300'
    },
    {
      id: 'finances',
      label: 'Financials & Revenue',
      subtitle: 'Collections in GH₵ (GHS)',
      icon: Wallet,
      badge: 'GHS',
      badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono'
    },
    {
      id: 'activity-log',
      label: 'Activity & Audit Log',
      subtitle: 'Logins & record updates',
      icon: Activity,
      badge: auditLogsCount > 0 ? `${auditLogsCount}` : 'LIVE',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono'
    },
    {
      id: 'settings',
      label: 'Settings / Preferences',
      subtitle: 'Currency & alert thresholds',
      icon: Settings,
      badge: null
    }
  ];

  const adminNavItems = isSuperAdmin
    ? [
        {
          id: 'managers',
          label: 'Manager Provisioning',
          subtitle: 'Super Admin (/admin/managers)',
          icon: UserCog,
          badge: 'ADMIN',
          badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
        }
      ]
    : [];

  const navItems = [...baseNavItems, ...adminNavItems];

  const isDarkRendered = themeMode === 'dark';

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Collapsible Luxury Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-slate-950 text-slate-200 border-r border-slate-800/90 flex flex-col transition-all duration-300 ease-in-out select-none shadow-2xl ${
          collapsed ? 'lg:w-20' : 'lg:w-72'
        } ${mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Top Luxury Branding Header */}
        <div className="relative h-20 flex items-center justify-between px-4 border-b border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-slate-950">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 p-0.5 shadow-lg shadow-emerald-950/60 ring-1 ring-amber-400/40">
              <div className="w-full h-full bg-slate-950/35 rounded-[14px] flex flex-col items-center justify-center">
                <Crown className="w-4 h-4 text-amber-300 -mb-0.5" />
                <span className="text-[10px] font-black tracking-widest text-white">PLH</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" title="System Online" />
            </div>

            {(!collapsed || mobileOpen) && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-extrabold text-white text-sm tracking-tight truncate">
                    Precourt Luxury Homes
                  </h1>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                </div>
                <p className="text-[11px] text-emerald-400/90 font-semibold tracking-wide truncate">
                  Property & Facility Management
                </p>
              </div>
            )}
          </div>

          {/* Desktop Collapse Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition shrink-0"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Portfolio Summary Mini Banner (when expanded) */}
        {(!collapsed || mobileOpen) && (
          <div className="mx-3.5 mt-4 p-3 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800/90">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Portfolio Live
              </span>
              <span className="font-mono text-emerald-400 font-bold">{metrics.occupancyRate}% Occ.</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${metrics.occupancyRate}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>PLH-AM • PLH-KW</span>
              <span className="text-slate-200 font-semibold">{metrics.occupiedUnits} Active Units</span>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {(!collapsed || mobileOpen) && (
            <div className="px-3 pb-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-500">
              Executive Portal
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setMobileOpen(false);
                }}
                title={collapsed ? `${item.label} — ${item.subtitle}` : undefined}
                className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/90'
                }`}
              >
                <div className={`flex items-center gap-3 min-w-0 ${collapsed && !mobileOpen ? 'mx-auto' : ''}`}>
                  <div
                    className={`p-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white/15 text-amber-300'
                        : 'bg-slate-900 text-slate-400 group-hover:text-emerald-400 group-hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                  </div>
                  {(!collapsed || mobileOpen) && (
                    <div className="min-w-0">
                      <div className={`text-sm font-bold leading-tight truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                        {item.label}
                      </div>
                      <div className={`text-[11px] truncate ${isActive ? 'text-emerald-100/80' : 'text-slate-500'}`}>
                        {item.subtitle}
                      </div>
                    </div>
                  )}
                </div>

                {(!collapsed || mobileOpen) && item.badge && (
                  <span
                    className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      isActive
                        ? 'bg-slate-950/35 text-amber-200 border border-white/15'
                        : item.badgeClass
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer: Admin Profile Summary & Dark/Light Mode Toggle */}
        <div className="p-3 border-t border-slate-800/90 bg-slate-950/90 space-y-2.5">
          {/* Quick Theme Toggle & Demo Reset */}
          <div className={`flex items-center gap-2 ${collapsed && !mobileOpen ? 'flex-col' : ''}`}>
            <button
              onClick={onToggleTheme}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition cursor-pointer"
              title={isDarkRendered ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkRendered ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {(!collapsed || mobileOpen) && <span>Light Mode</span>}
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {(!collapsed || mobileOpen) && <span>Dark Mode</span>}
                </>
              )}
            </button>
          </div>

          {/* Authenticated Manager Profile Summary & Sign Out */}
          <div className={`flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/70 border border-slate-800/80 ${collapsed && !mobileOpen ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-600 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
              {getInitials(currentUser?.fullName || settings?.adminName || 'Douglas Amadie')}
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">
                  {currentUser?.fullName || settings?.adminName || 'Douglas Amadie'}
                </div>
                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  {currentUser?.role || 'FACILITY_MANAGER'}
                </div>
              </div>
            )}
            {onLogout && (!collapsed || mobileOpen) && (
              <button
                type="button"
                onClick={onLogout}
                title="Sign Out of Portal"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
