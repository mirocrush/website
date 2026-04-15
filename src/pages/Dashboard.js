import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Users, MessageCircle, Briefcase,
  GitBranch, UserCog, ArrowRight, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const QUICK_LINKS = [
  {
    icon: <BookOpen size={22} />,
    title: 'Blogs',
    description: 'Browse and write technical articles.',
    href: '/blogs',
    accent: 'bg-primary/10 text-primary',
    btn: 'btn-primary',
  },
  {
    icon: <GitBranch size={22} />,
    title: 'PR Writer',
    description: 'Manage GitHub issues and generate pull request descriptions.',
    href: '/github-issues',
    accent: 'bg-secondary/10 text-secondary',
    btn: 'btn-secondary',
  },
  {
    icon: <Briefcase size={22} />,
    title: 'Portfolios',
    description: 'Create and share your developer portfolio.',
    href: '/portfolios',
    accent: 'bg-accent/10 text-accent',
    btn: 'btn-accent',
  },
  {
    icon: <MessageCircle size={22} />,
    title: 'Messenger',
    description: 'Chat in servers and direct messages.',
    href: '/messenger',
    accent: 'bg-info/10 text-info',
    btn: 'btn-info',
  },
  {
    icon: <Users size={22} />,
    title: 'Friends',
    description: 'Connect with other developers.',
    href: '/friends',
    accent: 'bg-success/10 text-success',
    btn: 'btn-success',
  },
  {
    icon: <UserCog size={22} />,
    title: 'My Account',
    description: 'Update your profile and settings.',
    href: '/profile',
    accent: 'bg-warning/10 text-warning',
    btn: 'btn-warning',
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="min-h-screen bg-base-200">

      {/* Hero banner */}
      <div className="bg-gradient-to-br from-primary via-primary/90 to-secondary text-primary-content">
        <div className="container mx-auto max-w-screen-lg px-4 py-12">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="shrink-0">
              {user?.avatarUrl ? (
                <div className="avatar">
                  <div className="w-16 h-16 rounded-2xl ring-3 ring-primary-content/30 shadow-xl overflow-hidden">
                    <img src={user.avatarUrl} alt={initials} />
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-primary-content/20 ring-3 ring-primary-content/30 shadow-xl flex items-center justify-center text-2xl font-extrabold select-none">
                  {initials}
                </div>
              )}
            </div>

            {/* Greeting */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="opacity-70" />
                <span className="text-sm font-medium opacity-70 uppercase tracking-wider">Welcome back</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Hey, {firstName}!</h1>
              {user?.username && (
                <p className="text-sm opacity-60 mt-0.5">@{user.username}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-screen-lg px-4 py-10">

        {/* Section heading */}
        <h2 className="text-lg font-bold text-base-content/70 mb-5 uppercase tracking-wider text-sm">
          Quick Access
        </h2>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_LINKS.map(({ icon, title, description, href, accent, btn }) => (
            <div
              key={href}
              className="card bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(href)}
            >
              <div className="card-body p-5 gap-3">
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-xl ${accent}`}>
                    {icon}
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-base-content/20 group-hover:text-base-content/50 group-hover:translate-x-0.5 transition-all mt-1"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-base-content">{title}</h3>
                  <p className="text-sm text-base-content/50 mt-0.5 leading-relaxed">{description}</p>
                </div>
                <button
                  className={`btn btn-sm ${btn} btn-outline mt-1 self-start`}
                  onClick={(e) => { e.stopPropagation(); navigate(href); }}
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
