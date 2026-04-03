import React, { useState } from 'react';
import {
  Box, Paper, Typography, IconButton, Tooltip, Button,
  Chip, CircularProgress, Switch, FormControlLabel,
  Snackbar, Alert, Divider,
} from '@mui/material';
import {
  AutoAwesome as SmartIcon,
  ExpandLess as CollapseIcon,
  PlayArrow as StartIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  DoneAll as ApproveAllIcon,
  RemoveDone as RejectAllIcon,
  OpenInNew as OpenPageIcon,
  UnfoldMore as ExpandWIcon,
  UnfoldLess as CollapseWIcon,
  DeleteSweep as ClearIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useRandomSearch } from '../context/RandomSearchContext';
import { useAuth } from '../context/AuthContext';

const NARROW = 360;
const WIDE   = 580;

export default function RandomSearchTray() {
  const { user }   = useAuth();
  const rs         = useRandomSearch();
  const navigate   = useNavigate();
  const [wide, setWide] = useState(false);

  if (!user) return null;
  if (!rs.running && rs.queue.length === 0 && rs.imported === 0 && rs.log.length === 0) return null;

  const cardWidth = wide ? WIDE : NARROW;

  function goToSearch() {
    navigate('/github-issues', { state: { openSmartSearch: true, initialTab: 3 } });
  }

  return (
    <>
      <Box
        sx={{
          position: 'fixed', bottom: 24, right: 24,
          zIndex: 1299, display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        }}
      >
        {/* ── Expanded card ─────────────────────────────────────────────── */}
        {rs.trayExpanded && (
          <Paper
            elevation={8}
            sx={{
              width: cardWidth,
              mb: 1, borderRadius: 2, overflow: 'hidden',
              border: '1px solid', borderColor: 'divider',
              display: 'flex', flexDirection: 'column',
              transition: 'width 0.2s ease',
            }}
          >
            {/* Header */}
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.5, py: 0.75,
                bgcolor: 'primary.main', color: 'white', flexShrink: 0,
              }}
            >
              <SmartIcon fontSize="small" />
              <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
                Random Search
              </Typography>
              {rs.running && <CircularProgress size={12} sx={{ color: 'rgba(255,255,255,0.8)' }} />}
              <Chip
                label={rs.running ? 'Running' : 'Stopped'}
                size="small"
                sx={{
                  height: 16, fontSize: 10, fontWeight: 700,
                  bgcolor: rs.running ? '#4caf50' : 'rgba(255,255,255,0.2)',
                  color: 'white',
                }}
              />
              {/* Navigate to search page */}
              <Tooltip title="Open in Smart Search">
                <IconButton size="small" sx={{ color: 'white', p: 0.25 }} onClick={goToSearch}>
                  <OpenPageIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              {/* Clear all */}
              <Tooltip title="Clear search log & queue">
                <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.8)', p: 0.25 }} onClick={rs.clearAll}>
                  <ClearIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              {/* Width toggle */}
              <Tooltip title={wide ? 'Narrow' : 'Widen'}>
                <IconButton size="small" sx={{ color: 'white', p: 0.25 }} onClick={() => setWide(v => !v)}>
                  {wide ? <CollapseWIcon sx={{ fontSize: 15 }} /> : <ExpandWIcon sx={{ fontSize: 15 }} />}
                </IconButton>
              </Tooltip>
              {/* Collapse */}
              <Tooltip title="Minimize">
                <IconButton size="small" sx={{ color: 'white', p: 0.25 }} onClick={() => rs.setTrayExpanded(false)}>
                  <CollapseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Stats + controls */}
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.5, py: 0.75, bgcolor: 'grey.50', flexShrink: 0,
              }}
            >
              <Chip
                label={`${rs.imported} imported`}
                size="small" color="success" variant="outlined"
                sx={{ fontSize: 10, height: 18 }}
              />
              {rs.queue.length > 0 && (
                <Chip
                  label={`${rs.queue.length} pending`}
                  size="small" color="warning" variant="outlined"
                  sx={{ fontSize: 10, height: 18 }}
                />
              )}
              {rs.restoredFromDB && !rs.running && (
                <Chip label="Restored" size="small" color="info" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
              )}
              <Box sx={{ flexGrow: 1 }} />
              {rs.running ? (
                <Button
                  size="small" color="error" variant="contained"
                  sx={{ fontSize: 10, py: 0.25, px: 1, minWidth: 0, height: 22 }}
                  onClick={rs.stopSearch}
                >
                  ■ Stop
                </Button>
              ) : (
                <Button
                  size="small" color="secondary" variant="contained"
                  sx={{ fontSize: 10, py: 0.25, px: 1, minWidth: 0, height: 22 }}
                  onClick={rs.startSearch}
                  startIcon={<StartIcon sx={{ fontSize: 13 }} />}
                >
                  Start
                </Button>
              )}
            </Box>

            {/* ── Issue queue list ─────────────────────────────────────── */}
            <Box
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                maxHeight: wide ? 480 : 360,
                minHeight: 80,
                bgcolor: '#fafafa',
                borderTop: '1px solid', borderColor: 'divider',
              }}
            >
              {rs.queue.length === 0 ? (
                <Box sx={{ py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  {rs.running ? (
                    <>
                      <CircularProgress size={18} />
                      <Typography variant="caption" color="text.disabled">Searching for issues…</Typography>
                    </>
                  ) : (
                    <Typography variant="caption" color="text.disabled">No pending issues</Typography>
                  )}
                </Box>
              ) : (
                rs.queue.map((item) => (
                  <IssueCard
                    key={item.uid}
                    item={item}
                    wide={wide}
                    approving={rs.approvingId === item.uid}
                    onApprove={() => rs.handleApprove(item.uid)}
                    onReject={() => rs.handleReject(item.uid)}
                  />
                ))
              )}
            </Box>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <Box sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}>
              {/* Approve All / Reject All */}
              {rs.queue.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, px: 1.5, py: 0.75 }}>
                  <Button
                    size="small" color="success" variant="outlined" fullWidth
                    startIcon={<ApproveAllIcon sx={{ fontSize: 13 }} />}
                    sx={{ fontSize: 11, py: 0.25 }}
                    onClick={rs.handleApproveAll}
                  >
                    Approve All ({rs.queue.length})
                  </Button>
                  <Button
                    size="small" color="error" variant="outlined" fullWidth
                    startIcon={<RejectAllIcon sx={{ fontSize: 13 }} />}
                    sx={{ fontSize: 11, py: 0.25 }}
                    onClick={rs.handleRejectAll}
                  >
                    Reject All
                  </Button>
                </Box>
              )}
              {/* Auto-approve */}
              <Box sx={{ px: 1.5, py: 0.5 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={rs.autoApprove}
                      onChange={e => rs.setAutoApprove(e.target.checked)}
                      size="small"
                      color="success"
                    />
                  }
                  label={<Typography variant="caption" color="text.secondary">Auto-approve</Typography>}
                  sx={{ m: 0 }}
                />
              </Box>
            </Box>
          </Paper>
        )}

        {/* ── FAB toggle ─────────────────────────────────────────────────── */}
        <Tooltip title={rs.trayExpanded ? 'Minimize' : 'Random Search — review pending issues'}>
          <Box
            onClick={() => rs.setTrayExpanded(v => !v)}
            sx={{
              width: 48, height: 48, borderRadius: '50%',
              bgcolor: rs.running ? 'secondary.main' : 'primary.main',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: 4,
              transition: 'background-color 0.2s',
              '&:hover': { bgcolor: rs.running ? 'secondary.dark' : 'primary.dark' },
              position: 'relative',
            }}
          >
            {rs.running && (
              <CircularProgress size={48} sx={{ position: 'absolute', color: 'rgba(255,255,255,0.4)' }} />
            )}
            {rs.queue.length > 0 ? (
              <Box sx={{ position: 'relative' }}>
                <SmartIcon />
                <Box
                  sx={{
                    position: 'absolute', top: -6, right: -10,
                    bgcolor: 'warning.main', color: 'white',
                    borderRadius: '10px', fontSize: 9, fontWeight: 700,
                    px: 0.5, minWidth: 16, textAlign: 'center', lineHeight: '16px',
                  }}
                >
                  {rs.queue.length > 99 ? '99+' : rs.queue.length}
                </Box>
              </Box>
            ) : (
              <SmartIcon />
            )}
          </Box>
        </Tooltip>
      </Box>

      {/* Snackbar notification fallback */}
      <Snackbar
        open={Boolean(rs.doneSnack)}
        autoHideDuration={8000}
        onClose={() => rs.setDoneSnack('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => rs.setDoneSnack('')} sx={{ width: '100%' }}>
          {rs.doneSnack}
        </Alert>
      </Snackbar>
    </>
  );
}

// ── Issue card ─────────────────────────────────────────────────────────────────
function IssueCard({ item, wide, approving, onApprove, onReject }) {
  const { issue, score } = item;
  const scoreColor = score >= 75 ? 'success' : score >= 50 ? 'warning' : 'error';

  const repoName   = issue.repoName  || '';
  const title      = issue.issueTitle || '(no title)';
  const issueLink  = issue.issueLink  || '';

  // Extract issue number from link for compact display
  const issueNumMatch = issueLink.match(/\/issues\/(\d+)$/);
  const issueNum = issueNumMatch ? `#${issueNumMatch[1]}` : '';

  return (
    <Box
      sx={{
        px: 1.5, py: 1,
        borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'flex-start', gap: 1,
        bgcolor: 'background.paper',
        '&:hover': { bgcolor: 'action.hover' },
        transition: 'background-color 0.15s',
      }}
    >
      {/* Text */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          fontWeight={600}
          display="block"
          sx={{
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: wide ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.4,
            mb: 0.25,
          }}
        >
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.disabled" noWrap sx={{ maxWidth: wide ? 260 : 160, fontSize: 10 }}>
            {repoName}{issueNum ? ` · ${issueNum}` : ''}
          </Typography>
          <Chip
            label={score}
            size="small"
            color={scoreColor}
            variant="outlined"
            sx={{ height: 15, fontSize: 9, '& .MuiChip-label': { px: 0.5 } }}
          />
          {issue.prLink && (
            <Chip label="PR" size="small" color="success" variant="outlined" sx={{ height: 15, fontSize: 9, '& .MuiChip-label': { px: 0.5 } }} />
          )}
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
        <Tooltip title="Approve & import">
          <span>
            <IconButton
              size="small"
              color="success"
              disabled={approving}
              onClick={onApprove}
              sx={{ p: 0.5, bgcolor: 'success.50', '&:hover': { bgcolor: 'success.100' } }}
            >
              {approving ? <CircularProgress size={14} /> : <ApproveIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Reject">
          <IconButton
            size="small"
            color="error"
            onClick={onReject}
            sx={{ p: 0.5 }}
          >
            <RejectIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
