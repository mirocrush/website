import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Button,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import BlogCard from '../components/BlogCard';
import { listBlogs } from '../api/blogApi';

export default function BlogList() {
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBlogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listBlogs();
      setBlogs(res.data);
    } catch {
      setError('Failed to load blogs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const handleDeleted = (id) => {
    setBlogs((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            All Blog Posts
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {blogs.length} {blogs.length === 1 ? 'post' : 'posts'} published
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/create')}
          size="large"
        >
          New Post
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={48} />
        </Box>
      )}

      {error && (
        <Alert severity="error" action={<Button onClick={fetchBlogs}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {!loading && !error && blogs.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No blog posts yet.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/create')}>
            Write the first post
          </Button>
        </Box>
      )}

      {!loading && !error && blogs.length > 0 && (
        <Grid container spacing={3}>
          {blogs.map((blog) => (
            <Grid item xs={12} sm={6} md={4} key={blog.id}>
              <BlogCard blog={blog} onDeleted={handleDeleted} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
