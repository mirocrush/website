import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReveloUsers } from '../../api/reveloApi';
import {
  Users, Clock, AlertCircle, Loader,
  ChevronLeft, ChevronRight, Send, CheckCircle, XCircle, BarChart2,
} from 'lucide-react';

const CARD_W   = 240;
const CARD_GAP = 12;
const VISIBLE  = 3;
const DRAG_THRESHOLD = 50;

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

function UserCard({ user, onClick, dragging }) {
  const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();
  const pending  = (user.submitted ?? 0) - (user.approved ?? 0) - (user.rejected ?? 0);

  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, width: CARD_W,
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '16px 14px', borderRadius: 14, border: 'none',
        cursor: dragging ? 'grabbing' : 'pointer',
        background: 'rgba(3,18,9,0.7)',
        outline: '1px solid rgba(74,222,128,0.12)',
        transition: dragging ? 'none' : 'background 0.15s, outline 0.15s, transform 0.15s',
        textAlign: 'left', userSelect: 'none',
        pointerEvents: dragging ? 'none' : 'auto',
      }}
      onMouseEnter={e => {
        if (dragging) return;
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

      {/* Today + Pending heroes */}
      <div style={{ display: 'flex', gap: 7 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 10px', borderRadius: 9,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
        }}>
          <Clock size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <div>
            <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 9, lineHeight: 1 }}>Today</div>
            <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
              {user.todayCount ?? 0}
            </div>
          </div>
        </div>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 10px', borderRadius: 9,
          background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
        }}>
          <BarChart2 size={12} style={{ color: '#60a5fa', flexShrink: 0 }} />
          <div>
            <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 9, lineHeight: 1 }}>Pending</div>
            <div style={{ color: '#60a5fa', fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
              {pending >= 0 ? '+' : ''}{pending}
            </div>
          </div>
        </div>
      </div>

      {/* Accounts + Jobs */}
      <div style={{ display: 'flex', gap: 7 }}>
        <StatBox icon={Users}    label="Accounts" value={user.accountCount ?? 0}
          color="#4ade80" bg="rgba(74,222,128,0.08)"  border="rgba(74,222,128,0.2)" />
        <StatBox icon={BarChart2} label="Jobs"    value={user.jobCount ?? 0}
          color="#60a5fa" bg="rgba(96,165,250,0.08)"  border="rgba(96,165,250,0.2)" />
      </div>

      {/* Task balance */}
      <div>
        <div style={{ color: 'rgba(134,239,172,0.3)', fontSize: 9, letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 6 }}>Task Balance</div>
        <div style={{ display: 'flex', gap: 7 }}>
          <StatBox icon={Send}        label="Submitted" value={user.submitted ?? 0}
            color="#fb923c" bg="rgba(251,146,60,0.08)"  border="rgba(251,146,60,0.2)" />
          <StatBox icon={CheckCircle} label="Approved"  value={user.approved  ?? 0}
            color="#4ade80" bg="rgba(74,222,128,0.08)"  border="rgba(74,222,128,0.2)" />
          <StatBox icon={XCircle}     label="Rejected"  value={user.rejected  ?? 0}
            color="#f87171" bg="rgba(248,113,113,0.08)" border="rgba(248,113,113,0.2)" />
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
    </button>
  );
}

export default function ReveloDashboard() {
  const navigate   = useNavigate();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [page,    setPage]    = useState(0);

  // drag state
  const dragStartX  = useRef(null);
  const dragDeltaRef = useRef(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const didDragRef = useRef(false);

  useEffect(() => {
    listReveloUsers()
      .then(u => { if (u.success) setUsers(u.users); else setError(u.message); })
      .catch(e => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(users.length / VISIBLE));
  const canPrev    = page > 0;
  const canNext    = page < totalPages - 1;

  const goTo = useCallback((next) => {
    setPage(Math.min(Math.max(next, 0), totalPages - 1));
  }, [totalPages]);

  const onMouseDown = (e) => {
    dragStartX.current = e.clientX;
    dragDeltaRef.current = 0;
    didDragRef.current = false;
    setIsDragging(true);
    setDragDelta(0);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      const delta = e.clientX - dragStartX.current;
      dragDeltaRef.current = delta;
      if (Math.abs(delta) > 8) didDragRef.current = true;
      setDragDelta(delta);
    };
    const onUp = () => {
      const delta = dragDeltaRef.current;
      if (delta < -DRAG_THRESHOLD && canNext) goTo(page + 1);
      else if (delta > DRAG_THRESHOLD && canPrev) goTo(page - 1);
      setDragDelta(0);
      setIsDragging(false);
      dragStartX.current = null;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',  onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',  onUp);
    };
  }, [isDragging, canNext, canPrev, page, goTo]);

  const baseOffset = page * VISIBLE * (CARD_W + CARD_GAP);
  const liveOffset = baseOffset - dragDelta;

  const navBtn = (enabled, onClick, children) => (
    <button onClick={onClick} disabled={!enabled} style={{
      width: 36, height: 36, borderRadius: '50%', border: 'none',
      cursor: enabled ? 'pointer' : 'default', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: enabled ? 'rgba(74,222,128,0.12)' : 'rgba(74,222,128,0.04)',
      color:      enabled ? '#4ade80'                : 'rgba(74,222,128,0.2)',
      transition: 'background 0.15s',
    }}
    onMouseEnter={e => { if (enabled) e.currentTarget.style.background = 'rgba(74,222,128,0.22)'; }}
    onMouseLeave={e => { if (enabled) e.currentTarget.style.background = 'rgba(74,222,128,0.12)'; }}
    >
      {children}
    </button>
  );

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <Users size={17} style={{ color: '#4ade80' }} />
        <span style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 15 }}>Members</span>
        <span style={{
          padding: '1px 9px', borderRadius: 99, fontSize: 11,
          background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
          color: 'rgba(134,239,172,0.6)',
        }}>{users.length}</span>
        <div style={{ flex: 1 }} />
        {totalPages > 1 && (
          <span style={{ color: 'rgba(134,239,172,0.4)', fontSize: 12, marginRight: 4 }}>
            {page + 1} / {totalPages}
          </span>
        )}
        {navBtn(canPrev, () => goTo(page - 1), <ChevronLeft size={16} />)}
        {navBtn(canNext, () => goTo(page + 1), <ChevronRight size={16} />)}
      </div>

      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(134,239,172,0.4)', fontSize: 14 }}>
          No members yet.
        </div>
      ) : (
        <>
          {/* Carousel viewport */}
          <div
            style={{ overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={onMouseDown}
          >
            <div style={{
              display: 'flex', gap: CARD_GAP,
              transform: `translateX(-${liveOffset}px)`,
              transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
              userSelect: 'none',
            }}>
              {users.map(u => (
                <UserCard
                  key={u.id}
                  user={u}
                  dragging={isDragging}
                  onClick={() => {
                    if (didDragRef.current) return;
                    navigate(`/revelo/task-balance/${u.username}`);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Dot indicators */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 18 }}>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => goTo(i)} style={{
                  width: i === page ? 18 : 6, height: 6, borderRadius: 99, border: 'none',
                  cursor: 'pointer', padding: 0, transition: 'all 0.25s',
                  background: i === page ? '#4ade80' : 'rgba(74,222,128,0.2)',
                }} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
