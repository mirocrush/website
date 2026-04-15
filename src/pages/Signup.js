import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, UserPlus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import logoSrc from '../assets/claude.png';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { signup, checkUsername } from '../api/authApi';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function Signup() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ email: '', username: '', displayName: '', password: '', confirm: '' });
  const [errors,  setErrors]  = useState({});
  const [apiErr,  setApiErr]  = useState('');
  const [loading, setLoading] = useState(false);

  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState(null);
  const debounceRef = useRef(null);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
  };

  useEffect(() => {
    const val = form.username.trim();
    if (!val) { setUsernameStatus(null); return; }
    if (!USERNAME_RE.test(val)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await checkUsername({ username: val });
        setUsernameStatus(res.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus(null);
      }
    }, 500);
  }, [form.username]);

  const validate = () => {
    const e = {};
    if (!form.email.trim())                      e.email       = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email))   e.email       = 'Enter a valid email';
    if (!form.username.trim())                   e.username    = 'Username is required';
    else if (!USERNAME_RE.test(form.username))    e.username    = 'Letters, numbers, underscore only (3–20 chars)';
    else if (usernameStatus === 'taken')          e.username    = 'Username is already taken';
    if (!form.displayName.trim())                e.displayName = 'Display name is required';
    if (!form.password)                          e.password    = 'Password is required';
    else if (form.password.length < 8)           e.password    = 'At least 8 characters';
    if (form.confirm !== form.password)          e.confirm     = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiErr('');
    try {
      await signup({
        email:       form.email,
        username:    form.username,
        displayName: form.displayName,
        password:    form.password,
      });
      navigate('/verify-otp', { state: { email: form.email } });
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = () => {
    const p = form.password;
    if (!p) return null;
    if (p.length < 4) return { level: 1, label: 'Too short', color: 'bg-error' };
    if (p.length < 8) return { level: 2, label: 'Weak', color: 'bg-warning' };
    const hasUpper = /[A-Z]/.test(p);
    const hasNum   = /\d/.test(p);
    const hasSym   = /[^a-zA-Z0-9]/.test(p);
    const score    = [hasUpper, hasNum, hasSym].filter(Boolean).length;
    if (score === 3) return { level: 4, label: 'Strong', color: 'bg-success' };
    if (score >= 1)  return { level: 3, label: 'Good', color: 'bg-info' };
    return { level: 2, label: 'Weak', color: 'bg-warning' };
  };
  const strength = passwordStrength();

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg mb-4 overflow-hidden">
            <img src={logoSrc} alt="Talent Code Hub" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Create your account</h1>
          <p className="text-base-content/50 text-sm mt-1">Get started for free</p>
        </div>

        <div className="card bg-base-100 shadow-xl border border-base-200">
          <div className="card-body gap-5 p-8">

            {apiErr && (
              <div role="alert" className="alert alert-error text-sm py-3">
                <span>{apiErr}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="block">
                  <span className="text-sm font-medium font-semibold">Email address</span>
                </label>
                <input
                  className={`input w-full${errors.email ? ' input-error' : ''}`}
                  type="email"
                  autoFocus
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                />
                {errors.email && <p className="text-error text-xs">{errors.email}</p>}
              </div>

              {/* Display name */}
              <div className="flex flex-col gap-1.5">
                <label className="block">
                  <span className="text-sm font-medium font-semibold">Display name</span>
                </label>
                <input
                  className={`input w-full${errors.displayName ? ' input-error' : ''}`}
                  type="text"
                  value={form.displayName}
                  onChange={set('displayName')}
                  placeholder="Your Name"
                />
                {errors.displayName && <p className="text-error text-xs">{errors.displayName}</p>}
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label className="block">
                  <span className="text-sm font-medium font-semibold">Username</span>
                </label>
                <div className="relative">
                  <input
                    className={`input w-full pr-9${
                      errors.username || usernameStatus === 'taken' || usernameStatus === 'invalid'
                        ? ' input-error'
                        : usernameStatus === 'available'
                        ? ' input-success'
                        : ''
                    }`}
                    type="text"
                    maxLength={20}
                    value={form.username}
                    onChange={set('username')}
                    placeholder="cool_username"
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    {usernameStatus === 'checking' && <Loader2 size={16} className="text-base-content/40 animate-spin" />}
                    {usernameStatus === 'available' && <CheckCircle size={16} className="text-success" />}
                    {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <AlertCircle size={16} className="text-error" />}
                  </span>
                </div>
                <p className={`text-xs ${errors.username ? 'text-error' : usernameStatus === 'available' ? 'text-success' : usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'text-error' : 'text-base-content/40'}`}>
                  {errors.username || (usernameStatus === 'available' ? 'Username is available ✓' : usernameStatus === 'taken' ? 'Username is already taken' : 'Letters, numbers, underscore only · 3–20 chars')}
                </p>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="block">
                  <span className="text-sm font-medium font-semibold">Password</span>
                </label>
                <div className="relative">
                  <input
                    className={`input w-full pr-11${errors.password ? ' input-error' : ''}`}
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-base-content/40 hover:text-base-content transition-colors"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Password strength bar */}
                {strength && (
                  <div className="mt-1">
                    <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-300 ${i <= strength.level ? strength.color : 'bg-base-300'}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-base-content/40 mt-0.5">{strength.label}</p>
                  </div>
                )}
                {errors.password && <p className="text-error text-xs">{errors.password}</p>}
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-1.5">
                <label className="block">
                  <span className="text-sm font-medium font-semibold">Confirm password</span>
                </label>
                <div className="relative">
                  <input
                    className={`input w-full pr-11${errors.confirm ? ' input-error' : form.confirm && form.confirm === form.password ? ' input-success' : ''}`}
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={set('confirm')}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-base-content/40 hover:text-base-content transition-colors"
                    onClick={() => setShowConfirm((v) => !v)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirm && <p className="text-error text-xs">{errors.confirm}</p>}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mt-2 text-base"
                disabled={loading || usernameStatus === 'checking'}
              >
                {loading ? (
                  <><span className="loading loading-spinner loading-sm" /> Sending code…</>
                ) : (
                  <><UserPlus size={17} /> Create account</>
                )}
              </button>
            </form>

            <div className="divider my-0 text-base-content/30 text-xs">OR</div>

            <p className="text-center text-sm text-base-content/60">
              Already have an account?{' '}
              <RouterLink to="/signin" className="link link-primary font-semibold">
                Sign in
              </RouterLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
