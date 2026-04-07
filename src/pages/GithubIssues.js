import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, Tooltip, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Pagination,
  CircularProgress, Alert, Stack, Divider, Switch, FormControlLabel,
  InputAdornment, TableSortLabel, Link, Avatar, Checkbox,
  Radio, RadioGroup, Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  GitHub as GitHubIcon,
  OpenInNew as OpenInNewIcon,
  WarningAmber as ConflictIcon,
  Upload as UploadIcon,
  SwapHoriz as TransferIcon,
  Cancel as CancelIcon,
  CheckCircle as AcceptIcon,
  Close as RejectIcon,
  Pending as PendingIcon,
  AutoAwesome as SmartSearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Score as ScoreIcon,
  EditNote as ManualIcon,
  TableChart as ExcelIcon,
  Psychology as SmartSearchAddedIcon,
  Settings as SettingsIcon,
  SwapVert as SmartStatusIcon,
} from '@mui/icons-material';
import SmartSearchModal from '../components/SmartSearchModal';
import { useAuth } from '../context/AuthContext';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  listIssues, getIssue, createIssue, updateIssue, deleteIssue, checkConflict,
  transferIssue, transferMultiple, cancelTransfer, acceptTransfer,
  rejectTransfer, getIncomingTransfers, searchUsers,
  scoreIssue, togglePin, bulkStatusChange,
} from '../api/githubIssuesApi';
import IssueImportDialog from '../components/IssueImportDialog';
import { listProfiles } from '../api/profilesApi';

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['PY', 'JS', 'TS'];
const PAGE_SIZE_OPTIONS = ['10', '15', '20', '25', '50', '100', '200', '500'];
const DEFAULT_PAGE_SIZE = 15;
const VIEW_MODE_KEY = 'gh_issues_view_mode';

const ADDED_VIA_META = {
  manual:       { label: 'Manual',       icon: <ManualIcon sx={{ fontSize: 15 }} />,          chipColor: 'default',   iconColor: 'text.secondary' },
  excel:        { label: 'Excel',        icon: <ExcelIcon sx={{ fontSize: 15 }} />,            chipColor: 'success',   iconColor: 'success.main'   },
  smart_search: { label: 'Smart Search', icon: <SmartSearchAddedIcon sx={{ fontSize: 15 }} />, chipColor: 'secondary', iconColor: 'secondary.main' },
};
const CATEGORY_COLORS = { PY: 'info', JS: 'warning', TS: 'primary' };

// Custom distinct status colors — solid fills for clear visual differentiation
const STATUS_CHIP_SX = {
  open:                 { bgcolor: '#e0e0e0', color: '#424242' },
  progress:             { bgcolor: '#1565c0', color: '#fff' },
  initialized:          { bgcolor: '#2e7d32', color: '#fff' },
  progress_interaction: { bgcolor: '#6a1b9a', color: '#fff' },
  interacted:           { bgcolor: '#006064', color: '#fff' },
  submitted:            { bgcolor: '#e65100', color: '#fff' },
  failed:               { bgcolor: '#b71c1c', color: '#fff' },
};
const TAKEN_STATUS_LABELS = {
  open:                 'Open',
  progress:             'In Progress',
  initialized:          'Initialized',
  progress_interaction: 'Interacting',
  interacted:           'Interacted',
  submitted:            'Submitted',
  failed:               'Failed',
};

const ALL_STATUSES = Object.keys(TAKEN_STATUS_LABELS);

// ── StatusChip ────────────────────────────────────────────────────────────────
function StatusChip({ status, size = 'small', extraSx }) {
  return (
    <Chip
      label={TAKEN_STATUS_LABELS[status] || status}
      size={size}
      sx={{ fontSize: 10, height: 18, fontWeight: 600, ...(STATUS_CHIP_SX[status] || {}), ...extraSx }}
    />
  );
}

// ── Helper ───────────────────────────────────────────────────────────────────

function fmtDuration(ms) {
  if (!ms || ms < 0) return null;
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── PaginationBar ─────────────────────────────────────────────────────────────

function PaginationBar({ page, totalPages, pageSize, total, onPageChange, onPageSizeChange }) {
  const [jumpInput, setJumpInput] = useState('');

  const handleJump = () => {
    const n = parseInt(jumpInput, 10);
    if (n >= 1 && n <= totalPages) { onPageChange(n); setJumpInput(''); }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 0.75 }}>
      <Pagination
        count={totalPages} page={page}
        onChange={(_e, v) => onPageChange(v)}
        color="primary" showFirstButton showLastButton size="small"
      />
      {/* Jump to page */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Go to:</Typography>
        <TextField
          size="small" type="number" value={jumpInput}
          onChange={e => setJumpInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJump()}
          sx={{ width: 64 }}
          inputProps={{ min: 1, max: totalPages, style: { padding: '3px 8px' } }}
          placeholder={String(totalPages)}
        />
        <Button size="small" onClick={handleJump} variant="outlined"
          sx={{ minWidth: 'unset', px: 1.5, py: 0.25, fontSize: 12 }}>
          Go
        </Button>
      </Box>
      {/* Per page */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Per page:</Typography>
        <Autocomplete
          freeSolo disableClearable size="small"
          options={PAGE_SIZE_OPTIONS}
          value={String(pageSize)}
          onChange={(_, v) => { const n = parseInt(v, 10); if (n > 0) onPageSizeChange(n); }}
          onInputChange={(_, v) => { const n = parseInt(v, 10); if (n > 0) onPageSizeChange(n); }}
          renderInput={(params) => <TextField {...params} sx={{ width: 72 }} inputProps={{ ...params.inputProps, style: { padding: '3px 8px' } }} />}
          sx={{ '& .MuiAutocomplete-input': { p: '3px 8px !important' } }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
        {total} issue{total !== 1 ? 's' : ''}
      </Typography>
    </Box>
  );
}

// ── SmartStatusChangeDialog ───────────────────────────────────────────────────

function SmartStatusChangeDialog({ open, onClose, selectedCount, onApply }) {
  const [toStatus, setToStatus] = useState('open');
  const [applying, setApplying] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { if (open) { setToStatus('open'); setError(''); } }, [open]);

  const handleApply = async () => {
    setApplying(true); setError('');
    try { await onApply(toStatus); onClose(); }
    catch (err) { setError(err?.response?.data?.message || 'Failed to change status.'); }
    finally { setApplying(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SmartStatusIcon /> Smart Status Change
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2">
            Change <strong>{selectedCount}</strong> selected issue{selectedCount !== 1 ? 's' : ''} to:
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>New Status</InputLabel>
            <Select value={toStatus} onChange={e => setToStatus(e.target.value)} label="New Status">
              {ALL_STATUSES.map(k => (
                <MenuItem key={k} value={k}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StatusChip status={k} />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Alert severity="info" sx={{ py: 0.5 }}>
            Only your own issues will be updated. Issues you don't own are skipped.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={applying}>Cancel</Button>
        <Button variant="contained" onClick={handleApply} disabled={applying}
          startIcon={applying ? <CircularProgress size={16} /> : <SmartStatusIcon />}>
          Apply to {selectedCount}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── IssueSettingsModal ────────────────────────────────────────────────────────

function IssueSettingsModal({ open, onClose, viewMode, onViewModeChange }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon /> Issue List Settings
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>View Mode</Typography>
        <RadioGroup value={viewMode} onChange={e => onViewModeChange(e.target.value)}>
          <FormControlLabel value="pagination" control={<Radio size="small" />} label={
            <Box>
              <Typography variant="body2" fontWeight={600}>Pagination</Typography>
              <Typography variant="caption" color="text.secondary">
                Navigate between pages. URL reflects current page and filters.
              </Typography>
            </Box>
          } sx={{ mb: 1 }} />
          <FormControlLabel value="scroll" control={<Radio size="small" />} label={
            <Box>
              <Typography variant="body2" fontWeight={600}>Infinite Scroll</Typography>
              <Typography variant="caption" color="text.secondary">
                Issues load continuously as you scroll down. Great for browsing.
              </Typography>
            </Box>
          } />
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── IssueFormDialog ───────────────────────────────────────────────────────────

const EMPTY_FORM = {
  repoName: '', issueLink: '', issueTitle: '', prLink: '',
  filesChanged: '', baseSha: '', shared: false, takenStatus: 'open', repoCategory: '',
  initialResultDir: '', uploadFileName: '', taskUuid: '', comment: '', profile: '',
};

function IssueFormDialog({ open, onClose, onSaved, editData }) {
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    if (!open) return;
    listProfiles().then(res => setProfiles(res.data.data || [])).catch(() => {});
    if (editData) {
      setForm({
        repoName:         editData.repoName || '',
        issueLink:        editData.issueLink || '',
        issueTitle:       editData.issueTitle || '',
        prLink:           editData.prLink || '',
        filesChanged:     Array.isArray(editData.filesChanged) ? editData.filesChanged.join(', ') : '',
        baseSha:          editData.baseSha || '',
        shared:           Boolean(editData.shared),
        takenStatus:      editData.takenStatus || 'open',
        repoCategory:     editData.repoCategory || '',
        initialResultDir: editData.initialResultDir || '',
        uploadFileName:   editData.uploadFileName || '',
        taskUuid:         editData.taskUuid || '',
        comment:          editData.comment || '',
        profile:          editData.profile?.id || editData.profile || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError('');
  }, [open, editData]);

  const handleChange = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
  };

  const handleSubmit = async () => {
    setError('');
    const payload = {
      repoName:         form.repoName.trim(),
      issueLink:        form.issueLink.trim(),
      issueTitle:       form.issueTitle.trim(),
      prLink:           form.prLink.trim() || null,
      filesChanged:     form.filesChanged.split(',').map((s) => s.trim()).filter(Boolean),
      baseSha:          form.baseSha.trim(),
      shared:           form.shared,
      takenStatus:      form.takenStatus,
      repoCategory:     form.repoCategory,
      initialResultDir: form.initialResultDir.trim() || null,
      uploadFileName:   form.uploadFileName.trim() || null,
      taskUuid:         form.taskUuid.trim() || null,
      comment:          form.comment.trim() || null,
      profile:          form.profile || null,
    };
    if (!payload.repoName || !payload.issueLink || !payload.issueTitle || !payload.baseSha || !payload.repoCategory) {
      setError('Repo name, issue link, issue title, base SHA, and category are required.');
      return;
    }
    setSaving(true);
    try {
      if (editData) { const res = await updateIssue(editData.id, payload); onSaved(res.data.data); }
      else { const res = await createIssue(payload); onSaved(res.data.data); }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save issue.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editData ? 'Edit Issue' : 'Add GitHub Issue'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Repo Name *" value={form.repoName} onChange={handleChange('repoName')} fullWidth size="small" placeholder="owner/repository" />
          <TextField label="Issue Link *" value={form.issueLink} onChange={handleChange('issueLink')} fullWidth size="small" placeholder="https://github.com/owner/repo/issues/123" />
          <TextField label="Issue Title *" value={form.issueTitle} onChange={handleChange('issueTitle')} fullWidth size="small" />
          <TextField label="Base SHA *" value={form.baseSha} onChange={handleChange('baseSha')} fullWidth size="small" placeholder="e.g. abc1234" />
          <FormControl fullWidth size="small" required>
            <InputLabel>Repo Category *</InputLabel>
            <Select value={form.repoCategory} onChange={handleChange('repoCategory')} label="Repo Category *">
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="PR Link" value={form.prLink} onChange={handleChange('prLink')} fullWidth size="small" placeholder="https://github.com/owner/repo/pull/456 (optional)" />
          <TextField label="Files Changed" value={form.filesChanged} onChange={handleChange('filesChanged')} fullWidth size="small" placeholder="Comma-separated file paths (optional)" helperText="e.g. src/index.js, lib/utils.py" />
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel control={<Switch checked={form.shared} onChange={handleChange('shared')} />} label="Shared (visible to others)" />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select value={form.takenStatus} onChange={handleChange('takenStatus')} label="Status">
                {ALL_STATUSES.map(k => <MenuItem key={k} value={k}>{TAKEN_STATUS_LABELS[k]}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          {editData && (
            <>
              <Divider><Typography variant="caption" color="text.secondary">Workflow Data</Typography></Divider>
              <TextField label="Initial Result Directory" value={form.initialResultDir} onChange={handleChange('initialResultDir')} fullWidth size="small" placeholder="e.g. 2025-03-30-14-22" helperText="Set by PR Preparation app when issue is initialized" />
              <TextField label="Upload File Name" value={form.uploadFileName} onChange={handleChange('uploadFileName')} fullWidth size="small" placeholder="e.g. 2025-03-30-14-22.zip" helperText="Zip filename uploaded to the file server" />
              <TextField label="Task UUID" value={form.taskUuid} onChange={handleChange('taskUuid')} fullWidth size="small" placeholder="e.g. a1b2c3d4-..." helperText="Set by PR Interaction app when interaction is complete" />
            </>
          )}
          <Divider><Typography variant="caption" color="text.secondary">Profile</Typography></Divider>
          <FormControl fullWidth size="small">
            <InputLabel>Assign Profile (optional)</InputLabel>
            <Select value={form.profile} onChange={handleChange('profile')} label="Assign Profile (optional)">
              <MenuItem value=""><em>None</em></MenuItem>
              {profiles.map(p => (
                <MenuItem key={p.id} value={p.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={p.pictureUrl || undefined} sx={{ width: 22, height: 22, fontSize: 11, bgcolor: 'primary.main' }}>
                      {!p.pictureUrl && p.name?.[0]?.toUpperCase()}
                    </Avatar>
                    <span>{p.name}</span>
                    {p.nationality && <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>· {p.nationality}</Typography>}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Divider><Typography variant="caption" color="text.secondary">Notes</Typography></Divider>
          <TextField label="Comment" value={form.comment} onChange={handleChange('comment')} fullWidth size="small" multiline rows={2} placeholder="Optional notes or remarks about this issue" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          {saving ? <CircularProgress size={18} /> : editData ? 'Save Changes' : 'Add Issue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── ConflictDialog ────────────────────────────────────────────────────────────

function ConflictDialog({ open, onClose, conflicts, issueLink }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ConflictIcon color="warning" /> Conflict Check
      </DialogTitle>
      <DialogContent dividers>
        {conflicts.length === 0 ? (
          <Alert severity="success">No conflicts found — this issue link is unique to you.</Alert>
        ) : (
          <Stack spacing={1.5}>
            <Alert severity="warning">{conflicts.length} other user{conflicts.length > 1 ? 's' : ''} already have this issue.</Alert>
            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{issueLink}</Typography>
            {conflicts.map((c, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box>
                    <Typography variant="body2" fontWeight={700}>@{c.username}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.displayName}</Typography>
                  </Box>
                  <Box sx={{ ml: 'auto' }}>
                    <StatusChip status={c.takenStatus || 'open'} />
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

// ── IssueDetailDialog ─────────────────────────────────────────────────────────

function DetailField({ label, children }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 0.3 }}>
        {label}
      </Typography>
      {typeof children === 'string' || typeof children === 'number'
        ? <Typography variant="body2">{children || '—'}</Typography>
        : children || <Typography variant="body2" color="text.disabled">—</Typography>}
    </Box>
  );
}

function IssueDetailDialog({ open, onClose, issue, currentUserId, onEdit, onDelete, onCheckConflict }) {
  if (!issue) return null;
  const isOwner  = issue.posterId?.id === currentUserId || issue.posterId?._id === currentUserId;
  const startDt  = issue.startDatetime ? new Date(issue.startDatetime) : null;
  const endDt    = issue.endDatetime   ? new Date(issue.endDatetime)   : null;
  const durMs    = startDt && endDt ? endDt - startDt : null;
  const statusBg = STATUS_CHIP_SX[issue.takenStatus]?.bgcolor || '#e0e0e0';
  const scoreColor = issue.score == null ? undefined : issue.score >= 75 ? '#2e7d32' : issue.score >= 50 ? '#e65100' : '#b71c1c';
  const meta = ADDED_VIA_META[issue.addedVia] || ADDED_VIA_META.manual;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}>
      {/* Colored status banner */}
      <Box sx={{ bgcolor: statusBg, px: 3, pt: 2.5, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <GitHubIcon sx={{ color: '#fff', mt: 0.3, fontSize: 22 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#fff', lineHeight: 1.3, wordBreak: 'break-word' }}>
              {issue.issueTitle}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.3, display: 'block' }}>
              {issue.repoName}
            </Typography>
          </Box>
          {issue.issueLink && (
            <Tooltip title="Open on GitHub">
              <IconButton component="a" href={issue.issueLink} target="_blank" rel="noopener noreferrer"
                size="small" sx={{ color: 'rgba(255,255,255,0.85)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' } }}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {/* Chips row */}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.25 }}>
          <StatusChip status={issue.takenStatus} extraSx={{ height: 20, fontSize: 11, border: '1px solid rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }} />
          <Chip label={issue.repoCategory} size="small" color={CATEGORY_COLORS[issue.repoCategory] || 'default'}
            sx={{ height: 20, fontSize: 11 }} />
          {issue.pinned && (
            <Chip icon={<StarIcon sx={{ fontSize: 13 }} />} label="Favorite" size="small"
              sx={{ height: 20, fontSize: 11, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
          )}
          {issue.shared && (
            <Chip label="Shared" size="small"
              sx={{ height: 20, fontSize: 11, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }} />
          )}
          {issue.score != null && (
            <Chip label={`Score: ${issue.score}`} size="small"
              sx={{ height: 20, fontSize: 11, bgcolor: '#fff', color: scoreColor || '#424242', fontWeight: 700 }} />
          )}
          {['progress', 'progress_interaction'].includes(issue.takenStatus) && (
            <CircularProgress size={14} sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.3 }} />
          )}
        </Box>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        <Stack divider={<Divider />}>

          {/* Links */}
          <Box sx={{ px: 3, py: 2 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1 }}>Links</Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 72, fontWeight: 600 }}>Issue</Typography>
                <Link href={issue.issueLink} target="_blank" rel="noopener noreferrer" variant="body2"
                  sx={{ wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  {issue.issueLink} <OpenInNewIcon sx={{ fontSize: 11 }} />
                </Link>
              </Box>
              {issue.prLink && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 72, fontWeight: 600 }}>PR</Typography>
                  <Link href={issue.prLink} target="_blank" rel="noopener noreferrer" variant="body2"
                    sx={{ wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 0.4 }}>
                    {issue.prLink} <OpenInNewIcon sx={{ fontSize: 11 }} />
                  </Link>
                </Box>
              )}
            </Stack>
          </Box>

          {/* Details grid */}
          <Box sx={{ px: 3, py: 2 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1 }}>Details</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1.5 }}>
              <DetailField label="Base SHA">
                <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', px: 1, py: 0.25, borderRadius: 0.75, display: 'inline-block', fontSize: 12 }}>
                  {issue.baseSha || '—'}
                </Typography>
              </DetailField>
              <DetailField label="Source">
                <Chip icon={meta.icon} label={meta.label} size="small" color={meta.chipColor} variant="outlined" sx={{ fontSize: 11 }} />
              </DetailField>
              <DetailField label="Posted by">
                <Typography variant="body2">@{issue.posterId?.username || '?'}{issue.posterId?.displayName ? ` · ${issue.posterId.displayName}` : ''}</Typography>
              </DetailField>
              <DetailField label="Added">{issue.createdAt ? new Date(issue.createdAt).toLocaleString() : '—'}</DetailField>
            </Box>
          </Box>

          {/* Files changed */}
          {issue.filesChanged?.length > 0 && (
            <Box sx={{ px: 3, py: 2 }}>
              <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1 }}>
                Files Changed ({issue.filesChanged.length})
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1.5 }}>
                {issue.filesChanged.map((f, i) => (
                  <Chip key={i} label={f} size="small" variant="outlined"
                    sx={{ fontSize: 11, fontFamily: 'monospace', maxWidth: 360, '.MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                ))}
              </Stack>
            </Box>
          )}

          {/* Timing */}
          <Box sx={{ px: 3, py: 2 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1 }}>Timing</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mt: 1.5 }}>
              <DetailField label="Started">{startDt ? startDt.toLocaleString() : '—'}</DetailField>
              <DetailField label="Finished">{endDt ? endDt.toLocaleString() : '—'}</DetailField>
              <DetailField label="Duration">{durMs != null ? fmtDuration(durMs) : '—'}</DetailField>
            </Box>
          </Box>

          {/* Workflow data */}
          {(issue.initialResultDir || issue.uploadFileName || issue.taskUuid) && (
            <Box sx={{ px: 3, py: 2 }}>
              <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1 }}>Workflow Data</Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                {issue.initialResultDir && (
                  <DetailField label="Initial Result Directory">
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{issue.initialResultDir}</Typography>
                  </DetailField>
                )}
                {issue.uploadFileName && (
                  <DetailField label="Upload File Name">
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{issue.uploadFileName}</Typography>
                  </DetailField>
                )}
                {issue.taskUuid && (
                  <DetailField label="Task UUID">
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{issue.taskUuid}</Typography>
                  </DetailField>
                )}
              </Stack>
            </Box>
          )}

          {/* Comment */}
          {issue.comment && (
            <Box sx={{ px: 3, py: 2 }}>
              <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1 }}>Notes</Typography>
              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5, borderLeft: '3px solid', borderColor: 'primary.main' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{issue.comment}</Typography>
              </Box>
            </Box>
          )}

          {/* Profile */}
          {issue.profile && (
            <Box sx={{ px: 3, py: 2 }}>
              <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1 }}>Assigned Profile</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                <Avatar src={issue.profile.pictureUrl || undefined}
                  sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontSize: 18, fontWeight: 700 }}>
                  {!issue.profile.pictureUrl && issue.profile.name?.[0]?.toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body1" fontWeight={700}>{issue.profile.name}</Typography>
                  {issue.profile.nationality && (
                    <Typography variant="caption" color="text.secondary" display="block">{issue.profile.nationality}</Typography>
                  )}
                  {issue.profile.expertEmail && (
                    <Typography variant="caption" color="text.secondary" display="block">{issue.profile.expertEmail}</Typography>
                  )}
                </Box>
              </Box>
            </Box>
          )}

        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Button startIcon={<ConflictIcon />} color="warning" size="small" onClick={() => onCheckConflict(issue)}>
          Check Conflicts
        </Button>
        <Box sx={{ flex: 1 }} />
        {isOwner && (
          <>
            <Button startIcon={<EditIcon />} size="small" onClick={() => { onClose(); onEdit(issue); }}>Edit</Button>
            <Button startIcon={<DeleteIcon />} color="error" size="small" onClick={() => { onClose(); onDelete(issue); }}>Delete</Button>
          </>
        )}
        <Button variant="outlined" size="small" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── DeleteConfirmDialog ───────────────────────────────────────────────────────

function DeleteConfirmDialog({ open, onClose, onConfirm, issue, deleting }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Issue?</DialogTitle>
      <DialogContent>
        <Typography>Are you sure you want to delete <strong>{issue?.issueTitle}</strong>? This cannot be undone.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>Cancel</Button>
        <Button variant="contained" color="error" onClick={onConfirm} disabled={deleting}>
          {deleting ? <CircularProgress size={18} /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── TransferDialog ────────────────────────────────────────────────────────────

function TransferDialog({ open, onClose, issues, onTransferred }) {
  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState([]);
  const [searching, setSearching]       = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [error, setError]               = useState('');
  const issueList = Array.isArray(issues) ? issues : issues ? [issues] : [];
  const isMulti   = issueList.length > 1;

  useEffect(() => { if (!open) { setQuery(''); setResults([]); setSelectedUser(null); setError(''); } }, [open]);
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { const res = await searchUsers(query); setResults(res.data.data); }
      catch { setResults([]); } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const handleTransfer = async () => {
    if (!selectedUser) return;
    setTransferring(true); setError('');
    const toUserId = selectedUser._id || selectedUser.id;
    try {
      if (isMulti) {
        const res = await transferMultiple({ ids: issueList.map((i) => i.id), toUserId });
        onTransferred(res.data.data);
      } else {
        const res = await transferIssue({ id: issueList[0].id, toUserId });
        onTransferred([res.data.data]);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate transfer.');
    } finally { setTransferring(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TransferIcon />
        {isMulti ? `Transfer ${issueList.length} Issues` : 'Transfer Issue'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="info" icon={<PendingIcon />} sx={{ py: 0.5 }}>
            The recipient must <strong>accept</strong> before ownership transfers. You can cancel anytime.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            {isMulti ? `Sending transfer for ${issueList.length} issues to:` : `Sending transfer for "${issueList[0]?.issueTitle}" to:`}
          </Typography>
          <TextField
            label="Search user" size="small" fullWidth value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedUser(null); }}
            InputProps={{ endAdornment: searching ? <CircularProgress size={16} /> : null }}
          />
          {results.length > 0 && !selectedUser && (
            <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
              {results.map((u, i) => (
                <React.Fragment key={u._id || u.id}>
                  {i > 0 && <Divider />}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => { setSelectedUser(u); setQuery(u.username); setResults([]); }}>
                    <Avatar src={u.avatarUrl} sx={{ width: 28, height: 28, fontSize: 12 }}>
                      {(u.displayName || u.username || '?')[0].toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>@{u.username}</Typography>
                      {u.displayName && <Typography variant="caption" color="text.secondary">{u.displayName}</Typography>}
                    </Box>
                  </Box>
                </React.Fragment>
              ))}
            </Paper>
          )}
          {selectedUser && (
            <Alert severity="success" icon={false}>→ <strong>@{selectedUser.username}</strong>{selectedUser.displayName ? ` (${selectedUser.displayName})` : ''}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={transferring}>Cancel</Button>
        <Button variant="contained" color="warning"
          startIcon={transferring ? <CircularProgress size={16} /> : <TransferIcon />}
          onClick={handleTransfer} disabled={!selectedUser || transferring}>
          Send Transfer Request
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GithubIssues() {
  const { user }    = useAuth();
  const location    = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── View mode (persisted in localStorage) ───────────────────────────────
  const [viewMode, setViewModeState] = useState(
    () => localStorage.getItem(VIEW_MODE_KEY) || 'pagination'
  );
  const setViewMode = (m) => { setViewModeState(m); localStorage.setItem(VIEW_MODE_KEY, m); };
  const isPagination = viewMode === 'pagination';

  // ── Filters & pagination state — initialised from URL ───────────────────
  const [search,            setSearch]            = useState(searchParams.get('q')      || '');
  const [category,          setCategory]          = useState(searchParams.get('cat')    || '');
  const [sharedFilter,      setSharedFilter]      = useState(searchParams.get('shared') || '');
  const [takenStatusFilter, setTakenStatusFilter] = useState(searchParams.get('status') || '');
  const [sortField,         setSortField]         = useState(searchParams.get('sort')   || 'createdAt');
  const [sortDir,           setSortDir]           = useState(searchParams.get('dir')    || 'desc');
  const [page,              setPage]              = useState(parseInt(searchParams.get('page')  || '1', 10));
  const [pageSize,          setPageSize]          = useState(parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10));

  // ── Data ─────────────────────────────────────────────────────────────────
  const [issues,  setIssues]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // ── Infinite scroll ───────────────────────────────────────────────────────
  const [hasMore,         setHasMore]  = useState(true);
  const scrollPageRef                  = useRef(1);
  const isScrollLoadingRef             = useRef(false);
  const sentinelRef                    = useRef(null);

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [formOpen,           setFormOpen]          = useState(false);
  const [editData,           setEditData]          = useState(null);
  const [detailIssue,        setDetailIssue]       = useState(null);
  const [deleteTarget,       setDeleteTarget]      = useState(null);
  const [deleting,           setDeleting]          = useState(false);
  const [conflictOpen,       setConflictOpen]      = useState(false);
  const [conflictData,       setConflictData]      = useState({ conflicts: [], issueLink: '' });
  const [conflictLoading,    setConflictLoading]   = useState(false);
  const [importOpen,         setImportOpen]        = useState(false);
  const [smartSearchOpen,    setSmartSearchOpen]   = useState(false);
  const [smartSearchTab,     setSmartSearchTab]    = useState(0);
  const [transferIssues,     setTransferIssues]    = useState(null);
  const [settingsOpen,       setSettingsOpen]      = useState(false);
  const [smartStatusOpen,    setSmartStatusOpen]   = useState(false);
  const [incomingTransfers,  setIncomingTransfers] = useState([]);
  const openedNotifRef                             = useRef(null);

  // ── Selection ─────────────────────────────────────────────────────────────
  // selectedIds persists across page changes so you can select across pages
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ── Action loading states ─────────────────────────────────────────────────
  const [cancellingId,   setCancellingId]   = useState(null);
  const [acceptingId,    setAcceptingId]    = useState(null);
  const [rejectingId,    setRejectingId]    = useState(null);
  const [scoringId,      setScoringId]      = useState(null);
  const [pinningId,      setPinningId]      = useState(null);
  const [scoringAll,     setScoringAll]     = useState(false);
  const [acceptingAll,   setAcceptingAll]   = useState(false);
  const [rejectingAll,   setRejectingAll]   = useState(false);

  // ── URL sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPagination) return; // don't pollute URL in scroll mode
    const params = {};
    if (search)            params.q      = search;
    if (category)          params.cat    = category;
    if (sharedFilter)      params.shared = sharedFilter;
    if (takenStatusFilter) params.status = takenStatusFilter;
    if (sortField !== 'createdAt') params.sort = sortField;
    if (sortDir   !== 'desc')      params.dir  = sortDir;
    if (page > 1)          params.page   = String(page);
    if (pageSize !== DEFAULT_PAGE_SIZE) params.limit = String(pageSize);
    setSearchParams(params, { replace: true });
  }, [search, category, sharedFilter, takenStatusFilter, sortField, sortDir, page, pageSize, isPagination, setSearchParams]);

  // ── Reset page to 1 when filters/sort/pageSize change ─────────────────────
  useEffect(() => { if (isPagination) setPage(1); }, [search, category, sharedFilter, takenStatusFilter, sortField, sortDir, pageSize, isPagination]);

  // ── Pagination load ───────────────────────────────────────────────────────
  const loadPage = useCallback(async () => {
    if (!isPagination) return;
    setLoading(true); setError('');
    try {
      const res = await listIssues({
        search, category,
        shared:      sharedFilter      !== '' ? sharedFilter      : undefined,
        takenStatus: takenStatusFilter !== '' ? takenStatusFilter : undefined,
        sortField, sortDir, page, limit: pageSize,
      });
      setIssues(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load issues.');
    } finally { setLoading(false); }
  }, [isPagination, search, category, sharedFilter, takenStatusFilter, sortField, sortDir, page, pageSize]);

  useEffect(() => { loadPage(); }, [loadPage]);

  // ── Infinite scroll load ──────────────────────────────────────────────────
  const loadScrollMore = useCallback(async (reset = false) => {
    if (isPagination) return;
    if (isScrollLoadingRef.current) return;
    if (!reset && !hasMore) return;
    isScrollLoadingRef.current = true;
    const p = reset ? 1 : scrollPageRef.current;
    if (reset) { scrollPageRef.current = 1; setHasMore(true); setIssues([]); }
    setLoading(true); setError('');
    try {
      const res = await listIssues({
        search, category,
        shared:      sharedFilter      !== '' ? sharedFilter      : undefined,
        takenStatus: takenStatusFilter !== '' ? takenStatusFilter : undefined,
        sortField, sortDir, page: p, limit: pageSize,
      });
      const newData = res.data.data;
      setIssues(prev => reset ? newData : [...prev, ...newData]);
      setTotal(res.data.total);
      const more = newData.length >= pageSize;
      setHasMore(more);
      if (more) scrollPageRef.current = p + 1;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load issues.');
    } finally { setLoading(false); isScrollLoadingRef.current = false; }
  }, [isPagination, search, category, sharedFilter, takenStatusFilter, sortField, sortDir, pageSize, hasMore]);

  // Reset scroll list when filters/sort/pageSize change
  useEffect(() => {
    if (!isPagination) {
      scrollPageRef.current = 1;
      setHasMore(true);
      isScrollLoadingRef.current = false;
      setIssues([]);
      loadScrollMore(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPagination, search, category, sharedFilter, takenStatusFilter, sortField, sortDir, pageSize]);

  // IntersectionObserver sentinel
  useEffect(() => {
    if (isPagination) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isScrollLoadingRef.current && hasMore) {
          loadScrollMore(false);
        }
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isPagination, hasMore, loadScrollMore]);

  // Switch viewMode: reload from scratch
  useEffect(() => {
    if (isPagination) { loadPage(); }
    else { scrollPageRef.current = 1; setHasMore(true); isScrollLoadingRef.current = false; setIssues([]); loadScrollMore(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // ── Notification / smart search auto-open ────────────────────────────────
  useEffect(() => {
    const openId = location.state?.openIssueId;
    if (!openId || openedNotifRef.current === openId) return;
    openedNotifRef.current = openId;
    getIssue(openId).then((res) => { if (res.data?.data) setDetailIssue(res.data.data); }).catch(() => {});
  }, [location.state]);

  useEffect(() => {
    if (location.state?.openSmartSearch) {
      setSmartSearchTab(location.state.initialTab ?? 0);
      setSmartSearchOpen(true);
    }
  }, [location.state]);

  // ── Incoming transfers ────────────────────────────────────────────────────
  useEffect(() => {
    getIncomingTransfers().then((res) => setIncomingTransfers(res.data.data)).catch(() => {});
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const reload = () => isPagination ? loadPage() : loadScrollMore(true);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleSaved = (issue) => {
    setIssues(prev => {
      const idx = prev.findIndex(i => i.id === issue.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = issue; return next; }
      return [issue, ...prev];
    });
    setTotal(t => editData ? t : t + 1);
    setEditData(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteIssue(deleteTarget.id);
      setIssues(prev => prev.filter(i => i.id !== deleteTarget.id));
      setTotal(t => t - 1);
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete issue.');
      setDeleteTarget(null);
    } finally { setDeleting(false); }
  };

  const handleTransferred = (updatedList) => {
    const map = Object.fromEntries(updatedList.map(u => [u.id, u]));
    setIssues(prev => prev.map(i => map[i.id] || i));
    setSelectedIds(new Set());
  };

  const handleCancelTransfer = async (id) => {
    setCancellingId(id);
    try { const res = await cancelTransfer(id); setIssues(prev => prev.map(i => i.id === res.data.data.id ? res.data.data : i)); }
    catch (err) { setError(err.response?.data?.message || 'Failed to cancel transfer.'); }
    finally { setCancellingId(null); }
  };

  const handleAcceptTransfer = async (id) => {
    setAcceptingId(id);
    try {
      const res = await acceptTransfer(id);
      const updated = res.data.data;
      setIncomingTransfers(prev => prev.filter(i => i.id !== id));
      setIssues(prev => {
        const idx = prev.findIndex(i => i.id === id);
        return idx >= 0 ? prev.map(i => i.id === id ? updated : i) : [updated, ...prev];
      });
      setTotal(t => t + 1);
    } catch (err) { setError(err.response?.data?.message || 'Failed to accept transfer.'); }
    finally { setAcceptingId(null); }
  };

  const handleRejectTransfer = async (id) => {
    setRejectingId(id);
    try { await rejectTransfer(id); setIncomingTransfers(prev => prev.filter(i => i.id !== id)); }
    catch (err) { setError(err.response?.data?.message || 'Failed to reject transfer.'); }
    finally { setRejectingId(null); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleCheckConflict = async (issue) => {
    setConflictLoading(true);
    setConflictData({ conflicts: [], issueLink: issue.issueLink });
    setConflictOpen(true);
    try { const res = await checkConflict({ id: issue.id }); setConflictData({ conflicts: res.data.conflicts, issueLink: issue.issueLink }); }
    catch (err) { setError(err.response?.data?.message || 'Failed to check conflicts.'); setConflictOpen(false); }
    finally { setConflictLoading(false); }
  };

  const handleScore = async (issue, e) => {
    e.stopPropagation(); setScoringId(issue.id);
    try { const res = await scoreIssue(issue.id); const u = res.data.data; setIssues(prev => prev.map(i => i.id === u.id ? u : i)); if (detailIssue?.id === u.id) setDetailIssue(u); }
    catch (err) { setError(err.response?.data?.message || 'Failed to score issue.'); }
    finally { setScoringId(null); }
  };

  const handleTogglePin = async (issue, e) => {
    e.stopPropagation(); setPinningId(issue.id);
    try { const res = await togglePin(issue.id); const u = res.data.data; setIssues(prev => prev.map(i => i.id === u.id ? u : i)); if (detailIssue?.id === u.id) setDetailIssue(u); }
    catch (err) { setError(err.response?.data?.message || 'Failed to toggle pin.'); }
    finally { setPinningId(null); }
  };

  const handleScoreSelected = async () => {
    setScoringAll(true);
    try {
      const ids = [...selectedIds];
      const results = await Promise.all(ids.map(id => scoreIssue(id).then(r => r.data.data).catch(() => null)));
      const updated = results.filter(Boolean);
      setIssues(prev => prev.map(i => { const u = updated.find(u => u.id === i.id); return u || i; }));
      setSelectedIds(new Set());
    } catch (err) { setError(err.response?.data?.message || 'Failed to score issues.'); }
    finally { setScoringAll(false); }
  };

  const handleAcceptAll = async () => {
    setAcceptingAll(true);
    const ids = incomingTransfers.map(i => i.id);
    const results = await Promise.allSettled(ids.map(id => acceptTransfer(id).then(r => r.data.data)));
    const accepted = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    setIncomingTransfers(prev => prev.filter(i => !ids.includes(i.id)));
    setIssues(prev => {
      let next = [...prev];
      accepted.forEach(u => {
        const idx = next.findIndex(i => i.id === u.id);
        if (idx >= 0) next[idx] = u; else next = [u, ...next];
      });
      return next;
    });
    setTotal(t => t + accepted.length);
    setAcceptingAll(false);
  };

  const handleRejectAll = async () => {
    setRejectingAll(true);
    const ids = incomingTransfers.map(i => i.id);
    await Promise.allSettled(ids.map(id => rejectTransfer(id)));
    setIncomingTransfers([]);
    setRejectingAll(false);
  };

  const handleSmartStatusChange = async (toStatus) => {
    await bulkStatusChange([...selectedIds], toStatus);
    setIssues(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, takenStatus: toStatus } : i));
    setSelectedIds(new Set());
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const sortLabel = (field, label) => (
    <TableSortLabel active={sortField === field} direction={sortField === field ? sortDir : 'asc'} onClick={() => handleSort(field)}>
      {label}
    </TableSortLabel>
  );

  const totalPages    = Math.max(1, Math.ceil(total / pageSize));
  const isOwner       = (issue) => issue.posterId?.id === user?._id || issue.posterId?.id === user?.id;
  // Owned issues visible on current page
  const ownedOnPage   = issues.filter(i => isOwner(i));
  const selectedOnPage = ownedOnPage.filter(i => selectedIds.has(i.id));
  const allOnPageSelected = selectedOnPage.length > 0 && selectedOnPage.length === ownedOnPage.length;
  // All selected (across pages) for batch actions
  const selectedCount = selectedIds.size;

  // ── Pagination bar (reused top & bottom) ─────────────────────────────────

  const paginationBar = isPagination ? (
    <PaginationBar
      page={page} totalPages={totalPages} pageSize={pageSize} total={total}
      onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
    />
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1.5, flexWrap: 'wrap' }}>
        <GitHubIcon sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>GitHub Issues</Typography>

        {/* Bulk actions — shown when issues are selected */}
        {selectedCount > 0 && (
          <Button variant="contained" color="secondary"
            startIcon={<SmartStatusIcon />}
            onClick={() => setSmartStatusOpen(true)}>
            Status: {selectedCount}
          </Button>
        )}
        {selectedCount > 0 && (
          <Button variant="contained" color="info"
            startIcon={scoringAll ? <CircularProgress size={16} color="inherit" /> : <ScoreIcon />}
            disabled={scoringAll}
            onClick={handleScoreSelected}>
            Score: {selectedCount}
          </Button>
        )}

        <Button variant="outlined" color="secondary" startIcon={<SmartSearchIcon />} onClick={() => setSmartSearchOpen(true)}>Smart Search</Button>
        <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setImportOpen(true)}>Import Excel</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditData(null); setFormOpen(true); }}>Add Issue</Button>
        <Tooltip title="Settings">
          <IconButton onClick={() => setSettingsOpen(true)}><SettingsIcon /></IconButton>
        </Tooltip>
      </Box>

      {/* Incoming transfer requests */}
      {incomingTransfers.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2, overflow: 'hidden', borderColor: 'warning.light' }}>
          <Box sx={{ px: 2.5, py: 1.25, bgcolor: 'warning.50', borderBottom: '1px solid', borderColor: 'warning.light', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <PendingIcon color="warning" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={700} color="warning.dark" sx={{ flex: 1 }}>
              Incoming Transfer Requests ({incomingTransfers.length})
            </Typography>
            <Button size="small" variant="contained" color="success"
              startIcon={acceptingAll ? <CircularProgress size={12} color="inherit" /> : <AcceptIcon />}
              disabled={acceptingAll || rejectingAll}
              onClick={handleAcceptAll}>Accept All</Button>
            <Button size="small" variant="outlined" color="error"
              startIcon={rejectingAll ? <CircularProgress size={12} color="inherit" /> : <RejectIcon />}
              disabled={acceptingAll || rejectingAll}
              onClick={handleRejectAll}>Reject All</Button>
          </Box>
          <Stack divider={<Divider />}>
            {incomingTransfers.map((issue) => (
              <Box key={issue.id} sx={{ display: 'flex', alignItems: 'center', px: 2.5, py: 1.5, gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{issue.issueTitle}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    from <strong>@{issue.posterId?.username}</strong> · {issue.repoName} · {new Date(issue.pendingTransfer?.requestedAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="contained" color="success"
                    startIcon={acceptingId === issue.id ? <CircularProgress size={14} /> : <AcceptIcon />}
                    disabled={acceptingId === issue.id || rejectingId === issue.id}
                    onClick={() => handleAcceptTransfer(issue.id)}>Accept</Button>
                  <Button size="small" variant="outlined" color="error"
                    startIcon={rejectingId === issue.id ? <CircularProgress size={14} /> : <RejectIcon />}
                    disabled={acceptingId === issue.id || rejectingId === issue.id}
                    onClick={() => handleRejectTransfer(issue.id)}>Reject</Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 1.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small" placeholder="Search repo or title…" value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')}><ClearIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Category</InputLabel>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} label="Category">
              <MenuItem value="">All</MenuItem>
              {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Shared</InputLabel>
            <Select value={sharedFilter} onChange={(e) => setSharedFilter(e.target.value)} label="Shared">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Shared</MenuItem>
              <MenuItem value="false">Private</MenuItem>
            </Select>
          </FormControl>
          {/* req 7: all statuses in filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={takenStatusFilter} onChange={(e) => setTakenStatusFilter(e.target.value)} label="Status">
              <MenuItem value="">All</MenuItem>
              {ALL_STATUSES.map(k => (
                <MenuItem key={k} value={k}>
                  <StatusChip status={k} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedCount > 0 && (
            <Chip label={`${selectedCount} selected`} onDelete={() => setSelectedIds(new Set())}
              color="primary" size="small" />
          )}
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="caption" color="text.secondary">{total} issue{total !== 1 ? 's' : ''}</Typography>
          </Box>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Pagination — TOP */}
      {isPagination && (
        <Paper sx={{ px: 2, py: 0.5, mb: 1 }}>{paginationBar}</Paper>
      )}

      {/* Table */}
      <TableContainer component={Paper} sx={{ width: '100%' }}>
        <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 40 }} />
            <col style={{ width: 24 }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: 78 }} />
            <col style={{ width: 36 }} />
            <col style={{ width: 58 }} />
            <col style={{ width: 105 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 78 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 36 }} />
            <col style={{ width: 116 }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Tooltip title={allOnPageSelected ? 'Deselect page' : 'Select page'}>
                  <Checkbox
                    size="small"
                    checked={allOnPageSelected}
                    indeterminate={selectedOnPage.length > 0 && !allOnPageSelected}
                    onChange={() => {
                      const ids = ownedOnPage.map(i => i.id);
                      if (allOnPageSelected) setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
                      else setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
                    }}
                  />
                </Tooltip>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.5 }}>{sortLabel('pinned', '★')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>{sortLabel('repoName', 'Repo')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>{sortLabel('issueTitle', 'Issue Title')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>{sortLabel('repoCategory', 'Cat.')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.5 }}>PR</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.5 }}>{sortLabel('shared', 'Share')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>{sortLabel('takenStatus', 'Status')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.5 }}>{sortLabel('score', 'Score')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>By</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>{sortLabel('createdAt', 'Date')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.5 }}><Tooltip title="Source (how added)"><span>Src</span></Tooltip></TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, px: 0.75 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && issues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : issues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} align="center" sx={{ py: 6, color: 'text.secondary' }}>No issues found.</TableCell>
              </TableRow>
            ) : (
              issues.map((issue) => (
                <TableRow key={issue.id} hover selected={selectedIds.has(issue.id)}
                  sx={{ cursor: 'pointer' }} onClick={() => setDetailIssue(issue)}>
                  <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                    {isOwner(issue) && (
                      <Checkbox size="small" checked={selectedIds.has(issue.id)} onChange={() => toggleSelect(issue.id)} />
                    )}
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    {issue.pinned && <StarIcon sx={{ fontSize: 13, color: '#f9a825' }} />}
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Typography variant="caption" fontWeight={600} noWrap display="block">{issue.repoName}</Typography>
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
                      <Typography variant="caption" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>{issue.issueTitle}</Typography>
                      {issue.issueLink && (
                        <Tooltip title="Open GitHub issue">
                          <IconButton size="small" component="a" href={issue.issueLink} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            sx={{ p: 0.125, flexShrink: 0, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                            <OpenInNewIcon sx={{ fontSize: 11 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Chip label={issue.repoCategory} color={CATEGORY_COLORS[issue.repoCategory] || 'default'} size="small" sx={{ fontSize: 10, height: 18 }} />
                  </TableCell>
                  <TableCell sx={{ px: 0.5, py: 0.5 }}>
                    {issue.prLink
                      ? <Chip label="Yes" size="small" color="success" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                      : <Typography variant="caption" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell sx={{ px: 0.5, py: 0.5 }}>
                    <Chip label={issue.shared ? 'Yes' : 'No'} size="small"
                      color={issue.shared ? 'success' : 'default'} variant={issue.shared ? 'filled' : 'outlined'}
                      sx={{ fontSize: 10, height: 18 }} />
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <StatusChip status={issue.takenStatus} />
                      {['progress', 'progress_interaction'].includes(issue.takenStatus) && <CircularProgress size={10} />}
                      {issue.pendingTransfer?.toUserId && (
                        <Tooltip title={`Pending → @${issue.pendingTransfer.toUsername}`}>
                          <PendingIcon sx={{ fontSize: 13, color: 'warning.main' }} />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ px: 0.5, py: 0.5 }}>
                    {issue.score != null
                      ? <Chip label={issue.score} size="small" color={issue.score >= 75 ? 'success' : issue.score >= 50 ? 'warning' : 'error'} variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                      : <Typography variant="caption" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Typography variant="caption" noWrap display="block">@{issue.posterId?.username || '?'}</Typography>
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Typography variant="caption" noWrap display="block">{new Date(issue.createdAt).toLocaleDateString()}</Typography>
                  </TableCell>
                  <TableCell sx={{ px: 0.5, py: 0.5 }}>
                    {(() => { const meta = ADDED_VIA_META[issue.addedVia] || ADDED_VIA_META.manual;
                      return <Tooltip title={meta.label}><Box sx={{ display: 'inline-flex', color: meta.iconColor }}>{meta.icon}</Box></Tooltip>;
                    })()}
                  </TableCell>
                  <TableCell align="right" sx={{ px: 0.5, py: 0.25 }} onClick={e => e.stopPropagation()}>
                    {isOwner(issue) && (
                      <Stack direction="row" spacing={0} justifyContent="flex-end" alignItems="center">
                        <Tooltip title={issue.score != null ? `Score: ${issue.score} — recalculate` : 'Calculate score'}>
                          <span>
                            <IconButton size="small" color="info" disabled={scoringId === issue.id} onClick={e => handleScore(issue, e)}>
                              {scoringId === issue.id ? <CircularProgress size={14} /> : <ScoreIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={issue.pinned ? 'Remove from favorites' : 'Add to favorites'}>
                          <span>
                            <IconButton size="small" disabled={pinningId === issue.id} onClick={e => handleTogglePin(issue, e)}
                              sx={{ color: issue.pinned ? '#f9a825' : 'action.disabled', '&:hover': { color: '#f9a825' } }}>
                              {pinningId === issue.id ? <CircularProgress size={14} /> : issue.pinned ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        {issue.pendingTransfer?.toUserId && (
                          <Tooltip title="Cancel pending transfer">
                            <span>
                              <IconButton size="small" color="warning" disabled={cancellingId === issue.id}
                                onClick={e => { e.stopPropagation(); handleCancelTransfer(issue.id); }}>
                                {cancellingId === issue.id ? <CircularProgress size={14} /> : <CancelIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={e => { e.stopPropagation(); setEditData(issue); setFormOpen(true); }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); setDeleteTarget(issue); }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Infinite scroll sentinel + loading indicator */}
      {!isPagination && (
        <Box ref={sentinelRef} sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
          {loading && <CircularProgress size={28} />}
          {!loading && !hasMore && issues.length > 0 && (
            <Typography variant="caption" color="text.disabled">All issues loaded ({total} total)</Typography>
          )}
        </Box>
      )}

      {/* Pagination — BOTTOM */}
      {isPagination && (
        <Paper sx={{ px: 2, py: 0.5, mt: 1 }}>{paginationBar}</Paper>
      )}

      {/* ── Dialogs ── */}
      <IssueFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditData(null); }} onSaved={handleSaved} editData={editData} />

      <IssueDetailDialog open={Boolean(detailIssue)} onClose={() => setDetailIssue(null)} issue={detailIssue}
        currentUserId={user?._id || user?.id} onEdit={issue => { setEditData(issue); setFormOpen(true); }}
        onDelete={setDeleteTarget} onCheckConflict={handleCheckConflict} />

      <ConflictDialog open={conflictOpen} onClose={() => setConflictOpen(false)}
        conflicts={conflictLoading ? [] : conflictData.conflicts} issueLink={conflictData.issueLink} />

      <DeleteConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} issue={deleteTarget} deleting={deleting} />

      <TransferDialog open={Boolean(transferIssues)} onClose={() => setTransferIssues(null)}
        issues={transferIssues} onTransferred={handleTransferred} />

      <IssueImportDialog open={importOpen} onClose={() => setImportOpen(false)}
        onImported={(count) => { setTotal(t => t + count); reload(); }} />

      <SmartSearchModal open={smartSearchOpen} onClose={() => setSmartSearchOpen(false)}
        onImported={reload} initialTab={smartSearchTab} />

      <IssueSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)}
        viewMode={viewMode} onViewModeChange={setViewMode} />

      <SmartStatusChangeDialog open={smartStatusOpen} onClose={() => setSmartStatusOpen(false)}
        selectedCount={selectedCount} onApply={handleSmartStatusChange} />
    </Container>
  );
}
