import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, IconButton, TextField, Select, MenuItem,
  FormControl, InputLabel, Tabs, Tab, Paper, Chip, Checkbox,
  LinearProgress, CircularProgress, Alert, Tooltip, Divider, Link, Stack, Badge,
  List, ListItem, ListItemIcon, ListItemText, ListItemSecondaryAction,
  FormControlLabel, Switch,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  GitHub as GitHubIcon,
  AutoAwesome as SmartIcon,
  Star as StarIcon,
  Info as InfoIcon,
  BookmarkAdd as SaveIcon,
  Download as ImportIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  OpenInNew as OpenInNewIcon,
  ManageSearch as IssueSearchIcon,
  Delete as DeleteIcon,
  BugReport as BugIcon,
  Code as CodeIcon,
  CheckCircleOutline as ApproveIcon,
  CancelOutlined as RejectIcon,
  RateReview as ReviewIcon,
} from '@mui/icons-material';
import {
  searchRepos, validateUrl, searchIssues,
  importRepos, getSavedRepos, deleteSavedRepo, importIssues,
} from '../api/smartSearchApi';
import { useAuth } from '../context/AuthContext';
import { useRandomSearch, WORD_CATEGORIES, getActivePool } from '../context/RandomSearchContext';

const LANGUAGES = ['Python', 'JavaScript', 'TypeScript'];

function scoreColor(score) {
  if (score >= 75) return '#2e7d32';
  if (score >= 50) return '#ed6c02';
  return '#c62828';
}

function scoreMuiColor(score) {
  if (score >= 75) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

function fmtStars(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  const color = scoreColor(score);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{
          flexGrow: 1, height: 7, borderRadius: 4, bgcolor: 'grey.200',
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 },
        }}
      />
      <Typography variant="caption" fontWeight={700} sx={{ color, minWidth: 34 }}>
        {score}%
      </Typography>
    </Box>
  );
}

function RepoRow({ repo, selected, onToggle, onDetail }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.75, mb: 1.25, display: 'flex', alignItems: 'flex-start', gap: 1.5,
        cursor: 'pointer', transition: 'border-color 0.15s',
        '&:hover': { borderColor: 'primary.main' },
      }}
      onClick={onDetail}
    >
      <Checkbox
        size="small"
        checked={selected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        sx={{ mt: -0.25 }}
      />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.25 }}>
          <GitHubIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700} noWrap>{repo.fullName}</Typography>
          <Chip label={repo.language} size="small" sx={{ height: 18, fontSize: 11 }} />
          <Chip icon={<StarIcon sx={{ fontSize: '12px !important' }} />} label={fmtStars(repo.stars)} size="small" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
          <Typography variant="caption" color="text.secondary">{repo.sizeMb} MB</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }} noWrap>
          {repo.description || 'No description'}
        </Typography>
        <ScoreBar score={repo.smartScore} />
      </Box>
      <Tooltip title="View details">
        <IconButton size="small" onClick={e => { e.stopPropagation(); onDetail(); }}>
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

function IssueRow({ issue, selected, onToggle }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Checkbox size="small" checked={selected} onChange={onToggle} sx={{ mt: -0.25 }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <BugIcon sx={{ fontSize: 15, color: 'error.main', flexShrink: 0 }} />
          <Typography variant="body2" fontWeight={600} noWrap sx={{ flexGrow: 1 }}>
            {issue.issueTitle}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">{issue.repoName}</Typography>
        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
          <Chip label={`${issue.meaningfulLines}+ lines`} size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
          {issue.hasTests && <Chip label="has tests" size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: 11 }} />}
          <Chip label={issue.repoCategory} size="small" sx={{ height: 18, fontSize: 11 }} />
          <Chip label={`SHA: ${issue.baseSha?.slice(0, 7)}`} size="small" variant="outlined" sx={{ height: 18, fontSize: 11, fontFamily: 'monospace' }} />
        </Box>
      </Box>
      <Tooltip title="Open issue on GitHub">
        <IconButton size="small" component="a" href={issue.issueLink} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

function RepoDetailDialog({ repo, open, onClose, onSave }) {
  if (!repo) return null;
  const checks = [
    { label: 'Test suite',      ok: repo.checks?.hasTests },
    { label: 'README file',     ok: repo.checks?.hasReadme },
    { label: 'Package manager', ok: repo.checks?.hasPkg },
    { label: 'CI/CD pipeline',  ok: repo.checks?.hasCi },
    { label: 'Linter config',   ok: repo.checks?.hasLinter },
    { label: 'Formatter config',ok: repo.checks?.hasFormatter },
  ];
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GitHubIcon />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap>{repo.fullName}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {repo.description || 'No description'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
          <Chip label={repo.language} size="small" />
          <Chip icon={<StarIcon />} label={`${repo.stars?.toLocaleString()} stars`} size="small" />
          <Chip label={`${repo.sizeMb} MB`} size="small" />
          <Chip label={`Updated ${new Date(repo.updatedAt).toLocaleDateString()}`} size="small" variant="outlined" />
        </Box>

        <Typography variant="subtitle2" gutterBottom>Smartness Score</Typography>
        <Box sx={{ mb: 2 }}>
          <ScoreBar score={repo.smartScore} />
        </Box>

        <Typography variant="subtitle2" gutterBottom>Checks</Typography>
        <List dense disablePadding>
          {checks.map(({ label, ok }) => (
            <ListItem key={label} sx={{ py: 0.25, px: 0 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                {ok
                  ? <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                  : <CancelIcon color="error" sx={{ fontSize: 18 }} />}
              </ListItemIcon>
              <ListItemText
                primary={label}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button
          component="a" href={repo.htmlUrl} target="_blank" rel="noopener"
          startIcon={<OpenInNewIcon />} size="small"
        >
          View on GitHub
        </Button>
        <Button
          variant="contained" startIcon={<SaveIcon />}
          onClick={() => { onSave(repo); onClose(); }}
        >
          Save to My Repos
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function SmartSearchModal({ open, onClose, onImported }) {
  const { user }  = useAuth();
  const rs = useRandomSearch();
  const [tab, setTab] = useState(0);

  // GitHub token — loaded from user account (set in Profile → My Account → GitHub Token)
  const ghToken = user?.githubToken || '';

  // Repo search
  const [language, setLanguage]       = useState('Python');
  const [keyword, setKeyword]         = useState('');
  const [repoResults, setRepoResults] = useState([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState(new Set());
  const [detailRepo, setDetailRepo]   = useState(null);

  // Saved repos
  const [savedRepos, setSavedRepos]   = useState([]);

  // Issue search
  const [issueMode, setIssueMode]     = useState(0); // 0=url, 1=saved repos
  const [issueUrl, setIssueUrl]       = useState('');
  const [issueResults, setIssueResults] = useState([]);
  const [issueLoading, setIssueLoading] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState(new Set());
  const [selectedSaved, setSelectedSaved]   = useState(new Set());

  // Status
  const [error, setError]           = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [importing, setImporting]   = useState(false);


  const loadSavedRepos = useCallback(async () => {
    try {
      const res = await getSavedRepos();
      setSavedRepos(res.data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (open) loadSavedRepos();
  }, [open, loadSavedRepos]);

  function clearStatus() { setError(''); setSuccessMsg(''); }

  // ── Repo search handlers ──────────────────────────────────────────────────

  async function handleRepoSearch() {
    if (!keyword.trim()) return;
    clearStatus();
    setRepoLoading(true);
    setRepoResults([]);
    setSelectedRepos(new Set());
    try {
      const res = await searchRepos({ keyword: keyword.trim(), language, token: ghToken });
      setRepoResults(res.data.data || []);
      if (!res.data.data?.length) setError('No repos found matching those criteria.');
    } catch (e) {
      setError(e.response?.data?.message || 'Repo search failed. Check your GitHub token and try again.');
    } finally { setRepoLoading(false); }
  }

  function toggleRepo(fullName) {
    setSelectedRepos(prev => {
      const next = new Set(prev);
      next.has(fullName) ? next.delete(fullName) : next.add(fullName);
      return next;
    });
  }

  function toggleAllRepos() {
    if (selectedRepos.size === repoResults.length) setSelectedRepos(new Set());
    else setSelectedRepos(new Set(repoResults.map(r => r.fullName)));
  }

  async function handleSaveRepos(reposToSave) {
    clearStatus();
    const list = reposToSave || repoResults.filter(r => selectedRepos.has(r.fullName));
    if (!list.length) return;
    try {
      await importRepos({ repos: list });
      await loadSavedRepos();
      setSuccessMsg(`Saved ${list.length} repo(s) to My Repos.`);
    } catch { setError('Failed to save repos.'); }
  }

  async function handleFindIssuesFromSearch() {
    const list = repoResults.filter(r => selectedRepos.has(r.fullName));
    if (!list.length) return;
    clearStatus();
    setIssueResults([]);
    setSelectedIssues(new Set());
    setIssueLoading(true);
    setTab(1);
    try {
      const res = await searchIssues({
        repos: list.map(r => ({ fullName: r.fullName, language: r.language })),
        token: ghToken,
      });
      const issues = res.data.data || [];
      setIssueResults(issues);
      if (!issues.length) setError('No valid issues found in the selected repos.');
    } catch (e) {
      setError(e.response?.data?.message || 'Issue search failed.');
    } finally { setIssueLoading(false); }
  }

  // ── Issue search handlers ─────────────────────────────────────────────────

  async function handleValidateUrl() {
    if (!issueUrl.trim()) return;
    clearStatus();
    setIssueResults([]);
    setSelectedIssues(new Set());
    setIssueLoading(true);
    try {
      const res = await validateUrl({ url: issueUrl.trim(), token: ghToken });
      if (!res.data.success) {
        setError(res.data.message || 'Validation failed.');
      } else {
        setIssueResults(res.data.data || []);
        if (!res.data.data?.length) setError('No valid issues found for that URL.');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Validation failed.');
    } finally { setIssueLoading(false); }
  }

  async function handleFindIssuesFromSaved() {
    const list = savedRepos.filter(r => selectedSaved.has(r.id));
    if (!list.length) return;
    clearStatus();
    setIssueResults([]);
    setSelectedIssues(new Set());
    setIssueLoading(true);
    try {
      const res = await searchIssues({
        repos: list.map(r => ({ fullName: r.fullName, language: r.language })),
        token: ghToken,
      });
      const issues = res.data.data || [];
      setIssueResults(issues);
      if (!issues.length) setError('No valid issues found in the selected repos.');
    } catch (e) {
      setError(e.response?.data?.message || 'Issue search failed.');
    } finally { setIssueLoading(false); }
  }

  function toggleIssue(link) {
    setSelectedIssues(prev => {
      const next = new Set(prev);
      next.has(link) ? next.delete(link) : next.add(link);
      return next;
    });
  }

  function toggleAllIssues() {
    if (selectedIssues.size === issueResults.length) setSelectedIssues(new Set());
    else setSelectedIssues(new Set(issueResults.map(i => i.issueLink)));
  }

  function toggleSaved(id) {
    setSelectedSaved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDeleteSaved(id) {
    try {
      await deleteSavedRepo(id);
      setSavedRepos(prev => prev.filter(r => r.id !== id));
      setSelectedSaved(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch { setError('Failed to delete repo.'); }
  }

  async function handleImportIssues() {
    const toImport = issueResults.filter(i => selectedIssues.has(i.issueLink));
    if (!toImport.length) return;
    clearStatus();
    setImporting(true);
    try {
      const res = await importIssues({ issues: toImport });
      const { count = 0, failed = [] } = res.data;

      if (failed.length > 0) {
        const lines = failed.map(f =>
          `• ${f.issueTitle || f.issueLink}: ${f.reason}`
        ).join('\n');
        const summary = count > 0
          ? `Imported ${count} issue(s). ${failed.length} could not be imported:\n${lines}`
          : `No issues were imported. ${failed.length} failed:\n${lines}`;
        setError(summary);
      } else {
        setSuccessMsg(`Successfully imported ${count} issue(s).`);
      }

      if (count > 0) {
        setIssueResults([]);
        setSelectedIssues(new Set());
        onImported?.();
      }
    } catch { setError('Import failed.'); }
    finally { setImporting(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedRepoList = repoResults.filter(r => selectedRepos.has(r.fullName));
  const isIssueUrl = /\/issues\/\d+/.test(issueUrl);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { height: '90vh', display: 'flex', flexDirection: 'column' } }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1, flexShrink: 0 }}>
          <SmartIcon color="primary" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Smart Issue Search</Typography>
          {!ghToken && (
            <Tooltip title="Set your GitHub token in Profile → My Account → GitHub Token to increase rate limits">
              <Typography variant="caption" color="warning.main" sx={{ mr: 1 }}>No GitHub token set</Typography>
            </Tooltip>
          )}
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </DialogTitle>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 3, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
        >
          <Tab icon={<SearchIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Repo Search" />
          <Tab icon={<IssueSearchIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Issue Search" />
          <Tab icon={<GitHubIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`My Repos (${savedRepos.length})`} />
          <Tab icon={<SmartIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Random Search" />
        </Tabs>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', p: 2.5, overflow: 'hidden', flexGrow: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1.5 }}>{error}</Alert>
          )}
          {successMsg && (
            <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ mb: 1.5 }}>{successMsg}</Alert>
          )}

          {/* ── Tab 0: Repo Search ──────────────────────────────────── */}
          {tab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Search form */}
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexShrink: 0 }}>
                <FormControl size="small" sx={{ minWidth: 145 }}>
                  <InputLabel>Language</InputLabel>
                  <Select value={language} label="Language" onChange={e => setLanguage(e.target.value)}>
                    {LANGUAGES.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth size="small"
                  placeholder="e.g. data pipeline, web scraper, CLI tool, REST API..."
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRepoSearch()}
                />
                <Button
                  variant="contained" onClick={handleRepoSearch}
                  disabled={repoLoading || !keyword.trim()}
                  startIcon={repoLoading ? <CircularProgress size={15} color="inherit" /> : <SearchIcon />}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Search
                </Button>
              </Box>

              {repoLoading && <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />}

              {/* Results */}
              <Box sx={{ flexGrow: 1, overflow: 'auto', pr: 0.5 }}>
                {repoResults.length === 0 && !repoLoading ? (
                  <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                    <SearchIcon sx={{ fontSize: 52, mb: 1, opacity: 0.2 }} />
                    <Typography variant="body1">Search GitHub repositories to get started</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Repos are scored 0–100% based on test suite, CI/CD, documentation, and activity
                    </Typography>
                  </Box>
                ) : (
                  repoResults.map(repo => (
                    <RepoRow
                      key={repo.fullName}
                      repo={repo}
                      selected={selectedRepos.has(repo.fullName)}
                      onToggle={() => toggleRepo(repo.fullName)}
                      onDetail={() => setDetailRepo(repo)}
                    />
                  ))
                )}
              </Box>

              {/* Action bar */}
              {repoResults.length > 0 && (
                <Box sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                  <Checkbox
                    size="small"
                    checked={selectedRepos.size === repoResults.length && repoResults.length > 0}
                    indeterminate={selectedRepos.size > 0 && selectedRepos.size < repoResults.length}
                    onChange={toggleAllRepos}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {selectedRepos.size} of {repoResults.length} selected
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    startIcon={<SaveIcon />}
                    onClick={() => handleSaveRepos()}
                    disabled={!selectedRepos.size}
                    size="small"
                  >
                    Save to My Repos
                  </Button>
                  <Button
                    variant="contained" size="small"
                    startIcon={issueLoading ? <CircularProgress size={14} color="inherit" /> : <IssueSearchIcon />}
                    onClick={handleFindIssuesFromSearch}
                    disabled={!selectedRepos.size || issueLoading}
                  >
                    Find Issues →
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* ── Tab 1: Issue Search ─────────────────────────────────── */}
          {tab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Tabs
                value={issueMode}
                onChange={(_, v) => setIssueMode(v)}
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
              >
                <Tab label="By URL" />
                <Tab label={`From My Repos (${savedRepos.length})`} />
              </Tabs>

              {/* By URL */}
              {issueMode === 0 && (
                <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexShrink: 0 }}>
                  <TextField
                    fullWidth size="small"
                    placeholder="github.com/owner/repo  or  github.com/owner/repo/issues/123"
                    value={issueUrl}
                    onChange={e => setIssueUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleValidateUrl()}
                    helperText="Paste a repo URL to find all valid issues, or a specific issue URL to validate it"
                  />
                  <Button
                    variant="contained"
                    onClick={handleValidateUrl}
                    disabled={issueLoading || !issueUrl.trim()}
                    startIcon={issueLoading ? <CircularProgress size={15} color="inherit" /> : <SearchIcon />}
                    sx={{ whiteSpace: 'nowrap', alignSelf: 'flex-start' }}
                  >
                    {isIssueUrl ? 'Validate' : 'Search'}
                  </Button>
                </Box>
              )}

              {/* From saved repos */}
              {issueMode === 1 && (
                <Box sx={{ mb: 2, flexShrink: 0 }}>
                  {savedRepos.length === 0 ? (
                    <Alert severity="info" sx={{ mb: 1.5 }}>
                      No saved repos yet — use Repo Search to find and save repos first.
                    </Alert>
                  ) : (
                    <Paper variant="outlined" sx={{ maxHeight: 180, overflow: 'auto', p: 0.5, mb: 1.5 }}>
                      {savedRepos.map(repo => (
                        <Box key={repo.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4, px: 1 }}>
                          <Checkbox
                            size="small"
                            checked={selectedSaved.has(repo.id)}
                            onChange={() => toggleSaved(repo.id)}
                          />
                          <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>{repo.fullName}</Typography>
                          <Chip label={repo.language} size="small" sx={{ height: 18, fontSize: 11 }} />
                          <Chip
                            label={`${repo.smartScore}%`}
                            size="small"
                            color={scoreMuiColor(repo.smartScore)}
                            sx={{ height: 18, fontSize: 11 }}
                          />
                        </Box>
                      ))}
                    </Paper>
                  )}
                  <Button
                    variant="contained"
                    startIcon={issueLoading ? <CircularProgress size={14} color="inherit" /> : <SearchIcon />}
                    onClick={handleFindIssuesFromSaved}
                    disabled={!selectedSaved.size || issueLoading}
                    size="small"
                  >
                    Search Issues in {selectedSaved.size} Repo{selectedSaved.size !== 1 ? 's' : ''}
                  </Button>
                </Box>
              )}

              {issueLoading && <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />}

              {/* Issue results */}
              <Box sx={{ flexGrow: 1, overflow: 'auto', pr: 0.5 }}>
                {issueResults.length === 0 && !issueLoading ? (
                  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    <BugIcon sx={{ fontSize: 52, mb: 1, opacity: 0.2 }} />
                    <Typography variant="body1">No results yet</Typography>
                    <Typography variant="body2">
                      Issues are validated against complexity, linked PR, and meaningful line changes (&gt;20)
                    </Typography>
                  </Box>
                ) : (
                  issueResults.map(issue => (
                    <IssueRow
                      key={issue.issueLink}
                      issue={issue}
                      selected={selectedIssues.has(issue.issueLink)}
                      onToggle={() => toggleIssue(issue.issueLink)}
                    />
                  ))
                )}
              </Box>

              {/* Import action bar */}
              {issueResults.length > 0 && (
                <Box sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                  <Checkbox
                    size="small"
                    checked={selectedIssues.size === issueResults.length && issueResults.length > 0}
                    indeterminate={selectedIssues.size > 0 && selectedIssues.size < issueResults.length}
                    onChange={toggleAllIssues}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {selectedIssues.size} of {issueResults.length} valid issue{issueResults.length !== 1 ? 's' : ''} selected
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    variant="contained" color="success" size="small"
                    startIcon={importing ? <CircularProgress size={14} color="inherit" /> : <ImportIcon />}
                    onClick={handleImportIssues}
                    disabled={!selectedIssues.size || importing}
                  >
                    Import {selectedIssues.size} Issue{selectedIssues.size !== 1 ? 's' : ''}
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* ── Tab 2: My Repos ─────────────────────────────────────── */}
          {tab === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {savedRepos.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                  <GitHubIcon sx={{ fontSize: 52, mb: 1, opacity: 0.2 }} />
                  <Typography>No saved repos yet</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Use Repo Search to find repos and save them here
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setTab(0)}>
                    Go to Repo Search
                  </Button>
                </Box>
              ) : (
                <>
                  <Box sx={{ flexGrow: 1, overflow: 'auto', pr: 0.5 }}>
                    {savedRepos.map(repo => (
                      <Paper
                        key={repo.id}
                        variant="outlined"
                        sx={{ p: 1.75, mb: 1.25, display: 'flex', alignItems: 'center', gap: 1.5 }}
                      >
                        <Checkbox
                          size="small"
                          checked={selectedSaved.has(repo.id)}
                          onChange={() => toggleSaved(repo.id)}
                        />
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle2" fontWeight={600} noWrap>{repo.fullName}</Typography>
                            <Chip label={repo.language} size="small" sx={{ height: 18, fontSize: 11 }} />
                            <Chip icon={<StarIcon sx={{ fontSize: '12px !important' }} />} label={fmtStars(repo.stars)} size="small" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                          </Box>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {repo.description || 'No description'}
                          </Typography>
                          <ScoreBar score={repo.smartScore} />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="View on GitHub">
                            <IconButton size="small" component="a" href={repo.htmlUrl} target="_blank" rel="noopener">
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove from My Repos">
                            <IconButton size="small" color="error" onClick={() => handleDeleteSaved(repo.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    ))}
                  </Box>

                  {/* Action bar */}
                  <Box sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                    <Checkbox
                      size="small"
                      checked={selectedSaved.size === savedRepos.length && savedRepos.length > 0}
                      indeterminate={selectedSaved.size > 0 && selectedSaved.size < savedRepos.length}
                      onChange={() => {
                        if (selectedSaved.size === savedRepos.length) setSelectedSaved(new Set());
                        else setSelectedSaved(new Set(savedRepos.map(r => r.id)));
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {selectedSaved.size} of {savedRepos.length} selected
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Button
                      variant="contained" size="small"
                      startIcon={issueLoading ? <CircularProgress size={14} color="inherit" /> : <IssueSearchIcon />}
                      onClick={async () => {
                        await handleFindIssuesFromSaved();
                        setTab(1);
                        setIssueMode(1);
                      }}
                      disabled={!selectedSaved.size || issueLoading}
                    >
                      Find Issues in {selectedSaved.size} Repo{selectedSaved.size !== 1 ? 's' : ''}
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          )}
          {/* ── Tab 3: Random Search ───────────────────────────────── */}
          {tab === 3 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1.5, overflow: 'hidden' }}>

              {/* ── Top controls bar: 80% width, left-aligned ── */}
              <Box sx={{ width: '80%', display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                {/* Controls row */}
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <TextField
                    label="Extra Keyword (optional)"
                    size="small"
                    sx={{ width: 220 }}
                    value={rs.keyword}
                    onChange={e => rs.setKeyword(e.target.value)}
                    placeholder="blank = use category words"
                    disabled={rs.running}
                  />
                  <TextField
                    label="Queue limit (0 = ∞)"
                    type="number"
                    size="small"
                    sx={{ width: 135 }}
                    value={rs.limit}
                    onChange={e => rs.setLimit(Number(e.target.value))}
                    inputProps={{ min: 0 }}
                    disabled={rs.running}
                  />
                  {rs.running ? (
                    <Button variant="contained" color="error" size="small" onClick={rs.stopSearch}>■ Stop</Button>
                  ) : (
                    <Button variant="contained" color="secondary" size="small" startIcon={<SmartIcon />} onClick={rs.startSearch}>
                      Start Random Search
                    </Button>
                  )}
                  {rs.imported > 0 && (
                    <Chip label={`${rs.imported} imported`} color="success" size="small" sx={{ fontWeight: 700 }} />
                  )}
                  {rs.running && (
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                      Search runs in background — use the tray (bottom-right) to monitor.
                    </Typography>
                  )}
                </Box>

                {/* Keyword category selector */}
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: rs.showCategories ? 0.75 : 0 }}>
                    <Button
                      size="small"
                      variant={rs.showCategories ? 'contained' : 'outlined'}
                      sx={{ fontSize: 11, py: 0.25, px: 1 }}
                      onClick={() => rs.setShowCategories(v => !v)}
                    >
                      {rs.showCategories ? '▲ Hide' : '▼ Keyword Categories'}
                    </Button>
                    {rs.showCategories && (
                      <>
                        <Button size="small" sx={{ fontSize: 11 }}
                          onClick={() => rs.setSelectedCategories(new Set(Object.keys(WORD_CATEGORIES)))}>
                          Select All
                        </Button>
                        <Button size="small" sx={{ fontSize: 11 }}
                          onClick={() => rs.setSelectedCategories(new Set())}>
                          Select None
                        </Button>
                      </>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {rs.selectedCategories.size === 0
                        ? `All categories · ${Object.values(WORD_CATEGORIES).flat().length} words`
                        : `${rs.selectedCategories.size} categor${rs.selectedCategories.size === 1 ? 'y' : 'ies'} · ${getActivePool(rs.selectedCategories).length} words`}
                    </Typography>
                  </Stack>
                  {rs.showCategories && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                      {Object.keys(WORD_CATEGORIES).map(cat => {
                        const isSel = rs.selectedCategories.has(cat);
                        const active = rs.selectedCategories.size === 0 || isSel;
                        return (
                          <Chip
                            key={cat}
                            label={`${cat} (${WORD_CATEGORIES[cat].length})`}
                            size="small"
                            variant={isSel ? 'filled' : 'outlined'}
                            color={isSel ? 'primary' : 'default'}
                            onClick={() => {
                              rs.setSelectedCategories(prev => {
                                const n = new Set(prev);
                                n.has(cat) ? n.delete(cat) : n.add(cat);
                                return n;
                              });
                            }}
                            disabled={rs.running}
                            sx={{ fontSize: 11, opacity: active ? 1 : 0.5 }}
                          />
                        );
                      })}
                    </Box>
                  )}
                </Box>
              </Box>

              {/* ── Bottom: 50/50 Terminal | Review Panel ── */}
              <Box sx={{ display: 'flex', flexDirection: 'row', flexGrow: 1, gap: 2, overflow: 'hidden', minHeight: 0 }}>

              {/* ── Left 50%: Terminal ── */}
              <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* macOS white terminal */}
                <Box
                  sx={{
                    flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    border: '1px solid #d1d1d6', borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)', mb: 2,
                  }}
                >
                  {/* Title bar */}
                  <Box
                    sx={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      bgcolor: '#ececec', px: 1.5, py: '6px',
                      borderBottom: '1px solid #d1d1d6', borderRadius: '8px 8px 0 0',
                      flexShrink: 0,
                    }}
                  >
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff5f57', border: '0.5px solid rgba(0,0,0,0.12)' }} />
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#febc2e', border: '0.5px solid rgba(0,0,0,0.12)' }} />
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#28c840', border: '0.5px solid rgba(0,0,0,0.12)' }} />
                    <Typography variant="caption" sx={{ flexGrow: 1, textAlign: 'center', color: '#555', fontSize: 11, fontWeight: 500, letterSpacing: 0.2 }}>
                      Random Search — Terminal
                    </Typography>
                    {rs.running && <CircularProgress size={10} sx={{ mr: 0.5 }} />}
                  </Box>
                  {/* Log body */}
                  <Box
                    sx={{
                      flexGrow: 1, overflow: 'auto', bgcolor: '#ffffff',
                      p: 1.5, fontFamily: '"SF Mono", "Menlo", "Monaco", "Consolas", monospace',
                      fontSize: 12, color: '#1d1d1f', borderRadius: '0 0 8px 8px',
                    }}
                  >
                    {rs.log.length === 0 ? (
                      <Typography variant="caption" sx={{ color: '#aeaeb2', fontFamily: 'inherit' }}>
                        Press "Start" to continuously search repos for issues using random English words.
                        Found issues will appear in the Review Panel on the right.
                      </Typography>
                    ) : (
                      rs.log.map((entry, i) => (
                        <Typography
                          key={i}
                          variant="caption"
                          display="block"
                          sx={{
                            color: entry.color === 'inherit' ? '#1d1d1f' : entry.color,
                            whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: 'inherit',
                          }}
                        >
                          {entry.text}
                        </Typography>
                      ))
                    )}
                  </Box>
                </Box>
              </Box>

              {/* ── Right 50%: Review Panel ── */}
              <Box
                sx={{
                  width: '50%', display: 'flex', flexDirection: 'column',
                  border: '1px solid', borderColor: 'divider', borderRadius: 2,
                  overflow: 'hidden', minWidth: 0, mb: 2,
                }}
              >
                {/* Panel header */}
                <Box
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 2, py: 1.25, bgcolor: 'grey.50',
                    borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0,
                  }}
                >
                  <ReviewIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
                    Review Panel
                    {rs.queue.length > 0 && (
                      <Badge badgeContent={rs.queue.length} color="warning" sx={{ ml: 1.5 }} />
                    )}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={rs.autoApprove}
                        onChange={e => rs.setAutoApprove(e.target.checked)}
                        size="small" color="success"
                        disabled={rs.running}
                      />
                    }
                    label={<Typography variant="caption" sx={{ fontSize: 10 }}>Auto</Typography>}
                    sx={{ m: 0, mr: 0.5 }}
                  />
                  {rs.queue.length > 0 && (
                    <>
                      <Button size="small" color="success" variant="contained" sx={{ fontSize: 11, mr: 0.5 }} onClick={rs.handleApproveAll}>
                        Approve All
                      </Button>
                      <Tooltip title="Reject all pending">
                        <Button size="small" color="error" variant="outlined" sx={{ fontSize: 11 }} onClick={rs.handleRejectAll}>
                          Reject all
                        </Button>
                      </Tooltip>
                    </>
                  )}
                </Box>

                {/* Panel body */}
                {rs.queue.length === 0 ? (
                  <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, color: 'text.disabled' }}>
                    <ReviewIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      {rs.autoApprove ? 'Auto-approve is ON — issues are imported automatically.' : 'No issues waiting for review.'}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" textAlign="center" sx={{ mt: 0.5 }}>
                      Start the search — found issues will appear here for your approval before being imported.
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {rs.queue.map((item) => (
                      <Paper
                        key={item.uid}
                        variant="outlined"
                        sx={{
                          p: 1.5, borderRadius: 1.5, flexShrink: 0,
                          borderColor: scoreMuiColor(item.score) === 'success' ? 'success.light'
                            : scoreMuiColor(item.score) === 'warning' ? 'warning.light' : 'error.light',
                          bgcolor: scoreMuiColor(item.score) === 'success' ? '#f0fdf4'
                            : scoreMuiColor(item.score) === 'warning' ? '#fffbeb' : '#fef2f2',
                        }}
                      >
                        {/* Issue title */}
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{ mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={item.issue.issueTitle}
                        >
                          {item.issue.issueTitle || '(no title)'}
                        </Typography>

                        {/* Meta row */}
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" alignItems="center" sx={{ mb: 1 }}>
                          <Chip
                            label={`Score: ${item.score}`}
                            size="small"
                            color={scoreMuiColor(item.score)}
                            sx={{ fontWeight: 700, fontSize: 11 }}
                          />
                          {item.issue.repoCategory && (
                            <Chip label={item.issue.repoCategory} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                          )}
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 160 }}>
                            {item.issue.repoName}
                          </Typography>
                        </Stack>

                        {/* Score breakdown tooltip + action buttons */}
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Tooltip
                            title={
                              <Box>
                                {Object.entries(item.breakdown).map(([k, v]) => (
                                  <Typography key={k} variant="caption" display="block">
                                    {k}: +{v}
                                  </Typography>
                                ))}
                              </Box>
                            }
                          >
                            <Typography variant="caption" color="text.disabled" sx={{ cursor: 'default', flexGrow: 1 }}>
                              Breakdown ▸
                            </Typography>
                          </Tooltip>
                          {item.issue.issueLink && (
                            <Tooltip title="Open on GitHub">
                              <IconButton
                                size="small"
                                component="a"
                                href={item.issue.issueLink}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <OpenInNewIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Reject — don't import">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => rs.handleReject(item.uid)}
                              disabled={rs.approvingId === item.uid}
                            >
                              <RejectIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Approve — import now">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => rs.handleApprove(item.uid)}
                              disabled={rs.approvingId === item.uid}
                            >
                              {rs.approvingId === item.uid
                                ? <CircularProgress size={16} />
                                : <ApproveIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>

              </Box>{/* end 50/50 row */}
            </Box>{/* end tab 3 column */}
          )}
        </DialogContent>
      </Dialog>

      {/* Nested repo detail dialog */}
      <RepoDetailDialog
        repo={detailRepo}
        open={Boolean(detailRepo)}
        onClose={() => setDetailRepo(null)}
        onSave={repo => handleSaveRepos([repo])}
      />
    </>
  );
}
