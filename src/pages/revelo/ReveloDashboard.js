import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReveloUsers } from '../../api/reveloApi';
import { Users, Clock, AlertCircle, Loader } from 'lucide-react';

function StatPill({ label, value, color }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '5px 4px', borderRadius: 8,
      background: `${color}11`, border: `1px solid ${color}28`,
    }}>
      <span style={{ color, fontWeight: 700, fontSize: 13, lineHeight: 1 }}>{value}</span>
      <span style={{ color: 'rgba(134,239,172,0.4)', fontSize: 9, lineHeight: 1, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

function UserCard({ user, onClick }) {
  const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();
  const pending  = user.pending ?? 0;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        padding: '16px 14px', borderRadius: 14, cursor: 'pointer', border: 'none',
        background: 'rgba(3,18,9,0.6)', outline: '1px solid rgba(74,222,128,0.15)',
        transition: 'all 0.15s', width: 170,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.08)'; e.currentTarget.style.outline = '1px solid rgba(74,222,128,0.4)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(3,18,9,0.6)';      e.currentTarget.style.outline = '1px solid rgba(74,222,128,0.15)'; }}
    >
      {/* avatar */}
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.displayName}
          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover',
            border: '2px solid rgba(74,222,128,0.3)' }} />
      ) : (
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(74,222,128,0.12)', border: '2px solid rgba(74,222,128,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#4ade80', fontSize: 17, fontWeight: 700,
        }}>
          {initials}
        </div>
      )}

      {/* name */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ color: '#bbf7d0', fontSize: 13, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.displayName || user.username}
        </div>
        <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 11, marginTop: 1 }}>
          @{user.username}
        </div>
      </div>

      {/* today badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, width: '100%',
        padding: '5px 8px', borderRadius: 8,
        background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
      }}>
        <Clock size={11} style={{ color: '#fbbf24', flexShrink: 0 }} />
        <span style={{ color: 'rgba(134,239,172,0.5)', fontSize: 10 }}>Today</span>
        <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13, marginLeft: 'auto' }}>
          {user.todayCount ?? 0}
        </span>
      </div>

      {/* top row: accounts + jobs */}
      <div style={{ display: 'flex', gap: 5, width: '100%' }}>
        <StatPill label="Accounts" value={user.accountCount ?? 0} color="#4ade80" />
        <StatPill label="Jobs"     value={user.jobCount     ?? 0} color="#60a5fa" />
      </div>

      {/* bottom row: submitted / approved / rejected */}
      <div style={{ display: 'flex', gap: 5, width: '100%' }}>
        <StatPill label="Submit"   value={user.submitted ?? 0} color="#fb923c" />
        <StatPill label="Approve"  value={user.approved  ?? 0} color="#4ade80" />
        <StatPill label="Reject"   value={user.rejected  ?? 0} color="#f87171" />
      </div>

      {/* pending for review */}
      <div style={{
        width: '100%', padding: '5px 8px', borderRadius: 8, textAlign: 'center',
        background: pending >= 0 ? 'rgba(96,165,250,0.08)' : 'rgba(248,113,113,0.08)',
        border: `1px solid ${pending >= 0 ? 'rgba(96,165,250,0.25)' : 'rgba(248,113,113,0.25)'}`,
      }}>
        <span style={{ color: 'rgba(134,239,172,0.45)', fontSize: 9 }}>Pending for review  </span>
        <span style={{ color: pending >= 0 ? '#60a5fa' : '#f87171', fontWeight: 700, fontSize: 13 }}>
          {pending >= 0 ? '+' : ''}{pending}
        </span>
      </div>
    </button>
  );
}

export default function ReveloDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listReveloUsers()
      .then(u => { if (u.success) setUsers(u.users); else setError(u.message); })
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
    <div className="container mx-auto max-w-screen-lg px-4 py-8">
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
        {users.length === 0 ? (
          <div className="text-sm text-center py-6" style={{ color: 'rgba(134,239,172,0.5)' }}>
            No members yet.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {users.map(u => (
              <UserCard
                key={u.id}
                user={u}
                onClick={() => navigate(`/revelo/task-balance/${u.username}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
