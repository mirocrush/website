import React, { useEffect, useState } from 'react';
import {
  Container, Typography, CircularProgress, Alert, Box, Button,
  Chip, Paper, Tabs, Tab, Stack, Tooltip, Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  RadioButtonUnchecked as OpenIcon,
  CheckCircle as SolvedIcon,
  Comment as CommentIcon,
  ThumbUp as LikeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { listBlogs } from '../api/blogApi';

export default function BlogList() {
  const navigate = useNavigate();
  const [issues, setIssues]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState('open');

  const fetchIssues = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listBlogs();
      setIssues(res.data.data);
    } catch {
      setError('Failed to load issues. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssues(); }, []);

  const openCount   = issues.filter((i) => i.status !== 'solved').length;
  const solvedCount = issues.filter((i) => i.status === 'solved').length;

  const filtered = issues.filter((i) =>
    tab === 'all' ? true : tab === 'open' ? i.status !== 'solved' : i.status === 'solved'
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Issues</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
            Track and discuss problems or suggestions
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/create')}
          sx={{ borderRadius: 2 }}
        >
          Report Issue
        </Button>
      </Box>

      {error && (
        <Alert severity="error" action={<Button onClick={fetchIssues}>Retry</Button>} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* Tab bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 2,
            bgcolor: 'grey.50',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, py: 0, fontSize: 13 } }}
          >
            <Tab
              value="open"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <OpenIcon sx={{ fontSize: 15, color: 'success.main' }} />
                  {openCount} Open
                </Box>
              }
            />
            <Tab
              value="solved"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <SolvedIcon sx={{ fontSize: 15, color: 'secondary.main' }} />
                  {solvedCount} Solved
                </Box>
              }
            />
            <Tab value="all" label="All" />
          </Tabs>
        </Box>

        {/* Loading */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
            <Typography variant="body1" gutterBottom>
              No {tab !== 'all' ? tab : ''} issues found.
            </Typography>
            {tab !== 'solved' && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/create')}
                sx={{ mt: 1, borderRadius: 2 }}
              >
                Report the first issue
              </Button>
            )}
          </Box>
        )}

        {/* Issue rows */}
        {!loading && filtered.map((issue, idx) => (
          <React.Fragment key={issue.id}>
            {idx > 0 && <Divider />}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                px: 3,
                py: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => navigate(`/blogs/${issue.id}`)}
            >
              {/* Status icon */}
              <Box sx={{ mt: 0.25, mr: 2, flexShrink: 0 }}>
                {issue.status === 'solved'
                  ? <SolvedIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
                  : <OpenIcon sx={{ color: 'success.main', fontSize: 20 }} />
                }
              </Box>

              {/* Title + meta */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                  <Typography
                    variant="body1"
                    fontWeight={600}
                    sx={{ '&:hover': { color: 'primary.main' } }}
                  >
                    {issue.title}
                  </Typography>
                  {issue.status === 'solved' && (
                    <Chip
                      label="Solved"
                      size="small"
                      color="secondary"
                      sx={{ height: 18, fontSize: 11, fontWeight: 600 }}
                    />
                  )}
                  {issue.tags?.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: 11 }}
                    />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  #{issue.id?.slice(-6)} &nbsp;·&nbsp; opened{' '}
                  {new Date(issue.createdAt).toLocaleDateString()} by @{issue.username || issue.author}
                </Typography>
              </Box>

              {/* Right: comments + likes */}
              <Stack direction="row" spacing={2} sx={{ ml: 2, flexShrink: 0, alignItems: 'center' }}>
                {issue.comments?.length > 0 && (
                  <Tooltip title={`${issue.comments.length} comment${issue.comments.length !== 1 ? 's' : ''}`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CommentIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {issue.comments.length}
                      </Typography>
                    </Box>
                  </Tooltip>
                )}
                {issue.likes?.length > 0 && (
                  <Tooltip title={`${issue.likes.length} like${issue.likes.length !== 1 ? 's' : ''}`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LikeIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {issue.likes.length}
                      </Typography>
                    </Box>
                  </Tooltip>
                )}
              </Stack>
            </Box>
          </React.Fragment>
        ))}
      </Paper>
    </Container>
  );
}
