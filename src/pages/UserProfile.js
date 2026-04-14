import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserPlus, UserCheck, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../api/usersApi';
import { sendRequest, listFriends, listRequests } from '../api/friendsApi';

// Deterministic avatar color from username
function avatarColor(username) {
  const colors = ['#1976d2','#388e3c','#d32f2f','#7b1fa2','#f57c00','#0288d1','#c2185b','#00796b'];
  let hash = 0;
  for (const c of (username || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function UserProfile() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const navigate     = useNavigate();

  const [profile,  setProfile]  = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading,  setLoading]  = useState(true);

  // Relationship state: 'none' | 'self' | 'friends' | 'pending_sent' | 'pending_received'
  const [relation, setRelation] = useState('none');
  const [sending,  setSending]  = useState(false);
  const [relMsg,   setRelMsg]   = useState('');

  useEffect(() => {
    getUserProfile(username)
      .then((res) => setProfile(res.data))
      .catch((err) => { if (err.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [username]);

  // Determine relationship once profile + auth loaded
  useEffect(() => {
    if (!profile || !me) return;
    if (me.username === profile.username) { setRelation('self'); return; }

    Promise.all([listFriends(), listRequests('sent'), listRequests('received')])
      .then(([f, s, r]) => {
        if (f.data.some((x) => x.username === profile.username)) {
          setRelation('friends');
        } else if (s.data.some((x) => x.receiver.username === profile.username)) {
          setRelation('pending_sent');
        } else if (r.data.some((x) => x.sender.username === profile.username)) {
          setRelation('pending_received');
        } else {
          setRelation('none');
        }
      })
      .catch(() => {});
  }, [profile, me]);

  const handleAddFriend = async () => {
    setSending(true);
    setRelMsg('');
    try {
      await sendRequest({ query: profile.username });
      setRelation('pending_sent');
    } catch (err) {
      setRelMsg(err.response?.data?.message || 'Could not send request');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-2">
        <h2 className="text-xl font-bold text-base-content/60">User not found</h2>
        <p className="text-sm text-base-content/40">@{username} doesn't exist.</p>
        <button className="btn btn-ghost mt-4" onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  const initials = profile.displayName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const joined   = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const bgColor  = avatarColor(profile.username);

  const RelationButton = () => {
    if (relation === 'self') return null;
    if (!me) return (
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/signin')}>
        Sign in to add friend
      </button>
    );
    if (relation === 'friends') return (
      <span className="badge badge-success gap-1 px-3 py-3 text-sm">
        <UserCheck size={14} /> Friends
      </span>
    );
    if (relation === 'pending_sent') return (
      <span className="badge badge-ghost gap-1 px-3 py-3 text-sm">
        <Clock size={14} /> Request Sent
      </span>
    );
    if (relation === 'pending_received') return (
      <span className="badge badge-ghost gap-1 px-3 py-3 text-sm">
        <Clock size={14} /> Respond in Friends
      </span>
    );
    return (
      <button
        className="btn btn-primary btn-sm"
        onClick={handleAddFriend}
        disabled={sending}
      >
        {sending
          ? <span className="loading loading-spinner loading-xs" />
          : <UserPlus size={15} />
        }
        Add Friend
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Cover */}
      <div className="h-44 bg-primary" />

      {/* Profile card */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 relative">
        {/* Avatar */}
        <div
          className="absolute -top-14 left-4 sm:left-8 w-28 h-28 rounded-full border-4 border-base-100 flex items-center justify-center text-white text-3xl font-bold overflow-hidden"
          style={{ backgroundColor: bgColor }}
        >
          {profile.avatarUrl
            ? <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
            : initials
          }
        </div>

        {/* Action row */}
        <div className="flex justify-end pt-4 pb-2 min-h-[52px]">
          <RelationButton />
        </div>

        {relMsg && <p className="text-error text-sm mb-2">{relMsg}</p>}

        {/* Name + username */}
        <div className="mt-2">
          <h1 className="text-3xl font-extrabold">{profile.displayName}</h1>
          <p className="text-base text-base-content/60">@{profile.username}</p>
          <p className="text-xs text-base-content/40 mt-1">Member since {joined}</p>
        </div>

        <div className="divider my-6" />

        {/* Placeholder */}
        <p className="text-sm text-base-content/40 text-center py-8">
          More profile content coming soon.
        </p>
      </div>
    </div>
  );
}
