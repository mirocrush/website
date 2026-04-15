import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, CheckCircle, Circle, MessageCircle, ThumbsUp,
  AlertCircle, Tag, RefreshCw,
} from 'lucide-react';
import { listBlogs } from '../api/blogApi';

export default function BlogList() {
  const navigate = useNavigate();
  const [issues,  setIssues]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tab,     setTab]     = useState('open');

  const fetchIssues = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listBlogs();
      setIssues(res.data.data);
    } catch {
      setError('Failed to load issues. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssues(); }, []);

  const openCount   = issues.filter((i) => i.status !== 'solved').length;
  const solvedCount = issues.filter((i) => i.status === 'solved').length;

  const filtered = issues.filter((i) =>
    tab === 'all'    ? true
    : tab === 'open' ? i.status !== 'solved'
    : i.status === 'solved'
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Issues</h1>
          <p className="text-sm text-base-content/50 mt-1">
            Track and discuss problems or suggestions
          </p>
        </div>
        <button
          className="btn btn-primary gap-2 shadow-sm"
          onClick={() => navigate('/create')}
        >
          <Plus size={16} />
          Report Issue
        </button>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="alert alert-error mb-6 shadow-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button className="btn btn-sm btn-ghost gap-1" onClick={fetchIssues}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Issue list panel */}
      <div className="border border-base-300 rounded-2xl overflow-hidden shadow-sm bg-base-100">

        {/* Tab bar */}
        <div className="flex items-center px-4 bg-base-200/60 border-b border-base-300 gap-1">
          {[
            { key: 'open',   label: `${openCount} Open`,   icon: <Circle size={12} className="text-success fill-success/30" /> },
            { key: 'solved', label: `${solvedCount} Solved`, icon: <CheckCircle size={12} className="text-secondary" /> },
            { key: 'all',    label: 'All',                  icon: null },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-base-content/50 hover:text-base-content'
              }`}
              onClick={() => setTab(key)}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-sm text-base-content/40">Loading issues…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="p-5 rounded-full bg-base-200">
              <Circle size={32} className="text-base-content/20" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-base-content/60">No {tab !== 'all' ? tab : ''} issues found</p>
              <p className="text-sm text-base-content/40 mt-1">
                {tab !== 'solved' ? 'Be the first to report one.' : 'No resolved issues yet.'}
              </p>
            </div>
            {tab !== 'solved' && (
              <button
                className="btn btn-primary btn-sm gap-1"
                onClick={() => navigate('/create')}
              >
                <Plus size={14} /> Report an issue
              </button>
            )}
          </div>
        )}

        {/* Issue rows */}
        {!loading && filtered.map((issue, idx) => (
          <div
            key={issue.id}
            className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-base-200/50 transition-colors group${idx > 0 ? ' border-t border-base-200' : ''}`}
            onClick={() => navigate(`/blogs/${issue.id}`)}
          >
            {/* Status icon */}
            <div className="mt-0.5 shrink-0">
              {issue.status === 'solved'
                ? <CheckCircle size={18} className="text-secondary" />
                : <Circle size={18} className="text-success" />
              }
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {issue.title}
                </span>
                {issue.status === 'solved' && (
                  <span className="badge badge-secondary badge-sm">Solved</span>
                )}
                {issue.tags?.map((tag) => (
                  <span key={tag} className="badge badge-outline badge-sm gap-1 text-[10px]">
                    <Tag size={8} />{tag}
                  </span>
                ))}
              </div>
              <p className="text-xs text-base-content/40">
                <span className="font-mono">#{issue.id?.slice(-6)}</span>
                &nbsp;·&nbsp;opened {new Date(issue.createdAt).toLocaleDateString()}
                &nbsp;by&nbsp;<span className="font-medium text-base-content/60">@{issue.username || issue.author}</span>
              </p>
            </div>

            {/* Right: engagement stats */}
            <div className="flex items-center gap-3 shrink-0 text-base-content/40">
              {issue.comments?.length > 0 && (
                <div className="flex items-center gap-1 text-xs hover:text-base-content transition-colors"
                  title={`${issue.comments.length} comment${issue.comments.length !== 1 ? 's' : ''}`}>
                  <MessageCircle size={13} />
                  <span>{issue.comments.length}</span>
                </div>
              )}
              {issue.likes?.length > 0 && (
                <div className="flex items-center gap-1 text-xs hover:text-base-content transition-colors"
                  title={`${issue.likes.length} like${issue.likes.length !== 1 ? 's' : ''}`}>
                  <ThumbsUp size={13} />
                  <span>{issue.likes.length}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
