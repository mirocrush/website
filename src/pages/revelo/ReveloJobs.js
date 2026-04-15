import { useEffect, useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  listJobs, createJob, updateJob, deleteJob,
  requestJobEdit, handleEditRequest,
  uploadAssets,
  listForumMessages, sendForumMessage, reactForumMessage, uploadForumFiles,
} from '../../api/reveloApi';
import { useAuth } from '../../context/AuthContext';
import {
  Plus, Edit2, Trash2, X, Briefcase, DollarSign, Clock, Zap,
  Loader, AlertCircle, Check, MessageSquare, Upload, Download,
  File, FileText, Image, Film, Music, Code, Archive, FileSpreadsheet,
  Eye, ThumbsUp, ThumbsDown, Smile, Reply, ChevronDown, Calendar,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const EMOJI_LIST = ['👍','❤️','😂','😮','😢','🎉','🚀','👏','🔥','💯','😍','🤔'];

const QUILL_MODULES_MINI = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'clean'],
  ],
};

const QUILL_MODULES_FORUM = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'clean'],
  ],
};

const QUILL_FORMATS = ['bold','italic','underline','strike','list','bullet',
  'blockquote','code-block','link'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
};

const formatDate = (d) => d ? new Date(d).toLocaleString() : '';
const formatDateShort = (d) => d ? new Date(d).toLocaleDateString() : '';

const getFileIcon = (name = '') => {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    pdf: FileText, doc: FileText, docx: FileText, txt: FileText,
    xls: FileSpreadsheet, xlsx: FileSpreadsheet, csv: FileSpreadsheet,
    jpg: Image, jpeg: Image, png: Image, gif: Image, webp: Image, svg: Image,
    mp4: Film, mov: Film, avi: Film, mkv: Film,
    mp3: Music, wav: Music, ogg: Music,
    js: Code, ts: Code, jsx: Code, tsx: Code, py: Code, html: Code, css: Code, json: Code,
    zip: Archive, rar: Archive, '7z': Archive, tar: Archive,
  };
  return map[ext] || File;
};

const strip = (html) => html?.replace(/<[^>]*>/g, '') || '';

const inputStyle = {
  background: 'rgba(3,18,9,0.6)',
  borderColor: 'rgba(74,222,128,0.2)',
  color: '#bbf7d0',
};
const labelStyle = { color: 'rgba(134,239,172,0.6)' };
const glassCard  = { background: 'rgba(3,18,9,0.65)', border: '1px solid rgba(74,222,128,0.2)' };

// ─── Badges ──────────────────────────────────────────────────────────────────

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

// ─── ReactionTooltip ─────────────────────────────────────────────────────────

function ReactionTooltip({ users = [], children }) {
  const [show, setShow] = useState(false);
  if (!users.length) return children;
  return (
    <div className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 min-w-max
          rounded-lg px-2 py-1.5 text-xs space-y-0.5 pointer-events-none"
          style={{ background: 'rgba(3,18,9,0.95)', border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0' }}>
          {users.map((u, i) => <div key={i}>{u.userName}</div>)}
        </div>
      )}
    </div>
  );
}

// ─── Forum Message ────────────────────────────────────────────────────────────

function ForumMessageItem({ msg, currentUserId, onReply, onReact, isReply = false }) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const thumbedUp   = msg.thumbUp?.some(u => u.userId === currentUserId);
  const thumbedDown = msg.thumbDown?.some(u => u.userId === currentUserId);

  return (
    <div className={`flex gap-3 ${isReply ? 'ml-10 mt-2' : ''}`}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{ background: 'rgba(74,222,128,0.2)', color: '#4ade80' }}>
        {(msg.userName || 'U')[0].toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold" style={{ color: '#bbf7d0' }}>{msg.userName}</span>
          <span className="text-xs" style={{ color: 'rgba(134,239,172,0.4)' }}>
            {formatDate(msg.createdAt)}
          </span>
        </div>

        {/* Content */}
        <div className="prose prose-sm max-w-none text-xs rounded-xl px-3 py-2"
          style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.08)',
            color: '#bbf7d0', lineHeight: '1.6' }}
          dangerouslySetInnerHTML={{ __html: msg.content }} />

        {/* Files */}
        {(msg.files || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {msg.files.map((f, i) => {
              const Icon = getFileIcon(f.name);
              return (
                <a key={i} href={f.url} download={f.name} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                  style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.8)' }}>
                  <Icon size={11} />
                  <span className="max-w-[100px] truncate">{f.name}</span>
                  <Download size={10} style={{ opacity: 0.5 }} />
                </a>
              );
            })}
          </div>
        )}

        {/* Reactions bar */}
        <div className="flex items-center flex-wrap gap-1.5 mt-2">
          {/* Thumb up */}
          <ReactionTooltip users={msg.thumbUp || []}>
            <button onClick={() => onReact(msg.id, 'thumbUp', null, isReply, msg.parentId)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all"
              style={{
                background: thumbedUp ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.05)',
                border: `1px solid ${thumbedUp ? 'rgba(74,222,128,0.4)' : 'rgba(74,222,128,0.1)'}`,
                color: thumbedUp ? '#4ade80' : 'rgba(134,239,172,0.5)',
              }}>
              <ThumbsUp size={11} /> {(msg.thumbUp || []).length || ''}
            </button>
          </ReactionTooltip>

          {/* Thumb down */}
          <ReactionTooltip users={msg.thumbDown || []}>
            <button onClick={() => onReact(msg.id, 'thumbDown', null, isReply, msg.parentId)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all"
              style={{
                background: thumbedDown ? 'rgba(248,113,113,0.2)' : 'rgba(248,113,113,0.05)',
                border: `1px solid ${thumbedDown ? 'rgba(248,113,113,0.4)' : 'rgba(248,113,113,0.1)'}`,
                color: thumbedDown ? '#f87171' : 'rgba(134,239,172,0.5)',
              }}>
              <ThumbsDown size={11} /> {(msg.thumbDown || []).length || ''}
            </button>
          </ReactionTooltip>

          {/* Existing emoji reactions */}
          {(msg.emojis || []).map((er) => {
            const reacted = er.users.some(u => u.userId === currentUserId);
            return (
              <ReactionTooltip key={er.emoji} users={er.users}>
                <button onClick={() => onReact(msg.id, 'emoji', er.emoji, isReply, msg.parentId)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all"
                  style={{
                    background: reacted ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.05)',
                    border: `1px solid ${reacted ? 'rgba(74,222,128,0.3)' : 'rgba(74,222,128,0.1)'}`,
                  }}>
                  {er.emoji} {er.users.length}
                </button>
              </ReactionTooltip>
            );
          })}

          {/* Add emoji */}
          <div className="relative">
            <button onClick={() => setShowEmojiPicker(v => !v)}
              className="px-2 py-0.5 rounded-full text-xs transition-all"
              style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.1)', color: 'rgba(134,239,172,0.4)' }}>
              <Smile size={11} />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-1 z-50 rounded-xl p-2 flex flex-wrap gap-1"
                style={{ background: 'rgba(3,18,9,0.95)', border: '1px solid rgba(74,222,128,0.2)', width: '180px' }}>
                {EMOJI_LIST.map(e => (
                  <button key={e} onClick={() => { onReact(msg.id, 'emoji', e, isReply, msg.parentId); setShowEmojiPicker(false); }}
                    className="text-base hover:scale-125 transition-transform p-0.5">{e}</button>
                ))}
              </div>
            )}
          </div>

          {/* Reply — only on top-level */}
          {!isReply && (
            <button onClick={() => onReply(msg.id, msg.userName)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ml-1"
              style={{ color: 'rgba(134,239,172,0.4)', border: '1px solid rgba(74,222,128,0.08)' }}>
              <Reply size={11} /> Reply
            </button>
          )}
        </div>

        {/* Replies */}
        {!isReply && (msg.replies || []).map(r => (
          <ForumMessageItem key={r.id} msg={r} currentUserId={currentUserId}
            onReply={() => {}} onReact={onReact} isReply />
        ))}
      </div>
    </div>
  );
}

// ─── Forum Modal ──────────────────────────────────────────────────────────────

function ForumModal({ job, currentUser, onClose }) {
  const currentUserId = currentUser?._id || currentUser?.id;
  const [messages, setMessages]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);
  const [content, setContent]       = useState('');
  const [replyTo, setReplyTo]       = useState(null); // { id, userName }
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [sending, setSending]       = useState(false);
  const [err, setErr]               = useState('');
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const load = async (p = 1) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const d = await listForumMessages({ jobId: job.id, page: p, limit: 10 });
      if (d.success) {
        setMessages(prev => p === 1 ? d.messages : [...prev, ...d.messages]);
        setHasMore(d.hasMore);
        setPage(p);
        if (p === 1) setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      }
    } finally {
      if (p === 1) setLoading(false); else setLoadingMore(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingFiles(true);
    try {
      const d = await uploadForumFiles(files);
      if (d.success) setPendingFiles(prev => [...prev, ...d.files]);
    } catch (ex) { setErr(ex.message); }
    finally { setUploadingFiles(false); e.target.value = ''; }
  };

  const handleSend = async () => {
    const text = strip(content).trim();
    if (!text && !pendingFiles.length) return;
    setSending(true); setErr('');
    try {
      const d = await sendForumMessage({
        jobId: job.id, content,
        files: pendingFiles,
        parentId: replyTo?.id || null,
      });
      if (d.success) {
        if (replyTo) {
          setMessages(msgs => msgs.map(m =>
            m.id === replyTo.id
              ? { ...m, replies: [...(m.replies || []), d.message] }
              : m
          ));
        } else {
          setMessages(msgs => [...msgs, d.message]);
        }
        setContent(''); setPendingFiles([]); setReplyTo(null);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch (ex) { setErr(ex.message); }
    finally { setSending(false); }
  };

  const handleReact = async (messageId, type, emoji, isReply, parentId) => {
    try {
      const d = await reactForumMessage({ messageId, type, emoji });
      if (d.success) {
        setMessages(msgs => msgs.map(m => {
          if (!isReply && m.id === messageId)
            return { ...d.message, replies: m.replies };
          if (isReply && m.id === parentId)
            return { ...m, replies: m.replies.map(r => r.id === messageId ? d.message : r) };
          return m;
        }));
      }
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-4xl flex flex-col"
        style={{ borderColor: 'rgba(74,222,128,0.2)', height: '88vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(74,222,128,0.12)' }}>
          <div>
            <div className="text-xs mb-0.5" style={{ color: 'rgba(134,239,172,0.5)' }}>Forum</div>
            <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>{job.jobName}</h2>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}><X size={18} /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Load more (older) */}
          {hasMore && (
            <div className="text-center">
              <button onClick={() => load(page + 1)} disabled={loadingMore}
                className="px-4 py-1.5 rounded-full text-xs flex items-center gap-2 mx-auto"
                style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: 'rgba(134,239,172,0.6)' }}>
                {loadingMore ? <Loader size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                Load older messages
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader size={24} className="animate-spin" style={{ color: '#4ade80' }} />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'rgba(134,239,172,0.4)' }}>
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map(msg => (
              <ForumMessageItem key={msg.id} msg={msg} currentUserId={currentUserId}
                onReply={(id, userName) => setReplyTo({ id, userName })}
                onReact={handleReact} />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: '1px solid rgba(74,222,128,0.12)' }}>
          {replyTo && (
            <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.7)' }}>
              <span><Reply size={11} className="inline mr-1" />Replying to <strong>{replyTo.userName}</strong></span>
              <button onClick={() => setReplyTo(null)} style={{ color: 'rgba(134,239,172,0.5)' }}><X size={12} /></button>
            </div>
          )}

          {err && (
            <div className="text-xs mb-2 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
              <AlertCircle size={12} /> {err}
            </div>
          )}

          {/* Pending files */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pendingFiles.map((f, i) => {
                const Icon = getFileIcon(f.name);
                return (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                    style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.8)' }}>
                    <Icon size={11} />
                    <span className="max-w-[80px] truncate">{f.name}</span>
                    <button onClick={() => setPendingFiles(p => p.filter((_, j) => j !== i))}
                      style={{ color: 'rgba(248,113,113,0.6)' }}><X size={10} /></button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(74,222,128,0.2)' }}>
            <ReactQuill
              theme="snow"
              value={content}
              onChange={setContent}
              modules={QUILL_MODULES_FORUM}
              formats={QUILL_FORMATS}
              placeholder="Write a message…"
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFiles}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: 'rgba(134,239,172,0.6)' }}>
                {uploadingFiles ? <Loader size={11} className="animate-spin" /> : <Upload size={11} />}
                Attach
              </button>
            </div>
            <button onClick={handleSend} disabled={sending || uploadingFiles}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
              {sending ? <Loader size={11} className="animate-spin" /> : null}
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Job Detail Modal ─────────────────────────────────────────────────────────

function JobDetailModal({ job, onClose }) {
  const stats = [
    { label: 'Hourly Rate',    value: job.hourlyRate        ? `$${job.hourlyRate}/hr`    : '—', color: '#4ade80' },
    { label: 'Max Duration',   value: job.jobMaxDuration    ? `${job.jobMaxDuration}h`   : '—', color: 'rgba(134,239,172,0.7)' },
    { label: 'Max Payable',    value: job.jobMaxPayableTime ? `${job.jobMaxPayableTime}h`: '—', color: 'rgba(96,165,250,0.8)' },
    { label: 'Expected Time',  value: job.jobExpectedTime   ? `${job.jobExpectedTime}h`  : '—', color: 'rgba(134,239,172,0.7)' },
    { label: 'Start Date',     value: job.startDate         ? formatDateShort(job.startDate) : '—', color: 'rgba(167,139,250,0.8)' },
    { label: 'Term',           value: job.term || '—',                                          color: 'rgba(134,239,172,0.5)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-2xl flex flex-col"
        style={{ borderColor: 'rgba(74,222,128,0.2)', maxHeight: '88vh' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(74,222,128,0.1)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold mb-2" style={{ color: '#bbf7d0' }}>{job.jobName}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={job.status} />
                {job.term && <TermBadge term={job.term} />}
                {job.learningCurve && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)', color: '#fde047' }}>
                    <Zap size={10} /> Learning Curve
                  </span>
                )}
              </div>
              <div className="text-xs mt-2" style={{ color: 'rgba(134,239,172,0.5)' }}>
                by {job.creatorId?.displayName || job.creatorId?.username || job.creatorName || 'Unknown'}
              </div>
            </div>
            <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            {stats.map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.1)' }}>
                <div className="text-xs mb-1" style={{ color: 'rgba(134,239,172,0.5)' }}>{s.label}</div>
                <div className="text-sm font-semibold" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {job.jobDescription && (
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: 'rgba(134,239,172,0.5)' }}>Description</div>
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.08)', color: '#bbf7d0', lineHeight: '1.7' }}
                dangerouslySetInnerHTML={{ __html: job.jobDescription }} />
            </div>
          )}

          {/* Leaders */}
          {(job.leaders || []).length > 0 && (
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: 'rgba(134,239,172,0.5)' }}>Leaders</div>
              <div className="flex flex-wrap gap-2">
                {job.leaders.map((l, i) => (
                  <span key={i} className="px-2 py-1 rounded-full text-xs"
                    style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0' }}>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Assets */}
          {(job.assets || []).length > 0 && (
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: 'rgba(134,239,172,0.5)' }}>Assets</div>
              <div className="space-y-1.5">
                {job.assets.map((a, i) => {
                  const Icon = getFileIcon(a.name);
                  return (
                    <a key={i} href={a.url} download={a.name} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm"
                      style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)', color: '#bbf7d0' }}>
                      <Icon size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
                      <span className="flex-1 truncate">{a.name}</span>
                      {a.size > 0 && <span className="text-xs" style={{ color: 'rgba(134,239,172,0.4)' }}>{formatSize(a.size)}</span>}
                      <Download size={12} style={{ color: 'rgba(134,239,172,0.4)', flexShrink: 0 }} />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(74,222,128,0.1)' }}>
          <button onClick={onClose} className="w-full py-2 rounded-xl text-sm"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.6)' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Job Modal (create / edit) ────────────────────────────────────────────────

function JobModal({ initial, onClose, onSave, title }) {
  const [form, setForm] = useState(initial || {
    jobName: '', jobDescription: '', hourlyRate: '',
    jobMaxDuration: '', jobMaxPayableTime: '', jobExpectedTime: '',
    startDate: today(), leaders: '', assets: [],
    term: '', learningCurve: false, status: 'active',
  });
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [err, setErr]               = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const removeAsset = (i) =>
    setForm(f => ({ ...f, assets: f.assets.filter((_, idx) => idx !== i) }));

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const d = await uploadAssets(files);
      if (d.success) setForm(f => ({ ...f, assets: [...f.assets, ...d.files.map(f => ({ ...f, uploadedAt: new Date().toISOString() }))] }));
    } catch (ex) { setErr(ex.message); }
    finally { setUploading(false); e.target.value = ''; }
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
        assets: form.assets,
      };
      if (initial?.id) payload.id = initial.id;
      await onSave(payload);
      onClose();
    } catch (ex) { setErr(ex.response?.data?.message || ex.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-3xl flex flex-col"
        style={{ borderColor: 'rgba(74,222,128,0.2)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(74,222,128,0.1)' }}>
          <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}><X size={18} /></button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: form */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {err && (
              <div className="flex items-center gap-2 text-sm mb-3 p-3 rounded-xl"
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

              {/* Numbers */}
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

              {/* Description — mini rich text */}
              <div>
                <label className="block text-xs mb-1" style={labelStyle}>Description</label>
                <ReactQuill
                  theme="snow"
                  value={form.jobDescription || ''}
                  onChange={v => set('jobDescription', v)}
                  modules={QUILL_MODULES_MINI}
                  formats={QUILL_FORMATS}
                  placeholder="Describe the job…"
                />
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

          {/* Right: assets sidebar */}
          <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden"
            style={{ borderLeft: '1px solid rgba(74,222,128,0.1)' }}>
            <div className="px-4 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(74,222,128,0.08)' }}>
              <div className="text-xs font-semibold mb-2" style={{ color: 'rgba(134,239,172,0.6)' }}>Assets</div>
              <label className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs transition-all"
                style={{ background: 'rgba(74,222,128,0.08)', border: '1px dashed rgba(74,222,128,0.3)', color: 'rgba(134,239,172,0.6)' }}>
                {uploading ? <Loader size={11} className="animate-spin" /> : <Upload size={11} />}
                {uploading ? 'Uploading…' : 'Add Files'}
                <input type="file" multiple className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {form.assets.length === 0 ? (
                <div className="text-xs text-center py-4" style={{ color: 'rgba(134,239,172,0.25)' }}>
                  No files yet
                </div>
              ) : form.assets.map((asset, i) => {
                const Icon = getFileIcon(asset.name);
                return (
                  <div key={i} className="rounded-xl p-2.5 group relative"
                    style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.12)' }}>
                    <div className="flex items-start gap-2">
                      <Icon size={16} style={{ color: '#4ade80', flexShrink: 0, marginTop: '1px' }} />
                      <div className="flex-1 min-w-0">
                        <a href={asset.url} download={asset.name} target="_blank" rel="noreferrer"
                          className="block text-xs font-medium truncate"
                          style={{ color: '#bbf7d0' }}>
                          {asset.name}
                        </a>
                        {asset.size > 0 && (
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(134,239,172,0.4)' }}>
                            {formatSize(asset.size)}
                          </div>
                        )}
                        {asset.uploadedAt && (
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(134,239,172,0.3)' }}>
                            {formatDate(asset.uploadedAt)}
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removeAsset(i)}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'rgba(248,113,113,0.7)' }}>
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(74,222,128,0.1)' }}>
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
    e.preventDefault(); setSaving(true); setErr('');
    try {
      const changes = {};
      if (form.jobName.trim())        changes.jobName        = form.jobName.trim();
      if (form.hourlyRate !== '')      changes.hourlyRate     = Number(form.hourlyRate);
      if (form.jobDescription.trim()) changes.jobDescription = form.jobDescription.trim();
      if (form.status)                changes.status         = form.status;
      if (!Object.keys(changes).length) { setErr('Specify at least one change'); setSaving(false); return; }
      await onSubmit({ jobId: job.id, changes, message: form.message });
      onClose();
    } catch (ex) { setErr(ex.response?.data?.message || ex.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-card rounded-2xl border w-full max-w-md p-6" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
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
          {[
            { key: 'jobName',      label: 'New Job Name',      type: 'input' },
            { key: 'hourlyRate',   label: 'New Hourly Rate ($)', type: 'number' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-xs mb-1" style={labelStyle}>{label}</label>
              <input type={type} className="input input-sm w-full" style={inputStyle}
                value={form[key]} onChange={e => set(key, e.target.value)} placeholder="Leave blank to keep" />
            </div>
          ))}
          <div>
            <label className="block text-xs mb-1" style={labelStyle}>New Description</label>
            <textarea className="input w-full rounded-xl p-2 text-sm resize-none" rows={2} style={inputStyle}
              value={form.jobDescription} onChange={e => set('jobDescription', e.target.value)} placeholder="Leave blank to keep" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={labelStyle}>New Status</label>
            <select className="input input-sm w-full" style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="">Keep current</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={labelStyle}>Message to Owner</label>
            <textarea className="input w-full rounded-xl p-2 text-sm resize-none" rows={2} style={inputStyle}
              value={form.message} onChange={e => set('message', e.target.value)} placeholder="Explain your request..." />
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
  if (!isOwner || !pending.length) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium" style={{ color: 'rgba(134,239,172,0.5)' }}>
        Pending Edit Requests ({pending.length})
      </div>
      {pending.map(r => (
        <div key={r._id || r.id} className="rounded-xl p-3 text-xs space-y-1"
          style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.1)' }}>
          <div className="flex items-center justify-between">
            <span style={{ color: '#bbf7d0' }}>{r.requesterName}</span>
            <div className="flex gap-1">
              <button onClick={() => onHandle(job.id, r._id || r.id, 'accept')}
                className="p-1 rounded-lg"
                style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                <Check size={12} />
              </button>
              <button onClick={() => onHandle(job.id, r._id || r.id, 'reject')}
                className="p-1 rounded-lg"
                style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
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

function JobCard({ job, userId, onEdit, onDelete, onRequestEdit, onHandle,
  onForum, onDetail, confirmDeleteId, onSetConfirmDelete }) {
  const isOwner = job.creatorId?.id === userId || job.creatorId?._id === userId ||
                  (typeof job.creatorId === 'string' && job.creatorId === userId);
  const [expanded, setExpanded] = useState(false);

  const descText = strip(job.jobDescription || '');

  return (
    <div className="glass-card rounded-2xl border p-5" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title row */}
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

          {/* Meta row */}
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
              <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(134,239,172,0.4)' }}>
                <Calendar size={10} />{formatDateShort(job.startDate)}
              </span>
            )}
          </div>

          {/* Description truncated */}
          {descText && (
            <p className="text-xs mt-2 line-clamp-2" style={{ color: 'rgba(134,239,172,0.6)' }}>
              {descText.length > 160 ? descText.slice(0, 160) + '…' : descText}
            </p>
          )}

          {/* Asset chips */}
          {(job.assets || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {job.assets.map((a, i) => (
                <a key={i} href={a.url} download={a.name} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: 'rgba(134,239,172,0.7)' }}>
                  <Download size={10} />
                  <span className="max-w-[100px] truncate">{a.name || `file-${i + 1}`}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Forum */}
          <button onClick={() => onForum(job)} className="p-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}
            title="Forum">
            <MessageSquare size={13} />
          </button>

          {/* Detail view */}
          <button onClick={() => onDetail(job)} className="p-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}
            title="View details">
            <Eye size={13} />
          </button>

          {isOwner ? (
            <>
              <button onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(74,222,128,0.05)', color: 'rgba(134,239,172,0.5)', border: '1px solid rgba(74,222,128,0.15)' }}
                title="Edit requests">
                <Check size={13} />
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

      {expanded && <EditRequestsPanel job={job} userId={userId} onHandle={onHandle} />}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReveloJobs() {
  const { user } = useAuth();
  const userId = user?._id || user?.id;

  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [modal, setModal]       = useState(null);
  const [requestModal, setRequestModal] = useState(null);
  const [forumJob, setForumJob] = useState(null);
  const [detailJob, setDetailJob] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await listJobs();
      if (d.success) setJobs(d.jobs);
      else setError(d.message);
    } catch (e) { setError(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
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

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#bbf7d0' }}>Jobs</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(134,239,172,0.5)' }}>Browse and manage Revelo jobs</p>
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
        <div className="glass-card rounded-2xl border p-12 text-center" style={{ borderColor: 'rgba(74,222,128,0.15)' }}>
          <Briefcase size={40} className="mx-auto mb-3" style={{ color: 'rgba(74,222,128,0.3)' }} />
          <div className="text-sm" style={{ color: 'rgba(134,239,172,0.5)' }}>No jobs yet. Create the first one!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <JobCard key={job.id} job={job} userId={userId}
              onEdit={j => setModal(toForm(j))}
              onDelete={handleDelete}
              onRequestEdit={j => setRequestModal(j)}
              onHandle={async (jobId, requestId, action) => {
                const d = await handleEditRequest({ jobId, requestId, action });
                if (d?.success) setJobs(prev => prev.map(x => x.id === jobId ? d.job : x));
              }}
              onForum={j => setForumJob(j)}
              onDetail={j => setDetailJob(j)}
              confirmDeleteId={confirmDeleteId}
              onSetConfirmDelete={setConfirmDeleteId}
            />
          ))}
        </div>
      )}

      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <JobModal initial={modal === 'new' ? null : modal}
          title={modal === 'new' ? 'New Job' : 'Edit Job'}
          onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {requestModal && (
        <RequestEditModal job={requestModal}
          onClose={() => setRequestModal(null)}
          onSubmit={async (data) => { await requestJobEdit(data); }} />
      )}

      {forumJob && (
        <ForumModal job={forumJob} currentUser={user} onClose={() => setForumJob(null)} />
      )}

      {detailJob && (
        <JobDetailModal job={detailJob} onClose={() => setDetailJob(null)} />
      )}
    </div>
  );
}
