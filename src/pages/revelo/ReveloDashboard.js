import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReveloUsers, listTeamStats } from '../../api/reveloApi';
import {
  Users, AlertCircle, Loader, Send, CheckCircle, XCircle, BarChart2,
  LayoutGrid, GitFork, Table2, ChevronRight, ChevronDown,
  FolderOpen, Folder, Briefcase, ArrowUp, ArrowDown, ArrowUpDown, Search,
} from 'lucide-react';
import ReveloTreeDashboard from './ReveloTreeDashboard';

// ─── Timezone / date helpers (same as ReveloEditor) ──────────────────────────
const ALL_TZ = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC'];
const PRESETS = [
  { key: 'today',      label: 'Today' },      { key: 'yesterday',  label: 'Yesterday' },
  { key: 'this_week',  label: 'This week' },  { key: 'last_week',  label: 'Last week' },
  { key: 'this_month', label: 'This month' }, { key: 'last_month', label: 'Last month' },
  { key: 'this_year',  label: 'This year' },  { key: 'last_year',  label: 'Last year' },
  { key: 'all',        label: 'All' },
];
function midnightUTC(tz, y, m, d) {
  const noon  = new Date(Date.UTC(y, m - 1, d, 12));
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(noon);
  const get = (t) => parseInt(parts.find(p => p.type === t).value, 10);
  const offsetMs = noon.getTime() - Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + offsetMs);
}
function localToUTC(localStr, tz) {
  if (!localStr) return '';
  const [date, time] = localStr.split('T');
  const [y, m, d]    = date.split('-').map(Number);
  const [H, M]       = (time || '00:00').split(':').map(Number);
  const midnight     = midnightUTC(tz, y, m, d);
  midnight.setUTCMinutes(midnight.getUTCMinutes() + H * 60 + M);
  return midnight.toISOString();
}
function utcToLocalInput(iso, tz) {
  if (!iso) return '';
  const dt    = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(dt);
  const g = (t) => parts.find(p => p.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}
function computePreset(key, tz) {
  const now   = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const g   = (t) => parseInt(parts.find(p => p.type === t).value, 10);
  const [y, mo, d] = [g('year'), g('month'), g('day')];
  const dow  = new Date(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T12:00:00`).getDay();
  const ws   = d - dow;
  if (key === 'today')      return { from: midnightUTC(tz,y,mo,d).toISOString(),   to: midnightUTC(tz,y,mo,d+1).toISOString() };
  if (key === 'yesterday')  return { from: midnightUTC(tz,y,mo,d-1).toISOString(), to: midnightUTC(tz,y,mo,d).toISOString() };
  if (key === 'this_week')  return { from: midnightUTC(tz,y,mo,ws).toISOString(),  to: midnightUTC(tz,y,mo,ws+7).toISOString() };
  if (key === 'last_week')  return { from: midnightUTC(tz,y,mo,ws-7).toISOString(),to: midnightUTC(tz,y,mo,ws).toISOString() };
  if (key === 'this_month') return { from: midnightUTC(tz,y,mo,1).toISOString(),   to: midnightUTC(tz,y,mo+1,1).toISOString() };
  if (key === 'last_month') return { from: midnightUTC(tz,y,mo-1,1).toISOString(), to: midnightUTC(tz,y,mo,1).toISOString() };
  if (key === 'this_year')  return { from: midnightUTC(tz,y,1,1).toISOString(),    to: midnightUTC(tz,y+1,1,1).toISOString() };
  if (key === 'last_year')  return { from: midnightUTC(tz,y-1,1,1).toISOString(),  to: midnightUTC(tz,y,1,1).toISOString() };
  return null;
}
function fmtMoney(v) {
  if (v == null || isNaN(v) || v === 0) return null;
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const dtInputStyle = { padding: '4px 8px', borderRadius: 7, fontSize: 12, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0', outline: 'none' };

// ─── TzPicker ─────────────────────────────────────────────────────────────────
function TzPicker({ value, onChange }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const filtered = ALL_TZ.filter(tz => tz.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: open ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)', color: '#86efac', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300, background: '#071510', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 10, width: 240, maxHeight: 260, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 30px rgba(0,0,0,0.7)' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search timezone…" style={{ padding: '7px 10px', fontSize: 12, borderRadius: '10px 10px 0 0', background: 'rgba(74,222,128,0.06)', border: 'none', borderBottom: '1px solid rgba(74,222,128,0.15)', color: '#bbf7d0', outline: 'none' }} />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.slice(0, 200).map(tz => (
              <button key={tz} onClick={() => { onChange(tz); setOpen(false); setSearch(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: 12, background: tz === value ? 'rgba(74,222,128,0.15)' : 'transparent', color: tz === value ? '#4ade80' : 'rgba(200,255,220,0.75)' }}>{tz}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FilterBar ─────────────────────────────────────────────────────────────────
function FilterBar({ tz, setTz, fromDT, setFromDT, toDT, setToDT, activePreset, setActivePreset, onApply, onClear, onPreset }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <TzPicker value={tz} onChange={(newTz) => { setTz(newTz); setFromDT(''); setToDT(''); setActivePreset(null); }} />
      <div style={{ width: 1, height: 16, background: 'rgba(74,222,128,0.15)', flexShrink: 0 }} />
      <input type="datetime-local" value={fromDT} onChange={e => { setFromDT(e.target.value); setActivePreset(null); }} style={dtInputStyle} />
      <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 12 }}>→</span>
      <input type="datetime-local" value={toDT} onChange={e => { setToDT(e.target.value); setActivePreset(null); }} style={dtInputStyle} />
      <button onClick={onApply} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', cursor: 'pointer', fontWeight: 600 }}>Filter</button>
      <button onClick={onClear} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 12, background: 'transparent', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.5)', cursor: 'pointer' }}>Clear</button>
      <div style={{ width: 1, height: 16, background: 'rgba(74,222,128,0.15)', flexShrink: 0 }} />
      {PRESETS.map(p => (
        <button key={p.key} onClick={() => onPreset(p.key)} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', transition: 'all 0.1s', fontWeight: activePreset === p.key ? 700 : 400, background: activePreset === p.key ? 'rgba(74,222,128,0.18)' : 'transparent', border: `1px solid ${activePreset === p.key ? 'rgba(74,222,128,0.45)' : 'rgba(74,222,128,0.18)'}`, color: activePreset === p.key ? '#4ade80' : 'rgba(134,239,172,0.6)' }}>{p.label}</button>
      ))}
    </div>
  );
}

// ─── ViewToggle ────────────────────────────────────────────────────────────────
function ViewToggle({ mode, onChange }) {
  const btn = (key, Icon, title) => (
    <button key={key} title={title} onClick={() => onChange(key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', background: mode === key ? 'rgba(74,222,128,0.18)' : 'transparent', border: `1px solid ${mode === key ? 'rgba(74,222,128,0.45)' : 'rgba(74,222,128,0.12)'}`, color: mode === key ? '#4ade80' : 'rgba(134,239,172,0.4)', transition: 'all 0.12s' }}>
      <Icon size={14} />
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {btn('card',  LayoutGrid, 'Card View')}
      {btn('tree',  GitFork,    'Tree View')}
      {btn('table', Table2,     'Table View')}
    </div>
  );
}

// ─── UserCard ─────────────────────────────────────────────────────────────────
function UserCard({ user, onClick }) {
  const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();
  const pending  = (user.submitted ?? 0) - (user.approved ?? 0) - (user.rejected ?? 0);
  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 14px', borderRadius: 14, background: 'rgba(3,18,9,0.7)', outline: '1px solid rgba(74,222,128,0.12)', cursor: 'pointer', userSelect: 'none', transition: 'opacity 0.15s, outline 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.outline = '1px solid rgba(74,222,128,0.35)'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1';   e.currentTarget.style.outline = '1px solid rgba(74,222,128,0.12)'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.displayName} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(74,222,128,0.3)' }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: 'rgba(74,222,128,0.12)', border: '2px solid rgba(74,222,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: 17, fontWeight: 700 }}>{initials}</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#bbf7d0', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName || user.username}</div>
          <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 11, marginTop: 2 }}>@{user.username}</div>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(74,222,128,0.08)' }} />
      <div style={{ display: 'flex', gap: 7 }}>
        {[
          { icon: Send,        label: 'Submitted', value: user.submitted ?? 0, cost: user.submittedCost, color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)' },
          { icon: CheckCircle, label: 'Approved',  value: user.approved  ?? 0, cost: user.approvedCost,  color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.2)' },
          { icon: XCircle,     label: 'Rejected',  value: user.rejected  ?? 0, cost: user.rejectedCost,  color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
          { icon: BarChart2,   label: 'Pending',   value: pending,              cost: user.pendingCost,   color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)',
            prefix: pending >= 0 ? '+' : '' },
        ].map(({ icon: Icon, label, value, cost, color, bg, border, prefix = '' }) => (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 5px', borderRadius: 9, background: bg, border: `1px solid ${border}` }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: `color-mix(in srgb, ${color} 18%, transparent)`, border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={12} style={{ color }} />
            </div>
            <span style={{ color, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>{prefix}{value}</span>
            {fmtMoney(cost) && <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: 9, lineHeight: 1, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtMoney(cost)}</span>}
            <span style={{ color: 'rgba(134,239,172,0.45)', fontSize: 9, lineHeight: 1, textAlign: 'center' }}>{label}</span>
          </div>
        ))}
      </div>
      {(user.submitted ?? 0) > 0 && (() => {
        const ap = Math.round(((user.approved ?? 0) / user.submitted) * 100);
        const rp = Math.round(((user.rejected ?? 0) / user.submitted) * 100);
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'rgba(134,239,172,0.3)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolution</span>
              <span style={{ color: 'rgba(134,239,172,0.45)', fontSize: 9 }}>{ap}% approved</span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', display: 'flex', overflow: 'hidden' }}>
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

// ─── TeamStatsTable ────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  submitted: '#fb923c',
  approved:  '#4ade80',
  rejected:  '#f87171',
  pending:   '#60a5fa',
};

function TeamStatsTable({ data, loading, error }) {
  const [expanded,  setExpanded]  = useState({});
  const [search,    setSearch]    = useState('');
  const [sortKey,   setSortKey]   = useState('submitted');
  const [sortDir,   setSortDir]   = useState('desc');

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ArrowUpDown size={11} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <ArrowUp size={11} style={{ color: '#4ade80' }} /> : <ArrowDown size={11} style={{ color: '#4ade80' }} />;
  };

  const statCell = (count, cost, color, sign = '') => (
    <td style={{ padding: '7px 14px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <span style={{ color, fontWeight: 700, fontSize: 13, lineHeight: 1 }}>{sign}{count}</span>
        {cost > 0
          ? <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 600, lineHeight: 1 }}>{fmtMoney(cost) || '$0.00'}</span>
          : <span style={{ color: 'rgba(134,239,172,0.18)', fontSize: 10, lineHeight: 1 }}>—</span>
        }
      </div>
    </td>
  );

  const pendingCell = (sub, app, rej, sC, aC, rC) => {
    const p = sub - app - rej;
    const pC = (sC || 0) - (aC || 0) - (rC || 0);
    return statCell(Math.abs(p), Math.abs(pC), '#60a5fa', p >= 0 ? '+' : '−');
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Loader size={24} className="animate-spin" style={{ color: '#4ade80' }} /></div>;
  if (error)   return <div style={{ margin: '20px 0', color: '#f87171', padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, fontSize: 13, display: 'flex', gap: 8 }}><AlertCircle size={14} />{error}</div>;
  if (!data)   return null;

  const filtered = data.members
    .filter(m => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (m.displayName || '').toLowerCase().includes(q) || m.username.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortKey === 'name') {
        const na = (a.displayName || a.username).toLowerCase();
        const nb = (b.displayName || b.username).toLowerCase();
        return sortDir === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na);
      }
      const va = sortKey === 'pending' ? a.submitted - a.approved - a.rejected : (a[sortKey] || 0);
      const vb = sortKey === 'pending' ? b.submitted - b.approved - b.rejected : (b[sortKey] || 0);
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const thStyle = (col) => ({
    padding: '7px 14px', textAlign: col === 'name' ? 'left' : 'right',
    color: sortKey === col ? '#4ade80' : 'rgba(134,239,172,0.4)',
    fontWeight: 600, fontSize: 10, textTransform: 'uppercase',
    letterSpacing: '0.08em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
    background: 'rgba(74,222,128,0.04)',
  });

  const thContent = (col, label) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: col === 'name' ? 'flex-start' : 'flex-end' }}>
      {label} <SortIcon col={col} />
    </div>
  );

  return (
    <div>
      {/* Search + stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: '0 0 260px' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'rgba(134,239,172,0.35)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search member…"
            style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 8, fontSize: 12, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0', outline: 'none' }}
          />
        </div>
        <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 11 }}>
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(74,222,128,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(74,222,128,0.12)' }}>
              <th style={thStyle('name')}    onClick={() => toggleSort('name')}>{thContent('name', 'Member')}</th>
              <th style={thStyle('submitted')} onClick={() => toggleSort('submitted')}>{thContent('submitted', 'Submitted')}</th>
              <th style={thStyle('approved')}  onClick={() => toggleSort('approved')}>{thContent('approved',  'Approved')}</th>
              <th style={thStyle('rejected')}  onClick={() => toggleSort('rejected')}>{thContent('rejected',  'Rejected')}</th>
              <th style={thStyle('pending')}   onClick={() => toggleSort('pending')}>{thContent('pending',   'Pending')}</th>
            </tr>
          </thead>
          <tbody>
            {/* Totals row */}
            <tr style={{ background: 'rgba(74,222,128,0.06)', borderBottom: '2px solid rgba(74,222,128,0.15)' }}>
              <td style={{ padding: '9px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <BarChart2 size={13} style={{ color: 'rgba(74,222,128,0.6)', flexShrink: 0 }} />
                  <span style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 13 }}>All Members</span>
                  <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 10 }}>({data.members.length})</span>
                </div>
              </td>
              {statCell(data.totals.submitted, data.totals.submittedCost, TYPE_COLORS.submitted, '+')}
              {statCell(data.totals.approved,  data.totals.approvedCost,  TYPE_COLORS.approved,  '−')}
              {statCell(data.totals.rejected,  data.totals.rejectedCost,  TYPE_COLORS.rejected,  '−')}
              {pendingCell(data.totals.submitted, data.totals.approved, data.totals.rejected, data.totals.submittedCost, data.totals.approvedCost, data.totals.rejectedCost)}
            </tr>

            {filtered.map(member => {
              const mId  = member.id;
              const isExp = !!expanded[mId];
              const initials = (member.displayName || member.username || '?').slice(0, 2).toUpperCase();
              return (
                <Fragment key={mId}>
                  <tr
                    style={{ borderBottom: '1px solid rgba(74,222,128,0.06)', cursor: 'pointer', background: isExp ? 'rgba(96,165,250,0.04)' : 'transparent' }}
                    onClick={() => setExpanded(prev => ({ ...prev, [mId]: !prev[mId] }))}
                    onMouseEnter={e => { e.currentTarget.style.background = isExp ? 'rgba(96,165,250,0.08)' : 'rgba(74,222,128,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isExp ? 'rgba(96,165,250,0.04)' : 'transparent'; }}
                  >
                    <td style={{ padding: '8px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isExp ? <ChevronDown size={13} style={{ color: '#60a5fa', flexShrink: 0 }} /> : <ChevronRight size={13} style={{ color: 'rgba(134,239,172,0.3)', flexShrink: 0 }} />}
                        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '1.5px solid rgba(74,222,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: member.avatarUrl ? 'transparent' : 'rgba(74,222,128,0.1)' }}>
                          {member.avatarUrl ? <img src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 9 }}>{initials}</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: isExp ? '#60a5fa' : 'rgba(200,255,220,0.85)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.displayName || member.username}</div>
                          {member.displayName && <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 10, lineHeight: 1 }}>@{member.username}</div>}
                        </div>
                        {(member.accounts?.length > 0) && <span style={{ color: 'rgba(134,239,172,0.25)', fontSize: 10, marginLeft: 4 }}>({member.accounts.length} acct)</span>}
                      </div>
                    </td>
                    {statCell(member.submitted, member.submittedCost, TYPE_COLORS.submitted, '+')}
                    {statCell(member.approved,  member.approvedCost,  TYPE_COLORS.approved,  '−')}
                    {statCell(member.rejected,  member.rejectedCost,  TYPE_COLORS.rejected,  '−')}
                    {pendingCell(member.submitted, member.approved, member.rejected, member.submittedCost, member.approvedCost, member.rejectedCost)}
                  </tr>

                  {isExp && (member.accounts || []).map(acc => {
                    const aKey = `${mId}:${acc.id}`;
                    const aExp = !!expanded[aKey];
                    return (
                      <Fragment key={aKey}>
                        <tr
                          style={{ borderBottom: '1px solid rgba(74,222,128,0.04)', background: aExp ? 'rgba(251,191,36,0.03)' : 'rgba(74,222,128,0.015)', cursor: 'pointer' }}
                          onClick={() => setExpanded(prev => ({ ...prev, [aKey]: !prev[aKey] }))}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.05)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = aExp ? 'rgba(251,191,36,0.03)' : 'rgba(74,222,128,0.015)'; }}
                        >
                          <td style={{ padding: '6px 14px 6px 44px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {aExp ? <ChevronDown size={12} style={{ color: '#fbbf24', flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: 'rgba(134,239,172,0.3)', flexShrink: 0 }} />}
                              {aExp ? <FolderOpen size={12} style={{ color: '#fbbf24', flexShrink: 0 }} /> : <Folder size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />}
                              <span style={{ color: aExp ? '#fbbf24' : 'rgba(200,255,220,0.7)', fontWeight: 500, fontSize: 11 }}>{acc.name}</span>
                              <span style={{ color: 'rgba(134,239,172,0.25)', fontSize: 10 }}>({acc.jobs?.length || 0} job{(acc.jobs?.length || 0) !== 1 ? 's' : ''})</span>
                            </div>
                          </td>
                          {statCell(acc.submitted, acc.submittedCost, TYPE_COLORS.submitted, '+')}
                          {statCell(acc.approved,  acc.approvedCost,  TYPE_COLORS.approved,  '−')}
                          {statCell(acc.rejected,  acc.rejectedCost,  TYPE_COLORS.rejected,  '−')}
                          {pendingCell(acc.submitted, acc.approved, acc.rejected, acc.submittedCost, acc.approvedCost, acc.rejectedCost)}
                        </tr>

                        {aExp && (acc.jobs || []).map(job => (
                          <tr key={job.id} style={{ borderBottom: '1px solid rgba(74,222,128,0.03)', background: 'rgba(74,222,128,0.008)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.04)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.008)'; }}>
                            <td style={{ padding: '5px 14px 5px 72px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Briefcase size={11} style={{ color: 'rgba(74,222,128,0.25)', flexShrink: 0 }} />
                                <span style={{ color: 'rgba(200,255,220,0.55)', fontSize: 11 }}>{job.jobName}</span>
                              </div>
                            </td>
                            {statCell(job.submitted, job.submittedCost, TYPE_COLORS.submitted, '+')}
                            {statCell(job.approved,  job.approvedCost,  TYPE_COLORS.approved,  '−')}
                            {statCell(job.rejected,  job.rejectedCost,  TYPE_COLORS.rejected,  '−')}
                            {pendingCell(job.submitted, job.approved, job.rejected, job.submittedCost, job.approvedCost, job.rejectedCost)}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}

            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '40px 14px', textAlign: 'center', color: 'rgba(134,239,172,0.28)', fontSize: 13 }}>No members match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function ReveloDashboard() {
  const navigate = useNavigate();

  const [tz,           setTz]           = useState(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } });
  const [fromDT,       setFromDT]       = useState('');
  const [toDT,         setToDT]         = useState('');
  const [activePreset, setActivePreset] = useState(null);

  const [viewMode,  setViewMode]  = useState('card');
  const [cardUsers, setCardUsers] = useState([]);
  const [tableData, setTableData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const currentRange = useRef({ from: '', to: '' });

  const loadCard = useCallback((from, to) => {
    setLoading(true); setError('');
    const payload = {};
    if (from) payload.from = from;
    if (to)   payload.to   = to;
    listReveloUsers(payload)
      .then(r => { if (r.success) setCardUsers(r.users); else setError(r.message); })
      .catch(e => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadTable = useCallback((from, to) => {
    setLoading(true); setError('');
    const payload = {};
    if (from) payload.from = from;
    if (to)   payload.to   = to;
    listTeamStats(payload)
      .then(r => { if (r.success) setTableData(r); else setError(r.message); })
      .catch(e => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  // Init with "today" preset
  useEffect(() => {
    const range = computePreset('today', tz);
    if (range) {
      setFromDT(utcToLocalInput(range.from, tz));
      setToDT(utcToLocalInput(range.to, tz));
      setActivePreset('today');
      currentRange.current = range;
      loadCard(range.from, range.to);
    } else {
      loadCard('', '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when viewMode changes (between card and table)
  useEffect(() => {
    if (viewMode === 'tree') return;
    const { from, to } = currentRange.current;
    if (viewMode === 'card')  loadCard(from, to);
    if (viewMode === 'table') loadTable(from, to);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const applyPreset = (key) => {
    setActivePreset(key);
    if (key === 'all') {
      setFromDT(''); setToDT('');
      currentRange.current = { from: '', to: '' };
      if (viewMode === 'card')  loadCard('', '');
      if (viewMode === 'table') loadTable('', '');
      return;
    }
    const range = computePreset(key, tz);
    if (!range) return;
    setFromDT(utcToLocalInput(range.from, tz));
    setToDT(utcToLocalInput(range.to, tz));
    currentRange.current = range;
    if (viewMode === 'card')  loadCard(range.from, range.to);
    if (viewMode === 'table') loadTable(range.from, range.to);
  };

  const applyManual = () => {
    setActivePreset(null);
    const from = fromDT ? localToUTC(fromDT, tz) : '';
    const to   = toDT   ? localToUTC(toDT,   tz) : '';
    currentRange.current = { from, to };
    if (viewMode === 'card')  loadCard(from, to);
    if (viewMode === 'table') loadTable(from, to);
  };

  const clearFilter = () => {
    setFromDT(''); setToDT(''); setActivePreset(null);
    currentRange.current = { from: '', to: '' };
    if (viewMode === 'card')  loadCard('', '');
    if (viewMode === 'table') loadTable('', '');
  };

  const filterBar = (
    <FilterBar
      tz={tz} setTz={(v) => { setTz(v); setFromDT(''); setToDT(''); setActivePreset(null); }}
      fromDT={fromDT} setFromDT={setFromDT}
      toDT={toDT}     setToDT={setToDT}
      activePreset={activePreset} setActivePreset={setActivePreset}
      onApply={applyManual}
      onClear={clearFilter}
      onPreset={applyPreset}
    />
  );

  // ── Tree view ──
  if (viewMode === 'tree') {
    return (
      <div className="container mx-auto max-w-screen-lg px-4">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24, marginBottom: 16 }}>
          <Users size={17} style={{ color: '#4ade80' }} />
          <span style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 15 }}>Members</span>
          <div style={{ flex: 1 }} />
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
        <ReveloTreeDashboard />
      </div>
    );
  }

  // ── Card + Table views ──
  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-6">
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Users size={17} style={{ color: '#4ade80' }} />
        <span style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 15 }}>Members</span>
        <span style={{ padding: '1px 9px', borderRadius: 99, fontSize: 11, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: 'rgba(134,239,172,0.6)' }}>
          {viewMode === 'table' ? (tableData?.members?.length ?? 0) : cardUsers.length}
        </span>
        <div style={{ flex: 1 }} />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* Filter bar */}
      <div style={{ marginBottom: 18, padding: '8px 14px', borderRadius: 10, background: 'rgba(3,12,7,0.6)', border: '1px solid rgba(74,222,128,0.1)' }}>
        {filterBar}
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 16, color: '#f87171', padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, fontSize: 13, display: 'flex', gap: 8 }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Card view */}
      {viewMode === 'card' && (
        loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Loader size={28} className="animate-spin" style={{ color: '#4ade80' }} />
          </div>
        ) : cardUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(134,239,172,0.4)', fontSize: 14 }}>No activity in this period.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {cardUsers.map(u => (
              <UserCard key={u.id} user={u} onClick={() => navigate(`/revelo/task-balance/${u.username}`)} />
            ))}
          </div>
        )
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        <TeamStatsTable data={tableData} loading={loading} error={''} />
      )}
    </div>
  );
}
