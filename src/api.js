// API client wrapper for Facility & Tenant Management

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Dashboard
  getDashboardStats: () => request('/dashboard/stats'),

  // Properties
  getProperties: () => request('/properties'),
  getProperty: (id) => request(`/properties/${id}`),
  createProperty: (data) => request('/properties', { method: 'POST', body: data }),
  updateProperty: (id, data) => request(`/properties/${id}`, { method: 'PUT', body: data }),
  deleteProperty: (id) => request(`/properties/${id}`, { method: 'DELETE' }),

  // Units
  getUnits: (params = {}) => {
    const searchParams = new URLSearchParams(params).toString();
    return request(`/units${searchParams ? `?${searchParams}` : ''}`);
  },
  getUnit: (id) => request(`/units/${id}`),
  createUnit: (data) => request('/units', { method: 'POST', body: data }),
  updateUnit: (id, data) => request(`/units/${id}`, { method: 'PUT', body: data }),
  deleteUnit: (id) => request(`/units/${id}`, { method: 'DELETE' }),

  // Tenants
  getTenants: () => request('/tenants'),
  getTenant: (id) => request(`/tenants/${id}`),
  createTenant: (data) => request('/tenants', { method: 'POST', body: data }),
  updateTenant: (id, data) => request(`/tenants/${id}`, { method: 'PUT', body: data }),
  deleteTenant: (id) => request(`/tenants/${id}`, { method: 'DELETE' }),

  // Leases
  getLeases: () => request('/leases'),
  createLease: (data) => request('/leases', { method: 'POST', body: data }),
  updateLease: (id, data) => request(`/leases/${id}`, { method: 'PUT', body: data }),
  terminateLease: (id, data) => request(`/leases/${id}/terminate`, { method: 'POST', body: data }),
  renewLease: (id, data) => request(`/leases/${id}/renew`, { method: 'POST', body: data }),

  // Finances & Balances
  getBalances: () => request('/finances/balances'),
  getCharges: () => request('/finances/charges'),
  createCharge: (data) => request('/finances/charges', { method: 'POST', body: data }),
  generateMonthlyCharges: (month) => request('/finances/generate-monthly-charges', { method: 'POST', body: { month } }),
  getPayments: () => request('/finances/payments'),
  createPayment: (data) => request('/finances/payments', { method: 'POST', body: data }),
  getReceipt: (id) => request(`/finances/receipt/${id}`),

  // Maintenance & Costs
  getMaintenance: (params = {}) => {
    const searchParams = new URLSearchParams(params).toString();
    return request(`/maintenance${searchParams ? `?${searchParams}` : ''}`);
  },
  createMaintenance: (data) => request('/maintenance', { method: 'POST', body: data }),
  updateMaintenance: (id, data) => request(`/maintenance/${id}`, { method: 'PUT', body: data }),
  updateMaintenanceStatus: (id, data) => request(`/maintenance/${id}/status`, { method: 'PATCH', body: data }),
  deleteMaintenance: (id) => request(`/maintenance/${id}`, { method: 'DELETE' }),
  getMaintenanceAnalytics: () => request('/maintenance-analytics/summary'),

  // Reports & Backup
  getCashflowReport: () => request('/reports/cashflow'),
  getBackupUrl: () => `${API_BASE}/export/backup`,
  resetSeedData: () => request('/seed/reset', { method: 'POST' }),
};
