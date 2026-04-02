import React, { useState } from 'react';
import {
  TextField, Button, Box, Chip, Stack,
  Typography, InputAdornment, Divider,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import FileUpload from './FileUpload';

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'blockquote', 'code-block', 'link',
];

export default function BlogForm({ initialValues = {}, onSubmit, loading, isEditing }) {
  const [title,    setTitle]    = useState(initialValues.title   || '');
  const [content,  setContent]  = useState(initialValues.content || '');
  const [tagInput, setTagInput] = useState('');
  const [tags,     setTags]     = useState(initialValues.tags    || []);
  const [images,   setImages]   = useState(initialValues.images  || []);
  const [errors,   setErrors]   = useState({});

  const isEmpty = (html) => !html || html.replace(/<[^>]*>/g, '').trim() === '';

  const validate = () => {
    const e = {};
    if (!title.trim())  e.title   = 'Title is required';
    if (isEmpty(content)) e.content = 'Description is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput('');
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ title: title.trim(), content, tags, images });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={3}>
        <TextField
          label="Issue Title"
          placeholder="Short, descriptive summary of the problem"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={!!errors.title}
          helperText={errors.title}
          fullWidth
          required
        />

        {/* Rich text editor */}
        <Box>
          <Typography variant="body2" color={errors.content ? 'error' : 'text.secondary'} sx={{ mb: 0.75, fontWeight: 500 }}>
            Description *
          </Typography>
          <Box
            sx={{
              border: errors.content ? '1px solid' : '1px solid',
              borderColor: errors.content ? 'error.main' : 'divider',
              borderRadius: 1,
              '& .ql-container': { fontSize: 14, minHeight: 200, fontFamily: 'inherit' },
              '& .ql-toolbar': { borderRadius: '4px 4px 0 0', borderColor: 'divider' },
              '& .ql-container.ql-snow': { borderRadius: '0 0 4px 4px', borderColor: 'divider' },
            }}
          >
            <ReactQuill
              theme="snow"
              value={content}
              onChange={setContent}
              modules={QUILL_MODULES}
              formats={QUILL_FORMATS}
              placeholder="Describe the issue in detail — steps to reproduce, expected vs actual behavior, environment info…"
            />
          </Box>
          {errors.content && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
              {errors.content}
            </Typography>
          )}
        </Box>

        {/* Labels */}
        <Box>
          <TextField
            label="Labels"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Type a label and press Enter (e.g. bug, enhancement)"
            fullWidth
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button size="small" onClick={handleAddTag} startIcon={<AddIcon />}>Add</Button>
                </InputAdornment>
              ),
            }}
          />
          {tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => setTags(tags.filter((t) => t !== tag))}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Images only */}
        <Divider />
        <Typography variant="subtitle1" fontWeight={600}>
          Attachments{' '}
          <Typography component="span" variant="caption" color="text.secondary">(optional)</Typography>
        </Typography>
        <FileUpload type="images" value={images} onChange={setImages} />

        <Divider />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ alignSelf: 'flex-start', px: 4, borderRadius: 2 }}
        >
          {loading ? 'Saving…' : isEditing ? 'Save Changes' : 'Submit Issue'}
        </Button>
      </Stack>
    </Box>
  );
}
