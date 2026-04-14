import { useState, useEffect } from 'react';
import { Trash2, Eye, EyeOff, Plus, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  addGithubToken, removeGithubToken, getTokenUsage,
  setFetchOrder, setScoreFilters,
} from '../api/authApi';

// ── Helpers ───────────────────────────────────────────────────────────────

const FETCH_ORDER_OPTIONS = [
  { value: 'oldest',       label: 'Oldest first (default)' },
  { value: 'newest',       label: 'Newest first' },
  { value: 'alphabetical', label: 'Alphabetical (A → Z by title)' },
  { value: 'priority',     label: 'Priority (pinned first, then priority rank)' },
  { value: 'random',       label: 'Random' },
];

function progressColor(pct) {
  if (pct > 50) return 'progress-success';
  if (pct > 15) return 'progress-warning';
  return 'progress-error';
}

function usageLabelColor(pct) {
  if (pct > 50) return 'text-success';
  if (pct > 15) return 'text-warning';
  return 'text-error';
}

function TokenUsageBar({ remaining, limit, resetAt }) {
  const pct     = limit > 0 ? Math.round((remaining / limit) * 100) : 0;
  const resetIn = resetAt ? Math.max(0, Math.round((resetAt - Date.now()) / 60000)) : null;
  return (
    <div className="w-full min-w-[180px]">
      <div className="flex justify-between mb-0.5">
        <span className={`text-xs font-medium ${usageLabelColor(pct)}`}>
          {remaining.toLocaleString()} / {limit.toLocaleString()} remaining
        </span>
        {resetIn !== null && (
          <span className="text-xs text-base-content/40">resets in {resetIn}m</span>
        )}
      </div>
      <progress className={`progress w-full h-1.5 ${progressColor(pct)}`} value={pct} max="100" />
    </div>
  );
}

// ── Issue Fetch Order ─────────────────────────────────────────────────────

function FetchOrderSection() {
  const { user, setUser }     = useAuth();
  const [order, setOrder]     = useState('oldest');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.fetchOrder) setOrder(user.fetchOrder);
  }, [user?.fetchOrder]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await setFetchOrder({ fetchOrder: order });
      setUser(res.data);
      setSuccess('Fetch order saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save fetch order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">Issue Fetch Order</h2>
      <p className="text-sm text-base-content/60 mb-4">
        Controls the order in which the Python client apps pick up issues to work on.
      </p>

      {error && (
        <div role="alert" className="alert alert-error text-sm py-2 mb-3">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}
      {success && (
        <div role="alert" className="alert alert-success text-sm py-2 mb-3">
          <CheckCircle size={16} /><span>{success}</span>
        </div>
      )}

      <select
        className="select select-bordered w-full max-w-sm mb-4"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
      >
        {FETCH_ORDER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loading}>
        {loading ? <span className="loading loading-spinner loading-sm" /> : null}
        {loading ? 'Saving…' : 'Save Preference'}
      </button>
    </div>
  );
}

// ── GitHub Tokens ─────────────────────────────────────────────────────────

function GitHubTokenSection() {
  const { user, setUser } = useAuth();
  const [newToken,     setNewToken]     = useState('');
  const [newLabel,     setNewLabel]     = useState('');
  const [showNew,      setShowNew]      = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [removingId,   setRemovingId]   = useState(null);
  const [usages,       setUsages]       = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');

  const tokens = user?.githubTokens || [];

  const loadUsages = async () => {
    setUsageLoading(true);
    try {
      const res = await getTokenUsage();
      setUsages(res.data.data || []);
    } catch { /* ignore */ }
    finally { setUsageLoading(false); }
  };

  useEffect(() => {
    if (tokens.length > 0) loadUsages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens.length]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newToken.trim()) return;
    setError(''); setSuccess(''); setAdding(true);
    try {
      const res = await addGithubToken({ token: newToken.trim(), label: newLabel.trim() });
      setUser(res.data);
      setNewToken(''); setNewLabel('');
      setSuccess('Token added');
      loadUsages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add token');
    } finally { setAdding(false); }
  };

  const handleRemove = async (id) => {
    setRemovingId(id); setError('');
    try {
      const res = await removeGithubToken({ id });
      setUser(res.data);
      setUsages(prev => prev.filter(u => u.id !== id));
    } catch { setError('Failed to remove token'); }
    finally { setRemovingId(null); }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">GitHub Tokens</h2>
      <p className="text-sm text-base-content/60 mb-4">
        Add multiple tokens to raise rate limits (5 000 req/hr each). The server automatically
        rotates to the next token when one is exhausted. Generate tokens at GitHub → Settings →
        Developer settings → Personal access tokens.
      </p>

      {error && (
        <div role="alert" className="alert alert-error text-sm py-2 mb-3">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}
      {success && (
        <div role="alert" className="alert alert-success text-sm py-2 mb-3">
          <CheckCircle size={16} /><span>{success}</span>
        </div>
      )}

      {tokens.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold">Configured tokens ({tokens.length})</span>
            <button
              className="btn btn-ghost btn-xs"
              onClick={loadUsages}
              disabled={usageLoading}
              title="Refresh usage"
            >
              <RefreshCw size={14} className={usageLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div>
            {tokens.map((t) => {
              const usage = usages.find(u => u.id === t.id);
              return (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-base-300">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {t.label || <em className="text-base-content/40 not-italic">unlabelled</em>}
                        </p>
                        <p className="text-xs text-base-content/40 font-mono truncate">{t.masked}</p>
                      </div>
                      <button
                        className="btn btn-ghost btn-xs text-error shrink-0"
                        disabled={removingId === t.id}
                        onClick={() => handleRemove(t.id)}
                      >
                        {removingId === t.id
                          ? <span className="loading loading-spinner loading-xs" />
                          : <Trash2 size={14} />}
                      </button>
                    </div>

                    {usageLoading && !usage && (
                      <progress className="progress w-full mt-1 h-1" />
                    )}
                    {usage && (
                      <div className="mt-1.5">
                        <TokenUsageBar remaining={usage.remaining} limit={usage.limit} resetAt={usage.resetAt} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={handleAdd}>
        <p className="text-sm font-bold mb-2">Add a token</p>
        <input
          className="input input-bordered w-full max-w-sm mb-2"
          placeholder="Label (optional) — e.g. personal, work"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
        />
        <div className="relative max-w-sm mb-3">
          <input
            className="input input-bordered w-full pr-10"
            type={showNew ? 'text' : 'password'}
            placeholder="ghp_…"
            required
            value={newToken}
            onChange={e => setNewToken(e.target.value)}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
            onClick={() => setShowNew(v => !v)}
            tabIndex={-1}
          >
            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={adding || !newToken.trim()}
        >
          {adding ? <span className="loading loading-spinner loading-sm" /> : <Plus size={15} />}
          {adding ? 'Adding…' : 'Add Token'}
        </button>
      </form>
    </div>
  );
}

// ── Smart Search Score Filters ────────────────────────────────────────────

function ScoreFiltersSection() {
  const { user, setUser }   = useAuth();
  const [minRepo,  setMinRepo]  = useState(0);
  const [minIssue, setMinIssue] = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  useEffect(() => {
    setMinRepo(user?.minRepoScore  ?? 0);
    setMinIssue(user?.minIssueScore ?? 0);
  }, [user?.minRepoScore, user?.minIssueScore]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await setScoreFilters({ minRepoScore: minRepo, minIssueScore: minIssue });
      setUser(res.data);
      setSuccess('Score filters saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save score filters');
    } finally { setLoading(false); }
  };

  const scoreLabelColor = (v) => {
    if (v >= 75) return 'text-success';
    if (v >= 50) return 'text-warning';
    if (v >= 25) return 'text-info';
    return 'text-base-content/40';
  };

  const SliderRow = ({ label, caption, value, onChange }) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className={`text-sm font-bold ${value > 0 ? scoreLabelColor(value) : 'text-base-content/40'}`}>
          {value === 0 ? 'Off' : `≥ ${value}`}
        </span>
      </div>
      <p className="text-xs text-base-content/50 mb-2">{caption}</p>
      <div className="flex items-center gap-3">
        <input
          type="range"
          className="range range-primary flex-1"
          min={0} max={100} step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          type="number"
          className="input input-bordered input-sm w-16 text-center"
          min={0} max={100}
          value={value}
          onChange={(e) => onChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-lg font-bold mb-1">Smart Search Filters</h2>
      <p className="text-sm text-base-content/60 mb-4">
        Only show repos and issues at or above these score thresholds in Smart Search.
        Set to 0 to disable filtering.
      </p>

      {error && (
        <div role="alert" className="alert alert-error text-sm py-2 mb-3">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}
      {success && (
        <div role="alert" className="alert alert-success text-sm py-2 mb-3">
          <CheckCircle size={16} /><span>{success}</span>
        </div>
      )}

      <SliderRow
        label="Min Repo Score"
        caption="Filters Repo Search results and Random Search repos"
        value={minRepo}
        onChange={setMinRepo}
      />
      <SliderRow
        label="Min Issue Score"
        caption="Filters Issue Search results and Random Search review panel"
        value={minIssue}
        onChange={setMinIssue}
      />

      <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
        {loading ? <span className="loading loading-spinner loading-sm" /> : null}
        {loading ? 'Saving…' : 'Save Filters'}
      </button>
    </form>
  );
}

// ── PR Settings Page ──────────────────────────────────────────────────────

export default function PRSettings() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <p>Please sign in to view settings.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">PR Writer Settings</h1>
      <p className="text-sm text-base-content/60 mb-4">
        Configuration for GitHub tokens, issue fetch behaviour, and search filters.
      </p>

      <div className="divider"></div>
      <FetchOrderSection />
      <div className="divider"></div>
      <GitHubTokenSection />
      <div className="divider"></div>
      <ScoreFiltersSection />
    </div>
  );
}
