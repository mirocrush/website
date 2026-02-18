import React, { useState } from 'react';
import {
  Container, Paper, Typography, TextField, Button,
  Stack, Alert, Box, Link,
} from '@mui/material';
import { PersonAdd as SignupIcon } from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { signup } from '../api/authApi';

export default function Signup() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ email: '', displayName: '', password: '', confirm: '' });
  const [errors,  setErrors]  = useState({});
  const [apiErr,  setApiErr]  = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.email.trim())                           e.email       = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email))        e.email       = 'Enter a valid email';
    if (!form.displayName.trim())                     e.displayName = 'Display name is required';
    if (!form.password)                               e.password    = 'Password is required';
    else if (form.password.length < 8)                e.password    = 'At least 8 characters';
    if (form.confirm !== form.password)               e.confirm     = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiErr('');
    try {
      await signup({ email: form.email, displayName: form.displayName, password: form.password });
      // Pass email to OTP page via location state
      navigate('/verify-otp', { state: { email: form.email } });
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <SignupIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight={700}>Create an account</Typography>
        </Box>

        {apiErr && <Alert severity="error" sx={{ mb: 2 }}>{apiErr}</Alert>}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5}>
            <TextField
              label="Email address"
              type="email"
              value={form.email}
              onChange={set('email')}
              error={!!errors.email}
              helperText={errors.email}
              fullWidth required autoFocus
            />
            <TextField
              label="Display name"
              value={form.displayName}
              onChange={set('displayName')}
              error={!!errors.displayName}
              helperText={errors.displayName}
              fullWidth required
            />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              error={!!errors.password}
              helperText={errors.password || 'At least 8 characters'}
              fullWidth required
            />
            <TextField
              label="Confirm password"
              type="password"
              value={form.confirm}
              onChange={set('confirm')}
              error={!!errors.confirm}
              helperText={errors.confirm}
              fullWidth required
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              fullWidth
            >
              {loading ? 'Sending code…' : 'Send verification code'}
            </Button>
          </Stack>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link component={RouterLink} to="/signin" underline="hover">Sign in</Link>
        </Typography>
      </Paper>
    </Container>
  );
}
