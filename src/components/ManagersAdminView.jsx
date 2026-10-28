import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import {
  ShieldCheck,
  UserPlus,
  KeyRound,
  Building2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  Sparkles,
  Calendar,
  Mail,
  UserCheck,
  AlertTriangle,
  X
} from 'lucide-react';
import { getInitials, formatDateCSV } from '../utils';

const CreateManagerClientSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required (min 2 characters)').max(120),
  email: z.string().trim().email('Please enter a valid email address'),
  role: z.enum(['SUPER_ADMIN', 'FACILITY_MANAGER']),
  assignedProperties: z.array(z.enum(['PLH-AM', 'PLH-KW'])).min(1, 'Select at least one property'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/\d/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  requirePasswordReset: z.boolean()
});

// Cryptographically secure temporary password generator (satisfies all complexity rules)
function generateSecurePassword(length = 14) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;

  const randByte = (max) => {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] % max;
  };

  const chars = [
    upper[randByte(upper.length)],
    lower[randByte(lower.length)],
    digits[randByte(digits.length)],
    symbols[randByte(symbols.length)]
  ];

  for (let i = chars.length; i < length; i++) {
    chars.push(all[randByte(all.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randByte(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export default function ManagersAdminView({
  currentUser,
  csrfToken,
  properties = [],
  onShowToast
}) {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Add New Manager Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('FACILITY_MANAGER');
  const [assignedProperties, setAssignedProperties] = useState(['PLH-AM', 'PLH-KW']);
  const [passwordMode, setPasswordMode] = useState('generate'); // 'generate' | 'manual'
  const [password, setPassword] = useState(() => generateSecurePassword());
  const [showPassword, setShowPassword] = useState(true);
  const [requirePasswordReset, setRequirePasswordReset] = useState(true);
  const [copiedPass, setCopiedPass] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset Password Modal State
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetShowPass, setResetShowPass] = useState(true);
  const [resetRequireFirstLogin, setResetRequireFirstLogin] = useState(true);
  const [resetCopied, setResetCopied] = useState(false);
  const [resetError, setResetError] = useState('');

  const fetchManagers = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/managers', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Failed to load manager directory.');
      } else {
        setManagers(Array.isArray(data.managers) ? data.managers : []);
      }
    } catch (e) {
      setErrorMsg('Network error loading managers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  const togglePropertySelection = (code) => {
    setAssignedProperties((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const handleOpenAddModal = () => {
    setFullName('');
    setEmail('');
    setRole('FACILITY_MANAGER');
    setAssignedProperties(['PLH-AM', 'PLH-KW']);
    setPasswordMode('generate');
    setPassword(generateSecurePassword());
    setShowPassword(true);
    setRequirePasswordReset(true);
    setFormError('');
    setAddModalOpen(true);
  };

  const handleCreateManager = async (e) => {
    e.preventDefault();
    setFormError('');

    const parsed = CreateManagerClientSchema.safeParse({
      fullName,
      email,
      role,
      assignedProperties,
      password,
      requirePasswordReset
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Please check the form fields.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/managers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        },
        body: JSON.stringify(parsed.data)
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFormError(data.error || 'Could not create manager account.');
        setSubmitting(false);
        return;
      }

      if (Array.isArray(data.managers)) {
        setManagers(data.managers);
      } else {
        fetchManagers();
      }
      setAddModalOpen(false);
      onShowToast &&
        onShowToast(
          `Provisioned ${parsed.data.role} account for ${parsed.data.fullName}`,
          'success'
        );
    } catch (err) {
      setFormError('Network error while creating manager.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenResetModal = (mgr) => {
    setResetTarget(mgr);
    setResetPasswordVal(generateSecurePassword());
    setResetShowPass(true);
    setResetRequireFirstLogin(true);
    setResetError('');
  };

  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError('');

    if (resetPasswordVal.length < 8) {
      setResetError('Password must be at least 8 characters with upper, lower, number, and symbol.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/managers', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        },
        body: JSON.stringify({
          action: 'reset_password',
          managerId: resetTarget.id,
          newPassword: resetPasswordVal,
          requirePasswordReset: resetRequireFirstLogin
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResetError(data.error || 'Could not reset password.');
        setSubmitting(false);
        return;
      }

      if (Array.isArray(data.managers)) {
        setManagers(data.managers);
      }
      setResetTarget(null);
      onShowToast &&
        onShowToast(`Password rotated for ${resetTarget.fullName} (Bcrypt Cost 12)`, 'success');
    } catch (err) {
      setResetError('Network error while resetting password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAccountStatus = async (mgr) => {
    const nextStatus = mgr.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await fetch('/api/admin/managers', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        },
        body: JSON.stringify({
          managerId: mgr.id,
          status: nextStatus
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onShowToast && onShowToast(data.error || 'Could not update status', 'error');
        return;
      }
      if (Array.isArray(data.managers)) setManagers(data.managers);
      onShowToast &&
        onShowToast(`${mgr.fullName} account marked ${nextStatus}`, 'info');
    } catch (e) {
      onShowToast && onShowToast('Failed to update account status', 'error');
    }
  };

  const handleToggleManagerProperty = async (mgr, propCode) => {
    const currentProps = Array.isArray(mgr.assignedProperties)
      ? mgr.assignedProperties
      : ['PLH-AM', 'PLH-KW'];
    const exists = currentProps.includes(propCode);
    const nextProps = exists
      ? currentProps.filter((p) => p !== propCode)
      : [...currentProps, propCode];

    if (nextProps.length === 0) {
      onShowToast && onShowToast('A manager must have at least one assigned property.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/managers', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        },
        body: JSON.stringify({
          managerId: mgr.id,
          assignedProperties: nextProps
        })
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.managers)) {
        setManagers(data.managers);
        onShowToast &&
          onShowToast(
            `Updated property permissions for ${mgr.fullName} (${nextProps.join(', ')})`,
            'success'
          );
      }
    } catch (e) {}
  };

  if (currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center max-w-xl mx-auto my-12">
        <Lock className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
          403 Forbidden — Super Admin Access Required
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Your account ({currentUser?.fullName} • {currentUser?.role}) does not have permission to access `/admin/managers`.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Executive Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            SUPER_ADMIN ACCESS • /admin/managers
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
            Super Admin Manager Provisioning &amp; Access Control
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Provision Facility Managers, assign property permissions (PLH-AM &amp; PLH-KW), and rotate Bcrypt (cost 12) credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchManagers}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            title="Refresh Manager Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/20 ring-1 ring-emerald-400/30 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Manager</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Manager Directory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Authorized Administrative &amp; Facility Managers ({managers.length})
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Click any property badge to toggle facility assignment for a manager
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
            Hash: Bcrypt (Cost 12)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-950/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <th className="py-3.5 px-5">Manager Profile</th>
                <th className="py-3.5 px-4">Email &amp; Username</th>
                <th className="py-3.5 px-4">Assigned Role</th>
                <th className="py-3.5 px-4">Assigned Properties</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-5 text-right">Security Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 text-xs">
              {managers.map((mgr) => {
                const isSuper = mgr.role === 'SUPER_ADMIN';
                const isActive = mgr.status === 'Active';
                const propsList = Array.isArray(mgr.assignedProperties)
                  ? mgr.assignedProperties
                  : ['PLH-AM', 'PLH-KW'];

                return (
                  <tr
                    key={mgr.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                            isSuper
                              ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950'
                              : 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white'
                          }`}
                        >
                          {getInitials(mgr.fullName)}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                            <span>{mgr.fullName}</span>
                            {mgr.requirePasswordReset && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                                Reset on Next Login
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">{mgr.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{mgr.email}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        @{mgr.username}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                          isSuper
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {mgr.role}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['PLH-AM', 'PLH-KW'].map((code) => {
                          const assigned = propsList.includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              onClick={() => handleToggleManagerProperty(mgr, code)}
                              title={`Click to ${assigned ? 'revoke' : 'assign'} ${code}`}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                assigned
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60'
                              }`}
                            >
                              <Building2 className="w-3 h-3 inline mr-1" />
                              {code}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-4 px-4 font-mono text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDateCSV((mgr.createdAt || '').split('T')[0])}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleAccountStatus(mgr)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {isActive ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        )}
                        <span>{mgr.status}</span>
                      </button>
                    </td>

                    <td className="py-4 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenResetModal(mgr)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/15 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 hover:border-amber-500/35 transition cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                        <span>Reset Password</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Add New Manager */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Provision New Manager Account
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Create a Facility Manager or Super Admin with property-scoped permissions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManager} className="p-6 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-bold"
                >
                  {formError}
                </div>
              )}

              {/* Single Full Name input per autofill-sign-up-form */}
              <div>
                <label
                  htmlFor="mgr-full-name"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Full Name
                </label>
                <input
                  type="text"
                  id="mgr-full-name"
                  name="name"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Douglas Amadie"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label
                  htmlFor="mgr-email"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="mgr-email"
                  name="email"
                  autoComplete="off"
                  spellCheck="false"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@precourtluxury.com"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="mgr-role"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Administrative Role
                  </label>
                  <select
                    id="mgr-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  >
                    <option value="FACILITY_MANAGER">FACILITY_MANAGER</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Properties / Facilities
                  </span>
                  <div className="flex items-center gap-2 pt-1">
                    {[
                      { code: 'PLH-AM', label: 'Amamoley (PLH-AM)' },
                      { code: 'PLH-KW', label: 'Kwabenya (PLH-KW)' }
                    ].map((prop) => {
                      const checked = assignedProperties.includes(prop.code);
                      return (
                        <button
                          key={prop.code}
                          type="button"
                          onClick={() => togglePropertySelection(prop.code)}
                          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            checked
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {prop.code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Initial Password Configuration */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="mgr-initial-password"
                    className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    Initial Password Configuration
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordMode('generate');
                        setPassword(generateSecurePassword());
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Generate Temporary
                    </button>
                  </div>
                </div>

                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="mgr-initial-password"
                      name="new-password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => {
                        setPasswordMode('manual');
                        setPassword(e.target.value);
                      }}
                      className="w-full px-3.5 py-2 pr-9 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(password);
                      setCopiedPass(true);
                      setTimeout(() => setCopiedPass(false), 2000);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition flex items-center gap-1 cursor-pointer"
                    title="Copy Password"
                  >
                    {copiedPass ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPass ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Require password reset on first login toggle */}
                <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={requirePasswordReset}
                    onChange={(e) => setRequirePasswordReset(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Require password reset on first login
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{submitting ? 'Provisioning...' : 'Create Manager Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reset Manager Password */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResetTarget(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Reset Manager Password
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {resetTarget.fullName} ({resetTarget.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="p-6 space-y-4">
              {resetError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-bold"
                >
                  {resetError}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="reset-mgr-password"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetPasswordVal(generateSecurePassword())}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    Generate Secure Temporary
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={resetShowPass ? 'text' : 'password'}
                      id="reset-mgr-password"
                      name="new-password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={resetPasswordVal}
                      onChange={(e) => setResetPasswordVal(e.target.value)}
                      className="w-full px-3.5 py-2 pr-9 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setResetShowPass((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      aria-label={resetShowPass ? 'Hide password' : 'Show password'}
                    >
                      {resetShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(resetPasswordVal);
                      setResetCopied(true);
                      setTimeout(() => setResetCopied(false), 2000);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    {resetCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetRequireFirstLogin}
                  onChange={(e) => setResetRequireFirstLogin(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Require password reset on next login
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                >
                  {submitting ? 'Rotating...' : 'Rotate Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
