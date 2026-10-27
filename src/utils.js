// Utility functions for Precourt Luxury Homes — Property & Tenant Portal

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatCurrency(amount, symbol = 'GH₵') {
  if (amount === null || amount === undefined || amount === '' || Number.isNaN(Number(amount))) {
    return `${symbol} 0.00`;
  }
  const num = Number(amount);
  return `${symbol} ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactCurrency(amount, symbol = 'GH₵') {
  const num = Number(amount) || 0;
  if (num >= 1_000_000) {
    return `${symbol} ${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 10_000) {
    return `${symbol} ${(num / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(num, symbol);
}

// Parse either 'YYYY-MM-DD' or 'DD-MMM-YYYY' (e.g., '15-Mar-2025') into a UTC Date
export function parseDateUTC(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // Match YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  // Match DD-MMM-YYYY (e.g., 15-Mar-2025)
  const dmyMatch = clean.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const monStr = dmyMatch[2].toLowerCase();
    const year = Number(dmyMatch[3]);
    const monthIndex = MONTHS_SHORT.findIndex(m => m.toLowerCase() === monStr);
    if (monthIndex !== -1) {
      return new Date(Date.UTC(year, monthIndex, day));
    }
  }

  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }
  return null;
}

export function toISODateString(dateStr) {
  const d = parseDateUTC(dateStr);
  if (!d) return '';
  return d.toISOString().split('T')[0];
}

// Format date in '15-Mar-2025' CSV style
export function formatDateCSV(dateStr) {
  const d = parseDateUTC(dateStr);
  if (!d) return '—';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = MONTHS_SHORT[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  return `${day}-${mon}-${yr}`;
}

export function formatDate(dateStr) {
  return formatDateCSV(dateStr);
}

export function calculateMonthsBetween(startStr, endStr) {
  const s = parseDateUTC(startStr);
  const e = parseDateUTC(endStr);
  if (!s || !e) return 0;
  const yearsDiff = e.getUTCFullYear() - s.getUTCFullYear();
  const monthsDiff = e.getUTCMonth() - s.getUTCMonth();
  const totalMonths = yearsDiff * 12 + monthsDiff;
  return Math.max(1, totalMonths);
}

export function calculateDaysToExpiry(endDateStr, referenceDateStr = '2026-10-27') {
  const end = parseDateUTC(endDateStr);
  if (!end) return null;
  const ref = referenceDateStr === 'live'
    ? new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
    : (parseDateUTC(referenceDateStr) || new Date(Date.UTC(2026, 9, 27)));
  const diffMs = end.getTime() - ref.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function computeLeaseProgress(startDateStr, endDateStr, referenceDateStr = '2026-10-27') {
  const start = parseDateUTC(startDateStr);
  const end = parseDateUTC(endDateStr);
  if (!start || !end) return { totalDays: 0, elapsedDays: 0, remainingDays: 0, percentRemaining: 0, percentElapsed: 0 };
  const ref = referenceDateStr === 'live'
    ? new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
    : (parseDateUTC(referenceDateStr) || new Date(Date.UTC(2026, 9, 27)));

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.round((end.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = totalDays - remainingDays;

  const percentRemaining = Math.max(0, Math.min(100, Math.round((remainingDays / totalDays) * 100)));
  const percentElapsed = Math.max(0, Math.min(100, 100 - percentRemaining));

  return { totalDays, elapsedDays, remainingDays, percentRemaining, percentElapsed };
}

// Compute enriched tenant fields dynamically based on settings (reference date & threshold)
export function enrichTenantRecord(tenant, settings = {}) {
  const refDate = settings.referenceDateMode || '2026-10-27';
  const warningThreshold = Number(settings.expiryWarningThresholdDays) || 90;

  if (tenant.isVacantSlot || tenant.rentStatus === 'No Contract' || !tenant.contractEnd) {
    return {
      ...tenant,
      rentStatus: 'No Contract',
      daysToExpiry: null,
      expiryAlert: 'No Contract',
      totalRent: 0,
      durationMonths: 0,
      progress: { totalDays: 0, elapsedDays: 0, remainingDays: 0, percentRemaining: 0, percentElapsed: 0 }
    };
  }

  const days = calculateDaysToExpiry(tenant.contractEnd, refDate);
  const months = tenant.durationMonths || calculateMonthsBetween(tenant.contractStart, tenant.contractEnd) || 12;
  const monthlyRent = Number(tenant.monthlyRent) || 0;
  const totalRent = Number(tenant.totalRent) || (monthlyRent * months);

  let rentStatus = 'Active';
  let expiryAlert = 'OK';

  if (days !== null) {
    if (days < 0) {
      rentStatus = 'Expired';
      expiryAlert = 'OVERDUE / EXPIRED';
    } else if (days <= warningThreshold) {
      rentStatus = 'Expiring Soon';
      expiryAlert = `EXPIRING: ${warningThreshold} DAYS OR LESS`;
    } else {
      rentStatus = 'Active';
      expiryAlert = 'OK';
    }
  }

  const progress = computeLeaseProgress(tenant.contractStart, tenant.contractEnd, refDate);

  return {
    ...tenant,
    monthlyRent,
    durationMonths: months,
    totalRent,
    renewalDate: tenant.renewalDate || tenant.contractEnd,
    daysToExpiry: days,
    rentStatus,
    expiryAlert,
    progress
  };
}

export function formatDaysRemaining(days) {
  if (days === null || days === undefined) return 'No Contract';
  if (days < 0) return `${Math.abs(days)}d Overdue`;
  if (days === 0) return 'Expires Today';
  if (days === 1) return '1 Day Left';
  return `${days} Days Left`;
}

export function formatPhone(phone) {
  if (!phone) return '—';
  let clean = phone.toString().replace(/[^0-9]/g, '');
  if (!clean) return '—';
  if (clean.length === 9) clean = `0${clean}`;
  if (clean.length === 10) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }
  return clean;
}

export function getDialUrl(phone) {
  if (!phone) return '#';
  let clean = phone.toString().replace(/[^0-9]/g, '');
  if (!clean) return '#';
  if (clean.length === 9) clean = `0${clean}`;
  return `tel:${clean}`;
}

export function getWhatsAppUrl(phone, defaultMsg = '') {
  if (!phone) return '#';
  let clean = phone.toString().replace(/[^0-9]/g, '');
  if (!clean) return '#';
  if (clean.startsWith('0')) clean = clean.substring(1);
  if (!clean.startsWith('233')) clean = `233${clean}`;
  const encoded = encodeURIComponent(defaultMsg);
  return `https://wa.me/${clean}${defaultMsg ? `?text=${encoded}` : ''}`;
}

export function buildWhatsAppMessage(tenant, type = 'general', settings = {}) {
  const name = tenant.name || 'Valued Resident';
  const property = tenant.property || 'Precourt Luxury Homes';
  const unit = tenant.unit || 'Unit';
  const endDate = formatDateCSV(tenant.contractEnd);
  const days = tenant.daysToExpiry ?? 0;
  const daysAbs = Math.abs(days);
  const monthlyRent = formatCurrency(tenant.monthlyRent, settings.currencySymbol || 'GH₵');
  const totalRent = formatCurrency(tenant.totalRent, settings.currencySymbol || 'GH₵');

  let template = settings.whatsappTemplateGeneral;
  if (type === 'renewal' || (type === 'auto' && days >= 0 && days <= (settings.expiryWarningThresholdDays || 90))) {
    template = settings.whatsappTemplateRenewal ||
      'Dear {name}, this is a courtesy notice from Precourt Luxury Homes regarding your tenancy at {property} (Unit {unit}), which is scheduled to expire on {endDate} ({days} days remaining). Monthly Rate: {monthlyRent}. Kindly confirm your lease renewal plans at your earliest convenience.';
  } else if (type === 'overdue' || (type === 'auto' && days < 0)) {
    template = settings.whatsappTemplateOverdue ||
      'URGENT NOTICE: Dear {name}, your tenancy agreement at Precourt Luxury Homes ({property}, Unit {unit}) expired on {endDate} ({daysAbs} days ago). Please contact Management immediately to complete your renewal contract or schedule a handover inspection.';
  } else {
    template = settings.whatsappTemplateGeneral ||
      'Hello {name}, warm greetings from Precourt Luxury Homes Management ({property} — Unit {unit}).';
  }

  return template
    .replace(/\{name\}/g, name)
    .replace(/\{property\}/g, property)
    .replace(/\{unit\}/g, unit)
    .replace(/\{endDate\}/g, endDate)
    .replace(/\{days\}/g, String(days))
    .replace(/\{daysAbs\}/g, String(daysAbs))
    .replace(/\{monthlyRent\}/g, monthlyRent)
    .replace(/\{totalRent\}/g, totalRent);
}

export function getInitials(name) {
  if (!name || name.includes('Vacant Unit')) return 'VC';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'ok' || s === 'occupied' || s === 'paid in full') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  }
  if (s.includes('expiring') || s === 'expiring soon') {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35';
  }
  if (s.includes('overdue') || s.includes('expired')) {
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35';
  }
  return 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-400/30';
}

export function exportTenantsToCSV(tenants, filename = 'Precourt_Luxury_Homes_Tenants.csv') {
  const headers = [
    'Tenant ID',
    'Tenant Name',
    'Phone',
    'WhatsApp',
    'Email',
    'Property',
    'Apartment/Unit',
    'Contract Start',
    'Contract End',
    'Monthly Rent (GHS)',
    'No. of Months',
    'Total Rent to Pay (GHS)',
    'Renewal Date',
    'Rent Status',
    'Days to Expiry',
    'Expiry Alert',
    'Notes'
  ];

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    if (/[",\n]/.test(str)) return `"${str}"`;
    return str;
  };

  const rows = tenants.map(t => {
    if (t.rentStatus === 'No Contract' || t.isVacantSlot) {
      return [
        t.id.startsWith('VAC-') ? '' : t.id,
        t.isVacantSlot ? '' : t.name,
        t.phone || '',
        t.whatsapp || '',
        t.email || '',
        t.property || '',
        t.unit || '',
        '',
        '',
        '',
        '',
        '',
        '',
        'No Contract',
        '',
        '',
        t.notes || ''
      ].map(escapeCell).join(',');
    }

    const monthlyFormatted = Number(t.monthlyRent || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const totalFormatted = `GH₵${Number(t.totalRent || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    return [
      t.id,
      t.name,
      t.phone || '',
      t.whatsapp || '',
      t.email || '',
      t.property || '',
      t.unit || '',
      formatDateCSV(t.contractStart),
      formatDateCSV(t.contractEnd),
      monthlyFormatted,
      t.durationMonths || '',
      totalFormatted,
      t.renewalDate ? formatDateCSV(t.renewalDate) : '',
      t.rentStatus,
      t.daysToExpiry ?? '',
      t.expiryAlert || 'OK',
      t.notes || ''
    ].map(escapeCell).join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Parse uploaded/pasted CSV text into structured tenant records
export function parseCSVToTenants(csvText) {
  if (!csvText || !csvText.trim()) return [];
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length < 6) continue;
    const [
      id,
      name,
      phone,
      whatsapp,
      email,
      property,
      unit,
      contractStart,
      contractEnd,
      monthlyRentRaw,
      durationRaw,
      totalRentRaw,
      renewalDate,
      rentStatus,
      daysRaw,
      expiryAlert,
      notes
    ] = cols;

    // Skip empty "No Contract" filler rows that have no ID and no unit
    if (!id && !name && !unit) continue;

    const cleanMoney = (str) => {
      if (!str) return 0;
      return Number(String(str).replace(/[^0-9.-]/g, '')) || 0;
    };

    const monthlyRent = cleanMoney(monthlyRentRaw);
    const durationMonths = Number(durationRaw) || 12;
    const totalRent = cleanMoney(totalRentRaw) || (monthlyRent * durationMonths);

    parsed.push({
      id: id || `PLH-${String(parsed.length + 1).padStart(3, '0')}`,
      name: name || 'Unnamed Tenant',
      phone: phone || '',
      whatsapp: whatsapp || '',
      email: email || '',
      property: property || 'PLH-AM',
      unit: unit || '',
      contractStart: toISODateString(contractStart),
      contractEnd: toISODateString(contractEnd),
      monthlyRent,
      durationMonths,
      totalRent,
      renewalDate: toISODateString(renewalDate) || toISODateString(contractEnd),
      rentStatus: rentStatus || 'Active',
      daysToExpiry: daysRaw !== '' && daysRaw !== undefined ? Number(daysRaw) : null,
      expiryAlert: expiryAlert || 'OK',
      notes: notes || '',
      paymentStatus: 'Paid in Full',
      amountPaid: totalRent,
      renewalHistory: contractStart ? [
        {
          date: toISODateString(contractStart),
          period: `${contractStart} to ${contractEnd}`,
          months: durationMonths,
          monthlyRent,
          totalRent,
          type: `${durationMonths}-Month Tenancy Contract`
        }
      ] : []
    });
  }

  return parsed;
}

export function downloadCSV(filename, rows) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    '\uFEFF' +
    keys.join(separator) +
    '\n' +
    rows
      .map(row =>
        keys
          .map(k => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
          })
          .join(separator)
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
