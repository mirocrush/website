import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, CheckSquare, DollarSign, BarChart2, Code2 } from 'lucide-react';

const navItems = [
  { to: '/revelo/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/revelo/jobs',      label: 'Jobs',      icon: Briefcase },
  { to: '/revelo/editor',    label: 'Editor',    icon: Code2 },
  // { to: '/revelo/tasks',          label: 'Tasks',          icon: CheckSquare },
  // { to: '/revelo/income-reports', label: 'Income Reports', icon: DollarSign },
];

export default function ReveloLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen page-bg">
      {/* Sub-navbar */}
      <div
        style={{
          position: 'sticky',
          top: 64,
          zIndex: 40,
          background: 'rgba(3,18,9,0.85)',
          borderBottom: '1px solid rgba(74,222,128,0.12)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="container mx-auto max-w-screen-lg px-4">
          <div className="flex items-center gap-2 py-2">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
              return (
                <NavLink
                  key={to}
                  to={to}
                  style={isActive
                    ? {
                        background: 'rgba(74,222,128,0.2)',
                        border: '1px solid rgba(74,222,128,0.5)',
                        color: '#4ade80',
                      }
                    : {
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'rgba(134,239,172,0.6)',
                      }
                  }
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 hover:border-green-500/30"
                >
                  <Icon size={15} />
                  {label}
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>

      {/* Page content */}
      <Outlet />
    </div>
  );
}
