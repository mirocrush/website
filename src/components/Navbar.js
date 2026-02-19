import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box,
  Avatar, Menu, MenuItem, Divider, IconButton, Tooltip,
  CircularProgress, Badge,
} from '@mui/material';
import {
  Article as ArticleIcon,
  Add as AddIcon,
  Logout as LogoutIcon,
  Login as LoginIcon,
  PersonAdd as SignupIcon,
  ManageAccounts as ProfileIcon,
  Web as PortfoliosIcon,
  People as FriendsIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listRequests } from '../api/friendsApi';

// Portfolio pages are stand-alone — hide the main Navbar on them
const SLUG_RE = /^\/[0-9a-f]{32}$/i;

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signout } = useAuth();

  const [anchorEl, setAnchorEl]       = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Fetch pending friend request count whenever user changes
  useEffect(() => {
    if (!user) { setPendingCount(0); return; }
    listRequests('received')
      .then((res) => setPendingCount(res.data.length))
      .catch(() => {});
  }, [user]);

  if (SLUG_RE.test(location.pathname)) return null;

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
          Talent Code Hub
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
              <Tooltip title="Messenger" arrow>
                <IconButton
                  color="inherit"
                  onClick={() => navigate('/messenger')}
                  sx={{ opacity: location.pathname === '/messenger' ? 1 : 0.75 }}
                >
                  <ChatIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title={`${user.displayName} · ${user.email}`} arrow>
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
                  <Badge
                    badgeContent={pendingCount || 0}
                    color="error"
                    invisible={!pendingCount}
                    overlap="circular"
                  >
                    <Avatar
                      src={user.avatarUrl || undefined}
                      sx={{
                        width: 34, height: 34,
                        bgcolor: 'secondary.main',
                        fontSize: 14, fontWeight: 700,
                      }}
                    >
                      {!user.avatarUrl && initials}
                    </Avatar>
                  </Badge>
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
                    @{user.username} · {user.email}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/friends'); }} sx={{ gap: 1 }}>
                  <Badge badgeContent={pendingCount || 0} color="error" invisible={!pendingCount}>
                    <FriendsIcon fontSize="small" />
                  </Badge>
                  Friends
                  {!!pendingCount && (
                    <Typography variant="caption" color="error.main" sx={{ ml: 'auto', fontWeight: 700 }}>
                      {pendingCount} new
                    </Typography>
                  )}
                </MenuItem>
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/portfolios'); }} sx={{ gap: 1 }}>
                  <PortfoliosIcon fontSize="small" />
                  My Portfolios
                </MenuItem>
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
