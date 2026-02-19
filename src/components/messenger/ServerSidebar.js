import React, { useEffect, useState } from 'react';
import {
  Box, Avatar, Tooltip, IconButton, Divider, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button,
} from '@mui/material';
import {
  Chat as DmsIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { listServers, createServer } from '../../api/serversApi';
import { useMessenger } from '../../context/MessengerContext';

function ServerIcon({ server, selected, onClick }) {
  const initials = server.name.slice(0, 2).toUpperCase();
  return (
    <Tooltip title={server.name} placement="right" arrow>
      <Avatar
        src={server.iconUrl || undefined}
        onClick={onClick}
        sx={{
          width: 48, height: 48, cursor: 'pointer', mb: 0.5,
          borderRadius: selected ? '30%' : '50%',
          bgcolor: 'primary.main',
          transition: 'border-radius 0.15s',
          boxShadow: selected ? '0 0 0 3px white, 0 0 0 5px #1976d2' : 'none',
          '&:hover': { borderRadius: '30%' },
        }}
      >
        {!server.iconUrl && initials}
      </Avatar>
    </Tooltip>
  );
}

export default function ServerSidebar() {
  const { selectedServerId, setSelectedServerId, setSelectedConversationId } = useMessenger();
  const [servers,  setServers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [open,     setOpen]     = useState(false);
  const [name,     setName]     = useState('');
  const [err,      setErr]      = useState('');

  useEffect(() => {
    listServers()
      .then((res) => setServers(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true); setErr('');
    try {
      const res = await createServer({ name });
      setServers((prev) => [...prev, { id: res.data.serverId, name: res.data.name }]);
      setOpen(false); setName('');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create server');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box sx={{
      width: 72, flexShrink: 0,
      bgcolor: '#1a1a2e',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      py: 1, gap: 0.5, overflowY: 'auto',
    }}>
      {/* DMs button */}
      <Tooltip title="Direct Messages" placement="right" arrow>
        <Avatar
          onClick={() => { setSelectedServerId(null); setSelectedConversationId(null); }}
          sx={{
            width: 48, height: 48, cursor: 'pointer', mb: 0.5,
            bgcolor: selectedServerId === null ? 'primary.main' : '#2d2d44',
            borderRadius: selectedServerId === null ? '30%' : '50%',
            transition: 'border-radius 0.15s',
            '&:hover': { borderRadius: '30%', bgcolor: 'primary.main' },
          }}
        >
          <DmsIcon />
        </Avatar>
      </Tooltip>

      <Divider sx={{ width: 36, borderColor: '#444', my: 0.5 }} />

      {loading ? (
        <CircularProgress size={24} sx={{ color: 'grey.500', mt: 1 }} />
      ) : (
        servers.map((s) => (
          <ServerIcon
            key={s.id}
            server={s}
            selected={selectedServerId === s.id?.toString()}
            onClick={() => { setSelectedServerId(s.id?.toString()); setSelectedConversationId(null); }}
          />
        ))
      )}

      {/* Create server */}
      <Divider sx={{ width: 36, borderColor: '#444', my: 0.5 }} />
      <Tooltip title="Create Server" placement="right" arrow>
        <IconButton
          onClick={() => setOpen(true)}
          sx={{
            width: 48, height: 48, bgcolor: '#2d2d44', color: 'success.main',
            borderRadius: '50%', '&:hover': { borderRadius: '30%', bgcolor: 'success.dark' },
            transition: 'border-radius 0.15s',
          }}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>

      {/* Create server dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create a Server</DialogTitle>
        <DialogContent>
          {err && <Box sx={{ color: 'error.main', mb: 1, fontSize: 14 }}>{err}</Box>}
          <TextField
            label="Server name" fullWidth autoFocus value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
