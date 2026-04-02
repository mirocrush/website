import React, { useEffect, useState } from 'react';
import {
  Container, Typography, CircularProgress, Alert, Box,
  Button, Paper, Snackbar,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import BlogForm from '../components/BlogForm';
import { getBlog, createBlog, updateBlog } from '../api/blogApi';
import { useAuth } from '../context/AuthContext';

export default function CreateEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [initialValues, setInitialValues] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [fetching,  setFetching]  = useState(isEditing);
  const [error,     setError]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isEditing) return;
    const fetchBlog = async () => {
      setFetching(true);
      try {
        const res = await getBlog(id);
        setInitialValues(res.data.data);
      } catch {
        setError('Failed to load issue for editing.');
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
        setSuccessMsg('Issue updated successfully!');
        setTimeout(() => navigate(`/blogs/${id}`), 1200);
      } else {
        const res = await createBlog({
          ...values,
          author:   user?.displayName || user?.username || 'Anonymous',
          userId:   user?._id || user?.id || null,
          username: user?.username || null,
        });
        setSuccessMsg('Issue reported successfully!');
        setTimeout(() => navigate(`/blogs/${res.data.data.id}`), 1200);
      }
    } catch {
      setError('Failed to save the issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/blogs')} sx={{ mb: 3 }}>
        Back to Issues
      </Button>

      <Paper elevation={2} sx={{ p: { xs: 3, md: 5 }, borderRadius: 2 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {isEditing ? 'Edit Issue' : 'Report an Issue'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          {isEditing
            ? 'Update the details below and save your changes.'
            : 'Describe the problem or suggestion in detail so it can be addressed.'}
        </Typography>

        {fetching && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {!fetching && (
          <BlogForm
            initialValues={isEditing ? (initialValues || {}) : {}}
            onSubmit={handleSubmit}
            loading={loading}
            isEditing={isEditing}
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
