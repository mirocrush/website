import React, { useState } from 'react';
import {
  Container, Paper, Typography, TextField, Button,
  Stack, Alert, Box, Link,
} from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { signin } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function Signin() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [form,    setForm]    = useState({ email: '', password: '' });
  const [errors,  setErrors]  = useState({});
  const [apiErr,  setApiErr]  = useState('');
  const [loading, setLoading] = useState(false);

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
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <LoginIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight={700}>Sign in</Typography>
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
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              error={!!errors.password}
              helperText={errors.password}
              fullWidth required
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              fullWidth
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          Don&apos;t have an account?{' '}
          <Link component={RouterLink} to="/signup" underline="hover">Sign up</Link>
        </Typography>
      </Paper>
    </Container>
  );
}
