import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, ExternalLink } from 'lucide-react';
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
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 mb-8">
      {/* Header */}
      <div className="flex items-center mb-6">
        <h1 className="text-2xl font-bold flex-1">My Portfolios</h1>
        <button className="btn btn-primary" onClick={() => navigate('/portfolios/add')}>
          <Plus size={16} /> New Portfolio
        </button>
      </div>

      {listError && (
        <div role="alert" className="alert alert-error text-sm mb-4">
          <span>{listError}</span>
        </div>
      )}

      {portfolios.length === 0 ? (
        <div className="text-center mt-16">
          <p className="text-base-content/50 mb-3">You have no portfolios yet.</p>
          <button className="btn btn-outline" onClick={() => navigate('/portfolios/add')}>
            <Plus size={16} /> Create your first portfolio
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {portfolios.map((p) => (
            <div key={p.id} className="card bg-base-100 shadow-md border border-base-200">
              <div className="card-body py-4">
                <h2 className="card-title text-lg">{p.name}</h2>
                <p className="text-sm text-base-content/60 -mt-1">{p.title}</p>
                {p.bio && (
                  <p className="text-sm text-base-content/60 line-clamp-2 mt-1">{p.bio}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <a
                    href={portfolioUrl(p.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="badge badge-ghost gap-1 text-xs hover:badge-primary transition-colors"
                  >
                    <ExternalLink size={11} />
                    {portfolioUrl(p.slug)}
                  </a>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <div className="tooltip" data-tip="Edit">
                    <button
                      className="btn btn-ghost btn-sm btn-square"
                      onClick={() => navigate(`/portfolios/${p.slug}`, { state: { portfolio: p } })}
                    >
                      <Edit size={15} />
                    </button>
                  </div>
                  <div className="tooltip" data-tip="Delete">
                    <button
                      className="btn btn-ghost btn-sm btn-square text-error"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-2">Delete Portfolio</h3>
            <p className="text-sm text-base-content/70">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
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
                className="btn btn-error"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <span className="loading loading-spinner loading-sm" /> : null}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)} />
        </div>
      )}
    </div>
  );
}
