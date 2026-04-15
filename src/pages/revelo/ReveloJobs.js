import { useEffect, useState } from 'react';
import {
  listJobs, createJob, updateJob, deleteJob, requestJobEdit, handleEditRequest,
  uploadAssets,
} from '../../api/reveloApi';
import { useAuth } from '../../context/AuthContext';
import {
  Plus, Edit2, Trash2, X, Briefcase, DollarSign, Clock, Zap,
  Loader, AlertCircle, Check, MessageSquare, Upload, Download, FileText,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const inputStyle = {
  background: 'rgba(3,18,9,0.6)',
  borderColor: 'rgba(74,222,128,0.2)',
  color: '#bbf7d0',
};

const labelStyle = { color: 'rgba(134,239,172,0.6)' };

// ─── Badge components ─────────────────────────────────────────────────────────

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

// ─── JobModal ─────────────────────────────────────────────────────────────────

function JobModal({ initial, onClose, onSave, title }) {
  const [form, setForm] = useState(initial || {
    jobName: '', jobDescription: '', hourlyRate: '',
    jobMaxDuration: '', jobMaxPayableTime: '', jobExpectedTime: '',
    startDate: today(),
    leaders: '', assets: [],
    term: '', learningCurve: false, status: 'active',
  });
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr]           = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const removeAsset = (i) =>
    setForm(f => ({ ...f, assets: f.assets.filter((_, idx) => idx !== i) }));

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const d = await uploadAssets(files);
      if (d.success) setForm(f => ({ ...f, assets: [...f.assets, ...d.files] }));
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.jobName.trim()) { setErr('Job name is required'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        ...form,
        hourlyRate:        form.hourlyRate        ? Number(form.hourlyRate)        : undefined,
        jobMaxDuration:    form.jobMaxDuration    ? Number(form.jobMaxDuration)    : undefined,
        jobMaxPayableTime: form.jobMaxPayableTime ? Number(form.jobMaxPayableTime) : undefined,
        jobExpectedTime:   form.jobExpectedTime   ? Number(form.jobExpectedTime)   : undefined,
        leaders: typeof form.leaders === 'string'
          ? form.leaders.split(',').map(s => s.trim()).filter(Boolean)
          : form.leaders,
        assets: form.assets, // already objects from upload
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
      style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-lg flex flex-col"
        style={{ borderColor: 'rgba(74,222,128,0.2)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: '1px solid rgba(74,222,128,0.1)' }}>
          <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-3">
          {err && (
            <div className="flex items-center gap-2 text-sm p-3 rounded-xl"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
              <AlertCircle size={14} /> {err}
            </div>
          )}

          <form id="job-form" onSubmit={handleSubmit} className="space-y-3">

            {/* Job Name */}
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Job Name *</label>
              <input className="input input-sm w-full" style={inputStyle}
                value={form.jobName} onChange={e => set('jobName', e.target.value)} />
            </div>

            {/* Numbers row */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'hourlyRate',        label: 'Hourly Rate ($)' },
                { key: 'jobMaxDuration',    label: 'Max Duration (h)' },
                { key: 'jobMaxPayableTime', label: 'Max Payable (h)' },
                { key: 'jobExpectedTime',   label: 'Expected Time (h)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs mb-1" style={labelStyle}>{label}</label>
                  <input type="number" className="input input-sm w-full" style={inputStyle}
                    value={form[key] || ''} onChange={e => set(key, e.target.value)} />
                </div>
              ))}
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Start Date</label>
              <input type="date" className="input input-sm w-full" style={inputStyle}
                value={form.startDate || today()} onChange={e => set('startDate', e.target.value)} />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Description</label>
              <textarea className="input w-full rounded-xl p-2 text-sm resize-y"
                rows={6} style={{ ...inputStyle, minHeight: '120px' }}
                value={form.jobDescription || ''}
                onChange={e => set('jobDescription', e.target.value)} />
            </div>

            {/* Term / Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={labelStyle}>Term</label>
                <select className="input input-sm w-full" style={inputStyle}
                  value={form.term || ''} onChange={e => set('term', e.target.value)}>
                  <option value="">None</option>
                  <option value="short">Short</option>
                  <option value="long">Long</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={labelStyle}>Status</label>
                <select className="input input-sm w-full" style={inputStyle}
                  value={form.status || 'active'} onChange={e => set('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Leaders */}
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Leaders (comma-separated)</label>
              <input className="input input-sm w-full" style={inputStyle}
                value={Array.isArray(form.leaders) ? form.leaders.join(', ') : form.leaders || ''}
                onChange={e => set('leaders', e.target.value)} placeholder="Alice, Bob" />
            </div>

            {/* Assets — file upload */}
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Assets</label>
              {form.assets.length > 0 && (
                <div className="space-y-1 mb-2">
                  {form.assets.map((asset, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                      style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.1)' }}>
                      <FileText size={11} style={{ color: '#4ade80', flexShrink: 0 }} />
                      <a href={asset.url} download={asset.name} target="_blank" rel="noreferrer"
                        className="flex-1 min-w-0 truncate flex items-center gap-1.5"
                        style={{ color: '#bbf7d0' }}>
                        <span className="truncate">{asset.name}</span>
                        {asset.size > 0 && (
                          <span style={{ color: 'rgba(134,239,172,0.4)', flexShrink: 0 }}>
                            {formatSize(asset.size)}
                          </span>
                        )}
                        <Download size={10} style={{ flexShrink: 0, color: 'rgba(134,239,172,0.5)' }} />
                      </a>
                      <button type="button" onClick={() => removeAsset(i)}
                        style={{ color: 'rgba(248,113,113,0.6)', flexShrink: 0 }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
                style={{
                  background: 'rgba(74,222,128,0.05)',
                  border: '1px dashed rgba(74,222,128,0.3)',
                  color: uploading ? '#4ade80' : 'rgba(134,239,172,0.6)',
                }}>
                {uploading
                  ? <Loader size={12} className="animate-spin" />
                  : <Upload size={12} />}
                {uploading ? 'Uploading…' : 'Add Files'}
                <input type="file" multiple className="hidden"
                  onChange={handleFileChange} disabled={uploading} />
              </label>
            </div>

            {/* Learning Curve */}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="lc" checked={!!form.learningCurve}
                onChange={e => set('learningCurve', e.target.checked)}
                className="checkbox checkbox-sm" style={{ accentColor: '#4ade80' }} />
              <label htmlFor="lc" className="text-sm" style={{ color: 'rgba(134,239,172,0.7)' }}>
                Learning Curve required
              </label>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4" style={{ borderTop: '1px solid rgba(74,222,128,0.1)' }}>
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.6)' }}>
            Cancel
          </button>
          <button type="submit" form="job-form" disabled={saving || uploading}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
            {saving && <Loader size={14} className="animate-spin" />}
            {saving ? 'Saving…' : (initial?.id ? 'Save Changes' : 'Create Job')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Request Edit Modal ───────────────────────────────────────────────────────

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
      if (form.jobName.trim())       changes.jobName        = form.jobName.trim();
      if (form.hourlyRate !== '')     changes.hourlyRate     = Number(form.hourlyRate);
      if (form.jobDescription.trim()) changes.jobDescription = form.jobDescription.trim();
      if (form.status)               changes.status         = form.status;
      if (Object.keys(changes).length === 0) { setErr('Specify at least one change'); setSaving(false); return; }
      await onSubmit({ jobId: job.id, changes, message: form.message });
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-md p-6"
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
            <textarea className="input w-full rounded-xl p-2 text-sm resize-none" rows={3}
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

// ─── Edit Requests Panel ──────────────────────────────────────────────────────

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
              <button onClick={() => onHandle(job.id, r._id || r.id, 'accept')}
                className="p-1 rounded-lg"
                style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
                title="Accept">
                <Check size={12} />
              </button>
              <button onClick={() => onHandle(job.id, r._id || r.id, 'reject')}
                className="p-1 rounded-lg"
                style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                title="Reject">
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

// ─── Job Card ─────────────────────────────────────────────────────────────────

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
            {job.hourlyRate != null && (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#4ade80' }}>
                <DollarSign size={11} />{job.hourlyRate}/hr
              </span>
            )}
            {job.jobMaxDuration != null && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(134,239,172,0.5)' }}>
                <Clock size={11} />{job.jobMaxDuration}h max
              </span>
            )}
            {job.jobMaxPayableTime != null && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(96,165,250,0.6)' }}>
                <DollarSign size={11} />{job.jobMaxPayableTime}h payable
              </span>
            )}
            {job.startDate && (
              <span className="text-xs" style={{ color: 'rgba(134,239,172,0.4)' }}>
                from {new Date(job.startDate).toLocaleDateString()}
              </span>
            )}
          </div>

          {job.jobDescription && (
            <p className="text-xs mt-2 line-clamp-2" style={{ color: 'rgba(134,239,172,0.6)' }}>
              {job.jobDescription}
            </p>
          )}

          {/* Assets download links */}
          {(job.assets || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {job.assets.map((a, i) => (
                <a key={i} href={a.url} download={a.name} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all"
                  style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: 'rgba(134,239,172,0.7)' }}>
                  <Download size={10} />
                  <span className="max-w-[120px] truncate">{a.name || `file-${i + 1}`}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isOwner ? (
            <>
              <button onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(74,222,128,0.05)', color: 'rgba(134,239,172,0.5)', border: '1px solid rgba(74,222,128,0.15)' }}
                title="View requests">
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

// ─── Main page ────────────────────────────────────────────────────────────────

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
    jobName:           job.jobName || '',
    jobDescription:    job.jobDescription || '',
    hourlyRate:        job.hourlyRate ?? '',
    jobMaxDuration:    job.jobMaxDuration ?? '',
    jobMaxPayableTime: job.jobMaxPayableTime ?? '',
    jobExpectedTime:   job.jobExpectedTime ?? '',
    startDate:         job.startDate ? job.startDate.slice(0, 10) : today(),
    leaders: Array.isArray(job.leaders) ? job.leaders.join(', ') : job.leaders || '',
    assets:  Array.isArray(job.assets)
      ? job.assets.map(a => typeof a === 'string' ? { name: a, url: '', size: 0 } : a)
      : [],
    term:          job.term || '',
    learningCurve: !!job.learningCurve,
    status:        job.status || 'active',
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
