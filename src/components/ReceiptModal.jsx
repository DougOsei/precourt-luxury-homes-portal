import React, { useRef } from 'react';
import { X, Printer, CheckCircle, Building2, Calendar, CreditCard, Hash, User } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';

export default function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header toolbar */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            Official Rent Payment Receipt
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-8 font-sans">
          {/* Company & Receipt Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  PLH
                </div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">PLH Facility Management</h1>
              </div>
              <p className="text-xs text-slate-500">Rental Properties & Tenant Administration Office</p>
              <p className="text-xs text-slate-500">Amasaman (PLH-AM) • Kwabenya (PLH-KW) • Accra, Ghana</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md mb-1.5">
                Payment Completed
              </span>
              <p className="text-xs font-mono text-slate-500">Receipt #{receipt.receipt_number}</p>
              <p className="text-xs text-slate-500">Date: {formatDate(receipt.payment_date)}</p>
            </div>
          </div>

          {/* Tenant & Property Details Grid */}
          <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50/70 border border-slate-100 text-sm mb-6">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Received From (Tenant)
              </div>
              <p className="font-bold text-slate-800 text-base">{receipt.first_name} {receipt.last_name}</p>
              <p className="text-xs text-slate-600">{receipt.tenant_email}</p>
              <p className="text-xs text-slate-600">{receipt.tenant_phone}</p>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Property & Unit
              </div>
              <p className="font-bold text-slate-800 text-base">{receipt.property_name}</p>
              <p className="text-xs text-slate-600">Unit #{receipt.unit_number}</p>
              <p className="text-xs text-slate-500">{receipt.property_address}, {receipt.city}, {receipt.state}</p>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="mb-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2">Description</th>
                  <th className="py-2">Method</th>
                  <th className="py-2">Reference</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 font-medium text-slate-800">
                    Monthly Rent Payment
                    {receipt.charge_description && <span className="block text-xs text-slate-500 font-normal">{receipt.charge_description}</span>}
                  </td>
                  <td className="py-3 text-slate-600 capitalize">
                    {receipt.payment_method?.replace('_', ' ')}
                  </td>
                  <td className="py-3 font-mono text-xs text-slate-500">
                    {receipt.reference_no || 'N/A'}
                  </td>
                  <td className="py-3 text-right font-bold text-slate-900">
                    {formatCurrency(receipt.amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total Box */}
          <div className="flex justify-end border-t border-slate-200 pt-4 mb-6">
            <div className="w-56 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Monthly Rent Rate:</span>
                <span>{formatCurrency(receipt.monthly_rent || receipt.amount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Paid:</span>
                <span className="text-emerald-600">{formatCurrency(receipt.amount)}</span>
              </div>
            </div>
          </div>

          {receipt.notes && (
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-6">
              <span className="font-semibold text-slate-700">Notes: </span>
              {receipt.notes}
            </div>
          )}

          {/* Footer certification */}
          <div className="pt-6 border-t border-dashed border-slate-200 text-center">
            <p className="text-xs font-medium text-slate-500">
              Thank you for your payment. This is an official computer-generated receipt.
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Generated on {new Date().toLocaleString()} • EstateMaster Property Cloud
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
