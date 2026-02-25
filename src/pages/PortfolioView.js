import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import { getPortfolioBySlug } from '../api/portfolioApi';
import ThemeRenderer from '../themes/ThemeRenderer';

export default function PortfolioView() {
  const { slug } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [notFound,  setNotFound]  = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    getPortfolioBySlug(slug)
      .then((res) => setPortfolio(res.data))
      .catch((err) => { if (err.response?.status === 404) setNotFound(true); })
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
          The link may be incorrect or this portfolio has been removed.
        </Typography>
      </Box>
    );
  }

  return <ThemeRenderer portfolio={portfolio} />;
}
