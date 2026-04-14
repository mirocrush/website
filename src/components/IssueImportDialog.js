import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react';
import { createIssue } from '../api/githubIssuesApi';

const CATEGORIES = ['Python', 'JavaScript', 'TypeScript'];

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
  const colMap = {};
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
      const errors = validateRow(obj);
      return { _rowIdx: rowIdx + 2, ...obj, _errors: errors, _status: 'pending' };
    });

  return { rows, unknownHeaders };
}

// ── Main Dialog ──────────────────────────────────────────────────────────────

export default function IssueImportDialog({ open, onClose, onImported }) {
  const [rows, setRows]                     = useState([]);
  const [selected, setSelected]             = useState(new Set());
  const [unknownHeaders, setUnknownHeaders] = useState([]);
  const [parseError, setParseError]         = useState('');
  const [importing, setImporting]           = useState(false);
  const [progress, setProgress]             = useState(0);
  const [results, setResults]               = useState(null);
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

  const selectedCount    = rows.filter((r) => selected.has(r._rowIdx)).length;
  const validCount       = rows.filter((r) => r._errors.length === 0).length;
  const allValidSelected = validCount > 0 && rows.filter((r) => r._errors.length === 0).every((r) => selected.has(r._rowIdx));

  if (!open) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-6xl w-full">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          <Upload size={20} />
          <h3 className="font-bold text-lg flex-1">Import Issues from Excel / CSV</h3>
          {!importing && (
            <button className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* ── Drop zone ───────────────────────────────────────────────────── */}
        {rows.length === 0 && !parseError && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-base-300 rounded-xl py-12 text-center cursor-pointer hover:border-primary hover:bg-base-200 transition-colors"
          >
            <Upload size={48} className="mx-auto text-base-content/30 mb-2" />
            <p className="font-semibold">Drop your Excel or CSV file here</p>
            <p className="text-xs text-base-content/50">Supports .xlsx, .xls, .csv</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* ── Template hint ───────────────────────────────────────────────── */}
        {rows.length === 0 && (
          <p className="text-xs text-base-content/50 mt-2">
            Expected columns (order does not matter):&nbsp;
            <strong>repoName, issueLink, issueTitle, baseSha, repoCategory</strong>
            &nbsp;(required),&nbsp;
            <em>prLink, filesChanged</em>&nbsp;(optional)
          </p>
        )}

        {/* ── Alerts ──────────────────────────────────────────────────────── */}
        {parseError && (
          <div role="alert" className="alert alert-error text-sm mb-3 mt-2">
            <AlertCircle size={16} />
            <span>{parseError}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setParseError('')}>
              <X size={12} />
            </button>
          </div>
        )}

        {unknownHeaders.length > 0 && (
          <div role="alert" className="alert alert-warning text-sm mb-3">
            <AlertCircle size={16} />
            <span>Unrecognized columns were ignored: {unknownHeaders.join(', ')}</span>
          </div>
        )}

        {results && (
          <div role="alert" className={`alert text-sm mb-3 ${results.failed === 0 ? 'alert-success' : 'alert-warning'}`}>
            <CheckCircle size={16} />
            <span>Import complete — {results.succeeded} succeeded, {results.failed} failed.</span>
          </div>
        )}

        {importing && (
          <div className="mb-3">
            <progress className="progress progress-primary w-full" value={progress} max="100" />
            <p className="text-xs text-base-content/50 mt-0.5">{progress}% — please wait…</p>
          </div>
        )}

        {/* ── Preview table ────────────────────────────────────────────────── */}
        {rows.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm text-base-content/60">
                {rows.length} row{rows.length !== 1 ? 's' : ''} parsed · {validCount} valid · {selectedCount} selected
              </span>
              {!results && !importing && (
                <button
                  className="btn btn-outline btn-xs"
                  onClick={() => { reset(); if (fileRef.current) fileRef.current.value = ''; }}
                >
                  Change file
                </button>
              )}
            </div>

            <div className="overflow-auto max-h-[420px] border border-base-300 rounded-lg">
              <table className="table table-sm table-pin-rows">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={allValidSelected}
                        ref={(el) => { if (el) el.indeterminate = selectedCount > 0 && !allValidSelected; }}
                        onChange={toggleAll}
                        disabled={importing || !!results}
                      />
                    </th>
                    <th>#</th>
                    <th>Repo Name</th>
                    <th>Issue Title</th>
                    <th>Category</th>
                    <th>Base SHA</th>
                    <th>PR Link</th>
                    <th>Files Changed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const hasErrors  = row._errors.length > 0;
                    const isSelected = selected.has(row._rowIdx);

                    let statusCell;
                    if (row._status === 'success') {
                      statusCell = (
                        <span className="badge badge-success badge-sm gap-1">
                          <CheckCircle size={11} /> Imported
                        </span>
                      );
                    } else if (row._status === 'error') {
                      statusCell = (
                        <div className="tooltip" data-tip={row._importError || 'Error'}>
                          <span className="badge badge-error badge-sm gap-1">
                            <AlertCircle size={11} /> Failed
                          </span>
                        </div>
                      );
                    } else if (hasErrors) {
                      statusCell = (
                        <div className="tooltip" data-tip={row._errors.join('; ')}>
                          <span className="badge badge-error badge-outline badge-sm gap-1">
                            <AlertCircle size={11} /> Invalid
                          </span>
                        </div>
                      );
                    } else {
                      statusCell = (
                        <span className="badge badge-success badge-outline badge-sm">Valid</span>
                      );
                    }

                    return (
                      <tr
                        key={row._rowIdx}
                        className={`${isSelected ? 'bg-base-200' : ''} ${hasErrors ? 'opacity-55' : ''}`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={isSelected}
                            disabled={hasErrors || importing || !!results}
                            onChange={() => toggleRow(row._rowIdx)}
                          />
                        </td>
                        <td className="text-xs text-base-content/50">{row._rowIdx}</td>
                        <td className="text-sm max-w-[180px] truncate">
                          {row.repoName || <em className="text-base-content/30">—</em>}
                        </td>
                        <td className="text-sm max-w-[220px] truncate">
                          {row.issueTitle || <em className="text-base-content/30">—</em>}
                        </td>
                        <td>
                          {row.repoCategory
                            ? <span className="badge badge-sm">{row.repoCategory}</span>
                            : <em className="text-xs text-base-content/30">—</em>}
                        </td>
                        <td className="text-xs max-w-[100px] truncate">
                          {row.baseSha || <em className="text-base-content/30">—</em>}
                        </td>
                        <td className="text-xs max-w-[120px] truncate">
                          {row.prLink || <em className="text-base-content/30">—</em>}
                        </td>
                        <td className="text-xs max-w-[160px] truncate">
                          {row.filesChanged || <em className="text-base-content/30">—</em>}
                        </td>
                        <td>{statusCell}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="modal-action mt-4">
          <button className="btn btn-ghost" onClick={handleClose} disabled={importing}>
            {results ? 'Close' : 'Cancel'}
          </button>
          {rows.length > 0 && !results && (
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
            >
              {importing ? (
                <><span className="loading loading-spinner loading-sm" /> Importing… {progress}%</>
              ) : (
                `Import ${selectedCount} Issue${selectedCount !== 1 ? 's' : ''}`
              )}
            </button>
          )}
        </div>
      </div>

      {!importing && (
        <form method="dialog" className="modal-backdrop">
          <button onClick={handleClose}>close</button>
        </form>
      )}
    </dialog>
  );
}
