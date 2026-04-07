import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, Tooltip, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Pagination,
  CircularProgress, Alert, Stack, Divider, Switch, FormControlLabel,
  InputAdornment, TableSortLabel, Avatar, Checkbox,
  Radio, RadioGroup, Autocomplete, Collapse, Tabs, Tab,
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
  HelpOutline as HelpIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import SmartSearchModal from '../components/SmartSearchModal';
import { useAuth } from '../context/AuthContext';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  listIssues, getIssue, createIssue, updateIssue, deleteIssue, checkConflict,
  transferIssue, transferMultiple, cancelTransfer, acceptTransfer,
  rejectTransfer, getIncomingTransfers, searchUsers,
  scoreIssue, togglePin, bulkStatusChange, bulkDelete, bulkStar, fetchFromUrl,
} from '../api/githubIssuesApi';
import IssueImportDialog from '../components/IssueImportDialog';
import { listProfiles } from '../api/profilesApi';

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['Python', 'JavaScript', 'TypeScript'];
const PAGE_SIZE_OPTIONS = ['10', '15', '20', '25', '50', '100', '200', '500'];
const DEFAULT_PAGE_SIZE = 15;
const VIEW_MODE_KEY = 'gh_issues_view_mode';

const ADDED_VIA_META = {
  manual:       { label: 'Manual',       icon: <ManualIcon sx={{ fontSize: 15 }} />,          chipColor: 'default',   iconColor: 'text.secondary' },
  excel:        { label: 'Excel',        icon: <ExcelIcon sx={{ fontSize: 15 }} />,            chipColor: 'success',   iconColor: 'success.main'   },
  smart_search: { label: 'Smart Search', icon: <SmartSearchAddedIcon sx={{ fontSize: 15 }} />, chipColor: 'secondary', iconColor: 'secondary.main' },
};
const CATEGORY_COLORS = { Python: 'info', JavaScript: 'warning', TypeScript: 'primary' };

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
  const totalSeconds = Math.floor(ms / 1000);
  const years   = Math.floor(totalSeconds / 31536000);
  const months  = Math.floor((totalSeconds % 31536000) / 2592000);
  const days    = Math.floor((totalSeconds % 2592000)  / 86400);
  const hours   = Math.floor((totalSeconds % 86400)    / 3600);
  const minutes = Math.floor((totalSeconds % 3600)     / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (years)   parts.push(`${years}y`);
  if (months)  parts.push(`${months}mo`);
  if (days)    parts.push(`${days}d`);
  if (hours)   parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.length ? parts.join(' ') : '0s';
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

// ── ScoreGuideModal ───────────────────────────────────────────────────────────

// ── Score guide data ──────────────────────────────────────────────────────────

const ISSUE_SCORE_SECTIONS = [
  {
    title: 'Code Change Complexity',
    max: 35,
    color: '#1565c0',
    criteria: [
      {
        pts: 15, title: 'Files Changed', source: 'Auto-fetched from PR',
        desc: 'Number of source files modified by the linked PR.',
        why: 'More files indicate a broader, more valuable change. Mass refactors (31+ files) are penalised slightly as they are harder to review.',
        earn: '0 files → 0  |  1 → 3  |  2 → 5  |  3–5 → 9  |  6–15 → 13  |  16–30 → 15 (max)  |  31+ → 10',
      },
      {
        pts: 12, title: 'Lines Changed', source: 'Auto-fetched from PR',
        desc: 'Total lines added + deleted across all changed files.',
        why: 'Larger diffs represent more substantive work. Trivially small patches (<20 lines) score zero; very large diffs (1000+ lines) max out.',
        earn: '<20 → 0  |  20–49 → 3  |  50–149 → 6  |  150–499 → 9  |  500–999 → 11  |  1000+ → 12 (max)',
      },
      {
        pts: 8, title: 'Commit Count', source: 'Auto-fetched from PR',
        desc: 'Number of commits included in the linked PR.',
        why: 'Multiple commits signal iterative development. A single-commit PR could be a squash; 3–10 commits is the sweet spot.',
        earn: '0 → 0  |  1 → 1  |  2 → 3  |  3–5 → 5  |  6–10 → 7  |  11+ → 8 (max)',
      },
    ],
  },
  {
    title: 'Discussion & Community',
    max: 30,
    color: '#6a1b9a',
    criteria: [
      {
        pts: 10, title: 'Discussion Count', source: 'Auto-fetched from issue',
        desc: 'Number of comments on the GitHub issue.',
        why: 'Active discussion shows the issue is well-understood and engaged with. Dead-silent issues may be trivial or unclear.',
        earn: '0 → 0  |  1–2 → 3  |  3–5 → 6  |  6–10 → 8  |  11–20 → 9  |  21+ → 10 (max)',
      },
      {
        pts: 8, title: 'Discussion Depth', source: 'Auto-fetched from issue',
        desc: 'Total character count of all issue body text and comments.',
        why: 'Longer discussions contain more context and technical detail — invaluable for the PR workflow.',
        earn: '<100 → 0  |  100–499 → 2  |  500–1999 → 4  |  2000–4999 → 6  |  5000–9999 → 7  |  10000+ → 8 (max)',
      },
      {
        pts: 5, title: 'Code in Discussions', source: 'Auto-fetched from issue',
        desc: 'Percentage of discussion text that is inside code fences or inline code.',
        why: 'Code-heavy discussions show concrete technical exchange — stack traces, patches, or API examples that directly inform the solution.',
        earn: '0% → 0  |  1–4% → 1  |  5–14% → 2  |  15–29% → 3  |  30–49% → 4  |  50%+ → 5 (max)',
      },
      {
        pts: 7, title: 'Participant Count', source: 'Auto-fetched from issue',
        desc: 'Number of unique GitHub users who participated (author + commenters).',
        why: 'More participants mean broader community validation and richer context from multiple perspectives.',
        earn: '1 → 1  |  2 → 3  |  3–5 → 5  |  6–10 → 6  |  11+ → 7 (max)',
      },
    ],
  },
  {
    title: 'Issue Quality Signals',
    max: 20,
    color: '#2e7d32',
    criteria: [
      {
        pts: 8, title: 'Issue Duration', source: 'Auto-fetched from issue',
        desc: 'Time between issue opened and closed (ms). Open issues score a default 4.',
        why: 'Issues open for 1–3 months represent the ideal complexity sweet spot — long enough to need real discussion, short enough to be well-scoped.',
        earn: '<1 day → 0  |  1–6 days → 3  |  7–30 days → 6  |  31–90 days → 8 (max)  |  91–365 days → 7  |  1–2 years → 6  |  2+ years → 4  |  Still open → 4',
      },
      {
        pts: 7, title: 'Labels', source: 'Auto-fetched from issue',
        desc: 'GitHub labels applied to the issue (e.g. bug, enhancement, performance).',
        why: 'Labels reveal the nature and expected difficulty of the work. Complex/critical labels score highest; documentation or style labels score lowest.',
        earn: 'No labels → 2  |  complex/security/performance → 7 (max)  |  bug/feature/enhancement → 5  |  doc/style/typo → 0  |  easy/beginner → 1  |  Other → 3',
      },
      {
        pts: 5, title: 'Issue Title Quality', source: 'Auto-fetched from issue',
        desc: 'Length and specificity of the issue title.',
        why: 'A well-worded title (40–79 chars) concisely captures the problem. Very short titles are vague; excessively long ones are unfocused.',
        earn: '<10 chars → 0  |  10–19 → 1  |  20–39 → 3  |  40–79 → 5 (max)  |  80+ → 3',
      },
    ],
  },
  {
    title: 'Change Quality Signals',
    max: 15,
    color: '#e65100',
    criteria: [
      {
        pts: 8, title: 'Lines Balance', source: 'Auto-fetched from PR',
        desc: 'Ratio of lines added to total lines changed (additions / (additions + deletions)).',
        why: 'A balanced ratio (25–75% additions) suggests real feature work or meaningful refactoring — not a pure deletion or a pure dump of new code.',
        earn: 'No changes → 3 (default)  |  25–75% additions → 8 (max)  |  10–24% or 76–90% → 5  |  Outside 10–90% → 2',
      },
      {
        pts: 4, title: 'Test Files Present', source: 'Auto-fetched from PR',
        desc: 'Whether any of the changed files are test files (matching test patterns).',
        why: 'PRs that include tests are higher quality and safer to learn from. Detected via filename patterns: test/, .test., .spec., __test__, _test.',
        earn: 'Test file found → 4 (max)  |  No test files → 0',
      },
      {
        pts: 3, title: 'Code Spread', source: 'Auto-fetched from PR',
        desc: 'Number of distinct top-level directories touched by the PR.',
        why: 'Changes spread across 2+ directories indicate cross-cutting work — more representative of real-world complexity.',
        earn: '0 dirs → 0  |  1 dir → 1  |  2 dirs → 2  |  3+ dirs → 3 (max)',
      },
    ],
  },
];

const REPO_SCORE_SECTIONS = [
  {
    title: 'Community Traction',
    max: 28,
    color: '#1565c0',
    criteria: [
      {
        pts: 15, title: 'Stars', source: 'Auto-fetched from GitHub',
        desc: 'Total GitHub stars on the repository.',
        why: 'Stars are the primary measure of community adoption. Higher star counts mean more eyes on the code, more users, and more polish expected.',
        earn: '<1 → 0  |  1–9 → 1  |  10–49 → 3  |  50–99 → 5  |  100–499 → 7  |  500–999 → 9  |  1000–4999 → 11  |  5000–9999 → 13  |  10000+ → 15 (max)',
      },
      {
        pts: 8, title: 'Forks', source: 'Auto-fetched from GitHub',
        desc: 'Number of times the repository has been forked.',
        why: 'Forks indicate active derivative development. A healthy fork count means the codebase is actively used as a foundation.',
        earn: '0 → 0  |  1–9 → 1  |  10–49 → 3  |  50–99 → 5  |  100–499 → 6  |  500+ → 8 (max)',
      },
      {
        pts: 5, title: 'Watchers', source: 'Auto-fetched from GitHub',
        desc: 'Number of GitHub subscribers watching the repository.',
        why: 'Watchers are engaged followers who track every update — a signal of serious community interest beyond casual starring.',
        earn: '<5 → 0  |  5–19 → 1  |  20–99 → 2  |  100–499 → 3  |  500–999 → 4  |  1000+ → 5 (max)',
      },
    ],
  },
  {
    title: 'Health & Maintenance',
    max: 27,
    color: '#2e7d32',
    criteria: [
      {
        pts: 12, title: 'Recency', source: 'Auto-fetched from GitHub',
        desc: 'Days since the last push to the repository.',
        why: 'An actively maintained repo means issues are still being resolved and the codebase is evolving. Stale repos have higher risk of abandonment.',
        earn: '≤7 days → 12 (max)  |  8–30 → 11  |  31–60 → 9  |  61–90 → 7  |  91–180 → 5  |  181–365 → 3  |  366–730 → 1  |  730+ → 0',
      },
      {
        pts: 5, title: 'Not Archived', source: 'Auto-fetched from GitHub',
        desc: 'Whether the repository has been archived (read-only) on GitHub.',
        why: 'Archived repos are frozen — no more issues, PRs, or active development. They cannot produce new issues for the workflow.',
        earn: 'Not archived → 5 (max)  |  Archived → 0',
      },
      {
        pts: 5, title: 'Repository Age', source: 'Auto-fetched from GitHub',
        desc: 'Months since the repository was created.',
        why: 'Mature repos (4+ years) have well-established patterns, documentation, and codebases. Very new repos may lack conventions.',
        earn: '<6 months → 1  |  6–11 months → 2  |  12–23 months → 3  |  24–47 months → 4  |  48+ months → 5 (max)',
      },
      {
        pts: 5, title: 'Issue Health', source: 'Auto-fetched from GitHub',
        desc: 'Ratio of open issues to contributors. Measures backlog pressure.',
        why: 'A low open-issues-per-contributor ratio means the team keeps up with their backlog. Overwhelmed repos have lower maintainer responsiveness.',
        earn: '0 open issues → 4  |  ratio <5 → 5 (max)  |  <15 → 4  |  <30 → 3  |  <50 → 2  |  50+ → 1',
      },
    ],
  },
  {
    title: 'Development Activity',
    max: 20,
    color: '#6a1b9a',
    criteria: [
      {
        pts: 12, title: 'Contributors', source: 'Auto-fetched from GitHub',
        desc: 'Approximate total number of contributors (via GitHub API pagination).',
        why: 'More contributors means a more resilient project that does not depend on one person. High contributor counts also indicate a welcoming codebase.',
        earn: '1 → 0  |  2–3 → 2  |  4–5 → 4  |  6–10 → 6  |  11–20 → 8  |  21–50 → 10  |  51+ → 12 (max)',
      },
      {
        pts: 5, title: 'Network Effect', source: 'Auto-fetched from GitHub',
        desc: 'Ratio of total network forks (all downstream forks) to direct forks.',
        why: 'A high network-to-fork ratio means forks of forks exist — deep derivative ecosystems signal high real-world utility.',
        earn: 'No forks → 2 (default)  |  ratio ≥3 → 5 (max)  |  ≥2 → 4  |  ≥1.5 → 3  |  <1.5 → 2',
      },
      {
        pts: 3, title: 'Topics', source: 'Auto-fetched from GitHub',
        desc: 'Number of GitHub topic tags applied to the repository.',
        why: 'Topics show the maintainers invest in discoverability and organisation. Well-tagged repos attract more contributors.',
        earn: '0 topics → 0  |  1–2 → 1  |  3–5 → 2  |  6+ → 3 (max)',
      },
    ],
  },
  {
    title: 'Project Standards',
    max: 15,
    color: '#e65100',
    criteria: [
      {
        pts: 5, title: 'License', source: 'Auto-fetched from GitHub',
        desc: 'The open-source license declared on the repository.',
        why: 'A recognized open-source license is required for legitimate use. Permissive licenses (MIT, Apache, BSD) score highest.',
        earn: 'MIT/Apache/BSD/ISC → 5 (max)  |  GPL/LGPL/Mozilla/EUPL → 4  |  Other recognized → 3  |  No license → 0',
      },
      {
        pts: 5, title: 'Repository Size', source: 'Auto-fetched from GitHub',
        desc: 'Total size of the repository in MB (from GitHub API).',
        why: 'Very large repos (>200 MB) can be impractical for the PR workflow. Ideal repos are 5–100 MB — substantial but manageable.',
        earn: '>200 MB → 0  |  100–200 MB → 4  |  20–100 MB → 5 (max)  |  5–20 MB → 4  |  0.5–5 MB → 3  |  <0.5 MB → 1',
      },
      {
        pts: 5, title: 'Primary Language', source: 'Auto-fetched from GitHub',
        desc: 'The primary programming language of the repository.',
        why: 'Only JavaScript, TypeScript, and Python are fully supported by the PR workflow tools. Other languages score lower.',
        earn: 'JavaScript/TypeScript/Python → 5 (max)  |  Vue/Svelte/CoffeeScript/Astro → 3  |  Other known language → 2  |  Unknown → 1',
      },
    ],
  },
  {
    title: 'Engagement Depth',
    max: 10,
    color: '#00695c',
    criteria: [
      {
        pts: 5, title: 'Fork Engagement', source: 'Auto-fetched from GitHub',
        desc: 'Ratio of forks to stars (forks / stars).',
        why: 'A ratio in the 5–35% range indicates the right balance: enough people use it as a base without it being a pure template repo.',
        earn: 'No stars → 2 (default)  |  5–35% ratio → 5 (max)  |  <5% → 3  |  >35% → 2',
      },
      {
        pts: 2, title: 'Description Present', source: 'Auto-fetched from GitHub',
        desc: 'Whether the repository has a description set.',
        why: 'A description signals a maintained, discoverable project. Repos without descriptions are often personal experiments.',
        earn: 'Description present → 2 (max)  |  No description → 0',
      },
      {
        pts: 3, title: 'Homepage', source: 'Auto-fetched from GitHub',
        desc: 'Whether the repository has a homepage URL set.',
        why: 'A homepage (docs site, demo, or project page) indicates a polished, production-grade project.',
        earn: 'Homepage present → 3 (max)  |  No homepage → 0',
      },
    ],
  },
];

function ScoreBreakdownBar({ sections }) {
  return (
    <Stack direction="row" spacing={0} sx={{ borderRadius: 1, overflow: 'hidden', height: 28 }}>
      {sections.map((s, si) => (
        s.criteria.map((c, ci) => (
          <Tooltip key={`${si}-${ci}`} title={`${c.title}: ${c.pts} pts`}>
            <Box sx={{
              flex: c.pts,
              bgcolor: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default',
              opacity: 0.7 + (ci / s.criteria.length) * 0.3,
              borderRight: (si < sections.length - 1 || ci < s.criteria.length - 1) ? '1px solid rgba(255,255,255,0.25)' : 'none',
            }}>
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: 10 }}>{c.pts}</Typography>
            </Box>
          </Tooltip>
        ))
      ))}
    </Stack>
  );
}

function ScoreGuideModal({ open, onClose }) {
  const [tab, setTab] = useState(0);

  const BAND_COLORS = [
    { range: '76–100', label: 'Excellent', color: '#1b5e20' },
    { range: '51–75',  label: 'Good',      color: '#1565c0' },
    { range: '26–50',  label: 'Fair',      color: '#e65100' },
    { range: '0–25',   label: 'Poor',      color: '#b71c1c' },
  ];

  const sections = tab === 0 ? ISSUE_SCORE_SECTIONS : REPO_SCORE_SECTIONS;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { maxHeight: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <ScoreIcon color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={700}>Value Assessment Guide</Typography>
          <Typography variant="caption" color="text.secondary">
            How Issue and Repository scores (0–100) are automatically calculated on import
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><ClearIcon /></IconButton>
      </DialogTitle>
      <Divider />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Issue Assessment Score" sx={{ fontWeight: 600, fontSize: 13 }} />
        <Tab label="Repo Assessment Score"  sx={{ fontWeight: 600, fontSize: 13 }} />
      </Tabs>

      <DialogContent sx={{ px: 3, py: 2 }}>
        <Stack spacing={2}>

          {/* Overview */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50', borderColor: 'primary.200' }}>
            <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 0.75 }}>
              {tab === 0 ? 'Issue Assessment' : 'Repo Assessment'} — Overview
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              {tab === 0
                ? 'Each issue receives a score from 0 to 100 based on four dimensions of the linked PR and GitHub issue data — all auto-fetched on import. The score reflects code complexity, community engagement, issue quality, and change hygiene.'
                : 'Each repository receives a score from 0 to 100 based on five dimensions of the GitHub repo — all auto-fetched on import. The score reflects community traction, maintenance health, developer activity, project standards, and engagement depth.'}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mt: 1.5 }}>
              {BAND_COLORS.map(b => (
                <Box key={b.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: b.color }} />
                  <Typography variant="caption" fontWeight={600}>{b.range} · {b.label}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* Score breakdown bar */}
          <Box>
            <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1, display: 'block', mb: 1 }}>
              Point Breakdown — Total 100
            </Typography>
            <ScoreBreakdownBar sections={sections} />
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
              {sections.map(s => (
                <Box key={s.title} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: s.color }} />
                  <Typography variant="caption" color="text.secondary">{s.title} ({s.max} pts)</Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Sections */}
          {sections.map((s, si) => (
            <Box key={si}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 4, height: 20, borderRadius: 1, bgcolor: s.color }} />
                <Typography variant="subtitle1" fontWeight={700}>{s.title}</Typography>
                <Chip label={`${s.max} pts`} size="small"
                  sx={{ bgcolor: s.color, color: '#fff', fontWeight: 700, fontSize: 11, height: 20 }} />
              </Box>
              <Stack spacing={1}>
                {s.criteria.map((c, ci) => (
                  <Paper key={ci} variant="outlined" sx={{ p: 1.75, borderRadius: 1.5, borderColor: `${s.color}40` }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.75 }}>
                      <Box sx={{
                        minWidth: 36, height: 36, borderRadius: 1, bgcolor: s.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#fff', fontSize: 13 }}>{c.pts}</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" fontWeight={700}>{c.title}</Typography>
                          <Chip label={c.source} size="small" variant="outlined"
                            sx={{ fontSize: 10, height: 18, color: 'text.secondary' }} />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3, lineHeight: 1.6 }}>
                          {c.desc}
                        </Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 0.75 }} />
                    <Stack spacing={0.75}>
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary"
                          sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Why it matters</Typography>
                        <Typography variant="body2" sx={{ mt: 0.2, lineHeight: 1.65 }}>{c.why}</Typography>
                      </Box>
                      <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, borderLeft: '3px solid', borderColor: s.color }}>
                        <Typography variant="caption" fontWeight={700}
                          sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Points earned</Typography>
                        <Typography variant="body2" sx={{ mt: 0.2, fontFamily: 'monospace', fontSize: 11.5, lineHeight: 1.7 }}>{c.earn}</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          ))}

          {/* Tips */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50', borderColor: 'success.200' }}>
            <Typography variant="subtitle2" fontWeight={700} color="success.dark" sx={{ mb: 0.75 }}>
              {tab === 0 ? 'What makes a high-scoring issue?' : 'What makes a high-scoring repo?'}
            </Typography>
            <Stack spacing={0.5}>
              {(tab === 0 ? [
                'Has a linked merged PR with 6–30 changed files across multiple directories.',
                'The PR has 3–10 commits and 150–1000 total lines changed with a balanced add/delete ratio.',
                'The issue has 6+ comments with substantive technical discussion (5000+ chars).',
                'Discussion includes code snippets (15–50% of text is code).',
                '3+ participants contributed to the discussion.',
                'Issue was open for 7–90 days — long enough to be real, short enough to be scoped.',
                'Labels include bug, feature, enhancement, performance, or security.',
                'The PR modifies at least one test file.',
              ] : [
                'Active repo: pushed within the past 30 days, not archived.',
                '1000+ stars and 100+ forks signal strong community adoption.',
                'Has 11+ contributors — distributed ownership is a health signal.',
                'Uses MIT, Apache, BSD, or ISC license — permissive and widely compatible.',
                'Primary language is JavaScript, TypeScript, or Python.',
                'Repo is 5–100 MB — substantial but not bloated.',
                'Has a description, homepage, and 6+ topic tags.',
                'Open issue ratio is low relative to contributor count.',
              ]).map((tip, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Typography variant="body2" color="success.main" fontWeight={700} sx={{ minWidth: 18, mt: 0.05 }}>
                    {i + 1}.
                  </Typography>
                  <Typography variant="body2" sx={{ lineHeight: 1.65 }}>{tip}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>Got it</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Shared form helpers ───────────────────────────────────────────────────────

const GITHUB_ISSUE_RE = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+/;

const EMPTY_FORM = {
  repoName: '',       // auto-derived from issueLink, read-only
  issueLink: '',
  issueTitle: '',
  prLink: '',         // auto-fetched, read-only
  filesChanged: [],   // auto-fetched, read-only (array of paths)
  baseSha: '',        // auto-fetched, read-only
  commitCount: null,           // auto-fetched, read-only
  linesAdded: null,
  linesDeleted: null,
  labels: [],                  // auto-fetched, read-only
  discussionCount: null,       // auto-fetched, read-only
  discussionCharCount: null,   // auto-fetched, read-only
  discussionCodePercent: null, // auto-fetched, read-only
  issueOpenedAt: null,
  issueClosedAt: null,
  issueDurationMs: null,
  participantCount: null,
  repoInfo: null,
  repoScore: null, repoScoreReport: null, repoScoreBreakdown: null,
  issueScore: null, issueScoreReport: null, issueScoreBreakdown: null,
  takenStatus: 'open',
  repoCategory: '',
  initialResultDir: '', uploadFileName: '', taskUuid: '',
  comment: '', profile: '',
};

function issueToForm(issue) {
  return {
    repoName:         issue.repoName || '',
    issueLink:        issue.issueLink || '',
    issueTitle:       issue.issueTitle || '',
    prLink:           issue.prLink || '',
    filesChanged:     Array.isArray(issue.filesChanged) ? issue.filesChanged : [],
    baseSha:          issue.baseSha || '',
    commitCount:           issue.commitCount  ?? null,
    linesAdded:            issue.linesAdded   ?? null,
    linesDeleted:          issue.linesDeleted ?? null,
    labels:                Array.isArray(issue.labels) ? issue.labels : [],
    discussionCount:       issue.discussionCount       ?? null,
    discussionCharCount:   issue.discussionCharCount   ?? null,
    discussionCodePercent: issue.discussionCodePercent ?? null,
    issueOpenedAt:         issue.issueOpenedAt         || null,
    issueClosedAt:         issue.issueClosedAt         || null,
    issueDurationMs:       issue.issueDurationMs       ?? null,
    participantCount:      issue.participantCount ?? null,
    repoInfo:              issue.repoInfo          || null,
    repoScore:             issue.repoScore          ?? null,
    repoScoreReport:       issue.repoScoreReport    || null,
    repoScoreBreakdown:    issue.repoScoreBreakdown || null,
    issueScore:            issue.issueScore         ?? null,
    issueScoreReport:      issue.issueScoreReport   || null,
    issueScoreBreakdown:   issue.issueScoreBreakdown || null,
    takenStatus:           issue.takenStatus || 'open',
    repoCategory:     issue.repoCategory || '',
    initialResultDir: issue.initialResultDir || '',
    uploadFileName:   issue.uploadFileName || '',
    taskUuid:         issue.taskUuid || '',
    comment:          issue.comment || '',
    profile:          issue.profile?.id || issue.profile || '',
  };
}

function formToPayload(form) {
  return {
    repoName:         form.repoName,
    issueLink:        form.issueLink.trim(),
    issueTitle:       form.issueTitle.trim(),
    prLink:           form.prLink || null,
    filesChanged:     Array.isArray(form.filesChanged) ? form.filesChanged : [],
    baseSha:          form.baseSha || '',
    commitCount:           form.commitCount  ?? null,
    linesAdded:            form.linesAdded   ?? null,
    linesDeleted:          form.linesDeleted ?? null,
    labels:                Array.isArray(form.labels) ? form.labels : [],
    discussionCount:       form.discussionCount       ?? null,
    discussionCharCount:   form.discussionCharCount   ?? null,
    discussionCodePercent: form.discussionCodePercent ?? null,
    issueOpenedAt:         form.issueOpenedAt         || null,
    issueClosedAt:         form.issueClosedAt         || null,
    issueDurationMs:       form.issueDurationMs       ?? null,
    participantCount:      form.participantCount ?? null,
    repoInfo:              form.repoInfo          || null,
    repoScore:             form.repoScore          ?? null,
    repoScoreReport:       form.repoScoreReport    || null,
    repoScoreBreakdown:    form.repoScoreBreakdown || null,
    issueScore:            form.issueScore         ?? null,
    issueScoreReport:      form.issueScoreReport   || null,
    issueScoreBreakdown:   form.issueScoreBreakdown || null,
    takenStatus:      form.takenStatus,
    repoCategory:     form.repoCategory,
    initialResultDir: form.initialResultDir.trim() || null,
    uploadFileName:   form.uploadFileName.trim() || null,
    taskUuid:         form.taskUuid.trim() || null,
    comment:          form.comment.trim() || null,
    profile:          form.profile || null,
  };
}


// ProfileSelect — shared between both dialogs
function ProfileSelect({ value, onChange, profiles, disabled }) {
  return (
    <FormControl fullWidth size="small" disabled={disabled}>
      <InputLabel>Assign Profile (optional)</InputLabel>
      <Select value={value} onChange={onChange} label="Assign Profile (optional)">
        <MenuItem value=""><em>None</em></MenuItem>
        {profiles.map(p => (
          <MenuItem key={p.id} value={p.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar src={p.pictureUrl || undefined} sx={{ width: 20, height: 20, fontSize: 10, bgcolor: 'primary.main' }}>
                {!p.pictureUrl && p.name?.[0]?.toUpperCase()}
              </Avatar>
              <span>{p.name}</span>
              {p.nationality && <Typography variant="caption" color="text.secondary">· {p.nationality}</Typography>}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

// ── IssueFormDialog (create only) ─────────────────────────────────────────────

function IssueFormDialog({ open, onClose, onCreated }) {
  const [issueLink, setIssueLink] = useState('');
  const [loading, setLoading]     = useState(false);  // covers fetch + create
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!open) return;
    setIssueLink('');
    setError('');
  }, [open]);

  const handleAdd = async () => {
    setError('');
    const url = issueLink.trim();
    if (!url) { setError('Please enter a GitHub issue URL.'); return; }
    if (!GITHUB_ISSUE_RE.test(url)) { setError('URL must match: https://github.com/owner/repo/issues/NUMBER'); return; }

    setLoading(true);
    try {
      // Step 1 — fetch details from GitHub
      let fetched = {};
      try {
        const fr = await fetchFromUrl(url);
        fetched = fr.data.data;
      } catch (fetchErr) {
        // Non-fatal: create with URL only if fetch fails
        const msg = fetchErr.response?.data?.message;
        if (fetchErr.response?.status === 404) {
          setError(msg || 'No matching issue found on GitHub.');
          setLoading(false);
          return;
        }
        // For rate-limits or network errors, still abort and show error
        setError(msg || 'Could not fetch issue details from GitHub. Try again.');
        setLoading(false);
        return;
      }

      // Step 2 — create the issue with all fetched data
      const parsed = url.match(/github\.com\/([^/]+\/[^/]+)\/issues\/\d+/);
      const payload = {
        issueLink:    url,
        issueTitle:   fetched.issueTitle   || '',
        repoName:     fetched.repoName     || (parsed ? parsed[1] : ''),
        prLink:       fetched.prLink       || null,
        baseSha:      fetched.baseSha      || '',
        filesChanged:          fetched.filesChanged          || [],
        commitCount:           fetched.commitCount  ?? null,
        linesAdded:            fetched.linesAdded   ?? null,
        linesDeleted:          fetched.linesDeleted ?? null,
        labels:                fetched.labels                || [],
        discussionCount:       fetched.discussionCount       ?? null,
        discussionCharCount:   fetched.discussionCharCount   ?? null,
        discussionCodePercent: fetched.discussionCodePercent ?? null,
        issueOpenedAt:         fetched.issueOpenedAt         || null,
        issueClosedAt:         fetched.issueClosedAt         || null,
        issueDurationMs:       fetched.issueDurationMs       ?? null,
        participantCount:      fetched.participantCount ?? null,
        repoInfo:              fetched.repoInfo          || null,
        repoScore:             fetched.repoScore          ?? null,
        repoScoreReport:       fetched.repoScoreReport    || null,
        repoScoreBreakdown:    fetched.repoScoreBreakdown || null,
        issueScore:            fetched.issueScore         ?? null,
        issueScoreReport:      fetched.issueScoreReport   || null,
        issueScoreBreakdown:   fetched.issueScoreBreakdown || null,
        repoCategory: null,
        takenStatus:  'open',
      };

      const res = await createIssue(payload);
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add issue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={!loading ? onClose : undefined} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GitHubIcon />
        Add GitHub Issue
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="GitHub Issue URL"
            value={issueLink}
            onChange={e => { setIssueLink(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && !loading && handleAdd()}
            fullWidth
            size="small"
            autoFocus
            placeholder="https://github.com/owner/repo/issues/123"
            disabled={loading}
          />
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">Fetching issue details from GitHub…</Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={loading || !issueLink.trim()}>
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── IssueDetailEditDialog — single inline-edit dialog ────────────────────────

function IssueDetailEditDialog({ open, onClose, issue, currentUserId, onUpdated, onDelete, onCheckConflict }) {
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState(false);
  const [error, setError]         = useState('');
  const [profiles, setProfiles]   = useState([]);
  const [importing, setImporting] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [issueReportOpen, setIssueReportOpen]  = useState(false);
  const [repoReportOpen, setRepoReportOpen]    = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open || !issue) return;
    listProfiles().then(res => setProfiles(res.data.data || [])).catch(() => {});
    setForm(issueToForm(issue));
    setError('');
    setDirty(false);
    setFetchError('');
  }, [open, issue?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const doImport = useCallback(async (url) => {
    setImporting(true);
    setFetchError('');
    try {
      const res = await fetchFromUrl(url);
      const d = res.data.data;
      setForm(f => ({
        ...f,
        repoName:     d.repoName     || f.repoName,
        issueTitle:   d.issueTitle   || f.issueTitle,
        prLink:       d.prLink       || '',
        baseSha:      d.baseSha      || '',
        filesChanged:          d.filesChanged          || [],
        commitCount:           d.commitCount  ?? null,
        linesAdded:            d.linesAdded   ?? null,
        linesDeleted:          d.linesDeleted ?? null,
        labels:                d.labels                || [],
        discussionCount:       d.discussionCount       ?? null,
        discussionCharCount:   d.discussionCharCount   ?? null,
        discussionCodePercent: d.discussionCodePercent ?? null,
        issueOpenedAt:         d.issueOpenedAt         || null,
        issueClosedAt:         d.issueClosedAt         || null,
        issueDurationMs:       d.issueDurationMs       ?? null,
        participantCount:      d.participantCount ?? null,
        repoInfo:              d.repoInfo          || null,
        repoScore:             d.repoScore          ?? null,
        repoScoreReport:       d.repoScoreReport    || null,
        repoScoreBreakdown:    d.repoScoreBreakdown || null,
        issueScore:            d.issueScore         ?? null,
        issueScoreReport:      d.issueScoreReport   || null,
        issueScoreBreakdown:   d.issueScoreBreakdown || null,
      }));
      setDirty(true);
    } catch (err) {
      setFetchError("That issue doesn't exist on Github");
    } finally {
      setImporting(false);
    }
  }, []);

  const handleIssueLinkChange = (e) => {
    const val = e.target.value;
    const parsed = val.match(/github\.com\/([^/]+\/[^/]+)\/issues\/\d+/);
    setForm(f => ({ ...f, issueLink: val, repoName: parsed ? parsed[1] : f.repoName }));
    setDirty(true);
    setFetchError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (GITHUB_ISSUE_RE.test(val)) {
      debounceRef.current = setTimeout(() => doImport(val), 2000);
    }
  };

  const handleChange = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setError('');
    const payload = formToPayload(form);
    if (!payload.issueLink || !payload.issueTitle || !payload.repoCategory) {
      setError('Issue link, issue title, and category are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await updateIssue(issue.id, payload);
      onUpdated(res.data.data);
      setDirty(false);
      setFetchError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save.');
    } finally { setSaving(false); }
  };

  if (!issue) return null;

  const isOwner    = issue.posterId?.id === currentUserId || issue.posterId?._id === currentUserId;
  const scoreColor = issue.score == null ? 'default' : issue.score >= 75 ? 'success' : issue.score >= 50 ? 'warning' : 'error';
  const startDt    = issue.startDatetime ? new Date(issue.startDatetime) : null;
  const endDt      = issue.endDatetime   ? new Date(issue.endDatetime)   : null;
  const durMs      = startDt && endDt ? endDt - startDt : null;
  const meta       = ADDED_VIA_META[issue.addedVia] || ADDED_VIA_META.manual;

  const ro = !isOwner;

  const InfoField = ({ label, children }) => (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.25 }}>{label}</Typography>
      {children}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '92vh' } }}>

      {/* ── Header: Issue Link as big title ── */}
      <Box sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Tooltip title="Reload from GitHub">
            <span>
              <IconButton
                size="small"
                onClick={() => GITHUB_ISSUE_RE.test(form.issueLink) && doImport(form.issueLink)}
                disabled={importing || !GITHUB_ISSUE_RE.test(form.issueLink)}
                sx={{ mt: 0.25, flexShrink: 0, p: 0.25 }}
              >
                {importing
                  ? <CircularProgress size={20} />
                  : <GitHubIcon sx={{ fontSize: 22 }} color={GITHUB_ISSUE_RE.test(form.issueLink) ? 'action' : 'disabled'} />
                }
              </IconButton>
            </span>
          </Tooltip>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <TextField
              value={form.issueLink}
              onChange={handleIssueLinkChange}
              disabled={ro}
              fullWidth
              variant="standard"
              placeholder="https://github.com/owner/repo/issues/123"
              inputProps={{ style: { fontSize: 18, fontWeight: 700, lineHeight: 1.4, wordBreak: 'break-all' } }}
              sx={{
                '& .MuiInput-underline:before': { borderBottomColor: 'transparent' },
                '& .MuiInput-underline:hover:before': { borderBottomColor: 'divider' },
              }}
            />
            {dirty && !fetchError && (
              <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.5 }}>
                You have unsaved changes
              </Typography>
            )}
            {fetchError && (
              <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>
                {fetchError}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <Divider />

      <DialogContent sx={{ px: 3, py: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Stack spacing={2}>

          {/* Issue Assessment Score */}
          {form.issueScore != null && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Issue Assessment Score</Typography>
                <Chip
                  label={`${form.issueScore} / 100`}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: 12,
                    bgcolor: form.issueScore >= 76 ? '#1b5e20' : form.issueScore >= 51 ? '#1565c0' : form.issueScore >= 26 ? '#e65100' : '#b71c1c',
                    color: '#fff',
                  }}
                />
                {form.issueScoreReport && (
                  <IconButton size="small" onClick={() => setIssueReportOpen(v => !v)}>
                    {issueReportOpen ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                  </IconButton>
                )}
              </Box>
              {form.issueScoreReport && (
                <Collapse in={issueReportOpen}>
                  <Box component="pre" sx={{
                    mt: 1, p: 1.5, bgcolor: 'grey.900', color: 'grey.100',
                    borderRadius: 1, fontSize: 11, lineHeight: 1.5,
                    overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    fontFamily: 'monospace',
                  }}>
                    {form.issueScoreReport}
                  </Box>
                </Collapse>
              )}
            </Box>
          )}

          {/* Issue data table */}
          {(() => {
            const repoLink = form.repoName ? `https://github.com/${form.repoName}` : null;
            const rows = [
              { field: 'Issue Name',    value: form.issueTitle || null,    copy: false, visit: false },
              { field: 'Repo Name',     value: form.repoName   || null,    copy: true,  visit: false },
              { field: 'Category',      value: issue.repoCategory || null, copy: false, visit: false },
              { field: 'Repo Link',     value: repoLink,                   copy: true,  visit: true  },
              { field: 'Issue Link',    value: form.issueLink  || null,    copy: true,  visit: true  },
              { field: 'PR Link',       value: form.prLink     || null,    copy: true,  visit: true  },
              { field: 'Base SHA',      value: form.baseSha    || null,    copy: true,  visit: false, mono: true },
              { field: 'Files Changed',        value: form.filesChanged.length ? `${form.filesChanged.length} file${form.filesChanged.length !== 1 ? 's' : ''}` : null, copy: false, visit: false },
              { field: 'Commits',              value: form.commitCount  != null ? String(form.commitCount)             : null, copy: false, visit: false },
              { field: 'Lines Added',          value: form.linesAdded   != null ? `+${form.linesAdded.toLocaleString()}` : null, copy: false, visit: false },
              { field: 'Lines Deleted',        value: form.linesDeleted != null ? `-${form.linesDeleted.toLocaleString()}` : null, copy: false, visit: false },
              { field: 'Labels',               value: form.labels?.length        ?         form.labels.join(', ')                     : null, copy: false, visit: false },
              { field: 'Discussions',          value: form.discussionCount       != null ? String(form.discussionCount)               : null, copy: false, visit: false },
              { field: 'Discussion Chars',     value: form.discussionCharCount   != null ? form.discussionCharCount.toLocaleString()  : null, copy: false, visit: false },
              { field: 'Code in Discussions',  value: form.discussionCodePercent != null ? `${form.discussionCodePercent}%`           : null, copy: false, visit: false },
              { field: 'Participants',         value: form.participantCount      != null ? String(form.participantCount)              : null, copy: false, visit: false },
              { field: 'Issue Opened',         value: form.issueOpenedAt  ? new Date(form.issueOpenedAt).toLocaleString()            : null, copy: false, visit: false },
              { field: 'Issue Closed',         value: form.issueClosedAt  ? new Date(form.issueClosedAt).toLocaleString()            : 'Still open',                   copy: false, visit: false },
              { field: 'Issue Duration',       value: form.issueDurationMs != null ? fmtDuration(form.issueDurationMs)               : form.issueOpenedAt ? 'Ongoing' : null, copy: false, visit: false },
            ];
            return (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: 13, width: '28%' }}>Field Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Value</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 13, width: 52, textAlign: 'center' }}>Copy</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 13, width: 52, textAlign: 'center' }}>Visit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(row => (
                      <TableRow key={row.field} hover>
                        <TableCell sx={{ fontWeight: 600, fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {row.field}
                        </TableCell>
                        <TableCell sx={{ fontSize: 13, fontFamily: row.mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>
                          {row.value ?? <Typography variant="body2" color="text.disabled" component="span">—</Typography>}
                        </TableCell>
                        <TableCell align="center" sx={{ p: 0.5 }}>
                          {row.copy && row.value ? (
                            <IconButton size="small" onClick={() => navigator.clipboard.writeText(row.value)}>
                              <CopyIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          ) : null}
                        </TableCell>
                        <TableCell align="center" sx={{ p: 0.5 }}>
                          {row.visit && row.value ? (
                            <IconButton size="small" component="a" href={row.value} target="_blank" rel="noopener noreferrer">
                              <OpenInNewIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            );
          })()}

          {/* Repo Assessment Score */}
          {form.repoScore != null && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Repo Assessment Score</Typography>
                <Chip
                  label={`${form.repoScore} / 100`}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: 12,
                    bgcolor: form.repoScore >= 76 ? '#1b5e20' : form.repoScore >= 51 ? '#1565c0' : form.repoScore >= 26 ? '#e65100' : '#b71c1c',
                    color: '#fff',
                  }}
                />
                {form.repoScoreReport && (
                  <IconButton size="small" onClick={() => setRepoReportOpen(v => !v)}>
                    {repoReportOpen ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                  </IconButton>
                )}
              </Box>
              {form.repoScoreReport && (
                <Collapse in={repoReportOpen}>
                  <Box component="pre" sx={{
                    mt: 1, p: 1.5, bgcolor: 'grey.900', color: 'grey.100',
                    borderRadius: 1, fontSize: 11, lineHeight: 1.5,
                    overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    fontFamily: 'monospace',
                  }}>
                    {form.repoScoreReport}
                  </Box>
                </Collapse>
              )}
            </Box>
          )}

          {/* Repository Info Table */}
          {form.repoInfo && (() => {
            const ri = form.repoInfo;
            const fmtSize = (kb) => {
              if (kb == null) return null;
              if (kb < 1024) return `${kb} KB`;
              if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
              return `${(kb / 1024 / 1024).toFixed(2)} GB`;
            };
            const repoRows = [
              { field: 'Description',      value: ri.description || null,          copy: false, visit: false },
              { field: 'Homepage',         value: ri.homepage    || null,          copy: true,  visit: !!ri.homepage },
              { field: 'Stars',            value: ri.stars            != null ? ri.stars.toLocaleString()            : null, copy: false, visit: false },
              { field: 'Forks',            value: ri.forks            != null ? ri.forks.toLocaleString()            : null, copy: false, visit: false },
              { field: 'Watchers',         value: ri.watchers         != null ? ri.watchers.toLocaleString()         : null, copy: false, visit: false },
              { field: 'Open Issues',      value: ri.openIssues       != null ? ri.openIssues.toLocaleString()       : null, copy: false, visit: false },
              { field: 'Contributors',     value: ri.contributorCount != null ? ri.contributorCount.toLocaleString() : null, copy: false, visit: false },
              { field: 'Network Forks',    value: ri.networkCount     != null ? ri.networkCount.toLocaleString()     : null, copy: false, visit: false },
              { field: 'Primary Language', value: ri.primaryLanguage  || null, copy: false, visit: false },
              { field: 'Topics',           value: ri.topics?.length   ? ri.topics.join(', ')  : null, copy: false, visit: false },
              { field: 'License',          value: ri.license          || null, copy: false, visit: false },
              { field: 'Default Branch',   value: ri.defaultBranch    || null, copy: false, visit: false },
              { field: 'Size',             value: fmtSize(ri.sizeKb),          copy: false, visit: false },
              { field: 'Archived',         value: ri.isArchived != null ? (ri.isArchived ? 'Yes' : 'No') : null, copy: false, visit: false },
              { field: 'Created',          value: ri.createdAt   ? new Date(ri.createdAt).toLocaleDateString()   : null, copy: false, visit: false },
              { field: 'Last Pushed',      value: ri.lastPushedAt ? new Date(ri.lastPushedAt).toLocaleDateString() : null, copy: false, visit: false },
            ];
            return (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.50' }}>
                      <TableCell colSpan={4} sx={{ fontWeight: 700, fontSize: 13, color: 'primary.main' }}>
                        Repository Information
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: 13, width: '28%' }}>Field Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Value</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 13, width: 52, textAlign: 'center' }}>Copy</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 13, width: 52, textAlign: 'center' }}>Visit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {repoRows.map(row => (
                      <TableRow key={row.field} hover>
                        <TableCell sx={{ fontWeight: 600, fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>{row.field}</TableCell>
                        <TableCell sx={{ fontSize: 13, wordBreak: 'break-all' }}>
                          {row.value ?? <Typography variant="body2" color="text.disabled" component="span">—</Typography>}
                        </TableCell>
                        <TableCell align="center" sx={{ p: 0.5 }}>
                          {row.copy && row.value
                            ? <IconButton size="small" onClick={() => navigator.clipboard.writeText(row.value)}><CopyIcon sx={{ fontSize: 16 }} /></IconButton>
                            : null}
                        </TableCell>
                        <TableCell align="center" sx={{ p: 0.5 }}>
                          {row.visit && row.value
                            ? <IconButton size="small" component="a" href={row.value} target="_blank" rel="noopener noreferrer"><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton>
                            : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            );
          })()}

          {/* Profile */}
          <ProfileSelect value={form.profile} onChange={handleChange('profile')} profiles={profiles} disabled={ro} />

          {/* Comment */}
          <TextField label="Notes / Comment" value={form.comment} onChange={handleChange('comment')}
            disabled={ro} fullWidth size="small" multiline rows={3} placeholder="Optional notes or remarks" />

          {/* Workflow Data */}
          <Divider><Typography variant="caption" color="text.secondary">Workflow Data</Typography></Divider>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField label="Initial Result Directory" value={form.initialResultDir} onChange={handleChange('initialResultDir')}
              disabled={ro} fullWidth size="small" placeholder="e.g. 2025-03-30-14-22" />
            <TextField label="Upload File Name" value={form.uploadFileName} onChange={handleChange('uploadFileName')}
              disabled={ro} fullWidth size="small" placeholder="e.g. result.zip" />
          </Box>
          <TextField label="Task UUID" value={form.taskUuid} onChange={handleChange('taskUuid')}
            disabled={ro} fullWidth size="small" placeholder="e.g. a1b2c3d4-..."
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }} />

          {/* Read-only info */}
          <Divider><Typography variant="caption" color="text.secondary">Info</Typography></Divider>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
            <InfoField label="Posted by">
              <Typography variant="body2">@{issue.posterId?.username || '?'}</Typography>
              {issue.posterId?.displayName && <Typography variant="caption" color="text.secondary">{issue.posterId.displayName}</Typography>}
            </InfoField>
            <InfoField label="Added">
              <Typography variant="body2">{issue.createdAt ? new Date(issue.createdAt).toLocaleString() : '—'}</Typography>
            </InfoField>
            <InfoField label="Last updated">
              <Typography variant="body2">{issue.updatedAt ? new Date(issue.updatedAt).toLocaleString() : '—'}</Typography>
            </InfoField>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
            <InfoField label="Started">
              <Typography variant="body2">{startDt ? startDt.toLocaleString() : '—'}</Typography>
            </InfoField>
            <InfoField label="Finished">
              <Typography variant="body2">{endDt ? endDt.toLocaleString() : '—'}</Typography>
            </InfoField>
            <InfoField label="Duration">
              <Typography variant="body2">{durMs != null ? fmtDuration(durMs) : '—'}</Typography>
            </InfoField>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <InfoField label="Source">
              <Chip icon={meta.icon} label={meta.label} size="small" color={meta.chipColor} variant="outlined" />
            </InfoField>
            {issue.pinned && (
              <InfoField label="Favorite">
                <StarIcon sx={{ fontSize: 18, color: '#f9a825' }} />
              </InfoField>
            )}
          </Box>

          {/* ── Status / Score — bottom of board ── */}
          <Divider />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', pt: 0.5 }}>
            <Select
              value={form.takenStatus}
              onChange={handleChange('takenStatus')}
              disabled={ro}
              size="small"
              renderValue={(v) => <StatusChip status={v} />}
              sx={{ '& .MuiSelect-select': { py: '4px', px: '8px' }, minWidth: 0 }}
            >
              {ALL_STATUSES.map(k => <MenuItem key={k} value={k}><StatusChip status={k} /></MenuItem>)}
            </Select>
            {issue.score != null && (
              <Chip label={`Score: ${issue.score}`} size="small" color={scoreColor} variant="outlined" sx={{ fontSize: 11, height: 22 }} />
            )}
            {['progress', 'progress_interaction'].includes(issue.takenStatus) && <CircularProgress size={14} />}
          </Box>

        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button startIcon={<ConflictIcon />} color="warning" size="small" onClick={() => onCheckConflict(issue)}>
          Check Conflicts
        </Button>
        <Box sx={{ flex: 1 }} />
        {isOwner && (
          <Button startIcon={<DeleteIcon />} color="error" size="small" onClick={() => { onClose(); onDelete(issue); }}>
            Delete
          </Button>
        )}
        <Button onClick={onClose} size="small">Close</Button>
        {isOwner && (
          <Button variant="contained" size="small" onClick={handleSave} disabled={saving || !dirty || importing}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}>
            {dirty ? 'Save Changes' : 'Saved'}
          </Button>
        )}
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
  const [formOpen,     setFormOpen]   = useState(false);
  const [detailIssue,  setDetailIssue] = useState(null);
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
  const [bulkDeleteOpen,  setBulkDeleteOpen]  = useState(false);
  const [bulkDeleting,    setBulkDeleting]    = useState(false);
  const [starringAll,     setStarringAll]     = useState(false);
  const [scoreGuideOpen,  setScoreGuideOpen]  = useState(false);

  // ── URL sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPagination) return; // don't pollute URL in scroll mode
    const params = {};
    if (search)            params.q      = search;
    if (category)          params.cat    = category;
    if (takenStatusFilter) params.status = takenStatusFilter;
    if (sortField !== 'createdAt') params.sort = sortField;
    if (sortDir   !== 'desc')      params.dir  = sortDir;
    if (page > 1)          params.page   = String(page);
    if (pageSize !== DEFAULT_PAGE_SIZE) params.limit = String(pageSize);
    setSearchParams(params, { replace: true });
  }, [search, category, takenStatusFilter, sortField, sortDir, page, pageSize, isPagination, setSearchParams]);

  // ── Reset page to 1 when filters/sort/pageSize change ─────────────────────
  useEffect(() => { if (isPagination) setPage(1); }, [search, category, takenStatusFilter, sortField, sortDir, pageSize, isPagination]);

  // ── Pagination load ───────────────────────────────────────────────────────
  const loadPage = useCallback(async () => {
    if (!isPagination) return;
    setLoading(true); setError('');
    try {
      const res = await listIssues({
        search, category,
        takenStatus: takenStatusFilter !== '' ? takenStatusFilter : undefined,
        sortField, sortDir, page, limit: pageSize,
      });
      setIssues(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load issues.');
    } finally { setLoading(false); }
  }, [isPagination, search, category, takenStatusFilter, sortField, sortDir, page, pageSize]);

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
  }, [isPagination, search, category, takenStatusFilter, sortField, sortDir, pageSize, hasMore]);

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
  }, [isPagination, search, category, takenStatusFilter, sortField, sortDir, pageSize]);

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

  const handleCreated = (issue) => {
    setIssues(prev => [issue, ...prev]);
    setTotal(t => t + 1);
  };

  const handleUpdated = (issue) => {
    setIssues(prev => prev.map(i => i.id === issue.id ? issue : i));
    setDetailIssue(issue); // keep dialog open with refreshed data
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

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      await bulkDelete(ids);
      setIssues(prev => prev.filter(i => !selectedIds.has(i.id)));
      setTotal(t => t - ids.length);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete issues.');
    } finally { setBulkDeleting(false); }
  };

  const handleBulkStar = async (pinned) => {
    setStarringAll(true);
    try {
      const ids = [...selectedIds];
      await bulkStar(ids, pinned);
      setIssues(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, pinned } : i));
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update favorites.');
    } finally { setStarringAll(false); }
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
        {selectedCount > 0 && (
          <Button variant="contained"
            startIcon={starringAll ? <CircularProgress size={16} color="inherit" /> : <StarIcon />}
            disabled={starringAll}
            sx={{ bgcolor: '#f9a825', '&:hover': { bgcolor: '#f57f17' } }}
            onClick={() => handleBulkStar(true)}>
            Star: {selectedCount}
          </Button>
        )}
        {selectedCount > 0 && (
          <Button variant="contained" color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setBulkDeleteOpen(true)}>
            Delete: {selectedCount}
          </Button>
        )}

        <Button variant="outlined" color="secondary" startIcon={<SmartSearchIcon />} onClick={() => setSmartSearchOpen(true)}>Smart Search</Button>
        <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setImportOpen(true)}>Import Excel</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>Add Issue</Button>
        <Tooltip title="Score Guide">
          <IconButton onClick={() => setScoreGuideOpen(true)}><HelpIcon /></IconButton>
        </Tooltip>
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
                <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : issues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} align="center" sx={{ py: 6, color: 'text.secondary' }}>No issues found.</TableCell>
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
                          <IconButton size="small" onClick={e => { e.stopPropagation(); setDetailIssue(issue); }}>
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
      <IssueFormDialog open={formOpen} onClose={() => setFormOpen(false)} onCreated={handleCreated} />

      <IssueDetailEditDialog
        open={Boolean(detailIssue)}
        onClose={() => setDetailIssue(null)}
        issue={detailIssue}
        currentUserId={user?._id || user?.id}
        onUpdated={handleUpdated}
        onDelete={setDeleteTarget}
        onCheckConflict={handleCheckConflict}
      />

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

      <ScoreGuideModal open={scoreGuideOpen} onClose={() => setScoreGuideOpen(false)} />

      <SmartStatusChangeDialog open={smartStatusOpen} onClose={() => setSmartStatusOpen(false)}
        selectedCount={selectedCount} onApply={handleSmartStatusChange} />

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {selectedCount} Issues?</DialogTitle>
        <DialogContent>
          <Typography>
            This will permanently delete <strong>{selectedCount}</strong> selected issue{selectedCount !== 1 ? 's' : ''}. Only issues you own will be deleted. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleBulkDelete} disabled={bulkDeleting}
            startIcon={bulkDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
