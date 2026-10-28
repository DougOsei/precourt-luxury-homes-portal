import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import {
  Crown,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';

const LoginClientSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(2, 'Please enter your email address or username')
    .max(160, 'Identifier is too long'),
  password: z
    .string()
    .min(1, 'Please enter your password')
    .max(128, 'Password is too long')
});

const NewPasswordClientSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must include at least one uppercase letter')
    .regex(/[a-z]/, 'Must include at least one lowercase letter')
    .regex(/\d/, 'Must include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must include at least one special character')
});

export default function LoginPage({
  onLoginSuccess,
  themeMode = 'dark',
  onToggleTheme,
  callbackUrl = '/dashboard',
  pendingResetUser = null,
  csrfToken = ''
}) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // First-login password reset state
  const [requireResetMode, setRequireResetMode] = useState(Boolean(pendingResetUser));
  const [currentPasswordForReset, setCurrentPasswordForReset] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [activeUser, setActiveUser] = useState(pendingResetUser);
  const [activeCsrf, setActiveCsrf] = useState(csrfToken);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Bridge CSS :user-invalid with ARIA aria-invalid per accessible-error-announcement guide
  const handleInputBlur = (e) => {
    const input = e.target;
    if (!input.matches) return;
    try {
      if (input.matches(':user-invalid')) {
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.removeAttribute('aria-invalid');
      }
    } catch (err) {}
  };

  const handleSignInSubmit = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0 || submitting) return;

    setErrorMsg('');
    setFieldErrors({});

    const parsed = LoginClientSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const errs = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] || 'form';
        errs[key] = issue.message;
      });
      setFieldErrors(errs);
      setErrorMsg('Please enter a valid email/username and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: parsed.data.identifier,
          password: parsed.data.password
        })
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (res.status === 429 || data.locked) {
          setLockoutSeconds(Number(data.retryAfterSeconds) || 900);
          setRemainingAttempts(0);
        } else if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }
        // Generic error message to prevent user enumeration
        setErrorMsg(data.error || 'Invalid email or password.');
        setSubmitting(false);
        return;
      }

      if (data.user?.requirePasswordReset) {
        setActiveUser(data.user);
        setActiveCsrf(data.csrfToken || '');
        setCurrentPasswordForReset(password);
        setRequireResetMode(true);
        setSubmitting(false);
        return;
      }

      onLoginSuccess(data.user, data.csrfToken, callbackUrl);
    } catch (err) {
      setErrorMsg('Unable to reach authentication server. Please try again.');
      setSubmitting(false);
    }
  };

  const handleCompleteFirstLoginReset = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const parsed = NewPasswordClientSchema.safeParse({
      currentPassword: currentPasswordForReset,
      newPassword
    });

    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message || 'Please choose a stronger password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/session', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(activeCsrf ? { 'X-CSRF-Token': activeCsrf } : {})
        },
        body: JSON.stringify({
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Could not update password.');
        setSubmitting(false);
        return;
      }

      onLoginSuccess(data.user, data.csrfToken, callbackUrl);
    } catch (err) {
      setErrorMsg('Network error while updating password.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-10 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
      {/* Subtle luxury background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      {/* Top-right Theme Toggle */}
      {onToggleTheme && (
        <div className="fixed top-4 right-4 z-20">
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500/40 shadow-sm transition cursor-pointer"
            aria-label="Toggle color theme"
          >
            {themeMode === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      )}

      <div className="w-full max-w-md z-10">
        {/* Luxury Brand Card Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 p-0.5 shadow-xl shadow-emerald-950/40 ring-1 ring-amber-400/50 mb-3">
            <div className="w-full h-full bg-slate-950/40 rounded-[14px] flex flex-col items-center justify-center">
              <Crown className="w-6 h-6 text-amber-300 -mb-0.5" />
              <span className="text-xs font-black tracking-widest text-white">PLH</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Precourt Luxury Homes
            </h1>
            <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
          </div>
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide mt-0.5">
            Executive Property &amp; Facility Management Portal
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl p-6 sm:p-8">
          {!requireResetMode ? (
            <>
              <div className="mb-5">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  Sign In to Management Portal
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Authenticate with your Super Admin or Facility Manager credentials
                </p>
              </div>

              {/* Accessible Error / Lockout Alert Banner */}
              {errorMsg && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">{errorMsg}</div>
                    {lockoutSeconds > 0 && (
                      <div className="font-mono text-[11px] text-rose-600 dark:text-rose-300">
                        Lockout timer: {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s remaining
                      </div>
                    )}
                    {lockoutSeconds === 0 &&
                      remainingAttempts !== null &&
                      remainingAttempts > 0 &&
                      remainingAttempts < 5 && (
                        <div className="text-[11px] text-rose-600/90 dark:text-rose-300/90">
                          Brute-force protection: {remainingAttempts} attempt(s) remaining before 15-minute lockout.
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* Primary Sign-In Form (follows autofill-sign-in-form & validate-input-after-interaction) */}
              <form onSubmit={handleSignInSubmit} className="space-y-4" noValidate={false}>
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Email Address or Username
                  </label>
                  <span
                    id="identifier-hint"
                    className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1.5"
                  >
                    Enter your authorized staff or administrator credentials
                  </span>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      id="login-identifier"
                      name="username"
                      autoComplete="username"
                      spellCheck="false"
                      autoCorrect="off"
                      autoCapitalize="none"
                      enterKeyHint="next"
                      required
                      disabled={lockoutSeconds > 0 || submitting}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      onBlur={handleInputBlur}
                      aria-describedby="identifier-hint"
                      aria-errormessage="identifier-error"
                      placeholder="Enter registered email or username"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
                    />
                  </div>
                  {fieldErrors.identifier && (
                    <span
                      id="identifier-error"
                      className="block text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-semibold"
                    >
                      {fieldErrors.identifier}
                    </span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="login-password"
                      name="password"
                      autoComplete="current-password"
                      enterKeyHint="done"
                      required
                      disabled={lockoutSeconds > 0 || submitting}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={handleInputBlur}
                      aria-errormessage="password-error"
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-11 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <span
                      id="password-error"
                      className="block text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-semibold"
                    >
                      {fieldErrors.password}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={lockoutSeconds > 0 || submitting}
                  className="w-full py-3 px-4 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 shadow-lg shadow-emerald-600/25 ring-1 ring-emerald-400/30 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{submitting ? 'Authenticating...' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Authorized Personnel Notice (No demo access or credential leakage) */}
              <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800/80">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="text-slate-800 dark:text-slate-200 block font-bold mb-0.5">
                      Restricted Access Gateway
                    </strong>
                    Only registered Precourt Luxury Homes staff and Super Admins may log in. Strangers and unauthorized users are prohibited. All access attempts are rate-limited, audited, and logged.
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Mandatory First-Login Password Reset Flow */
            <form onSubmit={handleCompleteFirstLoginReset} className="space-y-4">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 mb-2">
                  Security Policy Required
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Update Your Temporary Password
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Welcome, <strong>{activeUser?.fullName}</strong>. Your Super Admin requires a password change on first sign-in.
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-bold"
                >
                  {errorMsg}
                </div>
              )}

              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  New Permanent Password
                </label>
                {/* Password rules placed ABOVE input per validate-input-after-interaction */}
                <ul
                  id="new-password-rules"
                  className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 space-y-0.5 list-disc pl-4"
                >
                  <li>At least 8 characters</li>
                  <li>One uppercase &amp; one lowercase letter</li>
                  <li>One number &amp; one special character</li>
                </ul>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    id="new-password"
                    name="new-password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}"
                    aria-describedby="new-password-rules"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full px-3.5 py-2.5 pr-10 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((p) => !p)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Saving Password...' : 'Save New Password & Continue'}</span>
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-5">
          Protected by Bcrypt (Cost 12) • AES-256-GCM HttpOnly Session • 5-Attempt Brute-Force Lockout
        </p>
      </div>
    </div>
  );
}
