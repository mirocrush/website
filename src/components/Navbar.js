import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box,
  Avatar, Menu, MenuItem, Divider, IconButton, Tooltip,
  CircularProgress, Badge,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Login as LoginIcon,
  PersonAdd as SignupIcon,
  ManageAccounts as ProfileIcon,
  Web as PortfoliosIcon,
  People as FriendsIcon,
  Chat as ChatIcon,
  BugReport as IssuesIcon,
  EditNote as PromptsIcon,
  FormatListBulleted as IssueListIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import logoSrc from '../assets/talent-icon.png';
import { useAuth } from '../context/AuthContext';
import { listRequests } from '../api/friendsApi';

const SLUG_RE = /^\/[0-9a-f]{8}([0-9a-f]{24})?$/i;

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signout } = useAuth();

  const [anchorEl, setAnchorEl]       = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

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

  const onIssues = location.pathname === '/blogs' || location.pathname.startsWith('/blogs/');

  return (
    <AppBar position="sticky" elevation={2}>
      <Toolbar>
        {/* Brand */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mr: 2 }}
          onClick={() => navigate('/blogs')}
        >
          <Box
            component="img"
            src={logoSrc}
            alt="Talent Code Hub"
            sx={{ height: 32, width: 32, borderRadius: '6px', mr: 1 }}
          />
          <Typography variant="h6" component="div" sx={{ fontWeight: 700, flexGrow: 0 }}>
            Talent Code Hub
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {user && (
            <Tooltip title="Issues" arrow>
              <IconButton
                color="inherit"
                onClick={() => navigate('/blogs')}
                sx={{ opacity: onIssues ? 1 : 0.75 }}
              >
                <IssueListIcon />
              </IconButton>
            </Tooltip>
          )}

          {loading ? (
            <CircularProgress size={22} sx={{ color: 'rgba(255,255,255,0.8)' }} />
          ) : user ? (
            <>
              <Tooltip title="My Prompts" arrow>
                <IconButton
                  color="inherit"
                  onClick={() => navigate('/prompts')}
                  sx={{ opacity: location.pathname.startsWith('/prompts') ? 1 : 0.75 }}
                >
                  <PromptsIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="GitHub Issues" arrow>
                <IconButton
                  color="inherit"
                  onClick={() => navigate('/github-issues')}
                  sx={{ opacity: location.pathname.startsWith('/github-issues') ? 1 : 0.75 }}
                >
                  <IssuesIcon />
                </IconButton>
              </Tooltip>

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
                      sx={{ width: 34, height: 34, bgcolor: 'secondary.main', fontSize: 14, fontWeight: 700 }}
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
                  <Typography variant="subtitle2" fontWeight={700} noWrap>{user.displayName}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    @{user.username} · {user.email}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/github-issues'); }} sx={{ gap: 1 }}>
                  <IssuesIcon fontSize="small" />
                  GitHub Issues
                </MenuItem>
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/prompts'); }} sx={{ gap: 1 }}>
                  <PromptsIcon fontSize="small" />
                  My Prompts
                </MenuItem>
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
              <Button color="inherit" startIcon={<LoginIcon />} onClick={() => navigate('/signin')}>
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
