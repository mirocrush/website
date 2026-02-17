import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Chip,
  Button,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { getBlog, deleteBlog } from '../api/blogApi';

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchBlog = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getBlog(id);
        setBlog(res.data);
      } catch {
        setError('Blog not found or failed to load.');
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBlog(id);
      navigate('/blogs');
    } catch {
      alert('Failed to delete blog.');
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/blogs')} sx={{ mb: 3 }}>
        Back to All Posts
      </Button>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={48} />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && blog && (
        <Paper elevation={2} sx={{ p: { xs: 3, md: 5 } }}>
          {/* Tags */}
          {blog.tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
              {blog.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" color="primary" variant="outlined" />
              ))}
            </Box>
          )}

          {/* Title */}
          <Typography variant="h3" fontWeight={700} gutterBottom sx={{ lineHeight: 1.2 }}>
            {blog.title}
          </Typography>

          {/* Meta */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            By <strong>{blog.author}</strong> &nbsp;·&nbsp; {formatDate(blog.createdAt)}
            {blog.updatedAt !== blog.createdAt && (
              <> &nbsp;·&nbsp; Updated {formatDate(blog.updatedAt)}</>
            )}
          </Typography>

          <Divider sx={{ mb: 3 }} />

          {/* Content */}
          <Typography
            variant="body1"
            sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: '1.05rem' }}
          >
            {blog.content}
          </Typography>

          <Divider sx={{ my: 4 }} />

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/edit/${blog.id}`)}
            >
              Edit Post
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setConfirmOpen(true)}
            >
              Delete Post
            </Button>
          </Box>
        </Paper>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Blog Post?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "<strong>{blog?.title}</strong>"? This action cannot
            be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" disabled={deleting} autoFocus>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
