import { useEffect, useState } from 'react';
import { Plus, Hash, MessageCircle } from 'lucide-react';
import { useNavigate, useMatch } from 'react-router-dom';
import { useMessenger } from '../../context/MessengerContext';
import { listChannels, createChannel } from '../../api/channelsApi';
import { listConversations } from '../../api/conversationsApi';

// ── DM list ───────────────────────────────────────────────────────────────────
function DmList() {
  const [convs,   setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const { setSelectedConversationId, setSelectedServerId, setChannelName } = useMessenger();
  const navigate    = useNavigate();
  const matchDm     = useMatch('/messenger/channels/@me/:dmKey');
  const activeDmKey = matchDm?.params?.dmKey;

  useEffect(() => {
    listConversations({ limit: 50 })
      .then((res) => setConvs((res.data || []).filter((c) => c.type === 'dm')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDmClick = (c) => {
    if (c.dmKey) {
      navigate(`/messenger/channels/@me/${c.dmKey}`);
    } else {
      setSelectedServerId(null);
      setChannelName(c.title || 'Direct Message');
      setSelectedConversationId(c.conversationId?.toString());
    }
  };

  if (loading) return <span className="loading loading-spinner loading-sm m-4" />;
  if (convs.length === 0)
    return <p className="text-xs text-base-content/40 px-3 py-2">No DMs yet</p>;

  return (
    <ul className="menu menu-sm px-1 py-0 gap-0.5">
      {convs.map((c) => {
        const isActive = c.dmKey && c.dmKey === activeDmKey;
        return (
          <li key={c.conversationId}>
            <button
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 w-full text-left ${isActive ? 'bg-base-300 font-bold' : 'hover:bg-base-300/60'}`}
              onClick={() => handleDmClick(c)}
            >
              <div className="relative flex-shrink-0">
                <div className="avatar">
                  <div className="w-8 rounded-full bg-base-content/20 flex items-center justify-center overflow-hidden">
                    {c.avatarUrl
                      ? <img src={c.avatarUrl} alt={c.title} />
                      : <span className="text-xs font-bold">{c.title?.slice(0, 1).toUpperCase()}</span>
                    }
                  </div>
                </div>
                {c.unread && (
                  <span className="badge badge-error badge-xs absolute -top-0.5 -right-0.5" />
                )}
              </div>
              <span className={`text-sm truncate ${c.unread ? 'font-bold' : ''}`}>{c.title}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── Channel list ──────────────────────────────────────────────────────────────
function ChannelList({ serverId }) {
  const [channels, setChannels] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [open,     setOpen]     = useState(false);
  const [name,     setName]     = useState('');
  const [creating, setCreating] = useState(false);
  const navigate     = useNavigate();
  const matchChannel = useMatch('/messenger/channels/:channelKey');
  const activeKey    = matchChannel?.params?.channelKey;

  useEffect(() => {
    if (!serverId) return;
    setLoading(true);
    listChannels({ serverId })
      .then((res) => setChannels(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverId]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await createChannel({ serverId, name });
      if (res.success) {
        setChannels((prev) => [...prev, res.data]);
        navigate(`/messenger/channels/${res.data.channelKey}`);
      }
      setOpen(false); setName('');
    } catch { /* silent */ }
    setCreating(false);
  };

  if (loading) return <span className="loading loading-spinner loading-sm m-4" />;

  return (
    <>
      <div className="flex items-center px-3 py-2">
        <span className="flex-1 text-xs font-bold uppercase tracking-wider text-base-content/50">
          Channels
        </span>
        <div className="tooltip" data-tip="Create channel">
          <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setOpen(true)}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      <ul className="menu menu-sm px-1 py-0 gap-0.5">
        {channels.map((ch) => {
          const isActive = ch.channelKey === activeKey;
          return (
            <li key={ch.id}>
              <button
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 w-full text-left ${isActive ? 'bg-base-300 font-bold' : 'hover:bg-base-300/60'}`}
                onClick={() => navigate(`/messenger/channels/${ch.channelKey}`)}
              >
                <Hash size={15} className="text-base-content/40 flex-shrink-0" />
                <span className="text-sm truncate">{ch.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Create channel modal */}
      {open && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xs">
            <h3 className="font-bold text-lg">Create Channel</h3>
            <div className="py-3">
              <input
                className="input w-full"
                placeholder="Channel name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-sm" onClick={() => { setOpen(false); setName(''); }}>Cancel</button>
              <button
                className="btn btn-sm btn-primary"
                disabled={creating || !name.trim()}
                onClick={handleCreate}
              >
                {creating ? <><span className="loading loading-spinner loading-xs" /> Creating…</> : 'Create'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setOpen(false); setName(''); }} />
        </dialog>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChannelSidebar() {
  const { selectedServerId } = useMessenger();

  return (
    <div className="w-52 bg-base-200 flex flex-col flex-shrink-0 border-r border-base-content/10 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-base-content/10 min-h-[52px]">
        {!selectedServerId && <MessageCircle size={16} className="text-base-content/50 flex-shrink-0" />}
        <span className="text-sm font-bold truncate flex-1">
          {selectedServerId ? 'Channels' : 'Direct Messages'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {selectedServerId ? (
          <ChannelList serverId={selectedServerId} />
        ) : (
          <DmList />
        )}
      </div>
    </div>
  );
}
