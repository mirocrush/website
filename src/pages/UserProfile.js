import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserPlus, UserCheck, Clock, ArrowLeft, CalendarDays } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../api/usersApi';
import { sendRequest, listFriends, listRequests } from '../api/friendsApi';

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
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-4 text-center px-4">
        <div className="p-5 bg-base-200 rounded-full">
          <UserPlus size={32} className="text-base-content/20" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-base-content/70">User not found</h2>
          <p className="text-sm text-base-content/40 mt-1">@{username} doesn't exist.</p>
        </div>
        <button className="btn btn-ghost btn-sm gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    );
  }

  const initials = profile.displayName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const joined   = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const RelationButton = () => {
    if (relation === 'self') return null;
    if (!me) return (
      <button className="btn btn-outline btn-sm gap-2" onClick={() => navigate('/signin')}>
        <UserPlus size={14} /> Sign in to add friend
      </button>
    );
    if (relation === 'friends') return (
      <span className="inline-flex items-center gap-2 badge badge-success px-4 py-3 text-sm font-semibold">
        <UserCheck size={14} /> Friends
      </span>
    );
    if (relation === 'pending_sent') return (
      <span className="inline-flex items-center gap-2 badge badge-ghost px-4 py-3 text-sm">
        <Clock size={14} /> Request Sent
      </span>
    );
    if (relation === 'pending_received') return (
      <button
        className="btn btn-outline btn-sm gap-2"
        onClick={() => navigate('/friends')}
      >
        <Clock size={14} /> Respond to Request
      </button>
    );
    return (
      <button
        className="btn btn-primary btn-sm gap-2"
        onClick={handleAddFriend}
        disabled={sending}
      >
        {sending
          ? <span className="loading loading-spinner loading-xs" />
          : <UserPlus size={14} />
        }
        Add Friend
      </button>
    );
  };

  return (
    <div className="min-h-screen page-bg">
      {/* Cover gradient */}
      <div className="h-48 bg-gradient-to-br from-primary via-secondary to-accent relative overflow-hidden">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
      </div>

      {/* Profile card */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 relative pb-12">

        {/* Avatar overlapping cover */}
        <div className="absolute -top-16 left-4 sm:left-8">
          {profile.avatarUrl ? (
            <div className="avatar">
              <div className="w-32 h-32 rounded-2xl ring-4 ring-base-200 shadow-xl overflow-hidden">
                <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
              </div>
            </div>
          ) : (
            <div className="w-32 h-32 rounded-2xl ring-4 ring-base-200 shadow-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-content text-4xl font-extrabold select-none">
              {initials}
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="flex justify-end pt-4 pb-2 min-h-[56px]">
          <RelationButton />
        </div>

        {relMsg && (
          <div role="alert" className="alert alert-error text-sm py-2 mb-4">
            <span>{relMsg}</span>
          </div>
        )}

        {/* Name + meta */}
        <div className="mt-12 sm:mt-10">
          <h1 className="text-3xl font-extrabold tracking-tight">{profile.displayName}</h1>
          <p className="text-base text-base-content/60 mt-0.5">@{profile.username}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-base-content/40">
            <CalendarDays size={12} />
            Member since {joined}
          </div>
        </div>

        <div className="divider mt-8 mb-0" />

        {/* Content area */}
        <div className="py-12 text-center">
          <div className="p-4 bg-base-200 rounded-full inline-flex mb-3">
            <UserPlus size={24} className="text-base-content/20" />
          </div>
          <p className="text-sm text-base-content/40">More profile content coming soon.</p>
        </div>
      </div>
    </div>
  );
}
