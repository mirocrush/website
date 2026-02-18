import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Avatar, Button, CircularProgress,
  Chip, Divider,
} from '@mui/material';
import {
  PersonAdd as AddFriendIcon,
  Check as FriendsIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../api/usersApi';
import { sendRequest, listFriends, listRequests } from '../api/friendsApi';

// Deterministic avatar color from username
function avatarColor(username) {
  const colors = ['#1976d2','#388e3c','#d32f2f','#7b1fa2','#f57c00','#0288d1','#c2185b','#00796b'];
  let hash = 0;
  for (const c of (username || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function UserProfile() {
  const { username }  = useParams();
  const { user: me }  = useAuth();
  const navigate      = useNavigate();

  const [profile,  setProfile]  = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading,  setLoading]  = useState(true);

  // Relationship state: 'none' | 'self' | 'friends' | 'pending_sent' | 'pending_received'
  const [relation, setRelation] = useState('none');
  const [sending,  setSending]  = useState(false);
  const [relMsg,   setRelMsg]   = useState('');

  useEffect(() => {
    getUserProfile(username)
      .then((res) => setProfile(res.data))
      .catch((err) => { if (err.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [username]);

  // Determine relationship once profile + auth loaded
  useEffect(() => {
    if (!profile || !me) return;
    if (me.username === profile.username) { setRelation('self'); return; }

    Promise.all([listFriends(), listRequests('sent'), listRequests('received')])
      .then(([f, s, r]) => {
        if (f.data.some((x) => x.username === profile.username)) {
          setRelation('friends');
        } else if (s.data.some((x) => x.receiver.username === profile.username)) {
          setRelation('pending_sent');
        } else if (r.data.some((x) => x.sender.username === profile.username)) {
          setRelation('pending_received');
        } else {
          setRelation('none');
        }
      })
      .catch(() => {});
  }, [profile, me]);

  const handleAddFriend = async () => {
    setSending(true);
    setRelMsg('');
    try {
      await sendRequest({ query: profile.username });
      setRelation('pending_sent');
    } catch (err) {
      setRelMsg(err.response?.data?.message || 'Could not send request');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !profile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 1 }}>
        <Typography variant="h5" fontWeight={700} color="text.secondary">User not found</Typography>
        <Typography variant="body2" color="text.disabled">@{username} doesn't exist.</Typography>
        <Button onClick={() => navigate(-1)} sx={{ mt: 2 }}>Go back</Button>
      </Box>
    );
  }

  const initials = profile.displayName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const joined   = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const RelationButton = () => {
    if (relation === 'self')             return null;
    if (!me)                             return (
      <Button variant="outlined" onClick={() => navigate('/signin')}>Sign in to add friend</Button>
    );
    if (relation === 'friends')          return <Chip icon={<FriendsIcon />} label="Friends" color="success" />;
    if (relation === 'pending_sent')     return <Chip icon={<PendingIcon />} label="Request Sent" />;
    if (relation === 'pending_received') return <Chip icon={<PendingIcon />} label="Respond in Friends" />;
    return (
      <Button
        variant="contained"
        startIcon={sending ? <CircularProgress size={16} /> : <AddFriendIcon />}
        onClick={handleAddFriend}
        disabled={sending}
      >
        Add Friend
      </Button>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Cover */}
      <Box sx={{ height: 180, bgcolor: 'primary.main' }} />

      {/* Profile card */}
      <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 2, sm: 4 }, position: 'relative' }}>
        {/* Avatar */}
        <Avatar
          src={profile.avatarUrl || undefined}
          sx={{
            width: 120, height: 120,
            border: '4px solid white',
            bgcolor: avatarColor(profile.username),
            fontSize: 42, fontWeight: 700,
            position: 'absolute',
            top: -60,
          }}
        >
          {!profile.avatarUrl && initials}
        </Avatar>

        {/* Action row */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1.5, pb: 1 }}>
          <RelationButton />
        </Box>

        {relMsg && <Typography color="error" variant="body2" sx={{ mb: 1 }}>{relMsg}</Typography>}

        {/* Name + username */}
        <Box sx={{ mt: 1 }}>
          <Typography variant="h4" fontWeight={800}>{profile.displayName}</Typography>
          <Typography variant="body1" color="text.secondary">@{profile.username}</Typography>
          <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
            Member since {joined}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Placeholder for future content (posts, portfolios, etc.) */}
        <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
          More profile content coming soon.
        </Typography>
      </Box>
    </Box>
  );
}
