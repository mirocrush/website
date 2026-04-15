import { useState } from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import logoSrc from '../assets/claude.png';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { verifyOtp } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function VerifyOtp() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { setUser } = useAuth();

  const email = location.state?.email || '';

  const [otp,     setOtp]     = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await verifyOtp({ email, otp: otp.trim() });
      setUser(res.data);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="card bg-base-100 shadow-xl border border-base-200 w-full max-w-sm">
          <div className="card-body gap-4 text-center">
            <p className="text-base-content/60 text-sm">No email found.</p>
            <RouterLink to="/signup" className="btn btn-primary btn-sm gap-2">
              <ArrowLeft size={14} /> Back to Sign Up
            </RouterLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg mb-4 overflow-hidden">
            <img src={logoSrc} alt="Talent Code Hub" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Verify your email</h1>
          <p className="text-base-content/50 text-sm mt-1">
            Code sent to <strong className="text-base-content/80">{email}</strong>
          </p>
        </div>

        <div className="card bg-base-100 shadow-xl border border-base-200">
          <div className="card-body gap-5 p-8">

            <p className="text-sm text-base-content/60 text-center">
              Enter the 6-digit code from your inbox. It expires in <strong>5 minutes</strong>.
            </p>

            {error && (
              <div role="alert" className="alert alert-error text-sm py-3">
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="block">
                  <span className="text-sm font-medium font-semibold">Verification code</span>
                </label>
                <input
                  className={`input w-full text-center text-2xl font-mono tracking-[0.6em] h-14${error ? ' input-error' : otp.length === 6 ? ' input-success' : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  value={otp}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(v);
                    if (error) setError('');
                  }}
                  placeholder="••••••"
                />
                <p className="text-xs text-base-content/40 text-center">
                  {otp.length}/6 digits
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full text-base mt-1"
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <><span className="loading loading-spinner loading-sm" /> Verifying…</>
                ) : (
                  <><ShieldCheck size={17} /> Verify &amp; Continue</>
                )}
              </button>
            </form>

            <div className="divider my-0 text-base-content/30 text-xs">DIDN'T GET IT?</div>

            <p className="text-center text-sm text-base-content/60">
              <RouterLink to="/signup" className="link link-primary font-semibold">
                Go back to sign up
              </RouterLink>
              {' '}to request a new code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
