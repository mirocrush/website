import React, { useState } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box,
  Avatar, Menu, MenuItem, Divider, IconButton, Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Article as ArticleIcon,
  Add as AddIcon,
  Logout as LogoutIcon,
  Login as LoginIcon,
  PersonAdd as SignupIcon,
  ManageAccounts as ProfileIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signout } = useAuth();

  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleSignout = async () => {
    setAnchorEl(null);
    await signout();
    navigate('/signin');
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

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

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
            sx={{ borderColor: 'rgba(255,255,255,0.7)', mr: 1 }}
          >
            New Post
          </Button>

          {/* ── Auth section ── */}
          {loading ? (
            <CircularProgress size={22} sx={{ color: 'rgba(255,255,255,0.8)' }} />
          ) : user ? (
            <>
              <Tooltip title={`${user.displayName} · ${user.email}`} arrow>
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
                  <Avatar
                    sx={{
                      width: 34, height: 34,
                      bgcolor: 'secondary.main',
                      fontSize: 14, fontWeight: 700,
                    }}
                  >
                    {initials}
                  </Avatar>
                </IconButton>
              </Tooltip>

              <Menu
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={() => setAnchorEl(null)}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                PaperProps={{ sx: { minWidth: 210, mt: 0.5 } }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    {user.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {user.email}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }} sx={{ gap: 1 }}>
                  <ProfileIcon fontSize="small" />
                  My Account
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleSignout} sx={{ color: 'error.main', gap: 1 }}>
                  <LogoutIcon fontSize="small" />
                  Sign out
                </MenuItem>
              </Menu>
            </>
          ) : (
            <>
              <Button
                color="inherit"
                startIcon={<LoginIcon />}
                onClick={() => navigate('/signin')}
              >
                Sign in
              </Button>
              <Button
                color="inherit"
                variant="outlined"
                startIcon={<SignupIcon />}
                onClick={() => navigate('/signup')}
                sx={{ borderColor: 'rgba(255,255,255,0.7)' }}
              >
                Sign up
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
