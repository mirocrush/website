import { useEffect, useState, useCallback } from 'react';
import {
  listTasks, createTask, updateTask, deleteTask,
  listAccounts, listJobs,
} from '../../api/reveloApi';
import {
  Plus, Edit2, Trash2, X, Search, Filter, ChevronLeft, ChevronRight,
  Loader, AlertCircle, CheckSquare, Calendar,
} from 'lucide-react';

const STATUS_COLORS = {
  pending:   { bg: 'rgba(250,204,21,0.15)',  border: 'rgba(250,204,21,0.4)',  text: '#fde047' },
  active:    { bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.4)',  text: '#4ade80' },
  completed: { bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.4)',  text: '#93c5fd' },
  cancelled: { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)', text: '#fca5a5' },
};

const FLAG_MAP = {
  US: '🇺🇸', UK: '🇬🇧', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', FR: '🇫🇷',
  IN: '🇮🇳', JP: '🇯🇵', CN: '🇨🇳', BR: '🇧🇷', MX: '🇲🇽', ES: '🇪🇸', IT: '🇮🇹',
  NL: '🇳🇱', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', PL: '🇵🇱', RU: '🇷🇺',
  UA: '🇺🇦', TR: '🇹🇷', KR: '🇰🇷', SG: '🇸🇬', NZ: '🇳🇿', ZA: '🇿🇦', NG: '🇳🇬',
};

function getFlag(nationality) {
  if (!nationality) return '';
  const code = nationality.trim().toUpperCase().slice(0, 2);
  return FLAG_MAP[code] || '';
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {status}
    </span>
  );
}

const inputStyle = {
  background: 'rgba(3,18,9,0.6)',
  borderColor: 'rgba(74,222,128,0.2)',
  color: '#bbf7d0',
};

// ─── 2-Step Create Modal ──────────────────────────────────────────────────────

function CreateTaskModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState([]);
  const [jobs, setJobs]         = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedJob, setSelectedJob]         = useState(null);
  const [startDate, setStartDate]             = useState('');
  const [status, setStatus]                   = useState('pending');
  const [accSearch, setAccSearch]             = useState('');
  const [jobSearch, setJobSearch]             = useState('');
  const [saving, setSaving]                   = useState(false);
  const [err, setErr]                         = useState('');

  useEffect(() => {
    Promise.all([listAccounts(), listJobs()])
      .then(([ad, jd]) => {
        if (ad.success) setAccounts(ad.accounts);
        if (jd.success) setJobs(jd.jobs);
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoadingData(false));
  }, []);

  const filteredAccounts = accounts.filter(a =>
    a.name.toLowerCase().includes(accSearch.toLowerCase())
  );
  const filteredJobs = jobs.filter(j =>
    j.jobName.toLowerCase().includes(jobSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedAccount || !selectedJob) { setErr('Select account and job'); return; }
    setSaving(true); setErr('');
    try {
      const d = await createTask({
        accountId: selectedAccount.id,
        jobId: selectedJob.id,
        startDate: startDate || undefined,
        status,
      });
      if (d.success) { onCreated(d.task); onClose(); }
      else setErr(d.message);
    } catch (e) {
      setErr(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-lg p-6 mx-4 max-h-[90vh] flex flex-col"
        style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>New Task</h2>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(134,239,172,0.5)' }}>Step {step} of 2</div>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-5">
          {[1, 2].map(s => (
            <div key={s} className="flex-1 h-1 rounded-full transition-all"
              style={{ background: s <= step ? '#4ade80' : 'rgba(74,222,128,0.15)' }} />
          ))}
        </div>

        {err && (
          <div className="flex items-center gap-2 text-sm mb-3 p-3 rounded-xl"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
            <AlertCircle size={14} /> {err}
          </div>
        )}

        {loadingData ? (
          <div className="flex justify-center py-8">
            <Loader size={24} className="animate-spin" style={{ color: '#4ade80' }} />
          </div>
        ) : step === 1 ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="text-sm font-medium mb-3" style={{ color: '#bbf7d0' }}>Select Account</div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'rgba(134,239,172,0.4)' }} />
              <input className="input input-sm w-full pl-8" style={inputStyle}
                value={accSearch} onChange={e => setAccSearch(e.target.value)} placeholder="Search accounts…" />
            </div>
            <div className="overflow-y-auto space-y-2 flex-1 pr-1" style={{ maxHeight: '280px' }}>
              {filteredAccounts.length === 0 ? (
                <div className="text-sm text-center py-8" style={{ color: 'rgba(134,239,172,0.4)' }}>
                  No accounts found
                </div>
              ) : filteredAccounts.map(a => (
                <button key={a.id} onClick={() => setSelectedAccount(a)}
                  className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: selectedAccount?.id === a.id ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.05)',
                    border: `1px solid ${selectedAccount?.id === a.id ? 'rgba(74,222,128,0.5)' : 'rgba(74,222,128,0.1)'}`,
                  }}>
                  <div className="text-sm font-medium" style={{ color: '#bbf7d0' }}>
                    {getFlag(a.nationality)} {a.name}
                  </div>
                  {a.nationality && (
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(134,239,172,0.5)' }}>
                      {a.nationality}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div>
              <div className="text-sm font-medium mb-2" style={{ color: '#bbf7d0' }}>Select Job</div>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(134,239,172,0.4)' }} />
                <input className="input input-sm w-full pl-8" style={inputStyle}
                  value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder="Search jobs…" />
              </div>
              <div className="overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight: '180px' }}>
                {filteredJobs.map(j => (
                  <button key={j.id} onClick={() => setSelectedJob(j)}
                    className="w-full text-left px-3 py-2 rounded-xl transition-all"
                    style={{
                      background: selectedJob?.id === j.id ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.05)',
                      border: `1px solid ${selectedJob?.id === j.id ? 'rgba(74,222,128,0.5)' : 'rgba(74,222,128,0.1)'}`,
                    }}>
                    <div className="text-sm font-medium" style={{ color: '#bbf7d0' }}>{j.jobName}</div>
                    {j.hourlyRate && (
                      <div className="text-xs" style={{ color: 'rgba(134,239,172,0.5)' }}>
                        ${j.hourlyRate}/hr
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Start Date</label>
                <input type="date" className="input input-sm w-full" style={inputStyle}
                  value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Status</label>
                <select className="input input-sm w-full" style={inputStyle}
                  value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Summary */}
            {selectedAccount && selectedJob && (
              <div className="rounded-xl p-3 text-xs space-y-1"
                style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
                <div className="font-medium mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Summary</div>
                <div style={{ color: '#bbf7d0' }}>Account: {selectedAccount.name}</div>
                <div style={{ color: '#bbf7d0' }}>Job: {selectedJob.jobName}</div>
                <div style={{ color: '#bbf7d0' }}>Status: {status}</div>
                {startDate && <div style={{ color: '#bbf7d0' }}>Start: {startDate}</div>}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.6)' }}>
                Cancel
              </button>
              <button onClick={() => { if (!selectedAccount) { setErr('Select an account'); return; } setErr(''); setStep(2); }}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
                Next →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setStep(1); setErr(''); }} className="flex-1 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.6)' }}>
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
                {saving && <Loader size={14} className="animate-spin" />}
                {saving ? 'Creating…' : 'Create Task'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditTaskModal({ task, onClose, onSaved }) {
  const [startDate, setStartDate] = useState(
    task.startDate ? task.startDate.slice(0, 10) : ''
  );
  const [status, setStatus] = useState(task.status || 'pending');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const d = await updateTask({ id: task.id, startDate: startDate || undefined, status });
      if (d.success) { onSaved(d.task); onClose(); }
      else setErr(d.message);
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-sm p-6 mx-4"
        style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>Edit Task</h2>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}><X size={18} /></button>
        </div>
        <div className="text-xs mb-4 p-2 rounded-lg" style={{ background: 'rgba(74,222,128,0.05)', color: 'rgba(134,239,172,0.6)' }}>
          {task.accountId?.name} → {task.jobId?.jobName}
        </div>
        {err && (
          <div className="flex items-center gap-2 text-sm mb-3 p-3 rounded-xl"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
            <AlertCircle size={14} /> {err}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Start Date</label>
            <input type="date" className="input input-sm w-full" style={inputStyle}
              value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Status</label>
            <select className="input input-sm w-full" style={inputStyle}
              value={status} onChange={e => setStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.6)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
              {saving && <Loader size={14} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const LIMIT = 10;

export default function ReveloTasks() {
  const [tasks, setTasks]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort]           = useState('newest');
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const d = await listTasks({
        search: search || undefined,
        status: statusFilter || undefined,
        sort,
        page: p,
        limit: LIMIT,
      });
      if (d.success) {
        setTasks(d.tasks);
        setTotal(d.total);
      } else {
        setError(d.message);
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sort, page]);

  useEffect(() => { load(page); }, [page]);

  const handleSearch = () => { setPage(1); load(1); };

  const handleDelete = async (id) => {
    await deleteTask(id);
    setTasks(t => t.filter(x => x.id !== id));
    setTotal(n => n - 1);
    setConfirmDeleteId(null);
  };

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#bbf7d0' }}>Tasks</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(134,239,172,0.5)' }}>
            {total} task{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
          <Plus size={15} /> New Task
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'rgba(134,239,172,0.4)' }} />
          <input className="input input-sm w-full pl-8" style={inputStyle}
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by account or job…" />
        </div>
        <select className="input input-sm" style={{ ...inputStyle, minWidth: '130px' }}
          value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); setTimeout(() => load(1), 0); }}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="input input-sm" style={{ ...inputStyle, minWidth: '130px' }}
          value={sort} onChange={e => { setSort(e.target.value); setPage(1); setTimeout(() => load(1), 0); }}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="start-date">By Start Date</option>
        </select>
        <button onClick={handleSearch}
          className="px-3 py-1.5 rounded-xl text-sm flex items-center gap-1.5"
          style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
          <Filter size={13} /> Apply
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader size={28} className="animate-spin" style={{ color: '#4ade80' }} />
        </div>
      ) : tasks.length === 0 ? (
        <div className="glass-card rounded-2xl border p-12 text-center"
          style={{ borderColor: 'rgba(74,222,128,0.15)' }}>
          <CheckSquare size={40} className="mx-auto mb-3" style={{ color: 'rgba(74,222,128,0.3)' }} />
          <div className="text-sm" style={{ color: 'rgba(134,239,172,0.5)' }}>
            No tasks found. Create one to get started.
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(74,222,128,0.05)', borderBottom: '1px solid rgba(74,222,128,0.1)' }}>
                  {['#', 'Account', 'Job', 'Start Date', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 font-medium whitespace-nowrap"
                      style={{ color: 'rgba(134,239,172,0.5)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, i) => (
                  <tr key={task.id} style={{ borderBottom: '1px solid rgba(74,222,128,0.05)' }}
                    className="hover:bg-green-950/10 transition-colors">
                    <td className="py-3 px-4" style={{ color: 'rgba(134,239,172,0.4)' }}>
                      {(page - 1) * LIMIT + i + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium" style={{ color: '#bbf7d0' }}>
                        {getFlag(task.accountId?.nationality)} {task.accountId?.name || '—'}
                      </div>
                      {task.accountId?.nationality && (
                        <div className="text-xs" style={{ color: 'rgba(134,239,172,0.4)' }}>
                          {task.accountId.nationality}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div style={{ color: '#bbf7d0' }}>{task.jobId?.jobName || '—'}</div>
                      {task.jobId?.hourlyRate && (
                        <div className="text-xs" style={{ color: 'rgba(134,239,172,0.4)' }}>
                          ${task.jobId.hourlyRate}/hr
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'rgba(134,239,172,0.6)' }}>
                      {task.startDate ? (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> {new Date(task.startDate).toLocaleDateString()}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'rgba(134,239,172,0.5)' }}>
                      {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setEditTask(task)}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
                          title="Edit">
                          <Edit2 size={13} />
                        </button>
                        {confirmDeleteId === task.id ? (
                          <button onClick={() => handleDelete(task.id)}
                            className="px-2 py-1 rounded-lg text-xs font-medium"
                            style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#fca5a5' }}>
                            Confirm?
                          </button>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(task.id)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: '1px solid rgba(74,222,128,0.1)' }}>
              <div className="text-xs" style={{ color: 'rgba(134,239,172,0.5)' }}>
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg transition-all disabled:opacity-30"
                  style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pg = i + 1;
                  if (totalPages > 5) {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    pg = start + i;
                  }
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: page === pg ? 'rgba(74,222,128,0.25)' : 'rgba(74,222,128,0.05)',
                        border: `1px solid ${page === pg ? 'rgba(74,222,128,0.5)' : 'rgba(74,222,128,0.1)'}`,
                        color: page === pg ? '#4ade80' : 'rgba(134,239,172,0.6)',
                      }}>
                      {pg}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg transition-all disabled:opacity-30"
                  style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={task => { setTasks(t => [task, ...t]); setTotal(n => n + 1); }}
        />
      )}

      {editTask && (
        <EditTaskModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSaved={updated => setTasks(t => t.map(x => x.id === updated.id ? updated : x))}
        />
      )}
    </div>
  );
}
