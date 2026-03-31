import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, Tooltip, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Pagination,
  CircularProgress, Alert, Stack, Divider, Switch, FormControlLabel,
  InputAdornment, TableSortLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Visibility as ViewIcon,
  Notes as PromptsIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import {
  listPrompts, createPrompt, updatePrompt, setMainPrompt,
  clonePrompt, deletePrompt,
} from '../api/promptsApi';

const PAGE_SIZE = 15;
const EMPTY_FORM = { title: '', content: '', shared: false };

// Plain-text editor dialog (like notepad)
function PromptEditorDialog({ open, onClose, onSaved, editData }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (open) {
      setForm(editData
        ? { title: editData.title || '', content: editData.content || '', shared: Boolean(editData.shared) }
        : EMPTY_FORM
      );
      setError('');
    }
  }, [open, editData]);

  const handleSubmit = async () => {
    setError('');
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required.');
      return;
    }
    setSaving(true);
    try {
      if (editData) {
        const res = await updatePrompt(editData.id, { title: form.title, content: form.content, shared: form.shared });
        onSaved(res.data.data);
      } else {
        const res = await createPrompt({ title: form.title, content: form.content, shared: form.shared });
        onSaved(res.data.data);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save prompt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { height: '80vh', display: 'flex', flexDirection: 'column' } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        {editData ? 'Edit Prompt' : 'New Prompt'}
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Title *"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          fullWidth size="small"
        />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            Content *
          </Typography>
          {/* Plain-text editor — monospace font like notepad */}
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            style={{
              flex: 1,
              width: '100%',
              resize: 'none',
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: 13,
              lineHeight: 1.6,
              padding: '10px 12px',
              border: '1px solid #ccc',
              borderRadius: 4,
              outline: 'none',
              background: '#fafafa',
              boxSizing: 'border-box',
              minHeight: 300,
            }}
            spellCheck={false}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, textAlign: 'right' }}>
            {form.content.length} characters · {form.content ? form.content.split('\n').length : 0} lines
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={form.shared}
              onChange={(e) => setForm((f) => ({ ...f, shared: e.target.checked }))}
            />
          }
          label="Shared (visible to others)"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          {saving ? <CircularProgress size={18} /> : editData ? 'Save Changes' : 'Create Prompt'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Nice viewer modal with formatted text
function PromptViewDialog({ open, onClose, prompt }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!prompt?.content) return;
    navigator.clipboard.writeText(prompt.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!prompt) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { height: '80vh', display: 'flex', flexDirection: 'column' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PromptsIcon />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" component="span">{prompt.title}</Typography>
          {prompt.isMain && (
            <Chip label="Main" color="warning" size="small" icon={<StarIcon />} sx={{ ml: 1 }} />
          )}
        </Box>
        {prompt.shared && <Chip label="Shared" color="success" size="small" variant="outlined" />}
      </DialogTitle>
      <DialogContent dividers sx={{ flex: 1, overflow: 'auto' }}>
        <Box
          component="pre"
          sx={{
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: 13,
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            m: 0,
            color: 'text.primary',
          }}
        >
          {prompt.content}
        </Box>
      </DialogContent>
      <DialogActions>
        <Box sx={{ mr: 'auto', pl: 1 }}>
          <Typography variant="caption" color="text.secondary">
            By @{prompt.userId?.username || '?'} · {new Date(prompt.createdAt).toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {prompt.content?.length || 0} characters · {prompt.content ? prompt.content.split('\n').length : 0} lines
          </Typography>
        </Box>
        <Button
          startIcon={<CopyIcon />}
          onClick={handleCopy}
          color={copied ? 'success' : 'inherit'}
          size="small"
        >
          {copied ? 'Copied!' : 'Copy Content'}
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteConfirmDialog({ open, onClose, onConfirm, prompt, deleting }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Prompt?</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete <strong>{prompt?.title}</strong>? This cannot be undone.
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

export default function Prompts() {
  const { user } = useAuth();

  const [prompts, setPrompts] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [search, setSearch]           = useState('');
  const [sharedFilter, setSharedFilter] = useState('');
  const [sortField, setSortField]     = useState('createdAt');
  const [sortDir, setSortDir]         = useState('desc');
  const [page, setPage]               = useState(1);

  const [editorOpen, setEditorOpen]   = useState(false);
  const [editData, setEditData]       = useState(null);
  const [viewPrompt, setViewPrompt]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]       = useState(false);
  const [settingMain, setSettingMain] = useState(null);   // id being set as own main
  const [cloning, setCloning]         = useState(null);  // id being cloned

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listPrompts({
        search,
        shared:    sharedFilter !== '' ? sharedFilter : undefined,
        sortField,
        sortDir,
        page,
        limit: PAGE_SIZE,
      });
      setPrompts(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load prompts.');
    } finally {
      setLoading(false);
    }
  }, [search, sharedFilter, sortField, sortDir, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, sharedFilter, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleSaved = (prompt) => {
    setPrompts((prev) => {
      const idx = prev.findIndex((p) => p.id === prompt.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = prompt;
        return next;
      }
      // New prompt — if first prompt, mark it as main locally too
      return [prompt, ...prev];
    });
    setTotal((t) => editData ? t : t + 1);
    setEditData(null);
  };

  const handleSetMain = async (prompt) => {
    setSettingMain(prompt.id);
    try {
      await setMainPrompt(prompt.id);
      // Update local state: only this prompt is main
      setPrompts((prev) => prev.map((p) => ({ ...p, isMain: p.id === prompt.id })));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set main prompt.');
    } finally {
      setSettingMain(null);
    }
  };

  const handleClone = async (prompt, e) => {
    e.stopPropagation();
    setCloning(prompt.id);
    try {
      const res = await clonePrompt(prompt.id);
      setPrompts((prev) => [res.data.data, ...prev]);
      setTotal((t) => t + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clone prompt.');
    } finally {
      setCloning(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePrompt(deleteTarget.id);
      setPrompts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setTotal((t) => t - 1);
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete prompt.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const isOwner = (prompt) =>
    prompt.userId?.id === user?._id || prompt.userId?.id === user?.id;

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

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <PromptsIcon sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
          My Prompts
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditData(null); setEditorOpen(true); }}>
          New Prompt
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Search title or content…"
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
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Shared</InputLabel>
            <Select value={sharedFilter} onChange={(e) => setSharedFilter(e.target.value)} label="Shared">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Shared</MenuItem>
              <MenuItem value="false">Private</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {total} prompt{total !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 40 }}>Main</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{sortLabel('title', 'Title')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Preview</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{sortLabel('shared', 'Shared')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Author</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{sortLabel('createdAt', 'Date')}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : prompts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No prompts found.
                </TableCell>
              </TableRow>
            ) : (
              prompts.map((prompt) => (
                <TableRow
                  key={prompt.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setViewPrompt(prompt)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isOwner(prompt) ? (
                      <Tooltip title={prompt.isMain ? 'Main prompt' : 'Set as main'} arrow>
                        <span>
                          <IconButton
                            size="small"
                            color={prompt.isMain ? 'warning' : 'default'}
                            disabled={settingMain === prompt.id || prompt.isMain}
                            onClick={() => !prompt.isMain && handleSetMain(prompt)}
                          >
                            {settingMain === prompt.id
                              ? <CircularProgress size={16} />
                              : prompt.isMain ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />
                            }
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                      {prompt.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ maxWidth: 340, display: 'block', fontFamily: 'monospace' }}
                    >
                      {prompt.content?.slice(0, 100)}{prompt.content?.length > 100 ? '…' : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={prompt.shared ? 'Shared' : 'Private'}
                      size="small"
                      color={prompt.shared ? 'success' : 'default'}
                      variant={prompt.shared ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">@{prompt.userId?.username || '?'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{new Date(prompt.createdAt).toLocaleDateString()}</Typography>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => setViewPrompt(prompt)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {/* Clone — available for all accessible prompts */}
                      <Tooltip title="Clone to my prompts">
                        <span>
                          <IconButton
                            size="small"
                            disabled={cloning === prompt.id}
                            onClick={(e) => handleClone(prompt, e)}
                          >
                            {cloning === prompt.id
                              ? <CircularProgress size={16} />
                              : <CopyIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      {isOwner(prompt) ? (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => { setEditData(prompt); setEditorOpen(true); }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => setDeleteTarget(prompt)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

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

      <PromptEditorDialog
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditData(null); }}
        onSaved={handleSaved}
        editData={editData}
      />

      <PromptViewDialog
        open={Boolean(viewPrompt)}
        onClose={() => setViewPrompt(null)}
        prompt={viewPrompt}
      />

      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        prompt={deleteTarget}
        deleting={deleting}
      />
    </Container>
  );
}
