import React, { useRef, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { uploadFile, deleteFile } from '../api/blogApi';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// type: 'images' | 'pdfs'
// value: array of { bucket, path, url, mimeType, size }
// onChange: (updatedArray) => void
export default function FileUpload({ type, value = [], onChange }) {
  const inputRef = useRef(null);
  const [uploading,  setUploading]  = useState(false);
  const [removing,   setRemoving]   = useState({}); // { [index]: true } while deleting
  const [uploadErr,  setUploadErr]  = useState('');
  const [removeErr,  setRemoveErr]  = useState('');

  const isImages = type === 'images';
  const accept   = isImages ? 'image/jpeg,image/png,image/gif,image/webp' : 'application/pdf';
  const label    = isImages ? 'Images' : 'PDFs';

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadErr('');

    const results = [];
    for (const file of Array.from(files)) {
      try {
        const res = await uploadFile(file);
        if (res.success) results.push(res.data);
        else setUploadErr(`Failed to upload "${file.name}": ${res.message}`);
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        setUploadErr(`Failed to upload "${file.name}": ${msg}`);
      }
    }

    if (results.length > 0) onChange([...value, ...results]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  // ── Remove (delete from Supabase, then remove from state) ──────────────────

  const handleRemove = async (index) => {
    const file = value[index];
    setRemoving((prev) => ({ ...prev, [index]: true }));
    setRemoveErr('');

    try {
      await deleteFile({ bucket: file.bucket, path: file.path });
      onChange(value.filter((_, i) => i !== index));
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setRemoveErr(`Failed to remove file: ${msg}`);
    } finally {
      setRemoving((prev) => ({ ...prev, [index]: false }));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        {label}
      </Typography>

      {/* Drop zone */}
      <Paper
        variant="outlined"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        sx={{
          p: 3,
          textAlign: 'center',
          borderStyle: 'dashed',
          borderColor: 'primary.light',
          bgcolor: 'action.hover',
          cursor: uploading ? 'default' : 'pointer',
          '&:hover': { bgcolor: uploading ? 'action.hover' : 'action.selected' },
          transition: 'background-color 0.2s',
        }}
      >
        {uploading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={28} />
            <Typography variant="caption" color="text.secondary">Uploading…</Typography>
          </Box>
        ) : (
          <>
            <UploadIcon color="primary" sx={{ fontSize: 36, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Drag & drop or <strong>click to select</strong> {label.toLowerCase()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isImages ? 'JPG, PNG, GIF, WEBP' : 'PDF'} · max 10 MB each
            </Typography>
          </>
        )}
      </Paper>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {uploadErr && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setUploadErr('')}>
          {uploadErr}
        </Alert>
      )}
      {removeErr && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setRemoveErr('')}>
          {removeErr}
        </Alert>
      )}

      {/* File list */}
      {value.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {isImages ? (
            // ── Image grid with size tooltip ──
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {value.map((file, i) => (
                <Tooltip
                  key={file.path}
                  title={`${file.path.split('/').pop()} · ${formatBytes(file.size)}`}
                  placement="top"
                >
                  <Box sx={{ position: 'relative', width: 100, height: 100 }}>
                    <Box
                      component="img"
                      src={file.url}
                      alt={`upload-${i}`}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        opacity: removing[i] ? 0.4 : 1,
                        transition: 'opacity 0.2s',
                      }}
                    />
                    {/* Size badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: '#fff',
                        fontSize: 9,
                        textAlign: 'center',
                        py: '1px',
                        borderRadius: '0 0 4px 4px',
                      }}
                    >
                      {formatBytes(file.size)}
                    </Box>
                    {/* Remove button */}
                    <IconButton
                      size="small"
                      disabled={removing[i]}
                      onClick={() => handleRemove(i)}
                      sx={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        bgcolor: 'rgba(0,0,0,0.55)',
                        color: '#fff',
                        p: '2px',
                        '&:hover': { bgcolor: 'error.main' },
                        '&.Mui-disabled': { bgcolor: 'rgba(0,0,0,0.3)' },
                      }}
                    >
                      {removing[i]
                        ? <CircularProgress size={12} sx={{ color: '#fff' }} />
                        : <DeleteIcon fontSize="small" />
                      }
                    </IconButton>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          ) : (
            // ── PDF list with size ──
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {value.map((file, i) => (
                <Box
                  key={file.path}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    opacity: removing[i] ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <PdfIcon color="error" />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {file.path.split('/').pop()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(file.size)}
                    </Typography>
                  </Box>
                  <Tooltip title={removing[i] ? 'Removing…' : 'Remove & delete from storage'}>
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={removing[i]}
                        onClick={() => handleRemove(i)}
                      >
                        {removing[i]
                          ? <CircularProgress size={16} color="error" />
                          : <DeleteIcon fontSize="small" />
                        }
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
