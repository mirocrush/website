import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { Users, Hash, MessageCircle, X, Check } from 'lucide-react';
import { listMessages, editMessage, deleteMessage } from '../../api/messagesApi';
import { markRead } from '../../api/conversationsApi';
import { useMessenger } from '../../context/MessengerContext';
import MessageList from './MessageList';
import ComposeBox  from './ComposeBox';

export default function ChatView({ onToggleMembers, showMembers }) {
  const { selectedConversationId, pusher, channelName, selectedServerId } = useMessenger();

  const [messages,    setMessages]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [nextCursor,  setNextCursor]  = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving,  setEditSaving]  = useState(false);

  const convId = selectedConversationId;

  const scrollRef             = useRef(null);
  const loadMoreRef           = useRef(null);
  const channelRef            = useRef(null);
  const shouldScrollBottomRef = useRef(false);
  const isAppendingOlderRef   = useRef(false);
  const prevScrollHeightRef   = useRef(0);

  // ── Fetch initial messages ──────────────────────────────────────────────
  const fetchMessages = useCallback(async (cId) => {
    setLoading(true);
    setMessages([]);
    setNextCursor(null);
    shouldScrollBottomRef.current = true;
    try {
      const res = await listMessages({ conversationId: cId, limit: 50 });
      setMessages(res.data);
      setNextCursor(res.nextCursor);
      if (res.data.length > 0) {
        markRead({ conversationId: cId, lastReadMessageId: res.data[0].id }).catch(() => {});
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!convId) { setMessages([]); return; }
    fetchMessages(convId);
  }, [convId, fetchMessages]);

  // ── Scroll management ──────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (shouldScrollBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      shouldScrollBottomRef.current = false;
    } else if (isAppendingOlderRef.current) {
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
      isAppendingOlderRef.current = false;
    }
  }, [messages]);

  // ── Pusher subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!convId || !pusher?.current) return;
    const pusherChannel = `private-conv-${convId}`;
    const channel = pusher.current.subscribe(pusherChannel);
    channelRef.current = channel;

    channel.bind('message:new', (msg) => {
      const el = scrollRef.current;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
        shouldScrollBottomRef.current = true;
      }
      setMessages((prev) => [msg, ...prev]);
      markRead({ conversationId: convId, lastReadMessageId: msg.id }).catch(() => {});
    });
    channel.bind('message:edited', ({ messageId, content, editedAt }) => {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content, editedAt } : m));
    });
    channel.bind('message:deleted', ({ messageId, deletedAt }) => {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, kind: 'deleted', content: '', deletedAt } : m));
    });

    return () => {
      channel.unbind_all();
      pusher.current?.unsubscribe(pusherChannel);
      channelRef.current = null;
    };
  }, [convId, pusher]);

  // ── Infinite scroll ────────────────────────────────────────────────────
  useEffect(() => {
    if (!loadMoreRef.current || !nextCursor) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore || !nextCursor) return;
      prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? 0;
      isAppendingOlderRef.current = true;
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

  // ── Edit / Delete ──────────────────────────────────────────────────────
  const handleEditOpen = (msg) => { setEditTarget(msg); setEditContent(msg.content); };
  const handleEditSave = async () => {
    if (!editTarget || !editContent.trim()) return;
    setEditSaving(true);
    try {
      await editMessage({ messageId: editTarget.id, content: editContent.trim() });
      setEditTarget(null);
    } catch { /* silent */ }
    setEditSaving(false);
  };
  const handleDelete = async (messageId) => {
    try { await deleteMessage({ messageId }); } catch { /* silent */ }
  };

  if (!convId) return null;

  const isDm = !selectedServerId;
  const displayName = channelName || (isDm ? 'Direct Message' : '');
  const HeaderIcon  = isDm ? MessageCircle : Hash;

  return (
    <div className="flex-1 flex flex-col bg-base-100 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-base-200 min-h-[52px] shrink-0 bg-base-100">
        <HeaderIcon size={18} className="text-base-content/40 shrink-0" />
        <span className="font-bold text-base truncate flex-1">{displayName}</span>
        {selectedServerId && (
          <div className="tooltip tooltip-bottom" data-tip={showMembers ? 'Hide Members' : 'Show Members'}>
            <button
              className={`btn btn-ghost btn-sm btn-circle ${showMembers ? 'text-primary bg-primary/10' : 'text-base-content/50'}`}
              onClick={onToggleMembers}
            >
              <Users size={18} />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto flex flex-col"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.15) transparent' }}
        >
          <div ref={loadMoreRef} className="h-px shrink-0" />

          {loadingMore && (
            <div className="flex justify-center py-2 shrink-0">
              <span className="loading loading-spinner loading-xs text-primary" />
            </div>
          )}

          <MessageList
            messages={messages}
            onEdit={handleEditOpen}
            onDelete={handleDelete}
          />
        </div>
      )}

      <ComposeBox conversationId={convId} />

      {/* Edit dialog */}
      {editTarget && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-base mb-3">Edit Message</h3>
            <textarea
              className="textarea textarea-bordered w-full min-h-[80px] resize-none"
              autoFocus
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                if (e.key === 'Escape') setEditTarget(null);
              }}
            />
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(null)} disabled={editSaving}>
                <X size={14} /> Cancel
              </button>
              <button
                className="btn btn-primary btn-sm gap-1"
                onClick={handleEditSave}
                disabled={editSaving || !editContent.trim()}
              >
                {editSaving ? <span className="loading loading-spinner loading-xs" /> : <Check size={14} />}
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !editSaving && setEditTarget(null)} />
        </dialog>
      )}
    </div>
  );
}
