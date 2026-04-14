import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LogOut, LogIn, UserPlus, UserCog, Users, MessageCircle,
  Bell, BellOff, CheckCheck, Circle, ChevronDown,
  SlidersHorizontal, List, FileEdit, Bug, Contact,
} from 'lucide-react';
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

  const [userMenuOpen, setUserMenuOpen]     = useState(false);
  const [prMenuOpen, setPrMenuOpen]         = useState(false);

  // Notifications (bell dropdown — unread only)
  const [notifOpen, setNotifOpen]           = useState(false);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [unreadNotifs, setUnreadNotifs]     = useState([]);
  const [notifLoading, setNotifLoading]     = useState(false);
  const sseRef = useRef(null);

  // Refs for click-outside handling
  const userMenuRef  = useRef(null);
  const prMenuRef    = useRef(null);
  const notifRef     = useRef(null);

  // ── Click-outside to close dropdowns ─────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target))  setUserMenuOpen(false);
      if (prMenuRef.current   && !prMenuRef.current.contains(e.target))    setPrMenuOpen(false);
      if (notifRef.current    && !notifRef.current.contains(e.target))     setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // ── Notification bell dropdown ────────────────────────────────────────────
  const openNotifPanel = useCallback(async () => {
    setNotifOpen((prev) => {
      if (prev) return false; // toggle off
      return true;
    });
    setNotifLoading(true);
    try {
      const d = await listNotifications({ unreadOnly: true, limit: 20 });
      setUnreadNotifs(d.data || []);
      setUnreadCount(d.unreadCount || 0);
    } catch { /* ignore */ }
    finally { setNotifLoading(false); }
  }, []);

  const handleClickNotif = useCallback(async (notif) => {
    setNotifOpen(false);
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

  const handleSignout = async () => {
    setUserMenuOpen(false);
    await signout();
    navigate('/signin');
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const onPRWriter = PR_WRITER_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );

  const prNavItem = (path, icon, label) => {
    const active = location.pathname === path || location.pathname.startsWith(path + '/');
    return (
      <li key={path}>
        <button
          onClick={() => { setPrMenuOpen(false); navigate(path); }}
          className={`flex items-center gap-2 w-full text-left${active ? ' font-semibold bg-base-200' : ''}`}
        >
          {icon}
          {label}
        </button>
      </li>
    );
  };

  return (
    <div className="navbar bg-primary text-primary-content shadow-md sticky top-0 z-50">
      {/* ── Brand ── */}
      <div className="navbar-start">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/blogs')}
        >
          <img
            src={logoSrc}
            alt="Talent Code Hub"
            className="h-8 w-8 rounded-md"
          />
          <span className="font-bold text-lg hidden sm:inline">Talent Code Hub</span>
        </div>
      </div>

      {/* ── Right side actions ── */}
      <div className="navbar-end gap-1">
        {loading ? (
          <span className="loading loading-spinner loading-sm opacity-80" />
        ) : user ? (
          <>
            {/* ── PR Writer dropdown ── */}
            <div className="dropdown dropdown-end" ref={prMenuRef}>
              <div
                tabIndex={0}
                role="button"
                onClick={() => setPrMenuOpen((v) => !v)}
                className={`btn btn-ghost btn-sm gap-1 text-primary-content${onPRWriter ? ' font-bold opacity-100' : ' font-medium opacity-85'}`}
              >
                PR Writer
                <ChevronDown size={16} />
              </div>
              {prMenuOpen && (
                <ul
                  tabIndex={0}
                  className="menu dropdown-content bg-base-100 text-base-content rounded-box shadow z-50 mt-1 w-52"
                >
                  {prNavItem('/blogs',          <List size={16} />,            'Issues')}
                  {prNavItem('/prompts',        <FileEdit size={16} />,        'My Prompts')}
                  {prNavItem('/github-issues',  <Bug size={16} />,             'GitHub Issues')}
                  {prNavItem('/issue-profiles', <Contact size={16} />,         'Issue Profiles')}
                  <li><hr className="my-1" /></li>
                  {prNavItem('/pr-settings',    <SlidersHorizontal size={16} />, 'PR Settings')}
                </ul>
              )}
            </div>

            {/* ── Notification bell dropdown ── */}
            <div className="dropdown dropdown-end" ref={notifRef}>
              <div className="tooltip tooltip-bottom" data-tip="Notifications">
                <button
                  className="btn btn-ghost btn-sm btn-circle text-primary-content opacity-85 relative"
                  onClick={openNotifPanel}
                >
                  {unreadCount > 0 ? <Bell size={20} /> : <BellOff size={20} />}
                  {unreadCount > 0 && (
                    <span className="badge badge-error badge-sm absolute -top-1 -right-1 px-1 min-w-[18px]">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {notifOpen && (
                <div className="dropdown-content bg-base-100 text-base-content rounded-box shadow z-50 mt-1 w-80 sm:w-96 flex flex-col">
                  {/* Header */}
                  <div className="flex items-center px-4 py-3 border-b border-base-200 shrink-0">
                    <span className="font-bold text-sm flex-1">
                      Notifications{unreadCount > 0 && ` (${unreadCount} unread)`}
                    </span>
                    {unreadCount > 0 && (
                      <div className="tooltip tooltip-bottom" data-tip="Mark all as read">
                        <button
                          className="btn btn-ghost btn-xs btn-circle"
                          onClick={handleMarkAllRead}
                        >
                          <CheckCheck size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  {notifLoading ? (
                    <div className="flex justify-center items-center p-6">
                      <span className="loading loading-spinner loading-sm" />
                    </div>
                  ) : unreadNotifs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 gap-2 text-base-content/50">
                      <BellOff size={36} />
                      <span className="text-sm">No unread notifications</span>
                    </div>
                  ) : (
                    <ul className="overflow-y-auto max-h-80 divide-y divide-base-200">
                      {unreadNotifs.map((n) => (
                        <li key={n.id || n._id}>
                          <button
                            className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors flex items-start gap-2"
                            onClick={() => handleClickNotif(n)}
                          >
                            <span className="mt-1.5 shrink-0">
                              <Circle size={8} className="fill-primary text-primary" />
                            </span>
                            <span className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-bold text-sm truncate">{n.title}</span>
                              <span className="text-xs text-base-content/70 line-clamp-2">{n.message}</span>
                              <span className="text-xs text-base-content/40">
                                {new Date(n.createdAt).toLocaleString()}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* ── User avatar menu ── */}
            <div className="dropdown dropdown-end" ref={userMenuRef}>
              <div className="tooltip tooltip-bottom" data-tip={`${user.displayName} · ${user.email}`}>
                <button
                  className="btn btn-ghost btn-circle btn-sm p-0"
                  onClick={() => setUserMenuOpen((v) => !v)}
                >
                  <div className="avatar">
                    <div className="w-9 rounded-full">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={initials} />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center font-bold text-sm text-secondary-content select-none">
                          {initials}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </div>

              {userMenuOpen && (
                <ul className="menu dropdown-content bg-base-100 text-base-content rounded-box shadow z-50 mt-1 w-56 p-0">
                  {/* User info header */}
                  <li className="px-4 py-3 pointer-events-none select-none">
                    <span className="flex flex-col gap-0.5 hover:bg-transparent focus:bg-transparent active:bg-transparent p-0">
                      <span className="font-bold text-sm truncate">{user.displayName}</span>
                      <span className="text-xs text-base-content/60 truncate">
                        @{user.username} · {user.email}
                      </span>
                    </span>
                  </li>
                  <li><hr className="my-0" /></li>
                  <li>
                    <button
                      className="flex items-center gap-2"
                      onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                    >
                      <UserCog size={16} />
                      My Account
                    </button>
                  </li>
                  <li>
                    <button
                      className="flex items-center gap-2"
                      onClick={() => { setUserMenuOpen(false); navigate('/friends'); }}
                    >
                      <Users size={16} />
                      Friends
                    </button>
                  </li>
                  <li>
                    <button
                      className="flex items-center gap-2"
                      onClick={() => { setUserMenuOpen(false); navigate('/messenger'); }}
                    >
                      <MessageCircle size={16} />
                      Messenger
                    </button>
                  </li>
                  <li><hr className="my-0" /></li>
                  <li>
                    <button
                      className="flex items-center gap-2 text-error"
                      onClick={handleSignout}
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </>
        ) : (
          <>
            <button
              className="btn btn-ghost btn-sm gap-1.5 text-primary-content"
              onClick={() => navigate('/signin')}
            >
              <LogIn size={16} />
              Sign in
            </button>
            <button
              className="btn btn-outline btn-sm gap-1.5 text-primary-content border-primary-content/70 hover:bg-primary-content/10 hover:border-primary-content"
              onClick={() => navigate('/signup')}
            >
              <UserPlus size={16} />
              Sign up
            </button>
          </>
        )}
      </div>
    </div>
  );
}
