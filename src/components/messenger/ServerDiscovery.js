import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, TextField, Select, MenuItem, FormControl, InputLabel,
  Grid, Card, CardContent, CardActions, Avatar, Button, CircularProgress,
  Pagination, InputAdornment,
} from '@mui/material';
import { Search as SearchIcon, Explore as ExploreIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { discoverServers, joinServer } from '../../api/serversApi';
import { useMessenger } from '../../context/MessengerContext';

function ServerCard({ server, onJoined }) {
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await joinServer({ inviteKey: server.inviteKey });
      if (res.success) {
        const key = res.data.firstChannelKey;
        if (key) navigate(`/messenger/channels/${key}`);
        else navigate('/messenger');
        onJoined?.();
      }
    } catch { /* silent */ }
    setJoining(false);
  };

  const handleViewInvite = () => {
    window.open(`/messenger/servers/invite/${server.inviteKey}`, '_blank');
  };

  const initials = server.name.slice(0, 2).toUpperCase();

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Avatar src={server.iconUrl || undefined} sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontWeight: 700 }}>
            {!server.iconUrl && initials}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} noWrap>{server.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {server.memberCount} member{server.memberCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button size="small" variant="contained" onClick={handleJoin} disabled={joining} sx={{ flexGrow: 1 }}>
          {joining ? <CircularProgress size={16} /> : 'Join'}
        </Button>
        <Button size="small" variant="outlined" onClick={handleViewInvite}>Invite Link</Button>
      </CardActions>
    </Card>
  );
}

export default function ServerDiscovery() {
  const [servers,  setServers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [sort,     setSort]     = useState('members');
  const [page,     setPage]     = useState(1);
  const [pages,    setPages]    = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discoverServers({ page, limit: 12, search: debouncedSearch, sort });
      if (res.success) {
        setServers(res.data);
        setPages(res.pages || 1);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [page, debouncedSearch, sort]);

  useEffect(() => { fetchServers(); }, [fetchServers]);
  useEffect(() => { setPage(1); }, [debouncedSearch, sort]);

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <ExploreIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>Discover Servers</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Search servers…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ flexGrow: 1, maxWidth: 360 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Sort by</InputLabel>
          <Select value={sort} label="Sort by" onChange={(e) => setSort(e.target.value)}>
            <MenuItem value="members">Most Members</MenuItem>
            <MenuItem value="newest">Newest</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
      ) : servers.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', pt: 6 }}>
          No public servers found.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {servers.map((s) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
              <ServerCard server={s} onJoined={fetchServers} />
            </Grid>
          ))}
        </Grid>
      )}

      {pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination count={pages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
        </Box>
      )}
    </Box>
  );
}
