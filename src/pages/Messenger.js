import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessengerProvider } from '../context/MessengerContext';
import ServerSidebar  from '../components/messenger/ServerSidebar';
import ChannelSidebar from '../components/messenger/ChannelSidebar';
import ChatView       from '../components/messenger/ChatView';

function MessengerShell() {
  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <ServerSidebar />
      <ChannelSidebar />
      <ChatView />
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
