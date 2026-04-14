import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, CheckCircle, Circle, MessageCircle, ThumbsUp, AlertCircle,
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
    tab === 'all' ? true : tab === 'open' ? i.status !== 'solved' : i.status === 'solved'
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Issues</h1>
          <p className="text-sm text-base-content/60 mt-0.5">
            Track and discuss problems or suggestions
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm gap-1"
          onClick={() => navigate('/create')}
        >
          <Plus size={15} />
          Report Issue
        </button>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button className="btn btn-sm btn-ghost" onClick={fetchIssues}>Retry</button>
        </div>
      )}

      {/* Issue list panel */}
      <div className="border border-base-300 rounded-xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center px-3 bg-base-200 border-b border-base-300">
          <div className="tabs tabs-bordered">
            <button
              className={`tab tab-sm gap-1.5 ${tab === 'open' ? 'tab-active' : ''}`}
              onClick={() => setTab('open')}
            >
              <Circle size={13} className="text-success" />
              {openCount} Open
            </button>
            <button
              className={`tab tab-sm gap-1.5 ${tab === 'solved' ? 'tab-active' : ''}`}
              onClick={() => setTab('solved')}
            >
              <CheckCircle size={13} className="text-secondary" />
              {solvedCount} Solved
            </button>
            <button
              className={`tab tab-sm ${tab === 'all' ? 'tab-active' : ''}`}
              onClick={() => setTab('all')}
            >
              All
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-base-content/50">
            <p className="mb-3">No {tab !== 'all' ? tab : ''} issues found.</p>
            {tab !== 'solved' && (
              <button
                className="btn btn-primary btn-sm gap-1"
                onClick={() => navigate('/create')}
              >
                <Plus size={14} />
                Report the first issue
              </button>
            )}
          </div>
        )}

        {/* Issue rows */}
        {!loading && filtered.map((issue, idx) => (
          <React.Fragment key={issue.id}>
            {idx > 0 && <div className="divider my-0" />}
            <div
              className="flex items-start px-5 py-3 cursor-pointer hover:bg-base-200 transition-colors"
              onClick={() => navigate(`/blogs/${issue.id}`)}
            >
              {/* Status icon */}
              <div className="mt-0.5 mr-3 shrink-0">
                {issue.status === 'solved'
                  ? <CheckCircle size={18} className="text-secondary" />
                  : <Circle size={18} className="text-success" />
                }
              </div>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-semibold text-sm hover:text-primary">
                    {issue.title}
                  </span>
                  {issue.status === 'solved' && (
                    <span className="badge badge-secondary badge-sm font-semibold">Solved</span>
                  )}
                  {issue.tags?.map((tag) => (
                    <span key={tag} className="badge badge-outline badge-sm">{tag}</span>
                  ))}
                </div>
                <p className="text-xs text-base-content/50">
                  #{issue.id?.slice(-6)}&nbsp;·&nbsp;opened{' '}
                  {new Date(issue.createdAt).toLocaleDateString()} by @{issue.username || issue.author}
                </p>
              </div>

              {/* Right: comments + likes */}
              <div className="flex items-center gap-4 ml-4 shrink-0">
                {issue.comments?.length > 0 && (
                  <div
                    className="flex items-center gap-1 text-xs text-base-content/50"
                    title={`${issue.comments.length} comment${issue.comments.length !== 1 ? 's' : ''}`}
                  >
                    <MessageCircle size={13} />
                    {issue.comments.length}
                  </div>
                )}
                {issue.likes?.length > 0 && (
                  <div
                    className="flex items-center gap-1 text-xs text-base-content/50"
                    title={`${issue.likes.length} like${issue.likes.length !== 1 ? 's' : ''}`}
                  >
                    <ThumbsUp size={13} />
                    {issue.likes.length}
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
