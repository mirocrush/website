import { useEffect, useState, useCallback } from 'react';
import {
  listAccounts, listJobs,
  addTaskBalanceEntry, listTaskBalanceEntries, deleteTaskBalanceEntry,
} from '../../api/reveloApi';
import {
  ChevronRight, Loader, AlertCircle, Plus, Trash2,
  BarChart2, CheckCircle, XCircle, Send,
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDT(dateStr) {
  const d = new Date(dateStr);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth()+1)}-${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

function toLocalDatetimeInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TYPE_CONFIG = {
  submitted: {
    label: 'Submitted', sign: +1,
    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.35)',
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
function SidebarItem({ label, sub, selected, onClick }) {
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
      <div style={{ minWidth: 0 }}>
        <div style={{
          color: selected ? '#4ade80' : 'rgba(200,255,220,0.8)',
          fontSize: 13, fontWeight: selected ? 600 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</div>
        {sub && (
          <div style={{ color: 'rgba(134,239,172,0.4)', fontSize: 11, marginTop: 1 }}>{sub}</div>
        )}
      </div>
      {selected && <ChevronRight size={14} style={{ color: '#4ade80', flexShrink: 0 }} />}
    </button>
  );
}

// ─── Add entry inline form ────────────────────────────────────────────────────
function AddEntryForm({ type, jobId, accountId, onAdded, onCancel }) {
  const c = TYPE_CONFIG[type];
  const [count, setCount] = useState('');
  const [note,  setNote]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    const n = parseInt(count, 10);
    if (!n || n < 1) { setError('Enter a valid number (≥ 1)'); return; }
    setSaving(true); setError('');
    try {
      const res = await addTaskBalanceEntry({ accountId, jobId, type, count: n, note });
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
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="number" min="1" placeholder="Count"
          value={count} onChange={e => setCount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          autoFocus
          style={{
            width: 90, padding: '5px 8px', borderRadius: 7, fontSize: 13,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)',
            color: '#bbf7d0', outline: 'none',
          }}
        />
        <input
          type="text" placeholder="Note (optional)"
          value={note} onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          style={{
            flex: 1, padding: '5px 8px', borderRadius: 7, fontSize: 13,
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

  const [addingType, setAddingType] = useState(null);  // 'submitted'|'approved'|'rejected'|null

  // date-range filter
  const now = new Date();
  const [fromDT, setFromDT] = useState('');
  const [toDT,   setToDT]   = useState('');

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
    listJobs()
      .then(r => {
        if (r.success) {
          const filtered = r.jobs.filter(j =>
            (j.accountId?.id || j.accountId?._id || j.accountId) ===
            (selAccount.id || selAccount._id)
          );
          setJobs(filtered);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
    setSelJob(null);
    setEntries([]);
  }, [selAccount]);

  // ── load entries ──────────────────────────────────────────────────────────
  const loadEntries = useCallback((jobId, from, to) => {
    if (!jobId) return;
    setLoadingEnt(true); setError('');
    const payload = { jobId };
    if (from) payload.from = new Date(from).toISOString();
    if (to)   payload.to   = new Date(to).toISOString();
    listTaskBalanceEntries(payload)
      .then(r => { if (r.success) setEntries(r.entries); else setError(r.message); })
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoadingEnt(false));
  }, []);

  useEffect(() => {
    if (selJob) loadEntries(selJob.id || selJob._id, fromDT, toDT);
  }, [selJob, loadEntries]); // eslint-disable-line

  const handleFilter = () => {
    if (selJob) loadEntries(selJob.id || selJob._id, fromDT, toDT);
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

  // ── compute stats from current entries list ───────────────────────────────
  const stats = entries.reduce(
    (acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + e.count;
      return acc;
    },
    { submitted: 0, approved: 0, rejected: 0 }
  );
  const balance = stats.submitted - stats.approved - stats.rejected;

  // ── filtered jobs for selected account ────────────────────────────────────
  const accountJobs = selAccount
    ? jobs.filter(j =>
        String(j.accountId?.id || j.accountId?._id || j.accountId) ===
        String(selAccount.id || selAccount._id)
      )
    : [];

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
      <div style={{ display: 'grid', gridTemplateColumns: '200px 200px 1fr', gap: 12, minHeight: 520 }}>

        {/* ── Accounts ── */}
        <div style={panelStyle}>
          <div style={panelHead}>Accounts</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
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
                  selected={(selAccount?.id || selAccount?._id) === (acc.id || acc._id)}
                  onClick={() => setSelAccount(acc)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Jobs ── */}
        <div style={panelStyle}>
          <div style={panelHead}>Jobs</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
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
                  label={job.title || job.name || 'Job'}
                  sub={job.status}
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
              {/* Stats bar */}
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid rgba(74,222,128,0.1)',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'rgba(200,255,220,0.8)',
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selJob.title || selJob.name}
                </div>
                {/* stat chips */}
                {['submitted','approved','rejected'].map(t => {
                  const c = TYPE_CONFIG[t];
                  return (
                    <div key={t} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px',
                      borderRadius: 99, background: c.bg, border: `1px solid ${c.border}`,
                      fontSize: 12,
                    }}>
                      <c.icon size={11} style={{ color: c.color }} />
                      <span style={{ color: c.color, fontWeight: 700 }}>{stats[t]}</span>
                      <span style={{ color: 'rgba(134,239,172,0.4)', fontSize: 10 }}>{c.label}</span>
                    </div>
                  );
                })}
                {/* Balance */}
                <div style={{
                  padding: '3px 12px', borderRadius: 99, fontWeight: 700, fontSize: 13,
                  background: balance >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                  border: `1px solid ${balance >= 0 ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
                  color: balance >= 0 ? '#4ade80' : '#f87171',
                }}>
                  Balance: {balance >= 0 ? '+' : ''}{balance}
                </div>
              </div>

              {/* Date-range filter + add buttons */}
              <div style={{
                padding: '10px 16px', borderBottom: '1px solid rgba(74,222,128,0.1)',
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0,
              }}>
                <input type="datetime-local" value={fromDT} onChange={e => setFromDT(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 7, fontSize: 12,
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)',
                    color: '#bbf7d0', outline: 'none' }} />
                <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 12 }}>→</span>
                <input type="datetime-local" value={toDT} onChange={e => setToDT(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 7, fontSize: 12,
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)',
                    color: '#bbf7d0', outline: 'none' }} />
                <button onClick={handleFilter}
                  style={{ padding: '4px 12px', borderRadius: 7, fontSize: 12,
                    background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
                    color: '#4ade80', cursor: 'pointer', fontWeight: 600 }}>
                  Filter
                </button>
                <button onClick={() => { setFromDT(''); setToDT(''); loadEntries(selJob.id || selJob._id, '', ''); }}
                  style={{ padding: '4px 10px', borderRadius: 7, fontSize: 12,
                    background: 'transparent', border: '1px solid rgba(74,222,128,0.15)',
                    color: 'rgba(134,239,172,0.5)', cursor: 'pointer' }}>
                  Clear
                </button>
                <div style={{ flex: 1 }} />
                {/* Add buttons */}
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
                    onAdded={handleAdded}
                    onCancel={() => setAddingType(null)}
                  />
                </div>
              )}

              {/* Entries list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px',
                display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    return (
                      <div key={entry.id || entry._id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 8, background: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(74,222,128,0.08)',
                      }}>
                        <TypeBadge type={entry.type} />
                        <span style={{ color: c.color, fontWeight: 700, fontSize: 15, minWidth: 36 }}>
                          {TYPE_CONFIG[entry.type].sign > 0 ? '+' : '-'}{entry.count}
                        </span>
                        {entry.note && (
                          <span style={{ flex: 1, color: 'rgba(200,255,220,0.55)', fontSize: 12,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.note}
                          </span>
                        )}
                        {!entry.note && <span style={{ flex: 1 }} />}
                        <span style={{ color: 'rgba(134,239,172,0.3)', fontSize: 11, flexShrink: 0 }}>
                          {fmtDT(entry.createdAt)}
                        </span>
                        <button onClick={() => handleDelete(entry)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'rgba(248,113,113,0.45)', padding: 2, lineHeight: 1,
                            transition: 'color 0.12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(248,113,113,0.45)'}
                          title="Delete">
                          <Trash2 size={13} />
                        </button>
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
