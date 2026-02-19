import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  AttachFile as FileIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import UserChip from './UserChip';

const MERGE_WINDOW_MS = 5 * 60 * 1000;

function AttachmentPreview({ attachment }) {
  const isImage = attachment.mimeType?.startsWith('image/');
  if (isImage) {
    return (
      <Box
        component="img"
        src={attachment.url}
        alt={attachment.name}
        sx={{ maxWidth: 320, maxHeight: 240, borderRadius: 1, mt: 0.5, display: 'block', cursor: 'pointer' }}
        onClick={() => window.open(attachment.url, '_blank')}
      />
    );
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1, maxWidth: 280 }}>
      <FileIcon fontSize="small" />
      <Typography
        variant="caption"
        component="a" href={attachment.url} target="_blank" rel="noopener noreferrer"
        sx={{ textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {attachment.name}
      </Typography>
    </Box>
  );
}

function MessageRow({ msg, isGrouped, onEdit, onDelete }) {
  const { user: me } = useAuth();
  const isOwn     = me && msg.sender && me.username === msg.sender.username;
  const isDeleted = msg.kind === 'deleted';
  const time = new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Box
      sx={{
        display: 'flex', px: 2, py: isGrouped ? 0.1 : 0.75,
        '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
        '&:hover .msg-actions': { opacity: 1 },
        position: 'relative',
      }}
    >
      {/* Avatar spacer */}
      <Box sx={{ width: 40, mr: 1.5, flexShrink: 0, pt: isGrouped ? 0 : 0.5 }}>
        {!isGrouped && msg.sender && (
          <UserChip user={{ ...msg.sender, id: msg.sender.id || msg.sender._id }} size="lg" avatarOnly />
        )}
        {isGrouped && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, lineHeight: '18px', pl: 0.5 }}>
            {time}
          </Typography>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {!isGrouped && (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.2 }}>
            <UserChip user={{ ...msg.sender, id: msg.sender?.id || msg.sender?._id }} nameOnly />
            <Typography variant="caption" color="text.disabled">{time}</Typography>
            {msg.editedAt && <Typography variant="caption" color="text.disabled">(edited)</Typography>}
          </Box>
        )}

        {isDeleted ? (
          <Typography variant="body2" color="text.disabled" fontStyle="italic">
            This message was deleted.
          </Typography>
        ) : (
          <>
            {msg.content && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {msg.content}
              </Typography>
            )}
            {msg.attachments?.map((att, i) => (
              <AttachmentPreview key={i} attachment={att} />
            ))}
          </>
        )}
      </Box>

      {/* Hover actions */}
      {!isDeleted && isOwn && (
        <Box className="msg-actions" sx={{ opacity: 0, transition: 'opacity 0.1s', display: 'flex', gap: 0.5, alignItems: 'flex-start', pt: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEdit(msg)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => onDelete(msg._id || msg.id)}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}

export default function MessageList({ messages, onEdit, onDelete }) {
  if (!messages.length) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.disabled">No messages yet. Say hello!</Typography>
      </Box>
    );
  }

  // messages[] is newest-first; reverse so oldest renders at top, newest at bottom
  const ordered = [...messages].reverse();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', py: 1, mt: 'auto' }}>
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
    </Box>
  );
}
