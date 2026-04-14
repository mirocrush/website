import { useEffect, useRef, useState } from 'react';
import {
  Plus, Settings, Link, LogOut, Trash2, MessageCircle, Compass,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listServers, createServer, leaveServer, deleteServer, listChannels } from '../../api/serversApi';
import { listConversations } from '../../api/conversationsApi';
import { useMessenger } from '../../context/MessengerContext';
import ServerSettings from './ServerSettings';

// ── Server icon button ────────────────────────────────────────────────────────
function ServerIcon({ server, selected, onClick, onContextMenu }) {
  const initials = server.name.slice(0, 2).toUpperCase();
  return (
    <div className="tooltip tooltip-right" data-tip={server.name}>
      <div
        className="avatar cursor-pointer"
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <div
          className={`w-12 transition-all duration-150 overflow-hidden flex items-center justify-center
            ${selected ? 'rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-base-300' : 'rounded-full hover:rounded-xl'}
            ${selected ? 'bg-primary' : 'bg-base-content/20 hover:bg-primary/80'}
          `}
        >
          {server.iconUrl ? (
            <img src={server.iconUrl} alt={server.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-white select-none">{initials}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ServerSidebar() {
  const navigate = useNavigate();
  const {
    selectedServerId, setSelectedServerId,
    setSelectedConversationId,
  } = useMessenger();

  const [servers,      setServers]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [creating,     setCreating]     = useState(false);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [name,         setName]         = useState('');
  const [err,          setErr]          = useState('');
  const [ctxMenu,      setCtxMenu]      = useState(null); // { x, y }
  const [ctxServer,    setCtxServer]    = useState(null);
  const [leaveOpen,    setLeaveOpen]    = useState(false);
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const ctxRef = useRef(null);

  const fetchServers = () =>
    listServers()
      .then((res) => setServers(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { fetchServers(); }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxMenu]);

  const handleDmIconClick = async () => {
    setSelectedServerId(null);
    setSelectedConversationId(null);
    try {
      const res = await listConversations({ limit: 50 });
      const first = (res.data || []).find((c) => c.type === 'dm');
      if (first?.dmKey) { navigate(`/messenger/channels/@me/${first.dmKey}`); return; }
    } catch { /* silent */ }
    navigate('/messenger');
  };

  const handleServerClick = async (s) => {
    setSelectedServerId(s.id.toString());
    setSelectedConversationId(null);
    try {
      const res = await listChannels({ serverId: s.id.toString() });
      const first = (res.data || [])[0];
      if (first?.channelKey) navigate(`/messenger/channels/${first.channelKey}`);
    } catch { /* silent */ }
  };

  const handleContextMenu = (e, s) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
    setCtxServer(s);
  };

  const closeCtx = () => setCtxMenu(null);

  const handleCopyInvite = () => {
    if (!ctxServer?.inviteKey) return;
    const url = `${window.location.origin}/messenger/servers/invite/${ctxServer.inviteKey}`;
    navigator.clipboard.writeText(url).catch(() => {});
    closeCtx();
  };

  const handleLeave = async () => {
    if (!ctxServer) return;
    try { await leaveServer({ serverId: ctxServer.id.toString() }); } catch { /* silent */ }
    setLeaveOpen(false);
    setServers((prev) => prev.filter((s) => s.id.toString() !== ctxServer.id.toString()));
    if (selectedServerId === ctxServer.id.toString()) {
      setSelectedServerId(null);
      setSelectedConversationId(null);
      navigate('/messenger');
    }
    setCtxServer(null);
  };

  const handleDelete = async () => {
    if (!ctxServer) return;
    setDeleting(true);
    try {
      await deleteServer({ serverId: ctxServer.id.toString() });
    } catch { /* silent */ }
    setDeleting(false);
    setDeleteOpen(false);
    setServers((prev) => prev.filter((s) => s.id.toString() !== ctxServer.id.toString()));
    if (selectedServerId === ctxServer.id.toString()) {
      setSelectedServerId(null);
      setSelectedConversationId(null);
      navigate('/messenger');
    }
    setCtxServer(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true); setErr('');
    try {
      const res = await createServer({ name });
      const newS = { id: res.data.serverId, name: res.data.name, inviteKey: res.data.inviteKey, isOwner: true };
      setServers((prev) => [...prev, newS]);
      setCreateOpen(false); setName('');
      if (res.data.firstChannelKey) navigate(`/messenger/channels/${res.data.firstChannelKey}`);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create server');
    } finally {
      setCreating(false);
    }
  };

  const handleServerUpdated = (updated) => {
    setServers((prev) => prev.map((s) =>
      s.id.toString() === updated.id.toString() ? { ...s, ...updated } : s
    ));
  };

  return (
    <>
      <div className="w-16 bg-base-300 flex flex-col items-center py-2 gap-1 overflow-y-auto flex-shrink-0 border-r border-base-content/10">

        {/* DMs button */}
        <div className="tooltip tooltip-right" data-tip="Direct Messages">
          <div
            className={`w-12 h-12 flex items-center justify-center cursor-pointer transition-all duration-150 overflow-hidden
              ${selectedServerId === null
                ? 'rounded-xl bg-primary ring-2 ring-primary ring-offset-2 ring-offset-base-300'
                : 'rounded-full bg-base-content/20 hover:rounded-xl hover:bg-primary/80'}
            `}
            onClick={handleDmIconClick}
          >
            <MessageCircle size={22} className="text-white" />
          </div>
        </div>

        <div className="divider my-0 w-8 mx-auto" />

        {loading ? (
          <span className="loading loading-spinner loading-sm mt-1" />
        ) : (
          servers.map((s) => (
            <ServerIcon
              key={s.id}
              server={s}
              selected={selectedServerId === s.id?.toString()}
              onClick={() => handleServerClick(s)}
              onContextMenu={(e) => handleContextMenu(e, s)}
            />
          ))
        )}

        <div className="divider my-0 w-8 mx-auto" />

        {/* Discover servers */}
        <div className="tooltip tooltip-right" data-tip="Discover Servers">
          <button
            className="btn btn-circle btn-sm bg-base-content/15 hover:bg-info hover:text-white border-none"
            onClick={() => { setSelectedServerId(null); setSelectedConversationId(null); navigate('/messenger'); }}
          >
            <Compass size={18} />
          </button>
        </div>

        {/* Create server */}
        <div className="tooltip tooltip-right" data-tip="Create Server">
          <button
            className="btn btn-circle btn-sm bg-base-content/15 hover:bg-success hover:text-white border-none text-success"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <ul
          ref={ctxRef}
          className="menu bg-base-200 rounded-box shadow-xl z-50 fixed min-w-44 p-1"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <li>
            <button onClick={() => { setSettingsOpen(true); closeCtx(); }}>
              <Settings size={15} /> Server Settings
            </button>
          </li>
          <li>
            <button onClick={handleCopyInvite}>
              <Link size={15} /> Copy Invite Link
            </button>
          </li>
          {ctxServer && !ctxServer.isOwner && (
            <>
              <li className="divider my-0" />
              <li>
                <button
                  className="text-error"
                  onClick={() => { setLeaveOpen(true); closeCtx(); }}
                >
                  <LogOut size={15} /> Leave Server
                </button>
              </li>
            </>
          )}
          {ctxServer && ctxServer.isOwner && (
            <>
              <li className="divider my-0" />
              <li>
                <button
                  className="text-error"
                  onClick={() => { setDeleteOpen(true); closeCtx(); }}
                >
                  <Trash2 size={15} /> Delete Server
                </button>
              </li>
            </>
          )}
        </ul>
      )}

      {/* Leave confirm modal */}
      {leaveOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xs">
            <h3 className="font-bold text-lg">Leave Server</h3>
            <p className="py-3">
              Are you sure you want to leave <strong>{ctxServer?.name}</strong>?
            </p>
            <div className="modal-action">
              <button className="btn btn-sm" onClick={() => setLeaveOpen(false)}>Cancel</button>
              <button className="btn btn-sm btn-error" onClick={handleLeave}>Leave</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setLeaveOpen(false)} />
        </dialog>
      )}

      {/* Delete server confirm modal */}
      {deleteOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xs">
            <h3 className="font-bold text-lg text-error flex items-center gap-2">
              <Trash2 size={18} /> Delete Server
            </h3>
            <p className="py-2">
              Are you sure you want to permanently delete <strong>{ctxServer?.name}</strong>?
            </p>
            <p className="text-sm text-base-content/60 pb-2">
              This will remove all channels, messages, and members. This action cannot be undone.
            </p>
            <div className="modal-action">
              <button className="btn btn-sm" disabled={deleting} onClick={() => setDeleteOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-sm btn-error" disabled={deleting} onClick={handleDelete}>
                {deleting
                  ? <><span className="loading loading-spinner loading-xs" /> Deleting…</>
                  : <><Trash2 size={14} /> Delete Server</>
                }
              </button>
            </div>
          </div>
          {!deleting && <div className="modal-backdrop" onClick={() => setDeleteOpen(false)} />}
        </dialog>
      )}

      {/* Create server modal */}
      {createOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xs">
            <h3 className="font-bold text-lg">Create a Server</h3>
            {err && <div className="alert alert-error py-2 text-sm mt-2">{err}</div>}
            <div className="py-3">
              <input
                className="input input-bordered w-full"
                placeholder="Server name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-sm" onClick={() => { setCreateOpen(false); setName(''); setErr(''); }}>
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={creating || !name.trim()}
                onClick={handleCreate}
              >
                {creating ? <><span className="loading loading-spinner loading-xs" /> Creating…</> : 'Create'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setCreateOpen(false); setName(''); setErr(''); }} />
        </dialog>
      )}

      {/* Server settings */}
      {settingsOpen && ctxServer && (
        <ServerSettings
          server={ctxServer}
          onClose={() => setSettingsOpen(false)}
          onUpdated={handleServerUpdated}
        />
      )}
    </>
  );
}
