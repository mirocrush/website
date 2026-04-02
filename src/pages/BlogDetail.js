import React, { useEffect, useState } from 'react';
import {
  Container, Typography, CircularProgress, Alert, Box, Chip,
  Button, Divider, Paper, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, IconButton, Tooltip,
  ImageList, ImageListItem, Avatar, TextField, Stack,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  OpenInNew as OpenIcon,
  ThumbUp as ThumbUpIcon,
  ThumbUpOutlined as ThumbUpOutlinedIcon,
  CheckCircle as SolvedIcon,
  RadioButtonUnchecked as OpenStatusIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBlog, deleteBlog, getPdfSignedUrl, commentIssue, likeIssue, solveIssue } from '../api/blogApi';

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [blog,         setBlog]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [pdfLoading,   setPdfLoading]   = useState({});
  const [lightbox,     setLightbox]     = useState(null);
  const [commentText,  setCommentText]  = useState('');
  const [commenting,   setCommenting]   = useState(false);
  const [liking,       setLiking]       = useState(false);
  const [solving,      setSolving]      = useState(false);

  const userId = user?._id || user?.id;

  useEffect(() => {
    const fetchBlog = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getBlog(id);
        setBlog(res.data.data);
      } catch {
        setError('Issue not found or failed to load.');
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
      alert('Failed to delete issue.');
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const handleDownloadPdf = async (pdf, index) => {
    setPdfLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const res = await getPdfSignedUrl(pdf.path);
      window.open(res.data.data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Failed to generate download link. Please try again.');
    } finally {
      setPdfLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  const handleLike = async () => {
    if (!user) return;
    setLiking(true);
    try {
      const res = await likeIssue({ id, userId });
      setBlog(res.data.data);
    } catch {
      alert('Failed to toggle like.');
    } finally {
      setLiking(false);
    }
  };

  const handleSolve = async () => {
    setSolving(true);
    try {
      const res = await solveIssue({ id, userId });
      setBlog(res.data.data);
    } catch {
      alert('Failed to mark as solved.');
    } finally {
      setSolving(false);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !user) return;
    setCommenting(true);
    try {
      const res = await commentIssue({
        id,
        userId,
        username:    user.username    || '',
        displayName: user.displayName || '',
        content:     commentText.trim(),
      });
      setBlog(res.data.data);
      setCommentText('');
    } catch {
      alert('Failed to add comment.');
    } finally {
      setCommenting(false);
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

  const formatDateTime = (iso) =>
    new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const isSolved    = blog?.status === 'solved';
  const isLiked     = blog?.likes?.includes(userId);
  const isReporter  = user && blog?.userId && blog.userId === userId;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/blogs')} sx={{ mb: 2 }}>
        Back to Issues
      </Button>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={48} />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && blog && (
        <>
          {/* ── Issue Header ── */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
              <Chip
                icon={isSolved ? <SolvedIcon /> : <OpenStatusIcon />}
                label={isSolved ? 'Solved' : 'Open'}
                color={isSolved ? 'secondary' : 'success'}
                size="small"
                sx={{ fontWeight: 600, mt: 0.5 }}
              />
              <Typography variant="h5" fontWeight={700} sx={{ flex: 1, lineHeight: 1.3 }}>
                {blog.title}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              <strong>#{blog.id?.slice(-6)}</strong> &nbsp;·&nbsp;
              reported by <strong>@{blog.username || blog.author}</strong> &nbsp;·&nbsp;
              opened {formatDate(blog.createdAt)}
              {blog.comments?.length > 0 && ` · ${blog.comments.length} comment${blog.comments.length !== 1 ? 's' : ''}`}
            </Typography>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* ── Issue Body ── */}
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
            {/* Reporter header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2.5,
                py: 1.25,
                bgcolor: 'grey.50',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main' }}>
                  {(blog.username || blog.author || '?')[0].toUpperCase()}
                </Avatar>
                <Typography variant="body2" fontWeight={600}>
                  @{blog.username || blog.author}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  · {formatDateTime(blog.createdAt)}
                </Typography>
              </Box>
              {blog.tags?.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {blog.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  ))}
                </Box>
              )}
            </Box>

            {/* Content */}
            <Box sx={{ px: 2.5, py: 2.5 }}>
              <Typography variant="body1" sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {blog.content}
              </Typography>
            </Box>

            {/* Images */}
            {blog.images?.length > 0 && (
              <Box sx={{ px: 2.5, pb: 2.5 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Attachments — Images ({blog.images.length})
                </Typography>
                <ImageList cols={blog.images.length === 1 ? 1 : 2} gap={8}>
                  {blog.images.map((img, i) => (
                    <ImageListItem
                      key={img.path}
                      sx={{ cursor: 'zoom-in', overflow: 'hidden', borderRadius: 1 }}
                      onClick={() => setLightbox(img.url)}
                    >
                      <img
                        src={img.url}
                        alt={`attachment-${i + 1}`}
                        loading="lazy"
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                      />
                    </ImageListItem>
                  ))}
                </ImageList>
              </Box>
            )}

            {/* PDFs */}
            {blog.pdfs?.length > 0 && (
              <Box sx={{ px: 2.5, pb: 2.5 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Attachments — PDFs ({blog.pdfs.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {blog.pdfs.map((pdf, i) => (
                    <Box
                      key={pdf.path}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        p: 1.5, border: '1px solid', borderColor: 'divider',
                        borderRadius: 1, bgcolor: 'background.default',
                      }}
                    >
                      <PdfIcon color="error" sx={{ fontSize: 28 }} />
                      <Typography variant="body2" sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                        {pdf.path.split('/').pop()}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={pdfLoading[i] ? <CircularProgress size={14} /> : <DownloadIcon />}
                        disabled={pdfLoading[i]}
                        onClick={() => handleDownloadPdf(pdf, i)}
                      >
                        Download
                      </Button>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          {/* ── Action bar ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4, flexWrap: 'wrap' }}>
            {/* Like */}
            <Tooltip title={isLiked ? 'Unlike' : 'Like'} arrow>
              <span>
                <Button
                  variant={isLiked ? 'contained' : 'outlined'}
                  color="primary"
                  startIcon={liking ? <CircularProgress size={16} /> : isLiked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
                  onClick={handleLike}
                  disabled={liking || !user}
                  size="small"
                  sx={{ borderRadius: 2 }}
                >
                  {blog.likes?.length || 0}
                </Button>
              </span>
            </Tooltip>

            <Box sx={{ flex: 1 }} />

            {/* Reporter actions */}
            {isReporter && !isSolved && (
              <Button
                variant="contained"
                color="secondary"
                startIcon={solving ? <CircularProgress size={16} /> : <SolvedIcon />}
                onClick={handleSolve}
                disabled={solving}
                size="small"
                sx={{ borderRadius: 2 }}
              >
                Mark as Solved
              </Button>
            )}
            {isReporter && (
              <>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<EditIcon />}
                  onClick={() => navigate(`/edit/${blog.id}`)}
                  size="small"
                  sx={{ borderRadius: 2 }}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setConfirmOpen(true)}
                  size="small"
                  sx={{ borderRadius: 2 }}
                >
                  Delete
                </Button>
              </>
            )}
          </Box>

          {/* ── Comments ── */}
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Comments ({blog.comments?.length || 0})
          </Typography>

          {blog.comments?.length > 0 && (
            <Stack spacing={2} sx={{ mb: 3 }}>
              {blog.comments.map((c) => (
                <Paper
                  key={c._id || c.id}
                  variant="outlined"
                  sx={{ borderRadius: 2, overflow: 'hidden' }}
                >
                  <Box
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 2.5, py: 1, bgcolor: 'grey.50',
                      borderBottom: '1px solid', borderColor: 'divider',
                    }}
                  >
                    <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: 'secondary.main' }}>
                      {(c.displayName || c.username || '?')[0].toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" fontWeight={600}>
                      {c.displayName || `@${c.username}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      · {formatDateTime(c.createdAt)}
                    </Typography>
                  </Box>
                  <Box sx={{ px: 2.5, py: 1.75 }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {c.content}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Stack>
          )}

          {/* Add comment */}
          {user ? (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 2.5, py: 1, bgcolor: 'grey.50',
                  borderBottom: '1px solid', borderColor: 'divider',
                }}
              >
                <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: 'primary.main' }}>
                  {(user.displayName || user.username || '?')[0].toUpperCase()}
                </Avatar>
                <Typography variant="body2" fontWeight={600}>
                  {user.displayName || `@${user.username}`}
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <TextField
                  placeholder="Leave a comment…"
                  multiline
                  minRows={3}
                  fullWidth
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  variant="outlined"
                  size="small"
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                  <Button
                    variant="contained"
                    startIcon={commenting ? <CircularProgress size={16} /> : <SendIcon />}
                    onClick={handleComment}
                    disabled={commenting || !commentText.trim()}
                    size="small"
                    sx={{ borderRadius: 2 }}
                  >
                    Comment
                  </Button>
                </Box>
              </Box>
            </Paper>
          ) : (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              <Button size="small" onClick={() => navigate('/signin')}>Sign in</Button> to leave a comment.
            </Alert>
          )}
        </>
      )}

      {/* ── Lightbox ── */}
      <Dialog
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}
      >
        <Box sx={{ position: 'relative', cursor: 'zoom-out' }} onClick={() => setLightbox(null)}>
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
                position: 'absolute', top: 8, right: 8,
                bgcolor: 'rgba(0,0,0,0.5)', color: '#fff',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
              }}
            >
              <OpenIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Issue?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>"{blog?.title}"</strong>? All attachments
            will be permanently removed and this cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" disabled={deleting} autoFocus>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
