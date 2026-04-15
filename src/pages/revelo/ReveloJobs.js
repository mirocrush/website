import { useEffect, useState } from 'react';
import {
  listJobs, createJob, updateJob, deleteJob, requestJobEdit, handleEditRequest,
} from '../../api/reveloApi';
import { useAuth } from '../../context/AuthContext';
import {
  Plus, Edit2, Trash2, X, Briefcase, DollarSign, Clock, Zap,
  Loader, AlertCircle, Check, ChevronDown, ChevronUp, MessageSquare,
} from 'lucide-react';

const JOB_FIELDS = [
  { key: 'jobName',           label: 'Job Name',         type: 'text',   required: true },
  { key: 'jobDescription',    label: 'Description',      type: 'textarea' },
  { key: 'hourlyRate',        label: 'Hourly Rate ($)',   type: 'number' },
  { key: 'jobMaxDuration',    label: 'Max Duration (h)',  type: 'number' },
  { key: 'jobMaxPayableTime', label: 'Max Payable (h)',   type: 'number' },
  { key: 'jobExpectedTime',   label: 'Expected Time (h)', type: 'number' },
];

const EMPTY_JOB = {
  jobName: '', jobDescription: '', hourlyRate: '', jobMaxDuration: '',
  jobMaxPayableTime: '', jobExpectedTime: '', leaders: '', assets: '',
  term: '', learningCurve: false, status: 'active',
};

const inputStyle = {
  background: 'rgba(3,18,9,0.6)',
  borderColor: 'rgba(74,222,128,0.2)',
  color: '#bbf7d0',
};

function StatusBadge({ status }) {
  const m = {
    active:   { bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.4)',  text: '#4ade80' },
    paused:   { bg: 'rgba(250,204,21,0.15)',  border: 'rgba(250,204,21,0.4)',  text: '#fde047' },
    archived: { bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.4)', text: '#94a3b8' },
  };
  const c = m[status] || m.active;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {status}
    </span>
  );
}

function TermBadge({ term }) {
  if (!term) return null;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{
        background: term === 'short' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)',
        border: `1px solid ${term === 'short' ? 'rgba(96,165,250,0.4)' : 'rgba(167,139,250,0.4)'}`,
        color: term === 'short' ? '#93c5fd' : '#c4b5fd',
      }}>
      {term}
    </span>
  );
}

function JobModal({ initial, onClose, onSave, title }) {
  const [form, setForm] = useState(initial || EMPTY_JOB);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.jobName.trim()) { setErr('Job name is required'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        ...form,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        jobMaxDuration: form.jobMaxDuration ? Number(form.jobMaxDuration) : undefined,
        jobMaxPayableTime: form.jobMaxPayableTime ? Number(form.jobMaxPayableTime) : undefined,
        jobExpectedTime: form.jobExpectedTime ? Number(form.jobExpectedTime) : undefined,
        leaders: typeof form.leaders === 'string' ? form.leaders.split(',').map(s => s.trim()).filter(Boolean) : form.leaders,
        assets:  typeof form.assets  === 'string' ? form.assets.split(',').map(s => s.trim()).filter(Boolean) : form.assets,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-lg p-6 mx-4 max-h-[90vh] overflow-y-auto"
        style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}><X size={18} /></button>
        </div>
        {err && (
          <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-xl"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
            <AlertCircle size={14} /> {err}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {JOB_FIELDS.map(f => (
              <div key={f.key} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>
                  {f.label}{f.required ? ' *' : ''}
                </label>
                {f.type === 'textarea' ? (
                  <textarea className="input w-full rounded-xl p-2 text-sm resize-none" rows={3}
                    style={inputStyle} value={form[f.key] || ''}
                    onChange={e => set(f.key, e.target.value)} />
                ) : (
                  <input className="input input-sm w-full" style={inputStyle}
                    type={f.type} value={form[f.key] || ''}
                    onChange={e => set(f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Term</label>
              <select className="input input-sm w-full" style={inputStyle}
                value={form.term || ''} onChange={e => set('term', e.target.value)}>
                <option value="">None</option>
                <option value="short">Short</option>
                <option value="long">Long</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Status</label>
              <select className="input input-sm w-full" style={inputStyle}
                value={form.status || 'active'} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>
              Leaders (comma-separated)
            </label>
            <input className="input input-sm w-full" style={inputStyle}
              value={Array.isArray(form.leaders) ? form.leaders.join(', ') : form.leaders || ''}
              onChange={e => set('leaders', e.target.value)} placeholder="Alice, Bob" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>
              Assets (comma-separated)
            </label>
            <input className="input input-sm w-full" style={inputStyle}
              value={Array.isArray(form.assets) ? form.assets.join(', ') : form.assets || ''}
              onChange={e => set('assets', e.target.value)} placeholder="Figma, Notion" />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="lc" checked={!!form.learningCurve}
              onChange={e => set('learningCurve', e.target.checked)}
              className="checkbox checkbox-sm" style={{ accentColor: '#4ade80' }} />
            <label htmlFor="lc" className="text-sm cursor-pointer" style={{ color: 'rgba(134,239,172,0.7)' }}>
              Learning Curve required
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.6)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
              {saving && <Loader size={14} className="animate-spin" />}
              {saving ? 'Saving…' : (initial?.id ? 'Save Changes' : 'Create Job')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestEditModal({ job, onClose, onSubmit }) {
  const [form, setForm] = useState({ jobName: '', hourlyRate: '', jobDescription: '', status: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const changes = {};
      if (form.jobName.trim())      changes.jobName      = form.jobName.trim();
      if (form.hourlyRate !== '')    changes.hourlyRate   = Number(form.hourlyRate);
      if (form.jobDescription.trim()) changes.jobDescription = form.jobDescription.trim();
      if (form.status)               changes.status       = form.status;
      if (Object.keys(changes).length === 0) { setErr('Please specify at least one change'); setSaving(false); return; }
      await onSubmit({ jobId: job.id, changes, message: form.message });
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-md p-6 mx-4"
        style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>Request Edit</h2>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}><X size={18} /></button>
        </div>
        <div className="text-xs mb-4 p-2 rounded-lg" style={{ background: 'rgba(74,222,128,0.05)', color: 'rgba(134,239,172,0.6)' }}>
          Requesting edit on: <span style={{ color: '#bbf7d0' }}>{job.jobName}</span>
        </div>
        {err && (
          <div className="flex items-center gap-2 text-sm mb-3 p-3 rounded-xl"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
            <AlertCircle size={14} /> {err}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>New Job Name</label>
            <input className="input input-sm w-full" style={inputStyle}
              value={form.jobName} onChange={e => set('jobName', e.target.value)} placeholder="Leave blank to keep" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>New Hourly Rate ($)</label>
            <input type="number" className="input input-sm w-full" style={inputStyle}
              value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value)} placeholder="Leave blank to keep" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>New Description</label>
            <textarea className="input w-full rounded-xl p-2 text-sm resize-none" rows={2}
              style={inputStyle} value={form.jobDescription}
              onChange={e => set('jobDescription', e.target.value)} placeholder="Leave blank to keep" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>New Status</label>
            <select className="input input-sm w-full" style={inputStyle}
              value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="">Keep current</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Message to Owner</label>
            <textarea className="input w-full rounded-xl p-2 text-sm resize-none" rows={2}
              style={inputStyle} value={form.message} onChange={e => set('message', e.target.value)}
              placeholder="Explain your request..." />
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
              {saving ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRequestsPanel({ job, userId, onHandle }) {
  const pending = (job.editRequests || []).filter(r => r.status === 'pending');
  const isOwner = job.creatorId?.id === userId || job.creatorId?._id === userId ||
                  (typeof job.creatorId === 'string' && job.creatorId === userId);
  if (!isOwner || pending.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium" style={{ color: 'rgba(134,239,172,0.5)' }}>
        Pending Edit Requests ({pending.length})
      </div>
      {pending.map(r => (
        <div key={r._id || r.id}
          className="rounded-xl p-3 text-xs space-y-1"
          style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.1)' }}>
          <div className="flex items-center justify-between">
            <span style={{ color: '#bbf7d0' }}>{r.requesterName}</span>
            <div className="flex gap-1">
              <button
                onClick={() => onHandle(job.id, r._id || r.id, 'accept')}
                className="p-1 rounded-lg"
                style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
                title="Accept"
              >
                <Check size={12} />
              </button>
              <button
                onClick={() => onHandle(job.id, r._id || r.id, 'reject')}
                className="p-1 rounded-lg"
                style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                title="Reject"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          {r.message && <div style={{ color: 'rgba(134,239,172,0.6)' }}>"{r.message}"</div>}
          <div style={{ color: 'rgba(134,239,172,0.4)' }}>
            Changes: {Object.keys(r.changes || {}).join(', ') || 'none specified'}
          </div>
        </div>
      ))}
    </div>
  );
}

function JobCard({ job, userId, onEdit, onDelete, onRequestEdit, onHandle, confirmDeleteId, onSetConfirmDelete }) {
  const isOwner = job.creatorId?.id === userId || job.creatorId?._id === userId ||
                  (typeof job.creatorId === 'string' && job.creatorId === userId);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card rounded-2xl border p-5" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold" style={{ color: '#bbf7d0' }}>{job.jobName}</h3>
            {isOwner && (
              <span className="px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
                You
              </span>
            )}
            <StatusBadge status={job.status} />
            {job.term && <TermBadge term={job.term} />}
            {job.learningCurve && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)', color: '#fde047' }}>
                <Zap size={10} /> Learning Curve
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs" style={{ color: 'rgba(134,239,172,0.5)' }}>
              by {job.creatorId?.displayName || job.creatorId?.username || job.creatorName || 'Unknown'}
            </span>
            {job.hourlyRate && (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#4ade80' }}>
                <DollarSign size={11} />{job.hourlyRate}/hr
              </span>
            )}
            {job.jobExpectedTime && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(134,239,172,0.5)' }}>
                <Clock size={11} />{job.jobExpectedTime}h expected
              </span>
            )}
          </div>
          {job.jobDescription && (
            <p className="text-xs mt-2 line-clamp-2" style={{ color: 'rgba(134,239,172,0.6)' }}>
              {job.jobDescription}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isOwner ? (
            <>
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(74,222,128,0.05)', color: 'rgba(134,239,172,0.5)', border: '1px solid rgba(74,222,128,0.15)' }}
                title="View requests"
              >
                <MessageSquare size={13} />
              </button>
              <button onClick={() => onEdit(job)} className="p-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
                title="Edit">
                <Edit2 size={13} />
              </button>
              {confirmDeleteId === job.id ? (
                <button onClick={() => onDelete(job.id)}
                  className="px-2 py-1 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#fca5a5' }}>
                  Confirm?
                </button>
              ) : (
                <button onClick={() => onSetConfirmDelete(job.id)}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
                  title="Delete">
                  <Trash2 size={13} />
                </button>
              )}
            </>
          ) : (
            <button onClick={() => onRequestEdit(job)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#93c5fd' }}>
              <Edit2 size={12} /> Request Edit
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <EditRequestsPanel job={job} userId={userId} onHandle={onHandle} />
      )}
    </div>
  );
}

export default function ReveloJobs() {
  const { user } = useAuth();
  const userId = user?._id || user?.id;

  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState(null);
  const [requestModal, setRequestModal] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await listJobs();
      if (d.success) setJobs(d.jobs);
      else setError(d.message);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toForm = (job) => ({
    id: job.id,
    jobName: job.jobName || '',
    jobDescription: job.jobDescription || '',
    hourlyRate: job.hourlyRate || '',
    jobMaxDuration: job.jobMaxDuration || '',
    jobMaxPayableTime: job.jobMaxPayableTime || '',
    jobExpectedTime: job.jobExpectedTime || '',
    leaders: Array.isArray(job.leaders) ? job.leaders.join(', ') : job.leaders || '',
    assets:  Array.isArray(job.assets)  ? job.assets.join(', ')  : job.assets  || '',
    term: job.term || '',
    learningCurve: !!job.learningCurve,
    status: job.status || 'active',
  });

  const handleSave = async (payload) => {
    if (payload.id) {
      const d = await updateJob(payload);
      if (d.success) setJobs(j => j.map(x => x.id === payload.id ? d.job : x));
    } else {
      const d = await createJob(payload);
      if (d.success) setJobs(j => [d.job, ...j]);
    }
  };

  const handleDelete = async (id) => {
    await deleteJob(id);
    setJobs(j => j.filter(x => x.id !== id));
    setConfirmDeleteId(null);
  };

  const handleRequestEdit = async (data) => {
    await requestJobEdit(data);
  };

  const handleEditRequest = async (jobId, requestId, action) => {
    const d = await handleEditRequest({ jobId, requestId, action });
    if (d.success) setJobs(j => j.map(x => x.id === jobId ? d.job : x));
  };

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#bbf7d0' }}>Jobs</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(134,239,172,0.5)' }}>
            Browse and manage Revelo jobs
          </p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
          <Plus size={15} /> New Job
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
      ) : jobs.length === 0 ? (
        <div className="glass-card rounded-2xl border p-12 text-center"
          style={{ borderColor: 'rgba(74,222,128,0.15)' }}>
          <Briefcase size={40} className="mx-auto mb-3" style={{ color: 'rgba(74,222,128,0.3)' }} />
          <div className="text-sm" style={{ color: 'rgba(134,239,172,0.5)' }}>
            No jobs yet. Create the first one!
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              userId={userId}
              onEdit={j => setModal(toForm(j))}
              onDelete={handleDelete}
              onRequestEdit={j => setRequestModal(j)}
              onHandle={async (jobId, requestId, action) => {
                const d = await handleEditRequest({ jobId, requestId, action });
                if (d?.success) setJobs(prev => prev.map(x => x.id === jobId ? d.job : x));
              }}
              confirmDeleteId={confirmDeleteId}
              onSetConfirmDelete={setConfirmDeleteId}
            />
          ))}
        </div>
      )}

      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <JobModal
          initial={modal === 'new' ? null : modal}
          title={modal === 'new' ? 'New Job' : 'Edit Job'}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {requestModal && (
        <RequestEditModal
          job={requestModal}
          onClose={() => setRequestModal(null)}
          onSubmit={handleRequestEdit}
        />
      )}
    </div>
  );
}
