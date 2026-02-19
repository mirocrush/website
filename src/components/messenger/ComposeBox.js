import React, { useState, useRef } from 'react';
import { Box, TextField, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Send as SendIcon, AttachFile as AttachIcon } from '@mui/icons-material';
import axios from 'axios';
import { sendMessage } from '../../api/messagesApi';

export default function ComposeBox({ conversationId, onSent }) {
  const [content,     setContent]     = useState('');
  const [sending,     setSending]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileRef = useRef(null);

  const handleSend = async () => {
    if ((!content.trim() && !attachments.length) || sending) return;
    setSending(true);
    try {
      const res = await sendMessage({ conversationId, content: content.trim(), attachments });
      setContent('');
      setAttachments([]);
      onSent?.(res.data);
    } catch { /* silent */ }
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post('/api/messages/upload', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachments((prev) => [...prev, res.data.data]);
    } catch { /* silent */ }
    setUploading(false);
    e.target.value = '';
  };

  return (
    <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          {attachments.map((a, i) => (
            <Box key={i} sx={{ position: 'relative' }}>
              {a.mimeType?.startsWith('image/') ? (
                <Box component="img" src={a.url} alt={a.name}
                  sx={{ height: 60, borderRadius: 1, objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                />
              ) : (
                <Box sx={{ px: 1.5, py: 0.5, bgcolor: 'action.selected', borderRadius: 1, fontSize: 12, cursor: 'pointer' }}
                  onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>
                  {a.name}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
        <Tooltip title="Attach file">
          <IconButton onClick={() => fileRef.current?.click()} disabled={uploading} size="small" sx={{ mb: 0.5 }}>
            {uploading ? <CircularProgress size={18} /> : <AttachIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <TextField
          fullWidth multiline maxRows={6}
          placeholder="Message…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKey}
          size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />

        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={sending || (!content.trim() && !attachments.length)}
          sx={{ mb: 0.5 }}
        >
          {sending ? <CircularProgress size={20} /> : <SendIcon />}
        </IconButton>
      </Box>
    </Box>
  );
}
