import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, UserPlus, UserCheck, Clock, UserCog } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getFriendStatus, sendRequest, respondToRequest } from '../../api/friendsApi';
import { upsertDm } from '../../api/dmsApi';

function ProfilePopup({ user, onClose, anchorRef }) {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const popupRef = useRef(null);

  const [friendStatus,   setFriendStatus]   = useState(null);
  const [requestId,      setRequestId]      = useState(null);
  const [actionLoading,  setActionLoading]  = useState(false);

  const isMe = me && (me.id === user.id || me._id === user.id || me.username === user.username);

  useEffect(() => {
    if (isMe) return;
    getFriendStatus({ otherUserId: user.id })
      .then((res) => {
        setFriendStatus(res.data.status);
        setRequestId(res.data.requestId || null);
      })
      .catch(() => setFriendStatus('none'));
  }, [user.id, isMe]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target) &&
          anchorRef.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  const handleSendDm = async () => {
    try {
      const res = await upsertDm({ otherUserId: user.id });
      if (res.success) {
        navigate(`/messenger/channels/@me/${res.data.dmKey}`);
        onClose();
      }
    } catch { /* silent */ }
  };

  const handleFriendAction = async () => {
    setActionLoading(true);
    try {
      if (friendStatus === 'none') {
        await sendRequest({ query: user.username });
        setFriendStatus('pending_sent');
      } else if (friendStatus === 'pending_received' && requestId) {
        await respondToRequest({ requestId, action: 'accept' });
        setFriendStatus('friends');
      }
    } catch { /* silent */ }
    setActionLoading(false);
  };

  const initials = user.displayName?.slice(0, 1).toUpperCase() || '?';

  const FriendButton = () => {
    if (isMe) return null;
    if (friendStatus === null) return (
      <button className="btn btn-outline btn-sm w-full" disabled>
        <span className="loading loading-spinner loading-xs" />
      </button>
    );
    if (friendStatus === 'friends') return (
      <button className="btn btn-success btn-sm w-full gap-2" disabled>
        <UserCheck size={14} /> Friends
      </button>
    );
    if (friendStatus === 'pending_sent') return (
      <button className="btn btn-ghost btn-sm w-full gap-2" disabled>
        <Clock size={14} /> Request Sent
      </button>
    );
    if (friendStatus === 'pending_received') return (
      <button className="btn btn-primary btn-sm w-full gap-2" onClick={handleFriendAction} disabled={actionLoading}>
        {actionLoading ? <span className="loading loading-spinner loading-xs" /> : <UserPlus size={14} />}
        Accept Request
      </button>
    );
    return (
      <button className="btn btn-outline btn-sm w-full gap-2" onClick={handleFriendAction} disabled={actionLoading}>
        {actionLoading ? <span className="loading loading-spinner loading-xs" /> : <UserPlus size={14} />}
        Add Friend
      </button>
    );
  };

  return (
    <div
      ref={popupRef}
      className="absolute z-50 w-64 bg-base-100 rounded-2xl shadow-2xl border border-base-200 overflow-hidden"
      style={{ top: '100%', left: 0, marginTop: 4 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Banner */}
      <div className="h-14 bg-gradient-to-br from-primary via-secondary to-accent" />

      <div className="px-4 pb-4">
        {/* Avatar overlapping banner */}
        <div className="mt-[-32px] mb-2">
          {user.avatarUrl ? (
            <div className="avatar">
              <div className="w-16 h-16 rounded-xl ring-3 ring-base-100 overflow-hidden shadow">
                <img src={user.avatarUrl} alt={user.displayName} />
              </div>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-content text-2xl font-bold flex items-center justify-center ring-3 ring-base-100 shadow select-none">
              {initials}
            </div>
          )}
        </div>

        <p className="font-bold text-base leading-tight">{user.displayName}</p>
        <p className="text-xs text-base-content/50 mb-3">@{user.username}</p>

        <div className="divider my-2" />

        <div className="flex flex-col gap-2">
          {isMe ? (
            <button
              className="btn btn-outline btn-sm w-full gap-2"
              onClick={() => { navigate('/profile'); onClose(); }}
            >
              <UserCog size={14} /> Edit Profile
            </button>
          ) : (
            <>
              <button className="btn btn-primary btn-sm w-full gap-2" onClick={handleSendDm}>
                <MessageCircle size={14} /> Send Message
              </button>
              <FriendButton />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UserChip({ user, size = 'sm', avatarOnly = false, nameOnly = false }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  if (!user) return null;

  const initials    = user.displayName?.slice(0, 1).toUpperCase() || '?';
  const avatarDim   = size === 'lg' ? 'w-9 h-9' : 'w-6 h-6';
  const avatarText  = size === 'lg' ? 'text-sm' : 'text-[10px]';

  const Avatar = () => (
    user.avatarUrl ? (
      <div className={`avatar shrink-0`}>
        <div className={`${avatarDim} rounded-full overflow-hidden`}>
          <img src={user.avatarUrl} alt={user.displayName} />
        </div>
      </div>
    ) : (
      <div className={`${avatarDim} rounded-full bg-gradient-to-br from-primary to-secondary text-primary-content ${avatarText} font-bold flex items-center justify-center shrink-0 select-none`}>
        {initials}
      </div>
    )
  );

  return (
    <span
      ref={anchorRef}
      className="relative inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
    >
      {!nameOnly && <Avatar />}
      {!avatarOnly && (
        <span className="text-sm font-bold leading-none">{user.displayName}</span>
      )}

      {open && (
        <ProfilePopup
          user={user}
          onClose={() => setOpen(false)}
          anchorRef={anchorRef}
        />
      )}
    </span>
  );
}
