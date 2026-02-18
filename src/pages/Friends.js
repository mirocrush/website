import React, { useEffect, useState } from 'react';
import {
  Container, Box, Typography, Tabs, Tab, Stack, Avatar,
  TextField, Button, Alert, CircularProgress, Chip,
  Card, CardContent, CardActions, Divider, IconButton, Tooltip,
} from '@mui/material';
import {
  PersonAdd as AddIcon,
  PersonRemove as RemoveIcon,
  Check as AcceptIcon,
  Close as DenyIcon,
  OpenInNew as ProfileIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendRequest, respondToRequest, listRequests, listFriends, removeFriend } from '../api/friendsApi';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

function UserAvatar({ user, size = 40 }) {
  const initials = user.displayName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <Avatar src={user.avatarUrl || undefined} sx={{ width: size, height: size, bgcolor: 'secondary.main', fontSize: size * 0.35, fontWeight: 700 }}>
      {!user.avatarUrl && initials}
    </Avatar>
  );
}

// ── Send Request Tab ───────────────────────────────────────────────────────

function SendRequestTab() {
  const [query, setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await sendRequest({ query: query.trim() });
      setSuccess('Friend request sent!');
      setQuery('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSend} sx={{ maxWidth: 420 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter someone's username (e.g. <strong>john_doe</strong>) or email address.
      </Typography>
      {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Stack direction="row" spacing={1}>
        <TextField
          label="Username or email" fullWidth size="small"
          value={query} onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" variant="contained" disabled={loading || !query.trim()} startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}>
          Send
        </Button>
      </Stack>
    </Box>
  );
}

// ── Friends Tab ────────────────────────────────────────────────────────────

function FriendsTab() {
  const navigate              = useNavigate();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    listFriends()
      .then((res) => setFriends(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (f) => {
    setRemoving(f.id);
    try {
      await removeFriend(f.id);
      setFriends((prev) => prev.filter((x) => x.id !== f.id));
    } catch { /* silent */ }
    setRemoving(null);
  };

  if (loading) return <CircularProgress />;
  if (friends.length === 0) return <Typography color="text.secondary">No friends yet — send a request!</Typography>;

  return (
    <Stack spacing={1.5}>
      {friends.map((f) => (
        <Card key={f.id} variant="outlined">
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <UserAvatar user={f} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography fontWeight={700}>{f.displayName}</Typography>
              <Typography variant="caption" color="text.secondary">@{f.username}</Typography>
            </Box>
            <Tooltip title="View profile">
              <IconButton size="small" onClick={() => navigate(`/profiles/${f.username}`)}>
                <ProfileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Remove friend">
              <IconButton size="small" color="error" onClick={() => handleRemove(f)} disabled={removing === f.id}>
                {removing === f.id ? <CircularProgress size={18} /> : <RemoveIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

// ── Requests Tab ───────────────────────────────────────────────────────────

function RequestsTab() {
  const [received, setReceived] = useState([]);
  const [sent,     setSent]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(null);

  useEffect(() => {
    Promise.all([listRequests('received'), listRequests('sent')])
      .then(([r, s]) => { setReceived(r.data); setSent(s.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRespond = async (requestId, action) => {
    setActing(requestId);
    try {
      await respondToRequest({ requestId, action });
      setReceived((prev) => prev.filter((r) => r.id !== requestId));
    } catch { /* silent */ }
    setActing(null);
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Received {received.length > 0 && <Chip label={received.length} size="small" color="primary" sx={{ ml: 1 }} />}
      </Typography>

      {received.length === 0
        ? <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>No pending requests</Typography>
        : (
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            {received.map((r) => (
              <Card key={r.id} variant="outlined">
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, '&:last-child': { pb: 1 } }}>
                  <UserAvatar user={r.sender} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography fontWeight={700}>{r.sender.displayName}</Typography>
                    <Typography variant="caption" color="text.secondary">@{r.sender.username}</Typography>
                  </Box>
                  <Button size="small" variant="contained" color="success" startIcon={<AcceptIcon />}
                    onClick={() => handleRespond(r.id, 'accept')} disabled={acting === r.id} sx={{ mr: 1 }}>
                    Accept
                  </Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<DenyIcon />}
                    onClick={() => handleRespond(r.id, 'deny')} disabled={acting === r.id}>
                    Deny
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )
      }

      <Divider sx={{ mb: 2 }} />
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>Sent</Typography>

      {sent.length === 0
        ? <Typography variant="body2" color="text.secondary">No sent requests</Typography>
        : (
          <Stack spacing={1.5}>
            {sent.map((r) => (
              <Card key={r.id} variant="outlined">
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <UserAvatar user={r.receiver} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography fontWeight={700}>{r.receiver.displayName}</Typography>
                    <Typography variant="caption" color="text.secondary">@{r.receiver.username}</Typography>
                  </Box>
                  <Chip label="Pending" size="small" variant="outlined" />
                </CardContent>
              </Card>
            ))}
          </Stack>
        )
      }
    </Box>
  );
}

// ── Friends Page ───────────────────────────────────────────────────────────

export default function Friends() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate('/signin');
  }, [user, authLoading, navigate]);

  if (authLoading || !user) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Friends</Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="My Friends" />
          <Tab label="Requests" />
          <Tab label="Add Friend" />
        </Tabs>
      </Box>

      <TabPanel value={tab} index={0}><FriendsTab /></TabPanel>
      <TabPanel value={tab} index={1}><RequestsTab /></TabPanel>
      <TabPanel value={tab} index={2}><SendRequestTab /></TabPanel>
    </Container>
  );
}
