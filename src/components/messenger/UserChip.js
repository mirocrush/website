import React, { useState } from 'react';
import {
  Box, Avatar, Typography, Popover, Button, Divider, CircularProgress, Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getFriendStatus, sendRequest, respondToRequest } from '../../api/friendsApi';
import { upsertDm } from '../../api/dmsApi';

function avatarColor(username) {
  const colors = ['#1976d2','#388e3c','#d32f2f','#7b1fa2','#f57c00','#0288d1','#c2185b','#00796b'];
  let hash = 0;
  for (const c of (username || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function ProfilePopup({ user, anchorEl, onClose }) {
  const { user: me } = useAuth();
  const navigate = useNavigate();

  const [friendStatus, setFriendStatus] = useState(null); // null = loading
  const [requestId,    setRequestId]    = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isMe = me && (me.id === user.id || me._id === user.id || me.username === user.username);

  React.useEffect(() => {
    if (!anchorEl || isMe) return;
    getFriendStatus({ otherUserId: user.id })
      .then((res) => {
        setFriendStatus(res.data.status);
        setRequestId(res.data.requestId || null);
      })
      .catch(() => setFriendStatus('none'));
  }, [anchorEl, user.id, isMe]);

  const handleSendDm = async () => {
    try {
      const res = await upsertDm({ otherUserId: user.id });
      if (res.success) {
        navigate(`/messenger/channels/@me/${res.data.dmKey}`);
        onClose();
      }
    } catch { /* silent */ }
  };

  const handleFriendAction = async () => {
    setActionLoading(true);
    try {
      if (friendStatus === 'none') {
        await sendRequest({ query: user.username });
        setFriendStatus('pending_sent');
      } else if (friendStatus === 'pending_received' && requestId) {
        await respondToRequest({ requestId, action: 'accept' });
        setFriendStatus('friends');
      }
    } catch { /* silent */ }
    setActionLoading(false);
  };

  const friendButtonLabel = () => {
    if (friendStatus === null) return '…';
    if (friendStatus === 'friends')         return 'Friends ✓';
    if (friendStatus === 'pending_sent')    return 'Pending…';
    if (friendStatus === 'pending_received') return 'Accept Request';
    return 'Add Friend';
  };

  const initials = user.displayName?.slice(0, 1).toUpperCase() || '?';

  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{ sx: { width: 260, borderRadius: 2, overflow: 'hidden' } }}
    >
      {/* Header banner */}
      <Box sx={{ bgcolor: 'primary.main', height: 60 }} />

      <Box sx={{ px: 2, pb: 2 }}>
        <Avatar
          src={user.avatarUrl || undefined}
          sx={{
            width: 64, height: 64, mt: -4, mb: 1,
            bgcolor: avatarColor(user.username),
            fontSize: 24, fontWeight: 700,
            border: '3px solid white',
          }}
        >
          {!user.avatarUrl && initials}
        </Avatar>

        <Typography variant="subtitle1" fontWeight={700}>{user.displayName}</Typography>
        <Typography variant="caption" color="text.secondary">@{user.username}</Typography>

        <Divider sx={{ my: 1.5 }} />

        {isMe ? (
          <Button fullWidth variant="outlined" size="small" onClick={() => { navigate('/profile'); onClose(); }}>
            Edit Profile
          </Button>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button fullWidth variant="contained" size="small" onClick={handleSendDm}>
              Send Message
            </Button>
            <Button
              fullWidth variant="outlined" size="small"
              onClick={handleFriendAction}
              disabled={actionLoading || friendStatus === 'friends' || friendStatus === 'pending_sent' || friendStatus === null}
            >
              {actionLoading ? <CircularProgress size={14} /> : friendButtonLabel()}
            </Button>
          </Box>
        )}
      </Box>
    </Popover>
  );
}

export default function UserChip({ user, size = 'sm', avatarOnly = false, nameOnly = false }) {
  const [anchor, setAnchor] = useState(null);

  if (!user) return null;

  const initials = user.displayName?.slice(0, 1).toUpperCase() || '?';
  const avatarSize = size === 'lg' ? 36 : 22;

  const handleClick = (e) => { e.stopPropagation(); setAnchor(e.currentTarget); };

  return (
    <>
      <Box
        component="span"
        onClick={handleClick}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
      >
        {!nameOnly && (
          <Avatar
            src={user.avatarUrl || undefined}
            sx={{ width: avatarSize, height: avatarSize, fontSize: avatarSize * 0.45, bgcolor: avatarColor(user.username) }}
          >
            {!user.avatarUrl && initials}
          </Avatar>
        )}
        {!avatarOnly && (
          <Typography component="span" variant="body2" fontWeight={700}>
            {user.displayName}
          </Typography>
        )}
      </Box>

      {anchor && (
        <ProfilePopup
          user={user}
          anchorEl={anchor}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
