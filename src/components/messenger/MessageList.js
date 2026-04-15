import { Pencil, Trash2, Paperclip } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import UserChip from './UserChip';

const MERGE_WINDOW_MS = 5 * 60 * 1000;

function AttachmentPreview({ attachment }) {
  const isImage = attachment.mimeType?.startsWith('image/');
  if (isImage) {
    return (
      <img
        src={attachment.url}
        alt={attachment.name}
        className="max-w-xs max-h-48 rounded mt-1 block cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => window.open(attachment.url, '_blank')}
      />
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 mt-1 px-2 py-1 bg-base-200 rounded text-xs hover:bg-base-300 transition-colors max-w-[240px]"
    >
      <Paperclip size={12} className="shrink-0" />
      <span className="truncate underline">{attachment.name}</span>
    </a>
  );
}

function MessageRow({ msg, isGrouped, onEdit, onDelete }) {
  const { user: me } = useAuth();
  const isOwn     = me && msg.sender && me.username === msg.sender.username;
  const isDeleted = msg.kind === 'deleted';
  const time = new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`group flex items-start gap-3 px-4 hover:bg-base-200/40 transition-colors relative ${isGrouped ? 'py-0.5' : 'py-2'}`}
    >
      {/* Avatar column */}
      <div className="w-9 shrink-0 flex justify-center">
        {!isGrouped && msg.sender ? (
          <UserChip user={{ ...msg.sender, id: msg.sender.id || msg.sender._id }} size="lg" avatarOnly />
        ) : (
          <span className="text-[10px] text-base-content/30 pt-0.5 leading-none opacity-0 group-hover:opacity-100 transition-opacity select-none">
            {time}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <UserChip user={{ ...msg.sender, id: msg.sender?.id || msg.sender?._id }} nameOnly />
            <span className="text-[11px] text-base-content/40">{time}</span>
            {msg.editedAt && <span className="text-[11px] text-base-content/30">(edited)</span>}
          </div>
        )}

        {isDeleted ? (
          <p className="text-sm text-base-content/40 italic">This message was deleted.</p>
        ) : (
          <>
            {msg.content && (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed text-base-content">
                {msg.content}
              </p>
            )}
            {msg.attachments?.map((att, i) => (
              <AttachmentPreview key={i} attachment={att} />
            ))}
          </>
        )}
      </div>

      {/* Hover actions */}
      {!isDeleted && isOwn && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <div className="tooltip tooltip-top" data-tip="Edit">
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => onEdit(msg)}
            >
              <Pencil size={13} />
            </button>
          </div>
          <div className="tooltip tooltip-top" data-tip="Delete">
            <button
              className="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/10"
              onClick={() => onDelete(msg._id || msg.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessageList({ messages, onEdit, onDelete }) {
  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-base-content/40">No messages yet. Say hello!</p>
      </div>
    );
  }

  const ordered = [...messages].reverse();

  return (
    <div className="flex flex-col py-2 mt-auto">
      {ordered.map((msg, i) => {
        const prev = ordered[i - 1];
        const isGrouped = prev &&
          prev.sender?.username === msg.sender?.username &&
          new Date(msg.createdAt) - new Date(prev.createdAt) < MERGE_WINDOW_MS;

        return (
          <MessageRow
            key={msg.id || msg._id}
            msg={msg}
            isGrouped={isGrouped}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}
