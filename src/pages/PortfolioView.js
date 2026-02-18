import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Divider } from '@mui/material';
import { getPortfolioBySlug } from '../api/portfolioApi';

export default function PortfolioView() {
  const { slug } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [notFound, setNotFound]   = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    getPortfolioBySlug(slug)
      .then((res) => setPortfolio(res.data))
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !portfolio) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', gap: 1 }}>
        <Typography variant="h5" fontWeight={700} color="text.secondary">Portfolio not found</Typography>
        <Typography variant="body2" color="text.disabled">
          The link may be incorrect or the portfolio may have been removed.
        </Typography>
      </Box>
    );
  }

  const ownerName = portfolio.userId?.displayName || '';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#ffffff',
      }}
    >
      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: 3,
          py: 8,
          textAlign: 'center',
          maxWidth: 680,
          mx: 'auto',
          width: '100%',
        }}
      >
        {ownerName && (
          <Typography variant="overline" color="text.secondary" letterSpacing={2}>
            {ownerName}
          </Typography>
        )}

        <Typography
          variant="h2"
          fontWeight={800}
          sx={{ mt: 1, mb: 1, lineHeight: 1.15, fontSize: { xs: '2rem', sm: '3rem' } }}
        >
          {portfolio.name}
        </Typography>

        <Typography
          variant="h5"
          color="primary.main"
          fontWeight={500}
          sx={{ mb: 3, fontSize: { xs: '1.1rem', sm: '1.4rem' } }}
        >
          {portfolio.title}
        </Typography>

        <Divider sx={{ width: 48, borderWidth: 2, borderColor: 'primary.main', mb: 3 }} />

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap', textAlign: 'left', maxWidth: 560 }}
        >
          {portfolio.summary}
        </Typography>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 3, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.disabled">
          Built on TalentCodeHub
        </Typography>
      </Box>
    </Box>
  );
}
