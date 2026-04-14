import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, ExternalLink, ThumbsUp, CheckCircle,
  XCircle, Circle, Send, X, Check, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getBlog, deleteBlog,
  commentIssue, likeIssue, solveIssue, closeIssue,
  editComment, likeComment,
} from '../api/blogApi';
import 'react-quill/dist/quill.snow.css';

function StatusBadge({ status }) {
  if (status === 'solved') {
    return (
      <span className="badge badge-success gap-1 font-semibold">
        <CheckCircle size={12} /> Solved
      </span>
    );
  }
  if (status === 'closed') {
    return (
      <span className="badge badge-neutral gap-1 font-semibold">
        <XCircle size={12} /> Closed
      </span>
    );
  }
  return (
    <span className="badge badge-primary badge-outline gap-1 font-semibold">
      <Circle size={12} /> Open
    </span>
  );
}

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [blog,             setBlog]             = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');
  const [confirmOpen,      setConfirmOpen]      = useState(false);
  const [deleting,         setDeleting]         = useState(false);
  const [lightbox,         setLightbox]         = useState(null);
  const [commentText,      setCommentText]      = useState('');
  const [commenting,       setCommenting]       = useState(false);
  const [liking,           setLiking]           = useState(false);
  const [solving,          setSolving]          = useState(false);
  const [closing,          setClosing]          = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText,  setEditCommentText]  = useState('');
  const [savingEdit,       setSavingEdit]       = useState(false);
  const [likingCommentId,  setLikingCommentId]  = useState(null);

  const userId = user?._id || user?.id;

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getBlog(id);
        setBlog(res.data.data);
      } catch {
        setError('Issue not found or failed to load.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBlog(id);
      navigate('/blogs');
    } catch {
      alert('Failed to delete issue.');
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const handleLike = async () => {
    if (!user) return;
    setLiking(true);
    try { setBlog((await likeIssue({ id, userId })).data.data); }
    catch { alert('Failed to toggle like.'); }
    finally { setLiking(false); }
  };

  const handleSolve = async () => {
    setSolving(true);
    try { setBlog((await solveIssue({ id, userId })).data.data); }
    catch { alert('Failed to mark as solved.'); }
    finally { setSolving(false); }
  };

  const handleClose = async () => {
    setClosing(true);
    try { setBlog((await closeIssue({ id, userId })).data.data); }
    catch { alert('Failed to close issue.'); }
    finally { setClosing(false); }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !user) return;
    setCommenting(true);
    try {
      setBlog((await commentIssue({
        id, userId,
        username:    user.username    || '',
        displayName: user.displayName || '',
        content:     commentText.trim(),
      })).data.data);
      setCommentText('');
    } catch { alert('Failed to add comment.'); }
    finally { setCommenting(false); }
  };

  const startEditComment = (c) => {
    setEditingCommentId(c._id || c.id);
    setEditCommentText(c.content);
  };

  const handleSaveEditComment = async (commentId) => {
    if (!editCommentText.trim()) return;
    setSavingEdit(true);
    try {
      setBlog((await editComment({ id, commentId, userId, content: editCommentText.trim() })).data.data);
      setEditingCommentId(null);
    } catch { alert('Failed to save comment.'); }
    finally { setSavingEdit(false); }
  };

  const handleLikeComment = async (commentId) => {
    if (!user) return;
    setLikingCommentId(commentId);
    try { setBlog((await likeComment({ id, commentId, userId })).data.data); }
    catch { alert('Failed to toggle like.'); }
    finally { setLikingCommentId(null); }
  };

  const fmt   = (iso) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const fmtDT = (iso) => new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const isOpen     = blog?.status === 'open';
  const isLiked    = blog?.likes?.includes(userId);
  const isReporter = user && blog?.userId && blog.userId === userId;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <button
        className="btn btn-ghost btn-sm gap-1 mb-4"
        onClick={() => navigate('/blogs')}
      >
        <ArrowLeft size={15} /> Back to Issues
      </button>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="alert alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && blog && (
        <>
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-start gap-2 flex-wrap mb-1">
              <StatusBadge status={blog.status} />
              <h1 className="text-2xl font-bold leading-snug flex-1">{blog.title}</h1>
            </div>
            <p className="text-sm text-base-content/50">
              <strong>#{blog.id?.slice(-6)}</strong>&nbsp;·&nbsp;
              reported by <strong>@{blog.username || blog.author}</strong>&nbsp;·&nbsp;
              opened {fmt(blog.createdAt)}
              {blog.comments?.length > 0 &&
                ` · ${blog.comments.length} comment${blog.comments.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="divider my-3" />

          {/* Body */}
          <div className="border border-base-300 rounded-xl overflow-hidden mb-4">
            {/* Comment-style header */}
            <div className="flex items-center justify-between px-4 py-2 bg-base-200 border-b border-base-300">
              <div className="flex items-center gap-2">
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-7 h-7 text-xs flex items-center justify-center font-bold">
                    {(blog.username || blog.author || '?')[0].toUpperCase()}
                  </div>
                </div>
                <span className="text-sm font-semibold">@{blog.username || blog.author}</span>
                <span className="text-xs text-base-content/50">· {fmtDT(blog.createdAt)}</span>
              </div>
              {blog.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {blog.tags.map((tag) => (
                    <span key={tag} className="badge badge-primary badge-outline badge-sm">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div
              className="ql-editor prose max-w-none px-5 py-4"
              dangerouslySetInnerHTML={{
                __html: blog.content?.trimStart().startsWith('<')
                  ? blog.content
                  : blog.content?.split('\n').map((l) => `<p>${l || '<br>'}</p>`).join('') || '',
              }}
            />

            {/* Images */}
            {blog.images?.length > 0 && (
              <div className="px-5 pb-4">
                <div className="divider my-2" />
                <p className="text-sm font-semibold mb-2">
                  Attachments — Images ({blog.images.length})
                </p>
                <div className={`grid gap-2 ${blog.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {blog.images.map((img, i) => (
                    <div
                      key={img.path}
                      className="overflow-hidden rounded-lg cursor-zoom-in"
                      onClick={() => setLightbox(img.url)}
                    >
                      <img
                        src={img.url}
                        alt={`attachment-${i + 1}`}
                        loading="lazy"
                        className="w-full object-cover rounded"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 mb-8 flex-wrap">
            <button
              className={`btn btn-sm gap-1 ${isLiked ? 'btn-primary' : 'btn-outline btn-primary'}`}
              onClick={handleLike}
              disabled={liking || !user}
              title={isLiked ? 'Unlike' : 'Like'}
            >
              {liking
                ? <span className="loading loading-spinner loading-xs"></span>
                : <ThumbsUp size={14} />
              }
              {blog.likes?.length || 0}
            </button>

            <div className="flex-1" />

            {isReporter && (
              <>
                {isOpen && (
                  <>
                    <button
                      className="btn btn-success btn-sm gap-1"
                      onClick={handleSolve}
                      disabled={solving}
                    >
                      {solving
                        ? <span className="loading loading-spinner loading-xs"></span>
                        : <CheckCircle size={14} />
                      }
                      Mark as Solved
                    </button>
                    <button
                      className="btn btn-sm btn-outline gap-1"
                      onClick={handleClose}
                      disabled={closing}
                    >
                      {closing
                        ? <span className="loading loading-spinner loading-xs"></span>
                        : <XCircle size={14} />
                      }
                      Close Issue
                    </button>
                  </>
                )}
                <button
                  className="btn btn-warning btn-outline btn-sm gap-1"
                  onClick={() => navigate(`/edit/${blog.id}`)}
                >
                  <Edit size={14} /> Edit
                </button>
                <button
                  className="btn btn-error btn-outline btn-sm gap-1"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
          </div>

          {/* Comments */}
          <h2 className="text-lg font-bold mb-3">
            Comments ({blog.comments?.length || 0})
          </h2>

          {blog.comments?.length > 0 && (
            <div className="flex flex-col gap-3 mb-4">
              {blog.comments.map((c) => {
                const cId         = c._id || c.id;
                const isEditing   = editingCommentId === cId;
                const isMyComment = c.userId === userId;
                const cLiked      = c.likes?.includes(userId);
                const cLiking     = likingCommentId === cId;

                return (
                  <div key={cId} className="border border-base-300 rounded-xl overflow-hidden">
                    {/* Comment header */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-base-200 border-b border-base-300">
                      <div className="avatar placeholder">
                        <div className="bg-secondary text-secondary-content rounded-full w-6 h-6 text-xs flex items-center justify-center font-bold">
                          {(c.displayName || c.username || '?')[0].toUpperCase()}
                        </div>
                      </div>
                      <span className="text-sm font-semibold">
                        {c.displayName || `@${c.username}`}
                      </span>
                      <span className="text-xs text-base-content/50">· {fmtDT(c.createdAt)}</span>
                      <div className="ml-auto flex items-center gap-1">
                        {/* Like comment */}
                        <button
                          className={`btn btn-ghost btn-xs btn-circle ${cLiked ? 'text-primary' : 'text-base-content/50'}`}
                          disabled={!user || cLiking}
                          onClick={() => handleLikeComment(cId)}
                          title={cLiked ? 'Unlike' : 'Like'}
                        >
                          {cLiking
                            ? <span className="loading loading-spinner loading-xs"></span>
                            : <ThumbsUp size={13} />
                          }
                        </button>
                        {c.likes?.length > 0 && (
                          <span className="text-xs text-base-content/50 min-w-[12px]">
                            {c.likes.length}
                          </span>
                        )}
                        {/* Edit comment */}
                        {isMyComment && !isEditing && (
                          <button
                            className="btn btn-ghost btn-xs btn-circle"
                            onClick={() => startEditComment(c)}
                            title="Edit comment"
                          >
                            <Edit size={13} />
                          </button>
                        )}
                        {isEditing && (
                          <>
                            <button
                              className="btn btn-ghost btn-xs btn-circle text-primary"
                              disabled={savingEdit}
                              onClick={() => handleSaveEditComment(cId)}
                              title="Save"
                            >
                              {savingEdit
                                ? <span className="loading loading-spinner loading-xs"></span>
                                : <Check size={13} />
                              }
                            </button>
                            <button
                              className="btn btn-ghost btn-xs btn-circle"
                              onClick={() => setEditingCommentId(null)}
                              title="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Comment body */}
                    <div className="px-4 py-3">
                      {isEditing ? (
                        <textarea
                          className="textarea textarea-bordered w-full min-h-[80px]"
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add comment */}
          {user ? (
            <div className="border border-base-300 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-base-200 border-b border-base-300">
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-6 h-6 text-xs flex items-center justify-center font-bold">
                    {(user.displayName || user.username || '?')[0].toUpperCase()}
                  </div>
                </div>
                <span className="text-sm font-semibold">
                  {user.displayName || `@${user.username}`}
                </span>
              </div>
              <div className="p-4">
                <textarea
                  className="textarea textarea-bordered w-full min-h-[96px]"
                  placeholder="Leave a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <div className="flex justify-end mt-2">
                  <button
                    className="btn btn-primary btn-sm gap-1"
                    onClick={handleComment}
                    disabled={commenting || !commentText.trim()}
                  >
                    {commenting
                      ? <span className="loading loading-spinner loading-xs"></span>
                      : <Send size={13} />
                    }
                    Comment
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div role="alert" className="alert alert-info rounded-xl">
              <AlertCircle size={16} />
              <span>
                <button className="btn btn-xs btn-ghost" onClick={() => navigate('/signin')}>Sign in</button>
                {' '}to leave a comment.
              </span>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <dialog className="modal modal-open" onClick={() => setLightbox(null)}>
          <div
            className="modal-box max-w-none bg-transparent shadow-none p-0 relative cursor-zoom-out"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox}
              alt="full-size"
              className="max-w-[90vw] max-h-[85vh] block rounded-lg mx-auto"
              onClick={() => setLightbox(null)}
              style={{ cursor: 'zoom-out' }}
            />
            <a
              href={lightbox}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-circle btn-sm absolute top-2 right-2 bg-black/50 hover:bg-black/75 border-none text-white"
              onClick={(e) => e.stopPropagation()}
              title="Open in new tab"
            >
              <ExternalLink size={14} />
            </a>
          </div>
          <div className="modal-backdrop" onClick={() => setLightbox(null)} />
        </dialog>
      )}

      {/* Delete confirm */}
      {confirmOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Delete Issue?</h3>
            <p className="py-4 text-sm">
              Are you sure you want to delete <strong>"{blog?.title}"</strong>?
              All attachments will be permanently removed.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-sm"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-error btn-sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <><span className="loading loading-spinner loading-xs"></span> Deleting…</>
                  : 'Delete'
                }
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !deleting && setConfirmOpen(false)} />
        </dialog>
      )}
    </div>
  );
}
