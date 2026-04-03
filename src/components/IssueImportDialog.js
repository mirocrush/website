import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Paper, Chip, Stack,
  Alert, LinearProgress, Checkbox, Tooltip, IconButton,
} from '@mui/material';
import {
  Upload as UploadIcon,
  CheckCircle as OkIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { createIssue } from '../api/githubIssuesApi';

const CATEGORIES = ['Python', 'JavaScript', 'TypeScript'];

// Normalize a header string to a known field key
const HEADER_MAP = {
  reponame:     'repoName',
  repo_name:    'repoName',
  repo:         'repoName',
  issuelink:    'issueLink',
  issue_link:   'issueLink',
  issuetitle:   'issueTitle',
  issue_title:  'issueTitle',
  title:        'issueTitle',
  basesha:      'baseSha',
  base_sha:     'baseSha',
  sha:          'baseSha',
  repocategory: 'repoCategory',
  repo_category:'repoCategory',
  category:     'repoCategory',
  prlink:       'prLink',
  pr_link:      'prLink',
  pr:           'prLink',
  fileschanged: 'filesChanged',
  files_changed:'filesChanged',
  files:        'filesChanged',
  status:       'takenStatus',
  takenstatus:  'takenStatus',
  taken_status: 'takenStatus',
};

function normalizeHeader(h) {
  // Strip all whitespace including non-breaking spaces, then lowercase
  const normalized = String(h).replace(/[\s\u00A0\u200B\uFEFF]+/g, '').toLowerCase();
  return HEADER_MAP[normalized] || null;
}

function validateRow(row) {
  const errors = [];
  if (!row.repoName)     errors.push('repoName required');
  if (!row.issueLink)    errors.push('issueLink required');
  if (!row.issueTitle)   errors.push('issueTitle required');
  if (!row.baseSha)      errors.push('baseSha required');
  if (!row.repoCategory) errors.push('repoCategory required');
  else if (!CATEGORIES.includes(row.repoCategory))
    errors.push(`repoCategory must be one of: ${CATEGORIES.join(', ')}`);
  return errors;
}

function parseSheet(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (raw.length < 2) return { rows: [], unknownHeaders: [] };

  const headerRow = raw[0];
  const colMap = {}; // colIndex → fieldKey
  const unknownHeaders = [];

  headerRow.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key) colMap[i] = key;
    else if (String(h).trim()) unknownHeaders.push(String(h));
  });

  const rows = raw.slice(1)
    .filter((r) => r.some((c) => String(c).trim()))
    .map((r, rowIdx) => {
      const obj = {};
      Object.entries(colMap).forEach(([i, key]) => {
        obj[key] = String(r[i] ?? '').trim();
      });
      // Normalize filesChanged: keep as comma-separated string
      const errors = validateRow(obj);
      return { _rowIdx: rowIdx + 2, ...obj, _errors: errors, _status: 'pending' };
    });

  return { rows, unknownHeaders };
}

// ── Main Dialog ──────────────────────────────────────────────────────────────

export default function IssueImportDialog({ open, onClose, onImported }) {
  const [rows, setRows]               = useState([]);
  const [selected, setSelected]       = useState(new Set());
  const [unknownHeaders, setUnknownHeaders] = useState([]);
  const [parseError, setParseError]   = useState('');
  const [importing, setImporting]     = useState(false);
  const [progress, setProgress]       = useState(0);   // 0-100
  const [results, setResults]         = useState(null); // { succeeded, failed }
  const fileRef = useRef();

  const reset = () => {
    setRows([]);
    setSelected(new Set());
    setUnknownHeaders([]);
    setParseError('');
    setImporting(false);
    setProgress(0);
    setResults(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback((file) => {
    if (!file) return;
    setParseError('');
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError('Please upload an .xlsx, .xls, or .csv file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const { rows: parsed, unknownHeaders: unk } = parseSheet(wb);
        if (parsed.length === 0) {
          setParseError('No data rows found in the file.');
          return;
        }
        setRows(parsed);
        setUnknownHeaders(unk);
        // Pre-select all valid rows
        const validSet = new Set(
          parsed.filter((r) => r._errors.length === 0).map((r) => r._rowIdx)
        );
        setSelected(validSet);
      } catch (err) {
        setParseError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const toggleRow = (rowIdx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIdx)) next.delete(rowIdx);
      else next.add(rowIdx);
      return next;
    });
  };

  const toggleAll = () => {
    const validRows = rows.filter((r) => r._errors.length === 0);
    const allValid = validRows.every((r) => selected.has(r._rowIdx));
    if (allValid) {
      setSelected(new Set());
    } else {
      setSelected(new Set(validRows.map((r) => r._rowIdx)));
    }
  };

  const handleImport = async () => {
    const toImport = rows.filter((r) => selected.has(r._rowIdx));
    if (toImport.length === 0) return;

    setImporting(true);
    setProgress(0);

    let succeeded = 0;
    let failed = 0;
    const updatedRows = rows.map((r) => ({ ...r }));

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      const rowInList = updatedRows.find((r) => r._rowIdx === row._rowIdx);

      try {
        const VALID_STATUSES = ['open', 'progress', 'done', 'failed'];
        const rawStatus = (row.takenStatus || '').toLowerCase();
        const payload = {
          repoName:     row.repoName,
          issueLink:    row.issueLink,
          issueTitle:   row.issueTitle,
          baseSha:      row.baseSha,
          repoCategory: row.repoCategory,
          prLink:       row.prLink || null,
          filesChanged: row.filesChanged
            ? row.filesChanged.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          shared:      false,
          takenStatus: VALID_STATUSES.includes(rawStatus) ? rawStatus : 'open',
          addedVia:    'excel',
        };
        await createIssue(payload);
        rowInList._status = 'success';
        succeeded++;
      } catch (err) {
        rowInList._status = 'error';
        rowInList._importError = err.response?.data?.message || err.message;
        failed++;
      }

      setProgress(Math.round(((i + 1) / toImport.length) * 100));
      setRows([...updatedRows]);
    }

    setImporting(false);
    setResults({ succeeded, failed });
    if (succeeded > 0) onImported(succeeded);
  };

  const selectedCount  = rows.filter((r) => selected.has(r._rowIdx)).length;
  const validCount     = rows.filter((r) => r._errors.length === 0).length;
  const allValidSelected = validCount > 0 && rows.filter((r) => r._errors.length === 0).every((r) => selected.has(r._rowIdx));

  return (
    <Dialog open={open} onClose={importing ? undefined : handleClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <UploadIcon />
        Import Issues from Excel / CSV
        <Box sx={{ flex: 1 }} />
        {!importing && (
          <IconButton size="small" onClick={handleClose}><CloseIcon /></IconButton>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {/* ── Drop zone (shown when no file loaded) ── */}
        {rows.length === 0 && !parseError && (
          <Box
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              py: 6,
              textAlign: 'center',
              cursor: 'pointer',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
            }}
          >
            <UploadIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" fontWeight={600}>
              Drop your Excel or CSV file here
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supports .xlsx, .xls, .csv
            </Typography>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </Box>
        )}

        {/* ── Template hint ── */}
        {rows.length === 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Expected columns (order does not matter):&nbsp;
              <strong>repoName, issueLink, issueTitle, baseSha, repoCategory</strong>
              &nbsp;(required),&nbsp;
              <em>prLink, filesChanged</em>&nbsp;(optional)
            </Typography>
          </Box>
        )}

        {parseError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setParseError('')}>
            {parseError}
          </Alert>
        )}

        {/* ── Unknown header warning ── */}
        {unknownHeaders.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Unrecognized columns were ignored: {unknownHeaders.join(', ')}
          </Alert>
        )}

        {/* ── Import result summary ── */}
        {results && (
          <Alert severity={results.failed === 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
            Import complete — {results.succeeded} succeeded, {results.failed} failed.
          </Alert>
        )}

        {/* ── Progress bar ── */}
        {importing && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary">
              {progress}% — please wait…
            </Typography>
          </Box>
        )}

        {/* ── Preview table ── */}
        {rows.length > 0 && (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {rows.length} row{rows.length !== 1 ? 's' : ''} parsed&nbsp;·&nbsp;
                {validCount} valid&nbsp;·&nbsp;
                {selectedCount} selected
              </Typography>
              {!results && !importing && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => { reset(); fileRef.current && (fileRef.current.value = ''); }}
                >
                  Change file
                </Button>
              )}
            </Stack>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={allValidSelected}
                        indeterminate={selectedCount > 0 && !allValidSelected}
                        onChange={toggleAll}
                        disabled={importing || !!results}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Repo Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Issue Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Base SHA</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>PR Link</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Files Changed</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const hasErrors = row._errors.length > 0;
                    const isSelected = selected.has(row._rowIdx);

                    let statusChip = null;
                    if (row._status === 'success') {
                      statusChip = <Chip icon={<OkIcon />} label="Imported" color="success" size="small" />;
                    } else if (row._status === 'error') {
                      statusChip = (
                        <Tooltip title={row._importError || 'Error'}>
                          <Chip icon={<ErrorIcon />} label="Failed" color="error" size="small" />
                        </Tooltip>
                      );
                    } else if (hasErrors) {
                      statusChip = (
                        <Tooltip title={row._errors.join('; ')}>
                          <Chip icon={<ErrorIcon />} label="Invalid" color="error" size="small" variant="outlined" />
                        </Tooltip>
                      );
                    } else {
                      statusChip = <Chip label="Valid" color="success" size="small" variant="outlined" />;
                    }

                    return (
                      <TableRow
                        key={row._rowIdx}
                        selected={isSelected}
                        sx={{ opacity: hasErrors ? 0.55 : 1 }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            disabled={hasErrors || importing || !!results}
                            onChange={() => toggleRow(row._rowIdx)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">{row._rowIdx}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                            {row.repoName || <em style={{ color: '#aaa' }}>—</em>}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                            {row.issueTitle || <em style={{ color: '#aaa' }}>—</em>}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {row.repoCategory
                            ? <Chip label={row.repoCategory} size="small" />
                            : <em style={{ color: '#aaa', fontSize: 12 }}>—</em>}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" noWrap sx={{ maxWidth: 100 }}>
                            {row.baseSha || <em style={{ color: '#aaa' }}>—</em>}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" noWrap sx={{ maxWidth: 120 }}>
                            {row.prLink || <em style={{ color: '#aaa' }}>—</em>}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" noWrap sx={{ maxWidth: 160 }}>
                            {row.filesChanged || <em style={{ color: '#aaa' }}>—</em>}
                          </Typography>
                        </TableCell>
                        <TableCell>{statusChip}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={importing}>
          {results ? 'Close' : 'Cancel'}
        </Button>
        {rows.length > 0 && !results && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
          >
            {importing ? `Importing… ${progress}%` : `Import ${selectedCount} Issue${selectedCount !== 1 ? 's' : ''}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
