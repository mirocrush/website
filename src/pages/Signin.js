import { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { signin } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function Signin() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [form,       setForm]       = useState({ email: '', password: '' });
  const [errors,     setErrors]     = useState({});
  const [apiErr,     setApiErr]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showPass,   setShowPass]   = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.email.trim())    e.email    = 'Email is required';
    if (!form.password.trim()) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiErr('');
    try {
      const res = await signin({ email: form.email, password: form.password });
      setUser(res.data);
      navigate('/blogs', { replace: true });
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center">
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold justify-center mb-2">
            <LogIn className="w-7 h-7 text-primary" />
            Sign in
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
                {errors.password && (
                  <p className="text-error text-xs mt-1">{errors.password}</p>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mt-2"
                disabled={loading}
              >
                {loading && <span className="loading loading-spinner loading-sm"></span>}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </fieldset>
          </form>

          <div className="text-center text-sm text-base-content/60 mt-2">
            Don&apos;t have an account?{' '}
            <RouterLink to="/signup" className="link link-primary text-sm">
              Sign up
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  );
}
