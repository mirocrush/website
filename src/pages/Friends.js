import { useEffect, useState } from 'react';
import { UserPlus, UserX, UserCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendRequest, respondToRequest, listRequests, listFriends, removeFriend } from '../api/friendsApi';

// ── Helpers ────────────────────────────────────────────────────────────────────

function UserAvatar({ user }) {
  const initials = user.displayName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  if (user.avatarUrl) {
    return (
      <div className="avatar">
        <div className="w-10 rounded-full">
          <img src={user.avatarUrl} alt={user.displayName} />
        </div>
      </div>
    );
  }
  return (
    <div className="avatar avatar-placeholder">
      <div className="bg-secondary text-secondary-content w-10 rounded-full">
        <span className="text-sm font-bold">{initials}</span>
      </div>
    </div>
  );
}

// ── Send Request Tab ───────────────────────────────────────────────────────────

function SendRequestTab() {
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await sendRequest({ query: query.trim() });
      setSuccess('Friend request sent!');
      setQuery('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="max-w-md">
      <p className="text-sm text-base-content/60 mb-4">
        Enter someone's username (e.g. <strong>john_doe</strong>) or email address.
      </p>
      {error   && <div role="alert" className="alert alert-error text-sm mb-3"><span>{error}</span></div>}
      {success && <div role="alert" className="alert alert-success text-sm mb-3"><span>{success}</span></div>}
      <div className="flex gap-2">
        <input
          className="input input-bordered w-full"
          placeholder="Username or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !query.trim()}
        >
          {loading
            ? <span className="loading loading-spinner loading-sm" />
            : <UserPlus size={16} />
          }
          Send
        </button>
      </div>
    </form>
  );
}

// ── Friends Tab ────────────────────────────────────────────────────────────────

function FriendsTab() {
  const navigate              = useNavigate();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    listFriends()
      .then((res) => setFriends(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (f) => {
    setRemoving(f.id);
    try {
      await removeFriend(f.id);
      setFriends((prev) => prev.filter((x) => x.id !== f.id));
    } catch { /* silent */ }
    setRemoving(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/50">
        No friends yet — send a request!
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {friends.map((f) => (
        <li key={f.id} className="flex items-center gap-3 p-3 bg-base-100 rounded-lg shadow-sm border border-base-200">
          <UserAvatar user={f} />
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{f.displayName}</p>
            <p className="text-xs text-base-content/50">@{f.username}</p>
          </div>
          <div className="tooltip" data-tip="View profile">
            <button
              className="btn btn-ghost btn-sm btn-square"
              onClick={() => navigate(`/profiles/${f.username}`)}
            >
              <ExternalLink size={15} />
            </button>
          </div>
          <div className="tooltip" data-tip="Remove friend">
            <button
              className="btn btn-ghost btn-sm btn-square text-error"
              onClick={() => handleRemove(f)}
              disabled={removing === f.id}
            >
              {removing === f.id
                ? <span className="loading loading-spinner loading-xs" />
                : <UserX size={15} />
              }
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Requests Tab ───────────────────────────────────────────────────────────────

function RequestsTab() {
  const [received, setReceived] = useState([]);
  const [sent,     setSent]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(null);

  useEffect(() => {
    Promise.all([listRequests('received'), listRequests('sent')])
      .then(([r, s]) => { setReceived(r.data); setSent(s.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRespond = async (requestId, action) => {
    setActing(requestId);
    try {
      await respondToRequest({ requestId, action });
      setReceived((prev) => prev.filter((r) => r.id !== requestId));
    } catch { /* silent */ }
    setActing(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Received */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-bold text-base">Received</h3>
        {received.length > 0 && (
          <span className="badge badge-primary badge-sm">{received.length}</span>
        )}
      </div>

      {received.length === 0 ? (
        <p className="text-sm text-base-content/50 mb-6">No pending requests</p>
      ) : (
        <ul className="space-y-2 mb-6">
          {received.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 bg-base-100 rounded-lg shadow-sm border border-base-200">
              <UserAvatar user={r.sender} />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{r.sender.displayName}</p>
                <p className="text-xs text-base-content/50">@{r.sender.username}</p>
              </div>
              <button
                className="btn btn-success btn-sm"
                onClick={() => handleRespond(r.id, 'accept')}
                disabled={acting === r.id}
              >
                <UserCheck size={14} /> Accept
              </button>
              <button
                className="btn btn-error btn-outline btn-sm"
                onClick={() => handleRespond(r.id, 'deny')}
                disabled={acting === r.id}
              >
                <UserX size={14} /> Deny
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="divider" />

      {/* Sent */}
      <h3 className="font-bold text-base mb-3">Sent</h3>

      {sent.length === 0 ? (
        <p className="text-sm text-base-content/50">No sent requests</p>
      ) : (
        <ul className="space-y-2">
          {sent.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 bg-base-100 rounded-lg shadow-sm border border-base-200">
              <UserAvatar user={r.receiver} />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{r.receiver.displayName}</p>
                <p className="text-xs text-base-content/50">@{r.receiver.username}</p>
              </div>
              <span className="badge badge-outline">Pending</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Friends Page ───────────────────────────────────────────────────────────────

export default function Friends() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate('/signin');
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const tabs = ['My Friends', 'Requests', 'Add Friend'];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Friends</h1>

      <div role="tablist" className="tabs tabs-bordered mb-4">
        {tabs.map((label, i) => (
          <button
            key={label}
            role="tab"
            className={`tab${tab === i ? ' tab-active' : ''}`}
            onClick={() => setTab(i)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {tab === 0 && <FriendsTab />}
        {tab === 1 && <RequestsTab />}
        {tab === 2 && <SendRequestTab />}
      </div>
    </div>
  );
}
