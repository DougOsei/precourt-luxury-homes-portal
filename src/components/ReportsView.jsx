import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Wrench, 
  FileSpreadsheet, 
  Database, 
  RotateCcw,
  Calendar,
  Layers
} from 'lucide-react';
import { api } from '../api';
import { formatCurrency, formatDate, downloadCSV } from '../utils';

export default function ReportsView({ onShowToast, onResetData }) {
  const [cashflow, setCashflow] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cfData, analyticsData] = await Promise.all([
        api.getCashflowReport(),
        api.getMaintenanceAnalytics()
      ]);
      setCashflow(cfData);
      setAnalytics(analyticsData);
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // CSV Export handlers
  const handleExportTenants = async () => {
    try {
      const data = await api.getTenants();
      downloadCSV('tenants_directory.csv', data);
      onShowToast('Tenants directory exported to CSV', 'success');
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleExportPayments = async () => {
    try {
      const data = await api.getPayments();
      downloadCSV('rent_payments_ledger.csv', data);
      onShowToast('Rent payments ledger exported to CSV', 'success');
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleExportMaintenance = async () => {
    try {
      const data = await api.getMaintenance();
      downloadCSV('maintenance_requests_costs.csv', data);
      onShowToast('Maintenance records exported to CSV', 'success');
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const totalRentCollected = cashflow.reduce((a, b) => a + b.rentIncome, 0);
  const totalMaintSpent = cashflow.reduce((a, b) => a + b.maintenanceCost, 0);
  const netIncome = totalRentCollected - totalMaintSpent;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* 1. Cashflow High-Level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">6-Month Inflow</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {formatCurrency(totalRentCollected)}
          </div>
          <p className="mt-1 text-xs text-slate-500">Gross rental revenue collected</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">6-Month Outflow</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {formatCurrency(totalMaintSpent)}
          </div>
          <p className="mt-1 text-xs text-slate-500">Maintenance repairs & contractor costs</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Net Operating Income</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className={`mt-3 text-3xl font-extrabold ${netIncome >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {formatCurrency(netIncome)}
          </div>
          <p className="mt-1 text-xs text-slate-500">Net revenue after maintenance expenses</p>
        </div>
      </div>

      {/* 2. Monthly Cash Flow Table & Visual Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Monthly Cash Flow & Operating Performance
            </h2>
            <p className="text-xs text-slate-500">Comparison of rent income versus property maintenance expenses</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3 text-right">Rent Income (+)</th>
                <th className="px-5 py-3 text-right">Maintenance Cost (-)</th>
                <th className="px-5 py-3 text-right">Net Cash Flow</th>
                <th className="px-5 py-3">Expense Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cashflow.map(cf => {
                const ratio = cf.rentIncome > 0 ? Math.round((cf.maintenanceCost / cf.rentIncome) * 100) : 0;
                return (
                  <tr key={cf.month} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5 font-bold text-slate-800">
                      {cf.month}
                    </td>

                    <td className="px-5 py-3.5 text-right font-extrabold text-emerald-600">
                      {formatCurrency(cf.rentIncome)}
                    </td>

                    <td className="px-5 py-3.5 text-right font-semibold text-rose-600">
                      {formatCurrency(cf.maintenanceCost)}
                    </td>

                    <td className="px-5 py-3.5 text-right font-extrabold text-slate-900">
                      <span className={cf.netCashflow >= 0 ? 'text-indigo-600' : 'text-rose-600'}>
                        {formatCurrency(cf.netCashflow)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${ratio > 30 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${Math.min(ratio, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{ratio}%</span>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Maintenance Cost Breakdown by Category */}
      {analytics?.byCategory && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-600" />
              Maintenance Cost Distribution by Trade Category
            </h2>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {analytics.byCategory.map(cat => (
              <div key={cat.category} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="capitalize font-bold text-slate-800 text-sm">
                    {cat.category?.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                    {cat.total_requests} tickets
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500">Total Spent:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{formatCurrency(cat.total_actual_cost || 0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Data Export & Backup Tools Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div>
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Download className="w-4 h-4 text-indigo-600" />
            Data Export & Accounting Downloads
          </h2>
          <p className="text-xs text-slate-500">Export table data to CSV spreadsheets or backup entire SQL database</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <button
            onClick={handleExportTenants}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition text-left group"
          >
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm block">Export Tenants</span>
              <span className="text-xs text-slate-500">Download tenants_directory.csv</span>
            </div>
          </button>

          <button
            onClick={handleExportPayments}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition text-left group"
          >
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm block">Export Payments</span>
              <span className="text-xs text-slate-500">Download payments_ledger.csv</span>
            </div>
          </button>

          <button
            onClick={handleExportMaintenance}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition text-left group"
          >
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm block">Export Maintenance</span>
              <span className="text-xs text-slate-500">Download maintenance_costs.csv</span>
            </div>
          </button>
        </div>

        {/* Database JSON Backup & Reset Bar */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-200 text-slate-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm block">Complete Database JSON Backup</span>
              <span className="text-xs text-slate-500">Download full backup file containing all relational data</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <a
              href="/api/export/backup"
              download="rental_database_backup.json"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download Backup JSON
            </a>
            <button
              onClick={onResetData}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Data
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
