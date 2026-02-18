import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Paper, Typography, TextField, Button,
  Stack, Alert, Box, Link, InputAdornment, CircularProgress,
} from '@mui/material';
import {
  PersonAdd as SignupIcon,
  CheckCircle as CheckIcon,
  Cancel as XIcon,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { signup, checkUsername } from '../api/authApi';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function Signup() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ email: '', username: '', displayName: '', password: '', confirm: '' });
  const [errors,  setErrors]  = useState({});
  const [apiErr,  setApiErr]  = useState('');
  const [loading, setLoading] = useState(false);

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

  const usernameAdornment = () => {
    if (usernameStatus === 'checking')  return <CircularProgress size={16} />;
    if (usernameStatus === 'available') return <CheckIcon fontSize="small" color="success" />;
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return <XIcon fontSize="small" color="error" />;
    return null;
  };

  const usernameHelperText = () => {
    if (usernameStatus === 'available') return 'Username is available ✓';
    if (usernameStatus === 'taken')     return 'Username is already taken';
    if (usernameStatus === 'invalid')   return 'Letters, numbers, underscore only (3–20 chars)';
    return 'Letters, numbers, underscore only (3–20 chars)';
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
              label="Email address" type="email" fullWidth required autoFocus
              value={form.email} onChange={set('email')}
              error={!!errors.email} helperText={errors.email}
            />
            <TextField
              label="Display name" fullWidth required
              value={form.displayName} onChange={set('displayName')}
              error={!!errors.displayName} helperText={errors.displayName}
            />
            <TextField
              label="Username" fullWidth required
              value={form.username} onChange={set('username')}
              inputProps={{ maxLength: 20 }}
              error={!!errors.username || usernameStatus === 'taken' || usernameStatus === 'invalid'}
              helperText={errors.username || usernameHelperText()}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">{usernameAdornment()}</InputAdornment>
                ),
              }}
            />
            <TextField
              label="Password" type="password" fullWidth required
              value={form.password} onChange={set('password')}
              error={!!errors.password} helperText={errors.password || 'At least 8 characters'}
            />
            <TextField
              label="Confirm password" type="password" fullWidth required
              value={form.confirm} onChange={set('confirm')}
              error={!!errors.confirm} helperText={errors.confirm}
            />
            <Button
              type="submit" variant="contained" size="large" fullWidth
              disabled={loading || usernameStatus === 'checking'}
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
