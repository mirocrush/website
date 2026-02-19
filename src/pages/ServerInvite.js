import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Avatar, Button, CircularProgress, Paper,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getServerByInvite, joinServer } from '../api/serversApi';

export default function ServerInvite() {
  const { inviteKey } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [server,  setServer]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error,   setError]   = useState('');
  const [joined,  setJoined]  = useState(false);

  useEffect(() => {
    getServerByInvite({ inviteKey })
      .then((res) => { if (res.success) setServer(res.data); })
      .catch(() => setError('Invite link not found or expired.'))
      .finally(() => setLoading(false));
  }, [inviteKey]);

  const handleJoin = async () => {
    if (!user) { navigate(`/signin?next=/messenger/servers/invite/${inviteKey}`); return; }
    setJoining(true);
    setError('');
    try {
      const res = await joinServer({ inviteKey });
      if (res.success) {
        setJoined(true);
        const key = res.data.firstChannelKey;
        setTimeout(() => navigate(key ? `/messenger/channels/${key}` : '/messenger'), 1500);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to join server');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !server) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  const initials = server?.name?.slice(0, 2).toUpperCase() || '';

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)', bgcolor: 'background.default' }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 400, width: '100%', textAlign: 'center', borderRadius: 3 }}>
        <Avatar
          src={server?.iconUrl || undefined}
          sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: 'primary.main', fontSize: 28, fontWeight: 700 }}
        >
          {!server?.iconUrl && initials}
        </Avatar>
        <Typography variant="h5" fontWeight={700} gutterBottom>{server?.name}</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {server?.memberCount} member{server?.memberCount !== 1 ? 's' : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
          Created by {server?.ownerName}
        </Typography>

        {error && <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>}

        {joined ? (
          <Typography color="success.main" fontWeight={600}>Joined! Redirecting…</Typography>
        ) : (
          <Button
            variant="contained" size="large" fullWidth onClick={handleJoin}
            disabled={joining}
          >
            {joining ? <CircularProgress size={22} /> : user ? 'Accept Invite & Join' : 'Sign in to Join'}
          </Button>
        )}
      </Paper>
    </Box>
  );
}
