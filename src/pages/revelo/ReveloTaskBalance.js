import { useEffect, useState, useCallback, useRef } from 'react';
import {
  listAccounts, listJobsByAccount,
  addTaskBalanceEntry, listTaskBalanceEntries, updateTaskBalanceEntry, deleteTaskBalanceEntry,
} from '../../api/reveloApi';
import {
  ChevronRight, Loader, AlertCircle, Plus, Trash2, Pencil, Check, X,
  BarChart2, CheckCircle, XCircle, Send, Clock,
} from 'lucide-react';

// ─── timezone helpers ─────────────────────────────────────────────────────────

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

function fmtMoney(amount) {
  if (amount == null || isNaN(amount)) return null;
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDT(dateStr, tz = 'UTC') {
  const d = new Date(dateStr);
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).forEach(p => { if (p.type !== 'literal') parts[p.type] = p.value; });
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

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

// ─── TzPicker ─────────────────────────────────────────────────────────────────
const ALL_TZ = (() => {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return []; }
})();

function TzPicker({ value, onChange }) {
  const [open, setOpen]     = useState(false);
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
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
          background: '#071510', border: '1px solid rgba(74,222,128,0.3)',
          borderRadius: 10, width: 270, maxHeight: 300,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
        }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
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
              >
                {tz}
              </button>
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

// ─── other helpers ────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  submitted: {
    label: 'Submitted', sign: +1,
    color: '#fb923c', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)',
    icon: Send,
  },
  approved: {
    label: 'Approved', sign: -1,
    color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected', sign: -1,
    color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)',
    icon: XCircle,
  },
};

function TypeBadge({ type }) {
  const c = TYPE_CONFIG[type];
  if (!c) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
    }}>
      <c.icon size={10} /> {c.label}
    </span>
  );
}

// ─── Sidebar item ─────────────────────────────────────────────────────────────
function SidebarItem({ label, sub, count, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '9px 12px',
        borderRadius: 8, border: 'none', cursor: 'pointer',
        background: selected ? 'rgba(74,222,128,0.15)' : 'transparent',
        outline: selected ? '1px solid rgba(74,222,128,0.4)' : '1px solid transparent',
        transition: 'all 0.12s',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(74,222,128,0.07)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          color: selected ? '#4ade80' : 'rgba(200,255,220,0.8)',
          fontSize: 13, fontWeight: selected ? 600 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</div>
        {sub && (
          <div style={{ color: 'rgba(134,239,172,0.4)', fontSize: 11, marginTop: 1 }}>{sub}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {count !== undefined && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: '50%',
            background: selected ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.08)',
            border: `1px solid ${selected ? 'rgba(74,222,128,0.5)' : 'rgba(74,222,128,0.2)'}`,
          }}>
            <span style={{ color: selected ? '#4ade80' : 'rgba(134,239,172,0.7)', fontWeight: 700, fontSize: 12, lineHeight: 1 }}>
              {count}
            </span>
          </div>
        )}
        {selected && <ChevronRight size={14} style={{ color: '#4ade80' }} />}
      </div>
    </button>
  );
}

// ─── Add entry inline form ────────────────────────────────────────────────────
function AddEntryForm({ type, jobId, accountId, defaultCostPerTask, onAdded, onCancel }) {
  const c = TYPE_CONFIG[type];
  const [count, setCount] = useState('');
  const [cost,  setCost]  = useState('');
  const [note,  setNote]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const costPlaceholder = defaultCostPerTask != null
    ? `Cost (default: ${fmtMoney(defaultCostPerTask)})`
    : 'Cost (optional)';

  const handleSave = async () => {
    const n = parseInt(count, 10);
    if (!n || n < 1) { setError('Enter a valid number (≥ 1)'); return; }
    setSaving(true); setError('');
    try {
      const res = await addTaskBalanceEntry({
        accountId, jobId, type, count: n,
        cost: cost !== '' ? Number(cost) : null,
        note,
      });
      if (res.success) onAdded(res.entry);
      else setError(res.message || 'Failed');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: c.bg, border: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ color: c.color, fontSize: 12, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 6 }}>
        <c.icon size={13} /> Add {c.label}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="number" min="1" placeholder="Count"
          value={count} onChange={e => setCount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          autoFocus
          style={{
            width: 80, padding: '5px 8px', borderRadius: 7, fontSize: 13,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)',
            color: '#bbf7d0', outline: 'none',
          }}
        />
        <input
          type="number" min="0" step="0.01" placeholder={costPlaceholder}
          value={cost} onChange={e => setCost(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          style={{
            width: 180, padding: '5px 8px', borderRadius: 7, fontSize: 13,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251,191,36,0.25)',
            color: '#fbbf24', outline: 'none',
          }}
        />
        <input
          type="text" placeholder="Note (optional)"
          value={note} onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          style={{
            flex: 1, minWidth: 100, padding: '5px 8px', borderRadius: 7, fontSize: 13,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)',
            color: '#bbf7d0', outline: 'none',
          }}
        />
        <button onClick={handleSave} disabled={saving}
          style={{
            padding: '5px 12px', borderRadius: 7, border: `1px solid ${c.border}`,
            background: c.bg, color: c.color, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            opacity: saving ? 0.6 : 1,
          }}>
          {saving ? '…' : 'Add'}
        </button>
        <button onClick={onCancel}
          style={{
            padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(74,222,128,0.15)',
            background: 'transparent', color: 'rgba(134,239,172,0.5)', cursor: 'pointer', fontSize: 12,
          }}>
          ✕
        </button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}
    </div>
  );
}

// ─── Edit entry inline row ────────────────────────────────────────────────────
function EditEntryRow({ entry, defaultCostPerTask, onSaved, onCancel }) {
  const c = TYPE_CONFIG[entry.type];
  const [count, setCount] = useState(String(entry.count));
  const [cost,  setCost]  = useState(entry.cost != null ? String(entry.cost) : '');
  const [note,  setNote]  = useState(entry.note || '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const costPlaceholder = defaultCostPerTask != null
    ? `Cost (default: ${fmtMoney(defaultCostPerTask)})`
    : 'Cost (optional)';

  const handleSave = async () => {
    const n = parseInt(count, 10);
    if (!n || n < 1) { setError('Count must be ≥ 1'); return; }
    setSaving(true); setError('');
    try {
      const res = await updateTaskBalanceEntry({
        id: entry.id || entry._id,
        count: n,
        cost: cost !== '' ? Number(cost) : null,
        note,
      });
      if (res.success) onSaved(res.entry);
      else setError(res.message || 'Failed');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(0,0,0,0.35)', border: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ color: c.color, fontSize: 11, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 5 }}>
        <c.icon size={12} /> Edit {c.label}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="number" min="1" value={count} onChange={e => setCount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          style={{
            width: 80, padding: '5px 8px', borderRadius: 7, fontSize: 13,
            background: 'rgba(0,0,0,0.4)', border: `1px solid ${c.border}`,
            color: c.color, outline: 'none',
          }}
        />
        <input
          type="number" min="0" step="0.01" placeholder={costPlaceholder}
          value={cost} onChange={e => setCost(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          autoFocus
          style={{
            width: 200, padding: '5px 8px', borderRadius: 7, fontSize: 13,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251,191,36,0.35)',
            color: '#fbbf24', outline: 'none',
          }}
        />
        <input
          type="text" placeholder="Note (optional)"
          value={note} onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          style={{
            flex: 1, minWidth: 100, padding: '5px 8px', borderRadius: 7, fontSize: 13,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)',
            color: '#bbf7d0', outline: 'none',
          }}
        />
        <button onClick={handleSave} disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 11px', borderRadius: 7, border: `1px solid ${c.border}`,
            background: c.bg, color: c.color, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            opacity: saving ? 0.6 : 1,
          }}>
          <Check size={12} /> {saving ? '…' : 'Save'}
        </button>
        <button onClick={onCancel}
          style={{
            display: 'flex', alignItems: 'center',
            padding: '5px 8px', borderRadius: 7,
            border: '1px solid rgba(74,222,128,0.15)',
            background: 'transparent', color: 'rgba(134,239,172,0.5)',
            cursor: 'pointer', fontSize: 12,
          }}>
          <X size={12} />
        </button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}
    </div>
  );
}

// ─── shared input style ───────────────────────────────────────────────────────
const dtInputStyle = {
  padding: '4px 8px', borderRadius: 7, fontSize: 12,
  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)',
  color: '#bbf7d0', outline: 'none',
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ReveloTaskBalance() {
  const [accounts,   setAccounts]   = useState([]);
  const [jobs,       setJobs]       = useState([]);
  const [entries,    setEntries]    = useState([]);

  const [selAccount, setSelAccount] = useState(null);
  const [selJob,     setSelJob]     = useState(null);

  const [loadingAcc,  setLoadingAcc]  = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingEnt,  setLoadingEnt]  = useState(false);
  const [error,       setError]       = useState('');

  const [addingType, setAddingType] = useState(null);
  const [editingId,  setEditingId]  = useState(null);

  // timezone
  const [tz, setTz] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
  });

  // date-range filter (datetime-local strings, interpreted in `tz`)
  const [fromDT, setFromDT] = useState('');
  const [toDT,   setToDT]   = useState('');
  const [activePreset, setActivePreset] = useState(null);

  // ── load accounts once ────────────────────────────────────────────────────
  useEffect(() => {
    listAccounts()
      .then(r => { if (r.success) setAccounts(r.accounts); })
      .catch(() => {})
      .finally(() => setLoadingAcc(false));
  }, []);

  // ── load jobs when account changes ────────────────────────────────────────
  useEffect(() => {
    if (!selAccount) { setJobs([]); setSelJob(null); setEntries([]); return; }
    setLoadingJobs(true);
    listJobsByAccount(selAccount.id)
      .then(r => { if (r.success) setJobs(r.jobs); })
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
    setSelJob(null);
    setEntries([]);
  }, [selAccount]);

  // ── load entries ──────────────────────────────────────────────────────────
  const loadEntries = useCallback((jobId, fromISO, toISO) => {
    if (!jobId) return;
    setLoadingEnt(true); setError('');
    const payload = { jobId };
    if (fromISO) payload.from = fromISO instanceof Date ? fromISO.toISOString() : fromISO;
    if (toISO)   payload.to   = toISO   instanceof Date ? toISO.toISOString()   : toISO;
    listTaskBalanceEntries(payload)
      .then(r => { if (r.success) setEntries(r.entries); else setError(r.message); })
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoadingEnt(false));
  }, []);

  useEffect(() => {
    if (selJob) loadEntries(selJob.id || selJob._id, '', '');
  }, [selJob, loadEntries]);

  const applyPreset = (key) => {
    setActivePreset(key);
    if (key === 'all') {
      setFromDT(''); setToDT('');
      if (selJob) loadEntries(selJob.id || selJob._id, '', '');
      return;
    }
    const range = computePreset(key, tz);
    if (!range) return;
    setFromDT(utcToLocalInput(range.from, tz));
    setToDT(utcToLocalInput(range.to, tz));
    if (selJob) loadEntries(selJob.id || selJob._id, range.from, range.to);
  };

  const handleFilter = () => {
    setActivePreset(null);
    if (selJob) {
      loadEntries(
        selJob.id || selJob._id,
        fromDT ? localToUTC(fromDT, tz) : '',
        toDT   ? localToUTC(toDT,   tz) : '',
      );
    }
  };

  const handleClear = () => {
    setFromDT(''); setToDT(''); setActivePreset(null);
    if (selJob) loadEntries(selJob.id || selJob._id, '', '');
  };

  const handleAdded = (entry) => {
    setEntries(prev => [entry, ...prev]);
    setAddingType(null);
  };

  const handleDelete = async (entry) => {
    try {
      const res = await deleteTaskBalanceEntry(entry.id || entry._id);
      if (res.success) setEntries(prev => prev.filter(e => (e.id || e._id) !== (entry.id || entry._id)));
    } catch {}
  };

  // ── compute stats ─────────────────────────────────────────────────────────
  const stats = entries.reduce(
    (acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + e.count;
      return acc;
    },
    { submitted: 0, approved: 0, rejected: 0 }
  );
  const balance = stats.submitted - stats.approved - stats.rejected;

  const costPerTask = (selJob?.hourlyRate && selJob?.jobMaxPayableTime)
    ? selJob.hourlyRate * selJob.jobMaxPayableTime
    : null;

  // Total cost per type: sum entry.cost if set, else fallback to count * costPerTask
  const costStats = entries.reduce(
    (acc, e) => {
      const c = e.cost != null ? e.cost : (costPerTask != null ? e.count * costPerTask : null);
      if (c != null) acc[e.type] = (acc[e.type] || 0) + c;
      return acc;
    },
    { submitted: null, approved: null, rejected: null }
  );
  const balanceCost = (costStats.submitted != null || costStats.approved != null || costStats.rejected != null)
    ? (costStats.submitted || 0) - (costStats.approved || 0) - (costStats.rejected || 0)
    : null;

  const panelStyle = {
    background: 'rgba(3,18,9,0.65)',
    border: '1px solid rgba(74,222,128,0.12)',
    borderRadius: 12,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  };
  const panelHead = {
    padding: '10px 14px',
    borderBottom: '1px solid rgba(74,222,128,0.1)',
    color: 'rgba(134,239,172,0.6)', fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
  };

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-6"
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BarChart2 size={20} style={{ color: '#4ade80' }} />
        <h1 style={{ color: '#4ade80', fontWeight: 700, fontSize: 20, margin: 0 }}>
          Task Balance
        </h1>
      </div>

      {/* Three-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 200px 1fr', gap: 12, alignItems: 'start' }}>

        {/* ── Accounts ── */}
        <div style={{ ...panelStyle, alignSelf: 'start' }}>
          <div style={panelHead}>Accounts</div>
          <div style={{ padding: 8 }}>
            {loadingAcc ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
                <Loader size={18} className="animate-spin" style={{ color: '#4ade80' }} />
              </div>
            ) : accounts.length === 0 ? (
              <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>
                No accounts
              </div>
            ) : (
              accounts.map(acc => (
                <SidebarItem
                  key={acc.id || acc._id}
                  label={acc.username || acc.name || 'Account'}
                  sub={acc.platform}
                  count={acc.jobCount ?? 0}
                  selected={(selAccount?.id || selAccount?._id) === (acc.id || acc._id)}
                  onClick={() => setSelAccount(acc)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Jobs ── */}
        <div style={{ ...panelStyle, alignSelf: 'start' }}>
          <div style={panelHead}>Jobs</div>
          <div style={{ padding: 8 }}>
            {!selAccount ? (
              <div style={{ color: 'rgba(134,239,172,0.25)', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>
                Select an account
              </div>
            ) : loadingJobs ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
                <Loader size={18} className="animate-spin" style={{ color: '#4ade80' }} />
              </div>
            ) : jobs.length === 0 ? (
              <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>
                No jobs
              </div>
            ) : (
              jobs.map(job => (
                <SidebarItem
                  key={job.id || job._id}
                  label={job.jobName || 'Job'}
                  sub={job.status}
                  count={job.submittedCount ?? 0}
                  selected={(selJob?.id || selJob?._id) === (job.id || job._id)}
                  onClick={() => { setSelJob(job); setAddingType(null); }}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Task entries ── */}
        <div style={panelStyle}>
          {!selJob ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: 'rgba(134,239,172,0.25)', fontSize: 13 }}>
                Select a job to view task balance
              </div>
            </div>
          ) : (
            <>
              {/* Stats cards */}
              <div style={{
                padding: '14px 16px', borderBottom: '1px solid rgba(74,222,128,0.1)',
                display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
              }}>
                {/* job title + rate info */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'rgba(200,255,220,0.75)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {selJob.jobName || selJob.title || selJob.name}
                  </div>
                  {selJob.hourlyRate && (
                    <span style={{ fontSize: 11, color: 'rgba(134,239,172,0.45)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {fmtMoney(selJob.hourlyRate)}/hr
                      {selJob.jobMaxPayableTime ? ` · ${selJob.jobMaxPayableTime}hr · ` : ''}
                      {costPerTask ? <span style={{ color: '#fbbf24', fontWeight: 600 }}>{fmtMoney(costPerTask)}/task</span> : null}
                    </span>
                  )}
                </div>
                {/* 4 stat cards in a row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    ...['submitted','approved','rejected'].map(t => ({
                      key: t,
                      color:  TYPE_CONFIG[t].color,
                      bg:     TYPE_CONFIG[t].bg,
                      border: TYPE_CONFIG[t].border,
                      icon:   TYPE_CONFIG[t].icon,
                      label:  TYPE_CONFIG[t].label,
                      value:  stats[t],
                      prefix: '',
                    })),
                    {
                      key:    'pending',
                      color:  '#60a5fa',
                      bg:     'rgba(96,165,250,0.1)',
                      border: 'rgba(96,165,250,0.35)',
                      icon:   BarChart2,
                      label:  'Pending',
                      value:  Math.abs(balance),
                      prefix: balance >= 0 ? '+' : '-',
                    },
                  ].map(({ key, color, bg, border, icon: Icon, label, value, prefix }) => {
                    const money = key === 'pending'
                      ? (balanceCost != null ? fmtMoney(Math.abs(balanceCost)) : null)
                      : (costStats[key] != null ? fmtMoney(costStats[key]) : null);
                    return (
                      <div key={key} style={{
                        background: bg, border: `1px solid ${border}`,
                        borderRadius: 12, padding: '12px 10px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      }}>
                        {/* circle icon */}
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: `color-mix(in srgb, ${color} 18%, transparent)`,
                          border: `1.5px solid ${border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icon size={18} style={{ color }} />
                        </div>
                        {/* number */}
                        <div style={{ color, fontWeight: 800, fontSize: 22, lineHeight: 1 }}>
                          {prefix}{value}
                        </div>
                        {/* money */}
                        {money && (
                          <div style={{ color: '#fbbf24', fontSize: 12, fontWeight: 600, lineHeight: 1 }}>
                            {prefix}{money}
                          </div>
                        )}
                        {/* label */}
                        <div style={{ color: 'rgba(134,239,172,0.5)', fontSize: 11,
                          fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Timezone + preset row ── */}
              <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid rgba(74,222,128,0.08)',
                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0,
              }}>
                <TzPicker value={tz} onChange={(newTz) => {
                  setTz(newTz);
                  setFromDT(''); setToDT(''); setActivePreset(null);
                }} />
                <div style={{ width: 1, height: 18, background: 'rgba(74,222,128,0.15)', flexShrink: 0 }} />
                {PRESETS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => applyPreset(p.key)}
                    style={{
                      padding: '4px 11px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                      fontWeight: activePreset === p.key ? 700 : 400,
                      background: activePreset === p.key ? 'rgba(74,222,128,0.18)' : 'transparent',
                      border: `1px solid ${activePreset === p.key ? 'rgba(74,222,128,0.45)' : 'rgba(74,222,128,0.18)'}`,
                      color: activePreset === p.key ? '#4ade80' : 'rgba(134,239,172,0.6)',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { if (activePreset !== p.key) { e.currentTarget.style.background = 'rgba(74,222,128,0.08)'; e.currentTarget.style.color = '#86efac'; } }}
                    onMouseLeave={e => { if (activePreset !== p.key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(134,239,172,0.6)'; } }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* ── Manual date filter + add buttons row ── */}
              <div style={{
                padding: '8px 16px', borderBottom: '1px solid rgba(74,222,128,0.1)',
                display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', flexShrink: 0,
              }}>
                <input type="datetime-local" value={fromDT}
                  onChange={e => { setFromDT(e.target.value); setActivePreset(null); }}
                  style={dtInputStyle} />
                <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 12 }}>→</span>
                <input type="datetime-local" value={toDT}
                  onChange={e => { setToDT(e.target.value); setActivePreset(null); }}
                  style={dtInputStyle} />
                <button onClick={handleFilter}
                  style={{ padding: '4px 12px', borderRadius: 7, fontSize: 12,
                    background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
                    color: '#4ade80', cursor: 'pointer', fontWeight: 600 }}>
                  Filter
                </button>
                <button onClick={handleClear}
                  style={{ padding: '4px 10px', borderRadius: 7, fontSize: 12,
                    background: 'transparent', border: '1px solid rgba(74,222,128,0.15)',
                    color: 'rgba(134,239,172,0.5)', cursor: 'pointer' }}>
                  Clear
                </button>
                <div style={{ flex: 1 }} />
                {(['submitted','approved','rejected']).map(t => {
                  const c = TYPE_CONFIG[t];
                  return (
                    <button key={t} onClick={() => setAddingType(addingType === t ? null : t)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        background: addingType === t ? c.bg : 'transparent',
                        border: `1px solid ${addingType === t ? c.border : 'rgba(74,222,128,0.2)'}`,
                        color: addingType === t ? c.color : 'rgba(134,239,172,0.6)',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}>
                      <Plus size={11} /> {c.label}
                    </button>
                  );
                })}
              </div>

              {/* Inline add form */}
              {addingType && (
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(74,222,128,0.1)', flexShrink: 0 }}>
                  <AddEntryForm
                    type={addingType}
                    jobId={selJob.id || selJob._id}
                    accountId={selAccount.id || selAccount._id}
                    defaultCostPerTask={costPerTask}
                    onAdded={handleAdded}
                    onCancel={() => setAddingType(null)}
                  />
                </div>
              )}

              {/* Entries list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px',
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
                alignContent: 'start' }}>
                {loadingEnt ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
                    <Loader size={20} className="animate-spin" style={{ color: '#4ade80' }} />
                  </div>
                ) : error ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171',
                    padding: '10px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: 8,
                    border: '1px solid rgba(248,113,113,0.2)', fontSize: 13 }}>
                    <AlertCircle size={14} /> {error}
                  </div>
                ) : entries.length === 0 ? (
                  <div style={{ color: 'rgba(134,239,172,0.3)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
                    No entries yet. Use the buttons above to add.
                  </div>
                ) : (
                  entries.map(entry => {
                    const c = TYPE_CONFIG[entry.type];
                    const entryId = entry.id || entry._id;
                    const isEditing = editingId === entryId;

                    if (isEditing) {
                      return (
                        <div key={entryId} style={{ gridColumn: '1 / -1' }}>
                          <EditEntryRow
                            entry={entry}
                            defaultCostPerTask={costPerTask}
                            onSaved={(updated) => {
                              setEntries(prev => prev.map(e => (e.id || e._id) === entryId ? updated : e));
                              setEditingId(null);
                            }}
                            onCancel={() => setEditingId(null)}
                          />
                        </div>
                      );
                    }

                    const isActual = entry.cost != null;
                    const amount   = isActual ? entry.cost : (costPerTask != null ? entry.count * costPerTask : null);

                    return (
                      <div key={entryId} style={{
                        borderRadius: 12,
                        background: c.bg,
                        border: `1px solid ${c.border}`,
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                      }}>
                        {/* card header: type badge */}
                        <div style={{
                          padding: '8px 10px',
                          borderBottom: `1px solid ${c.border}`,
                        }}>
                          <TypeBadge type={entry.type} />
                        </div>

                        {/* card body: count + cost */}
                        <div style={{
                          padding: '12px 12px 8px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1,
                        }}>
                          <span style={{ color: c.color, fontWeight: 800, fontSize: 28, lineHeight: 1 }}>
                            {TYPE_CONFIG[entry.type].sign > 0 ? '+' : '-'}{entry.count}
                          </span>
                          {amount != null && (
                            <span style={{
                              fontSize: 13, fontWeight: 600,
                              borderRadius: 6, padding: '2px 9px',
                              color:      isActual ? '#fbbf24'              : 'rgba(251,191,36,0.5)',
                              background: isActual ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.04)',
                              border:     isActual ? '1px solid rgba(251,191,36,0.3)' : '1px dashed rgba(251,191,36,0.2)',
                            }}
                            title={isActual ? 'Actual cost' : 'Estimated (default)'}>
                              {fmtMoney(amount)}
                            </span>
                          )}
                        </div>

                        {/* card footer: note + date + actions */}
                        <div style={{
                          padding: '6px 10px',
                          borderTop: `1px solid ${c.border}`,
                          display: 'flex', flexDirection: 'column', gap: 4,
                        }}>
                          {entry.note && (
                            <div style={{
                              color: 'rgba(200,255,220,0.5)', fontSize: 11,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {entry.note}
                            </div>
                          )}
                          <div style={{ color: 'rgba(134,239,172,0.3)', fontSize: 10 }}>
                            {fmtDT(entry.createdAt, tz)}
                          </div>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                            <button onClick={() => setEditingId(entryId)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 3,
                                background: 'rgba(134,239,172,0.06)', border: '1px solid rgba(134,239,172,0.15)',
                                cursor: 'pointer', color: 'rgba(134,239,172,0.5)',
                                padding: '3px 8px', borderRadius: 6, fontSize: 11, lineHeight: 1,
                                transition: 'all 0.12s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#86efac'; e.currentTarget.style.borderColor = 'rgba(134,239,172,0.4)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(134,239,172,0.5)'; e.currentTarget.style.borderColor = 'rgba(134,239,172,0.15)'; }}
                              title="Edit">
                              <Pencil size={11} /> Edit
                            </button>
                            <button onClick={() => handleDelete(entry)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 3,
                                background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)',
                                cursor: 'pointer', color: 'rgba(248,113,113,0.5)',
                                padding: '3px 8px', borderRadius: 6, fontSize: 11, lineHeight: 1,
                                transition: 'all 0.12s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(248,113,113,0.5)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.15)'; }}
                              title="Delete">
                              <Trash2 size={11} /> Del
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
