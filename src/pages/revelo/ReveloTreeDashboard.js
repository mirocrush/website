import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader, AlertCircle, Shield, Briefcase, Clock,
  Send, CheckCircle, XCircle,
} from 'lucide-react';
import { getTreeDashboard } from '../../api/reveloApi';

// ─── Layout constants ─────────────────────────────────────────────────────────
const MINI_R   = 13;
const MINI_GAP = 6;
const UNIT_W   = MINI_R * 6 + MINI_GAP * 2; // 90px
const EMPTY_W  = 60;
const JOB_GAP  = 10;
const ACC_GAP  = 22;
const PAD_H    = 24;

const LY   = { user: 54, account: 170, job: 278, mini: 326 };
const NR   = { user: 34, account: 26,  job: 22  };
const TREE_H = 380;

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  user:      { ring: 'rgba(74,222,128,0.80)',  bg: 'rgba(74,222,128,0.11)',  text: '#4ade80',  edge: 'rgba(74,222,128,0.28)',  glow: 'rgba(74,222,128,0.4)'  },
  account:   { ring: 'rgba(96,165,250,0.75)',  bg: 'rgba(96,165,250,0.11)', text: '#60a5fa',  edge: 'rgba(96,165,250,0.24)',  glow: 'rgba(96,165,250,0.4)'  },
  job:       { ring: 'rgba(167,139,250,0.70)', bg: 'rgba(167,139,250,0.1)', text: '#a78bfa',  edge: 'rgba(167,139,250,0.22)', glow: 'rgba(167,139,250,0.4)' },
  submitted: { ring: 'rgba(251,146,60,0.75)',  bg: 'rgba(251,146,60,0.15)', text: '#fb923c' },
  approved:  { ring: 'rgba(74,222,128,0.75)',  bg: 'rgba(74,222,128,0.14)', text: '#4ade80' },
  rejected:  { ring: 'rgba(248,113,113,0.70)', bg: 'rgba(248,113,113,0.1)', text: '#f87171' },
};

const SUM_TYPES = ['submitted', 'approved', 'rejected'];

function miniOffsets(n) {
  const step   = MINI_R * 2 + MINI_GAP;
  const totalW = n * (MINI_R * 2) + (n - 1) * MINI_GAP;
  const start  = -(totalW / 2) + MINI_R;
  return Array.from({ length: n }, (_, i) => start + i * step);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(v) {
  if (v == null || isNaN(v)) return null;
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function clamp99(n) { return n > 99 ? '99+' : (n ?? 0); }

// ─── Timezone helpers (same as Task Balance) ──────────────────────────────────
function midnightUTC(tz, y, m, d) {
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(noon);
  const h  = +parts.find(p => p.type === 'hour').value;
  const mi = +parts.find(p => p.type === 'minute').value;
  const s  = +parts.find(p => p.type === 'second').value;
  return new Date(noon.getTime() - (h * 3600 + mi * 60 + s) * 1000);
}

function localToUTC(dtLocalStr, tz) {
  if (!dtLocalStr) return null;
  const [datePart, timePart = '00:00'] = dtLocalStr.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min]  = timePart.split(':').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(noon);
  const oh = +parts.find(p => p.type === 'hour').value;
  const om = +parts.find(p => p.type === 'minute').value;
  const os = +parts.find(p => p.type === 'second').value;
  const offsetMs = ((oh - 12) * 3600 + om * 60 + os) * 1000;
  return new Date(Date.UTC(y, m - 1, d, h, min, 0) - offsetMs);
}

function utcToLocalInput(date, tz) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).forEach(p => { if (p.type !== 'literal') parts[p.type] = p.value; });
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// ─── Presets (same as Task Balance) ──────────────────────────────────────────
const PRESETS = [
  { key: 'all',        label: 'All' },
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'last_week',  label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year',  label: 'This Year' },
];

function computePreset(key, tz) {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const [y, m, d] = todayStr.split('-').map(Number);
  const mid   = (cy, cm, cd) => midnightUTC(tz, cy, cm, cd);
  const endOf = (cy, cm, cd) => new Date(midnightUTC(tz, cy, cm, cd + 1).getTime() - 1);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const daysFromMon = (dow + 6) % 7;

  switch (key) {
    case 'today':      return { from: mid(y, m, d),             to: endOf(y, m, d) };
    case 'yesterday':  return { from: mid(y, m, d - 1),         to: endOf(y, m, d - 1) };
    case 'this_week': {
      const monUTC = new Date(Date.UTC(y, m - 1, d - daysFromMon));
      const [my, mm, md] = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(monUTC).split('-').map(Number);
      return { from: mid(my, mm, md), to: endOf(y, m, d) };
    }
    case 'last_week': {
      const lMon = new Date(Date.UTC(y, m - 1, d - daysFromMon - 7));
      const lSun = new Date(Date.UTC(y, m - 1, d - daysFromMon - 1));
      const lm = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(lMon).split('-').map(Number);
      const ls = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(lSun).split('-').map(Number);
      return { from: mid(...lm), to: endOf(...ls) };
    }
    case 'this_month': return { from: mid(y, m, 1),   to: endOf(y, m, d) };
    case 'last_month': {
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      const pmd = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
      return { from: mid(py, pm, 1), to: endOf(py, pm, pmd) };
    }
    case 'this_year': return { from: mid(y, 1, 1), to: endOf(y, m, d) };
    case 'all':       return null;
    default: return null;
  }
}

// ─── TzPicker (same as Task Balance) ─────────────────────────────────────────
const ALL_TZ = (() => {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return []; }
})();

function TzPicker({ value, onChange }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = search
    ? ALL_TZ.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    : ALL_TZ;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
          background: open ? 'rgba(74,222,128,0.12)' : 'rgba(0,0,0,0.35)',
          border: `1px solid ${open ? 'rgba(74,222,128,0.4)' : 'rgba(74,222,128,0.2)'}`,
          color: '#86efac', maxWidth: 180, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
        title={value}
      >
        <Clock size={11} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
          background: '#071510', border: '1px solid rgba(74,222,128,0.3)',
          borderRadius: 10, width: 270, maxHeight: 300,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
        }}>
          <input
            autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search timezone…"
            style={{
              padding: '7px 10px', fontSize: 12, borderRadius: '10px 10px 0 0',
              background: 'rgba(74,222,128,0.06)', border: 'none',
              borderBottom: '1px solid rgba(74,222,128,0.15)',
              color: '#bbf7d0', outline: 'none', flexShrink: 0,
            }}
          />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.slice(0, 300).map(tz => (
              <button
                key={tz}
                onClick={() => { onChange(tz); setOpen(false); setSearch(''); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 12,
                  background: tz === value ? 'rgba(74,222,128,0.15)' : 'transparent',
                  color: tz === value ? '#4ade80' : 'rgba(200,255,220,0.75)',
                }}
                onMouseEnter={e => { if (tz !== value) e.currentTarget.style.background = 'rgba(74,222,128,0.07)'; }}
                onMouseLeave={e => { if (tz !== value) e.currentTarget.style.background = 'transparent'; }}
              >{tz}</button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '12px', color: 'rgba(134,239,172,0.4)', fontSize: 12, textAlign: 'center' }}>
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Date filter bar ─────────────────────────────────────────────────────────
const inputStyle = {
  padding: '4px 8px', borderRadius: 7, fontSize: 11,
  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)',
  color: '#bbf7d0', outline: 'none',
};

function DateFilterBar({ tz, onTzChange, fromDT, toDT, onFromDT, onToDT, activePreset, onPreset, onApply, onClear }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <TzPicker value={tz} onChange={onTzChange} />

      {/* Preset buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {PRESETS.map(p => {
          const active = activePreset === p.key;
          return (
            <button key={p.key} onClick={() => onPreset(p.key)} style={{
              padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: active ? 'rgba(74,222,128,0.17)' : 'transparent',
              border: `1px solid ${active ? 'rgba(74,222,128,0.45)' : 'rgba(74,222,128,0.12)'}`,
              color:  active ? '#4ade80' : 'rgba(134,239,172,0.5)',
              transition: 'all 0.12s',
            }}>{p.label}</button>
          );
        })}
      </div>

      {/* Custom range inputs */}
      <input type="datetime-local" value={fromDT} onChange={e => onFromDT(e.target.value)} style={inputStyle} />
      <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 11 }}>–</span>
      <input type="datetime-local" value={toDT}   onChange={e => onToDT(e.target.value)}   style={inputStyle} />

      <button onClick={onApply} style={{
        padding: '4px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
        background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.3)',
        color: '#4ade80', fontWeight: 600,
      }}>Filter</button>

      {(fromDT || toDT || (activePreset && activePreset !== 'all')) && (
        <button onClick={onClear} style={{
          padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
          background: 'transparent', border: '1px solid rgba(74,222,128,0.15)',
          color: 'rgba(134,239,172,0.5)',
        }}>Clear</button>
      )}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function computeLayout(user) {
  const pos = {};
  let cx = PAD_H;
  const accs = user.accounts || [];

  accs.forEach((acc, ai) => {
    const jobs = acc.jobs || [];
    const accW = jobs.length === 0 ? EMPTY_W : jobs.length * UNIT_W + (jobs.length - 1) * JOB_GAP;
    pos[`a:${acc.id}`] = { x: cx + accW / 2, y: LY.account };
    jobs.forEach((job, ji) => {
      pos[`j:${job.id}`] = { x: cx + UNIT_W / 2 + ji * (UNIT_W + JOB_GAP), y: LY.job };
    });
    cx += accW;
    if (ai < accs.length - 1) cx += ACC_GAP;
  });

  cx += PAD_H;
  const width = Math.max(cx, NR.user * 2 + PAD_H * 2);
  pos[`u:${user.id}`] = { x: width / 2, y: LY.user };
  return { pos, width };
}

function vcurve(x1, y1, x2, y2) {
  const my = (y1 + y2) / 2;
  return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
}

// ─── Popover helpers ──────────────────────────────────────────────────────────
function StatRow({ label, count, cost, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <span style={{ color: 'rgba(134,239,172,0.5)', fontSize: 10 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color, fontWeight: 700, fontSize: 12 }}>{count ?? 0}</span>
        {fmtMoney(cost) && <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: 10 }}>{fmtMoney(cost)}</span>}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(74,222,128,0.08)', margin: '7px 0' }} />;
}

function PopoverContent({ type, data }) {
  if (type === 'user') {
    return (
      <>
        <div style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 12, marginBottom: 2 }}>
          {data.displayName || data.username}
          <span style={{ color: 'rgba(134,239,172,0.4)', fontWeight: 400, fontSize: 10, marginLeft: 5 }}>@{data.username}</span>
        </div>
        <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          {(data.accounts || []).length} accounts
        </div>
        <StatRow label="Submitted" count={data.totals?.submitted?.count} cost={data.totals?.submitted?.cost} color={C.submitted.text} />
        <StatRow label="Approved"  count={data.totals?.approved?.count}  cost={data.totals?.approved?.cost}  color={C.approved.text}  />
        <StatRow label="Rejected"  count={data.totals?.rejected?.count}  cost={data.totals?.rejected?.cost}  color={C.rejected.text}  />
        {(data.accounts || []).length > 0 && (
          <>
            <Divider />
            <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Per Account</div>
            {(data.accounts || []).map(acc => (
              <div key={acc.id} style={{ marginBottom: 5 }}>
                <div style={{ color: '#93c5fd', fontSize: 10, fontWeight: 600, marginBottom: 2 }}>{acc.name}</div>
                <StatRow label="Submitted" count={acc.totals?.submitted?.count} cost={acc.totals?.submitted?.cost} color={C.submitted.text} />
                <StatRow label="Approved"  count={acc.totals?.approved?.count}  cost={acc.totals?.approved?.cost}  color={C.approved.text}  />
                <StatRow label="Rejected"  count={acc.totals?.rejected?.count}  cost={acc.totals?.rejected?.cost}  color={C.rejected.text}  />
              </div>
            ))}
          </>
        )}
      </>
    );
  }
  if (type === 'account') {
    return (
      <>
        <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{data.name}</div>
        <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          {(data.jobs || []).length} jobs
        </div>
        <StatRow label="Submitted" count={data.totals?.submitted?.count} cost={data.totals?.submitted?.cost} color={C.submitted.text} />
        <StatRow label="Approved"  count={data.totals?.approved?.count}  cost={data.totals?.approved?.cost}  color={C.approved.text}  />
        <StatRow label="Rejected"  count={data.totals?.rejected?.count}  cost={data.totals?.rejected?.cost}  color={C.rejected.text}  />
        {(data.jobs || []).filter(j =>
          (j.stats?.submitted?.count || 0) + (j.stats?.approved?.count || 0) + (j.stats?.rejected?.count || 0) > 0
        ).length > 0 && (
          <>
            <Divider />
            <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Per Job</div>
            {(data.jobs || [])
              .filter(j => (j.stats?.submitted?.count || 0) + (j.stats?.approved?.count || 0) + (j.stats?.rejected?.count || 0) > 0)
              .map(j => (
                <div key={j.id} style={{ marginBottom: 5 }}>
                  <div style={{ color: '#c4b5fd', fontSize: 10, fontWeight: 600, marginBottom: 2 }}>{j.jobName}</div>
                  <StatRow label="Submitted" count={j.stats?.submitted?.count} cost={j.stats?.submitted?.cost} color={C.submitted.text} />
                  <StatRow label="Approved"  count={j.stats?.approved?.count}  cost={j.stats?.approved?.cost}  color={C.approved.text}  />
                  <StatRow label="Rejected"  count={j.stats?.rejected?.count}  cost={j.stats?.rejected?.cost}  color={C.rejected.text}  />
                </div>
              ))
            }
          </>
        )}
      </>
    );
  }
  if (type === 'job') {
    const { job, stats, accountName } = data;
    const s  = stats?.submitted?.count || 0;
    const a  = stats?.approved?.count  || 0;
    const r  = stats?.rejected?.count  || 0;
    const ap = s > 0 ? Math.round((a / s) * 100) : 0;
    const rp = s > 0 ? Math.round((r / s) * 100) : 0;
    return (
      <>
        <div style={{ color: '#c4b5fd', fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{job?.jobName}</div>
        {accountName && <div style={{ color: 'rgba(96,165,250,0.7)', fontSize: 9, marginBottom: 3 }}>Account: {accountName}</div>}
        {(job?.hourlyRate || job?.jobMaxPayableTime) && (
          <div style={{ color: 'rgba(134,239,172,0.4)', fontSize: 9, marginBottom: 6 }}>
            {job.hourlyRate ? `$${job.hourlyRate}/hr` : ''}
            {job.jobMaxPayableTime ? ` · ${job.jobMaxPayableTime}hr/task` : ''}
            {job.hourlyRate && job.jobMaxPayableTime ? ` · ${fmtMoney(job.hourlyRate * job.jobMaxPayableTime)}/task` : ''}
          </div>
        )}
        <StatRow label="Submitted" count={s} cost={stats?.submitted?.cost} color={C.submitted.text} />
        <StatRow label="Approved"  count={a} cost={stats?.approved?.cost}  color={C.approved.text}  />
        <StatRow label="Rejected"  count={r} cost={stats?.rejected?.cost}  color={C.rejected.text}  />
        {s > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: `${ap}%`, background: '#4ade80' }} />
              <div style={{ width: `${rp}%`, background: '#f87171' }} />
            </div>
            <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, marginTop: 3 }}>{ap}% approved</div>
          </div>
        )}
      </>
    );
  }
  if (type === 'mini') {
    const col = C[data.sumType];
    return (
      <>
        <div style={{ color: col.text, fontWeight: 700, fontSize: 12, textTransform: 'capitalize', marginBottom: 5 }}>{data.sumType}</div>
        <StatRow label="Tasks" count={data.stats?.count} cost={data.stats?.cost} color={col.text} />
        {data.accountName && <div style={{ color: 'rgba(96,165,250,0.7)', fontSize: 9, marginTop: 4 }}>Account: {data.accountName}</div>}
        {data.job && <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, marginTop: 2 }}>Job: {data.job.jobName}</div>}
      </>
    );
  }
  return null;
}

// ─── Node circle ──────────────────────────────────────────────────────────────
function NodeCircle({ x, y, r, col, hovered, children, onMouseEnter, onMouseLeave }) {
  if (x == null || y == null) return null;
  return (
    <g style={{ cursor: 'pointer' }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {hovered && <circle cx={x} cy={y} r={r + 6} fill="none" stroke={col.glow || col.ring} strokeWidth={1} opacity={0.5} />}
      <foreignObject x={x - r} y={y - r} width={r * 2} height={r * 2} style={{ overflow: 'visible' }}>
        <div style={{
          width: r * 2, height: r * 2, borderRadius: '50%',
          background: col.bg, border: `2px solid ${col.ring}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          boxShadow: hovered ? `0 0 14px ${col.glow || col.ring}` : '0 2px 6px rgba(0,0,0,0.45)',
          transform: hovered ? 'scale(1.12)' : 'scale(1)', transformOrigin: 'center',
          transition: 'box-shadow 0.14s',
        }}>
          {children}
        </div>
      </foreignObject>
    </g>
  );
}

function hasTaskData(job) {
  const s = job.stats || {};
  return (s.submitted?.count || 0) + (s.approved?.count || 0) + (s.rejected?.count || 0) > 0;
}

// ─── User tree ────────────────────────────────────────────────────────────────
function UserTree({ user }) {
  const [hovered, setHovered] = useState(null);

  const filteredUser = {
    ...user,
    accounts: (user.accounts || []).map(acc => ({ ...acc, jobs: (acc.jobs || []).filter(hasTaskData) })),
  };

  const { pos, width } = computeLayout(filteredUser);
  const uPos = pos[`u:${filteredUser.id}`];
  const accs = filteredUser.accounts;

  const edges = [];
  accs.forEach(acc => {
    const aPos = pos[`a:${acc.id}`];
    if (!aPos || !uPos) return;
    edges.push({ key: `eu:${acc.id}`, d: vcurve(uPos.x, LY.user + NR.user, aPos.x, LY.account - NR.account), stroke: C.account.edge, w: 1.8 });
    (acc.jobs || []).forEach(job => {
      const jPos = pos[`j:${job.id}`];
      if (!jPos) return;
      edges.push({ key: `ea:${job.id}:${acc.id}`, d: vcurve(aPos.x, LY.account + NR.account, jPos.x, LY.job - NR.job), stroke: C.job.edge, w: 1.5 });
    });
  });

  const hover   = (key, type, data, x, y) => () => setHovered({ key, type, data, x, y });
  const unhover = () => setHovered(null);

  const POP_W = 240;
  const popStyle = hovered ? (() => {
    const rightX = hovered.x + 34 + 10;
    const left = rightX + POP_W > width ? hovered.x - 34 - 10 - POP_W : rightX;
    const top  = Math.max(0, Math.min(hovered.y - 60, TREE_H - 220));
    return { left, top };
  })() : {};

  return (
    <div style={{ position: 'relative', width, height: TREE_H, flexShrink: 0 }}>
      <svg width={width} height={TREE_H} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {edges.map(e => (
          <path key={e.key} d={e.d} fill="none" stroke={e.stroke} strokeWidth={e.w} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
        ))}

        {uPos && (
          <NodeCircle x={uPos.x} y={uPos.y} r={NR.user} col={C.user}
            hovered={hovered?.key === `u:${filteredUser.id}`}
            onMouseEnter={hover(`u:${filteredUser.id}`, 'user', filteredUser, uPos.x, uPos.y)}
            onMouseLeave={unhover}
          >
            {filteredUser.avatarUrl
              ? <img src={filteredUser.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : <span style={{ color: C.user.text, fontWeight: 800, fontSize: 14, userSelect: 'none' }}>
                  {(filteredUser.displayName || filteredUser.username || '?').slice(0, 2).toUpperCase()}
                </span>
            }
          </NodeCircle>
        )}

        {accs.map(acc => {
          const aPos = pos[`a:${acc.id}`];
          if (!aPos) return null;
          return (
            <NodeCircle key={`a:${acc.id}`} x={aPos.x} y={aPos.y} r={NR.account} col={C.account}
              hovered={hovered?.key === `a:${acc.id}`}
              onMouseEnter={hover(`a:${acc.id}`, 'account', acc, aPos.x, aPos.y)}
              onMouseLeave={unhover}
            >
              <Shield size={13} style={{ color: C.account.text }} />
            </NodeCircle>
          );
        })}

        {accs.flatMap(acc =>
          (acc.jobs || []).map(job => {
            const jPos = pos[`j:${job.id}`];
            if (!jPos) return null;
            return (
              <NodeCircle key={`j:${job.id}`} x={jPos.x} y={jPos.y} r={NR.job} col={C.job}
                hovered={hovered?.key === `j:${job.id}`}
                onMouseEnter={hover(`j:${job.id}`, 'job', { job, stats: job.stats, accountName: acc.name }, jPos.x, jPos.y)}
                onMouseLeave={unhover}
              >
                <Briefcase size={11} style={{ color: C.job.text }} />
              </NodeCircle>
            );
          })
        )}

        {accs.flatMap(acc =>
          (acc.jobs || []).flatMap(job => {
            const jPos = pos[`j:${job.id}`];
            if (!jPos) return [];
            const activeTypes = SUM_TYPES.filter(t => (job.stats?.[t]?.count || 0) > 0);
            const offsets = miniOffsets(activeTypes.length);
            return activeTypes.map((type, ti) => {
              const stats = job.stats?.[type] || { count: 0, cost: null };
              const col   = C[type];
              const mx    = jPos.x + offsets[ti];
              const my    = LY.mini;
              const key   = `m:${job.id}:${acc.id}:${type}`;
              const isHov = hovered?.key === key;
              return (
                <g key={key} style={{ cursor: 'pointer' }}
                  onMouseEnter={hover(key, 'mini', { sumType: type, stats, job, accountName: acc.name }, mx, my)}
                  onMouseLeave={unhover}
                >
                  {isHov && <circle cx={mx} cy={my} r={MINI_R + 5} fill="none" stroke={col.ring} strokeWidth={1} opacity={0.4} />}
                  <circle cx={mx} cy={my} r={MINI_R} fill={col.bg} stroke={col.ring} strokeWidth={isHov ? 2 : 1.5} />
                  <foreignObject x={mx - MINI_R} y={my - MINI_R} width={MINI_R * 2} height={MINI_R * 2}>
                    <div style={{ width: MINI_R * 2, height: MINI_R * 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: col.text, fontWeight: 800, fontSize: 9, lineHeight: 1, userSelect: 'none' }}>
                        {clamp99(stats.count)}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              );
            });
          })
        )}
      </svg>

      {/* HTML labels */}
      {uPos && (
        <div style={{ position: 'absolute', left: uPos.x, top: LY.user + NR.user + 6, transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 3, width: 90 }}>
          <div style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 10, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {filteredUser.displayName || filteredUser.username}
          </div>
          <div style={{ color: 'rgba(134,239,172,0.4)', fontSize: 9, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            @{filteredUser.username}
          </div>
        </div>
      )}

      {accs.map(acc => {
        const aPos = pos[`a:${acc.id}`];
        if (!aPos) return null;
        const accW = (acc.jobs || []).length === 0 ? EMPTY_W : (acc.jobs || []).length * UNIT_W + ((acc.jobs || []).length - 1) * JOB_GAP;
        return (
          <div key={`lbl-a:${acc.id}`} style={{ position: 'absolute', left: aPos.x, top: LY.account + NR.account + 5, transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 3, width: Math.min(accW, 120) }}>
            <div style={{ color: '#93c5fd', fontSize: 9, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
          </div>
        );
      })}

      {accs.flatMap(acc =>
        (acc.jobs || []).map(job => {
          const jPos = pos[`j:${job.id}`];
          if (!jPos) return null;
          return (
            <div key={`lbl-j:${job.id}:${acc.id}`} style={{ position: 'absolute', left: jPos.x, top: LY.job + NR.job + 4, transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 3, width: UNIT_W }}>
              <div style={{ color: '#c4b5fd', fontSize: 8, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.jobName}</div>
            </div>
          );
        })
      )}

      {hovered && (
        <div style={{
          position: 'absolute', left: popStyle.left, top: popStyle.top, width: POP_W,
          background: 'rgba(2,11,5,0.97)', border: '1px solid rgba(74,222,128,0.18)',
          borderRadius: 12, padding: '11px 13px', zIndex: 200, pointerEvents: 'none',
          boxShadow: '0 8px 30px rgba(0,0,0,0.75), 0 0 0 1px rgba(74,222,128,0.06)',
          backdropFilter: 'blur(10px)', animation: 'treePopIn 0.11s ease',
        }}>
          <PopoverContent type={hovered.type} data={hovered.data} />
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ReveloTreeDashboard() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [tz, setTz] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
  });
  const [fromDT,       setFromDT]       = useState('');
  const [toDT,         setToDT]         = useState('');
  const [activePreset, setActivePreset] = useState('all');

  // Current UTC range used for the query
  const [queryRange, setQueryRange] = useState({ from: null, to: null });

  const load = useCallback((from, to) => {
    setLoading(true); setError('');
    getTreeDashboard({
      from: from instanceof Date ? from.toISOString() : (from || null),
      to:   to   instanceof Date ? to.toISOString()   : (to   || null),
    })
      .then(r => { if (r.success) setUsers(r.users); else setError(r.message); })
      .catch(e => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(queryRange.from, queryRange.to); }, [load, queryRange]);

  const applyPreset = (key) => {
    setActivePreset(key);
    if (key === 'all') {
      setFromDT(''); setToDT('');
      setQueryRange({ from: null, to: null });
      return;
    }
    const range = computePreset(key, tz);
    if (!range) return;
    setFromDT(utcToLocalInput(range.from, tz));
    setToDT(utcToLocalInput(range.to, tz));
    setQueryRange({ from: range.from, to: range.to });
  };

  const handleApply = () => {
    setActivePreset(null);
    setQueryRange({
      from: fromDT ? localToUTC(fromDT, tz) : null,
      to:   toDT   ? localToUTC(toDT,   tz) : null,
    });
  };

  const handleClear = () => {
    setFromDT(''); setToDT(''); setActivePreset('all');
    setQueryRange({ from: null, to: null });
  };

  const handleTzChange = (newTz) => {
    setTz(newTz);
    if (activePreset && activePreset !== 'all') {
      const range = computePreset(activePreset, newTz);
      if (range) {
        setFromDT(utcToLocalInput(range.from, newTz));
        setToDT(utcToLocalInput(range.to, newTz));
        setQueryRange({ from: range.from, to: range.to });
      }
    }
  };

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-6">
      <style>{`
        @keyframes treePopIn {
          from { opacity: 0; transform: scale(0.93) translateY(-3px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>

      <DateFilterBar
        tz={tz} onTzChange={handleTzChange}
        fromDT={fromDT} toDT={toDT}
        onFromDT={setFromDT} onToDT={setToDT}
        activePreset={activePreset}
        onPreset={applyPreset}
        onApply={handleApply}
        onClear={handleClear}
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Loader size={26} className="animate-spin" style={{ color: '#4ade80' }} />
        </div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <AlertCircle size={15} style={{ color: '#f87171' }} />
          <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(134,239,172,0.35)', fontSize: 13 }}>
          No members yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {users.map((u, i) => (
            <div key={u.id}>
              {i > 0 && <div style={{ height: 1, background: 'rgba(74,222,128,0.07)', margin: '8px 0 16px' }} />}
              <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 8, display: 'flex', justifyContent: 'center' }}>
                <UserTree user={u} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
