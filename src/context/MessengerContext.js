import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import { useAuth } from './AuthContext';

const MessengerContext = createContext(null);

export function MessengerProvider({ children }) {
  const { user } = useAuth();

  const [selectedServerId,       setSelectedServerId]       = useState(null); // null = DMs view
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const pusherRef = useRef(null);

  // Initialise Pusher once user is logged in
  useEffect(() => {
    if (!user) {
      if (pusherRef.current) { pusherRef.current.disconnect(); pusherRef.current = null; }
      return;
    }
    if (pusherRef.current) return; // already connected

    pusherRef.current = new Pusher(process.env.REACT_APP_PUSHER_KEY || '', {
      cluster:          process.env.REACT_APP_PUSHER_CLUSTER || 'us2',
      authEndpoint:     '/api/pusher/auth',
      auth:             { withCredentials: true },
    });

    return () => {
      pusherRef.current?.disconnect();
      pusherRef.current = null;
    };
  }, [user]);

  const value = {
    selectedServerId,       setSelectedServerId,
    selectedConversationId, setSelectedConversationId,
    pusher: pusherRef,      // ref so components always get the current instance
  };

  return <MessengerContext.Provider value={value}>{children}</MessengerContext.Provider>;
}

export const useMessenger = () => useContext(MessengerContext);
