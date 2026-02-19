import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
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
  // channelKey → server channel URL  (/messenger/channels/:channelKey)
  // dmKey      → DM URL              (/messenger/channels/@me/:dmKey)
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

  // Start in resolving state immediately when any URL key is present to avoid
  // a flash of the ServerDiscovery panel before the API call completes.
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
          setSelectedServerId(null);           // DMs have no server
          setSelectedConversationId(res.data.conversationId.toString());
          setChannelName(res.data.title);      // partner's display name
        }
      })
      .catch(() => {})
      .finally(() => setResolving(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmKey]);

  if (resolving) {
    return (
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show the discovery panel ONLY on the base /messenger route with nothing selected
  const showDiscovery = !channelKey && !dmKey && !selectedConversationId;
  const showChat      = !!selectedConversationId;

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', bgcolor: 'background.default' }}>
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
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">Conversation not found or you don't have access.</Typography>
        </Box>
      )}
    </Box>
  );
}

export default function Messenger() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;

  if (!user) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)', gap: 2 }}>
        <Typography variant="h6" color="text.secondary">Sign in to use Messenger</Typography>
        <Button variant="contained" onClick={() => navigate('/signin')}>Sign in</Button>
      </Box>
    );
  }

  return (
    <MessengerProvider>
      <MessengerShell />
    </MessengerProvider>
  );
}
