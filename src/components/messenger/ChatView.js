import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, TextField, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { listMessages, editMessage, deleteMessage } from '../../api/messagesApi';
import { markRead } from '../../api/conversationsApi';
import { useMessenger } from '../../context/MessengerContext';
import MessageList from './MessageList';
import ComposeBox  from './ComposeBox';

export default function ChatView() {
  const { selectedConversationId, pusher } = useMessenger();

  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Edit dialog
  const [editTarget, setEditTarget] = useState(null); // { id, content }
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const convId     = selectedConversationId;
  const loadMoreRef = useRef(null);
  const bottomRef   = useRef(null);
  const channelRef  = useRef(null);

  // ── Fetch initial messages ──────────────────────────────────────────────
  const fetchMessages = useCallback(async (cId) => {
    setLoading(true);
    setMessages([]);
    setNextCursor(null);
    try {
      const res = await listMessages({ conversationId: cId, limit: 50 });
      setMessages(res.data);
      setNextCursor(res.nextCursor);
      if (res.data.length > 0) {
        const latest = res.data[0]; // newest first
        markRead({ conversationId: cId, lastReadMessageId: latest.id }).catch(() => {});
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!convId) { setMessages([]); return; }
    fetchMessages(convId);
  }, [convId, fetchMessages]);

  // ── Scroll to bottom on new messages ───────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Pusher subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!convId || !pusher?.current) return;

    const channelName = `private-conv-${convId}`;
    const channel     = pusher.current.subscribe(channelName);
    channelRef.current = channel;

    channel.bind('message:new', (msg) => {
      setMessages((prev) => [msg, ...prev]);
      markRead({ conversationId: convId, lastReadMessageId: msg.id }).catch(() => {});
    });

    channel.bind('message:edited', ({ messageId, content, editedAt }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content, editedAt } : m))
      );
    });

    channel.bind('message:deleted', ({ messageId, deletedAt }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, kind: 'deleted', content: '', deletedAt } : m))
      );
    });

    return () => {
      channel.unbind_all();
      pusher.current?.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [convId, pusher]);

  // ── Infinite scroll — load older messages ─────────────────────────────
  useEffect(() => {
    if (!loadMoreRef.current || !nextCursor) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore || !nextCursor) return;
      setLoadingMore(true);
      try {
        const res = await listMessages({ conversationId: convId, limit: 50, cursor: nextCursor });
        setMessages((prev) => [...prev, ...res.data]);
        setNextCursor(res.nextCursor);
      } catch { /* silent */ }
      setLoadingMore(false);
    }, { threshold: 0.1 });

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, convId]);

  // ── Edit / Delete handlers ─────────────────────────────────────────────
  const handleEditOpen = (msg) => {
    setEditTarget(msg);
    setEditContent(msg.content);
  };

  const handleEditSave = async () => {
    if (!editTarget || !editContent.trim()) return;
    setEditSaving(true);
    try {
      await editMessage({ messageId: editTarget.id, content: editContent.trim() });
      // Pusher will update the list via message:edited event
      setEditTarget(null);
    } catch { /* silent */ }
    setEditSaving(false);
  };

  const handleDelete = async (messageId) => {
    try {
      await deleteMessage({ messageId });
      // Pusher will update via message:deleted event
    } catch { /* silent */ }
  };

  // ── New message from ComposeBox ────────────────────────────────────────
  const handleSent = (msg) => {
    setMessages((prev) => [msg, ...prev]);
  };

  // ── Empty state ────────────────────────────────────────────────────────
  if (!convId) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <Typography color="text.disabled">Select a channel or DM to start chatting</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', minWidth: 0 }}>
      {loading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {loadingMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <CircularProgress size={20} />
            </Box>
          )}

          <MessageList
            messages={messages}
            onEdit={handleEditOpen}
            onDelete={handleDelete}
            loadMoreRef={loadMoreRef}
          />

          <Box ref={bottomRef} />
        </>
      )}

      <ComposeBox conversationId={convId} onSent={handleSent} />

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Message</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth multiline rows={3} autoFocus
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={editSaving || !editContent.trim()}>
            {editSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
