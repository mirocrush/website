import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { deleteBlog } from '../api/blogApi';

export default function BlogCard({ blog, onDeleted }) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBlog(blog.id);
      onDeleted(blog.id);
    } catch {
      alert('Failed to delete blog.');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const preview =
    blog.content.length > 150 ? blog.content.slice(0, 150) + '...' : blog.content;

  return (
    <>
      <Card
        elevation={2}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'box-shadow 0.2s',
          '&:hover': { boxShadow: 6 },
        }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {blog.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            By <strong>{blog.author}</strong> &nbsp;·&nbsp; {formatDate(blog.createdAt)}
          </Typography>
          <Typography variant="body2" color="text.primary" sx={{ mb: 2 }}>
            {preview}
          </Typography>
          {blog.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {blog.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" color="primary" variant="outlined" />
              ))}
            </Box>
          )}
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1 }}>
          <Button
            size="small"
            startIcon={<ViewIcon />}
            onClick={() => navigate(`/blogs/${blog.id}`)}
          >
            Read
          </Button>
          <Button
            size="small"
            startIcon={<EditIcon />}
            color="warning"
            onClick={() => navigate(`/edit/${blog.id}`)}
          >
            Edit
          </Button>
          <Button
            size="small"
            startIcon={<DeleteIcon />}
            color="error"
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
        </CardActions>
      </Card>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Blog Post?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "<strong>{blog.title}</strong>"? This action cannot
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
    </>
  );
}
