import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit, Trash2, FileText, Search, Copy,
  ChevronUp, ChevronDown, AlertCircle, Star, Eye, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  listPrompts, createPrompt, updatePrompt, setMainPrompt,
  clonePrompt, deletePrompt,
} from '../api/promptsApi';

const PAGE_SIZE = 15;
const EMPTY_FORM = { title: '', content: '', shared: false };

// ── Editor dialog ─────────────────────────────────────────────────────────────
function PromptEditorDialog({ open, onClose, onSaved, editData }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (open) {
      setForm(editData
        ? { title: editData.title || '', content: editData.content || '', shared: Boolean(editData.shared) }
        : EMPTY_FORM
      );
      setError('');
    }
  }, [open, editData]);

  const handleSubmit = async () => {
    setError('');
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required.');
      return;
    }
    setSaving(true);
    try {
      if (editData) {
        const res = await updatePrompt(editData.id, { title: form.title, content: form.content, shared: form.shared });
        onSaved(res.data.data);
      } else {
        const res = await createPrompt({ title: form.title, content: form.content, shared: form.shared });
        onSaved(res.data.data);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save prompt.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
        <h3 className="font-bold text-lg mb-4">{editData ? 'Edit Prompt' : 'New Prompt'}</h3>

        {error && (
          <div role="alert" className="alert alert-error text-sm mb-3">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          <div>
            <label className="label pb-1"><span className="label-text font-medium">Title *</span></label>
            <input
              className="input input-bordered w-full"
              placeholder="Prompt title…"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="flex flex-col flex-1">
            <label className="label pb-1"><span className="label-text font-medium">Content *</span></label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="textarea textarea-bordered w-full flex-1"
              style={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'none',
                minHeight: 280,
              }}
              spellCheck={false}
            />
            <span className="text-xs text-base-content/50 mt-1 text-right">
              {form.content.length} characters · {form.content ? form.content.split('\n').length : 0} lines
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={form.shared}
              onChange={(e) => setForm((f) => ({ ...f, shared: e.target.checked }))}
            />
            <span className="text-sm">Shared (visible to others)</span>
          </label>
        </div>

        <div className="modal-action mt-4">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-sm" /> : null}
            {editData ? 'Save Changes' : 'Create Prompt'}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
  );
}

// ── View dialog ───────────────────────────────────────────────────────────────
function PromptViewDialog({ open, onClose, prompt }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!prompt?.content) return;
    navigator.clipboard.writeText(prompt.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!open || !prompt) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <FileText size={20} className="text-primary shrink-0" />
          <h3 className="font-bold text-lg flex-1 truncate">{prompt.title}</h3>
          {prompt.isMain && (
            <span className="badge badge-warning gap-1">
              <Star size={11} />Main
            </span>
          )}
          {prompt.shared && <span className="badge badge-success badge-outline">Shared</span>}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto border border-base-300 rounded-lg p-3 bg-base-200">
          <pre
            className="text-sm text-base-content whitespace-pre-wrap break-words m-0"
            style={{ fontFamily: '"Courier New", Courier, monospace', lineHeight: 1.8 }}
          >
            {prompt.content}
          </pre>
        </div>

        {/* Footer meta */}
        <div className="text-xs text-base-content/50 mt-2">
          <span>By @{prompt.userId?.username || '?'} · {new Date(prompt.createdAt).toLocaleString()}</span>
          <span className="block">{prompt.content?.length || 0} characters · {prompt.content ? prompt.content.split('\n').length : 0} lines</span>
        </div>

        <div className="modal-action mt-3">
          <button
            className={`btn btn-sm btn-outline ${copied ? 'btn-success' : ''}`}
            onClick={handleCopy}
          >
            <Copy size={14} />
            {copied ? 'Copied!' : 'Copy Content'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
  );
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────
function DeleteConfirmDialog({ open, onClose, onConfirm, prompt, deleting }) {
  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-sm">
        <h3 className="font-bold text-lg mb-3">Delete Prompt?</h3>
        <p className="text-sm text-base-content/80">
          Are you sure you want to delete <strong>{prompt?.title}</strong>? This cannot be undone.
        </p>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="btn btn-error" onClick={onConfirm} disabled={deleting}>
            {deleting ? <span className="loading loading-spinner loading-sm" /> : <Trash2 size={15} />}
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
  );
}

// ── Sort header helper ────────────────────────────────────────────────────────
function SortTh({ field, label, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
          : <ChevronDown size={13} className="opacity-20" />}
      </span>
    </th>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Prompts() {
  const { user } = useAuth();

  const [prompts, setPrompts] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [search, setSearch]             = useState('');
  const [sharedFilter, setSharedFilter] = useState('');
  const [sortField, setSortField]       = useState('createdAt');
  const [sortDir, setSortDir]           = useState('desc');
  const [page, setPage]                 = useState(1);

  const [editorOpen, setEditorOpen]     = useState(false);
  const [editData, setEditData]         = useState(null);
  const [viewPrompt, setViewPrompt]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [settingMain, setSettingMain]   = useState(null);
  const [cloning, setCloning]           = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listPrompts({
        search,
        shared:    sharedFilter !== '' ? sharedFilter : undefined,
        sortField,
        sortDir,
        page,
        limit: PAGE_SIZE,
      });
      setPrompts(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load prompts.');
    } finally {
      setLoading(false);
    }
  }, [search, sharedFilter, sortField, sortDir, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, sharedFilter, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleSaved = (prompt) => {
    setPrompts((prev) => {
      const idx = prev.findIndex((p) => p.id === prompt.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = prompt;
        return next;
      }
      return [prompt, ...prev];
    });
    setTotal((t) => editData ? t : t + 1);
    setEditData(null);
  };

  const handleSetMain = async (prompt) => {
    setSettingMain(prompt.id);
    try {
      await setMainPrompt(prompt.id);
      setPrompts((prev) => prev.map((p) => ({ ...p, isMain: p.id === prompt.id })));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set main prompt.');
    } finally {
      setSettingMain(null);
    }
  };

  const handleClone = async (prompt, e) => {
    e.stopPropagation();
    setCloning(prompt.id);
    try {
      const res = await clonePrompt(prompt.id);
      setPrompts((prev) => [res.data.data, ...prev]);
      setTotal((t) => t + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clone prompt.');
    } finally {
      setCloning(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePrompt(deleteTarget.id);
      setPrompts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setTotal((t) => t - 1);
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete prompt.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const isOwner = (prompt) =>
    prompt.userId?.id === user?._id || prompt.userId?.id === user?.id;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">

      {/* Page header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <FileText size={28} className="text-primary shrink-0" />
        <h1 className="text-2xl font-bold flex-1">My Prompts</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setEditData(null); setEditorOpen(true); }}
        >
          <Plus size={16} /> New Prompt
        </button>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-md mb-4">
        <div className="card-body py-3 px-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
              <input
                className="input input-bordered input-sm w-full pl-9 pr-8"
                placeholder="Search title or content…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                  onClick={() => setSearch('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Shared filter */}
            <select
              className="select select-bordered select-sm w-36"
              value={sharedFilter}
              onChange={(e) => setSharedFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Shared</option>
              <option value="false">Private</option>
            </select>

            <span className="text-xs text-base-content/50 ml-auto">
              {total} prompt{total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="alert alert-error text-sm mb-4">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs btn-circle ml-auto" onClick={() => setError('')}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card bg-base-100 shadow-md mb-4 overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead>
            <tr>
              <th className="w-10">Main</th>
              <SortTh field="title"     label="Title"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <th>Preview</th>
              <SortTh field="shared"    label="Shared"  sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <th>Author</th>
              <SortTh field="createdAt" label="Date"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  <span className="loading loading-spinner loading-md" />
                </td>
              </tr>
            ) : prompts.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="text-center py-12 text-base-content/50">
                    <FileText size={40} className="mx-auto mb-2" />
                    <p>No prompts found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              prompts.map((prompt) => (
                <tr
                  key={prompt.id}
                  className="hover cursor-pointer"
                  onClick={() => setViewPrompt(prompt)}
                >
                  {/* Main star */}
                  <td onClick={(e) => e.stopPropagation()}>
                    {isOwner(prompt) ? (
                      <button
                        title={prompt.isMain ? 'Main prompt' : 'Set as main'}
                        className={`btn btn-ghost btn-xs btn-circle ${prompt.isMain ? 'text-warning' : 'text-base-content/30'}`}
                        disabled={settingMain === prompt.id || prompt.isMain}
                        onClick={() => !prompt.isMain && handleSetMain(prompt)}
                      >
                        {settingMain === prompt.id
                          ? <span className="loading loading-spinner loading-xs" />
                          : <Star size={15} fill={prompt.isMain ? 'currentColor' : 'none'} />
                        }
                      </button>
                    ) : (
                      <span className="text-base-content/30 text-xs">—</span>
                    )}
                  </td>

                  {/* Title */}
                  <td>
                    <span className="font-semibold text-sm block max-w-[180px] truncate">
                      {prompt.title}
                    </span>
                  </td>

                  {/* Preview */}
                  <td>
                    <span
                      className="text-xs text-base-content/50 block max-w-[300px] truncate"
                      style={{ fontFamily: 'monospace' }}
                    >
                      {prompt.content?.slice(0, 100)}{prompt.content?.length > 100 ? '…' : ''}
                    </span>
                  </td>

                  {/* Shared badge */}
                  <td>
                    {prompt.shared
                      ? <span className="badge badge-success badge-sm">Shared</span>
                      : <span className="badge badge-ghost badge-sm">Private</span>
                    }
                  </td>

                  {/* Author */}
                  <td>
                    <span className="text-xs">@{prompt.userId?.username || '?'}</span>
                  </td>

                  {/* Date */}
                  <td>
                    <span className="text-xs">{new Date(prompt.createdAt).toLocaleDateString()}</span>
                  </td>

                  {/* Actions */}
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      {/* View */}
                      <button
                        title="View"
                        className="btn btn-ghost btn-xs btn-circle"
                        onClick={() => setViewPrompt(prompt)}
                      >
                        <Eye size={14} />
                      </button>

                      {/* Clone */}
                      <button
                        title="Clone to my prompts"
                        className="btn btn-ghost btn-xs btn-circle"
                        disabled={cloning === prompt.id}
                        onClick={(e) => handleClone(prompt, e)}
                      >
                        {cloning === prompt.id
                          ? <span className="loading loading-spinner loading-xs" />
                          : <Copy size={14} />}
                      </button>

                      {isOwner(prompt) && (
                        <>
                          <button
                            title="Edit"
                            className="btn btn-ghost btn-xs btn-circle"
                            onClick={() => { setEditData(prompt); setEditorOpen(true); }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            title="Delete"
                            className="btn btn-ghost btn-xs btn-circle text-error"
                            onClick={() => setDeleteTarget(prompt)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-2">
          <button
            className="btn btn-outline btn-sm"
            disabled={page === 1}
            onClick={() => setPage(1)}
          >«</button>
          <button
            className="btn btn-outline btn-sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === '…'
                ? <span key={`ellipsis-${i}`} className="btn btn-disabled btn-sm">…</span>
                : <button
                    key={p}
                    className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPage(p)}
                  >{p}</button>
            )
          }
          <button
            className="btn btn-outline btn-sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >›</button>
          <button
            className="btn btn-outline btn-sm"
            disabled={page === totalPages}
            onClick={() => setPage(totalPages)}
          >»</button>
        </div>
      )}

      {/* Dialogs */}
      <PromptEditorDialog
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditData(null); }}
        onSaved={handleSaved}
        editData={editData}
      />

      <PromptViewDialog
        open={Boolean(viewPrompt)}
        onClose={() => setViewPrompt(null)}
        prompt={viewPrompt}
      />

      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        prompt={deleteTarget}
        deleting={deleting}
      />
    </div>
  );
}
