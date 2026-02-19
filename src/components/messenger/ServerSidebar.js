import React, { useEffect, useState } from 'react';
import {
  Box, Avatar, Tooltip, IconButton, Divider, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Menu, MenuItem, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Chat as DmsIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  ExitToApp as LeaveIcon,
  Link as InviteIcon,
  Explore as DiscoverIcon,
  DeleteForever as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { listServers, createServer, leaveServer, deleteServer, listChannels } from '../../api/serversApi';
import { useMessenger } from '../../context/MessengerContext';
import ServerSettings from './ServerSettings';

function ServerIcon({ server, selected, onClick, onContextMenu }) {
  const initials = server.name.slice(0, 2).toUpperCase();
  return (
    <Tooltip title={server.name} placement="right" arrow>
      <Avatar
        src={server.iconUrl || undefined}
        onClick={onClick}
        onContextMenu={onContextMenu}
        sx={{
          width: 48, height: 48, cursor: 'pointer', mb: 0.5,
          borderRadius: selected ? '30%' : '50%',
          bgcolor: selected ? 'primary.main' : 'grey.400',
          color: 'white', fontWeight: 700,
          transition: 'border-radius 0.15s, background-color 0.15s',
          boxShadow: selected ? 'inset 0 0 0 2px white, 0 0 0 3px #1976d2' : 'none',
          '&:hover': { borderRadius: '30%', bgcolor: 'primary.light' },
        }}
      >
        {!server.iconUrl && initials}
      </Avatar>
    </Tooltip>
  );
}

export default function ServerSidebar() {
  const navigate  = useNavigate();
  const {
    selectedServerId, setSelectedServerId,
    setSelectedConversationId, setChannelName,
  } = useMessenger();

  const [servers,     setServers]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [creating,    setCreating]    = useState(false);
  const [createOpen,  setCreateOpen]  = useState(false);
  const [name,        setName]        = useState('');
  const [err,         setErr]         = useState('');
  const [ctxMenu,     setCtxMenu]     = useState(null);
  const [ctxServer,   setCtxServer]   = useState(null);
  const [leaveOpen,   setLeaveOpen]   = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [settingsOpen,setSettingsOpen]= useState(false);

  const fetchServers = () =>
    listServers()
      .then((res) => setServers(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { fetchServers(); }, []);

  const handleServerClick = async (s) => {
    setSelectedServerId(s.id.toString());
    setSelectedConversationId(null);
    try {
      const res = await listChannels({ serverId: s.id.toString() });
      const first = (res.data || [])[0];
      if (first?.channelKey) navigate(`/messenger/channels/${first.channelKey}`);
    } catch { /* silent */ }
  };

  const handleContextMenu = (e, s) => {
    e.preventDefault();
    setCtxMenu({ mouseX: e.clientX, mouseY: e.clientY });
    setCtxServer(s);
  };

  const closeCtx = () => { setCtxMenu(null); };

  const handleCopyInvite = () => {
    if (!ctxServer?.inviteKey) return;
    const url = `${window.location.origin}/messenger/servers/invite/${ctxServer.inviteKey}`;
    navigator.clipboard.writeText(url).catch(() => {});
    closeCtx();
  };

  const handleLeave = async () => {
    if (!ctxServer) return;
    try { await leaveServer({ serverId: ctxServer.id.toString() }); } catch { /* silent */ }
    setLeaveOpen(false);
    setServers((prev) => prev.filter((s) => s.id.toString() !== ctxServer.id.toString()));
    if (selectedServerId === ctxServer.id.toString()) {
      setSelectedServerId(null);
      setSelectedConversationId(null);
      navigate('/messenger');
    }
    setCtxServer(null);
  };

  const handleDelete = async () => {
    if (!ctxServer) return;
    setDeleting(true);
    try {
      await deleteServer({ serverId: ctxServer.id.toString() });
    } catch { /* silent */ }
    setDeleting(false);
    setDeleteOpen(false);
    setServers((prev) => prev.filter((s) => s.id.toString() !== ctxServer.id.toString()));
    if (selectedServerId === ctxServer.id.toString()) {
      setSelectedServerId(null);
      setSelectedConversationId(null);
      navigate('/messenger');
    }
    setCtxServer(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true); setErr('');
    try {
      const res = await createServer({ name });
      const newS = { id: res.data.serverId, name: res.data.name, inviteKey: res.data.inviteKey, isOwner: true };
      setServers((prev) => [...prev, newS]);
      setCreateOpen(false); setName('');
      if (res.data.firstChannelKey) navigate(`/messenger/channels/${res.data.firstChannelKey}`);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create server');
    } finally {
      setCreating(false);
    }
  };

  const handleServerUpdated = (updated) => {
    setServers((prev) => prev.map((s) =>
      s.id.toString() === updated.id.toString() ? { ...s, ...updated } : s
    ));
  };

  return (
    <Box sx={{
      width: 72, flexShrink: 0,
      bgcolor: 'grey.200',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      py: 1, gap: 0.5, overflowY: 'auto',
      borderRight: '1px solid', borderColor: 'divider',
    }}>
      {/* DMs button */}
      <Tooltip title="Direct Messages" placement="right" arrow>
        <Avatar
          onClick={() => { setSelectedServerId(null); setSelectedConversationId(null); navigate('/messenger'); }}
          sx={{
            width: 48, height: 48, cursor: 'pointer', mb: 0.5,
            bgcolor: selectedServerId === null ? 'primary.main' : 'grey.400',
            color: 'white',
            borderRadius: selectedServerId === null ? '30%' : '50%',
            transition: 'border-radius 0.15s, background-color 0.15s',
            '&:hover': { borderRadius: '30%', bgcolor: 'primary.light' },
          }}
        >
          <DmsIcon />
        </Avatar>
      </Tooltip>

      <Divider sx={{ width: 36, my: 0.5 }} />

      {loading ? (
        <CircularProgress size={24} sx={{ mt: 1 }} />
      ) : (
        servers.map((s) => (
          <ServerIcon
            key={s.id}
            server={s}
            selected={selectedServerId === s.id?.toString()}
            onClick={() => handleServerClick(s)}
            onContextMenu={(e) => handleContextMenu(e, s)}
          />
        ))
      )}

      <Divider sx={{ width: 36, my: 0.5 }} />

      {/* Browse public servers */}
      <Tooltip title="Discover Servers" placement="right" arrow>
        <IconButton
          onClick={() => { setSelectedServerId(null); setSelectedConversationId(null); navigate('/messenger'); }}
          sx={{ width: 48, height: 48, bgcolor: 'grey.300', borderRadius: '50%', transition: 'border-radius 0.15s', '&:hover': { borderRadius: '30%', bgcolor: 'info.light', color: 'white' } }}
        >
          <DiscoverIcon />
        </IconButton>
      </Tooltip>

      {/* Create server */}
      <Tooltip title="Create Server" placement="right" arrow>
        <IconButton
          onClick={() => setCreateOpen(true)}
          sx={{ width: 48, height: 48, bgcolor: 'grey.300', color: 'success.main', borderRadius: '50%', transition: 'border-radius 0.15s', '&:hover': { borderRadius: '30%', bgcolor: 'success.light', color: 'white' } }}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>

      {/* Right-click context menu */}
      <Menu
        open={!!ctxMenu}
        onClose={closeCtx}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
      >
        <MenuItem onClick={() => { setSettingsOpen(true); closeCtx(); }}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Server Settings</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyInvite}>
          <ListItemIcon><InviteIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Copy Invite Link</ListItemText>
        </MenuItem>
        {ctxServer && !ctxServer.isOwner && [
          <Divider key="d" />,
          <MenuItem key="leave" onClick={() => { setLeaveOpen(true); closeCtx(); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><LeaveIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Leave Server</ListItemText>
          </MenuItem>,
        ]}
        {ctxServer && ctxServer.isOwner && [
          <Divider key="d2" />,
          <MenuItem key="delete" onClick={() => { setDeleteOpen(true); closeCtx(); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Delete Server</ListItemText>
          </MenuItem>,
        ]}
      </Menu>

      {/* Leave confirm */}
      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Leave Server</DialogTitle>
        <DialogContent>Are you sure you want to leave <strong>{ctxServer?.name}</strong>?</DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleLeave}>Leave</Button>
        </DialogActions>
      </Dialog>

      {/* Delete server confirm */}
      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon fontSize="small" />
          Delete Server
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 1 }}>
            Are you sure you want to permanently delete <strong>{ctxServer?.name}</strong>?
          </Box>
          <Box sx={{ color: 'text.secondary', fontSize: 14 }}>
            This will remove all channels, messages, and members. This action cannot be undone.
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}>
            {deleting ? 'Deleting…' : 'Delete Server'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create server */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
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
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Server settings dialog */}
      {settingsOpen && ctxServer && (
        <ServerSettings
          server={ctxServer}
          onClose={() => setSettingsOpen(false)}
          onUpdated={handleServerUpdated}
        />
      )}
    </Box>
  );
}
