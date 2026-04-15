import { useState, useEffect, useCallback } from 'react';
import { CheckCheck, Check, ExternalLink, Bell, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listNotifications, markAllRead, markRead } from '../api/notificationsApi';

const PAGE_SIZE = 20;

const TYPE_LABELS = {
  prep_started:     'Prep Started',
  prep_initialized: 'Prep Initialized',
  prep_failed:      'Prep Failed',
  interact_started: 'Interact Started',
  interact_done:    'Interact Done',
  transfer_sent:    'Transfer Sent',
};

const TYPE_BADGE = {
  prep_started:     'badge-info',
  prep_initialized: 'badge-success',
  prep_failed:      'badge-error',
  interact_started: 'badge-primary',
  interact_done:    'badge-secondary',
  transfer_sent:    'badge-warning',
};

function notifDestination(notif) {
  if (notif.issueId) {
    return { path: '/github-issues', state: { openIssueId: notif.issueId?._id || notif.issueId } };
  }
  return { path: '/github-issues', state: {} };
}

export default function Notifications() {
  const navigate = useNavigate();

  const [notifs, setNotifs]         = useState([]);
  const [total, setTotal]           = useState(0);
  const [unreadCount, setUnread]    = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState('all');
  const [markingId, setMarkingId]   = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const unreadOnly = filter === 'unread' ? true : undefined;
      const res = await listNotifications({ page, limit: PAGE_SIZE, unreadOnly });
      let data = res.data || [];
      if (filter === 'read') data = data.filter((n) => n.read);
      setNotifs(data);
      setTotal(filter === 'read' ? data.length : (res.total || data.length));
      setUnread(res.unreadCount || 0);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter]);

  const handleMarkRead = useCallback(async (notif) => {
    if (notif.read) return;
    setMarkingId(notif._id || notif.id);
    try {
      await markRead([notif._id || notif.id]);
      setNotifs((prev) => prev.map((n) =>
        (n._id || n.id) === (notif._id || notif.id) ? { ...n, read: true } : n
      ));
      setUnread((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
    finally { setMarkingId(null); }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch { /* ignore */ }
    finally { setMarkingAll(false); }
  }, []);

  const handleClickRow = useCallback(async (notif) => {
    if (!notif.read) {
      markRead([notif._id || notif.id]).catch(() => {});
      setNotifs((prev) => prev.map((n) =>
        (n._id || n.id) === (notif._id || notif.id) ? { ...n, read: true } : n
      ));
      setUnread((c) => Math.max(0, c - 1));
    }
    const { path, state } = notifDestination(notif);
    navigate(path, { state });
  }, [navigate]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Bell size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
            {unreadCount > 0
              ? <p className="text-sm text-base-content/50">{unreadCount} unread</p>
              : <p className="text-sm text-base-content/40">All caught up</p>
            }
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="select select-sm min-w-[120px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
          {unreadCount > 0 && (
            <button
              className="btn btn-outline btn-sm gap-2"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll
                ? <span className="loading loading-spinner loading-xs" />
                : <CheckCheck size={14} />}
              Mark all read
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error text-sm mb-6">
          <span>{error}</span>
        </div>
      )}

      {/* List */}
      <div className="border border-base-300 rounded-2xl overflow-hidden shadow-sm bg-base-100">

        {loading && (
          <div className="flex justify-center items-center py-16">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {!loading && notifs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="p-5 bg-base-200 rounded-full">
              <Inbox size={32} className="text-base-content/20" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-base-content/60">No notifications</p>
              <p className="text-sm text-base-content/40 mt-1">
                {filter === 'unread' ? 'All caught up!' : 'Nothing here yet.'}
              </p>
            </div>
          </div>
        )}

        {!loading && notifs.map((n, idx) => {
          const id = n._id || n.id;
          const isUnread = !n.read;
          return (
            <div
              key={id}
              className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-base-200/50 transition-colors group${idx > 0 ? ' border-t border-base-200' : ''}${isUnread ? ' bg-primary/3' : ''}`}
              onClick={() => handleClickRow(n)}
            >
              {/* Unread dot */}
              <div className="mt-1 shrink-0 w-2.5">
                {isUnread && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 grid gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm${isUnread ? ' font-bold' : ' font-medium'} truncate`}>
                    {n.title || '—'}
                  </span>
                  <span className={`badge badge-outline badge-sm shrink-0 ${TYPE_BADGE[n.type] || ''}`}>
                    {TYPE_LABELS[n.type] || n.type || 'Unknown'}
                  </span>
                </div>
                {n.message && (
                  <p className="text-xs text-base-content/50 truncate">{n.message}</p>
                )}
                <p className="text-xs text-base-content/30">
                  {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}>
                {isUnread && (
                  <div className="tooltip tooltip-left" data-tip="Mark as read">
                    <button
                      className="btn btn-ghost btn-xs btn-circle"
                      disabled={markingId === id}
                      onClick={() => handleMarkRead(n)}
                    >
                      {markingId === id
                        ? <span className="loading loading-spinner loading-xs" />
                        : <Check size={13} />}
                    </button>
                  </div>
                )}
                <div className="tooltip tooltip-left" data-tip="Go to page">
                  <button
                    className="btn btn-ghost btn-xs btn-circle"
                    onClick={() => handleClickRow(n)}
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex justify-center mt-6">
          <div className="join shadow-sm">
            <button className="join-item btn btn-sm" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="join-item btn btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, pageCount - 4));
              const p = start + i;
              return (
                <button
                  key={p}
                  className={`join-item btn btn-sm${p === page ? ' btn-active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button className="join-item btn btn-sm" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}>›</button>
            <button className="join-item btn btn-sm" onClick={() => setPage(pageCount)} disabled={page === pageCount}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}
