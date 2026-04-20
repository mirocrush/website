import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReveloUsers } from '../../api/reveloApi';
import { Users, Clock, AlertCircle, Loader, Send, CheckCircle, XCircle, BarChart2, DollarSign } from 'lucide-react';

function fmtMoney(v) {
  if (v == null || isNaN(v)) return null;
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatBox({ icon: Icon, label, value, color, bg, border }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '8px 5px', borderRadius: 9,
      background: bg, border: `1px solid ${border}`,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        border: `1.5px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={12} style={{ color }} />
      </div>
      <span style={{ color, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>{value}</span>
      <span style={{ color: 'rgba(134,239,172,0.45)', fontSize: 9, lineHeight: 1, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

function UserCard({ user, onClick }) {
  const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();
  const pending  = (user.submitted ?? 0) - (user.approved ?? 0) - (user.rejected ?? 0);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '16px 14px', borderRadius: 14,
        background: 'rgba(3,18,9,0.7)',
        outline: '1px solid rgba(74,222,128,0.12)',
        cursor: 'pointer', userSelect: 'none',
        transition: 'opacity 0.15s, outline 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.opacity = '0.7';
        e.currentTarget.style.outline = '1px solid rgba(74,222,128,0.35)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.outline = '1px solid rgba(74,222,128,0.12)';
      }}
    >
      {/* avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.displayName}
            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
              border: '2px solid rgba(74,222,128,0.3)' }} />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(74,222,128,0.12)', border: '2px solid rgba(74,222,128,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#4ade80', fontSize: 17, fontWeight: 700,
          }}>
            {initials}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#bbf7d0', fontSize: 13, fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.displayName || user.username}
          </div>
          <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 11, marginTop: 2 }}>
            @{user.username}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(74,222,128,0.08)' }} />

      {/* Today + Pending */}
      <div style={{ display: 'flex', gap: 7 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 10px', borderRadius: 9,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
        }}>
          <Clock size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 9, lineHeight: 1 }}>Today</div>
            <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
              {user.todayCount ?? 0}
            </div>
            {fmtMoney(user.todayCost) && (
              <div style={{ color: 'rgba(251,191,36,0.65)', fontSize: 10, marginTop: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fmtMoney(user.todayCost)}
              </div>
            )}
          </div>
        </div>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 10px', borderRadius: 9,
          background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
        }}>
          <BarChart2 size={12} style={{ color: '#60a5fa', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 9, lineHeight: 1 }}>Pending</div>
            <div style={{ color: '#60a5fa', fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
              {pending >= 0 ? '+' : ''}{pending}
            </div>
            {fmtMoney(user.pendingCost) && (
              <div style={{ color: 'rgba(96,165,250,0.65)', fontSize: 10, marginTop: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pending >= 0 ? '+' : ''}{fmtMoney(Math.abs(user.pendingCost))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Accounts + Jobs */}
      <div style={{ display: 'flex', gap: 7 }}>
        <StatBox icon={Users}     label="Accounts" value={user.accountCount ?? 0}
          color="#4ade80" bg="rgba(74,222,128,0.08)"  border="rgba(74,222,128,0.2)" />
        <StatBox icon={BarChart2} label="Jobs"      value={user.jobCount ?? 0}
          color="#60a5fa" bg="rgba(96,165,250,0.08)"  border="rgba(96,165,250,0.2)" />
      </div>

      {/* Task balance */}
      <div>
        <div style={{ color: 'rgba(134,239,172,0.3)', fontSize: 9, letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 6 }}>Task Balance</div>
        <div style={{ display: 'flex', gap: 7 }}>
          {[
            { icon: Send,        label: 'Submitted', value: user.submitted ?? 0, cost: user.submittedCost,
              color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)' },
            { icon: CheckCircle, label: 'Approved',  value: user.approved  ?? 0, cost: user.approvedCost,
              color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.2)' },
            { icon: XCircle,     label: 'Rejected',  value: user.rejected  ?? 0, cost: user.rejectedCost,
              color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
          ].map(({ icon: Icon, label, value, cost, color, bg, border }) => (
            <div key={label} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '8px 5px', borderRadius: 9, background: bg, border: `1px solid ${border}`,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: `color-mix(in srgb, ${color} 18%, transparent)`,
                border: `1.5px solid ${border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={12} style={{ color }} />
              </div>
              <span style={{ color, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>{value}</span>
              {fmtMoney(cost) && (
                <span style={{
                  color: 'rgba(251,191,36,0.7)', fontSize: 9, lineHeight: 1,
                  textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', maxWidth: '100%',
                }}>
                  {fmtMoney(cost)}
                </span>
              )}
              <span style={{ color: 'rgba(134,239,172,0.45)', fontSize: 9, lineHeight: 1, textAlign: 'center' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Resolution bar */}
      {(user.submitted ?? 0) > 0 && (() => {
        const ap = Math.round(((user.approved ?? 0) / user.submitted) * 100);
        const rp = Math.round(((user.rejected ?? 0) / user.submitted) * 100);
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'rgba(134,239,172,0.3)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resolution
              </span>
              <span style={{ color: 'rgba(134,239,172,0.45)', fontSize: 9 }}>{ap}% approved</span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)',
              display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: `${ap}%`, background: '#4ade80' }} />
              <div style={{ width: `${rp}%`, background: '#f87171' }} />
              <div style={{ width: `${Math.max(0, 100 - ap - rp)}%`, background: 'rgba(96,165,250,0.35)' }} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function ReveloDashboard() {
  const navigate = useNavigate();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

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
        <div className="rounded-2xl border p-5 flex items-center gap-3"
          style={{ borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)' }}>
          <AlertCircle size={20} style={{ color: '#f87171' }} />
          <span style={{ color: '#fca5a5' }}>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-8">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Users size={17} style={{ color: '#4ade80' }} />
        <span style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 15 }}>Members</span>
        <span style={{
          padding: '1px 9px', borderRadius: 99, fontSize: 11,
          background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
          color: 'rgba(134,239,172,0.6)',
        }}>{users.length}</span>
      </div>

      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(134,239,172,0.4)', fontSize: 14 }}>
          No members yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
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
  );
}
