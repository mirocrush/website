import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Button,
  Paper,
  Snackbar,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import BlogForm from '../components/BlogForm';
import { getBlog, createBlog, updateBlog } from '../api/blogApi';

export default function CreateEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [initialValues, setInitialValues] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isEditing) return;
    const fetchBlog = async () => {
      setFetching(true);
      try {
        const res = await getBlog(id);
        setInitialValues(res.data);
      } catch {
        setError('Failed to load blog for editing.');
      } finally {
        setFetching(false);
      }
    };
    fetchBlog();
  }, [id, isEditing]);

  const handleSubmit = async (values) => {
    setLoading(true);
    setError('');
    try {
      if (isEditing) {
        await updateBlog({ id, ...values });
        setSuccessMsg('Blog updated successfully!');
        setTimeout(() => navigate(`/blogs/${id}`), 1200);
      } else {
        const res = await createBlog(values);
        setSuccessMsg('Blog created successfully!');
        setTimeout(() => navigate(`/blogs/${res.data.id}`), 1200);
      }
    } catch {
      setError('Failed to save the blog. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/blogs')} sx={{ mb: 3 }}>
        Back to All Posts
      </Button>

      <Paper elevation={2} sx={{ p: { xs: 3, md: 5 } }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {isEditing ? 'Edit Blog Post' : 'Write a New Post'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          {isEditing
            ? 'Update the fields below and save your changes.'
            : 'Fill in the details below to publish a new blog post.'}
        </Typography>

        {fetching && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!fetching && (
          <BlogForm
            initialValues={isEditing ? initialValues || {} : {}}
            onSubmit={handleSubmit}
            loading={loading}
          />
        )}
      </Paper>

      <Snackbar
        open={Boolean(successMsg)}
        autoHideDuration={3000}
        onClose={() => setSuccessMsg('')}
        message={successMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}
