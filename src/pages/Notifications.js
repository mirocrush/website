import { useState, useEffect, useCallback } from 'react';
import { CheckCheck, Check, Circle, ExternalLink } from 'lucide-react';
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

const TYPE_BADGE_CLASS = {
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
  const [filter, setFilter]         = useState('all'); // 'all' | 'unread' | 'read'
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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-base-content/60">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="select select-bordered select-sm min-w-[120px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
          {unreadCount > 0 && (
            <button
              className="btn btn-outline btn-sm gap-1"
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
        <div role="alert" className="alert alert-error text-sm mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr className="bg-base-200">
              <th style={{ width: 10 }} />
              <th>Title</th>
              <th>Message</th>
              <th>Type</th>
              <th>Date</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8">
                  <span className="loading loading-spinner loading-md" />
                </td>
              </tr>
            ) : notifs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-base-content/50">
                  No notifications
                </td>
              </tr>
            ) : notifs.map((n) => {
              const id = n._id || n.id;
              const isUnread = !n.read;
              return (
                <tr
                  key={id}
                  className={`hover cursor-pointer${isUnread ? ' bg-base-200/60' : ''}`}
                  onClick={() => handleClickRow(n)}
                >
                  {/* Unread dot */}
                  <td className="px-2 py-0">
                    {isUnread && (
                      <Circle size={8} className="text-primary fill-primary mx-auto block" />
                    )}
                  </td>

                  {/* Title */}
                  <td>
                    <span className={`text-sm max-w-[200px] truncate block${isUnread ? ' font-bold' : ''}`}>
                      {n.title || '—'}
                    </span>
                  </td>

                  {/* Message */}
                  <td>
                    <span className="text-sm text-base-content/60 max-w-[320px] truncate block">
                      {n.message || '—'}
                    </span>
                  </td>

                  {/* Type badge */}
                  <td>
                    <span className={`badge badge-outline badge-sm ${TYPE_BADGE_CLASS[n.type] || ''}`}>
                      {TYPE_LABELS[n.type] || n.type || '—'}
                    </span>
                  </td>

                  {/* Date */}
                  <td>
                    <span className="text-xs text-base-content/60 whitespace-nowrap">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-center">
                      {isUnread && (
                        <div className="tooltip" data-tip="Mark as read">
                          <button
                            className="btn btn-ghost btn-xs"
                            disabled={markingId === id}
                            onClick={() => handleMarkRead(n)}
                          >
                            {markingId === id
                              ? <span className="loading loading-spinner loading-xs" />
                              : <Check size={14} />}
                          </button>
                        </div>
                      )}
                      <div className="tooltip" data-tip="Go to page">
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleClickRow(n)}
                        >
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex justify-center mt-4">
          <div className="join">
            <button
              className="join-item btn btn-xs"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >«</button>
            <button
              className="join-item btn btn-xs"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >‹</button>
            {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, pageCount - 4));
              const p = start + i;
              return (
                <button
                  key={p}
                  className={`join-item btn btn-xs${p === page ? ' btn-active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="join-item btn btn-xs"
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
            >›</button>
            <button
              className="join-item btn btn-xs"
              onClick={() => setPage(pageCount)}
              disabled={page === pageCount}
            >»</button>
          </div>
        </div>
      )}
    </div>
  );
}
