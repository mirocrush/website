import React, { useEffect, useState } from 'react';
import {
  Box, Typography, List, ListItem, ListItemButton, ListItemAvatar,
  ListItemText, Avatar, CircularProgress, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Badge,
} from '@mui/material';
import { Add as AddIcon, Tag as ChannelIcon } from '@mui/icons-material';
import { useMessenger } from '../../context/MessengerContext';
import { listChannels, createChannel } from '../../api/channelsApi';
import { listConversations, fromChannel } from '../../api/conversationsApi';
import { upsertDm } from '../../api/dmsApi';

// ── DM list ──────────────────────────────────────────────────────────────────
function DmList({ onSelect }) {
  const [convs,   setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listConversations({ limit: 50 })
      .then((res) => setConvs(res.data.filter((c) => c.type === 'dm')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CircularProgress size={20} sx={{ m: 2 }} />;
  if (convs.length === 0)
    return <Typography variant="caption" color="text.disabled" sx={{ px: 2 }}>No DMs yet</Typography>;

  return (
    <List dense disablePadding>
      {convs.map((c) => (
        <ListItem key={c.conversationId} disablePadding>
          <ListItemButton onClick={() => onSelect(c.conversationId?.toString())} sx={{ borderRadius: 1, mx: 0.5 }}>
            <ListItemAvatar sx={{ minWidth: 36 }}>
              <Badge color="error" variant="dot" invisible={!c.unread} overlap="circular">
                <Avatar src={c.avatarUrl || undefined} sx={{ width: 32, height: 32, fontSize: 13 }}>
                  {!c.avatarUrl && c.title?.slice(0, 1).toUpperCase()}
                </Avatar>
              </Badge>
            </ListItemAvatar>
            <ListItemText
              primary={c.title}
              primaryTypographyProps={{ variant: 'body2', fontWeight: c.unread ? 700 : 400, noWrap: true }}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}

// ── Channel list ──────────────────────────────────────────────────────────────
function ChannelList({ serverId, onSelect }) {
  const [channels, setChannels] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [open,     setOpen]     = useState(false);
  const [name,     setName]     = useState('');
  const [creating, setCreating] = useState(false);
  const { selectedConversationId } = useMessenger();

  useEffect(() => {
    if (!serverId) return;
    setLoading(true);
    listChannels({ serverId })
      .then((res) => setChannels(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverId]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await createChannel({ serverId, name });
      setChannels((prev) => [...prev, res.data]);
      setOpen(false); setName('');
    } catch { /* silent */ }
    setCreating(false);
  };

  const handleSelect = async (ch) => {
    try {
      const res = await fromChannel({ serverId, channelId: ch.id?.toString() });
      onSelect(res.data.conversationId?.toString());
    } catch { /* silent */ }
  };

  if (loading) return <CircularProgress size={20} sx={{ m: 2 }} />;

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ flexGrow: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Channels
        </Typography>
        <Tooltip title="Create channel">
          <IconButton size="small" onClick={() => setOpen(true)}><AddIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>
      <List dense disablePadding>
        {channels.map((ch) => (
          <ListItem key={ch.id} disablePadding>
            <ListItemButton onClick={() => handleSelect(ch)} sx={{ borderRadius: 1, mx: 0.5 }}>
              <ChannelIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled', flexShrink: 0 }} />
              <ListItemText
                primary={ch.name}
                primaryTypographyProps={{ variant: 'body2', noWrap: true }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Channel</DialogTitle>
        <DialogContent>
          <TextField label="Channel name" fullWidth autoFocus value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChannelSidebar() {
  const { selectedServerId, setSelectedConversationId } = useMessenger();

  const handleSelect = (conversationId) => setSelectedConversationId(conversationId);

  return (
    <Box sx={{
      width: 240, flexShrink: 0,
      bgcolor: 'grey.900',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid', borderColor: 'divider',
      overflowY: 'auto',
    }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.primary">
          {selectedServerId ? 'Channels' : 'Direct Messages'}
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
        {selectedServerId ? (
          <ChannelList serverId={selectedServerId} onSelect={handleSelect} />
        ) : (
          <DmList onSelect={handleSelect} />
        )}
      </Box>
    </Box>
  );
}
