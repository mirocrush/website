import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { listServerMembers } from '../../api/serversApi';

export default function MemberSidebar({ serverId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId) return;
    setLoading(true);
    listServerMembers({ serverId })
      .then((res) => setMembers(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverId]);

  const owners  = members.filter((m) => m.isOwner);
  const regular = members.filter((m) => !m.isOwner);

  const MemberRow = ({ m }) => {
    const initials = m.displayName?.slice(0, 1).toUpperCase() || '?';
    return (
      <li className="flex items-center gap-2 px-2 py-1 rounded hover:bg-base-200 transition-colors">
        {m.avatarUrl ? (
          <div className="avatar shrink-0">
            <div className="w-7 h-7 rounded-full">
              <img src={m.avatarUrl} alt={m.displayName} />
            </div>
          </div>
        ) : (
          <div className="avatar placeholder shrink-0">
            <div className="bg-neutral text-neutral-content w-7 h-7 rounded-full text-xs font-bold">
              <span>{initials}</span>
            </div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{m.displayName}</p>
          <p className="text-[10px] text-base-content/50 truncate">@{m.username}</p>
        </div>
        {m.muted && (
          <span className="badge badge-warning badge-sm text-[9px] px-1 shrink-0">muted</span>
        )}
      </li>
    );
  };

  const SectionLabel = ({ label }) => (
    <p className="px-2 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-base-content/40">
      {label}
    </p>
  );

  return (
    <div className="w-[220px] shrink-0 flex flex-col bg-base-50 border-l border-base-200 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-base-200 min-h-[52px] shrink-0">
        <Users size={14} className="text-base-content/40 shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/50">
          Members — {members.length}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center pt-6">
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
      ) : (
        <ul className="p-1.5 flex flex-col">
          {owners.length > 0 && (
            <>
              <SectionLabel label="Owner" />
              {owners.map((m) => <MemberRow key={m.userId} m={m} />)}
            </>
          )}
          {owners.length > 0 && regular.length > 0 && (
            <div className="divider my-1" />
          )}
          {regular.length > 0 && (
            <>
              <SectionLabel label="Members" />
              {regular.map((m) => <MemberRow key={m.userId} m={m} />)}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
