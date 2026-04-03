import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, Tooltip, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Pagination,
  CircularProgress, Alert, Stack, Divider, Switch, FormControlLabel,
  InputAdornment, TableSortLabel, Link, Avatar, Checkbox,
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
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxBlankIcon,
  Cancel as CancelIcon,
  CheckCircle as AcceptIcon,
  Close as RejectIcon,
  Pending as PendingIcon,
  AutoAwesome as SmartSearchIcon,
  PushPin as PinIcon,
  PushPinOutlined as UnpinIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Score as ScoreIcon,
  EditNote as ManualIcon,
  TableChart as ExcelIcon,
  Psychology as SmartSearchAddedIcon,
} from '@mui/icons-material';
import SmartSearchModal from '../components/SmartSearchModal';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import {
  listIssues, getIssue, createIssue, updateIssue, deleteIssue, checkConflict,
  transferIssue, transferMultiple, cancelTransfer, acceptTransfer,
  rejectTransfer, getIncomingTransfers, searchUsers,
  scoreIssue, togglePin, movePriority,
} from '../api/githubIssuesApi';
import IssueImportDialog from '../components/IssueImportDialog';
import { listProfiles } from '../api/profilesApi';

const CATEGORIES = ['Python', 'JavaScript', 'TypeScript'];

const ADDED_VIA_META = {
  manual:       { label: 'Manual',       icon: <ManualIcon sx={{ fontSize: 15 }} />,          chipColor: 'default',   iconColor: 'text.secondary' },
  excel:        { label: 'Excel',        icon: <ExcelIcon sx={{ fontSize: 15 }} />,            chipColor: 'success',   iconColor: 'success.main'   },
  smart_search: { label: 'Smart Search', icon: <SmartSearchAddedIcon sx={{ fontSize: 15 }} />, chipColor: 'secondary', iconColor: 'secondary.main' },
};
const CATEGORY_COLORS = { Python: 'info', JavaScript: 'warning', TypeScript: 'primary' };
const PAGE_SIZE = 15;

const TAKEN_STATUS_COLORS = {
  open:                 'default',
  progress:             'info',
  initialized:          'success',
  progress_interaction: 'primary',
  interacted:           'secondary',
  submitted:            'warning',
  failed:               'error',
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
      if (editData) {
        const res = await updateIssue(editData.id, payload);
        onSaved(res.data.data);
        onClose();
      } else {
        const res = await createIssue(payload);
        onSaved(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save issue.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editData ? 'Edit Issue' : 'Add GitHub Issue'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Repo Name *"
            value={form.repoName}
            onChange={handleChange('repoName')}
            fullWidth size="small"
            placeholder="owner/repository"
          />
          <TextField
            label="Issue Link *"
            value={form.issueLink}
            onChange={handleChange('issueLink')}
            fullWidth size="small"
            placeholder="https://github.com/owner/repo/issues/123"
          />
          <TextField
            label="Issue Title *"
            value={form.issueTitle}
            onChange={handleChange('issueTitle')}
            fullWidth size="small"
          />
          <TextField
            label="Base SHA *"
            value={form.baseSha}
            onChange={handleChange('baseSha')}
            fullWidth size="small"
            placeholder="e.g. abc1234"
          />
          <FormControl fullWidth size="small" required>
            <InputLabel>Repo Category *</InputLabel>
            <Select
              value={form.repoCategory}
              onChange={handleChange('repoCategory')}
              label="Repo Category *"
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="PR Link"
            value={form.prLink}
            onChange={handleChange('prLink')}
            fullWidth size="small"
            placeholder="https://github.com/owner/repo/pull/456 (optional)"
          />
          <TextField
            label="Files Changed"
            value={form.filesChanged}
            onChange={handleChange('filesChanged')}
            fullWidth size="small"
            placeholder="Comma-separated file paths (optional)"
            helperText="e.g. src/index.js, lib/utils.py"
          />
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={<Switch checked={form.shared} onChange={handleChange('shared')} />}
              label="Shared (visible to others)"
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select value={form.takenStatus} onChange={handleChange('takenStatus')} label="Status">
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="progress">Progress</MenuItem>
                <MenuItem value="initialized">Initialized</MenuItem>
                <MenuItem value="interacted">Interacted</MenuItem>
                <MenuItem value="submitted">Submitted</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {editData && (
            <>
              <Divider>
                <Typography variant="caption" color="text.secondary">Workflow Data</Typography>
              </Divider>
              <TextField
                label="Initial Result Directory"
                value={form.initialResultDir}
                onChange={handleChange('initialResultDir')}
                fullWidth size="small"
                placeholder="e.g. 2025-03-30-14-22"
                helperText="Set by PR Preparation app when issue is initialized"
              />
              <TextField
                label="Upload File Name"
                value={form.uploadFileName}
                onChange={handleChange('uploadFileName')}
                fullWidth size="small"
                placeholder="e.g. 2025-03-30-14-22.zip"
                helperText="Zip filename uploaded to the file server"
              />
              <TextField
                label="Task UUID"
                value={form.taskUuid}
                onChange={handleChange('taskUuid')}
                fullWidth size="small"
                placeholder="e.g. a1b2c3d4-..."
                helperText="Set by PR Interaction app when interaction is complete"
              />
            </>
          )}

          <Divider><Typography variant="caption" color="text.secondary">Profile</Typography></Divider>
          <FormControl fullWidth size="small">
            <InputLabel>Assign Profile (optional)</InputLabel>
            <Select
              value={form.profile}
              onChange={handleChange('profile')}
              label="Assign Profile (optional)"
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {profiles.map(p => (
                <MenuItem key={p.id} value={p.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={p.pictureUrl || undefined} sx={{ width: 22, height: 22, fontSize: 11, bgcolor: 'primary.main' }}>
                      {!p.pictureUrl && p.name?.[0]?.toUpperCase()}
                    </Avatar>
                    <span>{p.name}</span>
                    {p.nationality && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        · {p.nationality}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider><Typography variant="caption" color="text.secondary">Notes</Typography></Divider>
          <TextField
            label="Comment"
            value={form.comment}
            onChange={handleChange('comment')}
            fullWidth size="small"
            multiline rows={2}
            placeholder="Optional notes or remarks about this issue"
          />
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

function ConflictDialog({ open, onClose, conflicts, issueLink }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ConflictIcon color="warning" />
        Conflict Check
      </DialogTitle>
      <DialogContent dividers>
        {conflicts.length === 0 ? (
          <Alert severity="success">No conflicts found — this issue link is unique to you.</Alert>
        ) : (
          <Stack spacing={1.5}>
            <Alert severity="warning">
              {conflicts.length} other user{conflicts.length > 1 ? 's' : ''} already have this issue.
            </Alert>
            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
              {issueLink}
            </Typography>
            {conflicts.map((c, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box>
                    <Typography variant="body2" fontWeight={700}>@{c.username}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.displayName}</Typography>
                  </Box>
                  <Box sx={{ ml: 'auto' }}>
                    <Chip
                      label={TAKEN_STATUS_LABELS[c.takenStatus] || 'Open'}
                      size="small"
                      color={TAKEN_STATUS_COLORS[c.takenStatus] || 'default'}
                    />
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function IssueDetailDialog({ open, onClose, issue, currentUserId, onEdit, onDelete, onCheckConflict }) {
  if (!issue) return null;

  const isOwner = issue.posterId?.id === currentUserId || issue.posterId?._id === currentUserId;

  const field = (label, value) => (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Box>
  );

  const startDt   = issue.startDatetime ? new Date(issue.startDatetime) : null;
  const endDt     = issue.endDatetime   ? new Date(issue.endDatetime)   : null;
  const durationMs = startDt && endDt ? endDt - startDt : null;

  const scoreColor = issue.score == null ? 'default'
    : issue.score >= 75 ? 'success'
    : issue.score >= 50 ? 'warning'
    : 'error';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <GitHubIcon />
        <Typography variant="h6" sx={{ flexGrow: 1, mr: 1 }}>{issue.issueTitle}</Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {issue.pinned && <Chip icon={<PinIcon sx={{ fontSize: 14 }} />} label="Pinned" size="small" color="secondary" />}
          <Chip label={issue.repoCategory} color={CATEGORY_COLORS[issue.repoCategory] || 'default'} size="small" />
          {issue.shared && <Chip label="Shared" size="small" color="success" variant="outlined" />}
          <Chip
            label={TAKEN_STATUS_LABELS[issue.takenStatus] || issue.takenStatus}
            size="small"
            color={TAKEN_STATUS_COLORS[issue.takenStatus] || 'default'}
            variant="outlined"
            icon={['progress','progress_interaction'].includes(issue.takenStatus)
              ? <CircularProgress size={10} sx={{ ml: '4px !important' }} />
              : undefined}
          />
          {issue.score != null && (
            <Chip label={`Score: ${issue.score}`} size="small" color={scoreColor} variant="outlined" />
          )}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {/* Core fields */}
          {field('Repo Name', issue.repoName)}

          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">Issue Link</Typography>
            <Link href={issue.issueLink} target="_blank" rel="noopener noreferrer" variant="body2">
              {issue.issueLink} <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
            </Link>
          </Box>

          {issue.prLink && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">PR Link</Typography>
              <Link href={issue.prLink} target="_blank" rel="noopener noreferrer" variant="body2">
                {issue.prLink} <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
              </Link>
            </Box>
          )}

          {field('Base SHA', issue.baseSha)}

          {issue.filesChanged?.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                Files Changed ({issue.filesChanged.length})
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                {issue.filesChanged.map((f, i) => (
                  <Chip key={i} label={f} size="small" variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}

          {/* Workflow data */}
          {(issue.initialResultDir || issue.uploadFileName || issue.taskUuid) && (
            <>
              <Divider><Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Workflow Data</Typography></Divider>
              {issue.initialResultDir && field('Initial Result Directory', issue.initialResultDir)}
              {issue.uploadFileName   && field('Upload File Name', issue.uploadFileName)}
              {issue.taskUuid         && field('Task UUID', issue.taskUuid)}
            </>
          )}

          {/* Timing */}
          <Divider><Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Timing</Typography></Divider>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {field('Started', startDt ? startDt.toLocaleString() : '—')}
            {field('Finished', endDt ? endDt.toLocaleString() : '—')}
            {durationMs != null && field('Duration', fmtDuration(durationMs))}
          </Stack>

          {/* Comment */}
          {issue.comment && (
            <>
              <Divider><Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes</Typography></Divider>
              <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{issue.comment}</Typography>
              </Box>
            </>
          )}

          {/* Meta */}
          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {field('Posted by', `@${issue.posterId?.username || '?'} (${issue.posterId?.displayName || ''})`)}
            {field('Added', issue.createdAt ? new Date(issue.createdAt).toLocaleString() : '—')}
            {field('Last updated', issue.updatedAt ? new Date(issue.updatedAt).toLocaleString() : '—')}
          </Stack>
          {(() => {
            const meta = ADDED_VIA_META[issue.addedVia] || ADDED_VIA_META.manual;
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Source</Typography>
                <Chip icon={meta.icon} label={meta.label} size="small" color={meta.chipColor} variant="outlined" />
              </Box>
            );
          })()}
          {issue.priority !== 0 && field('Priority', issue.priority)}
          {issue.profile && (
            <>
              <Divider><Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Profile</Typography></Divider>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar src={issue.profile.pictureUrl || undefined} sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14 }}>
                  {!issue.profile.pictureUrl && issue.profile.name?.[0]?.toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{issue.profile.name}</Typography>
                  {issue.profile.nationality && (
                    <Typography variant="caption" color="text.secondary">{issue.profile.nationality}</Typography>
                  )}
                  {issue.profile.expertEmail && (
                    <Typography variant="caption" color="text.secondary" display="block">{issue.profile.expertEmail}</Typography>
                  )}
                </Box>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button startIcon={<ConflictIcon />} color="warning" onClick={() => onCheckConflict(issue)}>
          Check Conflicts
        </Button>
        <Box sx={{ flex: 1 }} />
        {isOwner && (
          <>
            <Button startIcon={<EditIcon />} onClick={() => { onClose(); onEdit(issue); }}>Edit</Button>
            <Button startIcon={<DeleteIcon />} color="error" onClick={() => { onClose(); onDelete(issue); }}>Delete</Button>
          </>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteConfirmDialog({ open, onClose, onConfirm, issue, deleting }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Issue?</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete <strong>{issue?.issueTitle}</strong>? This cannot be undone.
        </Typography>
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

// issues: single issue object OR array of issue objects
function TransferDialog({ open, onClose, issues, onTransferred }) {
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState([]);
  const [searching,    setSearching]    = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [error,        setError]        = useState('');

  const issueList = Array.isArray(issues) ? issues : issues ? [issues] : [];
  const isMulti   = issueList.length > 1;

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setSelectedUser(null); setError(''); }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchUsers(query);
        setResults(res.data.data);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const handleTransfer = async () => {
    if (!selectedUser) return;
    setTransferring(true);
    setError('');
    const toUserId = selectedUser._id || selectedUser.id;
    try {
      if (isMulti) {
        const res = await transferMultiple({ ids: issueList.map((i) => i.id), toUserId });
        onTransferred(res.data.data); // array of updated issues
      } else {
        const res = await transferIssue({ id: issueList[0].id, toUserId });
        onTransferred([res.data.data]);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate transfer.');
    } finally {
      setTransferring(false);
    }
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
            The recipient must <strong>accept</strong> before ownership transfers. You can cancel anytime before they accept.
          </Alert>
          {isMulti ? (
            <Typography variant="body2" color="text.secondary">
              Sending transfer request for <strong>{issueList.length} issues</strong> to:
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Sending transfer request for <strong>{issueList[0]?.issueTitle}</strong> to:
            </Typography>
          )}
          <TextField
            label="Search user by username"
            size="small" fullWidth
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedUser(null); }}
            InputProps={{ endAdornment: searching ? <CircularProgress size={16} /> : null }}
          />
          {results.length > 0 && !selectedUser && (
            <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
              {results.map((u, i) => (
                <React.Fragment key={u._id || u.id}>
                  {i > 0 && <Divider />}
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => { setSelectedUser(u); setQuery(u.username); setResults([]); }}
                  >
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
            <Alert severity="success" icon={false}>
              → <strong>@{selectedUser.username}</strong>
              {selectedUser.displayName ? ` (${selectedUser.displayName})` : ''}
            </Alert>
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

export default function GithubIssues() {
  const { user } = useAuth();
  const location = useLocation();
  const openedNotifRef = useRef(null);

  // Table state
  const [issues, setIssues]   = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Filters
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('');
  const [sharedFilter, setSharedFilter]       = useState('');
  const [takenStatusFilter, setTakenStatusFilter] = useState('');

  // Sort
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir]     = useState('desc');

  // Pagination
  const [page, setPage] = useState(1);

  // Dialogs
  const [formOpen, setFormOpen]             = useState(false);
  const [editData, setEditData]             = useState(null);
  const [detailIssue, setDetailIssue]       = useState(null);
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [deleting, setDeleting]             = useState(false);
  const [conflictOpen, setConflictOpen]     = useState(false);
  const [conflictData, setConflictData]     = useState({ conflicts: [], issueLink: '' });
  const [conflictLoading, setConflictLoading] = useState(false);
  const [importOpen,        setImportOpen]        = useState(false);
  const [smartSearchOpen,   setSmartSearchOpen]   = useState(false);
  const [smartSearchTab,    setSmartSearchTab]    = useState(0);
  const [transferIssues,    setTransferIssues]    = useState(null); // array of issues to transfer
  const [selectedIds,       setSelectedIds]       = useState(new Set());
  const [incomingTransfers, setIncomingTransfers] = useState([]);
  const [cancellingId,      setCancellingId]      = useState(null);
  const [acceptingId,       setAcceptingId]       = useState(null);
  const [rejectingId,       setRejectingId]       = useState(null);
  const [scoringId,         setScoringId]         = useState(null);
  const [pinningId,         setPinningId]         = useState(null);
  const [priorityId,        setPriorityId]        = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listIssues({
        search,
        category:     category || undefined,
        shared:       sharedFilter !== '' ? sharedFilter : undefined,
        takenStatus:  takenStatusFilter !== '' ? takenStatusFilter : undefined,
        sortField,
        sortDir,
        page,
        limit: PAGE_SIZE,
      });
      setIssues(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load issues.');
    } finally {
      setLoading(false);
    }
  }, [search, category, sharedFilter, takenStatusFilter, sortField, sortDir, page]);

  useEffect(() => { load(); }, [load]);

  // Auto-open issue from notification click (location.state.openIssueId)
  useEffect(() => {
    const openId = location.state?.openIssueId;
    if (!openId || openedNotifRef.current === openId) return;
    openedNotifRef.current = openId;
    getIssue(openId)
      .then((res) => { if (res.data?.data) setDetailIssue(res.data.data); })
      .catch(() => {});
  }, [location.state]);

  // Auto-open SmartSearch modal from tray navigate button
  useEffect(() => {
    if (location.state?.openSmartSearch) {
      setSmartSearchTab(location.state.initialTab ?? 0);
      setSmartSearchOpen(true);
    }
  }, [location.state]);

  // Load incoming transfer requests
  useEffect(() => {
    getIncomingTransfers()
      .then((res) => setIncomingTransfers(res.data.data))
      .catch(() => {});
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, category, sharedFilter, takenStatusFilter, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleSaved = (issue) => {
    setIssues((prev) => {
      const idx = prev.findIndex((i) => i.id === issue.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = issue;
        return next;
      }
      return [issue, ...prev];
    });
    setTotal((t) => (editData ? t : t + 1));
    setEditData(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteIssue(deleteTarget.id);
      setIssues((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setTotal((t) => t - 1);
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete issue.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => { setEditData(null); setFormOpen(true); };
  const openEdit   = (issue) => { setEditData(issue); setFormOpen(true); };

  const handleTransferred = (updatedList) => {
    const map = Object.fromEntries(updatedList.map((u) => [u.id, u]));
    setIssues((prev) => prev.map((i) => map[i.id] || i));
    setSelectedIds(new Set());
  };

  const handleCancelTransfer = async (id) => {
    setCancellingId(id);
    try {
      const res = await cancelTransfer(id);
      setIssues((prev) => prev.map((i) => (i.id === res.data.data.id ? res.data.data : i)));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel transfer.');
    } finally { setCancellingId(null); }
  };

  const handleAcceptTransfer = async (id) => {
    setAcceptingId(id);
    try {
      const res = await acceptTransfer(id);
      const updated = res.data.data;
      setIncomingTransfers((prev) => prev.filter((i) => i.id !== id));
      setIssues((prev) => {
        const idx = prev.findIndex((i) => i.id === id);
        return idx >= 0 ? prev.map((i) => (i.id === id ? updated : i)) : [updated, ...prev];
      });
      setTotal((t) => t + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept transfer.');
    } finally { setAcceptingId(null); }
  };

  const handleRejectTransfer = async (id) => {
    setRejectingId(id);
    try {
      await rejectTransfer(id);
      setIncomingTransfers((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject transfer.');
    } finally { setRejectingId(null); }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCheckConflict = async (issue) => {
    setConflictLoading(true);
    setConflictData({ conflicts: [], issueLink: issue.issueLink });
    setConflictOpen(true);
    try {
      const res = await checkConflict({ id: issue.id });
      setConflictData({ conflicts: res.data.conflicts, issueLink: issue.issueLink });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check conflicts.');
      setConflictOpen(false);
    } finally {
      setConflictLoading(false);
    }
  };

  const handleScore = async (issue, e) => {
    e.stopPropagation();
    setScoringId(issue.id);
    try {
      const res = await scoreIssue(issue.id);
      const updated = res.data.data;
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      if (detailIssue?.id === updated.id) setDetailIssue(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to score issue.');
    } finally { setScoringId(null); }
  };

  const handleTogglePin = async (issue, e) => {
    e.stopPropagation();
    setPinningId(issue.id);
    try {
      const res = await togglePin(issue.id);
      const updated = res.data.data;
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      if (detailIssue?.id === updated.id) setDetailIssue(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle pin.');
    } finally { setPinningId(null); }
  };

  const handleMovePriority = async (issue, delta, e) => {
    e.stopPropagation();
    setPriorityId(issue.id);
    try {
      const res = await movePriority(issue.id, delta);
      const updated = res.data.data;
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update priority.');
    } finally { setPriorityId(null); }
  };

  const sortLabel = (field, label) => (
    <TableSortLabel
      active={sortField === field}
      direction={sortField === field ? sortDir : 'asc'}
      onClick={() => handleSort(field)}
    >
      {label}
    </TableSortLabel>
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isOwner = (issue) =>
    issue.posterId?.id === user?._id || issue.posterId?.id === user?.id;
  const ownedSelected = issues.filter((i) => selectedIds.has(i.id) && isOwner(i));
  const allOwnedSelected = ownedSelected.length > 0 && ownedSelected.length === issues.filter((i) => isOwner(i)).length;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <GitHubIcon sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
          GitHub Issues
        </Typography>
        {ownedSelected.length > 0 && (
          <Button
            variant="contained" color="warning"
            startIcon={<TransferIcon />}
            onClick={() => setTransferIssues(ownedSelected)}
          >
            Transfer {ownedSelected.length} Selected
          </Button>
        )}
        <Button
          variant="outlined" color="secondary"
          startIcon={<SmartSearchIcon />}
          onClick={() => setSmartSearchOpen(true)}
        >
          Smart Search
        </Button>
        <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setImportOpen(true)}>
          Import Excel
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add Issue
        </Button>
      </Box>

      {/* Incoming transfer requests */}
      {incomingTransfers.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2, overflow: 'hidden', borderColor: 'warning.light' }}>
          <Box sx={{ px: 2.5, py: 1.25, bgcolor: 'warning.50', borderBottom: '1px solid', borderColor: 'warning.light', display: 'flex', alignItems: 'center', gap: 1 }}>
            <PendingIcon color="warning" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={700} color="warning.dark">
              Incoming Transfer Requests ({incomingTransfers.length})
            </Typography>
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
                    onClick={() => handleAcceptTransfer(issue.id)}>
                    Accept
                  </Button>
                  <Button size="small" variant="outlined" color="error"
                    startIcon={rejectingId === issue.id ? <CircularProgress size={14} /> : <RejectIcon />}
                    disabled={acceptingId === issue.id || rejectingId === issue.id}
                    onClick={() => handleRejectTransfer(issue.id)}>
                    Reject
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Search repo or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')}><ClearIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} label="Category">
              <MenuItem value="">All</MenuItem>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Shared</InputLabel>
            <Select value={sharedFilter} onChange={(e) => setSharedFilter(e.target.value)} label="Shared">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Shared</MenuItem>
              <MenuItem value="false">Private</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={takenStatusFilter} onChange={(e) => setTakenStatusFilter(e.target.value)} label="Status">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="progress">Progress</MenuItem>
              <MenuItem value="initialized">Initialized</MenuItem>
              <MenuItem value="interacted">Interacted</MenuItem>
              <MenuItem value="submitted">Submitted</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {total} issue{total !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Table */}
      <TableContainer component={Paper} sx={{ mb: 2, width: '100%' }}>
        <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 40 }} />    {/* checkbox */}
            <col style={{ width: 24 }} />    {/* pin */}
            <col style={{ width: '15%' }} /> {/* repo */}
            <col style={{ width: '13%' }} /> {/* title — fixed, ~half of old auto size */}
            <col style={{ width: 78 }} />    {/* category */}
            <col style={{ width: 36 }} />    {/* pr */}
            <col style={{ width: 58 }} />    {/* shared */}
            <col style={{ width: 105 }} />   {/* status */}
            <col style={{ width: 52 }} />    {/* score */}
            <col style={{ width: 78 }} />    {/* posted by */}
            <col style={{ width: 72 }} />    {/* date */}
            <col style={{ width: 36 }} />    {/* source */}
            <col style={{ width: 116 }} />   {/* actions */}
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Tooltip title={allOwnedSelected ? 'Deselect all' : 'Select all owned'}>
                  <Checkbox
                    size="small"
                    checked={allOwnedSelected}
                    indeterminate={ownedSelected.length > 0 && !allOwnedSelected}
                    onChange={() => {
                      const owned = issues.filter((i) => isOwner(i)).map((i) => i.id);
                      if (allOwnedSelected) setSelectedIds(new Set());
                      else setSelectedIds(new Set(owned));
                    }}
                  />
                </Tooltip>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.5 }}>{sortLabel('pinned', '📌')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>{sortLabel('repoName', 'Repo')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>{sortLabel('issueTitle', 'Issue Title')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>{sortLabel('repoCategory', 'Cat.')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.5 }}>PR</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.5 }}>{sortLabel('shared', 'Share')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>{sortLabel('takenStatus', 'Status')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.5 }}>{sortLabel('score', 'Score')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>By</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.75 }}>{sortLabel('createdAt', 'Date')}</TableCell>
              <TableCell sx={{ fontWeight: 700, px: 0.5 }}>
                <Tooltip title="Source (how added)"><span>Src</span></Tooltip>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, px: 0.75 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={13} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : issues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No issues found.
                </TableCell>
              </TableRow>
            ) : (
              issues.map((issue) => (
                <TableRow
                  key={issue.id}
                  hover
                  selected={selectedIds.has(issue.id)}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setDetailIssue(issue)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    {isOwner(issue) && (
                      <Checkbox size="small" checked={selectedIds.has(issue.id)} onChange={() => toggleSelect(issue.id)} />
                    )}
                  </TableCell>
                  {/* Pin indicator */}
                  <TableCell sx={{ p: 0.5 }}>
                    {issue.pinned && <PinIcon sx={{ fontSize: 13, color: 'secondary.main' }} />}
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Typography variant="caption" fontWeight={600} noWrap display="block">
                      {issue.repoName}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
                      <Typography variant="caption" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                        {issue.issueTitle}
                      </Typography>
                      {issue.issueLink && (
                        <Tooltip title="Open GitHub issue">
                          <IconButton
                            size="small"
                            component="a"
                            href={issue.issueLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            sx={{ p: 0.125, flexShrink: 0, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                          >
                            <OpenInNewIcon sx={{ fontSize: 11 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Chip
                      label={issue.repoCategory}
                      color={CATEGORY_COLORS[issue.repoCategory] || 'default'}
                      size="small"
                      sx={{ fontSize: 10, height: 18 }}
                    />
                  </TableCell>
                  <TableCell sx={{ px: 0.5, py: 0.5 }}>
                    {issue.prLink ? (
                      <Chip label="Yes" size="small" color="success" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ px: 0.5, py: 0.5 }}>
                    <Chip
                      label={issue.shared ? 'Yes' : 'No'}
                      size="small"
                      color={issue.shared ? 'success' : 'default'}
                      variant={issue.shared ? 'filled' : 'outlined'}
                      sx={{ fontSize: 10, height: 18 }}
                    />
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={TAKEN_STATUS_LABELS[issue.takenStatus] || issue.takenStatus}
                        size="small"
                        color={TAKEN_STATUS_COLORS[issue.takenStatus] || 'default'}
                        variant={issue.takenStatus === 'open' ? 'outlined' : 'filled'}
                        sx={{ fontSize: 10, height: 18 }}
                      />
                      {['progress', 'progress_interaction'].includes(issue.takenStatus) && (
                        <CircularProgress size={10} />
                      )}
                      {issue.pendingTransfer?.toUserId && (
                        <Tooltip title={`Pending → @${issue.pendingTransfer.toUsername}`}>
                          <PendingIcon sx={{ fontSize: 13, color: 'warning.main' }} />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  {/* Score */}
                  <TableCell sx={{ px: 0.5, py: 0.5 }}>
                    {issue.score != null ? (
                      <Chip
                        label={issue.score}
                        size="small"
                        color={issue.score >= 75 ? 'success' : issue.score >= 50 ? 'warning' : 'error'}
                        variant="outlined"
                        sx={{ fontSize: 10, height: 18 }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Typography variant="caption" noWrap display="block">
                      @{issue.posterId?.username || '?'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ px: 0.75, py: 0.5 }}>
                    <Typography variant="caption" noWrap display="block">
                      {new Date(issue.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ px: 0.5, py: 0.5 }}>
                    {(() => {
                      const meta = ADDED_VIA_META[issue.addedVia] || ADDED_VIA_META.manual;
                      return (
                        <Tooltip title={meta.label}>
                          <Box sx={{ display: 'inline-flex', color: meta.iconColor }}>
                            {meta.icon}
                          </Box>
                        </Tooltip>
                      );
                    })()}
                  </TableCell>
                  <TableCell align="right" sx={{ px: 0.5, py: 0.25 }} onClick={(e) => e.stopPropagation()}>
                    {isOwner(issue) && (
                      <Stack direction="row" spacing={0} justifyContent="flex-end" alignItems="center">
                        {/* Score */}
                        <Tooltip title={issue.score != null ? `Score: ${issue.score} — recalculate` : 'Calculate score'}>
                          <span>
                            <IconButton size="small" color="info"
                              disabled={scoringId === issue.id}
                              onClick={(e) => handleScore(issue, e)}>
                              {scoringId === issue.id
                                ? <CircularProgress size={14} />
                                : <ScoreIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        {/* Pin */}
                        <Tooltip title={issue.pinned ? 'Unpin' : 'Pin to top'}>
                          <span>
                            <IconButton size="small" color={issue.pinned ? 'secondary' : 'default'}
                              disabled={pinningId === issue.id}
                              onClick={(e) => handleTogglePin(issue, e)}>
                              {pinningId === issue.id
                                ? <CircularProgress size={14} />
                                : issue.pinned ? <PinIcon fontSize="small" /> : <UnpinIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        {/* Priority up/down */}
                        <Tooltip title="Increase priority">
                          <span>
                            <IconButton size="small"
                              disabled={priorityId === issue.id}
                              onClick={(e) => handleMovePriority(issue, 1, e)}>
                              {priorityId === issue.id
                                ? <CircularProgress size={14} />
                                : <ArrowUpIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Decrease priority">
                          <span>
                            <IconButton size="small"
                              disabled={priorityId === issue.id}
                              onClick={(e) => handleMovePriority(issue, -1, e)}>
                              <ArrowDownIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        {/* Transfer / cancel transfer */}
                        {issue.pendingTransfer?.toUserId ? (
                          <Tooltip title="Cancel pending transfer">
                            <span>
                              <IconButton size="small" color="warning"
                                disabled={cancellingId === issue.id}
                                onClick={(e) => { e.stopPropagation(); handleCancelTransfer(issue.id); }}>
                                {cancellingId === issue.id
                                  ? <CircularProgress size={14} />
                                  : <CancelIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Transfer ownership">
                            <IconButton size="small" color="warning"
                              onClick={(e) => { e.stopPropagation(); setTransferIssues([issue]); }}>
                              <TransferIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(issue); }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(issue); }}>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, v) => setPage(v)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Dialogs */}
      <IssueFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null); }}
        onSaved={handleSaved}
        editData={editData}
      />

      <IssueDetailDialog
        open={Boolean(detailIssue)}
        onClose={() => setDetailIssue(null)}
        issue={detailIssue}
        currentUserId={user?._id || user?.id}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onCheckConflict={handleCheckConflict}
      />

      <ConflictDialog
        open={conflictOpen}
        onClose={() => setConflictOpen(false)}
        conflicts={conflictLoading ? [] : conflictData.conflicts}
        issueLink={conflictData.issueLink}
      />

      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        issue={deleteTarget}
        deleting={deleting}
      />

      <TransferDialog
        open={Boolean(transferIssues)}
        onClose={() => setTransferIssues(null)}
        issues={transferIssues}
        onTransferred={handleTransferred}
      />

      <IssueImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(count) => {
          setTotal((t) => t + count);
          load();
        }}
      />

      <SmartSearchModal
        open={smartSearchOpen}
        onClose={() => setSmartSearchOpen(false)}
        onImported={load}
        initialTab={smartSearchTab}
      />
    </Container>
  );
}
