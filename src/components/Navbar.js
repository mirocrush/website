import { useState, useEffect, useRef } from 'react';
import {
  LogOut, LogIn, UserPlus, UserCog, Users, MessageCircle,
  ChevronDown, LayoutDashboard, Briefcase, BookOpen, Rocket,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoSrc from '../assets/claude.png';
import { useAuth } from '../context/AuthContext';

const SLUG_RE = /^\/[0-9a-f]{8}([0-9a-f]{24})?$/i;

const NAV_LINKS = [
  { path: '/',           label: 'Dashboard',  icon: <LayoutDashboard size={15} />, exact: true },
  { path: '/blogs',      label: 'Blogs',      icon: <BookOpen size={15} /> },
  { path: '/portfolios', label: 'Portfolios', icon: <Briefcase size={15} /> },
  { path: '/revelo',     label: 'Revelo',     icon: <Rocket size={15} /> },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signout } = useAuth();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setUserMenuOpen(false); }, [location.pathname]);

  if (SLUG_RE.test(location.pathname)) return null;

  const handleSignout = async () => {
    setUserMenuOpen(false);
    await signout();
    navigate('/signin');
  };

  const go = (path) => { setUserMenuOpen(false); navigate(path); };

  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const isActive = ({ path, exact }) =>
    exact ? location.pathname === path : (location.pathname === path || location.pathname.startsWith(path + '/'));

  return (
    <div
      className="navbar-glass navbar sticky top-0 z-50 px-4 text-primary-content"
    >
      {/* ── Brand ── */}
      <div className="navbar-start">
        <div
          className="flex items-center gap-2 cursor-pointer select-none shrink-0"
          onClick={() => navigate(user ? '/' : '/signin')}
        >
          <img src={logoSrc} alt="Talent Code Hub" className="h-8 w-8 rounded-md object-contain" />
          <span className="font-bold text-lg hidden md:inline" style={{ color: '#bbf7d0' }}>
            Talent Code Hub
          </span>
        </div>
      </div>

      {/* ── Centered nav links ── */}
      <div className="navbar-center">
        {user && (
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                style={isActive(link) ? {
                  background: 'rgba(74,222,128,0.18)',
                  color: '#bbf7d0',
                  boxShadow: '0 0 12px rgba(74,222,128,0.15)',
                } : {
                  color: 'rgba(187,247,208,0.65)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive(link)) e.currentTarget.style.color = '#bbf7d0';
                  if (!isActive(link)) e.currentTarget.style.background = 'rgba(74,222,128,0.10)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive(link)) e.currentTarget.style.color = 'rgba(187,247,208,0.65)';
                  if (!isActive(link)) e.currentTarget.style.background = 'transparent';
                }}
              >
                {link.icon}
                {link.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* ── Right actions ── */}
      <div className="navbar-end gap-1">
        {loading ? (
          <span className="loading loading-spinner loading-sm" style={{ color: '#4ade80' }} />
        ) : user ? (
          <div className="dropdown dropdown-end" ref={userMenuRef}>
            <button
              className="btn btn-ghost btn-sm gap-2 px-2 rounded-xl cursor-pointer"
              style={{ color: '#bbf7d0' }}
              onClick={() => setUserMenuOpen((v) => !v)}
            >
              {user.avatarUrl ? (
                <div className="avatar">
                  <div className="w-8 h-8 rounded-full overflow-hidden" style={{ boxShadow: '0 0 0 2px rgba(74,222,128,0.4)' }}>
                    <img src={user.avatarUrl} alt={initials} />
                  </div>
                </div>
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold select-none shrink-0"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#4ade80)', color: '#fff', boxShadow: '0 0 0 2px rgba(74,222,128,0.4)' }}
                >
                  {initials}
                </div>
              )}
              <span className="hidden sm:block text-sm font-semibold max-w-[120px] truncate">
                {user.displayName}
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
                style={{ color: 'rgba(187,247,208,0.6)' }}
              />
            </button>

            {userMenuOpen && (
              <div className="dropdown-content glass-card rounded-2xl z-50 mt-2 w-60 overflow-hidden" style={{ border: '1px solid rgba(74,222,128,0.2)' }}>
                {/* Profile header */}
                <div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(74,222,128,0.12)', background: 'rgba(74,222,128,0.05)' }}>
                  {user.avatarUrl ? (
                    <div className="avatar shrink-0">
                      <div className="w-11 h-11 rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 2px rgba(74,222,128,0.3)' }}>
                        <img src={user.avatarUrl} alt={initials} />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-extrabold text-white shrink-0 select-none"
                      style={{ background: 'linear-gradient(135deg,#16a34a,#4ade80)', boxShadow: '0 0 0 2px rgba(74,222,128,0.3)' }}
                    >
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: '#bbf7d0' }}>{user.displayName}</p>
                    <p className="text-xs truncate" style={{ color: 'rgba(134,239,172,0.55)' }}>@{user.username}</p>
                    <p className="text-xs truncate" style={{ color: 'rgba(134,239,172,0.38)' }}>{user.email}</p>
                  </div>
                </div>

                {/* Menu items */}
                <ul className="py-1.5">
                  {[
                    { path: '/profile',   icon: <UserCog size={14} />,       label: 'My Account', glow: 'rgba(74,222,128,0.15)',   color: '#4ade80' },
                    { path: '/messenger', icon: <MessageCircle size={14} />, label: 'Messenger',  glow: 'rgba(74,222,128,0.15)',   color: '#4ade80' },
                    { path: '/friends',   icon: <Users size={14} />,         label: 'Friends',    glow: 'rgba(74,222,128,0.15)',   color: '#4ade80' },
                  ].map(({ path, icon, label, glow, color }) => (
                    <li key={path}>
                      <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left cursor-pointer transition-all duration-150"
                        style={{ color: 'rgba(187,247,208,0.8)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,0.08)'; e.currentTarget.style.color = '#bbf7d0'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(187,247,208,0.8)'; }}
                        onClick={() => go(path)}
                      >
                        <span className="p-1.5 rounded-lg flex items-center" style={{ background: glow, color }}>{icon}</span>
                        {label}
                      </button>
                    </li>
                  ))}

                  <li style={{ margin: '4px 0', borderTop: '1px solid rgba(74,222,128,0.1)' }} />

                  <li className="px-3 pb-2 pt-1">
                    <button
                      className="w-full btn btn-sm gap-2 cursor-pointer"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.22)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                      onClick={handleSignout}
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              className="btn btn-ghost btn-sm gap-1.5 cursor-pointer"
              style={{ color: '#bbf7d0' }}
              onClick={() => navigate('/signin')}
            >
              <LogIn size={16} />
              Sign in
            </button>
            <button
              className="btn btn-sm gap-1.5 cursor-pointer"
              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#bbf7d0' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,0.15)'; }}
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
