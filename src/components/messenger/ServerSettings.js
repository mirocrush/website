import { useEffect, useState, useRef } from 'react';
import { Camera, MoreVertical, X, Check, AlertCircle, CheckCircle } from 'lucide-react';
import { updateServer, listServerMembers, kickMember, banMember, muteMember } from '../../api/serversApi';

// ── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ server, onUpdated }) {
  const [name,      setName]      = useState(server.name || '');
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [iconUrl,   setIconUrl]   = useState(server.iconUrl || null);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const fileRef = useRef(null);

  const handleSaveName = async () => {
    if (!name.trim() || name.trim() === server.name) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const fd = new FormData();
      fd.append('serverId', server.id.toString());
      fd.append('name', name.trim());
      const res = await updateServer(fd);
      if (res.success) { setSuccess('Server name updated.'); onUpdated(res.data); }
    } catch (e) { setError(e.response?.data?.message || 'Failed to update'); }
    setSaving(false);
  };

  const handleIconChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      const fd = new FormData();
      fd.append('serverId', server.id.toString());
      fd.append('icon', file);
      const res = await updateServer(fd);
      if (res.success) { setIconUrl(res.data.iconUrl); setSuccess('Icon updated.'); onUpdated(res.data); }
    } catch (e) { setError(e.response?.data?.message || 'Failed to upload icon'); }
    setUploading(false);
    e.target.value = '';
  };

  const initials = (server.name || '').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-md flex flex-col gap-5">
      {error   && <div role="alert" className="alert alert-error text-sm py-2"><AlertCircle size={16} /><span>{error}</span></div>}
      {success && <div role="alert" className="alert alert-success text-sm py-2"><CheckCircle size={16} /><span>{success}</span></div>}

      {/* Icon */}
      <div>
        <h3 className="font-bold text-sm mb-3">Server Icon</h3>
        <div className="flex items-center gap-4">
          {iconUrl ? (
            <div className="avatar shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow">
                <img src={iconUrl} alt={server.name} />
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-content text-2xl font-extrabold flex items-center justify-center shrink-0 shadow select-none">
              {initials}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleIconChange} />
          <label
            className="btn btn-outline btn-sm gap-2 cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <span className="loading loading-spinner loading-xs" /> : <Camera size={14} />}
            {uploading ? 'Uploading…' : 'Change Icon'}
          </label>
        </div>
      </div>

      {/* Name */}
      <div>
        <h3 className="font-bold text-sm mb-2">Server Name</h3>
        <div className="flex gap-2">
          <input
            className="input input-bordered flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
          />
          <button
            className="btn btn-primary gap-1"
            onClick={handleSaveName}
            disabled={saving || !name.trim() || name.trim() === server.name}
          >
            {saving ? <span className="loading loading-spinner loading-sm" /> : <Check size={15} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────
function MembersTab({ server }) {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [menuOpen, setMenuOpen] = useState(null); // userId with open menu
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    listServerMembers({ serverId: server.id.toString() })
      .then((res) => setMembers(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [server.id]);

  const closeMenu = () => { setMenuOpen(null); setSelected(null); };

  const handleKick = async () => {
    closeMenu();
    if (!selected) return;
    try {
      await kickMember({ serverId: server.id.toString(), userId: selected.userId.toString() });
      setMembers((prev) => prev.filter((m) => m.userId.toString() !== selected.userId.toString()));
    } catch { /* silent */ }
  };

  const handleBan = async () => {
    closeMenu();
    if (!selected) return;
    try {
      await banMember({ serverId: server.id.toString(), userId: selected.userId.toString() });
      setMembers((prev) => prev.filter((m) => m.userId.toString() !== selected.userId.toString()));
    } catch { /* silent */ }
  };

  const handleMute = async () => {
    closeMenu();
    if (!selected) return;
    const newMuted = !selected.muted;
    try {
      await muteMember({ serverId: server.id.toString(), userId: selected.userId.toString(), muted: newMuted });
      setMembers((prev) => prev.map((m) =>
        m.userId.toString() === selected.userId.toString() ? { ...m, muted: newMuted } : m
      ));
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="flex justify-center pt-8">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Member</th>
            <th>Username</th>
            <th>Joined</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="hover">
              <td>
                <div className="flex items-center gap-2">
                  {m.avatarUrl ? (
                    <div className="avatar shrink-0">
                      <div className="w-7 h-7 rounded-full overflow-hidden">
                        <img src={m.avatarUrl} alt={m.displayName} />
                      </div>
                    </div>
                  ) : (
                    <div className="avatar placeholder shrink-0">
                      <div className="bg-neutral text-neutral-content w-7 h-7 rounded-full text-xs font-bold">
                        <span>{m.displayName?.slice(0, 1)}</span>
                      </div>
                    </div>
                  )}
                  <span className="text-sm font-medium">{m.displayName}</span>
                  {m.isOwner && <span className="badge badge-primary badge-sm">Owner</span>}
                </div>
              </td>
              <td><span className="text-xs text-base-content/60">@{m.username}</span></td>
              <td>
                <span className="text-xs text-base-content/50">
                  {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
                </span>
              </td>
              <td>
                {m.muted && <span className="badge badge-warning badge-sm">Muted</span>}
              </td>
              <td className="text-right">
                {!m.isOwner && (
                  <div className="relative inline-block">
                    <button
                      className="btn btn-ghost btn-xs btn-circle"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (menuOpen === m.userId) { closeMenu(); }
                        else { setMenuOpen(m.userId); setSelected(m); }
                      }}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuOpen === m.userId && (
                      <ul className="menu dropdown-content bg-base-100 rounded-box shadow z-50 w-32 absolute right-0 top-full mt-1 border border-base-200">
                        <li>
                          <button className="text-sm" onClick={handleMute}>
                            {m.muted ? 'Unmute' : 'Mute'}
                          </button>
                        </li>
                        <li>
                          <button className="text-sm text-warning" onClick={handleKick}>Kick</button>
                        </li>
                        <li>
                          <button className="text-sm text-error" onClick={handleBan}>Ban</button>
                        </li>
                      </ul>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Settings Modal ───────────────────────────────────────────────────────
export default function ServerSettings({ server, onClose, onUpdated }) {
  const [tab, setTab] = useState(0);

  const tabs = ['Overview', 'Members'];

  return (
    <div className="fixed inset-0 z-50 flex bg-base-200">
      {/* Left sidebar nav */}
      <div className="w-52 shrink-0 border-r border-base-300 bg-base-100 flex flex-col pt-4">
        <div className="px-4 mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/50 truncate">
            {server.name}
          </p>
          <p className="text-xs text-base-content/40">Settings</p>
        </div>
        <ul className="menu menu-sm flex-1">
          {tabs.map((label, i) => (
            <li key={label}>
              <button
                className={`${tab === i ? 'active' : ''}`}
                onClick={() => setTab(i)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-100 shrink-0">
          <h2 className="text-lg font-extrabold">{tabs[tab]}</h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin' }}>
          {tab === 0 && <OverviewTab server={server} onUpdated={onUpdated} />}
          {tab === 1 && <MembersTab server={server} />}
        </div>
      </div>
    </div>
  );
}
