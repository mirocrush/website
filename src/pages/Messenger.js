import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessengerProvider, useMessenger } from '../context/MessengerContext';
import ServerSidebar   from '../components/messenger/ServerSidebar';
import ChannelSidebar  from '../components/messenger/ChannelSidebar';
import ChatView        from '../components/messenger/ChatView';
import MemberSidebar   from '../components/messenger/MemberSidebar';
import ServerDiscovery from '../components/messenger/ServerDiscovery';
import { getChannelByKey } from '../api/channelsApi';

function MessengerShell() {
  const { channelKey } = useParams();
  const {
    selectedServerId,       setSelectedServerId,
    selectedConversationId, setSelectedConversationId,
    showMembers, setShowMembers,
    setChannelName,
  } = useMessenger();
  const [resolving, setResolving] = useState(false);

  // When URL has a channelKey, resolve it to serverId + conversationId
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

  if (resolving) {
    return (
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const showChat = !!selectedConversationId;

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', bgcolor: 'background.default' }}>
      <ServerSidebar />
      <ChannelSidebar />

      {showChat ? (
        <>
          <ChatView onToggleMembers={() => setShowMembers((v) => !v)} showMembers={showMembers} />
          {showMembers && selectedServerId && <MemberSidebar serverId={selectedServerId} />}
        </>
      ) : (
        <ServerDiscovery />
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
