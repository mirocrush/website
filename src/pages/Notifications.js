import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Button, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Pagination, CircularProgress, Alert, Stack, Select,
  MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  DoneAll as DoneAllIcon,
  Done as DoneIcon,
  Circle as DotIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { listNotifications, markAllRead, markRead } from '../api/notificationsApi';

const PAGE_SIZE = 20;

const TYPE_LABELS = {
  prep_started:     'Prep Started',
  prep_initialized: 'Prep Initialized',
  prep_failed:      'Prep Failed',
  interact_started: 'Interact Started',
  interact_done:    'Interact Done',
  transfer_sent:    'Transfer Sent',
};
const TYPE_COLORS = {
  prep_started:     'info',
  prep_initialized: 'success',
  prep_failed:      'error',
  interact_started: 'primary',
  interact_done:    'secondary',
  transfer_sent:    'warning',
};

function notifDestination(notif) {
  if (notif.issueId) {
    return { path: '/github-issues', state: { openIssueId: notif.issueId?._id || notif.issueId } };
  }
  return { path: '/github-issues', state: {} };
}

export default function Notifications() {
  const navigate = useNavigate();

  const [notifs, setNotifs]       = useState([]);
  const [total, setTotal]         = useState(0);
  const [unreadCount, setUnread]  = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [filter, setFilter]       = useState('all'); // 'all' | 'unread' | 'read'
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const unreadOnly = filter === 'unread' ? true : undefined;
      const res = await listNotifications({ page, limit: PAGE_SIZE, unreadOnly });
      let data = res.data || [];
      if (filter === 'read') data = data.filter((n) => n.read);
      setNotifs(data);
      setTotal(filter === 'read' ? data.length : (res.total || data.length));
      setUnread(res.unreadCount || 0);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter]);

  const handleMarkRead = useCallback(async (notif) => {
    if (notif.read) return;
    setMarkingId(notif._id || notif.id);
    try {
      await markRead([notif._id || notif.id]);
      setNotifs((prev) => prev.map((n) =>
        (n._id || n.id) === (notif._id || notif.id) ? { ...n, read: true } : n
      ));
      setUnread((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
    finally { setMarkingId(null); }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch { /* ignore */ }
    finally { setMarkingAll(false); }
  }, []);

  const handleClickRow = useCallback(async (notif) => {
    // Mark read if unread
    if (!notif.read) {
      markRead([notif._id || notif.id]).catch(() => {});
      setNotifs((prev) => prev.map((n) =>
        (n._id || n.id) === (notif._id || notif.id) ? { ...n, read: true } : n
      ));
      setUnread((c) => Math.max(0, c - 1));
    }
    const { path, state } = notifDestination(notif);
    navigate(path, { state });
  }, [navigate]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Notifications</Typography>
          {unreadCount > 0 && (
            <Typography variant="body2" color="text.secondary">
              {unreadCount} unread
            </Typography>
          )}
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Filter</InputLabel>
            <Select value={filter} label="Filter" onChange={(e) => setFilter(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="unread">Unread</MenuItem>
              <MenuItem value="read">Read</MenuItem>
            </Select>
          </FormControl>
          {unreadCount > 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={markingAll ? <CircularProgress size={14} /> : <DoneAllIcon />}
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              Mark all read
            </Button>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell width={10} />
              <TableCell>Title</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : notifs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No notifications</Typography>
                </TableCell>
              </TableRow>
            ) : notifs.map((n) => {
              const id = n._id || n.id;
              const isUnread = !n.read;
              return (
                <TableRow
                  key={id}
                  hover
                  sx={{
                    cursor: 'pointer',
                    bgcolor: isUnread ? 'action.hover' : 'inherit',
                    '&:hover': { bgcolor: 'action.selected' },
                    fontWeight: isUnread ? 700 : 400,
                  }}
                  onClick={() => handleClickRow(n)}
                >
                  {/* Unread dot */}
                  <TableCell sx={{ px: 1, py: 0 }}>
                    {isUnread && (
                      <DotIcon sx={{ fontSize: 8, color: 'primary.main', display: 'block', mx: 'auto' }} />
                    )}
                  </TableCell>

                  {/* Title */}
                  <TableCell>
                    <Typography
                      variant="body2"
                      fontWeight={isUnread ? 700 : 400}
                      sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {n.title || '—'}
                    </Typography>
                  </TableCell>

                  {/* Message */}
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {n.message || '—'}
                    </Typography>
                  </TableCell>

                  {/* Type chip */}
                  <TableCell>
                    <Chip
                      label={TYPE_LABELS[n.type] || n.type || '—'}
                      color={TYPE_COLORS[n.type] || 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>

                  {/* Date */}
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                    </Typography>
                  </TableCell>

                  {/* Actions */}
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" gap={0.5} justifyContent="center">
                      {isUnread && (
                        <Tooltip title="Mark as read">
                          <span>
                            <IconButton
                              size="small"
                              disabled={markingId === id}
                              onClick={() => handleMarkRead(n)}
                            >
                              {markingId === id
                                ? <CircularProgress size={14} />
                                : <DoneIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      <Tooltip title="Go to page">
                        <IconButton
                          size="small"
                          onClick={() => handleClickRow(n)}
                        >
                          <OpenIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {pageCount > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
            size="small"
          />
        </Box>
      )}
    </Container>
  );
}
