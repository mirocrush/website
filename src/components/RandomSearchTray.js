import React, { useState } from 'react';
import {
  Box, Paper, Typography, IconButton, Tooltip, Button,
  Chip, CircularProgress, Switch, FormControlLabel,
  Snackbar, Alert,
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
  Link as LinkIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useRandomSearch } from '../context/RandomSearchContext';
import { useAuth } from '../context/AuthContext';

const NARROW = 360;
const WIDE   = 560;

const LANG_BADGE = {
  Python:     { label: 'PY', color: '#2196f3' },
  JavaScript: { label: 'JS', color: '#f59e0b' },
  TypeScript: { label: 'TS', color: '#6366f1' },
};

export default function RandomSearchTray() {
  const { user }   = useAuth();
  const rs         = useRandomSearch();
  const navigate   = useNavigate();
  const [wide, setWide] = useState(false);

  // Always render FAB — even if no search has started
  if (!user) return null;

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
        {/* ── Expanded card (only when tray is open and there is something to show) ── */}
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
            {/* ── Header ─────────────────────────────────────────────── */}
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1.5, py: 0.75,
                bgcolor: 'primary.main', color: 'white', flexShrink: 0,
              }}
            >
              <SmartIcon sx={{ fontSize: 16 }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1, fontSize: 13 }}>
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
              <Tooltip title="Open in Smart Search"><IconButton size="small" sx={{ color: 'white', p: 0.25 }} onClick={goToSearch}><OpenPageIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
              <Tooltip title="Clear search log & queue"><IconButton size="small" sx={{ color: 'rgba(255,255,255,0.75)', p: 0.25 }} onClick={rs.clearAll}><ClearIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
              <Tooltip title={wide ? 'Narrow' : 'Widen'}><IconButton size="small" sx={{ color: 'white', p: 0.25 }} onClick={() => setWide(v => !v)}>{wide ? <CollapseWIcon sx={{ fontSize: 14 }} /> : <ExpandWIcon sx={{ fontSize: 14 }} />}</IconButton></Tooltip>
              <Tooltip title="Minimize"><IconButton size="small" sx={{ color: 'white', p: 0.25 }} onClick={() => rs.setTrayExpanded(false)}><CollapseIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
            </Box>

            {/* ── Stats + controls ────────────────────────────────────── */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, bgcolor: 'grey.50', flexShrink: 0 }}>
              <Chip label={`${rs.imported} imported`} size="small" color="success" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
              {rs.queue.length > 0 && (
                <Chip label={`${rs.queue.length} pending`} size="small" color="warning" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
              )}
              {rs.restoredFromDB && !rs.running && (
                <Chip label="Restored" size="small" color="info" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
              )}
              <Box sx={{ flexGrow: 1 }} />
              {rs.running ? (
                <Button size="small" color="error" variant="contained" sx={{ fontSize: 10, py: 0.25, px: 1, minWidth: 0, height: 22 }} onClick={rs.stopSearch}>■ Stop</Button>
              ) : (
                <Button size="small" color="secondary" variant="contained" sx={{ fontSize: 10, py: 0.25, px: 1, minWidth: 0, height: 22 }} onClick={rs.startSearch} startIcon={<StartIcon sx={{ fontSize: 12 }} />}>
                  {rs.log.length > 0 || rs.imported > 0 || rs.queue.length > 0 ? 'Continue' : 'Start'}
                </Button>
              )}
            </Box>

            {/* ── Issue queue list ─────────────────────────────────────── */}
            <Box
              sx={{
                flexGrow: 1, overflowY: 'auto',
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
                    <Typography variant="caption" color="text.disabled">
                      No pending issues — click Start to begin
                    </Typography>
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
              {rs.queue.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, px: 1.5, py: 0.75 }}>
                  <Button size="small" color="success" variant="outlined" fullWidth startIcon={<ApproveAllIcon sx={{ fontSize: 13 }} />} sx={{ fontSize: 11, py: 0.25 }} onClick={rs.handleApproveAll}>
                    Approve All ({rs.queue.length})
                  </Button>
                  <Button size="small" color="error" variant="outlined" fullWidth startIcon={<RejectAllIcon sx={{ fontSize: 13 }} />} sx={{ fontSize: 11, py: 0.25 }} onClick={rs.handleRejectAll}>
                    Reject All
                  </Button>
                </Box>
              )}
              <Box sx={{ px: 1.5, py: 0.5 }}>
                <FormControlLabel
                  control={<Switch checked={rs.autoApprove} onChange={e => rs.setAutoApprove(e.target.checked)} size="small" color="success" />}
                  label={<Typography variant="caption" color="text.secondary">Auto-approve</Typography>}
                  sx={{ m: 0 }}
                />
              </Box>
            </Box>
          </Paper>
        )}

        {/* ── FAB — always visible ─────────────────────────────────────── */}
        <Tooltip title={rs.trayExpanded ? 'Minimize' : 'Random Search'}>
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
            <Box sx={{ position: 'relative' }}>
              <SmartIcon />
              {rs.queue.length > 0 && (
                <Box
                  sx={{
                    position: 'absolute', top: -7, right: -11,
                    bgcolor: 'warning.main', color: 'white',
                    borderRadius: '10px', fontSize: 9, fontWeight: 700,
                    px: 0.5, minWidth: 16, textAlign: 'center', lineHeight: '16px',
                  }}
                >
                  {rs.queue.length > 99 ? '99+' : rs.queue.length}
                </Box>
              )}
            </Box>
          </Box>
        </Tooltip>
      </Box>

      <Snackbar open={Boolean(rs.doneSnack)} autoHideDuration={8000} onClose={() => rs.setDoneSnack('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => rs.setDoneSnack('')} sx={{ width: '100%' }}>{rs.doneSnack}</Alert>
      </Snackbar>
    </>
  );
}

// ── Issue card ─────────────────────────────────────────────────────────────────
function IssueCard({ item, wide, approving, onApprove, onReject }) {
  const { issue, score } = item;
  const scoreColor  = score >= 75 ? 'success' : score >= 50 ? 'warning' : 'error';
  const lang        = LANG_BADGE[issue.repoCategory];

  const repoName  = issue.repoName   || '';
  const title     = issue.issueTitle || '(no title)';
  const issueLink = issue.issueLink  || '';

  const issueNumMatch = issueLink.match(/\/issues\/(\d+)$/);
  const issueNum = issueNumMatch ? `#${issueNumMatch[1]}` : '';

  return (
    <Box
      sx={{
        px: 1.25, py: 0.875,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper',
        '&:hover': { bgcolor: 'action.hover' },
        transition: 'background-color 0.15s',
      }}
    >
      {/* Row 1: title + link icon */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
        <Typography
          variant="caption"
          fontWeight={600}
          sx={{
            flexGrow: 1, minWidth: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: wide ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.45,
            fontSize: 11.5,
          }}
        >
          {title}
        </Typography>
        {issueLink && (
          <Tooltip title="Open issue">
            <IconButton
              size="small"
              component="a"
              href={issueLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              sx={{ p: 0.25, flexShrink: 0, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
            >
              <LinkIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Row 2: meta badges */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
        <Typography variant="caption" color="text.disabled" noWrap sx={{ fontSize: 10, maxWidth: wide ? 220 : 140 }}>
          {repoName}{issueNum ? ` · ${issueNum}` : ''}
        </Typography>
        {/* Language badge */}
        {lang && (
          <Box
            sx={{
              px: 0.6, height: 15, borderRadius: '3px',
              bgcolor: lang.color, color: '#fff',
              fontSize: 9, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center',
              letterSpacing: 0.3,
            }}
          >
            {lang.label}
          </Box>
        )}
        {/* Score chip */}
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

      {/* Row 3: approve / reject — same line, rectangular buttons */}
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <Tooltip title="Approve & import">
          <span style={{ flex: 1 }}>
            <Button
              fullWidth
              size="small"
              color="success"
              variant="contained"
              disabled={approving}
              onClick={onApprove}
              startIcon={approving ? <CircularProgress size={11} color="inherit" /> : <ApproveIcon sx={{ fontSize: 13 }} />}
              sx={{
                fontSize: 10, py: 0.25, borderRadius: '4px',
                textTransform: 'none', fontWeight: 600,
              }}
            >
              Approve
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Reject">
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={onReject}
            startIcon={<RejectIcon sx={{ fontSize: 13 }} />}
            sx={{
              fontSize: 10, py: 0.25, borderRadius: '4px',
              textTransform: 'none', fontWeight: 600, flexShrink: 0,
            }}
          >
            Reject
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );
}
