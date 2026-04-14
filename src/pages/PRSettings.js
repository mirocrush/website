import React, { useState, useEffect } from 'react';
import {
  Container, Box, Typography, Divider, Alert, Button,
  FormControl, InputLabel, Select, MenuItem, Slider, TextField,
  IconButton, Tooltip, LinearProgress, List, ListItem,
  CircularProgress, InputAdornment,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import {
  addGithubToken, removeGithubToken, getTokenUsage,
  setFetchOrder, setScoreFilters,
} from '../api/authApi';

// ── Helpers ───────────────────────────────────────────────────────────────

const FETCH_ORDER_OPTIONS = [
  { value: 'oldest',       label: 'Oldest first (default)' },
  { value: 'newest',       label: 'Newest first' },
  { value: 'alphabetical', label: 'Alphabetical (A → Z by title)' },
  { value: 'priority',     label: 'Priority (pinned first, then priority rank)' },
  { value: 'random',       label: 'Random' },
];

function usageColor(remaining, limit) {
  if (!limit) return 'text.disabled';
  const pct = remaining / limit;
  if (pct > 0.5) return 'success.main';
  if (pct > 0.15) return 'warning.main';
  return 'error.main';
}

function TokenUsageBar({ remaining, limit, resetAt }) {
  const pct     = limit > 0 ? Math.round((remaining / limit) * 100) : 0;
  const color   = pct > 50 ? 'success' : pct > 15 ? 'warning' : 'error';
  const resetIn = resetAt ? Math.max(0, Math.round((resetAt - Date.now()) / 60000)) : null;
  return (
    <Box sx={{ minWidth: 180 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography variant="caption" sx={{ color: usageColor(remaining, limit) }}>
          {remaining.toLocaleString()} / {limit.toLocaleString()} remaining
        </Typography>
        {resetIn !== null && (
          <Typography variant="caption" color="text.disabled">
            resets in {resetIn}m
          </Typography>
        )}
      </Box>
      <LinearProgress variant="determinate" value={pct} color={color} sx={{ height: 5, borderRadius: 1 }} />
    </Box>
  );
}

// ── Issue Fetch Order ─────────────────────────────────────────────────────

function FetchOrderSection() {
  const { user, setUser }     = useAuth();
  const [order, setOrder]     = useState('oldest');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.fetchOrder) setOrder(user.fetchOrder);
  }, [user?.fetchOrder]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await setFetchOrder({ fetchOrder: order });
      setUser(res.data);
      setSuccess('Fetch order saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save fetch order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 420 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Issue Fetch Order</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Controls the order in which the Python client apps pick up issues to work on.
      </Typography>
      {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Fetch Order</InputLabel>
        <Select value={order} onChange={(e) => setOrder(e.target.value)} label="Fetch Order">
          {FETCH_ORDER_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button variant="contained" onClick={handleSave} disabled={loading}>
        {loading ? 'Saving…' : 'Save Preference'}
      </Button>
    </Box>
  );
}

// ── GitHub Tokens ─────────────────────────────────────────────────────────

function GitHubTokenSection() {
  const { user, setUser } = useAuth();
  const [newToken,     setNewToken]     = useState('');
  const [newLabel,     setNewLabel]     = useState('');
  const [showNew,      setShowNew]      = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [removingId,   setRemovingId]   = useState(null);
  const [usages,       setUsages]       = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');

  const tokens = user?.githubTokens || [];

  const loadUsages = async () => {
    setUsageLoading(true);
    try {
      const res = await getTokenUsage();
      setUsages(res.data.data || []);
    } catch { /* ignore */ }
    finally { setUsageLoading(false); }
  };

  useEffect(() => {
    if (tokens.length > 0) loadUsages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens.length]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newToken.trim()) return;
    setError(''); setSuccess(''); setAdding(true);
    try {
      const res = await addGithubToken({ token: newToken.trim(), label: newLabel.trim() });
      setUser(res.data);
      setNewToken(''); setNewLabel('');
      setSuccess('Token added');
      loadUsages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add token');
    } finally { setAdding(false); }
  };

  const handleRemove = async (id) => {
    setRemovingId(id); setError('');
    try {
      const res = await removeGithubToken({ id });
      setUser(res.data);
      setUsages(prev => prev.filter(u => u.id !== id));
    } catch { setError('Failed to remove token'); }
    finally { setRemovingId(null); }
  };

  return (
    <Box sx={{ maxWidth: 520 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>GitHub Tokens</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add multiple tokens to raise rate limits (5 000 req/hr each). The server automatically
        rotates to the next token when one is exhausted. Generate tokens at GitHub → Settings →
        Developer settings → Personal access tokens.
      </Typography>

      {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {tokens.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Configured tokens ({tokens.length})
            </Typography>
            <Tooltip title="Refresh usage">
              <IconButton size="small" onClick={loadUsages} disabled={usageLoading}>
                <RefreshIcon fontSize="small" sx={usageLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              </IconButton>
            </Tooltip>
          </Box>
          <List disablePadding>
            {tokens.map((t) => {
              const usage = usages.find(u => u.id === t.id);
              return (
                <ListItem
                  key={t.id}
                  disablePadding
                  sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.75 }}
                >
                  <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {t.label || <em style={{ color: '#999' }}>unlabelled</em>}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                        {t.masked}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small" color="error"
                      disabled={removingId === t.id}
                      onClick={() => handleRemove(t.id)}
                    >
                      {removingId === t.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                    </IconButton>
                  </Box>
                  {usageLoading && !usage && (
                    <LinearProgress sx={{ width: '100%', height: 4, borderRadius: 1 }} />
                  )}
                  {usage && (
                    <TokenUsageBar remaining={usage.remaining} limit={usage.limit} resetAt={usage.resetAt} />
                  )}
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}

      <Box component="form" onSubmit={handleAdd}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Add a token</Typography>
        <TextField
          label="Label (optional)"
          size="small" fullWidth
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="e.g. personal, work"
          sx={{ mb: 1.5 }}
        />
        <TextField
          label="Personal Access Token"
          size="small" fullWidth required
          value={newToken}
          onChange={e => setNewToken(e.target.value)}
          type={showNew ? 'text' : 'password'}
          placeholder="ghp_..."
          sx={{ mb: 1.5 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowNew(v => !v)} edge="end">
                  {showNew ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={adding || !newToken.trim()}>
          {adding ? 'Adding…' : 'Add Token'}
        </Button>
      </Box>
    </Box>
  );
}

// ── Smart Search Score Filters ────────────────────────────────────────────

function ScoreFiltersSection() {
  const { user, setUser }   = useAuth();
  const [minRepo,  setMinRepo]  = useState(0);
  const [minIssue, setMinIssue] = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  useEffect(() => {
    setMinRepo(user?.minRepoScore  ?? 0);
    setMinIssue(user?.minIssueScore ?? 0);
  }, [user?.minRepoScore, user?.minIssueScore]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await setScoreFilters({ minRepoScore: minRepo, minIssueScore: minIssue });
      setUser(res.data);
      setSuccess('Score filters saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save score filters');
    } finally { setLoading(false); }
  };

  const scoreColor = (v) => v >= 75 ? 'success.main' : v >= 50 ? 'warning.main' : v >= 25 ? 'info.main' : 'text.disabled';

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 480 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Smart Search Filters</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Only show repos and issues at or above these score thresholds in Smart Search.
        Set to 0 to disable filtering.
      </Typography>
      {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>Min Repo Score</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color: minRepo > 0 ? scoreColor(minRepo) : 'text.secondary' }}>
            {minRepo === 0 ? 'Off' : `≥ ${minRepo}`}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Filters Repo Search results and Random Search repos
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Slider
            value={minRepo}
            onChange={(_, v) => setMinRepo(v)}
            min={0} max={100} step={5}
            marks={[{ value: 0 }, { value: 25 }, { value: 50 }, { value: 75 }, { value: 100 }]}
            valueLabelDisplay="auto"
            sx={{ flex: 1, color: minRepo > 0 ? scoreColor(minRepo) : 'grey.400' }}
          />
          <TextField
            type="number" size="small"
            value={minRepo}
            onChange={e => setMinRepo(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            inputProps={{ min: 0, max: 100, style: { width: 52, textAlign: 'center', padding: '4px 6px' } }}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
          />
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>Min Issue Score</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color: minIssue > 0 ? scoreColor(minIssue) : 'text.secondary' }}>
            {minIssue === 0 ? 'Off' : `≥ ${minIssue}`}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Filters Issue Search results and Random Search review panel
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Slider
            value={minIssue}
            onChange={(_, v) => setMinIssue(v)}
            min={0} max={100} step={5}
            marks={[{ value: 0 }, { value: 25 }, { value: 50 }, { value: 75 }, { value: 100 }]}
            valueLabelDisplay="auto"
            sx={{ flex: 1, color: minIssue > 0 ? scoreColor(minIssue) : 'grey.400' }}
          />
          <TextField
            type="number" size="small"
            value={minIssue}
            onChange={e => setMinIssue(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            inputProps={{ min: 0, max: 100, style: { width: 52, textAlign: 'center', padding: '4px 6px' } }}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
          />
        </Box>
      </Box>

      <Button type="submit" variant="contained" disabled={loading}>
        {loading ? 'Saving…' : 'Save Filters'}
      </Button>
    </Box>
  );
}

// ── PR Settings Page ──────────────────────────────────────────────────────

export default function PRSettings() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <Typography>Please sign in to view settings.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>PR Writer Settings</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Configuration for GitHub tokens, issue fetch behaviour, and search filters.
      </Typography>

      <Divider sx={{ my: 4 }} />
      <FetchOrderSection />
      <Divider sx={{ my: 4 }} />
      <GitHubTokenSection />
      <Divider sx={{ my: 4 }} />
      <ScoreFiltersSection />
    </Container>
  );
}
