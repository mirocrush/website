import { useEffect, useState } from 'react';
import { useNavigate, useMatch } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessengerProvider, useMessenger } from '../context/MessengerContext';
import ServerSidebar   from '../components/messenger/ServerSidebar';
import ChannelSidebar  from '../components/messenger/ChannelSidebar';
import ChatView        from '../components/messenger/ChatView';
import MemberSidebar   from '../components/messenger/MemberSidebar';
import ServerDiscovery from '../components/messenger/ServerDiscovery';
import { getChannelByKey } from '../api/channelsApi';
import { getConversationByDmKey } from '../api/conversationsApi';

function MessengerShell() {
  const matchChannel = useMatch('/messenger/channels/:channelKey');
  const matchDm      = useMatch('/messenger/channels/@me/:dmKey');
  const channelKey   = matchChannel?.params?.channelKey;
  const dmKey        = matchDm?.params?.dmKey;
  const {
    selectedServerId,       setSelectedServerId,
    selectedConversationId, setSelectedConversationId,
    showMembers, setShowMembers,
    setChannelName,
  } = useMessenger();

  const [resolving, setResolving] = useState(!!(channelKey || dmKey));

  // Resolve server channel URL
  useEffect(() => {
    if (!channelKey) return;
    setResolving(true);
    getChannelByKey({ channelKey })
      .then((res) => {
        if (res.success) {
          setSelectedServerId(res.data.serverId.toString());
          setSelectedConversationId(res.data.conversationId.toString());
          setChannelName(res.data.channelName);
        }
      })
      .catch(() => {})
      .finally(() => setResolving(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey]);

  // Resolve DM URL
  useEffect(() => {
    if (!dmKey) return;
    setResolving(true);
    getConversationByDmKey({ dmKey })
      .then((res) => {
        if (res.success) {
          setSelectedServerId(null);
          setSelectedConversationId(res.data.conversationId.toString());
          setChannelName(res.data.title);
        }
      })
      .catch(() => {})
      .finally(() => setResolving(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmKey]);

  if (resolving) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 64px)' }}>
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const showDiscovery = !channelKey && !dmKey && !selectedConversationId;
  const showChat      = !!selectedConversationId;

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
      <ServerSidebar />
      <ChannelSidebar />

      {showDiscovery ? (
        <ServerDiscovery />
      ) : showChat ? (
        <>
          <ChatView onToggleMembers={() => setShowMembers((v) => !v)} showMembers={showMembers} />
          {showMembers && selectedServerId && <MemberSidebar serverId={selectedServerId} />}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-base-content/50">Conversation not found or you don't have access.</p>
        </div>
      )}
    </div>
  );
}

export default function Messenger() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;

  if (!user) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4"
        style={{ height: 'calc(100vh - 64px)' }}
      >
        <p className="text-lg text-base-content/60">Sign in to use Messenger</p>
        <button className="btn btn-primary" onClick={() => navigate('/signin')}>Sign in</button>
      </div>
    );
  }

  return (
    <MessengerProvider>
      <MessengerShell />
    </MessengerProvider>
  );
}
