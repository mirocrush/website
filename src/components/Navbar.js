import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Article as ArticleIcon, Add as AddIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppBar position="sticky" elevation={2}>
      <Toolbar>
        <ArticleIcon sx={{ mr: 1 }} />
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, cursor: 'pointer', fontWeight: 700 }}
          onClick={() => navigate('/blogs')}
        >
          BlogHub
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            color="inherit"
            onClick={() => navigate('/blogs')}
            sx={{ fontWeight: location.pathname === '/blogs' ? 700 : 400 }}
          >
            All Posts
          </Button>
          <Button
            color="inherit"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/create')}
            sx={{ borderColor: 'rgba(255,255,255,0.7)' }}
          >
            New Post
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
