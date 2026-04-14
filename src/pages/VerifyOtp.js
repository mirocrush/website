import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { verifyOtp } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function VerifyOtp() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { setUser } = useAuth();

  const email = location.state?.email || '';

  const [otp,       setOtp]       = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resent,    setResent]    = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await verifyOtp({ email, otp: otp.trim() });
      setUser(res.data);
      navigate('/blogs', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Re-send OTP — navigate back to signup isn't great UX; server upserts so resend works
  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setResent(false);
    setError('');
    try {
      // We don't have the original password here so we direct the user back
      navigate('/signup');
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card bg-base-100 shadow-xl w-full max-w-sm">
          <div className="card-body">
            <div role="alert" className="alert alert-warning text-sm py-2">
              <span>
                No email found.{' '}
                <RouterLink to="/signup" className="link link-primary text-sm">
                  Go back to sign up
                </RouterLink>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center">
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold justify-center mb-2">
            <Mail className="w-7 h-7 text-primary" />
            Check your inbox
          </h2>

          <p className="text-sm text-base-content/60 text-center mb-3">
            We sent a 6-digit verification code to <strong className="text-base-content">{email}</strong>.
            Enter it below to complete your account setup. The code expires in 5 minutes.
          </p>

          {error && (
            <div role="alert" className="alert alert-error text-sm py-2">
              <span>{error}</span>
            </div>
          )}
          {resent && (
            <div role="alert" className="alert alert-success text-sm py-2">
              <span>A new code has been sent!</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <fieldset className="fieldset gap-1">
              <div>
                <label className="label">
                  <span className="label-text font-medium">Verification code</span>
                </label>
                <input
                  className="input input-bordered w-full text-center text-xl tracking-[0.5em]"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  value={otp}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(v);
                  }}
                  placeholder="123456"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mt-2"
                disabled={loading || otp.length !== 6}
              >
                {loading && <span className="loading loading-spinner loading-sm"></span>}
                {loading ? 'Verifying…' : 'Verify & create account'}
              </button>
            </fieldset>
          </form>

          <div className="text-center text-sm text-base-content/60 mt-2">
            Didn&apos;t receive the code?{' '}
            <button
              type="button"
              className="link link-primary text-sm"
              onClick={handleResend}
              disabled={resending}
            >
              Go back to sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
