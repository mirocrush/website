import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, UserPlus, CheckCircle, AlertCircle } from 'lucide-react';
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

  // Username availability
  const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | 'invalid'
  const debounceRef = useRef(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Debounced username availability check
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

  const usernameHelperText = () => {
    if (usernameStatus === 'available') return 'Username is available';
    if (usernameStatus === 'taken')     return 'Username is already taken';
    if (usernameStatus === 'invalid')   return 'Letters, numbers, underscore only (3–20 chars)';
    return 'Letters, numbers, underscore only (3–20 chars)';
  };

  const usernameStatusColor = () => {
    if (usernameStatus === 'available') return 'text-success';
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return 'text-error';
    return 'text-base-content/50';
  };

  const validate = () => {
    const e = {};
    if (!form.email.trim())                       e.email       = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email))    e.email       = 'Enter a valid email';
    if (!form.username.trim())                    e.username    = 'Username is required';
    else if (!USERNAME_RE.test(form.username))     e.username    = 'Letters, numbers, underscore only (3–20 chars)';
    else if (usernameStatus === 'taken')           e.username    = 'Username is already taken';
    if (!form.displayName.trim())                 e.displayName = 'Display name is required';
    if (!form.password)                           e.password    = 'Password is required';
    else if (form.password.length < 8)            e.password    = 'At least 8 characters';
    if (form.confirm !== form.password)           e.confirm     = 'Passwords do not match';
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

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center py-8">
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold justify-center mb-2">
            <UserPlus className="w-7 h-7 text-primary" />
            Create an account
          </h2>

          {apiErr && (
            <div role="alert" className="alert alert-error text-sm py-2">
              <span>{apiErr}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <fieldset className="fieldset gap-1">
              {/* Email */}
              <div>
                <label className="label">
                  <span className="label-text font-medium">Email address</span>
                </label>
                <input
                  className={`input input-bordered w-full${errors.email ? ' input-error' : ''}`}
                  type="email"
                  autoFocus
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="text-error text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Display name */}
              <div>
                <label className="label">
                  <span className="label-text font-medium">Display name</span>
                </label>
                <input
                  className={`input input-bordered w-full${errors.displayName ? ' input-error' : ''}`}
                  type="text"
                  value={form.displayName}
                  onChange={set('displayName')}
                  placeholder="Your Name"
                />
                {errors.displayName && (
                  <p className="text-error text-xs mt-1">{errors.displayName}</p>
                )}
              </div>

              {/* Username */}
              <div>
                <label className="label">
                  <span className="label-text font-medium">Username</span>
                </label>
                <div className="relative">
                  <input
                    className={`input input-bordered w-full pr-8${
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
                  <span className="absolute inset-y-0 right-3 flex items-center">
                    {usernameStatus === 'checking' && (
                      <span className="loading loading-spinner loading-xs"></span>
                    )}
                    {usernameStatus === 'available' && (
                      <CheckCircle className="w-4 h-4 text-success" />
                    )}
                    {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                      <AlertCircle className="w-4 h-4 text-error" />
                    )}
                  </span>
                </div>
                <p className={`text-xs mt-1 ${errors.username ? 'text-error' : usernameStatusColor()}`}>
                  {errors.username || usernameHelperText()}
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="label">
                  <span className="label-text font-medium">Password</span>
                </label>
                <div className="relative">
                  <input
                    className={`input input-bordered w-full pr-10${errors.password ? ' input-error' : ''}`}
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className={`text-xs mt-1 ${errors.password ? 'text-error' : 'text-base-content/50'}`}>
                  {errors.password || 'At least 8 characters'}
                </p>
              </div>

              {/* Confirm password */}
              <div>
                <label className="label">
                  <span className="label-text font-medium">Confirm password</span>
                </label>
                <div className="relative">
                  <input
                    className={`input input-bordered w-full pr-10${errors.confirm ? ' input-error' : ''}`}
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={set('confirm')}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content"
                    onClick={() => setShowConfirm((v) => !v)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirm && (
                  <p className="text-error text-xs mt-1">{errors.confirm}</p>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mt-2"
                disabled={loading || usernameStatus === 'checking'}
              >
                {loading && <span className="loading loading-spinner loading-sm"></span>}
                {loading ? 'Sending code…' : 'Send verification code'}
              </button>
            </fieldset>
          </form>

          <div className="text-center text-sm text-base-content/60 mt-2">
            Already have an account?{' '}
            <RouterLink to="/signin" className="link link-primary text-sm">
              Sign in
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  );
}
