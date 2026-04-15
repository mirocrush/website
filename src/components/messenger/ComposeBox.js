import { useState, useRef } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import axios from 'axios';
import { sendMessage } from '../../api/messagesApi';

export default function ComposeBox({ conversationId }) {
  const [content,     setContent]     = useState('');
  const [sending,     setSending]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileRef = useRef(null);

  const handleSend = async () => {
    if ((!content.trim() && !attachments.length) || sending) return;
    setSending(true);
    try {
      await sendMessage({ conversationId, content: content.trim(), attachments });
      setContent('');
      setAttachments([]);
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

  const removeAttachment = (i) => setAttachments((p) => p.filter((_, j) => j !== i));

  return (
    <div className="px-3 py-2.5 border-t border-base-200 bg-base-100 shrink-0">
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {attachments.map((a, i) => (
            <div key={i} className="relative group">
              {a.mimeType?.startsWith('image/') ? (
                <div className="relative">
                  <img src={a.url} alt={a.name} className="h-14 w-14 rounded object-cover" />
                  <button
                    className="absolute -top-1.5 -right-1.5 btn btn-circle btn-xs btn-error opacity-0 group-hover:opacity-100"
                    onClick={() => removeAttachment(i)}
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-base-200 rounded text-xs max-w-[140px]">
                  <Paperclip size={11} className="shrink-0" />
                  <span className="truncate">{a.name}</span>
                  <button
                    className="btn btn-ghost btn-xs btn-circle h-4 min-h-0 w-4 shrink-0"
                    onClick={() => removeAttachment(i)}
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />

        <div className="tooltip tooltip-top" data-tip="Attach file">
          <button
            className="btn btn-ghost btn-sm btn-circle shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading
              ? <span className="loading loading-spinner loading-xs" />
              : <Paperclip size={16} />}
          </button>
        </div>

        <textarea
          className="textarea textarea-bordered flex-1 resize-none text-sm leading-relaxed min-h-[40px] max-h-32 py-2"
          placeholder="Message…"
          rows={1}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKey}
          style={{ scrollbarWidth: 'thin' }}
        />

        <button
          className="btn btn-primary btn-sm btn-circle shrink-0"
          onClick={handleSend}
          disabled={sending || (!content.trim() && !attachments.length)}
        >
          {sending
            ? <span className="loading loading-spinner loading-xs" />
            : <Send size={15} />}
        </button>
      </div>
    </div>
  );
}
