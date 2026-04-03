import React from 'react';
import {
  Box, Paper, Typography, IconButton, Tooltip, Button,
  Chip, Badge, CircularProgress, Divider, Switch, FormControlLabel,
  Snackbar, Alert,
} from '@mui/material';
import {
  AutoAwesome as SmartIcon,
  ExpandLess as CollapseIcon,
  PlayArrow as StartIcon,
} from '@mui/icons-material';
import { useRandomSearch } from '../context/RandomSearchContext';
import { useAuth } from '../context/AuthContext';

export default function RandomSearchTray() {
  const { user } = useAuth();
  const rs = useRandomSearch();
  if (!user) return null;

  // Only show tray if search has been started at least once
  if (!rs.running && rs.queue.length === 0 && rs.imported === 0 && rs.log.length === 0) return null;

  const lastLogs = rs.log.slice(-8);

  return (
    <>
      {/* Floating tray */}
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1299, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>

        {/* Expanded card */}
        {rs.trayExpanded && (
          <Paper
            elevation={8}
            sx={{
              width: 340, mb: 1, borderRadius: 2, overflow: 'hidden',
              border: '1px solid', borderColor: 'divider',
            }}
          >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, bgcolor: 'primary.main', color: 'white' }}>
              <SmartIcon fontSize="small" />
              <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
                Random Search
              </Typography>
              {rs.running && <CircularProgress size={14} sx={{ color: 'white' }} />}
              <Chip
                label={rs.running ? 'Running' : 'Stopped'}
                size="small"
                sx={{
                  height: 18, fontSize: 10, fontWeight: 700,
                  bgcolor: rs.running ? '#4caf50' : 'rgba(255,255,255,0.25)',
                  color: 'white',
                }}
              />
              <IconButton size="small" sx={{ color: 'white', p: 0.25 }} onClick={() => rs.setTrayExpanded(false)}>
                <CollapseIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Stats row */}
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.75, bgcolor: 'grey.50', gap: 1.5 }}>
              <Chip label={`${rs.imported} imported`} size="small" color="success" variant="outlined" sx={{ fontSize: 11 }} />
              {rs.queue.length > 0 && (
                <Chip label={`${rs.queue.length} pending review`} size="small" color="warning" variant="outlined" sx={{ fontSize: 11 }} />
              )}
              <Box sx={{ flexGrow: 1 }} />
              {rs.running ? (
                <Button size="small" color="error" variant="contained" sx={{ fontSize: 11, py: 0.25, minWidth: 0 }} onClick={rs.stopSearch}>
                  ■ Stop
                </Button>
              ) : (
                <Button size="small" color="secondary" variant="contained" sx={{ fontSize: 11, py: 0.25, minWidth: 0 }} onClick={rs.startSearch} startIcon={<StartIcon sx={{ fontSize: 14 }} />}>
                  Start
                </Button>
              )}
            </Box>

            {/* Mini terminal log */}
            <Box
              sx={{
                bgcolor: '#fff', px: 1.5, py: 1,
                fontFamily: '"SF Mono","Menlo","Consolas",monospace', fontSize: 11,
                maxHeight: 130, overflowY: 'auto',
                borderTop: '1px solid', borderColor: 'divider',
              }}
            >
              {lastLogs.length === 0 ? (
                <Typography variant="caption" sx={{ color: '#aeaeb2', fontFamily: 'inherit' }}>No log yet.</Typography>
              ) : lastLogs.map((entry, i) => (
                <Typography
                  key={i} variant="caption" display="block"
                  sx={{ color: entry.color === 'inherit' ? '#1d1d1f' : entry.color, lineHeight: 1.6, fontFamily: 'inherit' }}
                >
                  {entry.text}
                </Typography>
              ))}
            </Box>

            {/* Queue controls */}
            {rs.queue.length > 0 && (
              <>
                <Divider />
                <Box sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                    {rs.queue.length} waiting for review
                  </Typography>
                  <Button size="small" color="success" variant="outlined" sx={{ fontSize: 11, py: 0.25 }} onClick={rs.handleApproveAll}>
                    Approve All
                  </Button>
                  <Button size="small" color="error" variant="outlined" sx={{ fontSize: 11, py: 0.25 }} onClick={rs.handleRejectAll}>
                    Reject All
                  </Button>
                </Box>
              </>
            )}

            {/* Auto-approve toggle */}
            <Divider />
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
                label={<Typography variant="caption">Auto-approve (skip review queue)</Typography>}
                sx={{ m: 0 }}
              />
            </Box>
          </Paper>
        )}

        {/* FAB toggle button */}
        <Tooltip title={rs.trayExpanded ? 'Minimize tray' : 'Random Search tray'}>
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
              <CircularProgress
                size={48}
                sx={{ position: 'absolute', color: 'rgba(255,255,255,0.5)' }}
              />
            )}
            <Badge badgeContent={rs.queue.length || 0} color="warning" max={99}>
              <SmartIcon />
            </Badge>
          </Box>
        </Tooltip>
      </Box>

      {/* Snackbar fallback when Notification API not available */}
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
