import { useEffect, useRef, useState, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  listTasks, createTask, updateTask, deleteTask,
  listAccounts, listJobs, uploadTaskFiles,
} from '../../api/reveloApi';
import {
  Plus, Edit2, Trash2, X, Search, Filter, ChevronLeft, ChevronRight,
  Loader, AlertCircle, CheckSquare, Calendar, Check,
  Paperclip, FileText, Image as ImageIcon, Upload,
} from 'lucide-react';

const QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'clean'],
  ],
};
const QUILL_FORMATS = ['bold', 'italic', 'underline', 'list', 'bullet', 'link'];

// localStorage helpers for recently used
const RECENT_LIMIT = 5;
const getRecent = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const pushRecent = (key, id) => {
  const arr = [id, ...getRecent(key).filter(x => x !== id)].slice(0, RECENT_LIMIT);
  localStorage.setItem(key, JSON.stringify(arr));
};

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

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','svg','bmp','avif']);
const isImageMime = (f) => (f.type && f.type.startsWith('image/')) ||
  IMAGE_EXTS.has((f.name || '').split('.').pop().toLowerCase());

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

// ─── Create Task Modal — 3-panel layout ──────────────────────────────────────

function SidebarList({ title, items, selected, onSelect, search, onSearch,
  searchPlaceholder, renderItem, recentIds }) {

  // sort: recent first, then rest
  const sorted = [
    ...recentIds.map(id => items.find(x => x.id === id)).filter(Boolean),
    ...items.filter(x => !recentIds.includes(x.id)),
  ];
  const filtered = sorted.filter(x => renderItem(x, true).toLowerCase()
    .includes(search.toLowerCase()));
  const recentSet = new Set(recentIds.filter(id => items.some(x => x.id === id)));

  return (
    <div className="flex flex-col h-full" style={{ borderRight: '1px solid rgba(74,222,128,0.1)' }}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="text-xs font-semibold mb-2 uppercase tracking-wider"
          style={{ color: 'rgba(134,239,172,0.5)' }}>{title}</div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'rgba(134,239,172,0.35)' }} />
          <input className="input input-xs w-full pl-7" style={inputStyle}
            value={search} onChange={e => onSearch(e.target.value)}
            placeholder={searchPlaceholder} />
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="text-xs text-center py-6" style={{ color: 'rgba(134,239,172,0.3)' }}>
            Nothing found
          </div>
        ) : filtered.map((item, idx) => {
          const isSelected = selected?.id === item.id;
          const isRecent   = recentSet.has(item.id);
          const showLabel  = idx === 0 && isRecent;
          const showAllLabel = !isRecent && (idx === 0 || recentSet.has(filtered[idx - 1]?.id));
          return (
            <div key={item.id}>
              {showLabel && (
                <div className="text-xs px-1 pt-1 pb-0.5" style={{ color: 'rgba(134,239,172,0.35)' }}>
                  Recent
                </div>
              )}
              {showAllLabel && recentSet.size > 0 && (
                <div className="text-xs px-1 pt-2 pb-0.5" style={{ color: 'rgba(134,239,172,0.35)' }}>
                  All
                </div>
              )}
              <button onClick={() => onSelect(item)}
                className="w-full text-left px-2.5 py-2 rounded-lg transition-all flex items-center justify-between gap-1"
                style={{
                  background: isSelected ? 'rgba(74,222,128,0.18)' : 'transparent',
                  border: `1px solid ${isSelected ? 'rgba(74,222,128,0.45)' : 'transparent'}`,
                }}>
                <span className="text-xs leading-tight flex-1 min-w-0 truncate"
                  style={{ color: isSelected ? '#bbf7d0' : 'rgba(187,247,208,0.65)' }}>
                  {renderItem(item)}
                </span>
                {isSelected && <Check size={10} style={{ color: '#4ade80', flexShrink: 0 }} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreateTaskModal({ onClose, onCreated }) {
  const [accounts, setAccounts]       = useState([]);
  const [jobs, setJobs]               = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedJob, setSelectedJob]         = useState(null);
  const [accSearch, setAccSearch]     = useState('');
  const [jobSearch, setJobSearch]     = useState('');
  const [taskUuid, setTaskUuid]       = useState('');
  const [comment, setComment]         = useState('');
  const [startDate, setStartDate]     = useState('');
  const [status, setStatus]           = useState('pending');
  const [stagedFiles, setStagedFiles] = useState([]);  // { file, preview? }
  const [dragOver, setDragOver]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState('');
  const fileInputRef                  = useRef(null);

  const [recentAccIds] = useState(() => getRecent('revelo_recent_accounts'));
  const [recentJobIds] = useState(() => getRecent('revelo_recent_jobs'));

  useEffect(() => {
    Promise.all([listAccounts(), listJobs()])
      .then(([ad, jd]) => {
        if (ad.success) setAccounts(ad.accounts);
        if (jd.success) setJobs(jd.jobs);
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoadingData(false));
  }, []);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => stagedFiles.forEach(sf => { if (sf.preview) URL.revokeObjectURL(sf.preview); });
  }, [stagedFiles]);

  const addFiles = (fileList) => {
    const newEntries = Array.from(fileList).map(file => ({
      file,
      preview: isImageMime(file) ? URL.createObjectURL(file) : null,
      id: Math.random().toString(36).slice(2),
    }));
    setStagedFiles(prev => [...prev, ...newEntries]);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const removeFile = (id) => {
    setStagedFiles(prev => {
      const target = prev.find(sf => sf.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter(sf => sf.id !== id);
    });
  };

  const handleSubmit = async () => {
    if (!selectedAccount) { setErr('Select an account'); return; }
    if (!selectedJob)     { setErr('Select a job'); return; }
    setSaving(true); setErr('');
    try {
      let attachments = [];
      if (stagedFiles.length > 0) {
        const up = await uploadTaskFiles(stagedFiles.map(sf => sf.file));
        if (!up.success) { setErr(up.message || 'Upload failed'); setSaving(false); return; }
        attachments = up.files;
      }
      const d = await createTask({
        accountId:   selectedAccount.id,
        jobId:       selectedJob.id,
        taskUuid:    taskUuid.trim() || undefined,
        comment:     comment || undefined,
        startDate:   startDate || undefined,
        status,
        attachments,
      });
      if (d.success) {
        pushRecent('revelo_recent_accounts', selectedAccount.id);
        pushRecent('revelo_recent_jobs',     selectedJob.id);
        onCreated(d.task);
        onClose();
      } else setErr(d.message);
    } catch (e) {
      setErr(e.response?.data?.message || e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass-card rounded-2xl border flex flex-col w-full"
        style={{ borderColor: 'rgba(74,222,128,0.2)', maxWidth: '900px', height: '82vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(74,222,128,0.1)' }}>
          <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>New Task</h2>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}><X size={18} /></button>
        </div>

        {loadingData ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader size={28} className="animate-spin" style={{ color: '#4ade80' }} />
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">

            {/* ── Col 1: Accounts ── */}
            <div className="w-52 flex-shrink-0 flex flex-col min-h-0">
              <SidebarList
                title="Account"
                items={accounts}
                selected={selectedAccount}
                onSelect={setSelectedAccount}
                search={accSearch}
                onSearch={setAccSearch}
                searchPlaceholder="Search…"
                recentIds={recentAccIds}
                renderItem={(a, plain) => plain
                  ? a.name
                  : <><span>{getFlag(a.nationality)}</span><span className="ml-1">{a.name}</span></>
                }
              />
            </div>

            {/* ── Col 2: Jobs ── */}
            <div className="w-52 flex-shrink-0 flex flex-col min-h-0">
              <SidebarList
                title="Job"
                items={jobs}
                selected={selectedJob}
                onSelect={setSelectedJob}
                search={jobSearch}
                onSearch={setJobSearch}
                searchPlaceholder="Search…"
                recentIds={recentJobIds}
                renderItem={(j, plain) => plain ? j.jobName : j.jobName}
              />
            </div>

            {/* ── Col 3: Task details ── */}
            <div className="flex-1 flex flex-col min-h-0 px-5 py-4 overflow-y-auto">
              {err && (
                <div className="flex items-center gap-2 text-xs mb-3 p-2.5 rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
                  <AlertCircle size={13} /> {err}
                </div>
              )}

              {/* Selection summary pills */}
              <div className="flex gap-2 mb-4 flex-shrink-0">
                <div className="flex-1 rounded-lg px-3 py-1.5 text-xs truncate"
                  style={{ background: selectedAccount ? 'rgba(74,222,128,0.12)' : 'rgba(74,222,128,0.04)',
                    border: `1px solid ${selectedAccount ? 'rgba(74,222,128,0.35)' : 'rgba(74,222,128,0.1)'}`,
                    color: selectedAccount ? '#bbf7d0' : 'rgba(134,239,172,0.3)' }}>
                  {selectedAccount
                    ? <>{getFlag(selectedAccount.nationality)} {selectedAccount.name}</>
                    : 'No account selected'}
                </div>
                <div className="flex-1 rounded-lg px-3 py-1.5 text-xs truncate"
                  style={{ background: selectedJob ? 'rgba(74,222,128,0.12)' : 'rgba(74,222,128,0.04)',
                    border: `1px solid ${selectedJob ? 'rgba(74,222,128,0.35)' : 'rgba(74,222,128,0.1)'}`,
                    color: selectedJob ? '#bbf7d0' : 'rgba(134,239,172,0.3)' }}>
                  {selectedJob ? selectedJob.jobName : 'No job selected'}
                </div>
              </div>

              {/* Task UUID */}
              <div className="mb-3 flex-shrink-0">
                <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.55)' }}>
                  Task UUID / ID
                </label>
                <input className="input input-sm w-full" style={inputStyle}
                  value={taskUuid} onChange={e => setTaskUuid(e.target.value)}
                  placeholder="e.g. TRV-00123 or paste UUID…" />
              </div>

              {/* Start Date + Status */}
              <div className="grid grid-cols-2 gap-3 mb-3 flex-shrink-0">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.55)' }}>Start Date</label>
                  <input type="date" className="input input-sm w-full" style={inputStyle}
                    value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.55)' }}>Status</label>
                  <select className="input input-sm w-full" style={inputStyle}
                    value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Comment */}
              <div className="mb-3 flex-shrink-0">
                <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.55)' }}>Comment</label>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(74,222,128,0.2)' }}>
                  <ReactQuill theme="snow" value={comment} onChange={setComment}
                    modules={QUILL_MODULES} formats={QUILL_FORMATS}
                    placeholder="Add notes, instructions, or details…" />
                </div>
              </div>

              {/* Attachments */}
              <div className="mb-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs" style={{ color: 'rgba(134,239,172,0.55)' }}>
                    <Paperclip size={11} className="inline mr-1" />Attachments
                    {stagedFiles.length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                        style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                        {stagedFiles.length}
                      </span>
                    )}
                  </label>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg"
                    style={{ color: 'rgba(134,239,172,0.5)', background: 'rgba(74,222,128,0.06)',
                      border: '1px solid rgba(74,222,128,0.12)' }}>
                    <Upload size={10} /> Browse
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden"
                    onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => stagedFiles.length === 0 && fileInputRef.current?.click()}
                  className="rounded-xl transition-all flex-1 min-h-0 flex flex-col"
                  style={{
                    border: `1.5px dashed ${dragOver ? 'rgba(74,222,128,0.6)' : 'rgba(74,222,128,0.18)'}`,
                    background: dragOver ? 'rgba(74,222,128,0.07)' : 'rgba(74,222,128,0.02)',
                    cursor: stagedFiles.length === 0 ? 'pointer' : 'default',
                    minHeight: '80px',
                  }}>
                  {stagedFiles.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4">
                      <Upload size={18} style={{ color: 'rgba(134,239,172,0.25)' }} />
                      <span className="text-xs" style={{ color: 'rgba(134,239,172,0.3)' }}>
                        Drag & drop files here, or click to browse
                      </span>
                    </div>
                  ) : (
                    <div className="p-2 overflow-y-auto flex flex-col gap-1">
                      {stagedFiles.map(sf => (
                        <div key={sf.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
                          {/* Thumbnail or icon */}
                          {sf.preview ? (
                            <img src={sf.preview} alt=""
                              className="rounded flex-shrink-0 object-cover"
                              style={{ width: 28, height: 28 }} />
                          ) : (
                            <div className="flex-shrink-0 rounded flex items-center justify-center"
                              style={{ width: 28, height: 28, background: 'rgba(74,222,128,0.1)' }}>
                              <FileText size={13} style={{ color: 'rgba(134,239,172,0.5)' }} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate" style={{ color: '#bbf7d0' }}>{sf.file.name}</div>
                            <div className="text-xs" style={{ color: 'rgba(134,239,172,0.4)' }}>
                              {formatBytes(sf.file.size)}
                            </div>
                          </div>
                          <button onClick={() => removeFile(sf.id)}
                            className="flex-shrink-0 p-0.5 rounded transition-all"
                            style={{ color: 'rgba(248,113,113,0.5)' }}
                            title="Remove">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      {/* Drop more hint */}
                      <div className="text-center py-1"
                        style={{ color: 'rgba(134,239,172,0.25)', fontSize: '11px' }}>
                        Drop more files here
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Create button */}
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.6)' }}>
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={saving}
                  className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </div>
          </div>
        )}
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
