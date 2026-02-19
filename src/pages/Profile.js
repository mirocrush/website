import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Box, Typography, Tabs, Tab, Divider,
  TextField, Button, Alert, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions,
  Avatar, CircularProgress, InputAdornment,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cancel as XIcon,
  PhotoCamera as CameraIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  changePassword, changeUsername, changeDisplayName, deleteAccount,
  checkUsername, uploadAvatar, deleteAvatar,
} from '../api/authApi';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

// ── Avatar Section ─────────────────────────────────────────────────────────

function AvatarSection() {
  const { user, setUser } = useAuth();
  const fileRef           = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [error, setError]         = useState('');

  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await uploadAvatar(fd);
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    setError('');
    setDeleting(true);
    try {
      const res = await deleteAvatar();
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 420 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Profile Picture</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2 }}>
        <Avatar
          src={user?.avatarUrl || undefined}
          sx={{ width: 80, height: 80, bgcolor: 'secondary.main', fontSize: 28, fontWeight: 700 }}
        >
          {!user?.avatarUrl && initials}
        </Avatar>
        <Box>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          <Button
            variant="outlined"
            startIcon={uploading ? <CircularProgress size={16} /> : <CameraIcon />}
            onClick={() => fileRef.current?.click()}
            disabled={uploading || deleting}
            sx={{ mr: 1, mb: 1 }}
          >
            {uploading ? 'Uploading…' : 'Upload Photo'}
          </Button>
          {user?.avatarUrl && (
            <Button
              variant="outlined"
              color="error"
              startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
              onClick={handleDelete}
              disabled={uploading || deleting}
              sx={{ mb: 1 }}
            >
              {deleting ? 'Removing…' : 'Remove'}
            </Button>
          )}
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Max 5 MB · JPG, PNG, GIF, or WebP
      </Typography>
    </Box>
  );
}

// ── Change Display Name ────────────────────────────────────────────────────

function ChangeDisplayNameSection() {
  const { user, setUser }           = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [loading, setLoading]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    setError('');
    setSuccess('');
    if (!trimmed) return setError('Display name cannot be empty');
    if (trimmed.length > 50) return setError('Display name must be 50 characters or fewer');

    setLoading(true);
    try {
      const res = await changeDisplayName({ displayName: trimmed });
      setUser(res.data);
      setSuccess('Display name updated successfully');
      setDisplayName('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update display name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 420 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Display Name</Typography>
      {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <TextField
        label="New display name" fullWidth required sx={{ mb: 2 }}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        inputProps={{ maxLength: 50 }}
        helperText={`Current: ${user?.displayName || ''}`}
      />
      <Button
        type="submit" variant="contained"
        disabled={loading || !displayName.trim()}
      >
        {loading ? 'Saving…' : 'Save Display Name'}
      </Button>
    </Box>
  );
}

// ── Change Username ────────────────────────────────────────────────────────

function ChangeUsernameSection() {
  const { user, setUser }         = useAuth();
  const [username, setUsername]   = useState('');
  const [status, setStatus]       = useState(null); // null | 'checking' | 'available' | 'taken' | 'invalid'
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [loading, setLoading]     = useState(false);
  const debounceRef               = useRef(null);

  useEffect(() => {
    const val = username.trim();
    if (!val || val === user?.username) { setStatus(null); return; }
    if (!USERNAME_RE.test(val)) { setStatus('invalid'); return; }

    setStatus('checking');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await checkUsername({ username: val });
        setStatus(res.available ? 'available' : 'taken');
      } catch {
        setStatus(null);
      }
    }, 500);
  }, [username, user?.username]);

  const adornment = () => {
    if (status === 'checking')  return <CircularProgress size={16} />;
    if (status === 'available') return <CheckIcon fontSize="small" color="success" />;
    if (status === 'taken' || status === 'invalid') return <XIcon fontSize="small" color="error" />;
    return null;
  };

  const helperText = () => {
    if (status === 'available') return 'Available ✓';
    if (status === 'taken')     return 'Already taken';
    if (status === 'invalid')   return 'Letters, numbers, underscore only (3–20 chars)';
    return `Current: @${user?.username || ''}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!USERNAME_RE.test(username)) return setError('Invalid username format');
    if (status === 'taken') return setError('Username is already taken');

    setLoading(true);
    try {
      const res = await changeUsername({ username });
      setUser(res.data);
      setSuccess('Username updated successfully');
      setUsername('');
      setStatus(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change username');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 420 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Change Username</Typography>
      {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <TextField
        label="New username" fullWidth required sx={{ mb: 2 }}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        inputProps={{ maxLength: 20 }}
        error={status === 'taken' || status === 'invalid'}
        helperText={helperText()}
        InputProps={{
          endAdornment: <InputAdornment position="end">{adornment()}</InputAdornment>,
        }}
      />
      <Button
        type="submit" variant="contained"
        disabled={loading || status === 'checking' || status === 'taken' || status === 'invalid' || !username.trim()}
      >
        {loading ? 'Saving…' : 'Save Username'}
      </Button>
    </Box>
  );
}

// ── Change Password ────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [form, setForm]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.newPassword !== form.confirmPassword) return setError('New passwords do not match');

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

      <TextField label="Current password" name="currentPassword" type="password" fullWidth required
        value={form.currentPassword} onChange={handleChange} sx={{ mb: 2 }} />
      <TextField label="New password" name="newPassword" type="password" fullWidth required
        value={form.newPassword} onChange={handleChange} sx={{ mb: 2 }} helperText="Minimum 8 characters" />
      <TextField label="Confirm new password" name="confirmPassword" type="password" fullWidth required
        value={form.confirmPassword} onChange={handleChange} sx={{ mb: 3 }} />

      <Button type="submit" variant="contained" disabled={loading}>
        {loading ? 'Saving…' : 'Change Password'}
      </Button>
    </Box>
  );
}

// ── Delete Account ────────────────────────────────────────────────────────

function DeleteAccountSection() {
  const { signout }             = useAuth();
  const navigate                = useNavigate();
  const [open, setOpen]         = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

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

  const handleClose = () => { setOpen(false); setPassword(''); setError(''); };

  return (
    <>
      <Typography variant="h6" fontWeight={700} gutterBottom>Delete Account</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Permanently delete your account. This action cannot be undone.
      </Typography>
      <Button variant="outlined" color="error" onClick={() => setOpen(true)}>Delete Account</Button>

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Account Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter your password to permanently delete your account.
          </DialogContentText>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField label="Password" type="password" fullWidth autoFocus
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={loading || !password}>
            {loading ? 'Deleting…' : 'Delete My Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ── Profile Page ──────────────────────────────────────────────────────────

export default function Profile() {
  const { user }      = useAuth();
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
        {user.displayName} · @{user.username} · {user.email}
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="My Account" />
        </Tabs>
      </Box>

      <TabPanel value={tab} index={0}>
        <AvatarSection />
        <Divider sx={{ my: 4 }} />
        <ChangeDisplayNameSection />
        <Divider sx={{ my: 4 }} />
        <ChangeUsernameSection />
        <Divider sx={{ my: 4 }} />
        <ChangePasswordSection />
        <Divider sx={{ my: 4 }} />
        <DeleteAccountSection />
      </TabPanel>
    </Container>
  );
}
