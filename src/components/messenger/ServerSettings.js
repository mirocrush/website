import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Tabs, Tab, Typography, TextField, Button, Avatar,
  Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Menu, MenuItem, Chip, CircularProgress, Alert,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  PhotoCamera as CameraIcon,
} from '@mui/icons-material';
import { updateServer, listServerMembers, kickMember, banMember, muteMember } from '../../api/serversApi';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

// ── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ server, onUpdated }) {
  const [name,     setName]     = useState(server.name || '');
  const [saving,   setSaving]   = useState(false);
  const [uploading,setUploading]= useState(false);
  const [iconUrl,  setIconUrl]  = useState(server.iconUrl || null);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const fileRef = useRef(null);

  const handleSaveName = async () => {
    if (!name.trim() || name.trim() === server.name) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const fd = new FormData();
      fd.append('serverId', server.id.toString());
      fd.append('name', name.trim());
      const res = await updateServer(fd);
      if (res.success) { setSuccess('Server name updated.'); onUpdated(res.data); }
    } catch (e) { setError(e.response?.data?.message || 'Failed to update'); }
    setSaving(false);
  };

  const handleIconChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      const fd = new FormData();
      fd.append('serverId', server.id.toString());
      fd.append('icon', file);
      const res = await updateServer(fd);
      if (res.success) { setIconUrl(res.data.iconUrl); setSuccess('Icon updated.'); onUpdated(res.data); }
    } catch (e) { setError(e.response?.data?.message || 'Failed to upload icon'); }
    setUploading(false);
    e.target.value = '';
  };

  const initials = (server.name || '').slice(0, 2).toUpperCase();

  return (
    <Box sx={{ maxWidth: 420 }}>
      {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Typography variant="subtitle2" fontWeight={700} gutterBottom>Server Icon</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar src={iconUrl || undefined} sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: 24, fontWeight: 700 }}>
          {!iconUrl && initials}
        </Avatar>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleIconChange} />
        <Button variant="outlined" startIcon={uploading ? <CircularProgress size={16} /> : <CameraIcon />}
          onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Change Icon'}
        </Button>
      </Box>

      <Typography variant="subtitle2" fontWeight={700} gutterBottom>Server Name</Typography>
      <TextField fullWidth value={name} onChange={(e) => setName(e.target.value)} size="small" sx={{ mb: 2 }} />
      <Button variant="contained" onClick={handleSaveName} disabled={saving || !name.trim() || name.trim() === server.name}>
        {saving ? 'Saving…' : 'Save Name'}
      </Button>
    </Box>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────
function MembersTab({ server }) {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [anchor,   setAnchor]   = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    listServerMembers({ serverId: server.id.toString() })
      .then((res) => setMembers(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [server.id]);

  const openMenu = (e, m) => { setAnchor(e.currentTarget); setSelected(m); };
  const closeMenu = () => { setAnchor(null); };

  const handleKick = async () => {
    closeMenu();
    if (!selected) return;
    try {
      await kickMember({ serverId: server.id.toString(), userId: selected.userId.toString() });
      setMembers((prev) => prev.filter((m) => m.userId.toString() !== selected.userId.toString()));
    } catch { /* silent */ }
  };

  const handleBan = async () => {
    closeMenu();
    if (!selected) return;
    try {
      await banMember({ serverId: server.id.toString(), userId: selected.userId.toString() });
      setMembers((prev) => prev.filter((m) => m.userId.toString() !== selected.userId.toString()));
    } catch { /* silent */ }
  };

  const handleMute = async () => {
    closeMenu();
    if (!selected) return;
    const newMuted = !selected.muted;
    try {
      await muteMember({ serverId: server.id.toString(), userId: selected.userId.toString(), muted: newMuted });
      setMembers((prev) => prev.map((m) =>
        m.userId.toString() === selected.userId.toString() ? { ...m, muted: newMuted } : m
      ));
    } catch { /* silent */ }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress /></Box>;

  return (
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Member</TableCell>
            <TableCell>Username</TableCell>
            <TableCell>Joined</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.userId}>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar src={m.avatarUrl || undefined} sx={{ width: 28, height: 28, fontSize: 12 }}>
                    {!m.avatarUrl && m.displayName?.slice(0, 1)}
                  </Avatar>
                  <Typography variant="body2">{m.displayName}</Typography>
                  {m.isOwner && <Chip label="Owner" size="small" color="primary" sx={{ fontSize: 10, height: 18 }} />}
                </Box>
              </TableCell>
              <TableCell><Typography variant="caption">@{m.username}</Typography></TableCell>
              <TableCell>
                <Typography variant="caption">
                  {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
                </Typography>
              </TableCell>
              <TableCell>
                {m.muted && <Chip label="Muted" size="small" color="warning" sx={{ fontSize: 10, height: 18 }} />}
              </TableCell>
              <TableCell align="right">
                {!m.isOwner && (
                  <IconButton size="small" onClick={(e) => openMenu(e, m)}>
                    <MoreIcon fontSize="small" />
                  </IconButton>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Menu anchorEl={anchor} open={!!anchor} onClose={closeMenu}>
        <MenuItem onClick={handleMute}>{selected?.muted ? 'Unmute' : 'Mute'}</MenuItem>
        <MenuItem onClick={handleKick} sx={{ color: 'warning.main' }}>Kick</MenuItem>
        <MenuItem onClick={handleBan}  sx={{ color: 'error.main'   }}>Ban</MenuItem>
      </Menu>
    </>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────
export default function ServerSettings({ server, onClose, onUpdated }) {
  const [tab, setTab] = useState(0);

  return (
    <Dialog open fullScreen onClose={onClose} PaperProps={{ sx: { bgcolor: 'background.default' } }}>
      <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={700}>{server.name} — Settings</Typography>
        <Button onClick={onClose} color="inherit">Close</Button>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', height: '100%' }}>
        {/* Left nav */}
        <Box sx={{ width: 200, borderRight: '1px solid', borderColor: 'divider', pt: 2 }}>
          <Tabs orientation="vertical" value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Overview" />
            <Tab label="Members" />
          </Tabs>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
          <TabPanel value={tab} index={0}>
            <OverviewTab server={server} onUpdated={onUpdated} />
          </TabPanel>
          <TabPanel value={tab} index={1}>
            <MembersTab server={server} />
          </TabPanel>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
