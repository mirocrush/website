import { useEffect, useState, useCallback } from 'react';
import { Search, Compass, Users, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { discoverServers, joinServer } from '../../api/serversApi';

function ServerCard({ server, onJoined }) {
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await joinServer({ inviteKey: server.inviteKey });
      if (res.success) {
        const key = res.data.firstChannelKey;
        navigate(key ? `/messenger/channels/${key}` : '/messenger');
        onJoined?.();
      }
    } catch { /* silent */ }
    setJoining(false);
  };

  const handleViewInvite = () => {
    window.open(`/messenger/servers/invite/${server.inviteKey}`, '_blank');
  };

  const initials = server.name.slice(0, 2).toUpperCase();

  return (
    <div className="bg-base-100 border border-base-200 rounded-2xl shadow-sm hover:shadow-md hover:border-base-300 transition-all duration-150 flex flex-col overflow-hidden">
      {/* Color bar */}
      <div className="h-1 bg-gradient-to-r from-primary/60 via-secondary/60 to-accent/60" />

      <div className="p-4 flex-1">
        <div className="flex items-center gap-3 mb-3">
          {server.iconUrl ? (
            <div className="avatar shrink-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden">
                <img src={server.iconUrl} alt={server.name} />
              </div>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-content text-lg font-extrabold flex items-center justify-center shrink-0 select-none shadow-sm">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{server.name}</p>
            <div className="flex items-center gap-1 text-xs text-base-content/50">
              <Users size={11} />
              {server.memberCount} member{server.memberCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 flex gap-2">
        <button
          className="btn btn-primary btn-sm flex-1 gap-1"
          onClick={handleJoin}
          disabled={joining}
        >
          {joining ? <span className="loading loading-spinner loading-xs" /> : null}
          {joining ? 'Joining…' : 'Join'}
        </button>
        <button
          className="btn btn-ghost btn-sm btn-circle"
          onClick={handleViewInvite}
          title="View invite link"
        >
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ServerDiscovery() {
  const [servers,  setServers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [sort,     setSort]     = useState('members');
  const [page,     setPage]     = useState(1);
  const [pages,    setPages]    = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discoverServers({ page, limit: 12, search: debouncedSearch, sort });
      if (res.success) {
        setServers(res.data);
        setPages(res.pages || 1);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [page, debouncedSearch, sort]);

  useEffect(() => { fetchServers(); }, [fetchServers]);
  useEffect(() => { setPage(1); }, [debouncedSearch, sort]);

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Compass size={20} className="text-primary" />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight">Discover Servers</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
          <input
            className="input input-bordered input-sm w-full pl-9"
            placeholder="Search servers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select select-bordered select-sm min-w-[140px]"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="members">Most Members</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center pt-12">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="p-4 bg-base-200 rounded-full">
            <Compass size={28} className="text-base-content/20" />
          </div>
          <p className="text-base-content/50 text-sm">No public servers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {servers.map((s) => (
            <ServerCard key={s.id} server={s} onJoined={fetchServers} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center">
          <div className="join shadow-sm">
            <button className="join-item btn btn-sm" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="join-item btn btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, pages - 4));
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
            <button className="join-item btn btn-sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>›</button>
            <button className="join-item btn btn-sm" onClick={() => setPage(pages)} disabled={page === pages}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}
