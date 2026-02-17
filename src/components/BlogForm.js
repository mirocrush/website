import React, { useState } from 'react';
import {
  TextField,
  Button,
  Box,
  Chip,
  Stack,
  Typography,
  InputAdornment,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

export default function BlogForm({ initialValues = {}, onSubmit, loading }) {
  const [title, setTitle] = useState(initialValues.title || '');
  const [content, setContent] = useState(initialValues.content || '');
  const [author, setAuthor] = useState(initialValues.author || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(initialValues.tags || []);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!content.trim()) e.content = 'Content is required';
    if (!author.trim()) e.author = 'Author is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ title: title.trim(), content: content.trim(), author: author.trim(), tags });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={3}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={!!errors.title}
          helperText={errors.title}
          fullWidth
          required
        />

        <TextField
          label="Author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          error={!!errors.author}
          helperText={errors.author}
          fullWidth
          required
        />

        <TextField
          label="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          error={!!errors.content}
          helperText={errors.content}
          multiline
          rows={8}
          fullWidth
          required
        />

        <Box>
          <TextField
            label="Add Tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Type a tag and press Enter"
            fullWidth
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
                  onDelete={() => handleRemoveTag(tag)}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>
          )}
        </Box>

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ alignSelf: 'flex-start', px: 4 }}
        >
          {loading ? 'Saving...' : 'Save Post'}
        </Button>
      </Stack>
    </Box>
  );
}
