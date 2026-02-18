import React, { useEffect, useState } from 'react';
import {
  Container, Box, Typography, Button, Card, CardContent, CardActions,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, Stack, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  listPortfolios, createPortfolio, updatePortfolio, deletePortfolio,
} from '../api/portfolioApi';

const EMPTY_FORM = { name: '', title: '', summary: '' };

export default function Portfolios() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [portfolios, setPortfolios] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]     = useState('');

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editing, setEditing]         = useState(null); // null = create mode, object = edit mode
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formError, setFormError]     = useState('');
  const [saving, setSaving]           = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/signin'); return; }
    fetchPortfolios();
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPortfolios = async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await listPortfolios();
      setPortfolios(res.data);
    } catch {
      setListError('Failed to load portfolios');
    } finally {
      setListLoading(false);
    }
  };

  // ── Dialog helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, title: p.title, summary: p.summary });
    setFormError('');
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setSaving(false); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.title.trim() || !form.summary.trim()) {
      return setFormError('All fields are required');
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const res = await updatePortfolio({ id: editing.id, ...form });
        setPortfolios((prev) => prev.map((p) => p.id === editing.id ? res.data : p));
      } else {
        const res = await createPortfolio(form);
        setPortfolios((prev) => [res.data, ...prev]);
      }
      closeDialog();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete helpers ──────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePortfolio({ id: deleteTarget.id });
      setPortfolios((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // Keep dialog open, user can retry
    } finally {
      setDeleting(false);
    }
  };

  const portfolioUrl = (slug) => `${window.location.origin}/${slug}`;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (authLoading || listLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
          My Portfolios
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New Portfolio
        </Button>
      </Box>

      {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

      {portfolios.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Typography color="text.secondary" gutterBottom>
            You have no portfolios yet.
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreate} sx={{ mt: 1 }}>
            Create your first portfolio
          </Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {portfolios.map((p) => (
            <Card key={p.id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Typography variant="h6" fontWeight={700}>{p.name}</Typography>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {p.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1.5,
                }}>
                  {p.summary}
                </Typography>
                <Chip
                  label={portfolioUrl(p.slug)}
                  size="small"
                  clickable
                  onClick={() => window.open(portfolioUrl(p.slug), '_blank')}
                  icon={<OpenInNewIcon style={{ fontSize: 14 }} />}
                  sx={{ fontSize: 11, maxWidth: '100%' }}
                />
              </CardContent>
              <CardActions sx={{ px: 2, pt: 0 }}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => openEdit(p)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => setDeleteTarget(p)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}

      {/* ── Create / Edit dialog ── */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Portfolio' : 'New Portfolio'}</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Portfolio name" fullWidth required autoFocus
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label="Your title / role" fullWidth required
              placeholder="e.g. Full-Stack Developer"
              value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <TextField
              label="Summary / bio" fullWidth required multiline rows={4}
              value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Portfolio</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
