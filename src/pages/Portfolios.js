import React, { useEffect, useState } from 'react';
import {
  Container, Box, Typography, Button, Card, CardContent, CardActions,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, CircularProgress, Stack, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { listPortfolios, deletePortfolio } from '../api/portfolioApi';

export default function Portfolios() {
  const navigate = useNavigate();

  const [portfolios,   setPortfolios]   = useState([]);
  const [listLoading,  setListLoading]  = useState(true);
  const [listError,    setListError]    = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => { fetchPortfolios(); }, []);

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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePortfolio({ id: deleteTarget.id });
      setPortfolios((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch { /* keep dialog open */ }
    setDeleting(false);
  };

  const portfolioUrl = (slug) => `${window.location.origin}/${slug}`;

  if (listLoading) {
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/portfolios/add')}>
          New Portfolio
        </Button>
      </Box>

      {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

      {portfolios.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Typography color="text.secondary" gutterBottom>You have no portfolios yet.</Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => navigate('/portfolios/add')} sx={{ mt: 1 }}>
            Create your first portfolio
          </Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {portfolios.map((p) => (
            <Card key={p.id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Typography variant="h6" fontWeight={700}>{p.name}</Typography>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>{p.title}</Typography>
                {p.bio && (
                  <Typography variant="body2" color="text.secondary" sx={{
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1.5,
                  }}>
                    {p.bio}
                  </Typography>
                )}
                <Chip
                  label={portfolioUrl(p.slug)}
                  size="small" clickable
                  onClick={() => window.open(portfolioUrl(p.slug), '_blank')}
                  icon={<OpenInNewIcon style={{ fontSize: 14 }} />}
                  sx={{ fontSize: 11, maxWidth: '100%' }}
                />
              </CardContent>
              <CardActions sx={{ px: 2, pt: 0 }}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => navigate(`/portfolios/${p.slug}`, { state: { portfolio: p } })}>
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

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
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
