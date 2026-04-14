import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box,
  Avatar, Menu, MenuItem, Divider, IconButton, Tooltip,
  CircularProgress, Badge, List, ListItemButton, ListItemText,
  Popover, ListItemIcon,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Login as LoginIcon,
  PersonAdd as SignupIcon,
  ManageAccounts as ProfileIcon,
  People as FriendsIcon,
  Chat as ChatIcon,
  BugReport as IssuesIcon,
  EditNote as PromptsIcon,
  AccountBox as IssueProfilesIcon,
  FormatListBulleted as IssueListIcon,
  Notifications as NotifIcon,
  NotificationsNone as NotifEmptyIcon,
  DoneAll as DoneAllIcon,
  Circle as DotIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Tune as PRSettingsIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import logoSrc from '../assets/talent-icon.png';
import { useAuth } from '../context/AuthContext';
import { listNotifications, markAllRead, markRead } from '../api/notificationsApi';

const SLUG_RE = /^\/[0-9a-f]{8}([0-9a-f]{24})?$/i;

const PR_WRITER_PATHS = ['/blogs', '/prompts', '/github-issues', '/issue-profiles', '/pr-settings'];

function notifDestination(notif) {
  if (notif.issueId) {
    return { path: '/github-issues', state: { openIssueId: notif.issueId } };
  }
  return { path: '/github-issues', state: {} };
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signout } = useAuth();

  const [anchorEl, setAnchorEl]           = useState(null);
  const [prMenuAnchor, setPrMenuAnchor]   = useState(null);

  // Notifications (bell popover — unread only)
  const [notifAnchor, setNotifAnchor]     = useState(null);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [unreadNotifs, setUnreadNotifs]   = useState([]);
  const [notifLoading, setNotifLoading]   = useState(false);
  const sseRef = useRef(null);

  // ── SSE real-time connection ──────────────────────────────────────────────
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

    es.onerror = () => { es.close(); };
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

  // ── Notification bell popover ─────────────────────────────────────────────
  const openNotifPanel = useCallback(async (e) => {
    setNotifAnchor(e.currentTarget);
    setNotifLoading(true);
    try {
      const d = await listNotifications({ unreadOnly: true, limit: 20 });
      setUnreadNotifs(d.data || []);
      setUnreadCount(d.unreadCount || 0);
    } catch { /* ignore */ }
    finally { setNotifLoading(false); }
  }, []);

  const handleClickNotif = useCallback(async (notif) => {
    setNotifAnchor(null);
    setUnreadNotifs((prev) => prev.filter((n) => n.id !== notif.id));
    setUnreadCount((c) => Math.max(0, c - 1));
    if (!notif.read) markRead([notif.id]).catch(() => {});
    const { path, state } = notifDestination(notif);
    navigate(path, { state });
  }, [navigate]);

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead().catch(() => {});
    setUnreadNotifs([]);
    setUnreadCount(0);
  }, []);

  if (SLUG_RE.test(location.pathname)) return null;

  const menuOpen   = Boolean(anchorEl);
  const prMenuOpen = Boolean(prMenuAnchor);

  const handleSignout = async () => {
    setAnchorEl(null);
    await signout();
    navigate('/signin');
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const onPRWriter = PR_WRITER_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );

  const prNavItem = (path, icon, label) => (
    <MenuItem
      onClick={() => { setPrMenuAnchor(null); navigate(path); }}
      selected={location.pathname === path || location.pathname.startsWith(path + '/')}
      sx={{ gap: 1.5 }}
    >
      {icon}
      {label}
    </MenuItem>
  );

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
          {loading ? (
            <CircularProgress size={22} sx={{ color: 'rgba(255,255,255,0.8)' }} />
          ) : user ? (
            <>
              {/* ── PR Writer dropdown ── */}
              <Button
                color="inherit"
                endIcon={<ArrowDownIcon />}
                onClick={(e) => setPrMenuAnchor(e.currentTarget)}
                sx={{
                  fontWeight: onPRWriter ? 700 : 500,
                  opacity: onPRWriter ? 1 : 0.85,
                  textTransform: 'none',
                  fontSize: 15,
                }}
              >
                PR Writer
              </Button>

              <Menu
                anchorEl={prMenuAnchor}
                open={prMenuOpen}
                onClose={() => setPrMenuAnchor(null)}
                anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
                transformOrigin={{ horizontal: 'left', vertical: 'top' }}
                PaperProps={{ sx: { minWidth: 210, mt: 0.5 } }}
              >
                {prNavItem('/blogs',          <IssueListIcon    fontSize="small" />, 'Issues')}
                {prNavItem('/prompts',        <PromptsIcon      fontSize="small" />, 'My Prompts')}
                {prNavItem('/github-issues',  <IssuesIcon       fontSize="small" />, 'GitHub Issues')}
                {prNavItem('/issue-profiles', <IssueProfilesIcon fontSize="small" />, 'Issue Profiles')}
                <Divider />
                {prNavItem('/pr-settings',    <PRSettingsIcon   fontSize="small" />, 'PR Settings')}
              </Menu>

              {/* ── Notification bell ── */}
              <Tooltip title="Notifications" arrow>
                <IconButton
                  color="inherit"
                  onClick={openNotifPanel}
                  sx={{ opacity: 0.85 }}
                >
                  <Badge badgeContent={unreadCount || 0} color="error" invisible={!unreadCount} max={99}>
                    {unreadCount ? <NotifIcon /> : <NotifEmptyIcon />}
                  </Badge>
                </IconButton>
              </Tooltip>

              {/* ── Notification popover (unread only) ── */}
              <Popover
                open={Boolean(notifAnchor)}
                anchorEl={notifAnchor}
                onClose={() => setNotifAnchor(null)}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                PaperProps={{ sx: { width: 370, maxHeight: 500, display: 'flex', flexDirection: 'column' } }}
              >
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
                      <ListItemButton
                        key={n.id || n._id}
                        onClick={() => handleClickNotif(n)}
                        sx={{
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          alignItems: 'flex-start',
                          py: 1.25,
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
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Popover>

              {/* ── User avatar menu ── */}
              <Tooltip title={`${user.displayName} · ${user.email}`} arrow>
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
                  <Avatar
                    src={user.avatarUrl || undefined}
                    sx={{ width: 34, height: 34, bgcolor: 'secondary.main', fontSize: 14, fontWeight: 700 }}
                  >
                    {!user.avatarUrl && initials}
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
                  <Typography variant="subtitle2" fontWeight={700} noWrap>{user.displayName}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    @{user.username} · {user.email}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }} sx={{ gap: 1 }}>
                  <ProfileIcon fontSize="small" />
                  My Account
                </MenuItem>
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/friends'); }} sx={{ gap: 1 }}>
                  <FriendsIcon fontSize="small" />
                  Friends
                </MenuItem>
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/messenger'); }} sx={{ gap: 1 }}>
                  <ChatIcon fontSize="small" />
                  Messenger
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
