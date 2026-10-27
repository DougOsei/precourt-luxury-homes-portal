import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Home,
  Users,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  UserPlus,
  Eye,
  RefreshCw,
  MessageSquare,
  Sparkles,
  Search
} from 'lucide-react';
import {
  formatCurrency,
  formatDateCSV,
  getWhatsAppUrl,
  buildWhatsAppMessage
} from '../utils';

export default function PropertiesView({
  tenants,
  properties,
  settings,
  onSelectTenant,
  onEditTenant,
  onRenewTenant,
  onOpenAddTenant
}) {
  const [selectedProperty, setSelectedProperty] = useState('all'); // 'all' | 'PLH-AM' | 'PLH-KW'
  const [unitStatusFilter, setUnitStatusFilter] = useState('all'); // 'all' | 'occupied' | 'vacant' | 'alerts'
  const [search, setSearch] = useState('');

  const sym = settings?.currencySymbol || 'GH₵';

  // Compute property cards with live occupancy & financial figures
  const enrichedProperties = properties.map((prop) => {
    const propRecords = tenants.filter((t) => t.property === prop.id);
    const occupiedList = propRecords.filter((t) => !t.isVacantSlot && t.rentStatus !== 'No Contract');
    const vacantList = propRecords.filter((t) => t.isVacantSlot || t.rentStatus === 'No Contract');
    const totalUnits = Math.max(prop.totalUnits || 8, occupiedList.length + vacantList.length);
    const occupiedCount = occupiedList.length;
    const vacantCount = Math.max(0, totalUnits - occupiedCount);
    const occRate = totalUnits > 0 ? Math.round((occupiedCount / totalUnits) * 100) : 0;

    const monthlyRevenue = occupiedList.reduce((sum, t) => sum + (Number(t.monthlyRent) || 0), 0);
    const potentialMonthly = monthlyRevenue + vacantCount * (prop.defaultRent || 2000);
    const contractValue = occupiedList.reduce((sum, t) => sum + (Number(t.totalRent) || 0), 0);

    return {
      ...prop,
      totalUnits,
      occupiedCount,
      vacantCount,
      occRate,
      monthlyRevenue,
      potentialMonthly,
      contractValue
    };
  });

  // Sort units naturally (AM-01..AM-10, KW-01..KW-10)
  const sortedUnits = [...tenants]
    .filter((t) => {
      if (selectedProperty !== 'all' && t.property !== selectedProperty) return false;
      const isVac = t.isVacantSlot || t.rentStatus === 'No Contract';
      if (unitStatusFilter === 'occupied' && isVac) return false;
      if (unitStatusFilter === 'vacant' && !isVac) return false;
      if (unitStatusFilter === 'alerts' && (isVac || t.rentStatus === 'Active')) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.unit?.toLowerCase().includes(q) ||
          t.name?.toLowerCase().includes(q) ||
          t.id?.toLowerCase().includes(q) ||
          t.property?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => (a.unit || '').localeCompare(b.unit || '', undefined, { numeric: true }));

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      {/* 1. Luxury Property Portfolio Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {enrichedProperties.map((prop) => {
          const isAM = prop.id === 'PLH-AM';
          const isSelected = selectedProperty === prop.id;

          return (
            <div
              key={prop.id}
              className={`group bg-white dark:bg-slate-900 rounded-2xl border transition-all overflow-hidden shadow-xs hover:shadow-xl ${
                isSelected
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200/80 dark:border-slate-800/90'
              }`}
            >
              {/* Banner Photo & Badges */}
              <div className="relative h-48 overflow-hidden bg-slate-950">
                <img
                  src={prop.image}
                  alt={prop.name}
                  className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />

                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-xl font-mono text-xs font-black shadow-md ${
                      isAM
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {prop.id}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-950/75 text-white backdrop-blur-xs border border-white/15">
                    {prop.type}
                  </span>
                </div>

                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-white/95 text-slate-900 shadow-md">
                    {prop.occRate}% Occupied ({prop.occupiedCount}/{prop.totalUnits})
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2">
                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                      {prop.name}
                    </h2>
                    <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      {prop.location}
                    </p>
                  </div>
                </div>
              </div>

              {/* Property Metrics & Amenities */}
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {prop.description}
                </p>

                {/* Amenity Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {prop.amenities?.map((am) => (
                    <span
                      key={am}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      {am}
                    </span>
                  ))}
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Occupancy Split
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                      {prop.occupiedCount} Occ • {prop.vacantCount} Vac
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">
                      Monthly Revenue
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                      {formatCurrency(prop.monthlyRevenue, sym)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300 block">
                      Contract Value
                    </span>
                    <span className="text-sm font-black font-mono text-amber-800 dark:text-amber-300 mt-0.5 block">
                      {formatCurrency(prop.contractValue, sym)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Standard Rate: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatCurrency(prop.defaultRent, sym)}/mo</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedProperty(isSelected ? 'all' : prop.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isSelected ? `Showing Only ${prop.id}` : `Filter ${prop.id} Units`}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Interactive Unit Occupancy Grid Header & Filter Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Home className="w-4 h-4 text-emerald-500" />
              Apartment & Unit Occupancy Grid ({sortedUnits.length} Units)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visual unit-by-unit status across Amamoley (AM-01 to AM-08) and Kwabenya (KW-01 to KW-08) — 100% Occupied
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Property Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              {[
                { id: 'all', label: 'All Properties' },
                { id: 'PLH-AM', label: 'PLH-AM' },
                { id: 'PLH-KW', label: 'PLH-KW' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedProperty(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    selectedProperty === tab.id
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Status Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              {[
                { id: 'all', label: 'All Units' },
                { id: 'occupied', label: 'Occupied' },
                { id: 'vacant', label: 'Vacant' },
                { id: 'alerts', label: 'Alerts Only' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setUnitStatusFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    unitStatusFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find unit or tenant..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Unit Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedUnits.map((u) => {
            const isVacant = u.isVacantSlot || u.rentStatus === 'No Contract';
            const isExpired = u.rentStatus === 'Expired';
            const isExpiring = u.rentStatus === 'Expiring Soon';
            const isAM = u.property === 'PLH-AM';
            const waPhone = u.whatsapp || u.phone;

            return (
              <div
                key={u.id}
                onClick={() => onSelectTenant(u)}
                className={`group rounded-2xl p-4 border transition-all flex flex-col justify-between cursor-pointer ${
                  isVacant
                    ? 'bg-slate-50/70 dark:bg-slate-800/30 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500/50'
                    : isExpired
                      ? 'bg-rose-500/5 dark:bg-rose-950/15 border-rose-500/35 hover:border-rose-500'
                      : isExpiring
                        ? 'bg-amber-500/5 dark:bg-amber-950/15 border-amber-500/35 hover:border-amber-500'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Card Top Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-xl font-mono text-xs font-black ${
                          isAM
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 dark:bg-slate-800 text-amber-300 border border-amber-400/30'
                        }`}
                      >
                        {u.unit}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">{u.property}</span>
                    </div>

                    {isVacant ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Vacant
                      </span>
                    ) : isExpired ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                        Overdue ({u.daysToExpiry}d)
                      </span>
                    ) : isExpiring ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                        {u.daysToExpiry}d Left
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        {u.daysToExpiry}d • OK
                      </span>
                    )}
                  </div>

                  {/* Resident Info */}
                  {isVacant ? (
                    <div className="py-2">
                      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
                        No Active Contract
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                        {u.notes || 'Ready for immediate tenant assignment.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {u.id}
                        </span>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                          {u.name}
                        </h4>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {formatDateCSV(u.contractStart)} → {formatDateCSV(u.contractEnd)} ({u.durationMonths}m)
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Financials & Quick Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono font-extrabold text-slate-900 dark:text-white">
                      {formatCurrency(u.monthlyRent, sym)}
                      <span className="text-[10px] font-normal text-slate-400">/mo</span>
                    </div>
                    {!isVacant && (
                      <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        Total: {formatCurrency(u.totalRent, sym)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {isVacant ? (
                      <button
                        type="button"
                        onClick={() => onEditTenant(u)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Assign
                      </button>
                    ) : (
                      <>
                        {waPhone && (
                          <a
                            href={getWhatsAppUrl(waPhone, buildWhatsAppMessage(u, 'auto', settings))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 transition"
                            title="WhatsApp Resident"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onRenewTenant(u)}
                          className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 transition cursor-pointer"
                          title="Renew Lease"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectTenant(u)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
