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
  IconButton,
  Tooltip,
  ImageList,
  ImageListItem,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { getBlog, deleteBlog, getPdfSignedUrl } from '../api/blogApi';

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [blog,        setBlog]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState({});
  const [lightbox,    setLightbox]    = useState(null); // url of zoomed image

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

  const handleDownloadPdf = async (pdf, index) => {
    setPdfLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const res = await getPdfSignedUrl(pdf.path);
      window.open(res.data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Failed to generate download link. Please try again.');
    } finally {
      setPdfLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
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

          {/* ── Image Gallery ── */}
          {blog.images && blog.images.length > 0 && (
            <>
              <Divider sx={{ my: 4 }} />
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Images ({blog.images.length})
              </Typography>
              <ImageList
                cols={blog.images.length === 1 ? 1 : 2}
                gap={8}
                sx={{ mt: 1 }}
              >
                {blog.images.map((img, i) => (
                  <ImageListItem
                    key={img.path}
                    sx={{ cursor: 'zoom-in', overflow: 'hidden', borderRadius: 1 }}
                    onClick={() => setLightbox(img.url)}
                  >
                    <img
                      src={img.url}
                      alt={`image-${i + 1}`}
                      loading="lazy"
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            </>
          )}

          {/* ── PDF Attachments ── */}
          {blog.pdfs && blog.pdfs.length > 0 && (
            <>
              <Divider sx={{ my: 4 }} />
              <Typography variant="h6" fontWeight={600} gutterBottom>
                PDF Attachments ({blog.pdfs.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                {blog.pdfs.map((pdf, i) => (
                  <Box
                    key={pdf.path}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'background.default',
                    }}
                  >
                    <PdfIcon color="error" sx={{ fontSize: 28 }} />
                    <Typography variant="body2" sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                      {pdf.path.split('/').pop()}
                    </Typography>
                    <Tooltip title="Download (opens a secure link)">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={
                            pdfLoading[i] ? (
                              <CircularProgress size={14} />
                            ) : (
                              <DownloadIcon />
                            )
                          }
                          disabled={pdfLoading[i]}
                          onClick={() => handleDownloadPdf(pdf, i)}
                        >
                          Download
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            </>
          )}

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

      {/* ── Lightbox ── */}
      <Dialog
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}
      >
        <Box
          sx={{ position: 'relative', cursor: 'zoom-out' }}
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="full-size"
            style={{ maxWidth: '90vw', maxHeight: '85vh', display: 'block', borderRadius: 8 }}
          />
          <Tooltip title="Open in new tab">
            <IconButton
              href={lightbox}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(0,0,0,0.5)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
              }}
            >
              <OpenIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Blog Post?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "<strong>{blog?.title}</strong>"? All attached
            images and PDFs will also be permanently removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" disabled={deleting} autoFocus>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
