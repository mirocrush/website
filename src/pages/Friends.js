import { useEffect, useState } from 'react';
import {
  UserPlus, UserX, UserCheck, ExternalLink, Users,
  Clock, Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendRequest, respondToRequest, listRequests, listFriends, removeFriend } from '../api/friendsApi';

// ── Avatar ─────────────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 'md' }) {
  const initials = user.displayName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const dim = size === 'lg' ? 'w-12' : 'w-10';
  if (user.avatarUrl) {
    return (
      <div className="avatar">
        <div className={`${dim} rounded-full ring-2 ring-base-300`}>
          <img src={user.avatarUrl} alt={user.displayName} />
        </div>
      </div>
    );
  }
  return (
    <div className="avatar placeholder">
      <div className={`bg-gradient-to-br from-primary to-secondary text-primary-content ${dim} rounded-full`}>
        <span className={`${size === 'lg' ? 'text-sm' : 'text-xs'} font-bold`}>{initials}</span>
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
      setSuccess('Friend request sent successfully!');
      setQuery('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <div className="bg-base-200/60 rounded-2xl p-6 mb-6 border border-base-300">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-full">
            <UserPlus size={18} className="text-primary" />
          </div>
          <h3 className="font-bold">Find friends</h3>
        </div>
        <p className="text-sm text-base-content/60">
          Enter someone's <strong>username</strong> or <strong>email address</strong> to send them a friend request.
        </p>
      </div>

      {error   && <div role="alert" className="alert alert-error text-sm mb-4"><span>{error}</span></div>}
      {success && <div role="alert" className="alert alert-success text-sm mb-4"><span>{success}</span></div>}

      <form onSubmit={handleSend} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
          <input
            className="input w-full pl-9"
            placeholder="Username or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary gap-2"
          disabled={loading || !query.trim()}
        >
          {loading ? <span className="loading loading-spinner loading-sm" /> : <UserPlus size={16} />}
          Send
        </button>
      </form>
    </div>
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
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="p-5 bg-base-200 rounded-full">
          <Users size={32} className="text-base-content/20" />
        </div>
        <div>
          <p className="font-semibold text-base-content/60">No friends yet</p>
          <p className="text-sm text-base-content/40 mt-1">Find someone using the "Add Friend" tab</p>
        </div>
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {friends.map((f) => (
        <li key={f.id}
          className="flex items-center gap-4 p-4 bg-base-100 rounded-xl border border-base-200 shadow-sm hover:shadow-md hover:border-base-300 transition-all duration-150">
          <UserAvatar user={f} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{f.displayName}</p>
            <p className="text-xs text-base-content/50">@{f.username}</p>
          </div>
          <div className="flex items-center gap-1">
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
                className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10"
                onClick={() => handleRemove(f)}
                disabled={removing === f.id}
              >
                {removing === f.id
                  ? <span className="loading loading-spinner loading-xs" />
                  : <UserX size={15} />
                }
              </button>
            </div>
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
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const emptySection = (msg) => (
    <div className="flex items-center gap-2 py-4 px-4 text-sm text-base-content/40 bg-base-200/50 rounded-xl">
      <Clock size={14} />
      {msg}
    </div>
  );

  return (
    <div className="flex flex-col gap-8">

      {/* Received */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-bold text-base">Received</h3>
          {received.length > 0 && (
            <span className="badge badge-primary badge-sm">{received.length}</span>
          )}
        </div>
        {received.length === 0 ? emptySection('No pending requests') : (
          <ul className="grid gap-3">
            {received.map((r) => (
              <li key={r.id}
                className="flex items-center gap-4 p-4 bg-base-100 rounded-xl border border-base-200 shadow-sm">
                <UserAvatar user={r.sender} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.sender.displayName}</p>
                  <p className="text-xs text-base-content/50">@{r.sender.username}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-success btn-sm gap-1"
                    onClick={() => handleRespond(r.id, 'accept')}
                    disabled={acting === r.id}
                  >
                    {acting === r.id
                      ? <span className="loading loading-spinner loading-xs" />
                      : <UserCheck size={14} />
                    }
                    Accept
                  </button>
                  <button
                    className="btn btn-error btn-outline btn-sm gap-1"
                    onClick={() => handleRespond(r.id, 'deny')}
                    disabled={acting === r.id}
                  >
                    <UserX size={14} /> Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="divider my-0" />

      {/* Sent */}
      <div>
        <h3 className="font-bold text-base mb-3">Sent</h3>
        {sent.length === 0 ? emptySection('No sent requests') : (
          <ul className="grid gap-3">
            {sent.map((r) => (
              <li key={r.id}
                className="flex items-center gap-4 p-4 bg-base-100 rounded-xl border border-base-200 shadow-sm">
                <UserAvatar user={r.receiver} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.receiver.displayName}</p>
                  <p className="text-xs text-base-content/50">@{r.receiver.username}</p>
                </div>
                <span className="badge badge-outline gap-1">
                  <Clock size={10} /> Pending
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
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
      <div className="flex justify-center items-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const tabs = [
    { label: 'My Friends', icon: <Users size={15} /> },
    { label: 'Requests',   icon: <Clock size={15} /> },
    { label: 'Add Friend', icon: <UserPlus size={15} /> },
  ];

  return (
    <div className="container mx-auto page-bg max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight mb-6">Friends</h1>

      <div role="tablist" className="tabs tabs-border mb-6">
        {tabs.map(({ label, icon }, i) => (
          <button
            key={label}
            role="tab"
            className={`tab gap-2 font-medium${tab === i ? ' tab-active' : ''}`}
            onClick={() => setTab(i)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === 0 && <FriendsTab />}
        {tab === 1 && <RequestsTab />}
        {tab === 2 && <SendRequestTab />}
      </div>
    </div>
  );
}
