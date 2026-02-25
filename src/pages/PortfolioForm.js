import React, { useEffect, useState } from 'react';
import {
  Container, Box, Typography, TextField, Button,
  Alert, Stack, CircularProgress,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createPortfolio, updatePortfolio, getPortfolioBySlug } from '../api/portfolioApi';

const EMPTY = { name: '', title: '', summary: '' };

export default function PortfolioForm() {
  const { portfolioKey } = useParams();   // undefined on /portfolios/add
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  const isEdit = Boolean(portfolioKey);

  const [form,        setForm]        = useState(EMPTY);
  const [portfolioId, setPortfolioId] = useState(null);
  const [loading,     setLoading]     = useState(isEdit);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (!isEdit) return;

    // If navigated from the list the portfolio data is in router state — no extra fetch needed
    const prefetched = location.state?.portfolio;
    if (prefetched) {
      setPortfolioId(prefetched.id || prefetched._id);
      setForm({ name: prefetched.name, title: prefetched.title, summary: prefetched.summary });
      setLoading(false);
      return;
    }

    // Direct URL visit — fetch by slug
    getPortfolioBySlug(portfolioKey)
      .then((res) => {
        const p = res.data;
        // Verify ownership (userId is populated, _id always included by Mongoose)
        const ownerId = (typeof p.userId === 'object' ? p.userId._id : p.userId)?.toString();
        if (ownerId !== user?._id?.toString()) {
          navigate('/portfolios', { replace: true });
          return;
        }
        setPortfolioId(p.id || p._id);
        setForm({ name: p.name, title: p.title, summary: p.summary });
      })
      .catch(() => navigate('/portfolios', { replace: true }))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioKey, isEdit]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.title.trim() || !form.summary.trim()) {
      setError('All fields are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await updatePortfolio({ id: portfolioId, ...form });
      } else {
        await createPortfolio(form);
      }
      navigate('/portfolios');
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 1 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/portfolios')}
          color="inherit"
        >
          Back
        </Button>
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
          {isEdit ? 'Edit Portfolio' : 'New Portfolio'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Stack spacing={3}>
        <TextField
          label="Portfolio name" fullWidth required autoFocus
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <TextField
          label="Your title / role" fullWidth required
          placeholder="e.g. Full-Stack Developer"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <TextField
          label="Summary / bio" fullWidth required multiline rows={6}
          value={form.summary}
          onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
        />
        <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
          <Button variant="outlined" onClick={() => navigate('/portfolios')} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Portfolio'}
          </Button>
        </Box>
      </Stack>
    </Container>
  );
}
