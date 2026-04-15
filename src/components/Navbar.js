import { useState, useEffect, useRef } from 'react';
import {
  LogOut, LogIn, UserPlus, UserCog, Users, MessageCircle,
  ChevronDown, LayoutDashboard, Briefcase, BookOpen,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoSrc from '../assets/talent-icon.png';
import { useAuth } from '../context/AuthContext';

const SLUG_RE = /^\/[0-9a-f]{8}([0-9a-f]{24})?$/i;

const NAV_LINKS = [
  { path: '/dashboard',  label: 'Dashboard',  icon: <LayoutDashboard size={15} /> },
  { path: '/blogs',      label: 'Blogs',       icon: <BookOpen size={15} /> },
  { path: '/portfolios', label: 'Portfolios',  icon: <Briefcase size={15} /> },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signout } = useAuth();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="navbar bg-primary text-primary-content shadow-md sticky top-0 z-50 px-4">

      {/* ── Brand ── */}
      <div className="navbar-start gap-6">
        <div
          className="flex items-center gap-2 cursor-pointer select-none shrink-0"
          onClick={() => navigate(user ? '/dashboard' : '/signin')}
        >
          <img src={logoSrc} alt="Talent Code Hub" className="h-8 w-8 rounded-md" />
          <span className="font-bold text-lg hidden md:inline">Talent Code Hub</span>
        </div>

        {/* ── Nav links (authenticated only) ── */}
        {user && (
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(({ path, label, icon }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive(path)
                    ? 'bg-primary-content/15 text-primary-content'
                    : 'text-primary-content/70 hover:text-primary-content hover:bg-primary-content/10'
                  }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* ── Right actions ── */}
      <div className="navbar-end gap-1">
        {loading ? (
          <span className="loading loading-spinner loading-sm opacity-80" />
        ) : user ? (
          /* ── Authenticated: avatar dropdown ── */
          <div className="dropdown dropdown-end" ref={userMenuRef}>
            <button
              className="btn btn-ghost btn-sm gap-2 px-2 rounded-xl text-primary-content"
              onClick={() => setUserMenuOpen((v) => !v)}
            >
              {user.avatarUrl ? (
                <div className="avatar">
                  <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-primary-content/30">
                    <img src={user.avatarUrl} alt={initials} />
                  </div>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-content ring-2 ring-primary-content/30 select-none shrink-0">
                  {initials}
                </div>
              )}
              <span className="hidden sm:block text-sm font-semibold max-w-[120px] truncate">
                {user.displayName}
              </span>
              <ChevronDown
                size={14}
                className={`opacity-70 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {userMenuOpen && (
              <div className="dropdown-content bg-base-100 text-base-content rounded-2xl shadow-xl z-50 mt-2 w-60 border border-base-200 overflow-hidden">

                {/* Profile header */}
                <div className="bg-gradient-to-br from-primary/10 to-secondary/10 px-4 py-4 flex items-center gap-3 border-b border-base-200">
                  {user.avatarUrl ? (
                    <div className="avatar shrink-0">
                      <div className="w-11 h-11 rounded-xl overflow-hidden ring-2 ring-base-300">
                        <img src={user.avatarUrl} alt={initials} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-base font-extrabold text-primary-content ring-2 ring-base-300 shrink-0 select-none">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate text-base-content">{user.displayName}</p>
                    <p className="text-xs text-base-content/50 truncate">@{user.username}</p>
                    <p className="text-xs text-base-content/40 truncate">{user.email}</p>
                  </div>
                </div>

                {/* Menu items */}
                <ul className="py-1.5">
                  <li>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 transition-colors text-left"
                      onClick={() => go('/profile')}
                    >
                      <span className="p-1.5 bg-primary/10 rounded-lg text-primary">
                        <UserCog size={14} />
                      </span>
                      My Account
                    </button>
                  </li>
                  <li>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 transition-colors text-left"
                      onClick={() => go('/messenger')}
                    >
                      <span className="p-1.5 bg-success/10 rounded-lg text-success">
                        <MessageCircle size={14} />
                      </span>
                      Messenger
                    </button>
                  </li>
                  <li>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 transition-colors text-left"
                      onClick={() => go('/friends')}
                    >
                      <span className="p-1.5 bg-warning/10 rounded-lg text-warning">
                        <Users size={14} />
                      </span>
                      Friends
                    </button>
                  </li>

                  <li className="my-1 border-t border-base-200" />

                  <li className="px-3 pb-2">
                    <button
                      className="w-full btn btn-error btn-sm btn-outline gap-2"
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
          /* ── Guest ── */
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
