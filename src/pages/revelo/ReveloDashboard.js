import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReveloUsers } from '../../api/reveloApi';
import {
  Users, Clock, AlertCircle, Loader,
  ChevronLeft, ChevronRight, Send, CheckCircle, XCircle, BarChart2,
} from 'lucide-react';

const CARD_W   = 280;
const CARD_GAP = 16;
const VISIBLE  = 3;

function StatBox({ icon: Icon, label, value, color, bg, border }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '10px 6px', borderRadius: 10,
      background: bg, border: `1px solid ${border}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        border: `1.5px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} style={{ color }} />
      </div>
      <span style={{ color, fontWeight: 800, fontSize: 18, lineHeight: 1 }}>{value}</span>
      <span style={{ color: 'rgba(134,239,172,0.45)', fontSize: 10, lineHeight: 1, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

function UserCard({ user, onClick }) {
  const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();
  const pending  = (user.submitted ?? 0) - (user.approved ?? 0) - (user.rejected ?? 0);

  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, width: CARD_W,
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: '20px 18px', borderRadius: 18, cursor: 'pointer', border: 'none',
        background: 'rgba(3,18,9,0.7)',
        outline: '1px solid rgba(74,222,128,0.12)',
        transition: 'all 0.15s', textAlign: 'left',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(74,222,128,0.07)';
        e.currentTarget.style.outline = '1px solid rgba(74,222,128,0.35)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(3,18,9,0.7)';
        e.currentTarget.style.outline = '1px solid rgba(74,222,128,0.12)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* ── Avatar + name ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.displayName}
            style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
              border: '2px solid rgba(74,222,128,0.35)' }} />
        ) : (
          <div style={{
            width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(74,222,128,0.12)', border: '2px solid rgba(74,222,128,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#4ade80', fontSize: 20, fontWeight: 700,
          }}>
            {initials}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#bbf7d0', fontSize: 15, fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.displayName || user.username}
          </div>
          <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 12, marginTop: 2 }}>
            @{user.username}
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'rgba(74,222,128,0.08)', width: '100%' }} />

      {/* ── Today + Pending heroes ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
        }}>
          <Clock size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <div>
            <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 10, lineHeight: 1 }}>Today</div>
            <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>
              {user.todayCount ?? 0}
            </div>
          </div>
        </div>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
        }}>
          <BarChart2 size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
          <div>
            <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 10, lineHeight: 1 }}>Pending</div>
            <div style={{ color: '#60a5fa', fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>
              {pending >= 0 ? '+' : ''}{pending}
            </div>
          </div>
        </div>
      </div>

      {/* ── Accounts + Jobs ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <StatBox icon={Users}  label="Accounts" value={user.accountCount ?? 0}
          color="#4ade80" bg="rgba(74,222,128,0.08)"  border="rgba(74,222,128,0.2)" />
        <StatBox icon={BarChart2} label="Jobs"  value={user.jobCount ?? 0}
          color="#60a5fa" bg="rgba(96,165,250,0.08)"  border="rgba(96,165,250,0.2)" />
      </div>

      {/* ── Task balance stats ── */}
      <div>
        <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 10, letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 8 }}>Task Balance</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatBox icon={Send}         label="Submitted" value={user.submitted ?? 0}
            color="#fb923c" bg="rgba(251,146,60,0.08)"  border="rgba(251,146,60,0.2)" />
          <StatBox icon={CheckCircle}  label="Approved"  value={user.approved  ?? 0}
            color="#4ade80" bg="rgba(74,222,128,0.08)"  border="rgba(74,222,128,0.2)" />
          <StatBox icon={XCircle}      label="Rejected"  value={user.rejected  ?? 0}
            color="#f87171" bg="rgba(248,113,113,0.08)" border="rgba(248,113,113,0.2)" />
        </div>
      </div>

      {/* ── Progress bar: approved ratio ── */}
      {(user.submitted ?? 0) > 0 && (() => {
        const approvedPct  = Math.round(((user.approved  ?? 0) / user.submitted) * 100);
        const rejectedPct  = Math.round(((user.rejected  ?? 0) / user.submitted) * 100);
        const pendingPct   = Math.max(0, 100 - approvedPct - rejectedPct);
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Resolution rate
              </span>
              <span style={{ color: 'rgba(134,239,172,0.5)', fontSize: 10 }}>{approvedPct}% approved</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)',
              display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: `${approvedPct}%`, background: '#4ade80', transition: 'width 0.4s' }} />
              <div style={{ width: `${rejectedPct}%`, background: '#f87171', transition: 'width 0.4s' }} />
              <div style={{ width: `${pendingPct}%`,  background: 'rgba(96,165,250,0.4)', transition: 'width 0.4s' }} />
            </div>
          </div>
        );
      })()}
    </button>
  );
}

export default function ReveloDashboard() {
  const navigate = useNavigate();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [page,    setPage]    = useState(0);
  const trackRef = useRef(null);

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

  const totalPages = Math.max(1, Math.ceil(users.length / VISIBLE));
  const canPrev    = page > 0;
  const canNext    = page < totalPages - 1;
  const offset     = page * VISIBLE * (CARD_W + CARD_GAP);

  const navBtn = (enabled, onClick, children) => (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: enabled ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: enabled ? 'rgba(74,222,128,0.12)' : 'rgba(74,222,128,0.04)',
        color: enabled ? '#4ade80' : 'rgba(74,222,128,0.2)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (enabled) e.currentTarget.style.background = 'rgba(74,222,128,0.22)'; }}
      onMouseLeave={e => { if (enabled) e.currentTarget.style.background = 'rgba(74,222,128,0.12)'; }}
    >
      {children}
    </button>
  );

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-8">
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Users size={18} style={{ color: '#4ade80' }} />
        <span style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 16 }}>Members</span>
        <span style={{
          padding: '1px 10px', borderRadius: 99, fontSize: 12,
          background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
          color: 'rgba(134,239,172,0.6)',
        }}>{users.length}</span>

        <div style={{ flex: 1 }} />

        {/* Pagination info */}
        {totalPages > 1 && (
          <span style={{ color: 'rgba(134,239,172,0.4)', fontSize: 12 }}>
            {page + 1} / {totalPages}
          </span>
        )}

        {/* Nav arrows */}
        {navBtn(canPrev, () => setPage(p => p - 1), <ChevronLeft size={18} />)}
        {navBtn(canNext, () => setPage(p => p + 1), <ChevronRight size={18} />)}
      </div>

      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(134,239,172,0.4)', fontSize: 14 }}>
          No members yet.
        </div>
      ) : (
        <>
          {/* Carousel viewport */}
          <div style={{ overflow: 'hidden' }}>
            <div
              ref={trackRef}
              style={{
                display: 'flex', gap: CARD_GAP,
                transform: `translateX(-${offset}px)`,
                transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {users.map(u => (
                <UserCard
                  key={u.id}
                  user={u}
                  onClick={() => navigate(`/revelo/task-balance/${u.username}`)}
                />
              ))}
            </div>
          </div>

          {/* Dot indicators */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  style={{
                    width: i === page ? 20 : 7, height: 7, borderRadius: 99, border: 'none',
                    cursor: 'pointer', padding: 0, transition: 'all 0.25s',
                    background: i === page ? '#4ade80' : 'rgba(74,222,128,0.2)',
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
