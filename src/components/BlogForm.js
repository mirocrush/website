import React, { useState } from 'react';
import {
  TextField, Button, Box, Chip, Stack,
  Typography, InputAdornment, Divider,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import FileUpload from './FileUpload';

export default function BlogForm({ initialValues = {}, onSubmit, loading, isEditing }) {
  const [title,    setTitle]    = useState(initialValues.title   || '');
  const [content,  setContent]  = useState(initialValues.content || '');
  const [tagInput, setTagInput] = useState('');
  const [tags,     setTags]     = useState(initialValues.tags    || []);
  const [images,   setImages]   = useState(initialValues.images  || []);
  const [pdfs,     setPdfs]     = useState(initialValues.pdfs    || []);
  const [errors,   setErrors]   = useState({});

  const validate = () => {
    const e = {};
    if (!title.trim())   e.title   = 'Title is required';
    if (!content.trim()) e.content = 'Description is required';
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
    onSubmit({ title: title.trim(), content: content.trim(), tags, images, pdfs });
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

        <TextField
          label="Description"
          placeholder="Describe the issue in detail — include steps to reproduce, expected vs actual behavior, environment info, etc."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          error={!!errors.content}
          helperText={errors.content}
          multiline
          rows={8}
          fullWidth
          required
        />

        {/* Labels / Tags */}
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
                  <Button size="small" onClick={handleAddTag} startIcon={<AddIcon />}>
                    Add
                  </Button>
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

        {/* Attachments */}
        <Divider />
        <Typography variant="subtitle1" fontWeight={600}>
          Attachments <Typography component="span" variant="caption" color="text.secondary">(optional)</Typography>
        </Typography>

        <FileUpload type="images" value={images} onChange={setImages} />
        <FileUpload type="pdfs"   value={pdfs}   onChange={setPdfs}   />

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
