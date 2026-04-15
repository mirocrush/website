import { useState } from 'react';
import { Eye, Pencil, Trash2, FileText, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deleteBlog } from '../api/blogApi';

export default function BlogCard({ blog, onDeleted }) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBlog(blog.id);
      onDeleted(blog.id);
    } catch {
      alert('Failed to delete blog.');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

  const preview = blog.content.replace(/<[^>]*>/g, '');
  const previewText = preview.length > 140 ? preview.slice(0, 140) + '…' : preview;

  const thumbnail = blog.images?.[0]?.url ?? null;
  const pdfCount  = blog.pdfs?.length ?? 0;

  return (
    <>
      <div className="card bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition-shadow duration-200 h-full flex flex-col">

        {/* Thumbnail */}
        {thumbnail ? (
          <figure className="overflow-hidden rounded-t-2xl">
            <img
              src={thumbnail}
              alt={blog.title}
              className="w-full h-44 object-cover hover:scale-105 transition-transform duration-300"
            />
          </figure>
        ) : (
          <div className="h-2 rounded-t-2xl bg-gradient-to-r from-primary/60 via-secondary/60 to-accent/60" />
        )}

        <div className="card-body flex flex-col gap-3 p-5 flex-1">
          {/* Title */}
          <h2 className="font-bold text-base leading-snug line-clamp-2 hover:text-primary transition-colors cursor-pointer"
            onClick={() => navigate(`/blogs/${blog.id}`)}>
            {blog.title}
          </h2>

          {/* Meta */}
          <p className="text-xs text-base-content/50">
            By <span className="font-semibold text-base-content/70">{blog.author}</span>
            &nbsp;·&nbsp;{formatDate(blog.createdAt)}
          </p>

          {/* Preview */}
          <p className="text-sm text-base-content/70 leading-relaxed line-clamp-3 flex-1">
            {previewText || <em className="text-base-content/30">No description</em>}
          </p>

          {/* Tags + PDF */}
          {(blog.tags?.length > 0 || pdfCount > 0) && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {blog.tags?.map((tag) => (
                <span key={tag} className="badge badge-outline badge-sm gap-1">
                  <Tag size={9} />
                  {tag}
                </span>
              ))}
              {pdfCount > 0 && (
                <span className="badge badge-error badge-outline badge-sm gap-1">
                  <FileText size={9} />
                  {pdfCount} PDF{pdfCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-auto pt-1 border-t border-base-200">
            <button
              className="btn btn-ghost btn-xs gap-1 flex-1"
              onClick={() => navigate(`/blogs/${blog.id}`)}
            >
              <Eye size={13} /> Read
            </button>
            <button
              className="btn btn-ghost btn-xs gap-1 flex-1 text-warning"
              onClick={() => navigate(`/edit/${blog.id}`)}
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              className="btn btn-ghost btn-xs gap-1 flex-1 text-error"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm dialog */}
      {confirmOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-error/10 rounded-full">
                <Trash2 size={20} className="text-error" />
              </div>
              <h3 className="font-bold text-lg">Delete post?</h3>
            </div>
            <p className="text-sm text-base-content/70 mb-6">
              Are you sure you want to delete <strong>"{blog.title}"</strong>?
              All attached images and PDFs will also be permanently removed.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost btn-sm"
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
                  ? <><span className="loading loading-spinner loading-xs" /> Deleting…</>
                  : 'Delete'}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => !deleting && setConfirmOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </>
  );
}
