import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box,
  Avatar, Menu, MenuItem, Divider, IconButton, Tooltip,
  CircularProgress, Badge, List, ListItem, ListItemText,
  Popover, ListItemIcon,
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
  Notifications as NotifIcon,
  NotificationsNone as NotifEmptyIcon,
  DoneAll as DoneAllIcon,
  Circle as DotIcon,
  OpenInNew as ViewAllIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import logoSrc from '../assets/talent-icon.png';
import { useAuth } from '../context/AuthContext';
import { listRequests } from '../api/friendsApi';
import { listNotifications, markAllRead, markRead } from '../api/notificationsApi';

const SLUG_RE = /^\/[0-9a-f]{8}([0-9a-f]{24})?$/i;

// Map notification type → destination path + state
function notifDestination(notif) {
  // All current types relate to GitHub issues
  if (notif.issueId) {
    return { path: '/github-issues', state: { openIssueId: notif.issueId } };
  }
  return { path: '/github-issues', state: {} };
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signout } = useAuth();

  const [anchorEl, setAnchorEl]         = useState(null);
  const [pendingCount, setPendingCount]  = useState(0);

  // Notifications (bell popover — unread only)
  const [notifAnchor, setNotifAnchor]     = useState(null);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [unreadNotifs, setUnreadNotifs]   = useState([]);  // only unread items shown in bell
  const [notifLoading, setNotifLoading]   = useState(false);
  const sseRef = useRef(null);

  useEffect(() => {
    if (!user) { setPendingCount(0); return; }
    listRequests('received')
      .then((res) => setPendingCount(res.data.length))
      .catch(() => {});
  }, [user]);

  // ── SSE real-time connection ────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    if (!user) return;
    if (sseRef.current) sseRef.current.close();

    const es = new EventSource('/api/notifications/events', { withCredentials: true });

    es.addEventListener('count', (e) => {
      try {
        const { count } = JSON.parse(e.data);
        setUnreadCount(count || 0);
      } catch { /* ignore */ }
    });

    es.addEventListener('notification', (e) => {
      try {
        const notif = JSON.parse(e.data);
        setUnreadCount((c) => c + 1);
        setUnreadNotifs((prev) => [notif, ...prev].slice(0, 50));
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      // EventSource reconnects automatically; just close so it gets a fresh connection
      es.close();
    };

    sseRef.current = es;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setUnreadNotifs([]);
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      return;
    }
    connectSSE();
    return () => { if (sseRef.current) { sseRef.current.close(); sseRef.current = null; } };
  }, [user, connectSSE]);

  // ── Open notification bell popover ────────────────────────────────────
  const openNotifPanel = useCallback(async (e) => {
    setNotifAnchor(e.currentTarget);
    setNotifLoading(true);
    try {
      // Always fetch fresh unread list when opening
      const d = await listNotifications({ unreadOnly: true, limit: 20 });
      setUnreadNotifs(d.data || []);
      setUnreadCount(d.unreadCount || 0);
    } catch { /* ignore */ }
    finally { setNotifLoading(false); }
  }, []);

  // Mark a single notification read, remove from bell, navigate
  const handleClickNotif = useCallback(async (notif) => {
    setNotifAnchor(null);
    // Optimistically remove from bell
    setUnreadNotifs((prev) => prev.filter((n) => n.id !== notif.id));
    setUnreadCount((c) => Math.max(0, c - 1));
    // Mark as read on server (fire-and-forget)
    if (!notif.read) markRead([notif.id]).catch(() => {});
    // Navigate to responsible page
    const { path, state } = notifDestination(notif);
    navigate(path, { state });
  }, [navigate]);

  // Mark all read, clear bell list
  const handleMarkAllRead = useCallback(async () => {
    await markAllRead().catch(() => {});
    setUnreadNotifs([]);
    setUnreadCount(0);
  }, []);

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

              {/* ── Notification bell ── */}
              <Tooltip title="Notifications" arrow>
                <IconButton
                  color="inherit"
                  onClick={openNotifPanel}
                  sx={{ opacity: location.pathname === '/notifications' ? 1 : 0.85 }}
                >
                  <Badge badgeContent={unreadCount || 0} color="error" invisible={!unreadCount} max={99}>
                    {unreadCount ? <NotifIcon /> : <NotifEmptyIcon />}
                  </Badge>
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

              {/* ── Notification bell popover (unread only) ── */}
              <Popover
                open={Boolean(notifAnchor)}
                anchorEl={notifAnchor}
                onClose={() => setNotifAnchor(null)}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                PaperProps={{ sx: { width: 370, maxHeight: 500, display: 'flex', flexDirection: 'column' } }}
              >
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
                    Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
                  </Typography>
                  {unreadCount > 0 && (
                    <Tooltip title="Mark all as read">
                      <IconButton size="small" onClick={handleMarkAllRead}><DoneAllIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                </Box>

                {/* Body */}
                {notifLoading ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
                ) : unreadNotifs.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <NotifEmptyIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">No unread notifications</Typography>
                  </Box>
                ) : (
                  <List dense disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
                    {unreadNotifs.map((n) => (
                      <ListItem
                        key={n.id || n._id}
                        button
                        onClick={() => handleClickNotif(n)}
                        sx={{
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          alignItems: 'flex-start',
                          py: 1.25,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.selected' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 18, mt: 0.75 }}>
                          <DotIcon sx={{ fontSize: 8, color: 'primary.main' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={700} noWrap>{n.title}</Typography>
                          }
                          secondary={
                            <>
                              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.25 }}>
                                {n.message}
                              </Typography>
                              <Typography variant="caption" color="text.disabled">
                                {new Date(n.createdAt).toLocaleString()}
                              </Typography>
                            </>
                          }
                          sx={{ m: 0 }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}

                {/* Footer — link to full notifications page */}
                <Box
                  sx={{
                    px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider',
                    display: 'flex', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <Button
                    size="small"
                    endIcon={<ViewAllIcon fontSize="small" />}
                    onClick={() => { setNotifAnchor(null); navigate('/notifications'); }}
                  >
                    View all notifications
                  </Button>
                </Box>
              </Popover>

              {/* ── User menu ── */}
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
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/notifications'); }} sx={{ gap: 1 }}>
                  <Badge badgeContent={unreadCount || 0} color="error" invisible={!unreadCount}>
                    <NotifIcon fontSize="small" />
                  </Badge>
                  Notifications
                  {!!unreadCount && (
                    <Typography variant="caption" color="error.main" sx={{ ml: 'auto', fontWeight: 700 }}>
                      {unreadCount} new
                    </Typography>
                  )}
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
