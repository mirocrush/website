import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Briefcase, Shield, Plus, Edit2, Trash2,
  X, Globe, Monitor, CreditCard, Eye, EyeOff, Loader, AlertCircle,
  Unlink, Send, CheckCircle, XCircle, BarChart2, Pencil, Check,
  FolderOpen, Folder, Code2,
} from 'lucide-react';
import {
  listReveloUsers, listAccounts, listAccountsByUsername,
  createAccount, updateAccount, deleteAccount,
  listJobs, listJobsByAccount, setJobAccount,
  addTaskBalanceEntry, listTaskBalanceEntries,
  updateTaskBalanceEntry, deleteTaskBalanceEntry,
} from '../../api/reveloApi';
import { useAuth } from '../../context/AuthContext';
import { JobsDialog } from './ReveloAccounts';

// ─── Constants ────────────────────────────────────────────────────────────────
const PROTOCOLS = ['HTTP', 'HTTPS', 'SOCKS5', 'SSH'];
const ACCOUNT_STATUSES = [
  { key: 'fresh_new',        label: 'Fresh New',        bg: 'rgba(74,222,128,0.15)',  color: '#4ade80',  border: 'rgba(74,222,128,0.35)' },
  { key: 'open_jobs',        label: 'Open Jobs',        bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa',  border: 'rgba(96,165,250,0.35)' },
  { key: 'approved_tasks',   label: 'Approved Tasks',   bg: 'rgba(45,212,191,0.15)',  color: '#2dd4bf',  border: 'rgba(45,212,191,0.35)' },
  { key: 'payment_attached', label: 'Payment Attached', bg: 'rgba(167,139,250,0.15)', color: '#a78bfa',  border: 'rgba(167,139,250,0.35)' },
  { key: 'earned_money',     label: 'Earned Money',     bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24',  border: 'rgba(251,191,36,0.35)' },
  { key: 'suspended',        label: 'Suspended',        bg: 'rgba(248,113,113,0.15)', color: '#f87171',  border: 'rgba(248,113,113,0.35)' },
];
const EMPTY_FORM = {
  name: '', nationality: '', createdDate: '', connectionType: 'proxy',
  proxyHost: '', proxyPort: '', proxyAccount: '', proxyPassword: '', proxyProtocol: 'HTTP',
  remotePcHolder: '', remotePcNationality: '',
  idVerified: false, paymentVerified: false, bankHoldingStatus: '', revenueSharePercentage: '',
  statuses: [],
};
const TYPE_CONFIG = {
  submitted: { label: 'Submitted', sign: +1, color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.35)',  icon: Send },
  approved:  { label: 'Approved',  sign: -1, color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)',  icon: CheckCircle },
  rejected:  { label: 'Rejected',  sign: -1, color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', icon: XCircle },
};
const PRESETS = [
  { key: 'today',      label: 'Today' },      { key: 'yesterday',  label: 'Yesterday' },
  { key: 'this_week',  label: 'This week' },  { key: 'last_week',  label: 'Last week' },
  { key: 'this_month', label: 'This month' }, { key: 'last_month', label: 'Last month' },
  { key: 'this_year',  label: 'This year' },  { key: 'last_year',  label: 'Last year' },
  { key: 'all',        label: 'All' },
];

// ─── Timezone helpers (identical to Task Balance) ─────────────────────────────
function midnightUTC(tz, y, m, d) {
  const noon  = new Date(Date.UTC(y, m - 1, d, 12));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(noon);
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
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(dt);
  const g = (t) => parts.find(p => p.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}
function computePreset(key, tz) {
  const now   = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
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
function fmtDT(iso, tz) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz, month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso));
  } catch { return iso; }
}
function fmtMoney(v) {
  if (v == null || isNaN(v)) return null;
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Shared micro-components ──────────────────────────────────────────────────
const inp = { background: 'rgba(3,18,9,0.6)', borderColor: 'rgba(74,222,128,0.2)', color: '#bbf7d0' };
const dtInputStyle = {
  padding: '4px 8px', borderRadius: 7, fontSize: 12,
  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)',
  color: '#bbf7d0', outline: 'none',
};

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="text-xs font-medium mb-2 flex items-center gap-1.5 pt-3"
      style={{ color: 'rgba(134,239,172,0.6)', borderTop: '1px solid rgba(74,222,128,0.1)' }}>
      {Icon && <Icon size={12} />} {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.5)' }}>{label}</label>
      {children}
    </div>
  );
}
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

// ─── TzPicker ─────────────────────────────────────────────────────────────────
const ALL_TZ = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC'];
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
      <button onClick={() => setOpen(o => !o)} style={{
        padding: '3px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
        background: open ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.07)',
        border: '1px solid rgba(74,222,128,0.25)', color: '#86efac',
        maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
          background: '#071510', border: '1px solid rgba(74,222,128,0.3)',
          borderRadius: 10, width: 240, maxHeight: 260,
          display: 'flex', flexDirection: 'column', boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
        }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search timezone…"
            style={{ padding: '7px 10px', fontSize: 12, borderRadius: '10px 10px 0 0',
              background: 'rgba(74,222,128,0.06)', border: 'none',
              borderBottom: '1px solid rgba(74,222,128,0.15)', color: '#bbf7d0', outline: 'none' }} />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.slice(0, 200).map(tz => (
              <button key={tz} onClick={() => { onChange(tz); setOpen(false); setSearch(''); }} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: 12,
                background: tz === value ? 'rgba(74,222,128,0.15)' : 'transparent',
                color: tz === value ? '#4ade80' : 'rgba(200,255,220,0.75)',
              }}>{tz}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AddEntryForm ─────────────────────────────────────────────────────────────
function AddEntryForm({ type, jobId, accountId, defaultCostPerTask, onAdded, onCancel }) {
  const c = TYPE_CONFIG[type];
  const [count,  setCount]  = useState('');
  const [cost,   setCost]   = useState('');
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    const n = parseInt(count, 10);
    if (!n || n < 1) { setError('Enter a valid number (≥ 1)'); return; }
    setSaving(true); setError('');
    try {
      const res = await addTaskBalanceEntry({ accountId, jobId, type, count: n, cost: cost !== '' ? Number(cost) : null, note });
      if (res.success) onAdded(res.entry);
      else setError(res.message || 'Failed');
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  const costPH = defaultCostPerTask != null ? `Cost (default: ${fmtMoney(defaultCostPerTask)})` : 'Cost (optional)';

  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: c.color, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <c.icon size={13} /> Add {c.label}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="number" min="1" placeholder="Count" value={count} onChange={e => setCount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }} autoFocus
          style={{ width: 80, padding: '5px 8px', borderRadius: 7, fontSize: 13, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0', outline: 'none' }} />
        <input type="number" min="0" step="0.01" placeholder={costPH} value={cost} onChange={e => setCost(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          style={{ width: 180, padding: '5px 8px', borderRadius: 7, fontSize: 13, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', outline: 'none' }} />
        <input type="text" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          style={{ flex: 1, minWidth: 100, padding: '5px 8px', borderRadius: 7, fontSize: 13, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0', outline: 'none' }} />
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${c.border}`, background: c.bg, color: c.color, cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
          {saving ? '…' : 'Add'}
        </button>
        <button onClick={onCancel}
          style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(74,222,128,0.15)', background: 'transparent', color: 'rgba(134,239,172,0.5)', cursor: 'pointer', fontSize: 12 }}>
          ✕
        </button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}
    </div>
  );
}

// ─── EditEntryRow ─────────────────────────────────────────────────────────────
function EditEntryRow({ entry, defaultCostPerTask, onSaved, onCancel }) {
  const c = TYPE_CONFIG[entry.type];
  const [count,  setCount]  = useState(String(entry.count));
  const [cost,   setCost]   = useState(entry.cost != null ? String(entry.cost) : '');
  const [note,   setNote]   = useState(entry.note || '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    const n = parseInt(count, 10);
    if (!n || n < 1) { setError('Count must be ≥ 1'); return; }
    setSaving(true); setError('');
    try {
      const res = await updateTaskBalanceEntry({ id: entry.id || entry._id, count: n, cost: cost !== '' ? Number(cost) : null, note });
      if (res.success) onSaved(res.entry);
      else setError(res.message || 'Failed');
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  const costPH = defaultCostPerTask != null ? `Cost (default: ${fmtMoney(defaultCostPerTask)})` : 'Cost (optional)';

  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.35)', border: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: c.color, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
        <c.icon size={12} /> Edit {c.label}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="number" min="1" value={count} onChange={e => setCount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          style={{ width: 80, padding: '5px 8px', borderRadius: 7, fontSize: 13, background: 'rgba(0,0,0,0.4)', border: `1px solid ${c.border}`, color: c.color, outline: 'none' }} />
        <input type="number" min="0" step="0.01" placeholder={costPH} value={cost} onChange={e => setCost(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }} autoFocus
          style={{ width: 200, padding: '5px 8px', borderRadius: 7, fontSize: 13, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24', outline: 'none' }} />
        <input type="text" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          style={{ flex: 1, minWidth: 100, padding: '5px 8px', borderRadius: 7, fontSize: 13, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0', outline: 'none' }} />
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 7, border: `1px solid ${c.border}`, background: c.bg, color: c.color, cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
          <Check size={12} /> {saving ? '…' : 'Save'}
        </button>
        <button onClick={onCancel}
          style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(74,222,128,0.15)', background: 'transparent', color: 'rgba(134,239,172,0.5)', cursor: 'pointer', fontSize: 12 }}>
          <X size={12} />
        </button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}
    </div>
  );
}

// ─── AccountModal ─────────────────────────────────────────────────────────────
function AccountModal({ initial, onClose, onSave }) {
  const [form,     setForm]     = useState(() => {
    if (!initial) return EMPTY_FORM;
    return {
      name: initial.name || '', nationality: initial.nationality || '',
      createdDate: initial.createdDate ? new Date(initial.createdDate).toISOString().split('T')[0] : '',
      connectionType: initial.connectionType || 'proxy',
      proxyHost: initial.proxyDetail?.host || '', proxyPort: initial.proxyDetail?.port || '',
      proxyAccount: initial.proxyDetail?.account || '', proxyPassword: initial.proxyDetail?.password || '',
      proxyProtocol: initial.proxyDetail?.protocol || 'HTTP',
      remotePcHolder: initial.remotePc?.holderName || '', remotePcNationality: initial.remotePc?.nationality || '',
      idVerified: initial.paymentDetails?.idVerified || false,
      paymentVerified: initial.paymentDetails?.paymentVerified || false,
      bankHoldingStatus: initial.paymentDetails?.bankHoldingStatus || '',
      revenueSharePercentage: initial.paymentDetails?.revenueSharePercentage ?? '',
      statuses: initial.statuses || [],
    };
  });
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [showPass, setShowPass] = useState(false);

  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setN = (k, v) => setForm(f => ({ ...f, [k]: isNaN(v) ? '' : v }));
  const toggleStatus = (key) => setForm(f => ({
    ...f, statuses: f.statuses.includes(key) ? f.statuses.filter(s => s !== key) : [...f.statuses, key],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Account name is required'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        name: form.name, nationality: form.nationality,
        createdDate: form.createdDate || undefined,
        connectionType: form.connectionType,
        proxyDetail: form.connectionType === 'proxy'
          ? { host: form.proxyHost, port: form.proxyPort, account: form.proxyAccount, password: form.proxyPassword, protocol: form.proxyProtocol }
          : {},
        remotePc: form.connectionType === 'remote_pc'
          ? { holderName: form.remotePcHolder, nationality: form.remotePcNationality }
          : {},
        paymentDetails: {
          idVerified: form.idVerified, paymentVerified: form.paymentVerified,
          bankHoldingStatus: form.bankHoldingStatus,
          revenueSharePercentage: form.revenueSharePercentage !== '' ? parseFloat(form.revenueSharePercentage) : 0,
        },
        statuses: form.statuses,
      };
      if (initial?.id) payload.id = initial.id;
      await onSave(payload);
      onClose();
    } catch (ex) { setErr(ex.response?.data?.message || ex.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-xl flex flex-col" style={{ borderColor: 'rgba(74,222,128,0.2)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(74,222,128,0.1)' }}>
          <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>
            {initial?.id ? 'Edit Account' : 'New Account'}
          </h2>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">
          {err && (
            <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-xl"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
              <AlertCircle size={14} /> {err}
            </div>
          )}
          <form id="acc-form" onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account Name *">
                <input className="input input-sm w-full" style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Account name" />
              </Field>
              <Field label="Nationality">
                <input className="input input-sm w-full" style={inp} value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="e.g. US" />
              </Field>
            </div>
            <Field label="Created Date">
              <input type="date" className="input input-sm w-full" style={inp} value={form.createdDate} onChange={e => set('createdDate', e.target.value)} />
            </Field>
            <SectionTitle icon={Globe}>Connection Type</SectionTitle>
            <div className="flex gap-4">
              {[{ val: 'proxy', label: 'Proxy', Icon: Shield }, { val: 'remote_pc', label: 'Remote PC', Icon: Monitor }].map(({ val, label, Icon }) => (
                <label key={val} className="flex items-center gap-2 text-sm"
                  style={{ color: form.connectionType === val ? '#bbf7d0' : 'rgba(134,239,172,0.5)' }}>
                  <input type="radio" name="connType" value={val} checked={form.connectionType === val}
                    onChange={() => set('connectionType', val)} className="radio radio-xs" style={{ accentColor: '#4ade80' }} />
                  <Icon size={13} /> {label}
                </label>
              ))}
            </div>
            {form.connectionType === 'proxy' && (
              <>
                <SectionTitle icon={Shield}>Proxy Details</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Host"><input className="input input-sm w-full" style={inp} value={form.proxyHost} onChange={e => set('proxyHost', e.target.value)} placeholder="proxy.host.com" /></Field>
                  <Field label="Port"><input className="input input-sm w-full" style={inp} value={form.proxyPort} onChange={e => set('proxyPort', e.target.value)} placeholder="8080" /></Field>
                  <Field label="Account"><input className="input input-sm w-full" style={inp} value={form.proxyAccount} onChange={e => set('proxyAccount', e.target.value)} /></Field>
                  <Field label="Password">
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} className="input input-sm w-full pr-8" style={inp} value={form.proxyPassword} onChange={e => set('proxyPassword', e.target.value)} />
                      <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'rgba(134,239,172,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </Field>
                </div>
                <Field label="Protocol">
                  <select className="input input-sm w-full" style={inp} value={form.proxyProtocol} onChange={e => set('proxyProtocol', e.target.value)}>
                    {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </>
            )}
            {form.connectionType === 'remote_pc' && (
              <>
                <SectionTitle icon={Monitor}>Remote PC Details</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="PC Holder Name"><input className="input input-sm w-full" style={inp} value={form.remotePcHolder} onChange={e => set('remotePcHolder', e.target.value)} /></Field>
                  <Field label="Nationality"><input className="input input-sm w-full" style={inp} value={form.remotePcNationality} onChange={e => set('remotePcNationality', e.target.value)} /></Field>
                </div>
              </>
            )}
            <SectionTitle icon={CreditCard}>Payment Details</SectionTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[{ key: 'idVerified', label: '① ID Verify Passed' }, { key: 'paymentVerified', label: '② Payment Verify Passed' }].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm" style={{ color: form[key] ? '#bbf7d0' : 'rgba(134,239,172,0.5)' }}>
                    <input type="checkbox" className="checkbox checkbox-xs" style={{ accentColor: '#4ade80' }} checked={form[key]} onChange={e => set(key, e.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="③ Bank Holding Status">
                  <select className="input input-sm w-full" style={inp} value={form.bankHoldingStatus} onChange={e => set('bankHoldingStatus', e.target.value)}>
                    <option value="">— Not selected —</option>
                    <option value="citizen_holding">Citizen Holding Bank</option>
                    <option value="holding_myself">Holding Bank Myself</option>
                  </select>
                </Field>
                <Field label="④ Revenue Share (%)">
                  <input type="number" min="0" max="100" step="0.01" className="input input-sm w-full" style={inp}
                    value={form.revenueSharePercentage} onChange={e => setN('revenueSharePercentage', e.target.value)} placeholder="e.g. 30" />
                </Field>
              </div>
            </div>
            <SectionTitle>Account Status</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_STATUSES.map(s => {
                const active = form.statuses.includes(s.key);
                return (
                  <button key={s.key} type="button" onClick={() => toggleStatus(s.key)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                    style={{ background: active ? s.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? s.border : 'rgba(74,222,128,0.1)'}`, color: active ? s.color : 'rgba(134,239,172,0.35)' }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </form>
        </div>
        <div className="flex gap-2 px-6 py-4" style={{ borderTop: '1px solid rgba(74,222,128,0.1)' }}>
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.6)' }}>
            Cancel
          </button>
          <button type="submit" form="acc-form" disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
            {saving ? <Loader size={14} className="animate-spin" /> : null}
            {saving ? 'Saving…' : (initial?.id ? 'Save Changes' : 'Create Account')}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.72)' }}>
      <div style={{ width: 380, background: 'rgba(3,18,9,0.98)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 14, padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
        <div style={{ color: '#fca5a5', fontSize: 14, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 13, background: 'transparent', border: '1px solid rgba(74,222,128,0.2)', color: 'rgba(134,239,172,0.6)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 13, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── ContextMenu ──────────────────────────────────────────────────────────────
function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'fixed', left: x, top: y, zIndex: 9999,
      background: '#0a1f12', border: '1px solid rgba(74,222,128,0.2)',
      borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.75)',
      minWidth: 180, padding: '4px 0', userSelect: 'none',
    }}>
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} style={{ height: 1, background: 'rgba(74,222,128,0.1)', margin: '3px 0' }} />
        ) : (
          <button key={i} onClick={() => { item.action(); onClose(); }} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
            padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 13,
            background: 'transparent', color: item.danger ? '#f87171' : 'rgba(200,255,220,0.82)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = item.danger ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            {item.icon && <item.icon size={14} style={{ color: item.danger ? 'rgba(248,113,113,0.6)' : 'rgba(134,239,172,0.5)', flexShrink: 0 }} />}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ─── TaskPanel ────────────────────────────────────────────────────────────────
function TaskPanel({ job, account, readOnly, targetUsername }) {
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [addingType, setAddingType] = useState(null);
  const [editingId,  setEditingId]  = useState(null);
  const [tz,         setTz]         = useState(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } });
  const [fromDT,     setFromDT]     = useState('');
  const [toDT,       setToDT]       = useState('');
  const [activePreset, setActivePreset] = useState(null);
  const [page,       setPage]       = useState(1);
  const PAGE_SIZE = 25;

  const jobId     = job?.id     || job?._id;
  const accountId = account?.id || account?._id;

  const loadEntries = useCallback((fISO, tISO) => {
    if (!jobId || !accountId) return;
    setLoading(true); setError('');
    const payload = { jobId, accountId };
    if (targetUsername) payload.targetUsername = targetUsername;
    if (fISO) payload.from = fISO;
    if (tISO) payload.to   = tISO;
    listTaskBalanceEntries(payload)
      .then(r => { if (r.success) setEntries(r.entries); else setError(r.message); })
      .catch(e => setError(e.response?.data?.message || 'Failed'))
      .finally(() => setLoading(false));
  }, [jobId, accountId, targetUsername]);

  useEffect(() => {
    setEntries([]); setError(''); setAddingType(null); setEditingId(null); setPage(1);
    const range = computePreset('today', tz);
    if (range) {
      setFromDT(utcToLocalInput(range.from, tz));
      setToDT(utcToLocalInput(range.to, tz));
      setActivePreset('today');
      loadEntries(range.from, range.to);
    } else {
      setFromDT(''); setToDT(''); setActivePreset(null);
      loadEntries('', '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, accountId, loadEntries]);

  const applyPreset = (key) => {
    setActivePreset(key);
    if (key === 'all') { setFromDT(''); setToDT(''); loadEntries('', ''); return; }
    const range = computePreset(key, tz);
    if (!range) return;
    setFromDT(utcToLocalInput(range.from, tz));
    setToDT(utcToLocalInput(range.to,   tz));
    loadEntries(range.from, range.to);
  };

  const stats = entries.reduce(
    (acc, e) => { acc[e.type] = (acc[e.type] || 0) + e.count; return acc; },
    { submitted: 0, approved: 0, rejected: 0 }
  );
  const balance = stats.submitted - stats.approved - stats.rejected;

  const costPerTask = (job?.hourlyRate && job?.jobMaxPayableTime)
    ? job.hourlyRate * job.jobMaxPayableTime : null;

  const costStats = entries.reduce((acc, e) => {
    const c = e.cost != null ? e.cost : (costPerTask != null ? e.count * costPerTask : null);
    if (c != null) acc[e.type] = (acc[e.type] || 0) + c;
    return acc;
  }, { submitted: null, approved: null, rejected: null });

  const balanceCost = (costStats.submitted != null || costStats.approved != null || costStats.rejected != null)
    ? (costStats.submitted || 0) - (costStats.approved || 0) - (costStats.rejected || 0)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Top bar: job info | stats (center) | add buttons ── */}
      <div style={{
        padding: '9px 16px', borderBottom: '1px solid rgba(74,222,128,0.1)', flexShrink: 0,
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, minHeight: 58,
      }}>
        {/* Col 1: title + detail chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ color: 'rgba(200,255,220,0.9)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
            {job?.jobName}
            <span style={{ color: 'rgba(134,239,172,0.4)', fontWeight: 400 }}> ({account?.name})</span>
          </span>
          {job?.hourlyRate != null && (
            <span style={{ padding: '1px 7px', borderRadius: 5, fontSize: 11, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: 'rgba(251,191,36,0.7)', whiteSpace: 'nowrap' }}>
              {fmtMoney(job.hourlyRate)}/hr
            </span>
          )}
          {job?.jobMaxPayableTime != null && (
            <span style={{ padding: '1px 7px', borderRadius: 5, fontSize: 11, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: 'rgba(96,165,250,0.7)', whiteSpace: 'nowrap' }}>
              {job.jobMaxPayableTime}hr max
            </span>
          )}
          {costPerTask != null && (
            <span style={{ padding: '1px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', whiteSpace: 'nowrap' }}>
              {fmtMoney(costPerTask)}/task
            </span>
          )}
        </div>

        {/* Col 2: stat summary — centered */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { key: 'submitted', color: TYPE_CONFIG.submitted.color, icon: TYPE_CONFIG.submitted.icon, sign: '+', count: stats.submitted, money: costStats.submitted },
            { key: 'approved',  color: TYPE_CONFIG.approved.color,  icon: TYPE_CONFIG.approved.icon,  sign: '−', count: stats.approved,  money: costStats.approved },
            { key: 'rejected',  color: TYPE_CONFIG.rejected.color,  icon: TYPE_CONFIG.rejected.icon,  sign: '−', count: stats.rejected,  money: costStats.rejected },
            { key: 'pending',   color: '#60a5fa',                    icon: BarChart2,                  sign: balance >= 0 ? '+' : '−', count: Math.abs(balance), money: balanceCost != null ? Math.abs(balanceCost) : null },
          ].map(({ key, color, icon: Icon, sign, count, money }, i) => (
            <div key={key} style={{ display: 'flex', alignItems: 'stretch' }}>
              {i > 0 && <div style={{ width: 1, background: 'rgba(74,222,128,0.1)', margin: '4px 10px' }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 48 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Icon size={10} style={{ color, opacity: 0.7 }} />
                  <span style={{ color, fontWeight: 800, fontSize: 14, lineHeight: 1 }}>{sign}{count}</span>
                </div>
                {money != null
                  ? <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 600, lineHeight: 1 }}>{fmtMoney(money)}</span>
                  : <span style={{ color: 'rgba(134,239,172,0.25)', fontSize: 10, lineHeight: 1 }}>—</span>
                }
                <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>{key}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Col 3: add buttons — right-aligned */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          {!readOnly && ['submitted','approved','rejected'].map(t => {
            const c = TYPE_CONFIG[t];
            return (
              <button key={t} onClick={() => setAddingType(addingType === t ? null : t)} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
                background: addingType === t ? c.bg : 'transparent',
                border: `1px solid ${addingType === t ? c.border : 'rgba(74,222,128,0.2)'}`,
                color: addingType === t ? c.color : 'rgba(134,239,172,0.6)',
              }}>
                <Plus size={11} /> {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter bar: tz + datetime pickers + presets all in one line ── */}
      <div style={{ padding: '6px 16px', borderBottom: '1px solid rgba(74,222,128,0.08)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
        <TzPicker value={tz} onChange={(newTz) => { setTz(newTz); setFromDT(''); setToDT(''); setActivePreset(null); }} />
        <div style={{ width: 1, height: 16, background: 'rgba(74,222,128,0.15)', flexShrink: 0 }} />
        <input type="datetime-local" value={fromDT} onChange={e => { setFromDT(e.target.value); setActivePreset(null); }} style={dtInputStyle} />
        <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 12 }}>→</span>
        <input type="datetime-local" value={toDT} onChange={e => { setToDT(e.target.value); setActivePreset(null); }} style={dtInputStyle} />
        <button onClick={() => { setActivePreset(null); loadEntries(fromDT ? localToUTC(fromDT, tz) : '', toDT ? localToUTC(toDT, tz) : ''); }}
          style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', cursor: 'pointer', fontWeight: 600 }}>Filter</button>
        <button onClick={() => { setFromDT(''); setToDT(''); setActivePreset(null); loadEntries('', ''); }}
          style={{ padding: '3px 8px', borderRadius: 6, fontSize: 12, background: 'transparent', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.5)', cursor: 'pointer' }}>Clear</button>
        <div style={{ width: 1, height: 16, background: 'rgba(74,222,128,0.15)', flexShrink: 0 }} />
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => applyPreset(p.key)} style={{
            padding: '3px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', transition: 'all 0.1s',
            fontWeight: activePreset === p.key ? 700 : 400,
            background: activePreset === p.key ? 'rgba(74,222,128,0.18)' : 'transparent',
            border: `1px solid ${activePreset === p.key ? 'rgba(74,222,128,0.45)' : 'rgba(74,222,128,0.18)'}`,
            color: activePreset === p.key ? '#4ade80' : 'rgba(134,239,172,0.6)',
          }}>{p.label}</button>
        ))}
      </div>

      {/* ── Inline add form ── */}
      {!readOnly && addingType && (
        <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(74,222,128,0.1)', flexShrink: 0 }}>
          <AddEntryForm
            type={addingType} jobId={jobId} accountId={accountId} defaultCostPerTask={costPerTask}
            onAdded={(entry) => { setEntries(prev => [entry, ...prev]); setAddingType(null); }}
            onCancel={() => setAddingType(null)}
          />
        </div>
      )}

      {/* ── Entries table ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
            <Loader size={20} className="animate-spin" style={{ color: '#4ade80' }} />
          </div>
        ) : error ? (
          <div style={{ margin: '16px 18px', color: '#f87171', padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} /> {error}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ color: 'rgba(134,239,172,0.28)', fontSize: 13, textAlign: 'center', paddingTop: 52 }}>
            No entries yet. Use the buttons above to add.
          </div>
        ) : (() => {
          const totalPages  = Math.ceil(entries.length / PAGE_SIZE);
          const safePage    = Math.min(page, totalPages);
          const pagedEntries = entries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
          return (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(74,222,128,0.04)', borderBottom: '1px solid rgba(74,222,128,0.12)' }}>
                {['Type', 'Count', 'Amount', 'Note', 'Date', ...(readOnly ? [] : [''])].map((h, i) => (
                  <th key={i} style={{
                    padding: '7px 14px', textAlign: i === 1 || i === 2 ? 'right' : i === 5 ? 'center' : 'left',
                    color: 'rgba(134,239,172,0.4)', fontWeight: 600, fontSize: 10,
                    textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedEntries.map((entry, idx) => {
                const c       = TYPE_CONFIG[entry.type];
                const entryId = entry.id || entry._id;
                const isEditing = editingId === entryId;
                const isActual  = entry.cost != null;
                const amount    = isActual ? entry.cost : (costPerTask != null ? entry.count * costPerTask : null);

                if (isEditing && !readOnly) {
                  return (
                    <tr key={entryId}>
                      <td colSpan={readOnly ? 5 : 6} style={{ padding: '8px 14px', borderBottom: '1px solid rgba(74,222,128,0.08)' }}>
                        <EditEntryRow
                          entry={entry} defaultCostPerTask={costPerTask}
                          onSaved={(updated) => { setEntries(prev => prev.map(e => (e.id || e._id) === entryId ? updated : e)); setEditingId(null); }}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={entryId}
                    style={{
                      borderBottom: '1px solid rgba(74,222,128,0.06)',
                      borderLeft: `3px solid ${c.color}`,
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(74,222,128,0.02)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `color-mix(in srgb, ${c.color} 6%, transparent)`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(74,222,128,0.02)'; }}
                  >
                    {/* Type */}
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      <TypeBadge type={entry.type} />
                    </td>

                    {/* Count */}
                    <td style={{ padding: '8px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ color: c.color, fontWeight: 700, fontSize: 14 }}>
                        {TYPE_CONFIG[entry.type].sign > 0 ? '+' : '−'}{entry.count}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '8px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {amount != null ? (
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                          color:      isActual ? '#fbbf24'                        : 'rgba(251,191,36,0.45)',
                          background: isActual ? 'rgba(251,191,36,0.1)'           : 'rgba(251,191,36,0.04)',
                          border:     isActual ? '1px solid rgba(251,191,36,0.3)' : '1px dashed rgba(251,191,36,0.2)',
                        }} title={isActual ? 'Actual cost' : 'Estimated (default)'}>
                          {fmtMoney(amount)}
                        </span>
                      ) : <span style={{ color: 'rgba(134,239,172,0.18)', fontSize: 11 }}>—</span>}
                    </td>

                    {/* Note */}
                    <td style={{ padding: '8px 14px', maxWidth: 200 }}>
                      {entry.note
                        ? <span style={{ color: 'rgba(200,255,220,0.55)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{entry.note}</span>
                        : <span style={{ color: 'rgba(134,239,172,0.18)', fontSize: 11 }}>—</span>
                      }
                    </td>

                    {/* Date */}
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 11 }}>{fmtDT(entry.createdAt, tz)}</span>
                    </td>

                    {/* Actions */}
                    {!readOnly && (
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            onClick={() => setEditingId(entryId)}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(134,239,172,0.06)', border: '1px solid rgba(134,239,172,0.15)', cursor: 'pointer', color: 'rgba(134,239,172,0.5)', padding: '3px 8px', borderRadius: 6, fontSize: 11 }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#86efac'; e.currentTarget.style.borderColor = 'rgba(134,239,172,0.4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(134,239,172,0.5)'; e.currentTarget.style.borderColor = 'rgba(134,239,172,0.15)'; }}>
                            <Pencil size={11} /> Edit
                          </button>
                          <button
                            onClick={async () => {
                              const res = await deleteTaskBalanceEntry(entryId);
                              if (res.success) setEntries(prev => prev.filter(e => (e.id || e._id) !== entryId));
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', cursor: 'pointer', color: 'rgba(248,113,113,0.5)', padding: '3px 8px', borderRadius: 6, fontSize: 11 }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(248,113,113,0.5)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.15)'; }}>
                            <Trash2 size={11} /> Del
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          );
        })()}
      </div>

      {/* ── Pagination ── */}
      {entries.length > PAGE_SIZE && (() => {
        const totalPages = Math.ceil(entries.length / PAGE_SIZE);
        const safePage   = Math.min(page, totalPages);
        const btnStyle   = (disabled, active) => ({
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 28, height: 26, padding: '0 6px', borderRadius: 6, fontSize: 12, cursor: disabled ? 'default' : 'pointer',
          border: active ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(74,222,128,0.15)',
          background: active ? 'rgba(74,222,128,0.18)' : disabled ? 'transparent' : 'rgba(74,222,128,0.05)',
          color: active ? '#4ade80' : disabled ? 'rgba(134,239,172,0.2)' : 'rgba(134,239,172,0.55)',
          fontWeight: active ? 700 : 400, transition: 'all 0.1s',
        });
        const pageNums = (() => {
          if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
          const nums = new Set([1, totalPages, safePage, safePage - 1, safePage + 1].filter(n => n >= 1 && n <= totalPages));
          return [...nums].sort((a, b) => a - b);
        })();
        return (
          <div style={{ padding: '7px 16px', borderTop: '1px solid rgba(74,222,128,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(3,10,6,0.5)' }}>
            <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 11 }}>
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, entries.length)} of {entries.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button style={btnStyle(safePage === 1, false)} disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
              {pageNums.reduce((acc, n, i) => {
                if (i > 0 && n - pageNums[i - 1] > 1) acc.push(<span key={`gap${n}`} style={{ color: 'rgba(134,239,172,0.2)', fontSize: 11, padding: '0 2px' }}>…</span>);
                acc.push(<button key={n} style={btnStyle(false, n === safePage)} onClick={() => setPage(n)}>{n}</button>);
                return acc;
              }, [])}
              <button style={btnStyle(safePage === totalPages, false)} disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── FileExplorer ─────────────────────────────────────────────────────────────
function FileExplorer({ member, accounts, expanded, accountJobs, loadingJobs, selJob, onToggleAccount, onSelectJob, onContextMenu }) {
  if (!member) {
    return (
      <div style={{ padding: '24px 12px', color: 'rgba(134,239,172,0.25)', fontSize: 12, textAlign: 'center' }}>
        Select a member from the sidebar
      </div>
    );
  }
  if (accounts.length === 0) {
    return (
      <div style={{ padding: '24px 12px', color: 'rgba(134,239,172,0.25)', fontSize: 12, textAlign: 'center' }}>
        No accounts
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
      {accounts.map(acc => {
        const accId      = acc.id || acc._id;
        const isExpanded = !!expanded[accId];
        const jobs       = accountJobs[accId] || [];
        const isLoading  = !!loadingJobs[accId];

        return (
          <div key={accId}>
            {/* Account row */}
            <div
              onClick={() => onToggleAccount(acc)}
              onContextMenu={e => { e.preventDefault(); onContextMenu(e, 'account', acc); }}
              style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '4px 8px', cursor: 'pointer', userSelect: 'none', borderRadius: 4 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: 16, flexShrink: 0, color: 'rgba(134,239,172,0.45)', display: 'flex', alignItems: 'center' }}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              {isExpanded
                ? <FolderOpen size={14} style={{ color: '#fbbf24', marginRight: 5, flexShrink: 0 }} />
                : <Folder     size={14} style={{ color: '#94a3b8', marginRight: 5, flexShrink: 0 }} />
              }
              <span style={{ flex: 1, color: 'rgba(200,255,220,0.85)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {acc.name}{(acc.jobCount ?? 0) > 0 ? <span style={{ color: 'rgba(134,239,172,0.4)', fontWeight: 400 }}> ({acc.jobCount})</span> : null}
              </span>
            </div>

            {/* Jobs under account */}
            {isExpanded && (
              <div>
                {isLoading ? (
                  <div style={{ padding: '4px 8px 4px 32px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader size={11} className="animate-spin" style={{ color: 'rgba(134,239,172,0.4)' }} />
                    <span style={{ color: 'rgba(134,239,172,0.3)', fontSize: 11 }}>Loading…</span>
                  </div>
                ) : jobs.length === 0 ? (
                  <div style={{ padding: '4px 8px 4px 32px', color: 'rgba(134,239,172,0.22)', fontSize: 11 }}>No jobs</div>
                ) : (
                  jobs.map(job => {
                    const jobId      = job.id || job._id;
                    const isSelected = selJob?.job?.id === jobId && (selJob?.account?.id || selJob?.account?._id) === accId;
                    return (
                      <div
                        key={jobId}
                        onClick={() => onSelectJob(job, acc)}
                        onContextMenu={e => { e.preventDefault(); onContextMenu(e, 'job', { job, account: acc }); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '3px 8px 3px 32px', cursor: 'pointer', userSelect: 'none', borderRadius: 4,
                          background: isSelected ? 'rgba(74,222,128,0.15)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(74,222,128,0.07)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Briefcase size={12} style={{ color: isSelected ? '#4ade80' : 'rgba(74,222,128,0.35)', flexShrink: 0 }} />
                        <span style={{ flex: 1, color: isSelected ? '#4ade80' : 'rgba(200,255,220,0.7)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 600 : 400 }}>
                          {job.jobName}{(job.submittedCount ?? 0) > 0
                            ? <span style={{ color: isSelected ? 'rgba(74,222,128,0.6)' : 'rgba(134,239,172,0.4)', fontWeight: 400 }}> ({job.submittedCount})</span>
                            : null}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MemberStatsPlaceholder ───────────────────────────────────────────────────
function MemberStatsPlaceholder({ member }) {
  const initials = (member.displayName || member.username || '?').slice(0, 2).toUpperCase();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(74,222,128,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          border: '2px solid rgba(74,222,128,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: member.avatarUrl ? 'transparent' : 'rgba(74,222,128,0.1)',
        }}>
          {member.avatarUrl
            ? <img src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 14, userSelect: 'none' }}>{initials}</span>
          }
        </div>
        <div>
          <div style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 15 }}>{member.displayName || member.username}</div>
          {member.displayName && <div style={{ color: 'rgba(134,239,172,0.4)', fontSize: 12 }}>@{member.username}</div>}
        </div>
      </div>

      {/* Placeholder body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            border: '2px dashed rgba(74,222,128,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BarChart2 size={26} style={{ color: 'rgba(74,222,128,0.2)' }} />
          </div>
          <div>
            <div style={{ color: 'rgba(134,239,172,0.5)', fontSize: 14, fontWeight: 600 }}>Member Statistics</div>
            <div style={{ color: 'rgba(134,239,172,0.25)', fontSize: 12, marginTop: 6 }}>Coming soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MemberPopover ────────────────────────────────────────────────────────────
function MemberPopover({ member, anchorY }) {
  const initials = (member.displayName || member.username || '?').slice(0, 2).toUpperCase();
  const top = Math.max(8, anchorY - 56);
  return (
    <div style={{
      position: 'fixed', left: 58, top, zIndex: 500,
      background: 'rgba(5,20,11,0.97)', border: '1px solid rgba(74,222,128,0.25)',
      borderRadius: 12, padding: '16px 18px', width: 190,
      boxShadow: '0 8px 32px rgba(0,0,0,0.75)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        border: '2.5px solid rgba(74,222,128,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: member.avatarUrl ? 'transparent' : 'rgba(74,222,128,0.1)',
      }}>
        {member.avatarUrl
          ? <img src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 28, userSelect: 'none' }}>{initials}</span>
        }
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
          {member.displayName || member.username}
        </div>
        {member.displayName && (
          <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 12, marginTop: 3 }}>@{member.username}</div>
        )}
      </div>
    </div>
  );
}

// ─── MemberSidebar ────────────────────────────────────────────────────────────
function MemberSidebar({ members, selMember, onSelect, onContextMenu }) {
  const [popover, setPopover] = useState(null); // { member, anchorY }

  return (
    <div style={{
      width: 52, flexShrink: 0, borderRight: '1px solid rgba(74,222,128,0.1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 0', gap: 6, overflowY: 'auto',
      background: 'rgba(3,10,6,0.85)',
    }}>
      {members.map(member => {
        const isSelected = selMember?.id === member.id;
        const initials   = (member.displayName || member.username || '?').slice(0, 2).toUpperCase();
        return (
          <div
            key={member.id}
            onClick={() => onSelect(member)}
            onContextMenu={e => { e.preventDefault(); onContextMenu(e, 'member', member); }}
            title={member.displayName || member.username}
            onMouseEnter={e => {
              if (!isSelected) e.currentTarget.style.borderColor = 'rgba(74,222,128,0.5)';
              const rect = e.currentTarget.getBoundingClientRect();
              setPopover({ member, anchorY: rect.top + rect.height / 2 });
            }}
            onMouseLeave={e => {
              if (!isSelected) e.currentTarget.style.borderColor = 'rgba(74,222,128,0.2)';
              setPopover(null);
            }}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              border: isSelected ? '2.5px solid #4ade80' : '2px solid rgba(74,222,128,0.2)',
              background: member.avatarUrl ? 'transparent' : 'rgba(74,222,128,0.1)',
              boxShadow: isSelected ? '0 0 8px rgba(74,222,128,0.4)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s', boxSizing: 'border-box',
            }}
          >
            {member.avatarUrl
              ? <img src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 11, userSelect: 'none' }}>{initials}</span>
            }
          </div>
        );
      })}

      {/* Hover popover */}
      {popover && <MemberPopover member={popover.member} anchorY={popover.anchorY} />}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ReveloEditor() {
  const { user: currentUser } = useAuth();

  const [members,         setMembers]         = useState([]);
  const [loadingMembers,  setLoadingMembers]  = useState(true);
  const [selMember,       setSelMember]       = useState(null);
  const [accounts,        setAccounts]        = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [expanded,        setExpanded]        = useState({});
  const [accountJobs,     setAccountJobs]     = useState({});
  const [loadingJobs,     setLoadingJobs]     = useState({});
  const [selJob,          setSelJob]          = useState(null);

  const [ctx,              setCtx]              = useState(null);
  const [accountModal,     setAccountModal]     = useState(null);
  const [addJobModal,      setAddJobModal]      = useState(null);
  const [confirmModal,     setConfirmModal]     = useState(null);
  const [memberStatsActive, setMemberStatsActive] = useState(false);

  // Resizable explorer panel
  const [explorerWidth, setExplorerWidth] = useState(240);
  const [draggingExp,   setDraggingExp]   = useState(false);

  useEffect(() => {
    if (!draggingExp) return;
    const onMove = (e) => {
      const newW = e.clientX - 52; // 52 = member sidebar width
      setExplorerWidth(Math.max(160, Math.min(520, newW)));
    };
    const onUp = () => setDraggingExp(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',  onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',  onUp);
    };
  }, [draggingExp]);

  // Load members on mount
  useEffect(() => {
    setLoadingMembers(true);
    listReveloUsers()
      .then(r => { if (r.success) setMembers(r.users || []); })
      .catch(() => {})
      .finally(() => setLoadingMembers(false));
  }, []);

  const isOwnMember = useCallback((member) => {
    if (!currentUser || !member) return false;
    return member.username === currentUser.username || String(member.id) === String(currentUser._id);
  }, [currentUser]);

  const loadAccounts = useCallback((member) => {
    if (!member) return;
    setLoadingAccounts(true);
    setAccounts([]); setExpanded({}); setAccountJobs({}); setSelJob(null); setMemberStatsActive(false);
    const fn = isOwnMember(member) ? listAccounts() : listAccountsByUsername(member.username);
    fn.then(r => { if (r.success) setAccounts(r.accounts); })
      .catch(() => {})
      .finally(() => setLoadingAccounts(false));
  }, [isOwnMember]);

  const handleSelectMember = (member) => {
    setSelMember(member);
    setMemberStatsActive(true);
    setSelJob(null);
    loadAccounts(member);
  };

  const handleToggleAccount = async (acc) => {
    const accId      = acc.id || acc._id;
    const willExpand = !expanded[accId];
    setExpanded(prev => ({ ...prev, [accId]: willExpand }));
    if (willExpand && !accountJobs[accId]) {
      setLoadingJobs(prev => ({ ...prev, [accId]: true }));
      listJobsByAccount(accId)
        .then(r => { if (r.success) setAccountJobs(prev => ({ ...prev, [accId]: r.jobs })); })
        .catch(() => {})
        .finally(() => setLoadingJobs(prev => ({ ...prev, [accId]: false })));
    }
  };

  // Context menu items
  const ctxItems = (() => {
    if (!ctx) return [];
    if (ctx.type === 'member') {
      if (!isOwnMember(ctx.data)) return [];
      return [
        { icon: Plus, label: 'Create New Account', action: () => setAccountModal({ mode: 'create' }) },
      ];
    }
    if (ctx.type === 'account') {
      if (!selMember || !isOwnMember(selMember)) return [];
      return [
        { icon: Edit2,  label: 'Edit Account',   action: () => setAccountModal({ mode: 'edit', account: ctx.data }) },
        { icon: Trash2, label: 'Delete Account', danger: true, action: () => {
            const acc = ctx.data;
            setConfirmModal({
              message: `Delete account "${acc.name}"? This cannot be undone.`,
              onConfirm: async () => {
                const res = await deleteAccount(acc.id || acc._id);
                if (res.success) {
                  const accId = acc.id || acc._id;
                  setAccounts(prev => prev.filter(a => (a.id || a._id) !== accId));
                  if ((selJob?.account?.id || selJob?.account?._id) === accId) setSelJob(null);
                }
                setConfirmModal(null);
              },
            });
          },
        },
        { divider: true },
        { icon: Plus, label: 'Add Job', action: () => setAddJobModal(ctx.data) },
      ];
    }
    if (ctx.type === 'job') {
      if (!selMember || !isOwnMember(selMember)) return [];
      return [
        { icon: Unlink, label: 'Remove Job from Account', danger: true, action: async () => {
            const { job, account: acc } = ctx.data;
            const jobId = job.id || job._id;
            const accId = acc.id || acc._id;
            const res = await setJobAccount(jobId, accId, 'unlink');
            if (res.success) {
              setAccountJobs(prev => ({ ...prev, [accId]: (prev[accId] || []).filter(j => (j.id || j._id) !== jobId) }));
              setAccounts(prev => prev.map(a => (a.id || a._id) === accId ? { ...a, jobCount: Math.max(0, (a.jobCount || 1) - 1) } : a));
              if ((selJob?.job?.id || selJob?.job?._id) === jobId && (selJob?.account?.id || selJob?.account?._id) === accId) {
                setSelJob(null);
              }
            }
          },
        },
      ];
    }
    return [];
  })();

  const handleAccountSave = async (payload) => {
    if (payload.id) {
      const res = await updateAccount(payload);
      if (res.success) setAccounts(prev => prev.map(a => (a.id || a._id) === res.account.id ? { ...a, ...res.account } : a));
    } else {
      const res = await createAccount(payload);
      if (res.success) {
        setAccounts(prev => [res.account, ...prev]);
        if (selMember) setMembers(prev => prev.map(m => m.id === selMember.id ? { ...m, accountCount: (m.accountCount || 0) + 1 } : m));
      }
    }
  };

  const readOnly = !selMember || !isOwnMember(selMember);

  // Own member always first
  const sortedMembers = (() => {
    if (!members.length) return members;
    const own  = members.filter(m => isOwnMember(m));
    const rest = members.filter(m => !isOwnMember(m));
    return [...own, ...rest];
  })();

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 112px)', overflow: 'hidden', userSelect: draggingExp ? 'none' : 'auto' }}>

      {/* Activity bar: member avatars */}
      {loadingMembers ? (
        <div style={{ width: 52, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 20, borderRight: '1px solid rgba(74,222,128,0.1)', background: 'rgba(3,10,6,0.85)' }}>
          <Loader size={16} className="animate-spin" style={{ color: '#4ade80' }} />
        </div>
      ) : (
        <MemberSidebar members={sortedMembers} selMember={selMember} onSelect={handleSelectMember} onContextMenu={(e, type, data) => setCtx({ x: e.clientX, y: e.clientY, type, data })} />
      )}

      {/* File explorer */}
      <div style={{ width: explorerWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(3,12,7,0.75)', overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid rgba(74,222,128,0.1)', flexShrink: 0 }}>
          <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Explorer</div>
          {selMember && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <div
                onClick={() => { setMemberStatsActive(true); setSelJob(null); }}
                style={{ color: memberStatsActive ? '#4ade80' : 'rgba(200,255,220,0.7)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: 'pointer', fontWeight: memberStatsActive ? 600 : 400 }}
                onMouseEnter={e => { if (!memberStatsActive) e.currentTarget.style.color = 'rgba(200,255,220,0.95)'; }}
                onMouseLeave={e => { if (!memberStatsActive) e.currentTarget.style.color = 'rgba(200,255,220,0.7)'; }}
              >
                {selMember.displayName || selMember.username}
              </div>
              {accounts.length > 0 && (
                <span style={{ color: 'rgba(134,239,172,0.4)', fontSize: 11, flexShrink: 0 }}>{accounts.length}</span>
              )}
            </div>
          )}
        </div>
        {loadingAccounts ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
            <Loader size={16} className="animate-spin" style={{ color: '#4ade80' }} />
          </div>
        ) : (
          <FileExplorer
            member={selMember}
            accounts={accounts}
            expanded={expanded}
            accountJobs={accountJobs}
            loadingJobs={loadingJobs}
            selJob={selJob}
            onToggleAccount={handleToggleAccount}
            onSelectJob={(job, acc) => { setSelJob({ job, account: acc }); setMemberStatsActive(false); }}
            onContextMenu={(e, type, data) => setCtx({ x: e.clientX, y: e.clientY, type, data })}
          />
        )}
      </div>

      {/* Drag handle between explorer and task panel */}
      <div
        onMouseDown={e => { e.preventDefault(); setDraggingExp(true); }}
        style={{
          width: 4, flexShrink: 0, cursor: 'col-resize', zIndex: 10,
          background: draggingExp ? 'rgba(74,222,128,0.35)' : 'rgba(74,222,128,0.1)',
          transition: draggingExp ? 'none' : 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.3)'; }}
        onMouseLeave={e => { if (!draggingExp) e.currentTarget.style.background = 'rgba(74,222,128,0.1)'; }}
      />

      {/* Task panel */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'rgba(3,10,6,0.4)' }}>
        {memberStatsActive && selMember ? (
          <MemberStatsPlaceholder member={selMember} />
        ) : selJob ? (
          <TaskPanel
            key={`${selJob.job.id || selJob.job._id}:${selJob.account.id || selJob.account._id}`}
            job={selJob.job}
            account={selJob.account}
            readOnly={readOnly}
            targetUsername={readOnly && selMember ? selMember.username : undefined}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <Code2 size={42} style={{ color: 'rgba(74,222,128,0.12)', margin: '0 auto 14px', display: 'block' }} />
              <div style={{ color: 'rgba(134,239,172,0.3)', fontSize: 13 }}>
                {!selMember ? 'Select a member to get started' : 'Expand an account and select a job'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctx && ctxItems.length > 0 && (
        <ContextMenu x={ctx.x} y={ctx.y} items={ctxItems} onClose={() => setCtx(null)} />
      )}

      {/* Modals */}
      {accountModal && (
        <AccountModal
          initial={accountModal.mode === 'edit' ? accountModal.account : null}
          onClose={() => setAccountModal(null)}
          onSave={handleAccountSave}
        />
      )}
      {addJobModal && (
        <JobsDialog
          account={addJobModal}
          onClose={() => setAddJobModal(null)}
          onDone={() => {
            const accId = addJobModal.id || addJobModal._id;
            listJobsByAccount(accId).then(r => {
              if (r.success) {
                setAccountJobs(prev => ({ ...prev, [accId]: r.jobs }));
                setAccounts(prev => prev.map(a => (a.id || a._id) === accId ? { ...a, jobCount: r.jobs.length } : a));
              }
            });
          }}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
