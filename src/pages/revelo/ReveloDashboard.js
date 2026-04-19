import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, listReveloUsers } from '../../api/reveloApi';
import {
  Users, Briefcase, CheckSquare, Clock, TrendingUp,
  AlertCircle, Activity, Loader, BarChart2,
} from 'lucide-react';

const STATUS_COLORS = {
  pending:   '#facc15',
  active:    '#4ade80',
  completed: '#60a5fa',
  cancelled: '#f87171',
};

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div
      className="glass-card rounded-2xl border p-5 flex items-center gap-4"
      style={{ borderColor: 'rgba(74,222,128,0.2)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
      >
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: '#bbf7d0' }}>{value}</div>
        <div className="text-xs" style={{ color: 'rgba(134,239,172,0.5)' }}>{label}</div>
      </div>
    </div>
  );
}

function StatusMiniCard({ label, count, color }) {
  return (
    <div
      className="glass-card rounded-xl border p-4 text-center"
      style={{ borderColor: `${color}33` }}
    >
      <div className="text-xl font-bold" style={{ color }}>{count}</div>
      <div className="text-xs mt-1 capitalize" style={{ color: 'rgba(134,239,172,0.5)' }}>{label}</div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...Object.values(data), 1);
  const bars = [
    { key: 'pending',   color: STATUS_COLORS.pending },
    { key: 'active',    color: STATUS_COLORS.active },
    { key: 'completed', color: STATUS_COLORS.completed },
    { key: 'cancelled', color: STATUS_COLORS.cancelled },
  ];
  return (
    <div className="flex items-end gap-3 h-32 px-2">
      {bars.map(({ key, color }) => {
        const val = data[key] || 0;
        const pct = max > 0 ? (val / max) * 100 : 0;
        return (
          <div key={key} className="flex flex-col items-center gap-1 flex-1">
            <div className="text-xs font-medium" style={{ color: '#bbf7d0' }}>{val}</div>
            <div className="w-full rounded-t-md transition-all" style={{
              height: `${Math.max(pct, 4)}%`,
              minHeight: '6px',
              background: `${color}99`,
              border: `1px solid ${color}`,
            }} />
            <div className="text-xs capitalize" style={{ color: 'rgba(134,239,172,0.5)' }}>{key}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    pending:   { bg: 'rgba(250,204,21,0.15)',  border: 'rgba(250,204,21,0.4)',  text: '#fde047' },
    active:    { bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.4)',  text: '#4ade80' },
    completed: { bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.4)',  text: '#93c5fd' },
    cancelled: { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)', text: '#fca5a5' },
  };
  const c = colors[status] || colors.pending;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {status}
    </span>
  );
}

function UserCard({ user, onClick }) {
  const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        padding: '18px 14px', borderRadius: 14, cursor: 'pointer', border: 'none',
        background: 'rgba(3,18,9,0.6)', outline: '1px solid rgba(74,222,128,0.15)',
        transition: 'all 0.15s', minWidth: 110,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.08)'; e.currentTarget.style.outline = '1px solid rgba(74,222,128,0.4)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(3,18,9,0.6)';      e.currentTarget.style.outline = '1px solid rgba(74,222,128,0.15)'; }}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.displayName}
          style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover',
            border: '2px solid rgba(74,222,128,0.3)' }} />
      ) : (
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(74,222,128,0.12)', border: '2px solid rgba(74,222,128,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#4ade80', fontSize: 18, fontWeight: 700,
        }}>
          {initials}
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#bbf7d0', fontSize: 13, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
          {user.displayName || user.username}
        </div>
        <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 11, marginTop: 2 }}>
          @{user.username}
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 99, fontSize: 11,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        color: 'rgba(134,239,172,0.6)',
      }}>
        <BarChart2 size={10} /> Task Balance
      </div>
    </button>
  );
}

export default function ReveloDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getDashboardStats(),
      listReveloUsers(),
    ]).then(([d, u]) => {
      if (d.success) setStats(d); else setError(d.message);
      if (u.success) setUsers(u.users);
    })
      .catch(e => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto max-w-screen-lg px-4 py-16 flex justify-center">
        <Loader size={32} className="animate-spin" style={{ color: '#4ade80' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-screen-lg px-4 py-8">
        <div className="glass-card rounded-2xl border p-5 flex items-center gap-3"
          style={{ borderColor: 'rgba(248,113,113,0.3)' }}>
          <AlertCircle size={20} style={{ color: '#f87171' }} />
          <span style={{ color: '#fca5a5' }}>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-8 space-y-6">

      {/* Users */}
      {users.length > 0 && (
        <div className="glass-card rounded-2xl border p-5" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} style={{ color: '#4ade80' }} />
            <span className="text-sm font-semibold" style={{ color: '#bbf7d0' }}>Members</span>
            <span style={{
              marginLeft: 4, padding: '1px 8px', borderRadius: 99, fontSize: 11,
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
              color: 'rgba(134,239,172,0.6)',
            }}>{users.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {users.map(u => (
              <UserCard
                key={u.id}
                user={u}
                onClick={() => navigate(`/revelo/task-balance/${u.username}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Total Accounts" value={stats.totalAccounts} accent="#4ade80" />
        <StatCard icon={Briefcase}   label="Total Jobs"     value={stats.totalJobs}     accent="#60a5fa" />
        <StatCard icon={CheckSquare} label="Total Tasks"    value={stats.totalTasks}    accent="#a78bfa" />
        <StatCard icon={Activity}    label="Active Tasks"   value={stats.tasksByStatus.active} accent="#facc15" />
      </div>

      {/* Status breakdown + chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl border p-5" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
          <div className="text-sm font-semibold mb-4" style={{ color: '#bbf7d0' }}>
            Task Status Breakdown
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatusMiniCard label="Pending"   count={stats.tasksByStatus.pending}   color={STATUS_COLORS.pending} />
            <StatusMiniCard label="Active"    count={stats.tasksByStatus.active}    color={STATUS_COLORS.active} />
            <StatusMiniCard label="Completed" count={stats.tasksByStatus.completed} color={STATUS_COLORS.completed} />
            <StatusMiniCard label="Cancelled" count={stats.tasksByStatus.cancelled} color={STATUS_COLORS.cancelled} />
          </div>
        </div>

        <div className="glass-card rounded-2xl border p-5" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
          <div className="text-sm font-semibold mb-4" style={{ color: '#bbf7d0' }}>
            Status Distribution
          </div>
          <BarChart data={stats.tasksByStatus} />
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="glass-card rounded-2xl border p-5" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} style={{ color: '#4ade80' }} />
          <span className="text-sm font-semibold" style={{ color: '#bbf7d0' }}>Recent Tasks</span>
        </div>
        {stats.recentTasks.length === 0 ? (
          <div className="text-sm text-center py-6" style={{ color: 'rgba(134,239,172,0.5)' }}>
            No tasks yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(74,222,128,0.1)' }}>
                  {['Account', 'Job', 'Start Date', 'Status'].map(h => (
                    <th key={h} className="text-left py-2 px-3 font-medium"
                      style={{ color: 'rgba(134,239,172,0.5)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentTasks.map((t, i) => (
                  <tr key={t.id || i} style={{ borderBottom: '1px solid rgba(74,222,128,0.05)' }}>
                    <td className="py-2 px-3" style={{ color: '#bbf7d0' }}>
                      {t.accountId?.name || '—'}
                    </td>
                    <td className="py-2 px-3" style={{ color: '#bbf7d0' }}>
                      {t.jobId?.jobName || '—'}
                    </td>
                    <td className="py-2 px-3" style={{ color: 'rgba(134,239,172,0.6)' }}>
                      {t.startDate ? new Date(t.startDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2 px-3">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Jobs */}
      <div className="glass-card rounded-2xl border p-5" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} style={{ color: '#4ade80' }} />
          <span className="text-sm font-semibold" style={{ color: '#bbf7d0' }}>Top Jobs by Usage</span>
        </div>
        {stats.topJobs.length === 0 ? (
          <div className="text-sm text-center py-6" style={{ color: 'rgba(134,239,172,0.5)' }}>
            No job data yet.
          </div>
        ) : (
          <div className="space-y-3">
            {stats.topJobs.map(({ job, count }, i) => (
              <div
                key={job?.id || i}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.1)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(74,222,128,0.2)', color: '#4ade80' }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#bbf7d0' }}>
                      {job?.jobName || 'Unknown Job'}
                    </div>
                    {job?.hourlyRate && (
                      <div className="text-xs" style={{ color: 'rgba(134,239,172,0.5)' }}>
                        ${job.hourlyRate}/hr
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className="text-sm font-semibold px-3 py-1 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}
                >
                  {count} task{count !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
