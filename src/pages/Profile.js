import React, { useState } from 'react';
import {
  Container, Box, Typography, Tabs, Tab, Divider,
  TextField, Button, Alert, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changePassword, deleteAccount } from '../api/authApi';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

// ── Change Password ────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [form, setForm]     = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.newPassword !== form.confirmPassword) {
      return setError('New passwords do not match');
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 420 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Change Password</Typography>

      {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <TextField
        label="Current password" name="currentPassword" type="password" fullWidth required
        value={form.currentPassword} onChange={handleChange} sx={{ mb: 2 }}
      />
      <TextField
        label="New password" name="newPassword" type="password" fullWidth required
        value={form.newPassword} onChange={handleChange} sx={{ mb: 2 }}
        helperText="Minimum 8 characters"
      />
      <TextField
        label="Confirm new password" name="confirmPassword" type="password" fullWidth required
        value={form.confirmPassword} onChange={handleChange} sx={{ mb: 3 }}
      />

      <Button type="submit" variant="contained" disabled={loading}>
        {loading ? 'Saving…' : 'Change Password'}
      </Button>
    </Box>
  );
}

// ── Delete Account ────────────────────────────────────────────────────────

function DeleteAccountSection() {
  const { signout }        = useAuth();
  const navigate           = useNavigate();
  const [open, setOpen]    = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError]  = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setError('');
    setLoading(true);
    try {
      await deleteAccount({ password });
      await signout();
      navigate('/signin');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setPassword('');
    setError('');
  };

  return (
    <>
      <Typography variant="h6" fontWeight={700} gutterBottom>Delete Account</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Permanently delete your account. This action cannot be undone.
      </Typography>
      <Button variant="outlined" color="error" onClick={() => setOpen(true)}>
        Delete Account
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Account Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter your password to permanently delete your account.
          </DialogContentText>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Password" type="password" fullWidth autoFocus
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button
            variant="contained" color="error"
            onClick={handleDelete}
            disabled={loading || !password}
          >
            {loading ? 'Deleting…' : 'Delete My Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ── Profile Page ──────────────────────────────────────────────────────────

export default function Profile() {
  const { user }    = useAuth();
  const [tab, setTab] = useState(0);

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <Typography>Please sign in to view your profile.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Profile</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {user.displayName} · {user.email}
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="My Account" />
        </Tabs>
      </Box>

      <TabPanel value={tab} index={0}>
        <ChangePasswordSection />
        <Divider sx={{ my: 4 }} />
        <DeleteAccountSection />
      </TabPanel>
    </Container>
  );
}
