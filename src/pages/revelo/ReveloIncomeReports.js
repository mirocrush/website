import { useEffect, useRef, useState, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAuth } from '../../context/AuthContext';
import {
  listIncomeReports, createIncomeReport, updateIncomeReport,
  deleteIncomeReport, uploadReportFiles,
} from '../../api/reveloApi';
import ImageViewer from '../../components/ImageViewer';
import {
  Plus, Trash2, X, Loader, AlertCircle, DollarSign,
  Paperclip, FileText, Upload, Download, Edit2,
  Calendar, ChevronLeft, ChevronRight, Image as ImageIcon,
} from 'lucide-react';

// ─── constants ────────────────────────────────────────────────────────────────

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'clean'],
  ],
};
const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'blockquote', 'code-block', 'link',
];

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','svg','bmp','avif']);
const isImage = (f) =>
  IMAGE_EXTS.has((f.name || f.originalname || '').split('.').pop().toLowerCase()) ||
  (f.mimetype || f.type || '').startsWith('image/');

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '';
}

function fmtJST(dateStr) {
  const d = new Date(dateStr);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jst.getUTCDate()).padStart(2, '0');
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const mn = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${jst.getUTCFullYear()}-${mm}-${dd} ${hh}:${mn} JST`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user, size = 36 }) {
  const name = user?.displayName || user?.username || '?';
  if (user?.profilePicture) {
    return (
      <img src={user.profilePicture} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: '1px solid rgba(74,222,128,0.3)' }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4,
      background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)',
      color: '#4ade80', fontWeight: 700, flexShrink: 0,
    }}>
      {name[0].toUpperCase()}
    </div>
  );
}

// ─── PDF Viewer Modal ─────────────────────────────────────────────────────────
function ReportViewer({ report, onClose, onEdit, onDelete, isOwn, onImageView }) {
  const images = (report.attachments || []).filter(isImage);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '100%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: 'rgba(3,18,9,0.97)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 16, boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          borderBottom: '1px solid rgba(74,222,128,0.12)',
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <Avatar user={report.userId} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 15 }}>
              {report.userId?.displayName || report.userId?.username || 'Unknown'}
            </div>
            <div style={{ color: 'rgba(134,239,172,0.5)', fontSize: 12 }}>
              {fmtJST(report.createdAt)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isOwn && (
              <>
                <button onClick={() => { onEdit(report); onClose(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
                  title="Edit">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => onDelete(report)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
                  title="Delete">
                  <Trash2 size={14} />
                </button>
              </>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all ml-1"
              style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
              title="Close (Esc)">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {/* Rich text content */}
          <div className="report-viewer-content"
            style={{
              color: 'rgba(200,255,220,0.88)',
              lineHeight: 1.75,
              fontSize: 14,
            }}
            dangerouslySetInnerHTML={{ __html: report.content || '<p style="opacity:0.4">No content</p>' }}
          />

          {/* Attachments */}
          {report.attachments && report.attachments.length > 0 && (
            <div style={{ marginTop: 28, borderTop: '1px solid rgba(74,222,128,0.1)', paddingTop: 20 }}>
              <div style={{ color: 'rgba(134,239,172,0.6)', fontSize: 12, marginBottom: 12,
                textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Attachments ({report.attachments.length})
              </div>

              {/* Image grid */}
              {images.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
                  {images.map((att, i) => (
                    <button key={i} onClick={() => onImageView(images, i)}
                      style={{
                        position: 'relative', paddingBottom: '75%', borderRadius: 8,
                        overflow: 'hidden', background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(74,222,128,0.15)', cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(74,222,128,0.5)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(74,222,128,0.15)'}
                    >
                      <img src={att.url} alt={att.name}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                        color: 'rgba(200,255,220,0.7)', fontSize: 10, textAlign: 'left',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {att.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Non-image files */}
              {report.attachments.filter(a => !isImage(a)).map((att, i) => (
                <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    borderRadius: 8, marginBottom: 4, textDecoration: 'none',
                    background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(74,222,128,0.35)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(74,222,128,0.12)'}
                >
                  <FileText size={15} style={{ color: '#4ade80', flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'rgba(200,255,220,0.8)', fontSize: 13,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.name}
                  </span>
                  {att.size && (
                    <span style={{ color: 'rgba(134,239,172,0.4)', fontSize: 11, flexShrink: 0 }}>
                      {formatBytes(att.size)}
                    </span>
                  )}
                  <Download size={13} style={{ color: 'rgba(74,222,128,0.5)', flexShrink: 0 }} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── File Drop Zone ────────────────────────────────────────────────────────────
function FileDropZone({ files, onAdd, onRemove, uploading }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault(); setOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) onAdd(dropped);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${over ? 'rgba(74,222,128,0.7)' : 'rgba(74,222,128,0.25)'}`,
          borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
          background: over ? 'rgba(74,222,128,0.07)' : 'rgba(74,222,128,0.03)',
          transition: 'all 0.15s',
        }}
      >
        {uploading ? (
          <div style={{ color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Loader size={16} className="animate-spin" /> Uploading…
          </div>
        ) : (
          <>
            <Upload size={20} style={{ color: 'rgba(74,222,128,0.5)', margin: '0 auto 6px' }} />
            <div style={{ color: 'rgba(134,239,172,0.6)', fontSize: 13 }}>
              Drop files here or <span style={{ color: '#4ade80' }}>browse</span>
            </div>
          </>
        )}
        <input ref={inputRef} type="file" multiple hidden
          onChange={e => { onAdd(Array.from(e.target.files)); e.target.value = ''; }} />
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
              background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)',
              borderRadius: 7,
            }}>
              {isImage(f) ? <ImageIcon size={13} style={{ color: '#4ade80', flexShrink: 0 }} />
                          : <FileText  size={13} style={{ color: '#4ade80', flexShrink: 0 }} />}
              <span style={{ flex: 1, color: 'rgba(200,255,220,0.75)', fontSize: 12,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
              <span style={{ color: 'rgba(134,239,172,0.4)', fontSize: 11, flexShrink: 0 }}>
                {formatBytes(f.size)}
              </span>
              <button onClick={() => onRemove(i)} style={{ background: 'none', border: 'none',
                cursor: 'pointer', color: 'rgba(248,113,113,0.6)', padding: 0, lineHeight: 1 }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
function ReportModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial;
  const [content, setContent]           = useState(initial?.content || '');
  const [attachments, setAttachments]   = useState(initial?.attachments || []);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleAddFiles = async (files) => {
    setUploading(true);
    setError('');
    try {
      const result = await uploadReportFiles(files);
      if (result.success) {
        setAttachments(prev => [...prev, ...result.files]);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      let result;
      if (isEdit) {
        result = await updateIncomeReport({ id: initial.id || initial._id, content, attachments });
      } else {
        result = await createIncomeReport({ content, attachments });
      }
      if (result.success) { onSaved(result.report); onClose(); }
      else setError(result.message || 'Failed to save');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '100%', maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: 'rgba(3,18,9,0.97)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 16, boxShadow: '0 0 60px rgba(0,0,0,0.8)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          borderBottom: '1px solid rgba(74,222,128,0.12)',
          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <DollarSign size={16} style={{ color: '#4ade80' }} />
          <span style={{ color: '#4ade80', fontWeight: 600, fontSize: 15, flex: 1 }}>
            {isEdit ? 'Edit Income Report' : 'New Income Report'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(134,239,172,0.5)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Rich text */}
          <div>
            <div style={{ color: 'rgba(134,239,172,0.6)', fontSize: 12, marginBottom: 6 }}>Content</div>
            <div className="revelo-quill" style={{ borderRadius: 8, overflow: 'hidden' }}>
              <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={QUILL_MODULES}
                formats={QUILL_FORMATS}
                style={{ minHeight: 200 }}
              />
            </div>
          </div>

          {/* File upload */}
          <div>
            <div style={{ color: 'rgba(134,239,172,0.6)', fontSize: 12, marginBottom: 6 }}>
              Attachments {attachments.length > 0 && `(${attachments.length})`}
            </div>
            <FileDropZone
              files={pendingFiles}
              onAdd={handleAddFiles}
              onRemove={i => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
              uploading={uploading}
            />
            {/* Already-uploaded attachments */}
            {attachments.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {attachments.map((att, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)',
                    borderRadius: 7,
                  }}>
                    {isImage(att) ? <ImageIcon size={13} style={{ color: '#4ade80', flexShrink: 0 }} />
                                  : <FileText  size={13} style={{ color: '#4ade80', flexShrink: 0 }} />}
                    <span style={{ flex: 1, color: 'rgba(200,255,220,0.75)', fontSize: 12,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.name}
                    </span>
                    {att.size && (
                      <span style={{ color: 'rgba(134,239,172,0.4)', fontSize: 11, flexShrink: 0 }}>
                        {formatBytes(att.size)}
                      </span>
                    )}
                    <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(248,113,113,0.6)', padding: 0, lineHeight: 1 }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
              color: '#f87171', fontSize: 13, padding: '8px 12px',
              background: 'rgba(248,113,113,0.1)', borderRadius: 8,
              border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid rgba(74,222,128,0.12)',
          padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
        }}>
          <button onClick={onClose} disabled={saving}
            style={{
              padding: '7px 18px', borderRadius: 8, border: '1px solid rgba(74,222,128,0.2)',
              background: 'transparent', color: 'rgba(134,239,172,0.6)', cursor: 'pointer', fontSize: 13,
            }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || uploading}
            style={{
              padding: '7px 20px', borderRadius: 8, border: '1px solid rgba(74,222,128,0.5)',
              background: 'rgba(74,222,128,0.15)', color: '#4ade80', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              opacity: (saving || uploading) ? 0.6 : 1,
            }}>
            {saving ? <><Loader size={13} className="animate-spin" /> Saving…</> : (isEdit ? 'Save Changes' : 'Submit Report')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────
function ReportCard({ report, isOwn, onView, onEdit, onDelete }) {
  const preview = stripHtml(report.content).slice(0, 160);
  const imgCount = (report.attachments || []).filter(isImage).length;
  const fileCount = (report.attachments || []).filter(a => !isImage(a)).length;

  return (
    <div
      onClick={() => onView(report)}
      style={{
        background: 'rgba(3,18,9,0.65)', border: '1px solid rgba(74,222,128,0.12)',
        borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(74,222,128,0.35)';
        e.currentTarget.style.background  = 'rgba(3,18,9,0.8)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(74,222,128,0.12)';
        e.currentTarget.style.background  = 'rgba(3,18,9,0.65)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar user={report.userId} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: '#4ade80', fontWeight: 600, fontSize: 14 }}>
              {report.userId?.displayName || report.userId?.username || 'Unknown'}
            </span>
            <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 11 }}>
              {fmtJST(report.createdAt)}
            </span>
          </div>

          {/* Preview */}
          <div style={{
            color: 'rgba(200,255,220,0.55)', fontSize: 13, lineHeight: 1.5,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {preview || <span style={{ opacity: 0.4 }}>No content</span>}
          </div>

          {/* Footer row */}
          {(imgCount > 0 || fileCount > 0) && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {imgCount > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4,
                  color: 'rgba(134,239,172,0.5)', fontSize: 11 }}>
                  <ImageIcon size={11} /> {imgCount} image{imgCount > 1 ? 's' : ''}
                </span>
              )}
              {fileCount > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4,
                  color: 'rgba(134,239,172,0.5)', fontSize: 11 }}>
                  <Paperclip size={11} /> {fileCount} file{fileCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions for own report */}
        {isOwn && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(report)}
              style={{
                width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'rgba(74,222,128,0.1)',
                border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(74,222,128,0.1)'}
              title="Edit">
              <Edit2 size={12} />
            </button>
            <button onClick={() => onDelete(report)}
              style={{
                width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
              title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReveloIncomeReports() {
  const { user } = useAuth();

  const [reports, setReports]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [date, setDate]               = useState('');        // YYYY-MM-DD JST

  const [showCreate, setShowCreate]   = useState(false);
  const [editReport, setEditReport]   = useState(null);
  const [viewReport, setViewReport]   = useState(null);
  const [imageViewer, setImageViewer] = useState(null);      // { images, startIndex }
  const [deleteConfirm, setDeleteConfirm] = useState(null);  // report to delete
  const [deleting, setDeleting]       = useState(false);

  const load = useCallback(async (d) => {
    setLoading(true); setError('');
    try {
      const res = await listIncomeReports(d ? { date: d } : {});
      if (res.success) {
        setReports(res.reports);
        if (!d) setDate(res.todayJST);   // set from server on first load
      } else {
        setError(res.message || 'Failed to load reports');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDateChange = (e) => {
    const d = e.target.value;
    setDate(d);
    load(d);
  };

  const goDay = (delta) => {
    const parts = date.split('-').map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + delta));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    setDate(next);
    load(next);
  };

  const handleSaved = (report) => {
    setReports(prev => {
      const reportId = report.id || report._id;
      const idx = prev.findIndex(r => (r.id || r._id) === reportId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = report;
        return next;
      }
      return [report, ...prev];
    });
  };

  const handleDelete = async (report) => {
    setDeleting(true);
    try {
      const reportId = report.id || report._id;
      const res = await deleteIncomeReport(reportId);
      if (res.success) {
        setReports(prev => prev.filter(r => (r.id || r._id) !== reportId));
        if (viewReport && (viewReport.id || viewReport._id) === reportId) setViewReport(null);
      }
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const openImageViewer = (images, startIndex) => {
    setImageViewer({ images: images.map(a => ({ url: a.url, name: a.name })), startIndex });
  };

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-6">
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DollarSign size={20} style={{ color: '#4ade80' }} />
          <h1 style={{ color: '#4ade80', fontWeight: 700, fontSize: 20, margin: 0 }}>Income Reports</h1>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 8, border: '1px solid rgba(74,222,128,0.4)',
            background: 'rgba(74,222,128,0.12)', color: '#4ade80',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
          <Plus size={14} /> New Report
        </button>
      </div>

      {/* ── Date picker bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
        padding: '10px 14px', borderRadius: 10,
        background: 'rgba(3,18,9,0.6)', border: '1px solid rgba(74,222,128,0.12)',
      }}>
        <Calendar size={15} style={{ color: 'rgba(134,239,172,0.5)', flexShrink: 0 }} />
        <button onClick={() => goDay(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(134,239,172,0.5)', padding: 2 }}>
          <ChevronLeft size={16} />
        </button>
        <input type="date" value={date} onChange={handleDateChange}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: '#4ade80', fontSize: 14, cursor: 'pointer',
          }} />
        <button onClick={() => goDay(1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(134,239,172,0.5)', padding: 2 }}>
          <ChevronRight size={16} />
        </button>
        <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 12, marginLeft: 4 }}>JST</span>
        <span style={{ marginLeft: 'auto', color: 'rgba(134,239,172,0.4)', fontSize: 12 }}>
          {reports.length} report{reports.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <Loader size={24} className="animate-spin" style={{ color: '#4ade80' }} />
        </div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171',
          padding: '12px 16px', background: 'rgba(248,113,113,0.1)', borderRadius: 10,
          border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(134,239,172,0.35)', fontSize: 14 }}>
          <DollarSign size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          No reports for this date.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map(r => (
            <ReportCard
              key={r._id}
              report={r}
              isOwn={user && (r.userId?._id === user._id || r.userId?.id === user._id)}
              onView={setViewReport}
              onEdit={setEditReport}
              onDelete={setDeleteConfirm}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {showCreate && (
        <ReportModal onClose={() => setShowCreate(false)} onSaved={handleSaved} />
      )}
      {editReport && (
        <ReportModal initial={editReport} onClose={() => setEditReport(null)} onSaved={handleSaved} />
      )}
      {viewReport && (
        <ReportViewer
          report={viewReport}
          isOwn={user && (viewReport.userId?._id === user._id || viewReport.userId?.id === user._id)}
          onClose={() => setViewReport(null)}
          onEdit={(r) => { setViewReport(null); setEditReport(r); }}
          onDelete={(r) => { setViewReport(null); setDeleteConfirm(r); }}
          onImageView={openImageViewer}
        />
      )}
      {imageViewer && (
        <ImageViewer
          images={imageViewer.images}
          startIndex={imageViewer.startIndex}
          onClose={() => setImageViewer(null)}
        />
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{
            background: 'rgba(3,18,9,0.97)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 14, padding: '24px 28px', maxWidth: 380, width: '100%',
            boxShadow: '0 0 40px rgba(0,0,0,0.8)',
          }}>
            <div style={{ color: '#f87171', fontWeight: 600, fontSize: 16, marginBottom: 10 }}>
              Delete Report
            </div>
            <div style={{ color: 'rgba(200,255,220,0.65)', fontSize: 14, marginBottom: 20 }}>
              This action cannot be undone. The report and all its attachments will be permanently deleted.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(74,222,128,0.2)',
                  background: 'transparent', color: 'rgba(134,239,172,0.6)', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.4)',
                  background: 'rgba(248,113,113,0.15)', color: '#f87171', cursor: 'pointer', fontSize: 13,
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                  opacity: deleting ? 0.6 : 1 }}>
                {deleting ? <><Loader size={12} className="animate-spin" /> Deleting…</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
