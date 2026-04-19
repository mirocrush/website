import React, { useEffect, useState, useCallback } from 'react';
import {
  listAccounts, createAccount, updateAccount, deleteAccount,
  listJobs, setJobAccount,
} from '../../api/reveloApi';
import {
  Plus, Edit2, Trash2, X, Globe, Shield, Loader, AlertCircle,
  Eye, EyeOff, Monitor, CreditCard, Briefcase, Search, Link, Unlink,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROTOCOLS = ['HTTP', 'HTTPS', 'SOCKS5', 'SSH'];

const ACCOUNT_STATUSES = [
  { key: 'fresh_new',        label: 'Fresh New',        bg: 'rgba(74,222,128,0.15)',  color: '#4ade80',  border: 'rgba(74,222,128,0.35)'  },
  { key: 'open_jobs',        label: 'Open Jobs',        bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa',  border: 'rgba(96,165,250,0.35)'  },
  { key: 'approved_tasks',   label: 'Approved Tasks',   bg: 'rgba(45,212,191,0.15)',  color: '#2dd4bf',  border: 'rgba(45,212,191,0.35)'  },
  { key: 'payment_attached', label: 'Payment Attached', bg: 'rgba(167,139,250,0.15)', color: '#a78bfa',  border: 'rgba(167,139,250,0.35)' },
  { key: 'earned_money',     label: 'Earned Money',     bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24',  border: 'rgba(251,191,36,0.35)'  },
  { key: 'suspended',        label: 'Suspended',        bg: 'rgba(248,113,113,0.15)', color: '#f87171',  border: 'rgba(248,113,113,0.35)' },
];

const JOB_STATUS_STYLE = {
  active:   { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)',  color: '#4ade80' },
  paused:   { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)',  color: '#fbbf24' },
  archived: { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', color: '#94a3b8' },
};

const EMPTY_FORM = {
  name: '', nationality: '', createdDate: '',
  connectionType: 'proxy',
  proxyHost: '', proxyPort: '', proxyAccount: '', proxyPassword: '', proxyProtocol: 'HTTP',
  remotePcHolder: '', remotePcNationality: '',
  idVerified: false, paymentVerified: false,
  bankHoldingStatus: '', revenueSharePercentage: '',
  statuses: [],
};

// ─── Small helpers ────────────────────────────────────────────────────────────

const inp = { background: 'rgba(3,18,9,0.6)', borderColor: 'rgba(74,222,128,0.2)', color: '#bbf7d0' };

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

function JobStatusBadge({ status }) {
  const c = JOB_STATUS_STYLE[status] || JOB_STATUS_STYLE.active;
  return (
    <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {status}
    </span>
  );
}

// ─── Jobs Dialog (global layer) ───────────────────────────────────────────────

function JobsDialog({ account, onClose }) {
  const [allJobs, setAllJobs]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search,  setSearch]    = useState('');
  const [busy,    setBusy]      = useState({});   // jobId → true while updating

  const accountId = account.id;
  const jobAccId  = (j) => String(j.accountId || '');

  const load = useCallback(() => {
    setLoading(true);
    listJobs()
      .then(r => { if (r.success) setAllJobs(r.jobs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const linkedJobs    = allJobs.filter(j => jobAccId(j) === accountId);
  const availableJobs = allJobs.filter(j => jobAccId(j) !== accountId);

  const q = search.toLowerCase();
  const filteredAvailable = q
    ? availableJobs.filter(j => (j.jobName || '').toLowerCase().includes(q))
    : availableJobs;

  const link = async (job) => {
    setBusy(b => ({ ...b, [job.id]: true }));
    try {
      const res = await setJobAccount(job.id, accountId);
      if (res.success) {
        setAllJobs(prev => prev.map(j => j.id === job.id ? res.job : j));
      }
    } finally {
      setBusy(b => ({ ...b, [job.id]: false }));
    }
  };

  const unlink = async (job) => {
    setBusy(b => ({ ...b, [job.id]: true }));
    try {
      const res = await setJobAccount(job.id, null);
      if (res.success) {
        setAllJobs(prev => prev.map(j => j.id === job.id ? res.job : j));
      }
    } finally {
      setBusy(b => ({ ...b, [job.id]: false }));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 680, maxHeight: '88vh',
        background: 'rgba(3,18,9,0.97)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 16, boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px', borderBottom: '1px solid rgba(74,222,128,0.1)', flexShrink: 0,
        }}>
          <Briefcase size={16} style={{ color: '#4ade80' }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 15 }}>
              Manage Jobs
            </div>
            <div style={{ color: 'rgba(134,239,172,0.45)', fontSize: 12 }}>
              {account.name}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(134,239,172,0.45)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
              <Loader size={22} className="animate-spin" style={{ color: '#4ade80' }} />
            </div>
          ) : (
            <>
              {/* ── Linked jobs ── */}
              <div>
                <div style={{ color: 'rgba(134,239,172,0.5)', fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Linked to this account ({linkedJobs.length})
                </div>
                {linkedJobs.length === 0 ? (
                  <div style={{ color: 'rgba(134,239,172,0.3)', fontSize: 13,
                    padding: '14px', textAlign: 'center',
                    background: 'rgba(0,0,0,0.2)', borderRadius: 10,
                    border: '1px solid rgba(74,222,128,0.08)' }}>
                    No jobs linked yet. Add some from below.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {linkedJobs.map(job => (
                      <div key={job.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px', borderRadius: 10,
                        background: 'rgba(74,222,128,0.07)',
                        border: '1px solid rgba(74,222,128,0.18)',
                      }}>
                        <Briefcase size={13} style={{ color: 'rgba(74,222,128,0.5)', flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'rgba(200,255,220,0.85)', fontSize: 13,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {job.jobName}
                        </span>
                        <JobStatusBadge status={job.status} />
                        {job.hourlyRate && (
                          <span style={{ color: 'rgba(134,239,172,0.4)', fontSize: 11, flexShrink: 0 }}>
                            ${job.hourlyRate}/hr
                          </span>
                        )}
                        <button
                          onClick={() => unlink(job)}
                          disabled={busy[job.id]}
                          title="Unlink from account"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
                            color: '#f87171', cursor: 'pointer', flexShrink: 0,
                            opacity: busy[job.id] ? 0.5 : 1,
                          }}>
                          {busy[job.id]
                            ? <Loader size={10} className="animate-spin" />
                            : <Unlink size={10} />}
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Available jobs ── */}
              <div>
                <div style={{ color: 'rgba(134,239,172,0.5)', fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Available jobs ({availableJobs.length})
                </div>

                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={13} style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'rgba(134,239,172,0.4)', pointerEvents: 'none',
                  }} />
                  <input
                    type="text" placeholder="Search jobs…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, fontSize: 13,
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(74,222,128,0.15)',
                      color: '#bbf7d0', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {filteredAvailable.length === 0 ? (
                  <div style={{ color: 'rgba(134,239,172,0.3)', fontSize: 13,
                    padding: '14px', textAlign: 'center',
                    background: 'rgba(0,0,0,0.2)', borderRadius: 10,
                    border: '1px solid rgba(74,222,128,0.08)' }}>
                    {search ? 'No jobs match your search.' : 'All jobs are already linked to accounts.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {filteredAvailable.map(job => {
                      const alreadyLinked = !!job.accountId;
                      return (
                        <div key={job.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 14px', borderRadius: 10,
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(74,222,128,0.08)',
                        }}>
                          <Briefcase size={13} style={{ color: 'rgba(74,222,128,0.35)', flexShrink: 0 }} />
                          <span style={{ flex: 1, color: 'rgba(200,255,220,0.7)', fontSize: 13,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {job.jobName}
                          </span>
                          <JobStatusBadge status={job.status} />
                          {alreadyLinked && (
                            <span style={{ color: 'rgba(251,191,36,0.6)', fontSize: 10,
                              padding: '1px 6px', borderRadius: 99,
                              border: '1px solid rgba(251,191,36,0.25)',
                              background: 'rgba(251,191,36,0.08)', flexShrink: 0 }}>
                              linked elsewhere
                            </span>
                          )}
                          {job.hourlyRate && (
                            <span style={{ color: 'rgba(134,239,172,0.4)', fontSize: 11, flexShrink: 0 }}>
                              ${job.hourlyRate}/hr
                            </span>
                          )}
                          <button
                            onClick={() => link(job)}
                            disabled={busy[job.id]}
                            title="Link to this account"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
                              color: '#4ade80', cursor: 'pointer', flexShrink: 0,
                              opacity: busy[job.id] ? 0.5 : 1,
                            }}>
                            {busy[job.id]
                              ? <Loader size={10} className="animate-spin" />
                              : <Link size={10} />}
                            Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid rgba(74,222,128,0.1)',
          display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
        }}>
          <button onClick={onClose}
            style={{ padding: '7px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
              color: '#4ade80', fontWeight: 600 }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AccountModal ─────────────────────────────────────────────────────────────

function AccountModal({ initial, onClose, onSave }) {
  const [form, setForm]         = useState(initial || EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [showPass, setShowPass] = useState(false);

  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setN = (k, v) => setForm(f => ({ ...f, [k]: isNaN(v) ? '' : v }));

  const toggleStatus = (key) =>
    setForm(f => ({
      ...f,
      statuses: f.statuses.includes(key)
        ? f.statuses.filter(s => s !== key)
        : [...f.statuses, key],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Account name is required'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        name: form.name,
        nationality: form.nationality,
        createdDate: form.createdDate || undefined,
        connectionType: form.connectionType,
        proxyDetail: form.connectionType === 'proxy' ? {
          host: form.proxyHost, port: form.proxyPort,
          account: form.proxyAccount, password: form.proxyPassword, protocol: form.proxyProtocol,
        } : {},
        remotePc: form.connectionType === 'remote_pc' ? {
          holderName: form.remotePcHolder, nationality: form.remotePcNationality,
        } : {},
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
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-xl flex flex-col"
        style={{ borderColor: 'rgba(74,222,128,0.2)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: '1px solid rgba(74,222,128,0.1)' }}>
          <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>
            {initial?.id ? 'Edit Account' : 'New Account'}
          </h2>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}
            className="hover:text-green-300 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          {err && (
            <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-xl"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
              <AlertCircle size={14} /> {err}
            </div>
          )}

          <form id="account-form" onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account Name *">
                <input className="input input-sm w-full" style={inp}
                  value={form.name} onChange={e => set('name', e.target.value)} placeholder="Account name" />
              </Field>
              <Field label="Nationality">
                <input className="input input-sm w-full" style={inp}
                  value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="e.g. US" />
              </Field>
            </div>
            <Field label="Created Date">
              <input type="date" className="input input-sm w-full" style={inp}
                value={form.createdDate} onChange={e => set('createdDate', e.target.value)} />
            </Field>

            <SectionTitle icon={Globe}>Connection Type</SectionTitle>
            <div className="flex gap-4">
              {[{ val: 'proxy', label: 'Proxy', Icon: Shield }, { val: 'remote_pc', label: 'Remote PC', Icon: Monitor }].map(({ val, label, Icon }) => (
                <label key={val} className="flex items-center gap-2 text-sm"
                  style={{ color: form.connectionType === val ? '#bbf7d0' : 'rgba(134,239,172,0.5)' }}>
                  <input type="radio" name="connectionType" value={val}
                    checked={form.connectionType === val} onChange={() => set('connectionType', val)}
                    className="radio radio-xs" style={{ accentColor: '#4ade80' }} />
                  <Icon size={13} /> {label}
                </label>
              ))}
            </div>

            {form.connectionType === 'proxy' && (
              <>
                <SectionTitle icon={Shield}>Proxy Details</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Host">
                    <input className="input input-sm w-full" style={inp}
                      value={form.proxyHost} onChange={e => set('proxyHost', e.target.value)} placeholder="proxy.host.com" />
                  </Field>
                  <Field label="Port">
                    <input className="input input-sm w-full" style={inp}
                      value={form.proxyPort} onChange={e => set('proxyPort', e.target.value)} placeholder="8080" />
                  </Field>
                  <Field label="Account">
                    <input className="input input-sm w-full" style={inp}
                      value={form.proxyAccount} onChange={e => set('proxyAccount', e.target.value)} placeholder="proxy account" />
                  </Field>
                  <Field label="Password">
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'}
                        className="input input-sm w-full pr-8" style={inp}
                        value={form.proxyPassword} onChange={e => set('proxyPassword', e.target.value)} />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        style={{ color: 'rgba(134,239,172,0.5)' }}>
                        {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </Field>
                </div>
                <Field label="Protocol">
                  <select className="input input-sm w-full" style={inp}
                    value={form.proxyProtocol} onChange={e => set('proxyProtocol', e.target.value)}>
                    {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </>
            )}

            {form.connectionType === 'remote_pc' && (
              <>
                <SectionTitle icon={Monitor}>Remote PC Details</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="PC Holder Name">
                    <input className="input input-sm w-full" style={inp}
                      value={form.remotePcHolder} onChange={e => set('remotePcHolder', e.target.value)} placeholder="Holder name" />
                  </Field>
                  <Field label="Nationality">
                    <input className="input input-sm w-full" style={inp}
                      value={form.remotePcNationality} onChange={e => set('remotePcNationality', e.target.value)} placeholder="e.g. US" />
                  </Field>
                </div>
              </>
            )}

            <SectionTitle icon={CreditCard}>Payment Details</SectionTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[{ key: 'idVerified', label: '① ID Verify Passed' }, { key: 'paymentVerified', label: '② Payment Verify Passed' }].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm"
                    style={{ color: form[key] ? '#bbf7d0' : 'rgba(134,239,172,0.5)' }}>
                    <input type="checkbox" className="checkbox checkbox-xs" style={{ accentColor: '#4ade80' }}
                      checked={form[key]} onChange={e => set(key, e.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="③ Bank Holding Status">
                  <select className="input input-sm w-full" style={inp}
                    value={form.bankHoldingStatus} onChange={e => set('bankHoldingStatus', e.target.value)}>
                    <option value="">— Not selected —</option>
                    <option value="citizen_holding">Citizen Holding Bank</option>
                    <option value="holding_myself">Holding Bank Myself</option>
                  </select>
                </Field>
                <Field label="④ Revenue Share (%)">
                  <input type="number" min="0" max="100" step="0.01" className="input input-sm w-full" style={inp}
                    value={form.revenueSharePercentage}
                    onChange={e => setN('revenueSharePercentage', e.target.value)}
                    placeholder="e.g. 30" />
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
                    style={{
                      background: active ? s.bg : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? s.border : 'rgba(74,222,128,0.1)'}`,
                      color: active ? s.color : 'rgba(134,239,172,0.35)',
                    }}>
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
          <button type="submit" form="account-form" disabled={saving}
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

// ─── Status badge (for table row) ────────────────────────────────────────────

function StatusBadge({ statusKey }) {
  const s = ACCOUNT_STATUSES.find(x => x.key === statusKey);
  if (!s) return null;
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {s.label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReveloAccounts() {
  const [accounts, setAccounts]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [modal, setModal]                 = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [jobsAccount, setJobsAccount]     = useState(null);   // account whose jobs dialog is open

  const load = async () => {
    setLoading(true);
    try {
      const d = await listAccounts();
      if (d.success) setAccounts(d.accounts);
      else setError(d.message);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (payload) => {
    if (payload.id) {
      const d = await updateAccount(payload);
      if (d.success) setAccounts(a => a.map(x => x.id === payload.id ? d.account : x));
    } else {
      const d = await createAccount(payload);
      if (d.success) setAccounts(a => [d.account, ...a]);
    }
  };

  const handleDelete = async (id) => {
    await deleteAccount(id);
    setAccounts(a => a.filter(x => x.id !== id));
    setConfirmDelete(null);
  };

  const toForm = (acc) => ({
    id: acc.id,
    name: acc.name,
    nationality: acc.nationality || '',
    createdDate: acc.createdDate ? acc.createdDate.slice(0, 10) : '',
    connectionType: acc.connectionType || 'proxy',
    proxyHost:           acc.proxyDetail?.host     || '',
    proxyPort:           acc.proxyDetail?.port     || '',
    proxyAccount:        acc.proxyDetail?.account  || '',
    proxyPassword:       acc.proxyDetail?.password || '',
    proxyProtocol:       (acc.proxyDetail?.protocol || 'HTTP').toUpperCase(),
    remotePcHolder:      acc.remotePc?.holderName  || '',
    remotePcNationality: acc.remotePc?.nationality || '',
    idVerified:             acc.paymentDetails?.idVerified      || false,
    paymentVerified:        acc.paymentDetails?.paymentVerified || false,
    bankHoldingStatus:      acc.paymentDetails?.bankHoldingStatus || '',
    revenueSharePercentage: acc.paymentDetails?.revenueSharePercentage?.toString() || '',
    statuses: acc.statuses || [],
  });

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#bbf7d0' }}>Accounts</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(134,239,172,0.5)' }}>
            Manage your Revelo accounts
          </p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
          <Plus size={15} /> New Account
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader size={28} className="animate-spin" style={{ color: '#4ade80' }} />
        </div>
      ) : accounts.length === 0 ? (
        <div className="glass-card rounded-2xl border p-12 text-center"
          style={{ borderColor: 'rgba(74,222,128,0.15)' }}>
          <Globe size={40} className="mx-auto mb-3" style={{ color: 'rgba(74,222,128,0.3)' }} />
          <div className="text-sm" style={{ color: 'rgba(134,239,172,0.5)' }}>
            No accounts yet. Create your first account to get started.
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(74,222,128,0.05)', borderBottom: '1px solid rgba(74,222,128,0.1)' }}>
                {['Name', 'Nationality', 'Created', 'Connection', 'Statuses', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium"
                    style={{ color: 'rgba(134,239,172,0.5)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id}
                  style={{ borderBottom: '1px solid rgba(74,222,128,0.05)' }}
                  className="hover:bg-green-950/10 transition-colors">
                  <td className="py-3 px-4 font-medium" style={{ color: '#bbf7d0' }}>{acc.name}</td>
                  <td className="py-3 px-4" style={{ color: 'rgba(134,239,172,0.7)' }}>
                    {acc.nationality || '—'}
                  </td>
                  <td className="py-3 px-4" style={{ color: 'rgba(134,239,172,0.6)' }}>
                    {acc.createdDate ? new Date(acc.createdDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4">
                    {acc.connectionType === 'remote_pc' ? (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(96,165,250,0.8)' }}>
                        <Monitor size={11} /> Remote PC
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs"
                        style={{ color: acc.proxyDetail?.host ? 'rgba(134,239,172,0.7)' : 'rgba(134,239,172,0.3)' }}>
                        <Shield size={11} />
                        {acc.proxyDetail?.host
                          ? `${acc.proxyDetail.host}:${acc.proxyDetail.port}`
                          : 'No proxy'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(acc.statuses || []).length === 0
                        ? <span style={{ color: 'rgba(134,239,172,0.25)' }} className="text-xs">—</span>
                        : (acc.statuses || []).map(s => <StatusBadge key={s} statusKey={s} />)
                      }
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {/* Jobs button */}
                      <button
                        onClick={() => setJobsAccount(acc)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}
                        title="Manage Jobs"
                      >
                        <Briefcase size={13} />
                      </button>
                      {/* Edit button */}
                      <button
                        onClick={() => setModal(toForm(acc))}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      {/* Delete */}
                      {confirmDelete === acc.id ? (
                        <button onClick={() => handleDelete(acc.id)}
                          className="px-2 py-1 rounded-lg text-xs font-medium transition-all"
                          style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#fca5a5' }}>
                          Confirm?
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDelete(acc.id)}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
                          title="Delete">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Account create/edit modal */}
      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <AccountModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Jobs dialog — global layer */}
      {jobsAccount && (
        <JobsDialog
          account={jobsAccount}
          onClose={() => setJobsAccount(null)}
        />
      )}
    </div>
  );
}
