import React, { useState } from 'react';
import {
  Container, Paper, Typography, TextField, Button,
  Stack, Alert, Box, Link,
} from '@mui/material';
import { MarkEmailRead as OtpIcon } from '@mui/icons-material';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { verifyOtp, signup as resendSignup } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function VerifyOtp() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { setUser } = useAuth();

  const email = location.state?.email || '';

  const [otp,      setOtp]      = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [resent,   setResent]   = useState(false);
  const [resending,setResending]= useState(false);

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
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="warning">
          No email found. <Link component={RouterLink} to="/signup">Go back to sign up</Link>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <OtpIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight={700}>Check your inbox</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          We sent a 6-digit verification code to <strong>{email}</strong>.
          Enter it below to complete your account setup. The code expires in 5 minutes.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {resent && <Alert severity="success" sx={{ mb: 2 }}>A new code has been sent!</Alert>}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5}>
            <TextField
              label="Verification code"
              value={otp}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(v);
              }}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              placeholder="123456"
              fullWidth
              required
              autoFocus
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading || otp.length !== 6}
              fullWidth
            >
              {loading ? 'Verifying…' : 'Verify & create account'}
            </Button>
          </Stack>
        </Box>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Didn&apos;t receive the code?{' '}
            <Link
              component="button"
              variant="body2"
              underline="hover"
              onClick={handleResend}
              disabled={resending}
            >
              Go back to sign up
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
