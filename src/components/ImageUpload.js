import React, { useRef, useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, IconButton,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Close as ClearIcon,
} from '@mui/icons-material';
import { uploadFile } from '../api/blogApi';

// Lightweight single-image upload widget.
// Props:
//   value    — current image URL string (or '')
//   onChange — called with the new URL string after upload, or '' on clear
//   label    — optional label text (default 'Image')
//   size     — thumbnail size in px (default 96)
export default function ImageUpload({ value, onChange, label = 'Image', size = 96 }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const res = await uploadFile(file);
      if (res.success) {
        onChange(res.data.url);
      } else {
        setError(res.message || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  };

  return (
    <Box>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
          {label}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Thumbnail / drop zone */}
        <Box
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !loading && inputRef.current?.click()}
          sx={{
            width: size,
            height: size,
            borderRadius: 1.5,
            border: '2px dashed',
            borderColor: value ? 'transparent' : 'divider',
            bgcolor: value ? 'transparent' : 'action.hover',
            cursor: loading ? 'default' : 'pointer',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'border-color 0.15s, background-color 0.15s',
            '&:hover': {
              borderColor: loading ? 'divider' : 'primary.main',
              bgcolor: value ? 'transparent' : 'action.selected',
            },
          }}
        >
          {loading ? (
            <CircularProgress size={24} />
          ) : value ? (
            <Box
              component="img"
              src={value}
              alt="preview"
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <UploadIcon sx={{ color: 'text.disabled', fontSize: 28 }} />
          )}
        </Box>

        {/* Actions */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              {value ? 'Change' : 'Upload'}
            </Button>
            {value && (
              <IconButton size="small" onClick={() => onChange('')} title="Remove image">
                <ClearIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
            JPG, PNG, GIF, WEBP · max 10 MB
          </Typography>
          {error && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.25 }}>
              {error}
            </Typography>
          )}
        </Box>
      </Box>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </Box>
  );
}
