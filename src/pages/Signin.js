import { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import logoSrc from '../assets/talent-logo.png';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { signin } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function Signin() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [form,     setForm]     = useState({ email: '', password: '' });
  const [errors,   setErrors]   = useState({});
  const [apiErr,   setApiErr]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
  };

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
      navigate('/', { replace: true });
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'transparent' }}>
      <div className="w-full max-w-md">

        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg mb-4 overflow-hidden">
            <img src={logoSrc} alt="Talent Code Hub" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#bbf7d0' }}>Welcome back</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(134,239,172,0.55)' }}>Sign in to continue</p>
        </div>

        <div className="card glass-card shadow-xl border">
          <div className="card-body gap-5 p-8">

            {apiErr && (
              <div role="alert" className="alert alert-error text-sm py-3">
                <span>{apiErr}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

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
                {errors.password && <p className="text-error text-xs">{errors.password}</p>}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mt-1 text-base"
                disabled={loading}
              >
                {loading ? (
                  <><span className="loading loading-spinner loading-sm" /> Signing in…</>
                ) : (
                  <><LogIn size={17} /> Sign in</>
                )}
              </button>
            </form>

            <div className="divider my-0 text-base-content/30 text-xs">OR</div>

            <p className="text-center text-sm text-base-content/60">
              Don't have an account?{' '}
              <RouterLink to="/signup" className="link link-primary font-semibold">
                Create one
              </RouterLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
