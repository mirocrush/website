import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, ExternalLink, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listPortfolios, deletePortfolio } from '../api/portfolioApi';

export default function Portfolios() {
  const navigate = useNavigate();

  const [portfolios,   setPortfolios]   = useState([]);
  const [listLoading,  setListLoading]  = useState(true);
  const [listError,    setListError]    = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => { fetchPortfolios(); }, []);

  const fetchPortfolios = async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await listPortfolios();
      setPortfolios(res.data);
    } catch {
      setListError('Failed to load portfolios');
    } finally {
      setListLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePortfolio({ id: deleteTarget.id });
      setPortfolios((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch { /* keep dialog open */ }
    setDeleting(false);
  };

  const portfolioUrl = (slug) => `${window.location.origin}/${slug}`;

  if (listLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto page-bg max-w-4xl px-4 py-8 mb-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Briefcase size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">My Portfolios</h1>
            <p className="text-sm text-base-content/50">
              {portfolios.length > 0
                ? `${portfolios.length} portfolio${portfolios.length !== 1 ? 's' : ''}`
                : 'No portfolios yet'
              }
            </p>
          </div>
        </div>
        <button
          className="btn btn-primary gap-2 shadow-sm"
          onClick={() => navigate('/portfolios/add')}
        >
          <Plus size={16} />
          New Portfolio
        </button>
      </div>

      {listError && (
        <div role="alert" className="alert alert-error text-sm mb-6">
          <span>{listError}</span>
        </div>
      )}

      {portfolios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5 border border-base-300 rounded-2xl bg-base-100">
          <div className="p-5 bg-base-200 rounded-full">
            <Briefcase size={32} className="text-base-content/20" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-base-content/60">No portfolios yet</p>
            <p className="text-sm text-base-content/40 mt-1">
              Create your first portfolio to showcase your work.
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={() => navigate('/portfolios/add')}
          >
            <Plus size={14} /> Create your first portfolio
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {portfolios.map((p) => (
            <div
              key={p.id}
              className="group bg-base-100 border border-base-200 rounded-2xl shadow-sm hover:shadow-md hover:border-base-300 transition-all duration-150 overflow-hidden"
            >
              {/* Color accent bar */}
              <div className="h-1.5 bg-gradient-to-r from-primary/70 via-secondary/70 to-accent/70" />

              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar / initials */}
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-content font-bold text-lg select-none shadow-sm">
                    {p.name?.[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-base truncate">{p.name}</h2>
                    {p.title && (
                      <p className="text-sm text-base-content/60 truncate">{p.title}</p>
                    )}
                    {p.bio && (
                      <p className="text-xs text-base-content/50 mt-1 line-clamp-2">{p.bio}</p>
                    )}
                    <a
                      href={portfolioUrl(p.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline truncate max-w-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={11} />
                      {portfolioUrl(p.slug)}
                    </a>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="tooltip" data-tip="Edit portfolio">
                      <button
                        className="btn btn-ghost btn-sm btn-square"
                        onClick={() => navigate(`/portfolios/${p.slug}`, { state: { portfolio: p } })}
                      >
                        <Edit size={15} />
                      </button>
                    </div>
                    <div className="tooltip" data-tip="Delete portfolio">
                      <button
                        className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-error/10 rounded-full">
                <Trash2 size={18} className="text-error" />
              </div>
              <h3 className="font-bold text-lg">Delete Portfolio</h3>
            </div>
            <p className="text-sm text-base-content/70 mb-2">
              Are you sure you want to delete{' '}
              <strong className="text-base-content">"{deleteTarget.name}"</strong>?
            </p>
            <p className="text-xs text-base-content/50 mb-6">
              This will permanently remove the portfolio and its public URL. This cannot be undone.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-error gap-2"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <span className="loading loading-spinner loading-sm" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)} />
        </dialog>
      )}
    </div>
  );
}
