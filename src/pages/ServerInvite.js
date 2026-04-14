import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getServerByInvite, joinServer } from '../api/serversApi';

export default function ServerInvite() {
  const { inviteKey } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [server,  setServer]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error,   setError]   = useState('');
  const [joined,  setJoined]  = useState(false);

  useEffect(() => {
    getServerByInvite({ inviteKey })
      .then((res) => { if (res.success) setServer(res.data); })
      .catch(() => setError('Invite link not found or expired.'))
      .finally(() => setLoading(false));
  }, [inviteKey]);

  const handleJoin = async () => {
    if (!user) { navigate(`/signin?next=/messenger/servers/invite/${inviteKey}`); return; }
    setJoining(true);
    setError('');
    try {
      const res = await joinServer({ inviteKey });
      if (res.success) {
        setJoined(true);
        const key = res.data.firstChannelKey;
        setTimeout(() => navigate(key ? `/messenger/channels/${key}` : '/messenger'), 1500);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to join server');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center" style={{ height: 'calc(100vh - 64px)' }}>
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (error && !server) {
    return (
      <div className="flex justify-center items-center" style={{ height: 'calc(100vh - 64px)' }}>
        <p className="text-error text-sm">{error}</p>
      </div>
    );
  }

  const initials = server?.name?.slice(0, 2).toUpperCase() || '';

  return (
    <div
      className="flex justify-center items-center bg-base-200"
      style={{ height: 'calc(100vh - 64px)' }}
    >
      <div className="card bg-base-100 shadow-xl w-full max-w-sm rounded-2xl">
        <div className="card-body items-center text-center">
          {/* Server avatar */}
          <div className="avatar mb-2">
            {server?.iconUrl ? (
              <div className="w-20 rounded-full">
                <img src={server.iconUrl} alt={server.name} />
              </div>
            ) : (
              <div className="w-20 rounded-full bg-primary text-primary-content flex items-center justify-center text-2xl font-bold">
                <span>{initials}</span>
              </div>
            )}
          </div>

          <h2 className="card-title text-xl font-bold">{server?.name}</h2>
          <p className="text-sm text-base-content/60">
            {server?.memberCount} member{server?.memberCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-base-content/40 mb-3">
            Created by {server?.ownerName}
          </p>

          {error && (
            <div role="alert" className="alert alert-error text-sm py-2 w-full mb-2">
              <span>{error}</span>
            </div>
          )}

          {joined ? (
            <div className="flex items-center gap-2 text-success font-semibold">
              <CheckCircle className="w-5 h-5" />
              Joined! Redirecting…
            </div>
          ) : (
            <button
              className="btn btn-primary w-full"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining
                ? <span className="loading loading-spinner loading-sm"></span>
                : null}
              {joining ? 'Joining…' : user ? 'Accept Invite & Join' : 'Sign in to Join'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
